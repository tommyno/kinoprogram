import { formatDuration } from './time.ts';

export type Film = {
  title: string;
  /** Its page on this site, /film/{slug}. */
  slug: string;
  minutes: number | null;
  ageRating: string | null;
  /** A few lines about the film, with line breaks kept. */
  synopsis: string | null;
  posterUrl: string | null;
  /** Resized versions of the poster, when the source offers them. */
  posterSrcSet?: string;
  /** The film's page at the source: Filmweb, or Cinemateket for its own screenings. */
  pageUrl: string;
};

export type Showing = {
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
};

export type Program = {
  films: Record<string, Film>;
  /** Showings per day. */
  days: Record<string, Showing[]>;
};

export const collator = new Intl.Collator('nb');

/** "Kikis budservice" → "kikis-budservice", "Glemselens øy" → "glemselens-oy". */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'o')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The film's own page on this site. */
export function filmPath(film: Film): string {
  return `/film/${film.slug}`;
}

/** A film's showings per day, from the given day on. */
export function filmDays(program: Program, filmId: string, from: string): [string, Showing[]][] {
  return Object.entries(program.days)
    .filter(([day]) => day >= from)
    .map(([day, list]): [string, Showing[]] => [day, list.filter((s) => s.filmId === filmId)])
    .filter(([, list]) => list.length > 0);
}

/** "1 t 50 min · 12 år", or whichever of the two is known. */
export function filmMeta(film: Film): string {
  return [formatDuration(film.minutes), film.ageRating].filter(Boolean).join(' · ');
}

/** Ids of every film with a showing from the given day on. */
export function upcomingFilmIds(program: Program, from: string): string[] {
  const ids = new Set(
    Object.entries(program.days)
      .filter(([day]) => day >= from)
      .flatMap(([, list]) => list.map((s) => s.filmId)),
  );
  return [...ids];
}

/** Every film with a showing from the given day on, A–Å. */
export function upcomingFilms(program: Program, from: string): Film[] {
  return upcomingFilmIds(program, from)
    .map((id) => program.films[id])
    .sort((a, b) => collator.compare(a.title, b.title));
}

/** Combines the sources' programs: days in ascending order, each sorted by start time. */
export function mergePrograms(programs: Program[]): Program {
  const films: Record<string, Film> = {};
  // A title can occur twice (Filmweb lists some films under two ids); later ones get -2, -3 and so on
  const slugs = new Set<string>();
  for (const [id, film] of programs.flatMap((p) => Object.entries(p.films))) {
    let slug = film.slug;
    for (let n = 2; slugs.has(slug); n++) slug = `${film.slug}-${n}`;
    slugs.add(slug);
    films[id] = { ...film, slug };
  }
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
