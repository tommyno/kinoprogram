import { useState } from 'react';
import { collator, type Film } from '../../lib/program.ts';
import { formatDuration } from '../../lib/time.ts';
import { groupBy } from '../../lib/groupBy.ts';
import { ShowingLink, type ShowingView } from '../ShowingLink/ShowingLink.tsx';
import styles from './FilmGrid.module.css';

const COLLAPSED_COUNT = 3;

type Props = {
  films: Record<string, Film>;
  showings: ShowingView[];
};

function Poster({ film }: { film: Film }) {
  if (!film.posterUrl) {
    return (
      <div className={`${styles.poster} ${styles.placeholder}`}>
        <svg viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0L100 150M100 0L0 150" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }
  return (
    <img
      className={styles.poster}
      src={film.posterUrl}
      srcSet={film.posterSrcSet}
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
  // Collapsed: the next few; once all have started, the last few. Expanded: all, in time order
  const shown = upcoming.length ? upcoming.slice(0, COLLAPSED_COUNT) : showings.slice(-COLLAPSED_COUNT);
  const more = showings.length - shown.length;
  const meta = [formatDuration(film.minutes), film.ageRating].filter(Boolean).join(' · ');

  return (
    <article className={styles.card}>
      <a href={film.pageUrl} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true">
        <Poster film={film} />
      </a>
      <div className={styles.heading}>
        <h2 className={styles.title}>
          <a href={film.pageUrl} target="_blank" rel="noopener">
            {film.title}
          </a>
        </h2>
        {meta && <p className={styles.meta}>{meta}</p>}
      </div>

      <div className={styles.times}>
        {(open ? showings : shown).map((s) => (
          <ShowingLink key={s.key} showing={s} title={film.title} className={styles.row}>
            <span className={styles.time}>{s.time}</span>
            <span className={styles.where}>{s.cinema}</span>
          </ShowingLink>
        ))}
      </div>

      {more > 0 && (
        <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Vis færre' : `+ ${more} ${more === 1 ? 'tid' : 'tider'} til`}
        </button>
      )}
    </article>
  );
}

export default function FilmGrid({ films, showings }: Props) {
  const groups = groupBy(showings, (s) => s.filmId).sort(([a], [b]) =>
    collator.compare(films[a].title, films[b].title),
  );

  return (
    <section aria-label="Filmer" className={styles.grid}>
      {groups.map(([filmId, list]) => (
        <FilmCard key={filmId} film={films[filmId]} showings={list} />
      ))}
    </section>
  );
}
