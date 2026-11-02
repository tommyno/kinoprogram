import { collator, slugify, type Program } from './program.ts';
import { CINEMA as CINEMA_NEUF } from './sources/cinemaneuf.ts';
import { CINEMA as CINEMATEKET } from './sources/cinemateket.ts';
import { CINEMA as DEICHMAN } from './sources/deichman.ts';
import { CINEMA as OSLO_FILMRULLKLUBB } from './sources/oslofilmrullklubb.ts';
import { CINEMA as REVIER } from './sources/revier.ts';

/** A cinema with its own page on this site, /kino/{slug}. */
export type Cinema = {
  /** As the sources name it: "Deichman Bjørvika". */
  name: string;
  /** The cinema's own site. */
  url: string;
  /** "Anne-Cath. Vestlys plass 1, 0150 Oslo". */
  address: string;
  /** A line or two for its page, such as that it is a film club. */
  about?: string;
};

// Every cinema the sources cover, A–Å. One that turns up in the program without being listed here still gets a page, with only its name
export const CINEMAS: Cinema[] = [
  {
    name: CINEMA_NEUF,
    url: 'https://cinemaneuf.no',
    address: 'Slemdalsveien 15, 0369 Oslo',
    about: 'Studentfilmklubb på Chateau Neuf.',
  },
  { name: CINEMATEKET, url: 'https://www.cinemateket.no', address: 'Dronningens gate 16, 0152 Oslo' },
  { name: 'Colosseum', url: 'https://www.nfkino.no/kino/colosseum', address: 'Fridtjof Nansens vei 6, 0369 Oslo' },
  {
    name: DEICHMAN,
    url: 'https://deichman.no/bibliotekene/bj%C3%B8rvika',
    address: 'Anne-Cath. Vestlys plass 1, 0150 Oslo',
    about: 'Filmvisninger på hovedbiblioteket. Gratis, men billett må bestilles.',
  },
  { name: 'Gimle', url: 'https://www.nfkino.no/kino/gimle', address: 'Bygdøy allé 39, 0265 Oslo' },
  { name: 'Klingenberg', url: 'https://www.nfkino.no/kino/klingenberg', address: 'Olav Vs gate 4, 0161 Oslo' },
  { name: 'Kunstnernes Hus Kino', url: 'https://kunstnerneshus.no/program/kino', address: 'Wergelandsveien 17, 0167 Oslo' },
  { name: 'ODEON Oslo', url: 'https://www.odeonkino.no/oslo/kino/odeon-oslo/', address: 'Vitaminveien 27, 0485 Oslo' },
  {
    name: OSLO_FILMRULLKLUBB,
    url: 'https://www.oslofilmrullklubb.no',
    address: 'Youngs gate 6, 0181 Oslo',
    about: 'Analog filmklubb i Laben på Kulturhuset. Medlemskap i Norsk Filmklubbforbund og billett ordnes i døra.',
  },
  {
    name: REVIER,
    url: 'https://www.revier.no/events/filmklubb',
    address: 'Kongens gate 5, 0153 Oslo',
    about: 'Filmklubb på hotellet Revier. Gratis visninger.',
  },
  { name: 'Ringen', url: 'https://www.nfkino.no/kino/ringen', address: 'Sannergata 6D, 0557 Oslo' },
  { name: 'Saga', url: 'https://www.nfkino.no/kino/saga', address: 'Stortingsgata 28, 0161 Oslo' },
  { name: 'Symra', url: 'https://www.nfkino.no/kino/symra', address: 'Cecilie Thoresens vei 23, 1153 Oslo' },
  { name: 'Vega Kino', url: 'https://www.vegascene.no', address: 'Hausmanns gate 28, 0182 Oslo' },
  { name: 'Vika', url: 'https://www.nfkino.no/kino/vika', address: 'Ruseløkkveien 14, 0251 Oslo' },
];

/** The cinema's own page on this site. */
export function cinemaPath(name: string): string {
  return `/kino/${slugify(name)}`;
}

/** Every listed cinema and any other in the program, A–Å. */
export function cinemaNames(program: Program): string[] {
  const names = new Set(CINEMAS.map((c) => c.name));
  for (const list of Object.values(program.days)) for (const s of list) names.add(s.cinema);
  return [...names].sort((a, b) => collator.compare(a, b));
}

/** The cinemas with no showings on the given day, each with the next day it has some, A–Å. */
export function nextCinemaDays(program: Program, day: string): { cinema: string; day: string }[] {
  const showing = new Set(program.days[day]?.map((s) => s.cinema));
  const next = new Map<string, string>();
  // The days are in order, so the first one found is the next
  for (const [later, list] of Object.entries(program.days)) {
    if (later <= day) continue;
    for (const s of list) if (!showing.has(s.cinema) && !next.has(s.cinema)) next.set(s.cinema, later);
  }
  return [...next]
    .map(([cinema, day]) => ({ cinema, day }))
    .sort((a, b) => collator.compare(a.cinema, b.cinema));
}
