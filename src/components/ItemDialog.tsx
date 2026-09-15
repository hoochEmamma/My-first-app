import React, { useEffect, useMemo, useState } from 'react';
import {
  Item,
  MEDIA_TYPES,
  MEDIA_TYPE_ORDER,
  MediaType,
  Priority,
  PRIORITIES,
  Progress,
  STATUSES,
  STATUS_ORDER,
  Status,
} from '../types';
import { useLibrary } from '../store';
import { Cover, Field, Modal, ProgressBar, StarRating } from './ui';
import { ProgressEditor } from './ProgressEditor';
import { computePercent, progressLabel } from '../lib/progress';
import { statusDatePatch } from '../lib/status';
import { formatDate, numOrUndefined, today } from '../lib/util';

/** The subset of an item this dialog edits. Sessions are handled separately. */
type Draft = Pick<
  Item,
  | 'type' | 'title' | 'creator' | 'year' | 'coverUrl' | 'status' | 'progress'
  | 'rating' | 'review' | 'tags' | 'favorite' | 'priority' | 'startedAt' | 'finishedAt'
>;

function toDraft(item: Item): Draft {
  return {
    type: item.type,
    title: item.title,
    creator: item.creator,
    year: item.year,
    coverUrl: item.coverUrl,
    status: item.status,
    progress: item.progress,
    rating: item.rating,
    review: item.review,
    tags: item.tags,
    favorite: item.favorite,
    priority: item.priority,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
  };
}

