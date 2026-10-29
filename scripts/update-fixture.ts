// Refreshes the test fixtures with one live fetch per source: `pnpm fixture`
import { writeFile } from 'node:fs/promises';
import { fetchCinemateketFeed, parseFeed } from '../src/lib/cinemateket.ts';
import { fetchSnapshot } from '../src/lib/filmweb.ts';

const FILMWEB_FILE = 'tests/fixtures/filmweb-oslo.json';
const CINEMATEKET_FILE = 'tests/fixtures/cinemateket.ics';

const snapshot = await fetchSnapshot();
await writeFile(FILMWEB_FILE, JSON.stringify(snapshot));
console.log(`${FILMWEB_FILE}: ${snapshot.shows.length} shows, ${snapshot.movies.length} movies (${snapshot.fetchedAt})`);

const feed = await fetchCinemateketFeed();
await writeFile(CINEMATEKET_FILE, feed);
console.log(`${CINEMATEKET_FILE}: ${parseFeed(feed).length} screenings`);
