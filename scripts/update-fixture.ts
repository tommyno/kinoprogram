// Refreshes the test fixtures with one live fetch per source: `pnpm fixture`
import { writeFile } from 'node:fs/promises';
import { SOURCES } from '../src/lib/sources/index.ts';

for (const source of SOURCES) {
  const file = `tests/fixtures/${source.file}`;
  const raw = await source.fetch();
  await writeFile(file, raw);
  const program = source.program(raw);
  const showings = Object.values(program.days).flat().length;
  console.log(`${file}: ${Object.keys(program.films).length} films, ${showings} showings`);
}
