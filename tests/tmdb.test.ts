import { describe, expect, it } from 'vitest';
import { findMatch, pickTrailer, searchTitles, tmdbRating, type SearchResult, type Video } from '../src/lib/tmdb.ts';

function result(overrides: Partial<SearchResult>): SearchResult {
  return { id: 1, title: 'Film', original_title: 'Film', release_date: '2026-09-25', vote_average: 7.661, vote_count: 93, popularity: 1, ...overrides };
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
});

describe('tmdbRating', () => {
  it('rounds the score to one decimal and links to the film', () => {
    expect(tmdbRating(result({ id: 1465063 }))).toEqual({ value: 7.7, votes: 93, url: 'https://www.themoviedb.org/movie/1465063' });
  });

  it('leaves out scores with fewer than 20 votes', () => {
    expect(tmdbRating(result({ vote_count: 19 }))).toBeUndefined();
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
