import { collator, type Film } from '../../lib/program.ts';
import { groupBy } from '../../lib/groupBy.ts';
import { ShowingLink, type ShowingView } from '../ShowingLink/ShowingLink.tsx';
import styles from './CinemaColumns.module.css';

type Props = {
  films: Record<string, Film>;
  showings: ShowingView[];
};

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
          {list.map((s) => (
            <ShowingLink key={s.key} showing={s} title={films[s.filmId].title} className={styles.row}>
              <span className={styles.time}>{s.time}</span>
              <span className={styles.title}>{films[s.filmId].title}</span>
              <span className={styles.screen}>{s.screen}</span>
            </ShowingLink>
          ))}
        </section>
      ))}
    </div>
  );
}
