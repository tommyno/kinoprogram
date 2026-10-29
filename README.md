# Oslo kinoprogram

Kinoprogrammet for alle kinoene i Oslo på én side. Statisk Astro-side som bygges på nytt med jevne mellomrom; dataene hentes fra Filmweb når siden bygges.

## Kommandoer

| Kommando | Hva den gjør |
| :-- | :-- |
| `npm run dev` | Utviklingsserver på `localhost:4321` (bruker fixture, ingen kall til Filmweb) |
| `npm run build` | Bygger til `dist/` |
| `npm test` | Kjører testene (vitest) |
| `npm run check` | Typesjekk (astro check) |
| `npm run fixture` | Henter ferskt program fra Filmweb til `tests/fixtures/filmweb-oslo.json` |

## Data

- Kilde: Filmwebs GraphQL-API (`movieinfoqs.filmweb.no/graphql`), to kall per bygg.
- `FILMWEB_SOURCE=live|fixture` styrer hvor dataene kommer fra. Standard er `live` på Vercel/CI og `fixture` lokalt.
- Lokale live-bygg cacher svaret i `.cache/` i én time.
- Finnes det ingen visninger i dag, feiler bygget, og forrige versjon blir liggende.

```
src/lib/filmweb.ts    GraphQL-klient og skjema for rådata
src/lib/program.ts    normalisering: filmer, visninger per dag, salnavn
src/lib/time.ts       Oslo-tid, passerte visninger, datotekster
src/lib/validate.ts   kontroller før bygget slipper gjennom
src/lib/source.ts     velger live/fixture og laster programmet én gang per bygg
```
