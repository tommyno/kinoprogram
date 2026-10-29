import type { FilmwebSnapshot, RawShow } from './filmweb.ts';
import { programSlot } from './time.ts';

export interface Film {
  id: string;
  title: string;
  minutes: number | null;
  ageRating: string | null;
  posterUrl: string | null;
  /** The film's page at the source: Filmweb, or Cinemateket for its own screenings. */
  pageUrl: string;
}

export interface Showing {
  /** Stable id: the booking URL, or cinema|screen|start|version when there is none. */
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
  bookingUrl: string | null;
  /** Version tags except the default "2D", e.g. "IMAX", "Norsk tale", "Engelsk tekst". */
  tags: string[];
}

export interface Program {
  fetchedAt: string;
  films: Record<string, Film>;
  cinemas: string[];
  /** Showings per day, sorted by start time, days in ascending order. */
  days: Record<string, Showing[]>;
}

// Filmweb also lists Vega Scene's theatre productions; their ids start with KUL.
const NON_FILM_PREFIXES = ['KUL'];
const FILMWEB_FILM_URL = 'https://www.filmweb.no/film/';

const collator = new Intl.Collator('nb');

export function isFilm(show: RawShow): boolean {
  return !NON_FILM_PREFIXES.some((prefix) => show.movieMainVersionId.startsWith(prefix));
}

export function shortScreen(screen: string, cinema: string): string {
  let s = screen.trim();
  // Single-screen venues name the screen after the cinema: "Gimle", "Kunstnernes Hus"
  if (!s || cinema.startsWith(s)) return '';
  // "Saga 6" → "6", "Vega Kino TO" → "TO"
  if (s.startsWith(cinema)) s = s.slice(cinema.length).trim();
  s = s
    .replace('® by Coca-Cola', '')
    .replace(/\s+-\s+/, ' ')
    .replace(/\bisense\b/i, 'iSense')
    .trim();
  if (/^(\d+|EN|TO|TRE)$/.test(s)) s = `Sal ${s}`;
  return s;
}

function orNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function ageRating(rating: string | null): string | null {
  const r = orNull(rating);
  return r === 'Alle' ? 'Tillatt for alle' : r;
}

export function normalize(snapshot: FilmwebSnapshot): Program {
  const movies = new Map(snapshot.movies.map((m) => [m.mainVersionId, m]));
  const films: Record<string, Film> = {};
  const cinemas = new Set<string>();
  const days: Record<string, Showing[]> = {};
  const seen = new Set<string>();

  for (const show of snapshot.shows) {
    if (!isFilm(show)) continue;

    const bookingUrl = orNull(show.ticketSaleUrl);
    const key =
      bookingUrl ?? [show.theaterName, show.screenName, show.showStart, show.movieVersionId].join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const filmId = show.movieMainVersionId;
    const movie = movies.get(filmId);
    films[filmId] ??= {
      id: filmId,
      title: show.movieTitle.trim(),
      minutes: show.lengthInMinutes || movie?.lengthInMinutes || null,
      ageRating: ageRating(show.rating) ?? ageRating(movie?.rating ?? null),
      posterUrl: orNull(movie?.sanityImagePosterUrl),
      pageUrl: FILMWEB_FILM_URL + filmId,
    };

    const slot = programSlot(show.showStart);
    cinemas.add(show.theaterName);
    (days[slot.day] ??= []).push({
      key,
      filmId,
      cinema: show.theaterName,
      screen: shortScreen(show.screenName ?? '', show.theaterName),
      day: slot.day,
      time: slot.time,
      minutes: slot.minutes,
      bookingUrl,
      tags: (show.versionTags ?? []).map((t) => t.tag).filter((tag) => tag !== '2D'),
    });
  }

  return sortProgram({ fetchedAt: snapshot.fetchedAt, films, cinemas: [...cinemas], days });
}

/** Sorts cinemas by name, days ascending and each day's showings by start time. */
export function sortProgram(program: Program): Program {
  const { films } = program;
  const days: Record<string, Showing[]> = {};
  for (const day of Object.keys(program.days).sort()) {
    days[day] = [...program.days[day]].sort(
      (a, b) =>
        a.minutes - b.minutes ||
        collator.compare(films[a.filmId].title, films[b.filmId].title) ||
        collator.compare(a.cinema, b.cinema),
    );
  }
  return { ...program, cinemas: [...program.cinemas].sort(collator.compare), days };
}

/** Combines programs from several sources into one. */
export function mergePrograms(first: Program, ...rest: Program[]): Program {
  const merged: Program = {
    fetchedAt: first.fetchedAt,
    films: { ...first.films },
    cinemas: [...first.cinemas],
    days: Object.fromEntries(Object.entries(first.days).map(([day, list]) => [day, [...list]])),
  };
  for (const program of rest) {
    Object.assign(merged.films, program.films);
    merged.cinemas.push(...program.cinemas.filter((c) => !merged.cinemas.includes(c)));
    for (const [day, list] of Object.entries(program.days)) {
      (merged.days[day] ??= []).push(...list);
    }
  }
  return sortProgram(merged);
}
