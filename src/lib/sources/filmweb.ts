import { z } from 'zod';
import { fetchOk } from '../http.ts';
import { slugify, type Film, type Program, type Showing, type Source } from '../program.ts';
import { programSlot } from '../time.ts';

// Filmweb's public site backend (undocumented). One call returns every show in a city.
const NAME = 'Filmweb';
const ENDPOINT = 'https://movieinfoqs.filmweb.no/graphql';
export const LOCATION = 'Oslo';
const FILM_URL = 'https://www.filmweb.no/film/';
// Posters live on Sanity's CDN, which resizes by query string
const POSTER_WIDTHS = [200, 320, 480, 640];
const LARGE_POSTER_WIDTHS = [...POSTER_WIDTHS, 960, 1280, 1920];

const SHOWS_QUERY = `query Shows($location: String) {
  showQuery {
    getShows(location: $location) {
      movieMainVersionId movieVersionId movieTitle theaterName screenName
      showStart ticketSaleUrl lengthInMinutes rating
    }
  }
}`;

const MOVIES_QUERY = `query Movies($location: String) {
  movieQuery {
    getCurrentMovies(location: $location) {
      mainVersionId titleOriginal productionYear premiere lengthInMinutes rating
      sanityImagePosterUrl synopsisIngress synopsisBodyText
    }
  }
}`;

export const RawShow = z.object({
  movieMainVersionId: z.string(),
  movieVersionId: z.string(),
  movieTitle: z.string(),
  theaterName: z.string(),
  screenName: z.string().nullable(),
  // Local Oslo time without offset, e.g. "2026-10-29T10:15:00"
  showStart: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
  ticketSaleUrl: z.string().nullable(),
  lengthInMinutes: z.number().nullable(),
  rating: z.string().nullable(),
});
export type RawShow = z.infer<typeof RawShow>;

export const RawMovie = z.object({
  mainVersionId: z.string(),
  titleOriginal: z.string().nullable(),
  // "2026", or empty when unknown
  productionYear: z.string().nullable(),
  // Norwegian premiere, "2026-09-25T00:00:00"
  premiere: z.string().nullable(),
  lengthInMinutes: z.number().nullable(),
  rating: z.string().nullable(),
  sanityImagePosterUrl: z.string().nullable(),
  synopsisIngress: z.string().nullable(),
  synopsisBodyText: z.string().nullable(),
});
export type RawMovie = z.infer<typeof RawMovie>;

export const FilmwebSnapshot = z.object({
  fetchedAt: z.string(),
  shows: z.array(RawShow),
  movies: z.array(RawMovie),
});
export type FilmwebSnapshot = z.infer<typeof FilmwebSnapshot>;

const ShowsData = z.object({ showQuery: z.object({ getShows: z.array(RawShow) }) });
const MoviesData = z.object({ movieQuery: z.object({ getCurrentMovies: z.array(RawMovie) }) });

