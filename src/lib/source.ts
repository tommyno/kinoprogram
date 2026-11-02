import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { errorMessage } from './http.ts';
import { assertPlausible, mergePrograms, type Film, type Program, type Source } from './program.ts';
import { SOURCES } from './sources/index.ts';
import { localizePosters } from './posters.ts';
import { notifySlack } from './slack.ts';
import { programNow } from './time.ts';
import { fetchTmdb, type TmdbCache, type TmdbFilm } from './tmdb.ts';

const CACHE_DIR = '.cache';
const CACHE_TTL_MS = 60 * 60 * 1000;
// Unlike .cache, kept between Vercel builds, which restore node_modules. Bump the number when TmdbFilm changes
const TMDB_CACHE = 'node_modules/.cache/oslokinoprogram/tmdb-2.json';

async function isFresh(file: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(file)).mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Local dev and builds reuse an hour-old fetch; Vercel builds start without the cache. */
async function cachedText(name: string, fetchText: () => Promise<string>): Promise<string> {
  const file = `${CACHE_DIR}/${name}`;
  if (await isFresh(file)) return readFile(file, 'utf8');
  const text = await fetchText();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  return text;
}

/** A source's program. Only a required source can fail the build; any other is left out, and the site builds without it. */
async function loadSource(source: Source): Promise<Program | null> {
  try {
    return source.program(await cachedText(source.file, source.fetch));
  } catch (error) {
    await notifySlack(
      `${source.name} feilet${source.required ? ', så siden ble ikke bygget' : ' og er utelatt fra programmet'}: ${errorMessage(error)}`,
    );
    if (source.required) throw error;
    console.warn(`Hopper over ${source.name}: ${errorMessage(error)}`);
    return null;
  }
}

async function readTmdbCache(): Promise<TmdbCache> {
  try {
    return JSON.parse(await readFile(TMDB_CACHE, 'utf8'));
  } catch {
    return {};
  }
}

/** TMDB is a bonus too: without a token, or if it fails, the films go without a score and trailer. */
async function loadTmdb(films: Record<string, Film>): Promise<Record<string, TmdbFilm>> {
  // Astro reads .env into import.meta.env, and Vercel's variables too; the dev server leaves process.env without it
  const token = import.meta.env.TMDB_TOKEN;
  if (!token) {
    console.warn('Hopper over TMDB: TMDB_TOKEN mangler');
    return {};
  }
  try {
    const result = await fetchTmdb(films, token, await readTmdbCache());
    console.log(`TMDB: slo opp ${result.lookedUp} av ${Object.keys(result.cache).length} filmer, resten fra mellomlageret`);
    await mkdir(dirname(TMDB_CACHE), { recursive: true });
    await writeFile(TMDB_CACHE, JSON.stringify(result.cache));
    return result.films;
  } catch (error) {
    await notifySlack(`TMDB feilet, så filmene mangler score og trailer: ${errorMessage(error)}`);
    console.warn(`Hopper over TMDB: ${errorMessage(error)}`);
    return {};
  }
}

let program: Promise<Program> | undefined;

/** The validated program, loaded once per build however many pages ask for it. */
export function getProgram(): Promise<Program> {
  program ??= (async () => {
    const programs = await Promise.all(SOURCES.map(loadSource));
    const result = mergePrograms(programs.filter((p) => p !== null));
    assertPlausible(result, programNow().day);
    for (const [id, film] of Object.entries(await loadTmdb(result.films))) Object.assign(result.films[id], film);
    await localizePosters(result.films);
    return result;
  })();
  return program;
}
