// Refreshes the test/dev fixtures with one live fetch per source: `pnpm fixture`
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchCinemateketFeed, parseFeed } from '../src/lib/cinemateket.ts';
import { fetchSnapshot } from '../src/lib/filmweb.ts';
import { CINEMATEKET_FIXTURE_FILE, FIXTURE_FILE } from '../src/lib/source.ts';

const snapshot = await fetchSnapshot();
await mkdir(dirname(FIXTURE_FILE), { recursive: true });
await writeFile(FIXTURE_FILE, JSON.stringify(snapshot));
console.log(`${FIXTURE_FILE}: ${snapshot.shows.length} shows, ${snapshot.movies.length} movies (${snapshot.fetchedAt})`);

const feed = await fetchCinemateketFeed();
await writeFile(CINEMATEKET_FIXTURE_FILE, feed);
console.log(`${CINEMATEKET_FIXTURE_FILE}: ${parseFeed(feed).length} screenings`);
