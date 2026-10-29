export interface Film {
  title: string;
  minutes: number | null;
  ageRating: string | null;
  posterUrl: string | null;
  /** Resized versions of the poster, when the source offers them. */
  posterSrcSet?: string;
  /** The film's page at the source: Filmweb, or Cinemateket for its own screenings. */
  pageUrl: string;
}

export interface Showing {
  /** Stable id within the source. */
  key: string;
  filmId: string;
  cinema: string;
  /** Short screen name ("Sal 6", "IMAX"); empty for single-screen venues. */
  screen: string;
  /** Day, YYYY-MM-DD. */
  day: string;
  /** Start as shown, HH:MM. */
  time: string;
  /** Minutes since midnight. */
  minutes: number;
  /** Where to buy tickets: the booking page, or the film's page when there is none. */
  bookingUrl: string;
}

export interface Program {
  films: Record<string, Film>;
  /** Showings per day. */
  days: Record<string, Showing[]>;
}

export const collator = new Intl.Collator('nb');

/** Combines the sources' programs: days in ascending order, each sorted by start time. */
export function mergePrograms(programs: Program[]): Program {
  const films: Record<string, Film> = Object.assign({}, ...programs.map((p) => p.films));
  const all: Record<string, Showing[]> = {};
  for (const program of programs) {
    for (const [day, list] of Object.entries(program.days)) (all[day] ??= []).push(...list);
  }

  const days: Record<string, Showing[]> = {};
  for (const day of Object.keys(all).sort()) {
    days[day] = all[day].sort(
      (a, b) =>
        a.minutes - b.minutes ||
        collator.compare(films[a.filmId].title, films[b.filmId].title) ||
        collator.compare(a.cinema, b.cinema),
    );
  }
  return { films, days };
}
