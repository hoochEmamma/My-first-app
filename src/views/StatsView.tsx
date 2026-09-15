import React, { useMemo } from 'react';
import { Item, MEDIA_TYPES, MEDIA_TYPE_ORDER, STATUSES, STATUS_ORDER } from '../types';
import { useLibrary } from '../store';
import { EmptyState, StarRating } from '../components/ui';
import { formatMinutes } from '../lib/util';

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function StatsView({ onOpen }: { onOpen: (item: Item) => void }) {
  const { items } = useLibrary();
  const year = new Date().getFullYear();

  const data = useMemo(() => {
    const completed = items.filter((i) => i.status === 'completed');
    const rated = items.filter((i) => i.rating !== undefined);
    const finishedThisYear = completed.filter((i) => i.finishedAt?.startsWith(String(year)));
    const gameHours = items.reduce((sum, i) => sum + (i.type === 'game' ? (i.progress.hours ?? 0) : 0), 0);
    const listenMinutes = items.reduce(
      (sum, i) => sum + (i.type === 'audiobook' || i.type === 'podcast' ? (i.progress.minutes ?? 0) : 0),
      0,
    );
    const pagesRead = items.reduce(
      (sum, i) => sum + (i.type === 'book' || i.type === 'comic'
        ? (i.status === 'completed' ? (i.progress.totalPages ?? i.progress.page ?? 0) : (i.progress.page ?? 0))
        : 0),
      0,
    );
    const avgRating = rated.length
      ? rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length
      : undefined;
    const topRated = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 8);
    const sessionCount = items.reduce((sum, i) => sum + i.sessions.length, 0);

    return { completed, rated, finishedThisYear, gameHours, listenMinutes, pagesRead, avgRating, topRated, sessionCount };
  }, [items, year]);

  if (items.length === 0) {
    return <EmptyState icon="📈" title="No stats yet" body="Once you log a few things, your totals show up here." />;
  }

  const maxType = Math.max(...MEDIA_TYPE_ORDER.map((t) => items.filter((i) => i.type === t).length), 1);

  return (
    <div className="stack">
      <div className="stat-grid">
        <Stat value={items.length} label="Tracked overall" />
        <Stat value={data.completed.length} label="Finished" />
        <Stat value={data.finishedThisYear.length} label={`Finished in ${year}`} />
        <Stat value={items.filter((i) => i.status === 'active').length} label="In progress" />
        <Stat value={items.filter((i) => i.status === 'backlog').length} label="On the waiting list" />
        <Stat value={data.sessionCount} label="Log entries" />
        <Stat value={data.pagesRead.toLocaleString()} label="Pages read" />
        <Stat value={`${Math.round(data.gameHours)}h`} label="Hours played" />
        <Stat value={formatMinutes(data.listenMinutes)} label="Listened" />
        <Stat
          value={data.avgRating === undefined ? '—' : data.avgRating.toFixed(1)}
          label={`Average rating${data.rated.length ? ` (${data.rated.length} rated)` : ''}`}
        />
      </div>

      <section className="panel">
        <h3 className="panel-title">By type</h3>
        {MEDIA_TYPE_ORDER.filter((t) => items.some((i) => i.type === t)).map((t) => {
          const all = items.filter((i) => i.type === t);
          const done = all.filter((i) => i.status === 'completed').length;
          return (
            <div key={t} className="dist-row">
              <span className="dist-label">{MEDIA_TYPES[t].icon} {MEDIA_TYPES[t].plural}</span>
              <div className="dist-bar">
                <div className="dist-fill" style={{ width: `${(all.length / maxType) * 100}%` }} />
              </div>
              <span className="muted small dist-count">{all.length} · {done} done</span>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <h3 className="panel-title">By status</h3>
        {STATUS_ORDER.map((s) => {
          const count = items.filter((i) => i.status === s).length;
          if (count === 0) return null;
          return (
            <div key={s} className="dist-row">
              <span className="dist-label" style={{ color: STATUSES[s].color }}>{STATUSES[s].label}</span>
              <div className="dist-bar">
                <div className="dist-fill" style={{ width: `${(count / items.length) * 100}%`, background: STATUSES[s].color }} />
              </div>
              <span className="muted small dist-count">{count}</span>
            </div>
          );
        })}
      </section>

      {data.topRated.length > 0 && (
        <section className="panel">
          <h3 className="panel-title">Highest rated</h3>
          <ul className="rank-list">
            {data.topRated.map((i) => (
              <li key={i.id}>
                <button className="rank-row" onClick={() => onOpen(i)}>
                  <span className="rank-title">{MEDIA_TYPES[i.type].icon} {i.title}</span>
                  <StarRating value={i.rating} readOnly size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
