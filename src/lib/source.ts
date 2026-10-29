import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cinemateketProgram, fetchCinemateketFeed, parseFeed } from './cinemateket.ts';
import { FilmwebSnapshot, fetchSnapshot, filmwebProgram } from './filmweb.ts';
import { mergePrograms, type Program } from './program.ts';
import { programNow } from './time.ts';

export const FIXTURE_FILE = 'tests/fixtures/filmweb-oslo.json';
export const CINEMATEKET_FIXTURE_FILE = 'tests/fixtures/cinemateket.ics';
const CACHE_DIR = '.cache';
const CACHE_TTL_MS = 60 * 60 * 1000;

export type Source = 'live' | 'fixture';

/**
 * Where the build gets its data. Vercel, CI and `pnpm dev` fetch live; tests and local builds
 * use the fixtures, so they never send requests. Override with PROGRAM_SOURCE=live|fixture.
 */
export function resolveSource(env: Record<string, string | undefined> = process.env): Source {
  if (env.PROGRAM_SOURCE === 'live' || env.PROGRAM_SOURCE === 'fixture') return env.PROGRAM_SOURCE;
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

export async function loadSnapshot(source: Source): Promise<FilmwebSnapshot> {
  const text =
    source === 'fixture'
      ? await readFile(FIXTURE_FILE, 'utf8')
      : await cachedText('filmweb-oslo.json', async () => JSON.stringify(await fetchSnapshot()));
  return FilmwebSnapshot.parse(JSON.parse(text));
}

/** Cinemateket is a bonus: if its feed fails, the site still builds from Filmweb alone. */
async function loadCinemateket(source: Source): Promise<Program | null> {
  try {
    const feed =
      source === 'fixture'
        ? await readFile(CINEMATEKET_FIXTURE_FILE, 'utf8')
        : await cachedText('cinemateket.ics', fetchCinemateketFeed);
    return cinemateketProgram(parseFeed(feed));
  } catch (error) {
    console.warn(`Hopper over Cinemateket: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/** Throws when there is nothing to show today, so the build fails and Vercel keeps the previous deploy. */
export function assertPlausible(program: Program, today: string): void {
  if (!program.days[today]?.length) {
    throw new Error(`Programdataene ser feil ut: ingen visninger ${today}.`);
  }
}

let program: Promise<Program> | undefined;

/** The validated program, loaded once per build however many pages ask for it. */
export function getProgram(): Promise<Program> {
  program ??= (async () => {
    const source = resolveSource();
    const [snapshot, cinemateket] = await Promise.all([loadSnapshot(source), loadCinemateket(source)]);
    const result = mergePrograms(cinemateket ? [filmwebProgram(snapshot), cinemateket] : [filmwebProgram(snapshot)]);
    // A fixture is checked against the day it was fetched, so it stays usable later
    const today = programNow(source === 'fixture' ? new Date(snapshot.fetchedAt) : new Date()).day;
    assertPlausible(result, today);
    return result;
  })();
  return program;
}
