import type { Film, Showing } from '../lib/program.ts';

export interface ShowingView extends Showing {
  past: boolean;
}

export const collator = new Intl.Collator('nb');

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** The booking page when there is one, otherwise the film's page (where Cinemateket sells tickets). */
export function bookingHref(showing: Showing, film: Film): string {
  return showing.bookingUrl ?? film.pageUrl;
}

export function showingLabel(showing: ShowingView, film: Film): string {
  const label = `${film.title}, ${showing.time}, ${showing.cinema}`;
  return showing.past ? `${label} (startet)` : label;
}

/** Groups items by key, keeping the order of first appearance. */
export function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return [...groups];
}
