import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Film } from '../src/lib/program.ts';
import {
  fetchTmdb,
  findMatch,
  lookupKey,
  pickCredits,
  pickTrailer,
  searchTitles,
  tmdbPoster,
  tmdbRating,
  type SearchResult,
  type Video,
} from '../src/lib/tmdb.ts';

function result(overrides: Partial<SearchResult>): SearchResult {
  return { id: 1, title: 'Film', original_title: 'Film', release_date: '2026-09-25', vote_average: 7.661, vote_count: 93, popularity: 1, poster_path: null, ...overrides };
}

function video(overrides: Partial<Video>): Video {
  return { key: 'abc', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', ...overrides };
}

function film(overrides: Partial<Film>): Film {
  return { title: 'Film', originalTitle: null, year: 2026, slug: 'film', minutes: null, ageRating: null, synopsis: null, posterUrl: null, pageUrl: '', source: 'Filmweb', ...overrides };
}

describe('searchTitles', () => {
  it('searches for the original title first, without a year after it', () => {
    expect(searchTitles({ title: 'Gudfaren (1972)', originalTitle: 'The Godfather (1972)' })).toEqual(['The Godfather', 'Gudfaren']);
    expect(searchTitles({ title: 'Butterfly', originalTitle: null })).toEqual(['Butterfly']);
  });
});

describe('findMatch', () => {
  it('takes the most popular result with one of the titles, ignoring case', () => {
    const results = [
      result({ id: 1, title: 'Unanswered//butterfly', popularity: 9 }),
      result({ id: 2, title: 'Butterfly', popularity: 0.9 }),
      result({ id: 3, title: 'Butterfly', popularity: 3.5 }),
    ];
    expect(findMatch(results, ['Butterfly'], 2026)?.id).toBe(3);
    expect(findMatch([result({ title: 'Per Ulv på saken', original_title: 'Coyote vs. Acme' })], ['coyote vs. acme'], 2026)).toBeDefined();
  });

  it('finds nothing when no title is the same', () => {
    expect(findMatch([result({ title: 'Butterfly Effect', original_title: 'The Butterfly Effect' })], ['Butterfly'], 2026)).toBeUndefined();
  });

  it('allows a year either way, but not an older film released again', () => {
    expect(findMatch([result({ release_date: '2025-10-16' })], ['Film'], 2026)).toBeDefined();
    expect(findMatch([result({ release_date: '1984-12-14' })], ['Film'], 2020)).toBeUndefined();
    expect(findMatch([result({ release_date: '' })], ['Film'], 2026)).toBeUndefined();
  });

  it('without a year, takes the most voted result only when no other comes close', () => {
    const classic = result({ id: 1, title: 'Funny Face', release_date: '1957-02-13', vote_count: 764 });
    expect(findMatch([result({ id: 2, title: 'Funny Face', vote_count: 15 }), classic], ['Funny Face'], null)?.id).toBe(1);
    expect(findMatch([classic, result({ id: 2, title: 'Funny Face', vote_count: 500 })], ['Funny Face'], null)).toBeUndefined();
    expect(findMatch([result({ title: 'Deep Water' })], ['Water'], null)).toBeUndefined();
    // The same film from both languages' searches
    expect(findMatch([classic, { ...classic, title: 'Funny Face' }], ['Funny Face'], null)?.id).toBe(1);
  });
});

describe('tmdbPoster', () => {
  it("offers TMDB's fixed widths", () => {
    const poster = tmdbPoster('/abc.jpg');
    expect(poster.posterUrl).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(poster.posterSrcSet).toContain('https://image.tmdb.org/t/p/w780/abc.jpg 780w');
    expect(poster.posterLarge?.width).toBe(780);
  });
});

describe('tmdbRating', () => {
  it('rounds the score to one decimal and links to the film', () => {
    expect(tmdbRating(result({ id: 1465063 }))).toEqual({ value: 7.7, votes: 93, url: 'https://www.themoviedb.org/movie/1465063' });
  });

  it('leaves out scores with fewer than 5 votes', () => {
    expect(tmdbRating(result({ vote_count: 4 }))).toBeUndefined();
    expect(tmdbRating(result({ vote_count: 5 }))).toBeDefined();
  });
});

describe('pickCredits', () => {
  it('takes every director and the first three actors by billing', () => {
    const credits = {
      crew: [
        { id: 1, name: 'Daniel Kwan', job: 'Director' },
        { id: 2, name: 'Daniel Scheinert', job: 'Director' },
        { id: 3, name: 'Larkin Seiple', job: 'Director of Photography' },
      ],
      cast: [3, 0, 2, 1].map((order) => ({ id: 10 + order, name: `Actor ${order}`, order })),
    };
    const { directors, cast } = pickCredits(credits);
    expect(directors).toEqual([
      { name: 'Daniel Kwan', url: 'https://www.themoviedb.org/person/1' },
      { name: 'Daniel Scheinert', url: 'https://www.themoviedb.org/person/2' },
    ]);
    expect(cast?.map((p) => p.name)).toEqual(['Actor 0', 'Actor 1', 'Actor 2']);
  });
});

describe('pickTrailer', () => {
  it('prefers a Norwegian trailer, then an official one', () => {
    expect(pickTrailer([video({ key: 'en' }), video({ key: 'no', iso_639_1: 'no', official: false })])).toBe('no');
    expect(pickTrailer([video({ key: 'fan', official: false }), video({ key: 'official' })])).toBe('official');
  });

  it('skips teasers, clips and videos outside YouTube', () => {
    expect(pickTrailer([video({ type: 'Teaser' }), video({ type: 'Clip' }), video({ site: 'Vimeo' })])).toBeUndefined();
  });
});

describe('fetchTmdb', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 100 * DAY;
  const poster = tmdbPoster('/abc.jpg');

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reuses recent lookups without asking TMDB, and keeps those of films no longer in the program', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const films = { a: film({ title: 'Dune' }), b: film({ title: 'Ukjent' }) };
    const cache = {
      [lookupKey(films.a)]: { at: now - 6 * DAY, film: { trailer: 'abc', ...poster } },
      [lookupKey(films.b)]: { at: now - DAY, film: null },
      [lookupKey(film({ title: 'Borte' }))]: { at: now - DAY, film: { trailer: 'old' } },
      [lookupKey(film({ title: 'Gammel' }))]: { at: now - 8 * DAY, film: { trailer: 'old' } },
    };
    const result = await fetchTmdb(films, 'token', cache, now);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.lookedUp).toBe(0);
    expect(result.films).toEqual({ a: { trailer: 'abc', ...poster } });
    expect(Object.keys(result.cache)).toEqual([lookupKey(films.a), lookupKey(films.b), lookupKey(film({ title: 'Borte' }))]);
  });

  it("keeps the source's own poster", async () => {
    vi.stubGlobal('fetch', vi.fn());
    const films = { a: film({ posterSrcSet: 'own.jpg 500w' }) };
    const cache = { [lookupKey(films.a)]: { at: now, film: { trailer: 'abc', ...poster } } };
    expect((await fetchTmdb(films, 'token', cache, now)).films).toEqual({ a: { trailer: 'abc' } });
  });

  it('looks up a miss again sooner than a match', async () => {
    const fetch = vi.fn(async () => Response.json({ results: [], total_pages: 1 }));
    vi.stubGlobal('fetch', fetch);
    const films = { a: film({ title: 'Dune' }), b: film({ title: 'Ukjent' }) };
    const cache = {
      [lookupKey(films.a)]: { at: now - 3 * DAY, film: { trailer: 'abc' } },
      [lookupKey(films.b)]: { at: now - 3 * DAY, film: null },
    };
    const result = await fetchTmdb(films, 'token', cache, now);
    expect(result.lookedUp).toBe(1);
    expect(result.cache[lookupKey(films.b)]).toEqual({ at: now, film: null });
  });

  it('searches in the year only when there is more than one page of results', async () => {
    const pages = vi.fn(async () => Response.json({ results: [], total_pages: 1 }));
    vi.stubGlobal('fetch', pages);
    await fetchTmdb({ a: film({ title: 'Ukjent' }) }, 'token', {}, now);
    // English and Norwegian, without the year
    expect(pages).toHaveBeenCalledTimes(2);

    const many = vi.fn(async () => Response.json({ results: [], total_pages: 3 }));
    vi.stubGlobal('fetch', many);
    await fetchTmdb({ a: film({ title: 'Butterfly' }) }, 'token', {}, now);
    expect(many).toHaveBeenCalledTimes(4);
  });

  it('keeps the lookups made before one fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('Feil') ? new Response('', { status: 401 }) : Response.json({ results: [], total_pages: 1 }),
      ),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const films = { a: film({ title: 'Ukjent' }), b: film({ title: 'Feil' }) };
    const result = await fetchTmdb(films, 'token', {}, now);
    expect(result.cache).toEqual({ [lookupKey(films.a)]: { at: now, film: null } });
    expect(result.lookedUp).toBe(1);
  });
});
