import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CINEMA, cinemaNeuf, cinemaNeufProgram, parseProgram, programFileUrl } from '../src/lib/sources/cinemaneuf.ts';

const TSV = [
  'week\tdate\teditorialGroup\tscreeningStartTime\ttitle\ttheme\treleaseYear\tdirector\tcountry\tduration\tdescriptionNor\tdescriptionEng\tStatus  / kommentar\t',
  '45\t2026-11-05\tAnalog Thursday\t19:00\tLove is the Devil\tKunst\t1998\tJohn Maybury\tUK\t92 min.\t\tAbout Francis Bacon.\tBooket\t',
  '46\t2026-11-12\tAnalog Thursday\t9:30\tLove is the Devil\tKunst\t1998\tJohn Maybury\tUK\t92 min.\tOm Francis Bacon.\t\tBooket\t',
  '47\t\t\t\t\t\t\t\t\t\t\t\t\t',
  '',
].join('\r\n');

describe('programFileUrl', () => {
  it.each([
    ['2026-01-10', 'https://cinemaneuf.no/semesters/2026/Spring/Program_Spring_2026.tsv'],
    ['2026-06-30', 'https://cinemaneuf.no/semesters/2026/Spring/Program_Spring_2026.tsv'],
    ['2026-07-01', 'https://cinemaneuf.no/semesters/2026/Fall/Program_Fall_2026.tsv'],
    ['2026-12-31', 'https://cinemaneuf.no/semesters/2026/Fall/Program_Fall_2026.tsv'],
  ])('%s → %s', (day, expected) => {
    expect(programFileUrl(day)).toBe(expected);
  });
});

describe('parseProgram', () => {
  const screenings = parseProgram(TSV);

  it('reads the rows with a date, time and title, and skips the rest', () => {
    expect(screenings).toEqual([
      { start: '2026-11-05T19:00:00', title: 'Love is the Devil', year: 1998, minutes: 92, description: 'About Francis Bacon.' },
      { start: '2026-11-12T09:30:00', title: 'Love is the Devil', year: 1998, minutes: 92, description: 'Om Francis Bacon.' },
    ]);
  });
});

describe('cinemaNeufProgram', () => {
  const program = cinemaNeufProgram(parseProgram(TSV));

  it('makes one film per title, linking times to the program page', () => {
    expect(program.films).toEqual({
      'CINEMANEUF:love-is-the-devil': {
        title: 'Love is the Devil',
        originalTitle: null,
        year: 1998,
        slug: 'cinema-neuf-love-is-the-devil',
        minutes: 92,
        ageRating: null,
        synopsis: 'About Francis Bacon.',
        posterUrl: null,
        pageUrl: 'https://cinemaneuf.no/html/program.html',
        source: 'Cinema Neuf',
      },
    });
    expect(program.days['2026-11-12'][0]).toMatchObject({
      cinema: CINEMA,
      screen: '',
      time: '09:30',
      bookingUrl: 'https://cinemaneuf.no/html/program.html',
    });
  });
});

describe('the Cinema Neuf fixture', () => {
  it('has screenings, nearly all with a year', () => {
    const program = cinemaNeuf.program(readFileSync('tests/fixtures/cinemaneuf.tsv', 'utf8'));
    const films = Object.values(program.films);
    expect(Object.values(program.days).flat().length).toBeGreaterThan(0);
    // The club's own "SHOWCASE" evening has none
    expect(films.filter((f) => !f.year).length).toBeLessThanOrEqual(1);
  });
});
