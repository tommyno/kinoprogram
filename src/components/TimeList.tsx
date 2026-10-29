import { useState } from 'react';
import type { Film } from '../lib/program.ts';
import { groupBy, ShowingLink, type ShowingView } from './showing.tsx';
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
            {list.map((s) => (
              <ShowingLink key={s.key} showing={s} title={films[s.filmId].title} className={styles.row}>
                <span className={styles.time}>{s.time}</span>
                <span className={styles.text}>
                  <span className={styles.title}>{films[s.filmId].title}</span>
                  <span className={styles.where}>{s.screen ? `${s.cinema} · ${s.screen}` : s.cinema}</span>
                </span>
              </ShowingLink>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
