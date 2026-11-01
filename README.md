# Kinoprogram for Oslo

**→ [kinoprogram.vercel.app](https://kinoprogram.vercel.app)**

Every cinema in Oslo and what's showing, on one page, without ads or bloat.

[![Kinoprogram for Oslo](.github/screenshot.png)](https://kinoprogram.vercel.app)

## Development

A static Astro site that is rebuilt on a schedule; the program is fetched from Filmweb and Cinemateket at build time.

| Command        | What it does                                                                                           |
| :------------- | :----------------------------------------------------------------------------------------------------- |
| `pnpm dev`     | Dev server on `localhost:3000` with live data (cached for an hour)                                     |
| `pnpm build`   | Runs the tests, then builds to `dist/`                                                                 |
| `pnpm test`    | Runs the tests (vitest)                                                                                |
| `pnpm check`   | Type check (astro check)                                                                               |
| `pnpm fixture` | Refreshes the test data in `tests/fixtures/` from both sources                                         |
| `pnpm icons`   | Generates `favicon.ico`, `apple-touch-icon.png`, the app icons `icon-*.png` and the share image `og.png` from `public/favicon.svg` |

## Deployment

- Vercel builds and publishes on every push to `main`. The one environment variable, `TMDB_TOKEN` (the API read access token from [themoviedb.org](https://www.themoviedb.org/settings/api)), adds scores and trailers to the film pages; without it the site builds as before. Locally it goes in `.env`.
- [`.github/workflows/rebuild.yml`](.github/workflows/rebuild.yml) rebuilds the site every six hours through a Vercel deploy hook, so the program stays fresh.
- "i dag" (today) doesn't wait for a build: after midnight `/` sends the visitor on to today's own page, and the pages label their days again in the browser. A failed build only leaves the data a little older.

## Data

- Sources: Filmweb's GraphQL API (`movieinfoqs.filmweb.no/graphql`, two requests per build) for ten cinemas, and Cinemateket's calendar feed (`cinemateket.no/cinemateket-webcal.ics`, one request, about three weeks ahead). If Cinemateket fails, the site builds without it.
- TMDB (`api.themoviedb.org`, about two requests per film) gives the film pages a user score and a YouTube trailer. Filmweb films are searched by original title, then Norwegian title; the most popular result with the same title, first released within a year of the production year (or the year in a title like "Zodiac (2007)", or the premiere year), counts. Scores need at least 20 votes. Cinemateket's feed has no year, so its films aren't looked up. If TMDB fails, the site builds without it. TMDB's terms require the credit and notice in the footer.
- `pnpm dev`, `pnpm build` and Vercel all fetch live data. Locally the responses are cached in `.cache/` for an hour.
- The tests run on saved copies of real responses in `tests/fixtures/` (refresh them with `pnpm fixture`). `pnpm build` runs the tests first, so a failing test stops the deploy.
- A failed request to either source is tried again twice. If there are no showings today, the build fails and the previous deploy stays up.

```
src/lib/program.ts      the data model (films and showings per day) and merging the sources
src/lib/filmweb.ts      Filmweb: GraphQL client, schema and normalization
src/lib/cinemateket.ts  Cinemateket: iCal parser and normalization
src/lib/tmdb.ts         TMDB: search by title and year, score and trailer
src/lib/time.ts         Oslo time, started showings, date labels
src/lib/source.ts       loads the sources (cached locally for an hour) and checks there are showings today
```
