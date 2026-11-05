import { decodeEntities, htmlText } from '../html.ts';
import { fetchOk } from '../http.ts';
import { slugify, type Film, type Program, type Showing, type Source } from '../program.ts';
import { programSlot } from '../time.ts';

// OsloMet Filmklubb: the student film club's screenings in Lille Auditorium at P32. Its RSS feed lists the upcoming
// screenings with only a date, so each screening's own page is fetched too, for the time and the film's details.
export const CINEMA = 'OsloMet Filmklubb';
const SITE = 'https://oslometfilmklubb.no';
const FEED_URL = `${SITE}/visninger/index.xml`;
// "Dungeons & Dragons: Honor Among Thieves (2023)"
const TITLE = /^(.*?)\s*\((\d{4})\)$/;
// "06 November 2026\n- 16:30"
const TIME = /<strong>Tid:<\/strong>\s*(\d{1,2})\.?\s+(\p{L}+)\s+(\d{4})\s*-\s*(\d{1,2})[:.](\d{2})/u;
// By their first three letters, in Norwegian and English
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

export type OsloMetScreening = {
  title: string;
  year: number | null;
  minutes: number | null;
  ageRating: string | null;
  synopsis: string;
  /** The screening's page. */
  url: string;
  /** Oslo local time: "2026-11-06T16:30:00". */
  start: string;
};

/** A row of the film's table on the page: "Spilletid:" → "134 min". */
function row(html: string, label: string): string | null {
  const value = html.match(new RegExp(`<td>${label}:</td><td>(.*?)</td>`, 's'))?.[1];
  return value ? htmlText(value) : null;
}

/** The screening on its page, or null for a page that doesn't read as one. */
export function parsePage(html: string): OsloMetScreening | null {
  const heading = html.match(/<h1 class=post-title><a href=([^\s>]+)>(.*?)<\/a>/s);
  const time = html.match(TIME);
  const month = time && MONTHS[time[2].slice(0, 3).toLowerCase()];
  if (!heading || !time || !month) return null;
  const name = htmlText(heading[2]);
  const m = name.match(TITLE);
  const minutes = row(html, 'Spilletid')?.match(/^(\d+)/)?.[1];
  const date = `${time[3]}-${String(month).padStart(2, '0')}-${time[1].padStart(2, '0')}`;
  return {
    title: m ? m[1] : name,
    year: m ? Number(m[2]) : null,
    minutes: minutes ? Number(minutes) : null,
    ageRating: row(html, 'Aldersgrense'),
    synopsis: decodeEntities(html.match(/<meta name=description content="(.*?)">/s)?.[1] ?? '').trim(),
    url: heading[1],
    start: `${date}T${time[4].padStart(2, '0')}:${time[5]}:00`,
  };
}

export function osloMetProgram(pages: string[]): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const page of pages) {
    const screening = parsePage(page);
    if (!screening) continue;
    const filmId = `OSLOMETFILMKLUBB:${slugify(screening.title)}`;
    films[filmId] ??= {
      title: screening.title,
      originalTitle: null,
      year: screening.year,
      // Like Cinemateket's, so a film Filmweb also lists keeps its own page
      slug: `oslomet-filmklubb-${slugify(screening.title)}`,
      minutes: screening.minutes,
      ageRating: screening.ageRating,
      synopsis: screening.synopsis || null,
      // The page's posters are TMDB's originals, so the film gets TMDB's poster from the lookup instead
      posterUrl: null,
      pageUrl: screening.url,
      source: CINEMA,
    };
    const slot = programSlot(screening.start);
    (days[slot.day] ??= []).push({
      key: screening.url,
      filmId,
      cinema: CINEMA,
      // One room, Lille Auditorium
      screen: '',
      ...slot,
      // Entry is at the door, for members
      bookingUrl: screening.url,
    });
  }

  return { films, days };
}

/** The feed's screening pages, as a JSON list of their HTML. */
async function fetchPages(): Promise<string> {
  const feed = await (await fetchOk(CINEMA, FEED_URL)).text();
  const links = [...feed.matchAll(/<item>.*?<link>(.*?)<\/link>/gs)].map(([, link]) => link.trim());
  return JSON.stringify(await Promise.all(links.map(async (link) => (await fetchOk(CINEMA, link)).text())));
}

export const osloMetFilmklubb: Source = {
  name: CINEMA,
  homepage: `${SITE}/visninger/`,
  file: 'oslometfilmklubb.json',
  fetch: fetchPages,
  program: (raw) => osloMetProgram(JSON.parse(raw)),
};
