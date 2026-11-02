import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CINEMA, parseName, revier, revierProgram, upcomingEvents, type RawEvent } from '../src/lib/sources/revier.ts';

function event(overrides: Partial<RawEvent>): RawEvent {
  return {
    id: '1',
    name: 'Catch Me If You Can (2002, 2t 21m)',
    url: 'https://www.eventbrite.com/e/catch-me-if-you-can-2002-2t-21m-tickets-1',
    start_date: '2026-11-04',
    start_time: '18:00:00',
    is_cancelled: false,
    is_online_event: false,
    ...overrides,
  };
}

function page(pageProps: unknown): string {
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script></html>`;
}

describe('upcomingEvents', () => {
  it('reads the events from the page data', () => {
    expect(JSON.parse(upcomingEvents(page({ upcomingEvents: [{ id: '1' }] })))).toEqual([{ id: '1' }]);
  });

  it('fails when Eventbrite could not load them, rather than showing none', () => {
    expect(() => upcomingEvents(page({ upcomingEventsFailed: true, upcomingEvents: [] }))).toThrow();
    expect(() => upcomingEvents('<html></html>')).toThrow();
  });
});

describe('parseName', () => {
  it.each([
    ['Catch Me If You Can (2002, 2t 21m)', { title: 'Catch Me If You Can', year: 2002, minutes: 141 }],
    ['Drive (2011, 1t 40m)', { title: 'Drive', year: 2011, minutes: 100 }],
    ['Persona (1966, 85m)', { title: 'Persona', year: 1966, minutes: 85 }],
    ['Paris, Texas (1984)', { title: 'Paris, Texas', year: 1984, minutes: null }],
    ['Julefilm med gløgg', { title: 'Julefilm med gløgg', year: null, minutes: null }],
  ])('%s', (name, expected) => {
    expect(parseName(name)).toEqual(expected);
  });
});

describe('revierProgram', () => {
  it('makes a film per title, with times linking to the event', () => {
    const program = revierProgram([event({})]);
    expect(program.films).toEqual({
      'REVIER:catch-me-if-you-can': {
        title: 'Catch Me If You Can',
        originalTitle: null,
        year: 2002,
        slug: 'revier-catch-me-if-you-can',
        minutes: 141,
        ageRating: null,
        synopsis: null,
        posterUrl: null,
        pageUrl: 'https://www.eventbrite.com/e/catch-me-if-you-can-2002-2t-21m-tickets-1',
        source: 'Revier',
      },
    });
    expect(program.days['2026-11-04'][0]).toMatchObject({
      cinema: CINEMA,
      time: '18:00',
      bookingUrl: 'https://www.eventbrite.com/e/catch-me-if-you-can-2002-2t-21m-tickets-1',
    });
  });

  it('leaves out cancelled and online events', () => {
    expect(revierProgram([event({ is_cancelled: true }), event({ is_online_event: true })]).films).toEqual({});
  });
});

describe('the Revier fixture', () => {
  it('has screenings of films with a year', () => {
    const program = revier.program(readFileSync('tests/fixtures/revier.json', 'utf8'));
    expect(Object.values(program.days).flat().length).toBeGreaterThan(0);
    expect(Object.values(program.films).every((f) => f.year)).toBe(true);
  });
});
