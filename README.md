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
