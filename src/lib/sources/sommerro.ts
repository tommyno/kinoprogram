import { htmlText } from '../html.ts';
import { fetchOk } from '../http.ts';
import { slugify, type Film, type Program, type Showing, type Source } from '../program.ts';
import { addDays, programNow, programSlot } from '../time.ts';

// Sommerro: film evenings in the hotel's film room, each sold as a prepaid package with dinner, brunch or afternoon tea
// first. The film page lists every screening, one block each; booking is a widget on each series' page, so a showing
// links there. The time is when the package starts, which is when to arrive.
export const CINEMA = 'Sommerro';
const PAGE_URL = 'https://www.sommerrohouse.com/kultur/filmopplevelser/';
// "Serpico (1973)"
const TITLE = /^(.*?)\s*\((\d{4})\)$/;
// "4. November kl 18:00 - 22:00"
const DATE = /(\d{1,2})\.\s*(\p{L}+)\s+kl\.?\s*(\d{1,2})[:.](\d{2})/u;
// By their first three letters, in Norwegian and English
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

export type SommerroScreening = {
  title: string;
  year: number | null;
  synopsis: string;
  /** The series' page, where the package is booked. */
  url: string;
  /** Oslo local time: "2026-11-04T18:00:00". */
  start: string;
};

/** "4. November kl 18:00" as a start. The page has no year, so it is the first such date from a month ago on. */
export function parseDate(text: string, today: string): string | null {
  const m = text.match(DATE);
  const month = m && MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!m || !month) return null;
  const date = `${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  let year = Number(today.slice(0, 4));
  if (`${year}-${date}` < addDays(today, -30)) year++;
  return `${year}-${date}T${m[3].padStart(2, '0')}:${m[4]}:00`;
}

/** The screenings on the film page. A block that doesn't read as one is left out. */
export function parsePage(html: string, today: string): SommerroScreening[] {
  // The program; the carousel above it repeats the series
  const start = html.indexOf('events-listing-block--big');
  if (start < 0) throw new Error('Fant ikke programmet på Sommerro-siden');
  const blocks = html.slice(start).split(/<div class="events-listing-block__items__item\b/).slice(1);

  const screenings: SommerroScreening[] = [];
  for (const block of blocks) {
    const url = block.match(/<a href="([^"]+)" class="event-listing-root-link"/)?.[1];
    const name = block.match(/<p style="font-weight: 700;">(.*?)<\/p>/s)?.[1];
    const date = block.match(/__item__date[^>]*>(.*?)<\/span>/s)?.[1];
    const begins = date && parseDate(htmlText(date), today);
    if (!url || !name || !begins) continue;
    const title = htmlText(name);
    const m = title.match(TITLE);
    screenings.push({
      title: m ? m[1] : title,
      year: m ? Number(m[2]) : null,
      synopsis: htmlText(block.match(/<p>(.*?)<\/p>/s)?.[1] ?? ''),
      url,
      start: begins,
    });
  }
  if (screenings.length === 0) throw new Error('Fant ingen visninger på Sommerro-siden');
  return screenings;
}

export function sommerroProgram(screenings: SommerroScreening[]): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const screening of screenings) {
    const filmId = `SOMMERRO:${slugify(screening.title)}`;
    films[filmId] ??= {
      title: screening.title,
      originalTitle: null,
      year: screening.year,
      // Like Cinemateket's, so a film Filmweb also lists keeps its own page
      slug: `sommerro-${slugify(screening.title)}`,
      minutes: null,
      ageRating: null,
      synopsis: screening.synopsis || null,
      // The page's posters are small and of unknown size, so the film gets TMDB's or none
      posterUrl: null,
      pageUrl: screening.url,
      source: CINEMA,
    };
    const slot = programSlot(screening.start);
    (days[slot.day] ??= []).push({
      key: screening.start,
      filmId,
      cinema: CINEMA,
      // One room
      screen: '',
      ...slot,
      bookingUrl: screening.url,
    });
  }

  return { films, days };
}

export const sommerro: Source = {
  name: CINEMA,
  homepage: PAGE_URL,
  file: 'sommerro.html',
  fetch: async () => (await fetchOk(CINEMA, PAGE_URL)).text(),
  program: (raw) => sommerroProgram(parsePage(raw, programNow().day)),
};
