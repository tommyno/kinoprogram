import { getImage } from 'astro:assets';
import type { Film } from './program.ts';

// Posters are downloaded at build and served from the site, so visitors don't load them from Filmweb's and TMDB's image
// hosts. Astro keeps the copies in node_modules/.astro between builds for as long as the hosts allow, a year for both
const SMALL_WIDTH = 480;
// Enough for a phone's full width on a sharp screen; Filmweb's originals go to 1500 and some weigh over a megabyte
const LARGE_WIDTH = 1200;

/** A WebP copy of the poster at the width. The size is given, since Astro would otherwise download it on every build to find it. */
async function copy(url: string, size: NonNullable<Film['posterSize']>, width: number): Promise<string> {
  const height = Math.round((width * size.height) / size.width);
  return (await getImage({ src: url, width, height, format: 'webp' })).src;
}

/** Replaces each source poster with a small copy for the lists, and adds a large one for the film page. */
export async function localizePosters(films: Record<string, Film>): Promise<void> {
  await Promise.all(
    Object.values(films).map(async (film) => {
      const { posterUrl, posterSize } = film;
      if (!posterUrl || !posterSize) return;
      film.posterUrl = await copy(posterUrl, posterSize, Math.min(SMALL_WIDTH, posterSize.width));
      if (posterSize.width > SMALL_WIDTH) {
        const width = Math.min(LARGE_WIDTH, posterSize.width);
        const large = await copy(posterUrl, posterSize, width);
        film.posterLarge = { srcSet: `${film.posterUrl} ${SMALL_WIDTH}w, ${large} ${width}w`, width };
      }
    }),
  );
}
