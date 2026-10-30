import { USER_AGENT } from './http.ts';
import type { Film, Program, Showing } from './program.ts';
import { osloDateTime, programSlot } from './time.ts';

// Cinemateket isn't in Filmweb. Its calendar feed holds the next 100 screenings (about three weeks).
const FEED_URL = 'https://www.cinemateket.no/cinemateket-webcal.ics';
export const CINEMA = 'Cinemateket';
// The feed has no images, so every Cinemateket film gets the same logo poster
const POSTER = '/posters/cinemateket.svg';

export type CinemateketEvent = {
  uid: string;
  /** Oslo local time, "2026-10-29T18:00:00". */
  start: string;
  minutes: number | null;
  title: string;
  /** "Lillebil" or "Tancred". */
  screen: string;
  url: string;
};

export async function fetchCinemateketFeed(): Promise<string> {
  const res = await fetch(FEED_URL, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Cinemateket svarte ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
}

/** "20261029T170000Z" → Date. The feed only uses UTC times. */
function parseDate(value: string): Date {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) throw new Error(`Ukjent datoformat i Cinemateket-feeden: ${value}`);
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

export function parseFeed(ics: string): CinemateketEvent[] {
  // Long lines are folded onto continuation lines that start with a space or tab
  const lines = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: CinemateketEvent[] = [];
  let fields: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      fields = {};
    } else if (line === 'END:VEVENT' && fields) {
      if (fields.UID && fields.DTSTART && fields.SUMMARY && fields.URL) {
        const start = parseDate(fields.DTSTART);
        events.push({
          uid: fields.UID,
          start: osloDateTime(start),
          minutes: fields.DTEND ? Math.round((parseDate(fields.DTEND).getTime() - start.getTime()) / 60_000) || null : null,
          title: unescapeText(fields.SUMMARY),
          screen: unescapeText(fields.LOCATION ?? '').split(' - ')[0].trim(),
          url: unescapeText(fields.URL),
        });
      }
      fields = null;
    } else if (fields) {
      const colon = line.indexOf(':');
      if (colon > 0) fields[line.slice(0, colon).split(';')[0]] = line.slice(colon + 1);
    }
  }
  return events;
}

/** Cinemateket's screenings as a program. Times link to the film page, where tickets are sold. */
export function cinemateketProgram(events: CinemateketEvent[]): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const event of events) {
    // Children's workshops are listed without a length; only screenings have one
    if (!event.minutes) continue;
    const filmId = `CINEMATEKET:${event.url.split('/').filter(Boolean).pop()}`;
    films[filmId] ??= {
      title: event.title,
      minutes: event.minutes,
      ageRating: null,
      posterUrl: POSTER,
      pageUrl: event.url,
    };
    const slot = programSlot(event.start);
    (days[slot.day] ??= []).push({
      key: event.uid,
      filmId,
      cinema: CINEMA,
      screen: event.screen,
      ...slot,
      bookingUrl: event.url,
    });
  }

  return { films, days };
}
