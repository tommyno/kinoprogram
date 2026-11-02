import { z } from 'zod';
import { htmlText } from '../html.ts';
import { fetchOk } from '../http.ts';
import { slugify, type Film, type Program, type Showing, type Source } from '../program.ts';
import { programSlot } from '../time.ts';

// Weird and Wonderful Cinema: a film club at Kruttverket on Kroloftet, about every other week. Its program is on Fienta,
// one event per screening, and Fienta's public API lists the organizer's upcoming events.
export const CINEMA = 'Weird and Wonderful Cinema';
const ORGANIZER_URL = 'https://fienta.com/o/8992';
const API_URL = 'https://fienta.com/api/v1/public/events?organizer=8992';
// "Birth, Jonathan Glazer (2004)": the title is everything before the last comma
const TITLE = /^(.*),\s*(.+?)\s*\((\d{4})\)\s*$/;

export const RawEvent = z.object({
  id: z.number(),
  title: z.string(),
  // Oslo local time: "2026-11-10 19:00:00"
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/),
  event_status: z.string(),
  attendance_mode: z.string(),
  description: z.string().nullish(),
  url: z.string(),
  buy_tickets_url: z.string().nullish(),
});
export type RawEvent = z.infer<typeof RawEvent>;

/** "Birth, Jonathan Glazer (2004)" → title and year. Any other name is kept whole as the title. */
export function parseTitle(name: string): { title: string; year: number | null } {
  const m = name.trim().match(TITLE);
  if (!m) return { title: name.trim(), year: null };
  return { title: m[1].trim(), year: Number(m[3]) };
}

/** The event's description as plain text, one paragraph a line. */
export function descriptionText(html: string): string {
  return html
    .split(/<br\s*\/?>|<\/p>/)
    .map(htmlText)
    .filter(Boolean)
    .join('\n');
}

export function weirdAndWonderfulProgram(events: RawEvent[]): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const event of events) {
    if (event.event_status !== 'scheduled' || event.attendance_mode === 'online') continue;
    const { title, year } = parseTitle(event.title);
    const filmId = `WEIRDANDWONDERFUL:${slugify(title)}`;
    films[filmId] ??= {
      title,
      originalTitle: null,
      year,
      // Like Cinemateket's, so a film Filmweb also lists keeps its own page
      slug: `weird-and-wonderful-cinema-${slugify(title)}`,
      minutes: null,
      ageRating: null,
      synopsis: descriptionText(event.description ?? '') || null,
      // The events' images are banners of unknown size, so the film gets TMDB's poster or none
      posterUrl: null,
      pageUrl: event.url,
      source: CINEMA,
    };
    const slot = programSlot(event.starts_at.replace(' ', 'T'));
    (days[slot.day] ??= []).push({
      key: String(event.id),
      filmId,
      cinema: CINEMA,
      // One room
      screen: '',
      ...slot,
      bookingUrl: event.buy_tickets_url || event.url,
    });
  }

  return { films, days };
}

const Response = z.object({ events: z.array(RawEvent) });

export const weirdAndWonderful: Source = {
  name: CINEMA,
  homepage: ORGANIZER_URL,
  file: 'weirdandwonderful.json',
  fetch: async () => (await fetchOk(CINEMA, API_URL)).text(),
  program: (raw) => weirdAndWonderfulProgram(Response.parse(JSON.parse(raw)).events),
};
