import type { ReactNode } from 'react';
import type { Showing } from '../../lib/program.ts';

export type ShowingView = Showing & {
  past: boolean;
};

type ShowingLinkProps = {
  showing: ShowingView;
  title: string;
  className: string;
  children: ReactNode;
};

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