export function ItemDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { updateItem, deleteItem, addSession, deleteSession } = useLibrary();
  const [draft, setDraft] = useState<Draft>(() => toDraft(item));
  const [tagText, setTagText] = useState(item.tags.join(', '));
  const [note, setNote] = useState('');
  const [noteDate, setNoteDate] = useState(today());
  const [confirmDelete, setConfirmDelete] = useState(false);

  /**
   * Edits are pushed to the store on a short debounce so typing stays smooth and
   * a stray close never loses the last few keystrokes.
   */
  useEffect(() => {
    const t = setTimeout(() => updateItem(item.id, draft), 250);
    return () => clearTimeout(t);
  }, [draft, item.id, updateItem]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const changeStatus = (status: Status) =>
    patch({ status, ...statusDatePatch(draft, status) });

  const commitTags = () => {
    const tags = tagText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    patch({ tags });
    setTagText(tags.join(', '));
  };

  const preview = useMemo<Item>(() => ({ ...item, ...draft }), [item, draft]);
  const percent = computePercent(preview);
  const config = MEDIA_TYPES[draft.type];

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    // Flush pending edits first so the entry's snapshot reflects what's on screen.
    updateItem(item.id, draft);
    addSession(item.id, note, noteDate);
    setNote('');
    setNoteDate(today());
  };

  return (
    <Modal
      title={draft.title || 'Untitled'}
      onClose={onClose}
      wide
      footer={
        <>
          {confirmDelete ? (
            <div className="confirm-row">
              <span className="small">Delete this permanently?</span>
              <button className="btn btn-danger" onClick={() => { deleteItem(item.id); onClose(); }}>
                Yes, delete
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-danger-text" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </>
      }
    >
      <div className="detail">
        <div className="detail-side">
          <Cover url={draft.coverUrl} type={draft.type} className="cover-lg" />
          <button
            className={draft.favorite ? 'btn btn-fav btn-fav-on' : 'btn btn-fav'}
            onClick={() => patch({ favorite: !draft.favorite })}
          >
            {draft.favorite ? '♥ Favorite' : '♡ Mark favorite'}
          </button>
          <div className="side-meta">
            <div className="side-row"><span>Added</span><strong>{formatDate(item.createdAt.slice(0, 10))}</strong></div>
            {draft.startedAt && <div className="side-row"><span>Started</span><strong>{formatDate(draft.startedAt)}</strong></div>}
            {draft.finishedAt && <div className="side-row"><span>Finished</span><strong>{formatDate(draft.finishedAt)}</strong></div>}
          </div>
        </div>

        <div className="detail-main">
          <section className="panel">
            <div className="status-row">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  className={draft.status === s ? 'seg seg-active' : 'seg'}
                  style={draft.status === s ? { borderColor: STATUSES[s].color, color: STATUSES[s].color } : undefined}
                  onClick={() => changeStatus(s)}
                >
                  {STATUSES[s].label}
                </button>
              ))}
            </div>

            <div className="progress-head">
              <span className="progress-label">{progressLabel(preview)}</span>
              {percent !== undefined && <span className="muted small">{Math.round(percent)}%</span>}
            </div>
            <ProgressBar percent={percent} color={STATUSES[draft.status].color} />
            <div className="spacer" />
            <ProgressEditor
              type={draft.type}
              progress={draft.progress}
              onChange={(progress: Progress) => patch({ progress })}
            />
          </section>

          <section className="panel">
            <h3 className="panel-title">Details</h3>
            <Field label="Title">
              <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
            </Field>
            <div className="grid-2">
              <Field label="Type">
                <select value={draft.type} onChange={(e) => patch({ type: e.target.value as MediaType })}>
                  {MEDIA_TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>{MEDIA_TYPES[t].icon} {MEDIA_TYPES[t].label}</option>
                  ))}
                </select>
              </Field>
              <Field label={config.creatorLabel}>
                <input value={draft.creator ?? ''} onChange={(e) => patch({ creator: e.target.value || undefined })} />
              </Field>
              <Field label="Year">
                <input type="number" value={draft.year ?? ''} onChange={(e) => patch({ year: numOrUndefined(e.target.value) })} />
              </Field>
              <Field label="Priority" hint="Orders your Want To list.">
                <select value={draft.priority} onChange={(e) => patch({ priority: e.target.value as Priority })}>
                  {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITIES[p].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Started">
                <input type="date" value={draft.startedAt ?? ''} onChange={(e) => patch({ startedAt: e.target.value || undefined })} />
              </Field>
              <Field label="Finished">
                <input type="date" value={draft.finishedAt ?? ''} onChange={(e) => patch({ finishedAt: e.target.value || undefined })} />
              </Field>
            </div>
            <Field label="Cover image URL">
              <input value={draft.coverUrl ?? ''} onChange={(e) => patch({ coverUrl: e.target.value || undefined })} placeholder="https://..." />
            </Field>
            <Field label="Tags" hint="Comma separated, e.g. sci-fi, comfort rewatch">
              <input value={tagText} onChange={(e) => setTagText(e.target.value)} onBlur={commitTags} />
            </Field>
          </section>

          <section className="panel">
            <h3 className="panel-title">Review</h3>
            <div className="rating-row">
              <StarRating value={draft.rating} onChange={(rating) => patch({ rating })} size="lg" />
              <span className="muted small">
                {draft.rating === undefined ? 'Not rated' : 'Click the same star again to clear'}
              </span>
            </div>
            <textarea
              rows={5}
              value={draft.review ?? ''}
              onChange={(e) => patch({ review: e.target.value || undefined })}
              placeholder="What did you think of it?"
            />
          </section>

          <section className="panel">
            <h3 className="panel-title">Session log</h3>
            <form className="note-form" onSubmit={submitNote}>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Finished S2E4 — the pacing finally clicked"
              />
              <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={!note.trim()}>Log</button>
            </form>

            {item.sessions.length === 0 ? (
              <p className="muted small">
                No entries yet. Each one stamps where you were at the time, so you get a timeline of
                how you moved through this.
              </p>
            ) : (
              <ol className="timeline">
                {item.sessions.map((s) => (
                  <li key={s.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-body">
                      <div className="timeline-head">
                        <strong>{formatDate(s.date)}</strong>
                        {s.snapshot && <span className="pill">{s.snapshot}</span>}
                        <button className="icon-btn small" onClick={() => deleteSession(item.id, s.id)} aria-label="Delete entry">×</button>
                      </div>
                      <p>{s.note}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}
