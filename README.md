# Kinoprogram for Oslo

**→ [kinoprogram.vercel.app](https://kinoprogram.vercel.app)**

Every cinema in Oslo and what's showing, on one page.

[![Kinoprogram for Oslo](.github/screenshot.png)](https://kinoprogram.vercel.app)

## Development

A static Astro site that is rebuilt several times a day with the latest program. The data is fetched when the site is built, not when a page loads, to limit traffic to the data sources. So are the posters, which the site serves itself; Astro keeps them between builds in `node_modules/.astro`.

Each source is a file in `src/lib/sources`, listed in `src/lib/sources/index.ts`. `pnpm fixture` saves a fresh response from each of them in `tests/fixtures`.

## Data

The website is built from publicly available data:

- **Filmweb** (`movieinfoqs.filmweb.no/graphql`): showings with times and ticket links, and for each film the poster, synopsis, length, age rating and production year.
- **Cinemateket** (`cinemateket.no/cinemateket-webcal.ics`): showings with times, screen, description and a link to the event.
- **Cinema Neuf** (`cinemaneuf.no/semesters/…/Program_….tsv`): the student film club's semester program, with times, year, length and a link to the program page.
- **Deichman** (`deichman.hoopla.no/api/public/v3.0/organizations/915950447/events`): the library's film screenings at Bjørvika, with times, screen and a link to the free tickets.
- **Revier** (`eventbrite.com/o/revier-117564493841`): Revier Film Club's free screenings, read from the organizer page on Eventbrite, with times and a link to each event.
- **Oslo Filmrullklubb** (`oslofilmrullklubb.no/feed/`): the analog film club's screenings at Kulturhuset, read from the posts in its RSS feed, with times, year, description and a link to each post.
- **Sommerro** (`sommerrohouse.com/kultur/filmopplevelser/`): the hotel's film evenings, read from its film page, with times (when the dinner, brunch or tea package starts), year, description and a link to each series' booking page.
- **TMDB** (`api.themoviedb.org`): user scores, trailers, directors and cast for the film pages, and posters for films whose source has none, such as Cinemateket's.
