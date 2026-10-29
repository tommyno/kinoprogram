import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { FilmwebSnapshot, fetchSnapshot } from './filmweb.ts';
import { normalize, type Program } from './program.ts';
import { programNow } from './time.ts';
import { assertPlausible } from './validate.ts';

export const FIXTURE_FILE = 'tests/fixtures/filmweb-oslo.json';
const CACHE_FILE = '.cache/filmweb-oslo.json';
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

async function readSnapshot(file: string): Promise<FilmwebSnapshot> {
  return FilmwebSnapshot.parse(JSON.parse(await readFile(file, 'utf8')));
}

async function isFresh(file: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(file)).mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

export async function loadSnapshot(source: Source = resolveSource()): Promise<FilmwebSnapshot> {
  if (source === 'fixture') return readSnapshot(FIXTURE_FILE);

  // Repeated local live builds reuse an hour-old fetch; Vercel builds start without the cache.
  if (await isFresh(CACHE_FILE)) return readSnapshot(CACHE_FILE);
  const snapshot = await fetchSnapshot();
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(snapshot));
  return snapshot;
}

let program: Promise<Program> | undefined;

/** The validated program, loaded once per build however many pages ask for it. */
export function getProgram(): Promise<Program> {
  program ??= (async () => {
    const source = resolveSource();
    const snapshot = await loadSnapshot(source);
    const result = normalize(snapshot);
    // A fixture is checked against the day it was fetched, so it stays usable later
    const today = programNow(source === 'fixture' ? new Date(snapshot.fetchedAt) : new Date()).day;
    assertPlausible(result, today);
    return result;
  })();
  return program;
}
