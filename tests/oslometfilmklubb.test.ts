import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CINEMA, osloMetProgram, parsePage } from '../src/lib/sources/oslometfilmklubb.ts';

const URL = 'https://oslometfilmklubb.no/visninger/2026-11-06-dungeons_and_dragons_2023/';

function page(time: string): string {
  return `<head><meta name=description content="A charming thief &amp; a band of adventurers.
"></head><body><article class=post><h1 class=post-title><a href=${URL}>Dungeons & Dragons: Honor Among Thieves (2023)</a></h1>
    <p><strong>Inngangspris:</strong> Gratis!</p><p><strong>Tid:</strong> ${time}<br><strong>Sted:</strong> Lille Auditorium, P32</p>
    <table class=movie-info><tr><td>Spilletid:</td><td>134 min</td></tr><tr><td>Aldersgrense:</td><td>12 år</td></tr></table>
  </article></body>`;
}

describe('parsePage', () => {
  it('reads the screening', () => {
    expect(parsePage(page('06 November 2026\n- 16:30'))).toEqual({
      title: 'Dungeons & Dragons: Honor Among Thieves',
      year: 2023,
      minutes: 134,
      ageRating: '12 år',
      synopsis: 'A charming thief & a band of adventurers.',
      url: URL,
      start: '2026-11-06T16:30:00',
    });
  });

  it('reads a Norwegian month', () => {
    expect(parsePage(page('3. desember 2026 - 18:00'))?.start).toBe('2026-12-03T18:00:00');
  });

  it('leaves out a page without a time', () => {
    expect(parsePage(page('Kommer snart'))).toBeNull();
  });
});

describe('osloMetProgram', () => {
  it('makes a film per title, with the time linking to its page', () => {
    const program = osloMetProgram([page('06 November 2026\n- 16:30')]);
    expect(program.films['OSLOMETFILMKLUBB:dungeons-dragons-honor-among-thieves']).toMatchObject({
      slug: 'oslomet-filmklubb-dungeons-dragons-honor-among-thieves',
      minutes: 134,
    });
    expect(program.days['2026-11-06'][0]).toMatchObject({ cinema: CINEMA, time: '16:30', bookingUrl: URL });
  });
});

describe('the OsloMet Filmklubb fixture', () => {
  it('has screenings of films with a year', () => {
    const program = osloMetProgram(JSON.parse(readFileSync('tests/fixtures/oslometfilmklubb.json', 'utf8')));
    expect(Object.values(program.days).flat().length).toBeGreaterThan(0);
    expect(Object.values(program.films).every((f) => f.year)).toBe(true);
  });
});
