// Refreshes the test/dev fixture with one live fetch: `npm run fixture`
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchSnapshot } from '../src/lib/filmweb.ts';
import { FIXTURE_FILE } from '../src/lib/source.ts';

const snapshot = await fetchSnapshot();
await mkdir(dirname(FIXTURE_FILE), { recursive: true });
await writeFile(FIXTURE_FILE, JSON.stringify(snapshot));
console.log(`${FIXTURE_FILE}: ${snapshot.shows.length} shows, ${snapshot.movies.length} movies (${snapshot.fetchedAt})`);
