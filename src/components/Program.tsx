import { useEffect, useMemo, useState } from 'react';
import type { Film, Showing } from '../lib/program.ts';
import { isPast, programNow, type ProgramTime } from '../lib/time.ts';
import CinemaColumns from './CinemaColumns.tsx';
import FilmGrid from './FilmGrid.tsx';
import TimeList from './TimeList.tsx';
import styles from './Program.module.css';

type Sort = 'film' | 'tid' | 'kino';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'film', label: 'Film' },
  { key: 'tid', label: 'Tidspunkt' },
  { key: 'kino', label: 'Kino' },
];

interface Props {
  films: Record<string, Film>;
  showings: Showing[];
}

/** Current Oslo time, refreshed every minute. Null until mounted, so server and client render alike. */
function useNow(): ProgramTime | null {
  const [now, setNow] = useState<ProgramTime | null>(null);
  useEffect(() => {
    const tick = () => setNow(programNow());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Sort order kept in ?sorter= so a link opens the same view. */
function useSort(): [Sort, (sort: Sort) => void] {
  const [sort, setSort] = useState<Sort>('film');
  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('sorter');
    if (fromUrl === 'tid' || fromUrl === 'kino') setSort(fromUrl);
  }, []);
  const update = (next: Sort) => {
    setSort(next);
    const url = new URL(location.href);
    if (next === 'film') url.searchParams.delete('sorter');
    else url.searchParams.set('sorter', next);
    history.replaceState(null, '', url);
  };
  return [sort, update];
}

export default function Program({ films, showings }: Props) {
  const now = useNow();
  const [sort, setSort] = useSort();
  const views = useMemo(
    () => showings.map((s) => ({ ...s, past: now ? isPast(s, now) : false })),
    [showings, now],
  );
  return (
    <>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Sorter" className={styles.sort}>
          <span className={styles.sortLabel}>Sorter</span>
          <div className={styles.segmented}>
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={styles.segment}
                aria-pressed={sort === option.key}
                onClick={() => setSort(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showings.length === 0 ? (
        <p className={styles.empty}>Ingen forestillinger denne dagen. Velg en annen dato.</p>
      ) : sort === 'film' ? (
        <FilmGrid films={films} showings={views} />
      ) : sort === 'tid' ? (
        <TimeList films={films} showings={views} />
      ) : (
        <CinemaColumns films={films} showings={views} />
      )}
    </>
  );
}
