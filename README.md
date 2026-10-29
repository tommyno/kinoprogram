# Oslo kinoprogram

Kinoprogrammet for alle kinoene i Oslo på én side. Statisk Astro-side som bygges på nytt med jevne mellomrom; dataene hentes fra Filmweb når siden bygges.

## Kommandoer

| Kommando | Hva den gjør |
| :-- | :-- |
| `pnpm dev` | Utviklingsserver på `localhost:4321` med live data fra Filmweb (cachet i én time) |
| `pnpm dev:fixture` | Utviklingsserver med fixture, ingen kall til Filmweb |
| `pnpm build` | Bygger til `dist/` |
| `pnpm test` | Kjører testene (vitest) |
| `pnpm check` | Typesjekk (astro check) |
| `pnpm fixture` | Henter ferskt program fra Filmweb til `tests/fixtures/filmweb-oslo.json` |
| `pnpm icons` | Lager `favicon.ico`, `apple-touch-icon.png` og delingsbildet `og.png` fra `public/favicon.svg` |

## Drift

- Vercel bygger og publiserer ved hver push til `main`. Ingen miljøvariabler trengs (`VERCEL=1` gir live data).
- [`.github/workflows/rebuild.yml`](.github/workflows/rebuild.yml) bygger siden på nytt hver time via en Vercel deploy hook, så programmet holder seg ferskt og «i dag» bytter dato like etter midnatt.
  - Oppsett: Vercel → Settings → Git → Deploy Hooks → lag en hook for `main`, og legg URL-en inn som GitHub-secret `VERCEL_DEPLOY_HOOK`.
  - Kan også kjøres manuelt fra Actions-fanen (Run workflow).

## Data

- Kilder: Filmwebs GraphQL-API (`movieinfoqs.filmweb.no/graphql`, to kall per bygg) for ti kinoer, og Cinematekets kalenderfeed (`cinemateket.no/cinemateket-webcal.ics`, ett kall, ca. tre uker frem). Feiler Cinemateket, bygges siden uten.
- `FILMWEB_SOURCE=live|fixture` styrer hvor dataene kommer fra. Standard er `live` på Vercel/CI og i `pnpm dev`, ellers `fixture` (tester og lokale bygg).
- Lokale live-bygg cacher svaret i `.cache/` i én time.
- Finnes det ingen visninger i dag, feiler bygget, og forrige versjon blir liggende.

```
src/lib/filmweb.ts    GraphQL-klient og skjema for rådata
src/lib/cinemateket.ts  iCal-parser for Cinemateket
src/lib/program.ts    normalisering: filmer, visninger per dag, salnavn, fletting av kilder
src/lib/time.ts       Oslo-tid, passerte visninger, datotekster
src/lib/validate.ts   kontroller før bygget slipper gjennom
src/lib/source.ts     velger live/fixture og laster programmet én gang per bygg
```
