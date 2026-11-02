import { formatDuration } from './time.ts';

export type Film = {
  title: string;
  /** The original title, when the source has one. */
  originalTitle: string | null;
  /** Production year, for finding the film at TMDB. */
  year: number | null;
  /** Its page on this site, /film/{slug}. */
  slug: string;
  minutes: number | null;
  ageRating: string | null;
  /** A few lines about the film, with line breaks kept. */
  synopsis: string | null;
  /** The source's poster, until the build replaces it with a small copy of its own. */
  posterUrl: string | null;
  /** The source poster's size, for one the build downloads; Cinemateket's logo has none. */
  posterSize?: { width: number; height: number };
  /** The small copy and a large one, for the film page where a click opens it to full width. */
  posterLarge?: { srcSet: string; width: number };
  /** The film's page at the source it comes from. */
  pageUrl: string;
  /** That source's name, for the link to pageUrl: "Filmweb". */
  source: string;
  /** YouTube id of the film's trailer at TMDB. */
  trailer?: string;
  /** From TMDB, as are the leading actors. */
  directors?: Person[];
  cast?: Person[];
};

/** Someone who made or plays in a film, with their page at TMDB. */
export type Person = {
  name: string;
  url: string;
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

/** Somewhere the program is fetched from, each in its own file in src/lib/sources. */
export type Source = {
  /** "Deichman", as the site and the build log name it. */
  name: string;
  /** The source's own site, for the about page. */
  homepage: string;
  /** File name for the raw response, kept in .cache between local builds and in tests/fixtures: "deichman.json". */
  file: string;
  /** Without it the site isn't built; any other source is left out when it fails. */
  required?: boolean;
  /** The raw response, as text. */
  fetch: () => Promise<string>;
  program: (raw: string) => Program;
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

/** Names a showing among its film's showings: "2026-11-01-1830-odeon-oslo-sal-4". */
export function showingAnchor(showing: Showing): string {
  return slugify([showing.day, showing.time.replace(':', ''), showing.cinema, showing.screen].join(' '));
}

/** The film page with this showing marked (see FilmPage). */
export function showingPath(film: Film, showing: Showing): string {
  return `${filmPath(film)}#${showingAnchor(showing)}`;
}

/** The chosen showings per day, from the given day on, such as a film's or a cinema's. */
export function showingDays(program: Program, from: string, keep: (s: Showing) => boolean): [string, Showing[]][] {
  return Object.entries(program.days)
    .filter(([day]) => day >= from)
    .map(([day, list]): [string, Showing[]] => [day, list.filter(keep)])
    .filter(([, list]) => list.length > 0);
}

const listFormat = new Intl.ListFormat('nb', { type: 'conjunction' });

/** "Ingrid Bergman, Liv Ullmann og Lena Nyman", as the items and the commas and "og" between them, so each can be a link. */
export function listParts<T extends { name: string }>(items: T[]): (T | string)[] {
  let i = 0;
  return listFormat.formatToParts(items.map((item) => item.name)).map((part) => (part.type === 'element' ? items[i++] : part.value));
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

/** Throws when there is nothing to show today, so the build fails and Vercel keeps the previous deploy. */
export function assertPlausible(program: Program, today: string): void {
  if (!program.days[today]?.length) {
    throw new Error(`Programdataene ser feil ut: ingen visninger ${today}.`);
  }
}
