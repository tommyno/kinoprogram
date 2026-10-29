import type { Film } from '../lib/program.ts';
import { bookingHref, collator, cx, groupBy, showingLabel, type ShowingView } from './showing.ts';
import styles from './CinemaColumns.module.css';

interface Props {
  films: Record<string, Film>;
  showings: ShowingView[];
}

export default function CinemaColumns({ films, showings }: Props) {
  const cinemas = groupBy(showings, (s) => s.cinema).sort(([a], [b]) => collator.compare(a, b));

  return (
    <div className={styles.columns}>
      {cinemas.map(([cinema, list]) => (
        <section key={cinema} className={styles.cinema}>
          <h2 className={styles.name}>
            {cinema}
            <span className={styles.count}>{list.length} visninger</span>
          </h2>
          {list.map((s) => {
            const film = films[s.filmId];
            return (
              <a
                key={s.key}
                href={bookingHref(s, film)}
                target="_blank"
                rel="noopener"
                aria-label={showingLabel(s, film)}
                className={cx(styles.row, s.past && styles.past)}
              >
                <span className={styles.time}>{s.time}</span>
                <span className={styles.title}>{film.title}</span>
                <span className={styles.screen}>{s.screen}</span>
              </a>
            );
          })}
        </section>
      ))}
    </div>
  );
}