async function query<T>(query: string, variables: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const res = await fetchOk(NAME, ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (body.errors?.length) {
    throw new Error(`Filmweb GraphQL-feil: ${body.errors.map((e) => e.message).join('; ')}`);
  }
  return schema.parse(body.data);
}

/** Fetches the full program for a city: two requests, run one after the other. */
export async function fetchSnapshot(location: string = LOCATION): Promise<FilmwebSnapshot> {
  const fetchedAt = new Date().toISOString();
  const shows = await query(SHOWS_QUERY, { location }, ShowsData);
  const movies = await query(MOVIES_QUERY, { location }, MoviesData);
  return {
    fetchedAt,
    shows: shows.showQuery.getShows,
    movies: movies.movieQuery.getCurrentMovies,
  };
}

export function shortScreen(screen: string, cinema: string): string {
  let s = screen.trim();
  // Single-screen venues name the screen after the cinema: "Gimle", "Kunstnernes Hus"
  if (!s || cinema.startsWith(s)) return '';
  // "Saga 6" → "6", "Vega Kino TO" → "TO"
  if (s.startsWith(cinema)) s = s.slice(cinema.length).trim();
  s = s
    .replace('® by Coca-Cola', '')
    .replace(/\s+-\s+/, ' ')
    .replace(/\bisense\b/i, 'iSense')
    .trim();
  if (/^(\d+|EN|TO|TRE)$/.test(s)) s = `Sal ${s}`;
  return s;
}

function orNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function ageRating(rating: string | null): string | null {
  const r = orNull(rating);
  return r === 'Alle' ? 'Tillatt for alle' : r;
}

// A few ingresses have HTML in them, like <i>…</i>
function plainText(value: string | null | undefined): string | null {
  return orNull(value?.replace(/<[^>]+>/g, ''));
}

/** Filmweb turns letters outside Latin-1 into "?", as in "?? (Gunche)", which no search would find. */
function originalTitle(movie: RawMovie | undefined): string | null {
  const title = orNull(movie?.titleOriginal);
  return title && !title.includes('??') ? title : null;
}

/** The production year, the year after some classics' titles ("Zodiac (2007)"), or the premiere year. Some events have the year "1". */
function filmYear(movie: RawMovie | undefined, title: string): number | null {
  const years = [movie?.productionYear, title.match(/\((\d{4})\)$/)?.[1], movie?.premiere?.slice(0, 4)];
  return years.map(Number).find((year) => year > 1887) ?? null;
}

function posterSrc(url: string, width: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}w=${width}&auto=format`;
}

function srcSet(url: string, widths: number[]): string {
  return widths.map((w) => `${posterSrc(url, w)} ${w}w`).join(', ');
}

/** The CDN scales images up too, so the large versions stop at the size in the file name, as in "…-1128x1670.jpg". */
function largePoster(url: string): Film['posterLarge'] {
  const width = Number(url.match(/-(\d+)x\d+\.\w+(\?|$)/)?.[1]);
  if (!width) return undefined;
  return { srcSet: srcSet(url, [...LARGE_POSTER_WIDTHS.filter((w) => w < width), width]), width };
}

export function filmwebProgram(snapshot: FilmwebSnapshot): Program {
  const movies = new Map(snapshot.movies.map((m) => [m.mainVersionId, m]));
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};
  const seen = new Set<string>();

  for (const show of snapshot.shows) {
    // Filmweb also lists Vega Scene's theatre productions; their ids start with KUL
    if (show.movieMainVersionId.startsWith('KUL')) continue;

    const ticketUrl = orNull(show.ticketSaleUrl);
    const key = ticketUrl ?? [show.theaterName, show.screenName, show.showStart, show.movieVersionId].join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const filmId = show.movieMainVersionId;
    const movie = movies.get(filmId);
    const poster = orNull(movie?.sanityImagePosterUrl);
    const title = show.movieTitle.trim();
    films[filmId] ??= {
      title,
      originalTitle: originalTitle(movie),
      year: filmYear(movie, title),
      slug: slugify(title),
      minutes: show.lengthInMinutes || movie?.lengthInMinutes || null,
      ageRating: ageRating(show.rating) ?? ageRating(movie?.rating ?? null),
      // Many films have only the long body text, no ingress
      synopsis: plainText(movie?.synopsisIngress) ?? plainText(movie?.synopsisBodyText),
      posterUrl: poster && posterSrc(poster, 320),
      posterSrcSet: poster ? srcSet(poster, POSTER_WIDTHS) : undefined,
      posterLarge: poster ? largePoster(poster) : undefined,
      pageUrl: FILM_URL + filmId,
      source: NAME,
    };

    const slot = programSlot(show.showStart);
    (days[slot.day] ??= []).push({
      key,
      filmId,
      cinema: show.theaterName,
      screen: shortScreen(show.screenName ?? '', show.theaterName),
      ...slot,
      bookingUrl: ticketUrl ?? films[filmId].pageUrl,
    });
  }

  return { films, days };
}

export const filmweb: Source = {
  name: NAME,
  homepage: 'https://www.filmweb.no',
  file: 'filmweb-oslo.json',
  // Nearly every cinema in Oslo is in it
  required: true,
  fetch: async () => JSON.stringify(await fetchSnapshot()),
  program: (raw) => filmwebProgram(FilmwebSnapshot.parse(JSON.parse(raw))),
};
