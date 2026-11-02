import { z } from 'zod';
import { errorMessage, fetchOk } from './http.ts';
import type { Film, Person } from './program.ts';

// The films' trailer, director and cast, and a poster for films without one, found by title and year. Needs a read access
// token from themoviedb.org
const API = 'https://api.themoviedb.org/3';
const PERSON_URL = 'https://www.themoviedb.org/person/';
const IMAGE_URL = 'https://image.tmdb.org/t/p/';
// TMDB's largest fixed poster width, short of the original. Its posters are 2:3
const POSTER_WIDTH = 780;
// Requests at a time; TMDB allows about 40 a second
const CONCURRENCY = 8;
// Actors on the film page, in billing order
const CAST = 3;
// How long a lookup is reused. A match seldom changes; a miss is tried sooner, in case TMDB adds the film
const MATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export const SearchResult = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string(),
  // "2026-09-25", or empty when unknown
  release_date: z.string().optional(),
  vote_count: z.number(),
  popularity: z.number(),
  poster_path: z.string().nullable(),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const Video = z.object({
  key: z.string(),
  site: z.string(),
  type: z.string(),
  official: z.boolean(),
  iso_639_1: z.string(),
});
export type Video = z.infer<typeof Video>;

const SearchData = z.object({ results: z.array(SearchResult), total_pages: z.number() });
export const Credits = z.object({
  cast: z.array(z.object({ id: z.number(), name: z.string(), order: z.number() })),
  crew: z.array(z.object({ id: z.number(), name: z.string(), job: z.string() })),
});
export type Credits = z.infer<typeof Credits>;

// The film with its videos and credits appended, in one request
const MovieData = z.object({ videos: z.object({ results: z.array(Video) }), credits: Credits });

export type TmdbFilm = Partial<
  Pick<Film, 'trailer' | 'directors' | 'cast' | 'posterUrl' | 'posterSize'>
>;

/** Earlier lookups by lookupKey, found or not, with when they were made. */
export type TmdbCache = Record<string, { at: number; film: TmdbFilm | null }>;

function normalize(title: string): string {
  return title.toLocaleLowerCase('nb').replace(/\s+/g, ' ').trim();
}

/**
 * The most popular result with one of the film's titles, first released within a year of the film's year. Many titles
 * are shared by small films the same year ("Dune", "Fatherland"), and the search's year also takes in re-releases.
 * Without a year (Cinemateket), a classic can share its title with a remake ("Suspiria", "Nosferatu"), so the most voted
 * result is only taken when no other comes close.
 */
export function findMatch(results: SearchResult[], titles: string[], year: number | null): SearchResult | undefined {
  const wanted = new Set(titles.map(normalize));
  const same = results.filter((r) => wanted.has(normalize(r.title)) || wanted.has(normalize(r.original_title)));
  if (year) {
    return same
      .filter((r) => Math.abs(Number(r.release_date?.slice(0, 4)) - year) <= 1)
      .sort((a, b) => b.popularity - a.popularity)[0];
  }
  // The same film can come from searches in both languages
  const [first, second] = [...new Map(same.map((r) => [r.id, r])).values()].sort((a, b) => b.vote_count - a.vote_count);
  return second && second.vote_count * 10 >= first.vote_count ? undefined : first;
}

export function tmdbPoster(path: string): Pick<Film, 'posterUrl' | 'posterSize'> {
  return { posterUrl: `${IMAGE_URL}w${POSTER_WIDTH}${path}`, posterSize: { width: POSTER_WIDTH, height: POSTER_WIDTH * 1.5 } };
}

/** A trailer on YouTube: Norwegian before English, official before not. */
export function pickTrailer(videos: Video[]): string | undefined {
  const rank = (v: Video) => (v.iso_639_1 === 'no' || v.iso_639_1 === 'nb' ? 0 : 2) + (v.official ? 0 : 1);
  return videos.filter((v) => v.site === 'YouTube' && v.type === 'Trailer').sort((a, b) => rank(a) - rank(b))[0]?.key;
}

function person(credit: { id: number; name: string }): Person {
  return { name: credit.name, url: PERSON_URL + credit.id };
}

/** The directors, and the leading actors as TMDB bills them, each with their page at TMDB. */
export function pickCredits(credits: Credits): Pick<Film, 'directors' | 'cast'> {
  return {
    directors: credits.crew.filter((c) => c.job === 'Director').map(person),
    cast: credits.cast
      .sort((a, b) => a.order - b.order)
      .slice(0, CAST)
      .map(person),
  };
}

async function get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>, token: string): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  const res = await fetchOk('TMDB', url, { headers: { authorization: `Bearer ${token}` } });
  return schema.parse(await res.json());
}

