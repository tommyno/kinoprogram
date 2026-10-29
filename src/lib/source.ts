import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cinemateketProgram, fetchCinemateketFeed, parseFeed } from './cinemateket.ts';
import { FilmwebSnapshot, fetchSnapshot } from './filmweb.ts';
import { mergePrograms, normalize, type Program } from './program.ts';
import { programNow } from './time.ts';
import { assertPlausible } from './validate.ts';

export const FIXTURE_FILE = 'tests/fixtures/filmweb-oslo.json';
export const CINEMATEKET_FIXTURE_FILE = 'tests/fixtures/cinemateket.ics';
const CACHE_DIR = '.cache';
const CACHE_TTL_MS = 60 * 60 * 1000;

export type Source = 'live' | 'fixture';

/**
 * Where the build gets its data. Vercel and CI fetch live; local dev and builds use the
 * fixture so working on the site never sends requests to Filmweb. Override with
 * FILMWEB_SOURCE=live|fixture.
 */
export function resolveSource(env: Record<string, string | undefined> = process.env): Source {
  if (env.FILMWEB_SOURCE === 'live' || env.FILMWEB_SOURCE === 'fixture') return env.FILMWEB_SOURCE;
  return env.VERCEL || env.CI ? 'live' : 'fixture';
}

async function isFresh(file: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(file)).mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

/** Repeated local live builds reuse an hour-old fetch; Vercel builds start without the cache. */
async function cachedText(name: string, fetchText: () => Promise<string>): Promise<string> {
  const file = `${CACHE_DIR}/${name}`;
  if (await isFresh(file)) return readFile(file, 'utf8');
  const text = await fetchText();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  return text;
}

export async function loadSnapshot(source: Source = resolveSource()): Promise<FilmwebSnapshot> {
  const text =
    source === 'fixture'
      ? await readFile(FIXTURE_FILE, 'utf8')
      : await cachedText('filmweb-oslo.json', async () => JSON.stringify(await fetchSnapshot()));
  return FilmwebSnapshot.parse(JSON.parse(text));
}

export async function loadCinemateketFeed(source: Source = resolveSource()): Promise<string> {
  return source === 'fixture'
    ? readFile(CINEMATEKET_FIXTURE_FILE, 'utf8')
    : cachedText('cinemateket.ics', fetchCinemateketFeed);
}

/** Cinemateket is a bonus: if its feed fails, the site still builds from Filmweb alone. */
async function loadCinemateket(source: Source, fetchedAt: string): Promise<Program | null> {
  try {
    return cinemateketProgram(parseFeed(await loadCinemateketFeed(source)), fetchedAt);
  } catch (error) {
    console.warn(`Hopper over Cinemateket: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

let program: Promise<Program> | undefined;

/** The validated program, loaded once per build however many pages ask for it. */
export function getProgram(): Promise<Program> {
  program ??= (async () => {
    const source = resolveSource();
    const snapshot = await loadSnapshot(source);
    const cinemateket = await loadCinemateket(source, snapshot.fetchedAt);
    const filmweb = normalize(snapshot);
    const result = cinemateket ? mergePrograms(filmweb, cinemateket) : filmweb;
    // A fixture is checked against the day it was fetched, so it stays usable later
    const today = programNow(source === 'fixture' ? new Date(snapshot.fetchedAt) : new Date()).day;
    assertPlausible(result, today);
    return result;
  })();
  return program;
}
