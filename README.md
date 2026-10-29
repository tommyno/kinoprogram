# Oslo kinoprogram

Every cinema in Oslo and what's showing, on one page. A static Astro site that is rebuilt on a schedule; the program is fetched from Filmweb and Cinemateket at build time.

## Commands

| Command | What it does |
| :-- | :-- |
| `pnpm dev` | Dev server on `localhost:3000` with live data (cached for an hour) |
| `pnpm dev:fixture` | Dev server using the fixtures, no requests to the sources |
| `pnpm build` | Builds to `dist/` |
| `pnpm test` | Runs the tests (vitest) |
| `pnpm check` | Type check (astro check) |
| `pnpm fixture` | Fetches a fresh program from both sources into `tests/fixtures/` |
| `pnpm icons` | Generates `favicon.ico`, `apple-touch-icon.png` and the share image `og.png` from `public/favicon.svg` |

## Deployment

- Vercel builds and publishes on every push to `main`. No environment variables are needed (`VERCEL=1` switches to live data).
- [`.github/workflows/rebuild.yml`](.github/workflows/rebuild.yml) rebuilds the site every hour through a Vercel deploy hook, so the program stays fresh and "i dag" (today) moves to the new date just after midnight.
  - Setup: Vercel → Settings → Git → Deploy Hooks → create a hook for `main`, and add its URL as the GitHub secret `VERCEL_DEPLOY_HOOK`.
  - It can also be run by hand from the Actions tab (Run workflow).

## Data

- Sources: Filmweb's GraphQL API (`movieinfoqs.filmweb.no/graphql`, two requests per build) for ten cinemas, and Cinemateket's calendar feed (`cinemateket.no/cinemateket-webcal.ics`, one request, about three weeks ahead). If Cinemateket fails, the site builds without it.
- `PROGRAM_SOURCE=live|fixture` controls where the data comes from. The default is `live` on Vercel/CI and in `pnpm dev`, otherwise `fixture` (tests and local builds).
- Local live builds cache the responses in `.cache/` for an hour.
- If there are no showings today, the build fails and the previous deploy stays up.

```
src/lib/program.ts      the data model (films and showings per day) and merging the sources
src/lib/filmweb.ts      Filmweb: GraphQL client, schema and normalization
src/lib/cinemateket.ts  Cinemateket: iCal parser and normalization
src/lib/time.ts         Oslo time, started showings, date labels
src/lib/source.ts       picks live/fixture, loads the sources and checks there are showings today
```
