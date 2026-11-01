import { z } from 'zod';
import { USER_AGENT, withRetry } from './http.ts';
import type { Film } from './program.ts';

// The films' user score and trailer, found by title and year. Needs a read access token from themoviedb.org
const API = 'https://api.themoviedb.org/3';
const MOVIE_URL = 'https://www.themoviedb.org/movie/';
// A score from a handful of votes says little, and new films often have none yet
const MIN_VOTES = 20;
// Requests at a time; TMDB allows about 40 a second
const CONCURRENCY = 8;

export const SearchResult = z.object({
  id: z.number(),
  title: z.string(),
  original_title: z.string(),
  // "2026-09-25", or empty when unknown
  release_date: z.string().optional(),
  vote_average: z.number(),
  vote_count: z.number(),
  popularity: z.number(),
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

const SearchData = z.object({ results: z.array(SearchResult) });
const VideosData = z.object({ results: z.array(Video) });

export type TmdbFilm = Pick<Film, 'rating' | 'trailer'>;

function normalize(title: string): string {
  return title.toLocaleLowerCase('nb').replace(/\s+/g, ' ').trim();
}

/**
 * The most popular result with one of the film's titles, first released within a year of the film's year. Many titles
 * are shared by small films the same year ("Dune", "Fatherland"), and the search's year also takes in re-releases.
 */
export function findMatch(results: SearchResult[], titles: string[], year: number): SearchResult | undefined {
  const wanted = new Set(titles.map(normalize));
  return results
    .filter(
      (r) =>
        (wanted.has(normalize(r.title)) || wanted.has(normalize(r.original_title))) &&
        Math.abs(Number(r.release_date?.slice(0, 4)) - year) <= 1,
    )
    .sort((a, b) => b.popularity - a.popularity)[0];
}

export function tmdbRating(result: SearchResult): TmdbFilm['rating'] {
  if (result.vote_count < MIN_VOTES) return undefined;
  return { value: Math.round(result.vote_average * 10) / 10, votes: result.vote_count, url: MOVIE_URL + result.id };
}

/** A trailer on YouTube: Norwegian before English, official before not. */
export function pickTrailer(videos: Video[]): string | undefined {
  const rank = (v: Video) => (v.iso_639_1 === 'no' || v.iso_639_1 === 'nb' ? 0 : 2) + (v.official ? 0 : 1);
  return videos.filter((v) => v.site === 'YouTube' && v.type === 'Trailer').sort((a, b) => rank(a) - rank(b))[0]?.key;
}

function get<T>(path: string, params: Record<string, string>, schema: z.ZodType<T>, token: string): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  return withRetry('TMDB', async () => {
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, 'user-agent': USER_AGENT } });
    if (!res.ok) {
      throw new Error(`TMDB svarte ${res.status} ${res.statusText}`);
    }
    return schema.parse(await res.json());
  });
}

/** The original title, then the Norwegian one, without the year Filmweb puts after some classics: "The Godfather (1972)". */
export function searchTitles(film: Pick<Film, 'title' | 'originalTitle'>): string[] {
  return [film.originalTitle, film.title].filter((t): t is string => !!t).map((t) => t.replace(/\s*\(\d{4}\)$/, ''));
}

/**
 * Searches for the original title first, then the Norwegian one. Results come in English before Norwegian, since a
 * film without a Norwegian title is listed under its original one ("ドライブ・マイ・カー"), and a Norwegian title can hide
 * the English one we search for ("Fatherland"). Each search runs without the year first, since Filmweb's year can be a
 * year off ("Dune" 2020), and then in the year, for titles too common to show up on the first page otherwise ("Butterfly").
 */
async function lookUp(film: Film, token: string): Promise<TmdbFilm | null> {
  const titles = searchTitles(film);
  const year = String(film.year);
  const searches: Record<string, string>[] = [...new Set(titles)].flatMap((query) =>
    ['en-US', 'nb-NO'].flatMap((language): Record<string, string>[] => [{ query, language }, { query, language, year }]),
  );
  for (const params of searches) {
    const search = await get('/search/movie', params, SearchData, token);
    const match = findMatch(search.results, titles, film.year!);
    if (!match) continue;
    const videos = await get(`/movie/${match.id}/videos`, { include_video_language: 'no,nb,en' }, VideosData, token);
    return { rating: tmdbRating(match), trailer: pickTrailer(videos.results) };
  }
  return null;
}

/** Runs the task on every item, a few at a time. The first error stops the rest and is thrown. */
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
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/** Looks up every film with a year, in about two requests each. Films TMDB doesn't have are left out. */
export async function fetchTmdb(films: Record<string, Film>, token: string): Promise<Record<string, TmdbFilm>> {
  const found: Record<string, TmdbFilm> = {};
  const ids = Object.keys(films).filter((id) => films[id].year);
  await eachLimited(ids, async (id) => {
    const film = await lookUp(films[id], token);
    if (film) found[id] = film;
  });
  return found;
}
