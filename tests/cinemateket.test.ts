import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CINEMA, cinemateketProgram, parseFeed } from '../src/lib/cinemateket.ts';
import { mergePrograms, type Program } from '../src/lib/program.ts';

const FEED = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:the-arbor---lillebil---29-10-2026-1800@cinemateket.no',
  'DTSTART:20261029T170000Z',
  'DTEND:20261029T183400Z',
  'SUMMARY:The Arbor',
  'DESCRIPTION:Clio Barnards hybrid\\, om dramatikeren',
  '  Andrea Dunbar.',
  'LOCATION:Lillebil - Cinemateket ',
  'URL:https://www.cinemateket.no/filmer/the-arbor',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:the-arbor---tancred---02-06-2027-2000@cinemateket.no',
  'DTSTART:20270602T180000Z',
  'DTEND:20270602T193400Z',
  'SUMMARY:The Arbor',
  'LOCATION:Tancred - Cinemateket',
  'URL:https://www.cinemateket.no/filmer/the-arbor',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:origamiverksted---flaklypa---barnas-filmrom---08-11-2026-1200@cinemateket.no',
  'DTSTART:20261108T110000Z',
  'DTEND:20261108T110000Z',
  'SUMMARY:Origamiverksted',
  'LOCATION:Flåklypa – Barnas filmrom - Cinemateket',
  'URL:https://www.cinemateket.no/filmer/origamiverksted',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseFeed', () => {
  const events = parseFeed(FEED);

  it('converts UTC to Oslo time in winter and summer', () => {
    expect(events.slice(0, 2).map((e) => e.start)).toEqual(['2026-10-29T18:00:00', '2027-06-02T20:00:00']);
  });

  it('reads events without a length as null', () => {
    expect(events[2]).toMatchObject({ title: 'Origamiverksted', minutes: null });
  });

  it('reads title, screen, page and length', () => {
    expect(events[0]).toEqual({
      uid: 'the-arbor---lillebil---29-10-2026-1800@cinemateket.no',
      start: '2026-10-29T18:00:00',
      minutes: 94,
      title: 'The Arbor',
      screen: 'Lillebil',
      url: 'https://www.cinemateket.no/filmer/the-arbor',
    });
  });
});

describe('cinemateketProgram', () => {
  const program = cinemateketProgram(parseFeed(FEED), '');

  it('makes one film per film page, linking times to it', () => {
    expect(Object.values(program.films)).toEqual([
      {
        id: 'CINEMATEKET:the-arbor',
        title: 'The Arbor',
        minutes: 94,
        ageRating: null,
        posterUrl: '/posters/cinemateket.svg',
        pageUrl: 'https://www.cinemateket.no/filmer/the-arbor',
      },
    ]);
    expect(program.days['2026-10-29'][0]).toMatchObject({ cinema: CINEMA, screen: 'Lillebil', time: '18:00', bookingUrl: null });
  });

  it('leaves out workshops, which have no length', () => {
    expect(program.days['2026-11-08']).toBeUndefined();
  });
});

describe('mergePrograms', () => {
  it('combines films, cinemas and days, sorted by start', () => {
    const filmweb: Program = {
      fetchedAt: 'x',
      films: { EDI1: { id: 'EDI1', title: 'Annen film', minutes: 90, ageRating: null, posterUrl: null, pageUrl: '' } },
      cinemas: ['Saga'],
      days: {
        '2026-10-29': [
          { key: 'a', filmId: 'EDI1', cinema: 'Saga', screen: 'Sal 1', day: '2026-10-29', time: '20:00', minutes: 1200, bookingUrl: null, tags: [] },
        ],
      },
    };
    const merged = mergePrograms(filmweb, cinemateketProgram(parseFeed(FEED), ''));
    expect(merged.cinemas).toEqual(['Cinemateket', 'Saga']);
    expect(merged.days['2026-10-29'].map((s) => s.time)).toEqual(['18:00', '20:00']);
    expect(Object.keys(merged.days)).toEqual(['2026-10-29', '2027-06-02']);
  });
});

describe('the Cinemateket fixture', () => {
  it('parses every screening', () => {
    const feed = readFileSync('tests/fixtures/cinemateket.ics', 'utf8');
    const events = parseFeed(feed);
    expect(events.length).toBe(feed.match(/BEGIN:VEVENT/g)?.length);
    expect(events.every((e) => e.screen && e.title)).toBe(true);
    expect(events.every((e) => e.minutes === null || e.minutes > 0)).toBe(true);
  });
});
