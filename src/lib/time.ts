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

/** "2026-11-01" → "søndag 1. november". */
export function formatDay(day: string): string {
  return labelFormat.format(new Date(`${day}T12:00:00Z`));
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
