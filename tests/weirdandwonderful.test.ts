import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CINEMA,
  descriptionText,
  parseTitle,
  weirdAndWonderful,
  weirdAndWonderfulProgram,
  type RawEvent,
} from '../src/lib/sources/weirdandwonderful.ts';

const URL = 'https://fienta.com/birth140528-198328';

function event(overrides: Partial<RawEvent>): RawEvent {
  return {
    id: 198328,
    title: 'Birth, Jonathan Glazer (2004)',
    starts_at: '2026-11-10 19:00:00',
    event_status: 'scheduled',
    attendance_mode: 'offline',
    description: '<p>Et mystisk kammerspill.<br><br>Glazers mest oversette.</p>',
    url: URL,
    buy_tickets_url: URL,
    ...overrides,
  };
}

describe('parseTitle', () => {
  it.each([
    ['Birth, Jonathan Glazer (2004)', { title: 'Birth', year: 2004 }],
    ['The Ice Tower,  Lucile Hadzihalilovic (2025)', { title: 'The Ice Tower', year: 2025 }],
    ['Paris, Texas, Wim Wenders (1984)', { title: 'Paris, Texas', year: 1984 }],
    ['Julebord med kortfilmer', { title: 'Julebord med kortfilmer', year: null }],
  ])('%s', (name, expected) => {
    expect(parseTitle(name)).toEqual(expected);
  });
});

describe('descriptionText', () => {
  it('keeps one paragraph a line', () => {
    expect(descriptionText('<p>Et &amp; to.<br><br>Tre.</p><p>Fire</p>')).toBe('Et & to.\nTre.\nFire');
  });
});

describe('weirdAndWonderfulProgram', () => {
  it('makes a film per title, with times linking to the tickets', () => {
    const program = weirdAndWonderfulProgram([event({})]);
    expect(program.films['WEIRDANDWONDERFUL:birth']).toMatchObject({
      title: 'Birth',
      year: 2004,
      slug: 'weird-and-wonderful-cinema-birth',
      synopsis: 'Et mystisk kammerspill.\nGlazers mest oversette.',
      pageUrl: URL,
      source: CINEMA,
    });
    expect(program.days['2026-11-10'][0]).toMatchObject({ cinema: CINEMA, time: '19:00', bookingUrl: URL });
  });

  it('leaves out cancelled and online events', () => {
    const program = weirdAndWonderfulProgram([event({ event_status: 'cancelled' }), event({ attendance_mode: 'online' })]);
    expect(program.days).toEqual({});
  });
});

describe('the Weird and Wonderful Cinema fixture', () => {
  it('has screenings of films with a year', () => {
    const program = weirdAndWonderful.program(readFileSync('tests/fixtures/weirdandwonderful.json', 'utf8'));
    expect(Object.values(program.days).flat().length).toBeGreaterThan(0);
    expect(Object.values(program.films).every((f) => f.year)).toBe(true);
  });
});
