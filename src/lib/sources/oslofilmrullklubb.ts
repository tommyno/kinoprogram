import { fetchOk } from '../http.ts';
import { slugify, type Film, type Program, type Showing, type Source } from '../program.ts';
import { osloDateTime, programSlot } from '../time.ts';

// Oslo Filmrullklubb: analog screenings in Laben at Kulturhuset, about once a month. Each screening is a post on the
// club's WordPress site, and the feed holds the latest ten.
const NAME = 'Oslo Filmrullklubb';
const SITE = 'https://www.oslofilmrullklubb.no';
const FEED_URL = `${SITE}/feed/`;
export const CINEMA = NAME;
// "The Executioner’s Song (1982) tirsdag 10. november"
const TITLE = /^(.+?)\s*\((\d{4})\)\s+(?:\p{L}+dag\s+)?(\d{1,2})\.\s*(\p{L}+)$/u;
const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
// "Filmstart litt etter 19", "Første film starter presis kl. 19"
const START = /film\s*start\w*\D*?(\d{1,2})(?:[:.]?(\d{2}))?/i;

export type FilmrullPost = {
  title: string;
  link: string;
  /** When it was posted, "Sat, 31 Oct 2026 12:41:31 +0000". */
  pubDate: string;
  /** The post's text as HTML. */
  content: string;
};

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function field(item: string, name: string): string {
  const value = item.match(new RegExp(`<${name}>(.*?)</${name}>`, 's'))?.[1] ?? '';
  return value.replace(/^<!\[CDATA\[(.*)\]\]>$/s, '$1').trim();
}

export function parseFeed(xml: string): FilmrullPost[] {
  return [...xml.matchAll(/<item>(.*?)<\/item>/gs)].map(([, item]) => ({
    title: decode(field(item, 'title')),
    link: field(item, 'link'),
    pubDate: field(item, 'pubDate'),
    content: field(item, 'content:encoded'),
  }));
}

/** The post's paragraphs as plain text. */
function paragraphs(html: string): string[] {
  return [...html.matchAll(/<p[^>]*>(.*?)<\/p>/gs)].map(([, p]) => decode(p.replace(/<[^>]+>/g, '')).trim());
}

/**
 * The film and start of a post titled "Tittel (år) [ukedag] dato". The title has no year, so it is the first such date
 * after the post was published. Any other post, such as a party with no film named yet, is left out.
 */
export function parsePost(post: FilmrullPost): { title: string; year: number; start: string; synopsis: string } | null {
  const m = post.title.match(TITLE);
  const month = MONTHS.indexOf(m?.[4].toLowerCase() ?? '');
  if (!m || month < 0) return null;
  const published = osloDateTime(new Date(post.pubDate));
  const day = m[3].padStart(2, '0');
  const mm = String(month + 1).padStart(2, '0');
  let year = Number(published.slice(0, 4));
  if (`${mm}-${day}` < published.slice(5, 10)) year++;
  const text = paragraphs(post.content);
  const start = text.join('\n').match(START);
  const time = `${(start?.[1] ?? '19').padStart(2, '0')}:${start?.[2] ?? '00'}`;
  return { title: m[1], year: Number(m[2]), start: `${year}-${mm}-${day}T${time}:00`, synopsis: text[0] ?? '' };
}

export function filmrullProgram(posts: FilmrullPost[]): Program {
  const films: Record<string, Film> = {};
  const days: Record<string, Showing[]> = {};

  for (const post of posts) {
    const screening = parsePost(post);
    if (!screening) continue;
    const filmId = `OSLOFILMRULLKLUBB:${slugify(screening.title)}`;
    films[filmId] ??= {
      title: screening.title,
      originalTitle: null,
      year: screening.year,
      // Like Cinemateket's, so a film Filmweb also lists keeps its own page
      slug: `oslo-filmrullklubb-${slugify(screening.title)}`,
      minutes: null,
      ageRating: null,
      synopsis: screening.synopsis || null,
      // The posts have no posters, so the film gets TMDB's or none
      posterUrl: null,
      pageUrl: post.link,
      source: NAME,
    };
    const slot = programSlot(screening.start);
    (days[slot.day] ??= []).push({
      key: post.link,
      filmId,
      cinema: CINEMA,
      // One room, Laben
      screen: '',
      ...slot,
      // Tickets are sold at the door
      bookingUrl: post.link,
    });
  }

  return { films, days };
}

export const osloFilmrullklubb: Source = {
  name: NAME,
  homepage: SITE,
  file: 'oslofilmrullklubb.xml',
  fetch: async () => (await fetchOk(NAME, FEED_URL)).text(),
  program: (raw) => filmrullProgram(parseFeed(raw)),
};
