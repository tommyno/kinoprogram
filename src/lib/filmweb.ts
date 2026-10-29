import { z } from 'zod';

// Filmweb's public site backend (undocumented). One call returns every show in a city.
const ENDPOINT = 'https://movieinfoqs.filmweb.no/graphql';
const USER_AGENT = 'oslokinoprogram/0.1';
export const LOCATION = 'Oslo';

const SHOWS_QUERY = `query Shows($location: String) {
  showQuery {
    getShows(location: $location) {
      movieMainVersionId movieVersionId movieTitle theaterName screenName
      showStart showType ticketSaleUrl lengthInMinutes rating
      versionTags { tag type }
    }
  }
}`;

const MOVIES_QUERY = `query Movies($location: String) {
  movieQuery {
    getCurrentMovies(location: $location) {
      mainVersionId title titleOriginal lengthInMinutes rating sanityImagePosterUrl
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
  showType: z.string().nullable(),
  ticketSaleUrl: z.string().nullable(),
  lengthInMinutes: z.number().nullable(),
  rating: z.string().nullable(),
  versionTags: z.array(z.object({ tag: z.string(), type: z.string() })).nullable(),
});
export type RawShow = z.infer<typeof RawShow>;

export const RawMovie = z.object({
  mainVersionId: z.string(),
  title: z.string(),
  titleOriginal: z.string().nullable(),
  lengthInMinutes: z.number().nullable(),
  rating: z.string().nullable(),
  sanityImagePosterUrl: z.string().nullable(),
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
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Filmweb svarte ${res.status} ${res.statusText}`);
  }
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
