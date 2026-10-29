import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FilmwebSnapshot, type RawShow } from '../src/lib/filmweb.ts';
import { normalize, shortScreen } from '../src/lib/program.ts';
import { resolveSource } from '../src/lib/source.ts';
import { assertPlausible } from '../src/lib/validate.ts';
import { programNow } from '../src/lib/time.ts';

const fixture = FilmwebSnapshot.parse(JSON.parse(readFileSync('tests/fixtures/filmweb-oslo.json', 'utf8')));
const program = normalize(fixture);
const fixtureDay = programNow(new Date(fixture.fetchedAt)).day;
const allShowings = Object.values(program.days).flat();

function show(overrides: Partial<RawShow>): RawShow {
  return {
    movieMainVersionId: 'EDI1',
    movieVersionId: 'EDI1',
    movieTitle: 'Film',
    theaterName: 'Saga',
    screenName: 'Saga 1',
    showStart: '2026-10-30T18:00:00',
    showType: '',
    ticketSaleUrl: 'https://example.test/1',
    lengthInMinutes: 100,
    rating: '12 år',
    versionTags: [{ tag: '2D', type: 'version' }],
    ...overrides,
  };
}

describe('shortScreen', () => {
  it.each([
    ['Saga 6', 'Saga', 'Sal 6'],
    ['Vega Kino TO', 'Vega Kino', 'Sal TO'],
    ['Sal 10', 'ODEON Oslo', 'Sal 10'],
    ['Sal 2 - isense', 'ODEON Oslo', 'Sal 2 iSense'],
    ['Sal 3 LUXE', 'ODEON Oslo', 'Sal 3 LUXE'],
    ['IMAX® by Coca-Cola', 'ODEON Oslo', 'IMAX'],
    ['Gimle', 'Gimle', ''],
    ['Kunstnernes Hus', 'Kunstnernes Hus Kino', ''],
  ])('%s at %s → "%s"', (screen, cinema, expected) => {
    expect(shortScreen(screen, cinema)).toBe(expected);
  });
});

describe('normalize', () => {
  it('drops theatre productions', () => {
    const result = normalize({
      fetchedAt: '',
      movies: [],
      shows: [show({}), show({ movieMainVersionId: 'KUL20232394', ticketSaleUrl: 'https://example.test/2' })],
    });
    expect(Object.keys(result.films)).toEqual(['EDI1']);
  });

  it('drops duplicate showings', () => {
    const result = normalize({ fetchedAt: '', movies: [], shows: [show({}), show({})] });
    expect(result.days['2026-10-30']).toHaveLength(1);
  });

  it('keys showings without a booking link by cinema, screen, start and version', () => {
    const result = normalize({ fetchedAt: '', movies: [], shows: [show({ ticketSaleUrl: '' })] });
    const [s] = result.days['2026-10-30'];
    expect(s.bookingUrl).toBeNull();
    expect(s.key).toBe('Saga|Saga 1|2026-10-30T18:00:00|EDI1');
  });

  it('groups showings by day, sorted by start', () => {
    const result = normalize({
      fetchedAt: '',
      movies: [],
      shows: [
        show({ showStart: '2026-10-31T00:15:00', ticketSaleUrl: 'https://example.test/late' }),
        show({ showStart: '2026-10-30T21:00:00', ticketSaleUrl: 'https://example.test/evening' }),
        show({ showStart: '2026-10-30T12:00:00', ticketSaleUrl: 'https://example.test/noon' }),
      ],
    });
    expect(Object.keys(result.days)).toEqual(['2026-10-30', '2026-10-31']);
    expect(result.days['2026-10-30'].map((s) => s.time)).toEqual(['12:00', '21:00']);
  });

  it('builds films with Filmweb links and posters', () => {
    const result = normalize({
      fetchedAt: '',
      movies: [
        { mainVersionId: 'EDI1', title: 'Film', titleOriginal: null, lengthInMinutes: 100, rating: null, sanityImagePosterUrl: 'https://cdn.sanity.io/p.jpg' },
      ],
      shows: [show({ versionTags: [{ tag: '2D', type: 'version' }, { tag: 'IMAX', type: 'format' }] })],
    });
    expect(result.films.EDI1).toEqual({
      id: 'EDI1',
      title: 'Film',
      minutes: 100,
      ageRating: '12 år',
      posterUrl: 'https://cdn.sanity.io/p.jpg',
      pageUrl: 'https://www.filmweb.no/film/EDI1',
    });
    expect(result.days['2026-10-30'][0].tags).toEqual(['IMAX']);
  });
});

describe('the Filmweb fixture', () => {
  it('normalizes into a plausible program', () => {
    expect(() => assertPlausible(program, fixtureDay)).not.toThrow();
  });

  it('covers all ten Oslo cinemas', () => {
    expect(program.cinemas).toHaveLength(10);
  });

  it('has a film for every showing and no theatre', () => {
    expect(allShowings.every((s) => program.films[s.filmId])).toBe(true);
    expect(allShowings.some((s) => s.filmId.startsWith('KUL'))).toBe(false);
  });

  it('keeps every day sorted by start', () => {
    for (const showings of Object.values(program.days)) {
      const minutes = showings.map((s) => s.minutes);
      expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    }
  });
});

describe('assertPlausible', () => {
  it('rejects an empty program', () => {
    expect(() => assertPlausible({ fetchedAt: '', films: {}, cinemas: [], days: {} }, fixtureDay)).toThrow(
      /ingen visninger/,
    );
  });
});

describe('resolveSource', () => {
  it('fetches live on Vercel and CI, uses the fixture locally', () => {
    expect(resolveSource({ VERCEL: '1' })).toBe('live');
    expect(resolveSource({ CI: 'true' })).toBe('live');
    expect(resolveSource({})).toBe('fixture');
    expect(resolveSource({ VERCEL: '1', FILMWEB_SOURCE: 'fixture' })).toBe('fixture');
  });
});
