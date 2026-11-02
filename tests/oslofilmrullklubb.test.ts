import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CINEMA,
  filmrullProgram,
  osloFilmrullklubb,
  parseFeed,
  parsePost,
  type FilmrullPost,
} from '../src/lib/sources/oslofilmrullklubb.ts';

const LINK = 'https://www.oslofilmrullklubb.no/2026/10/31/the-executioners-song-1982-tirsdag-10-november/';

function post(overrides: Partial<FilmrullPost>): FilmrullPost {
  return {
    title: 'The Executioner’s Song (1982) tirsdag 10. november',
    link: LINK,
    pubDate: 'Sat, 31 Oct 2026 12:41:31 +0000',
    content: '<p>Den sanne historien om Gary Gilmore.</p><p>Dørene åpner 18</p><p>Filmstart litt etter 19</p>',
    ...overrides,
  };
}

describe('parseFeed', () => {
  it('reads the posts, with entities decoded', () => {
    const xml = `<rss><channel><item>
      <title>The Executioner&#8217;s Song (1982) tirsdag 10. november</title>
      <link>${LINK}</link>
      <pubDate>Sat, 31 Oct 2026 12:41:31 +0000</pubDate>
      <content:encoded><![CDATA[<p>Tekst</p>]]></content:encoded>
    </item></channel></rss>`;
    expect(parseFeed(xml)).toEqual([
      {
        title: 'The Executioner’s Song (1982) tirsdag 10. november',
        link: LINK,
        pubDate: 'Sat, 31 Oct 2026 12:41:31 +0000',
        content: '<p>Tekst</p>',
      },
    ]);
  });
});

describe('parsePost', () => {
  it('reads the film, year, start and first paragraph', () => {
    expect(parsePost(post({}))).toEqual({
      title: 'The Executioner’s Song',
      year: 1982,
      start: '2026-11-10T19:00:00',
      synopsis: 'Den sanne historien om Gary Gilmore.',
    });
  });

  it('takes the start time from the post', () => {
    const content = '<p>Første film starter presis kl. 1930</p>';
    expect(parsePost(post({ content }))?.start).toBe('2026-11-10T19:30:00');
  });

  it('puts a date earlier in the year than the post in the next year', () => {
    const screening = parsePost(post({ title: 'Persona (1966) 13. januar', pubDate: 'Sat, 12 Dec 2026 10:00:00 +0000' }));
    expect(screening?.start).toBe('2027-01-13T19:00:00');
  });

  it('leaves out posts without a film', () => {
    expect(parsePost(post({ title: '10års-jubileums-visning og fest 13. mai' }))).toBeNull();
  });
});

describe('filmrullProgram', () => {
  it('makes a film per title, with times linking to the post', () => {
    const program = filmrullProgram([post({})]);
    expect(program.films['OSLOFILMRULLKLUBB:the-executioner-s-song']).toMatchObject({
      title: 'The Executioner’s Song',
      year: 1982,
      slug: 'oslo-filmrullklubb-the-executioner-s-song',
      pageUrl: LINK,
      source: 'Oslo Filmrullklubb',
    });
    expect(program.days['2026-11-10'][0]).toMatchObject({ cinema: CINEMA, time: '19:00', bookingUrl: LINK });
  });
});

describe('the Oslo Filmrullklubb fixture', () => {
  it('has screenings of films with a year', () => {
    const program = osloFilmrullklubb.program(readFileSync('tests/fixtures/oslofilmrullklubb.xml', 'utf8'));
    expect(Object.values(program.days).flat().length).toBeGreaterThan(0);
    expect(Object.values(program.films).every((f) => f.year)).toBe(true);
  });
});
