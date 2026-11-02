import { fetchOk } from '../http.ts';
import { slugify, type Film, type Program, type Showing, type Source } from '../program.ts';
import { programNow, programSlot } from '../time.ts';

// The student film club at Chateau Neuf. Its site reads the semester's program from a spreadsheet, one row per screening.
const NAME = 'Cinema Neuf';
const SITE = 'https://cinemaneuf.no';
// Screenings have no pages or ticket links of their own; the program page links to the tickets
const PROGRAM_URL = `${SITE}/html/program.html`;
export const CINEMA = NAME;

export type NeufScreening = {
  /** Oslo local time, "2026-11-05T19:00:00". */
  start: string;
  title: string;
  year: number | null;
  minutes: number | null;
  description: string;
};

/** The semester's spreadsheet, as the club's own site finds it: "Spring" until July, then "Fall". */
export function programFileUrl(day: string = programNow().day): string {
  const year = day.slice(0, 4);
  const season = Number(day.slice(5, 7)) < 7 ? 'Spring' : 'Fall';
  return `${SITE}/semesters/${year}/${season}/Program_${season}_${year}.tsv`;
}

/** The rows with a date, time and title. Like the club's site, it shows every row, whatever its status column says. */
export function parseProgram(tsv: string): NeufScreening[] {
  const [header, ...lines] = tsv.split(/\r?\n/).map((line) => line.split('\t'));
  const screenings: NeufScreening[] = [];
  for (const cells of lines) {
    const row = Object.fromEntries(header.map((name, i) => [name, cells[i]?.trim() ?? '']));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !/^\d{1,2}:\d{2}$/.test(row.screeningStartTime) || !row.title) continue;
    screenings.push({
      start: `${row.date}T${row.screeningStartTime.padStart(5, '0')}:00`,
      title: row.title,
      year: Number(row.releaseYear) || null,
      // "92 min."
      minutes: Number(row.duration.match(/\d+/)?.[0]) || null,
      description: row.descriptionNor || row.descriptionEng,
    });
  }
  return screenings;
}

export function cinemaNeufProgram(screenings: NeufScreening[]): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const screening of screenings) {
    const filmId = `CINEMANEUF:${slugify(screening.title)}`;
    films[filmId] ??= {
      title: screening.title,
      originalTitle: null,
      year: screening.year,
      // Like Cinemateket's, so a film Filmweb also lists keeps its own page
      slug: `cinema-neuf-${slugify(screening.title)}`,
      minutes: screening.minutes,
      ageRating: null,
      synopsis: screening.description || null,
      // The spreadsheet has no posters, so the film gets TMDB's or none
      posterUrl: null,
      pageUrl: PROGRAM_URL,
      source: NAME,
    };
    const slot = programSlot(screening.start);
    (days[slot.day] ??= []).push({
      key: screening.start,
      filmId,
      cinema: CINEMA,
      // One screen, Lillesalen
      screen: '',
      ...slot,
      bookingUrl: PROGRAM_URL,
    });
  }

  return { films, days };
}

export const cinemaNeuf: Source = {
  name: NAME,
  homepage: SITE,
  file: 'cinemaneuf.tsv',
  fetch: async () => (await fetchOk(NAME, programFileUrl())).text(),
  program: (raw) => cinemaNeufProgram(parseProgram(raw)),
};
