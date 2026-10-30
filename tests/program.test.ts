import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FilmwebSnapshot, filmwebProgram, shortScreen, type RawShow } from '../src/lib/filmweb.ts';
import { filmDays, mergePrograms, slugify, upcomingFilms } from '../src/lib/program.ts';
import { assertPlausible } from '../src/lib/source.ts';
import { programNow } from '../src/lib/time.ts';

const fixture = FilmwebSnapshot.parse(JSON.parse(readFileSync('tests/fixtures/filmweb-oslo.json', 'utf8')));
const program = mergePrograms([filmwebProgram(fixture)]);
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
    ticketSaleUrl: 'https://example.test/1',
    lengthInMinutes: 100,
    rating: '12 år',
    ...overrides,
  };
}

function programOf(shows: RawShow[], movies: FilmwebSnapshot['movies'] = []) {
  return filmwebProgram({ fetchedAt: '', movies, shows });
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

describe('filmwebProgram', () => {
  it('drops theatre productions', () => {
    const result = programOf([show({}), show({ movieMainVersionId: 'KUL20232394', ticketSaleUrl: 'https://example.test/2' })]);
    expect(Object.keys(result.films)).toEqual(['EDI1']);
  });

  it('drops duplicate showings', () => {
    expect(programOf([show({}), show({})]).days['2026-10-30']).toHaveLength(1);
  });

  it('links showings without a booking page to the film page', () => {
    const [s] = programOf([show({ ticketSaleUrl: '' })]).days['2026-10-30'];
    expect(s.bookingUrl).toBe('https://www.filmweb.no/film/EDI1');
    expect(s.key).toBe('Saga|Saga 1|2026-10-30T18:00:00|EDI1');
  });

  it('builds films with Filmweb links and resized posters', () => {
    const result = programOf(
      [show({})],
      [
        {
          mainVersionId: 'EDI1',
          lengthInMinutes: 100,
          rating: null,
          sanityImagePosterUrl: 'https://cdn.sanity.io/p.jpg',
          synopsisIngress: '<i>Om filmen.</i>',
          synopsisBodyText: 'Lang tekst.',
        },
      ],
    );
    expect(result.films.EDI1).toMatchObject({
      title: 'Film',
      slug: 'film',
      minutes: 100,
      ageRating: '12 år',
      synopsis: 'Om filmen.',
      posterUrl: 'https://cdn.sanity.io/p.jpg?w=320&auto=format',
      pageUrl: 'https://www.filmweb.no/film/EDI1',
    });
    expect(result.films.EDI1.posterSrcSet).toContain('https://cdn.sanity.io/p.jpg?w=640&auto=format 640w');
  });

  it('falls back to the body text when a film has no ingress', () => {
    const result = programOf(
      [show({})],
      [
        {
          mainVersionId: 'EDI1',
          lengthInMinutes: 100,
          rating: null,
          sanityImagePosterUrl: null,
          synopsisIngress: '',
          synopsisBodyText: 'Første avsnitt.\n\nAndre avsnitt.',
        },
      ],
    );
    expect(result.films.EDI1.synopsis).toBe('Første avsnitt.\n\nAndre avsnitt.');
  });
});

describe('mergePrograms', () => {
  it('groups showings by day, sorted by start', () => {
    const result = mergePrograms([
      programOf([
        show({ showStart: '2026-10-31T00:15:00', ticketSaleUrl: 'https://example.test/late' }),
        show({ showStart: '2026-10-30T21:00:00', ticketSaleUrl: 'https://example.test/evening' }),
        show({ showStart: '2026-10-30T12:00:00', ticketSaleUrl: 'https://example.test/noon' }),
      ]),
    ]);
    expect(Object.keys(result.days)).toEqual(['2026-10-30', '2026-10-31']);
    expect(result.days['2026-10-30'].map((s) => s.time)).toEqual(['12:00', '21:00']);
  });

  it('numbers films that share a slug', () => {
    const result = mergePrograms([
      programOf([
        show({ movieTitle: 'Jak zyc, zeby nie zwariowac' }),
        show({ movieMainVersionId: 'EDI2', movieTitle: 'JAK ZYC ZEBY NIE ZWARIOWAC', ticketSaleUrl: 'https://example.test/2' }),
        show({ movieMainVersionId: 'EDI3', movieTitle: 'Jak zyc zeby nie zwariowac', ticketSaleUrl: 'https://example.test/3' }),
      ]),
    ]);
    expect(Object.values(result.films).map((f) => f.slug)).toEqual([
      'jak-zyc-zeby-nie-zwariowac',
      'jak-zyc-zeby-nie-zwariowac-2',
      'jak-zyc-zeby-nie-zwariowac-3',
    ]);
  });
});

describe('slugify', () => {
  it.each([
    ['Verity', 'verity'],
    ['Glemselens øy', 'glemselens-oy'],
    ['Kjærast', 'kjaerast'],
    ['Drapet på Benjamin Hermansen', 'drapet-pa-benjamin-hermansen'],
    ['Knife: The Attempted Murder of Salman Rushdie', 'knife-the-attempted-murder-of-salman-rushdie'],
    ['Filipiñana', 'filipinana'],
    ['Ha-Chan Shake your Booty!', 'ha-chan-shake-your-booty'],
  ])('%s → %s', (title, expected) => {
    expect(slugify(title)).toBe(expected);
  });
});

describe('filmDays', () => {
  const result = mergePrograms([
    programOf([
      show({ showStart: '2026-10-29T18:00:00', ticketSaleUrl: 'https://example.test/past' }),
      show({ showStart: '2026-10-30T18:00:00', ticketSaleUrl: 'https://example.test/today' }),
      show({ showStart: '2026-11-02T20:00:00', ticketSaleUrl: 'https://example.test/later' }),
      show({ movieMainVersionId: 'EDI2', showStart: '2026-10-31T18:00:00', ticketSaleUrl: 'https://example.test/other' }),
    ]),
  ]);

  it("lists only the film's days, from the given day on", () => {
    const days = filmDays(result, 'EDI1', '2026-10-30');
    expect(days.map(([day]) => day)).toEqual(['2026-10-30', '2026-11-02']);
    expect(days.flatMap(([, list]) => list).every((s) => s.filmId === 'EDI1')).toBe(true);
  });
});

describe('upcomingFilms', () => {
  const result = mergePrograms([
    programOf([
      show({ movieMainVersionId: 'EDI1', movieTitle: 'Øyeblikk', showStart: '2026-11-20T18:00:00', ticketSaleUrl: 'https://example.test/1' }),
      show({ movieMainVersionId: 'EDI2', movieTitle: 'Amélie', showStart: '2026-10-30T18:00:00', ticketSaleUrl: 'https://example.test/2' }),
      show({ movieMainVersionId: 'EDI2', movieTitle: 'Amélie', showStart: '2026-10-31T18:00:00', ticketSaleUrl: 'https://example.test/3' }),
      show({ movieMainVersionId: 'EDI3', movieTitle: 'Before', showStart: '2026-10-29T18:00:00', ticketSaleUrl: 'https://example.test/4' }),
    ]),
  ]);

  it('lists each film once, A–Å, leaving out films that have stopped showing', () => {
    expect(upcomingFilms(result, '2026-10-30').map((f) => f.title)).toEqual(['Amélie', 'Øyeblikk']);
  });
});

describe('the Filmweb fixture', () => {
  it('normalizes into a plausible program', () => {
    expect(() => assertPlausible(program, fixtureDay)).not.toThrow();
  });

  it('covers all ten Oslo cinemas', () => {
    expect(new Set(allShowings.map((s) => s.cinema)).size).toBe(10);
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
    expect(() => assertPlausible({ films: {}, days: {} }, fixtureDay)).toThrow(/ingen visninger/);
  });
});
