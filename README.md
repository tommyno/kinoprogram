# Kinoprogram for Oslo

**→ [kinoprogram.vercel.app](https://kinoprogram.vercel.app)**

Every cinema in Oslo and what's showing, on one page, without ads or bloat.

A static Astro site that is rebuilt on a schedule; the program is fetched from Filmweb and Cinemateket at build time.

## Commands

| Command        | What it does                                                                                           |
| :------------- | :----------------------------------------------------------------------------------------------------- |
| `pnpm dev`     | Dev server on `localhost:3000` with live data (cached for an hour)                                     |
| `pnpm build`   | Runs the tests, then builds to `dist/`                                                                 |
| `pnpm test`    | Runs the tests (vitest)                                                                                |
| `pnpm check`   | Type check (astro check)                                                                               |
| `pnpm fixture` | Refreshes the test data in `tests/fixtures/` from both sources                                         |
| `pnpm icons`   | Generates `favicon.ico`, `apple-touch-icon.png`, the app icons `icon-*.png` and the share image `og.png` from `public/favicon.svg` |

## Deployment

- Vercel builds and publishes on every push to `main`. No environment variables are needed.
- [`.github/workflows/rebuild.yml`](.github/workflows/rebuild.yml) rebuilds the site every six hours through a Vercel deploy hook, so the program stays fresh and "i dag" (today) moves to the new date after midnight.

## Data

- Sources: Filmweb's GraphQL API (`movieinfoqs.filmweb.no/graphql`, two requests per build) for ten cinemas, and Cinemateket's calendar feed (`cinemateket.no/cinemateket-webcal.ics`, one request, about three weeks ahead). If Cinemateket fails, the site builds without it.
- `pnpm dev`, `pnpm build` and Vercel all fetch live data. Locally the responses are cached in `.cache/` for an hour.
- The tests run on saved copies of real responses in `tests/fixtures/` (refresh them with `pnpm fixture`). `pnpm build` runs the tests first, so a failing test stops the deploy.
- If there are no showings today, the build fails and the previous deploy stays up.

```
src/lib/program.ts      the data model (films and showings per day) and merging the sources
src/lib/filmweb.ts      Filmweb: GraphQL client, schema and normalization
src/lib/cinemateket.ts  Cinemateket: iCal parser and normalization
src/lib/time.ts         Oslo time, started showings, date labels
src/lib/source.ts       loads the sources (cached locally for an hour) and checks there are showings today
```
