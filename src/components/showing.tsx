import type { ReactNode } from 'react';
import type { Showing } from '../lib/program.ts';

export interface ShowingView extends Showing {
  past: boolean;
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

interface ShowingLinkProps {
  showing: ShowingView;
  title: string;
  className: string;
  children: ReactNode;
}

/** A showing's ticket link. Started showings get data-past, which global.css greys out. */
export function ShowingLink({ showing, title, className, children }: ShowingLinkProps) {
  const label = `${title}, ${showing.time}, ${showing.cinema}`;
  return (
    <a
      href={showing.bookingUrl}
      target="_blank"
      rel="noopener"
      aria-label={showing.past ? `${label} (startet)` : label}
      data-past={showing.past || undefined}
      className={className}
    >
      {children}
    </a>
  );
}
