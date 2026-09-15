import React, { useEffect, useState } from 'react';
import {
  Item,
  MEDIA_TYPES,
  MEDIA_TYPE_ORDER,
  MediaType,
  STATUSES,
  Status,
} from '../types';
import { useLibrary } from '../store';
import { Chip, Cover, Field, Modal } from './ui';
import {
  LookupError,
  SearchResult,
  enrichResult,
  lookupAvailability,
  searchProvider,
} from '../api/providers';
import { numOrUndefined } from '../lib/util';

const ADD_AS: Status[] = ['backlog', 'active', 'completed'];

export function AddDialog({
  onClose,
  onCreated,
  onOpenSettings,
  defaultStatus = 'backlog',
}: {
  onClose: () => void;
  onCreated: (item: Item) => void;
  onOpenSettings: () => void;
  defaultStatus?: Status;
}) {
  const { addItem, settings } = useLibrary();
  const [type, setType] = useState<MediaType>('book');
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState({ title: '', creator: '', year: '' });

  const availability = lookupAvailability(type, settings);

  // Switching type invalidates whatever the previous provider returned.
  useEffect(() => {
    setResults([]);
    setSearched(false);
    setError('');
  }, [type]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      const hits = await searchProvider(type, query.trim(), settings);
      setResults(hits);
      setSearched(true);
    } catch (err) {
      setError(err instanceof LookupError ? err.message : 'Something went wrong with that search.');
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (result: SearchResult) => {
    setBusy(true);
    const full = await enrichResult(type, result, settings);
    const item = addItem({
      type,
      title: full.title,
      creator: full.creator,
      year: full.year,
      coverUrl: full.coverUrl,
      status,
      progress: { ...full.totals },
      source: { provider: full.provider, id: full.id, url: full.url },
    });
    setBusy(false);
    onCreated(item);
  };

  const addManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const item = addItem({
      type,
      title: draft.title.trim(),
      creator: draft.creator.trim() || undefined,
      year: numOrUndefined(draft.year),
      status,
      source: { provider: 'manual', id: '' },
    });
    onCreated(item);
  };

  return (
    <Modal title="Add something" onClose={onClose} wide>
      <div className="add-types">
        {MEDIA_TYPE_ORDER.map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {MEDIA_TYPES[t].icon} {MEDIA_TYPES[t].label}
          </Chip>
        ))}
      </div>

      <div className="add-status">
        <span className="field-label">Add to</span>
        <div className="status-row">
          {ADD_AS.map((s) => (
            <button
              key={s}
              className={status === s ? 'seg seg-active' : 'seg'}
              style={status === s ? { borderColor: STATUSES[s].color, color: STATUSES[s].color } : undefined}
              onClick={() => setStatus(s)}
            >
              {STATUSES[s].label}
            </button>
          ))}
        </div>
      </div>

      {!manual && (
        <>
          {availability.supported && !availability.ready && (
            <div className="notice">
              Lookup for {MEDIA_TYPES[type].plural.toLowerCase()} needs a {availability.needs}.{' '}
              <button className="link" onClick={onOpenSettings}>Add it in Settings</button>, or enter
              the title by hand.
            </div>
          )}
          {!availability.supported && (
            <div className="notice">
              No lookup source for {MEDIA_TYPES[type].plural.toLowerCase()} — add it by hand below.
            </div>
          )}

          <form className="search-form" onSubmit={runSearch}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${MEDIA_TYPES[type].plural.toLowerCase()}…`}
              disabled={!availability.ready}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !availability.ready || !query.trim()}>
              {busy ? 'Searching…' : 'Search'}
            </button>
          </form>

          {error && <div className="notice notice-error">{error}</div>}

          {searched && results.length === 0 && !error && (
            <p className="muted small">No matches. Try a different spelling, or add it by hand.</p>
          )}

          <ul className="results">
            {results.map((r) => (
              <li key={`${r.provider}-${r.id}`}>
                <button className="result" onClick={() => pick(r)} disabled={busy}>
                  <Cover url={r.coverUrl} type={type} className="cover-sm" />
                  <span className="result-text">
                    <strong>{r.title}</strong>
                    <span className="muted small">
                      {[r.creator, r.year].filter(Boolean).join(' · ') || MEDIA_TYPES[type].label}
                    </span>
                    {r.blurb && <span className="blurb">{r.blurb}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <p className="muted small center">
            Can't find it? <button className="link" onClick={() => setManual(true)}>Add it manually</button>
          </p>
        </>
      )}

      {manual && (
        <form className="manual-form" onSubmit={addManual}>
          <Field label="Title">
            <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <div className="grid-2">
            <Field label={MEDIA_TYPES[type].creatorLabel}>
              <input value={draft.creator} onChange={(e) => setDraft({ ...draft, creator: e.target.value })} />
            </Field>
            <Field label="Year">
              <input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
            </Field>
          </div>
          <div className="row-end">
            <button type="button" className="btn btn-ghost" onClick={() => setManual(false)}>Back to search</button>
            <button type="submit" className="btn btn-primary" disabled={!draft.title.trim()}>Add</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
