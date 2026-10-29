import { USER_AGENT } from './http.ts';
import { sortProgram, type Film, type Program, type Showing } from './program.ts';
import { osloDateTime, programSlot } from './time.ts';

// Cinemateket isn't in Filmweb. Its calendar feed holds the next 100 screenings (about three weeks).
const FEED_URL = 'https://www.cinemateket.no/cinemateket-webcal.ics';
export const CINEMA = 'Cinemateket';
// The feed has no images, so every Cinemateket film gets the same logo poster
const POSTER = '/posters/cinemateket.svg';

export interface CinemateketEvent {
  uid: string;
  /** Oslo local time, "2026-10-29T18:00:00". */
  start: string;
  minutes: number | null;
  title: string;
  /** "Lillebil" or "Tancred". */
  screen: string;
  url: string;
}

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

/** "20261029T170000Z" → Date; floating times without Z are Oslo local already. */
function parseDate(value: string): { local: string; date: Date | null } {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) throw new Error(`Ukjent datoformat i Cinemateket-feeden: ${value}`);
  const [, y, mo, d, h, mi, s, utc] = m;
  if (!utc) return { local: `${y}-${mo}-${d}T${h}:${mi}:${s}`, date: null };
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return { local: osloDateTime(date), date };
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
      if (fields.UID && fields.DTSTART && fields.SUMMARY) {
        const start = parseDate(fields.DTSTART);
        const end = fields.DTEND ? parseDate(fields.DTEND) : null;
        events.push({
          uid: fields.UID,
          start: start.local,
          minutes: start.date && end?.date ? Math.round((end.date.getTime() - start.date.getTime()) / 60_000) || null : null,
          title: unescapeText(fields.SUMMARY),
          screen: unescapeText(fields.LOCATION ?? '').split(' - ')[0].trim(),
          url: unescapeText(fields.URL ?? 'https://www.cinemateket.no/forestillinger'),
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
export function cinemateketProgram(events: CinemateketEvent[], fetchedAt: string): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const event of events) {
    // Children's workshops are listed without a length; only screenings have one
    if (!event.minutes) continue;
    const filmId = `CINEMATEKET:${event.url.split('/').filter(Boolean).pop()}`;
    films[filmId] ??= {
      id: filmId,
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
      day: slot.day,
      time: slot.time,
      minutes: slot.minutes,
      bookingUrl: null,
      tags: [],
    });
  }

  return sortProgram({ fetchedAt, films, cinemas: Object.keys(days).length ? [CINEMA] : [], days });
}
