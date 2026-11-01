import { describe, expect, it } from 'vitest';
import { findMatch, pickCredits, pickTrailer, searchTitles, tmdbPoster, tmdbRating, type SearchResult, type Video } from '../src/lib/tmdb.ts';

function result(overrides: Partial<SearchResult>): SearchResult {
  return { id: 1, title: 'Film', original_title: 'Film', release_date: '2026-09-25', vote_average: 7.661, vote_count: 93, popularity: 1, poster_path: null, ...overrides };
}

function video(overrides: Partial<Video>): Video {
  return { key: 'abc', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', ...overrides };
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
