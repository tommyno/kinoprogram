const TIME_ZONE = 'Europe/Oslo';

// A show counts as started this long after its start time (ads and trailers run first).
const PAST_GRACE_MINUTES = 15;

/** A point in the program: the day and minutes since midnight. */
export type ProgramTime = {
  day: string;
  minutes: number;
};

const clockFormat = new Intl.DateTimeFormat('nb-NO', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const labelFormat = new Intl.DateTimeFormat('nb-NO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const shortFormat = new Intl.DateTimeFormat('nb-NO', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Program slot for an Oslo local start time ("2026-10-31T19:15:00" → day 2026-10-31, 19:15). */
export function programSlot(start: string): ProgramTime & { time: string } {
  const time = start.slice(11, 16);
  return { day: start.slice(0, 10), minutes: toMinutes(time), time };
}

/** An instant as Oslo local time: "2026-10-29T18:00:00". */
export function osloDateTime(at: Date): string {
  const p = Object.fromEntries(clockFormat.formatToParts(at).map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00`;
}

/** A screening's length from its start and end, or null when they are the same. */
export function minutesBetween(start: Date, end: Date): number | null {
  return Math.round((end.getTime() - start.getTime()) / 60_000) || null;
}

/** The current point in the program, in Oslo time whatever the viewer's or server's zone. */
export function programNow(at: Date = new Date()): ProgramTime {
  const { day, minutes } = programSlot(osloDateTime(at));
  return { day, minutes };
}

export function isPast(slot: ProgramTime, now: ProgramTime): boolean {
  if (slot.day !== now.day) return slot.day < now.day;
  return slot.minutes + PAST_GRACE_MINUTES < now.minutes;
}

/** Marks started showing links (see ShowingLink) with data-past, which global.css greys out, and says so in their label. */
export function markPast(links: HTMLElement[]): void {
  const now = programNow();
  for (const link of links) {
    const past = isPast({ day: link.dataset.day!, minutes: Number(link.dataset.minutes) }, now);
    const label = (link.dataset.label ??= link.getAttribute('aria-label')!);
    link.toggleAttribute('data-past', past);
    link.setAttribute('aria-label', past ? `${label} (startet)` : label);
  }
}

/**
 * The day sections (data-day-section) are labelled at build time; in case Oslo has passed midnight since, drops the
 * days that are over and labels the rest again.
 */
export function relabelDays(): void {
  const today = programNow().day;
  for (const section of document.querySelectorAll<HTMLElement>('[data-day-section]')) {
    const day = section.dataset.daySection!;
    if (day < today) {
      section.remove();
      continue;
    }
    const label = dayLabel(day, today);
    section.querySelector('[data-day-label]')!.textContent = label;
    section.querySelector<HTMLElement>('[data-date]')!.hidden = label === formatDay(day);
  }
}

/** "2026-11-01" → "søndag 1. november". */
export function formatDay(day: string): string {
  return labelFormat.format(new Date(`${day}T12:00:00Z`));
}

/** "2026-11-04" → "ons. 4. nov.". */
export function formatShortDay(day: string): string {
  return shortFormat.format(new Date(`${day}T12:00:00Z`));
}

/** "i dag", "i morgen" or e.g. "lørdag 31. oktober". */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'i dag';
  if (day === addDays(today, 1)) return 'i morgen';
  return formatDay(day);
}

/** 110 → "1 t 50 min". */
export function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} t ${m} min` : `${m} min`;
}