/** The original title, then the Norwegian one, without the year Filmweb puts after some classics: "The Godfather (1972)". */
export function searchTitles(film: Pick<Film, 'title' | 'originalTitle'>): string[] {
  return [film.originalTitle, film.title].filter((t): t is string => !!t).map((t) => t.replace(/\s*\(\d{4}\)$/, ''));
}

/**
 * Searches for the original title first, then the Norwegian one. Results come in English before Norwegian, since a
 * film without a Norwegian title is listed under its original one ("ドライブ・マイ・カー"), and a Norwegian title can hide
 * the English one we search for ("Fatherland"). Each search runs without the year first, since Filmweb's year can be a
 * year off ("Dune" 2020), and then, when there is more than one page of results, in the year, for titles too common to
 * show up on the first page otherwise ("Butterfly"). Without a year, all searches are weighed together, so a title shared
 * in one language isn't taken from the other.
 */
async function search(titles: string[], year: number | null, token: string): Promise<SearchResult | undefined> {
  const queries = [...new Set(titles)];
  const languages = ['en-US', 'nb-NO'];
  if (!year) {
    const results: SearchResult[] = [];
    for (const params of queries.flatMap((query) => languages.map((language) => ({ query, language })))) {
      results.push(...(await get('/search/movie', params, SearchData, token)).results);
    }
    return findMatch(results, titles, null);
  }
  for (const query of queries) {
    for (const language of languages) {
      const all = await get('/search/movie', { query, language }, SearchData, token);
      let match = findMatch(all.results, titles, year);
      if (!match && all.total_pages > 1) {
        const inYear = await get('/search/movie', { query, language, year: String(year) }, SearchData, token);
        match = findMatch(inYear.results, titles, year);
      }
      if (match) return match;
    }
  }
}

/** What the lookup searches for, so films with the same titles and year share one. */
export function lookupKey(film: Pick<Film, 'title' | 'originalTitle' | 'year'>): string {
  return JSON.stringify([...searchTitles(film), film.year]);
}

async function lookUp(film: Film, token: string): Promise<TmdbFilm | null> {
  const match = await search(searchTitles(film), film.year, token);
  if (!match) return null;
  const movie = await get(
    `/movie/${match.id}`,
    { append_to_response: 'videos,credits', include_video_language: 'no,nb,en' },
    MovieData,
    token,
  );
  const poster = match.poster_path ? tmdbPoster(match.poster_path) : {};
  return { trailer: pickTrailer(movie.videos.results), ...pickCredits(movie.credits), ...poster };
}

/** Runs the task on every item, a few at a time. The first error stops the rest and is thrown, once those already started are done. */
async function eachLimited<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      try {
        await task(items[next++]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const failure = (await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker))).find((r) => r.status === 'rejected');
  if (failure) throw failure.reason;
}

/**
 * Looks up the films the cache has no recent lookup for, in about two requests each. Films TMDB doesn't have are left
 * out. The new cache keeps every recent lookup, also of films missing from this program, such as when a source fails for
 * a build, and drops older ones so it doesn't grow with films long gone. When a lookup fails, the rest are left for the
 * next build, and the ones made so far are kept.
 */
export async function fetchTmdb(
  films: Record<string, Film>,
  token: string,
  cache: TmdbCache,
  now = Date.now(),
): Promise<{ films: Record<string, TmdbFilm>; cache: TmdbCache; lookedUp: number }> {
  const next: TmdbCache = Object.fromEntries(
    Object.entries(cache).filter(([, entry]) => now - entry.at < (entry.film ? MATCH_TTL_MS : MISS_TTL_MS)),
  );
  const stale = [...new Map(Object.values(films).map((film) => [lookupKey(film), film]))]
    .filter(([key]) => !next[key])
    .map(([, film]) => film);
  let lookedUp = 0;
  try {
    await eachLimited(stale, async (film) => {
      next[lookupKey(film)] = { at: now, film: await lookUp(film, token) };
      lookedUp++;
    });
  } catch (error) {
    console.warn(`TMDB: hopper over resten av oppslagene: ${errorMessage(error)}`);
  }

  const found: Record<string, TmdbFilm> = {};
  for (const [id, film] of Object.entries(films)) {
    const tmdb = next[lookupKey(film)]?.film;
    if (!tmdb) continue;
    // Only films whose source has no poster of its own get TMDB's: Cinemateket's, which show a logo, and the odd Filmweb film
    const { posterUrl, posterSize, ...details } = tmdb;
    found[id] = film.posterSize ? details : tmdb;
  }
  return { films: found, cache: next, lookedUp };
}
