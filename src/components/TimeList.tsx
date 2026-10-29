import { useState } from 'react';
import type { Film } from '../lib/program.ts';
import { bookingHref, cx, groupBy, showingLabel, type ShowingView } from './showing.ts';
import styles from './TimeList.module.css';

interface Props {
  films: Record<string, Film>;
  showings: ShowingView[];
}

export default function TimeList({ films, showings }: Props) {
  const [showPast, setShowPast] = useState(false);
  const pastCount = showings.filter((s) => s.past).length;
  const visible = showPast ? showings : showings.filter((s) => !s.past);

  return (
    <div>
      {pastCount > 0 && (
        <button type="button" className={styles.pastToggle} aria-expanded={showPast} onClick={() => setShowPast(!showPast)}>
          {showPast ? 'Skjul tidligere' : `Vis tidligere (${pastCount})`}
        </button>
      )}
      {groupBy(visible, (s) => s.time.slice(0, 2)).map(([hour, list]) => (
        <section key={hour} className={styles.hour}>
          <h2 className={styles.hourLabel}>{hour}:00</h2>
          <div className={styles.rows}>
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
                  <span className={styles.text}>
                    <span className={styles.title}>{film.title}</span>
                    <span className={styles.where}>{s.screen ? `${s.cinema} · ${s.screen}` : s.cinema}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
