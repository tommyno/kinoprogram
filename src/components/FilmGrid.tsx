import { useMemo, useState } from 'react';
import type { Film } from '../lib/program.ts';
import { formatDuration } from '../lib/time.ts';
import { bookingHref, collator, cx, groupBy, showingLabel, type ShowingView } from './showing.ts';
import styles from './FilmGrid.module.css';

const COLLAPSED_COUNT = 3;
const POSTER_WIDTHS = [200, 320, 480, 640];

interface Props {
  films: Record<string, Film>;
  showings: ShowingView[];
}

/** Filmweb posters live on Sanity's CDN, which resizes by query string. */
function posterSrc(url: string, width: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}w=${width}&auto=format`;
}

function Poster({ film }: { film: Film }) {
  if (!film.posterUrl) {
    return (
      <div className={cx(styles.poster, styles.placeholder)}>
        <svg viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0L100 150M100 0L0 150" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  return (
    <img
      className={styles.poster}
      src={posterSrc(film.posterUrl, 320)}
      srcSet={POSTER_WIDTHS.map((w) => `${posterSrc(film.posterUrl!, w)} ${w}w`).join(', ')}
      sizes="(min-width: 1000px) 200px, 45vw"
      width={400}
      height={600}
      loading="lazy"
      alt=""
    />
  );
}

function FilmCard({ film, showings }: { film: Film; showings: ShowingView[] }) {
  const [open, setOpen] = useState(false);
  const upcoming = showings.filter((s) => !s.past);
  // Collapsed: the next few; once all have started, the last few
  const shown = upcoming.length ? upcoming.slice(0, COLLAPSED_COUNT) : showings.slice(-COLLAPSED_COUNT);
  const more = showings.length - shown.length;
  const meta = [formatDuration(film.minutes), film.ageRating].filter(Boolean).join(' · ');

  return (
    <article className={styles.card}>
      <a href={film.filmwebUrl} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true">
        <Poster film={film} />
      </a>
      <div className={styles.heading}>
        <h2 className={styles.title}>
          <a href={film.filmwebUrl} target="_blank" rel="noopener">
            {film.title}
          </a>
        </h2>
        {meta && <p className={styles.meta}>{meta}</p>}
      </div>

      {open ? (
        <div className={styles.cinemas}>
          {groupBy(showings, (s) => s.cinema)
            .sort(([a], [b]) => collator.compare(a, b))
            .map(([cinema, list]) => (
              <div key={cinema} className={styles.cinema}>
                <span className={styles.cinemaName}>{cinema}</span>
                <div className={styles.chips}>
                  {list.map((s) => (
                    <a
                      key={s.key}
                      href={bookingHref(s, film)}
                      target="_blank"
                      rel="noopener"
                      aria-label={showingLabel(s, film)}
                      title={s.screen || undefined}
                      className={cx(styles.chip, s.past && styles.past)}
                    >
                      {s.time}
                    </a>
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className={styles.next}>
          {shown.map((s) => (
            <a
              key={s.key}
              href={bookingHref(s, film)}
              target="_blank"
              rel="noopener"
              aria-label={showingLabel(s, film)}
              className={cx(styles.row, s.past && styles.past)}
            >
              <span className={styles.time}>{s.time}</span>
              <span className={styles.where}>{s.cinema}</span>
            </a>
          ))}
        </div>
      )}

      {more > 0 && (
        <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Vis færre' : `+ ${more} ${more === 1 ? 'tid' : 'tider'} til`}
        </button>
      )}
    </article>
  );
}

export default function FilmGrid({ films, showings }: Props) {
  const groups = useMemo(
    () =>
      groupBy(showings, (s) => s.filmId).sort(([a], [b]) => collator.compare(films[a].title, films[b].title)),
    [films, showings],
  );

  return (
    <section aria-label="Filmer" className={styles.grid}>
      {groups.map(([filmId, list]) => (
        <FilmCard key={filmId} film={films[filmId]} showings={list} />
      ))}
    </section>
  );
}
