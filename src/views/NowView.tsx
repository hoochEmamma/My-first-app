import React, { useState } from 'react';
import { Item, MEDIA_TYPES, STATUSES } from '../types';
import { useLibrary } from '../store';
import { Cover, EmptyState, ProgressBar } from '../components/ui';
import { computePercent, progressLabel, quickAdvance } from '../lib/progress';
import { formatDate } from '../lib/util';

function NowRow({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const { updateItem, setStatus, addSession } = useLibrary();
  const [note, setNote] = useState('');
  const percent = computePercent(item);
  const advance = quickAdvance(item);
  const last = item.sessions[0];

  const logNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    addSession(item.id, note);
    setNote('');
  };

  return (
    <article className="now-row">
      <button className="now-cover" onClick={onOpen} aria-label={`Open ${item.title}`}>
        <Cover url={item.coverUrl} type={item.type} />
      </button>

      <div className="now-main">
        <div className="now-head">
          <button className="now-title" onClick={onOpen}>{item.title}</button>
          <span className="muted small">
            {MEDIA_TYPES[item.type].icon} {[item.creator, item.year].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div className="progress-head">
          <span className="progress-label">{progressLabel(item)}</span>
          {percent !== undefined && <span className="muted small">{Math.round(percent)}%</span>}
        </div>
        <ProgressBar percent={percent} color={STATUSES[item.status].color} />

        <div className="now-actions">
          {advance && (
            <button className="btn btn-sm" onClick={() => updateItem(item.id, { progress: advance.progress })}>
              {advance.label}
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setStatus(item.id, 'completed')}>Finish</button>
          {item.status === 'active' ? (
            <button className="btn btn-sm btn-ghost" onClick={() => setStatus(item.id, 'paused')}>Put on hold</button>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={() => setStatus(item.id, 'active')}>Resume</button>
          )}
        </div>

        <form className="note-form" onSubmit={logNote}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log where you got to…" />
          <button className="btn btn-sm btn-primary" type="submit" disabled={!note.trim()}>Log</button>
        </form>

        {last && (
          <p className="muted small last-note">
            <strong>{formatDate(last.date)}</strong>
            {last.snapshot ? ` · ${last.snapshot}` : ''} — {last.note}
          </p>
        )}
      </div>
    </article>
  );
}

export function NowView({ onOpen, onAdd }: { onOpen: (item: Item) => void; onAdd: () => void }) {
  const { items } = useLibrary();
  const active = items.filter((i) => i.status === 'active');
  const paused = items.filter((i) => i.status === 'paused');

  if (active.length === 0 && paused.length === 0) {
    return (
      <EmptyState
        icon="▶"
        title="Nothing in progress"
        body="Start something from your Want To list, or add whatever you're in the middle of right now."
        action={<button className="btn btn-primary" onClick={onAdd}>Add something</button>}
      />
    );
  }

  return (
    <div className="stack">
      {active.length > 0 && (
        <section>
          <h2 className="section-title">In progress <span className="muted">{active.length}</span></h2>
          <div className="now-list">
            {active.map((i) => <NowRow key={i.id} item={i} onOpen={() => onOpen(i)} />)}
          </div>
        </section>
      )}

      {paused.length > 0 && (
        <section>
          <h2 className="section-title">On hold <span className="muted">{paused.length}</span></h2>
          <div className="now-list">
            {paused.map((i) => <NowRow key={i.id} item={i} onOpen={() => onOpen(i)} />)}
          </div>
        </section>
      )}
    </div>
  );
}
