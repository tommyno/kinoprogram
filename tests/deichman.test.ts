import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CINEMA, deichman, deichmanProgram, filmTitle, shortScreen, type RawEvent } from '../src/lib/sources/deichman.ts';

function event(overrides: Partial<RawEvent> & { label?: string; location?: string }): RawEvent {
  const { label = 'Filmvisning', location = 'Kinoen, Deichman Bjørvika', ...rest } = overrides;
  return {
    event_id: 1,
    name: 'Filmvisning: Småting som dette',
    start: '2026-12-02T17:00:00Z',
    end: '2026-12-02T18:40:00Z',
    is_cancelled: false,
    data: { other_category_description: label, location: { name: location } },
    ...rest,
  };
}

describe('filmTitle', () => {
  it.each([
    ['Filmvisning: Småting som dette', 'Småting som dette'],
    ['Barnas kino: Miss Moxy. Lør kl. 14', 'Miss Moxy'],
    ['Film fra Sør: No Other Choice', 'No Other Choice'],
    ['Filmvisning: Mary Oliver. Saved by the Beauty of the World', 'Mary Oliver. Saved by the Beauty of the World'],
    ['Filmvisning: Forbannelsen Kane ', 'Forbannelsen Kane'],
  ])('%s → "%s"', (name, expected) => {
    expect(filmTitle(name)).toBe(expected);
  });
});

describe('shortScreen', () => {
  it.each([
    ['Kinoen, Deichman Bjørvika', 'Kinoen'],
    ['Kinoen. Deichman Bjørvika', 'Kinoen'],
    ['Kinoen U1, Deichman Bjørvika', 'Kinoen U1'],
    ['Deichman Bjørvika, Kinosalen i underetasjen', 'Kinosalen i underetasjen'],
    ['Deichmansalen, Deichman Bjørvika', 'Deichmansalen'],
    ['Deichman Bjørvika', ''],
  ])('%s → "%s"', (location, expected) => {
    expect(shortScreen(location)).toBe(expected);
  });
});

describe('deichmanProgram', () => {
  it('makes one film per title, with times in Oslo time linking to the event', () => {
    const program = deichmanProgram([
      event({ event_id: 1, name: 'Barnas kino: Miss Moxy. Lør kl. 14', start: '2026-11-07T13:00:00Z', end: '2026-11-07T14:30:00Z' }),
      event({ event_id: 2, name: 'Barnas kino: Miss Moxy. Søn kl. 12', start: '2026-11-08T11:00:00Z', end: '2026-11-08T12:30:00Z' }),
    ]);
    expect(program.films).toEqual({
      'DEICHMAN:miss-moxy': {
        title: 'Miss Moxy',
        originalTitle: null,
        year: null,
        slug: 'deichman-miss-moxy',
        minutes: 90,
        ageRating: null,
        synopsis: null,
        posterUrl: null,
        pageUrl: 'https://deichman.hoopla.no/event/1',
        source: 'Deichman',
      },
    });
    expect(program.days['2026-11-08'][0]).toMatchObject({
      key: '2',
      cinema: CINEMA,
      screen: 'Kinoen',
      time: '12:00',
      bookingUrl: 'https://deichman.hoopla.no/event/2',
    });
  });

  it('leaves out other events, school screenings and cancelled ones', () => {
    const program = deichmanProgram([
      event({ name: 'Figurtegneverksted', label: '' }),
      event({ name: 'Utekino for barnehager 2026, tirs 10.11 kl. 10', label: 'Utekino' }),
      event({ is_cancelled: true }),
    ]);
    expect(program.films).toEqual({});
  });
});

describe('the Deichman fixture', () => {
  it('has film screenings with a title and a screen', () => {
    const program = deichman.program(readFileSync('tests/fixtures/deichman.json', 'utf8'));
    const showings = Object.values(program.days).flat();
    expect(showings.length).toBeGreaterThan(0);
    expect(Object.values(program.films).every((f) => f.title && !f.title.includes(':'))).toBe(true);
    expect(showings.every((s) => s.screen)).toBe(true);
  });
});
