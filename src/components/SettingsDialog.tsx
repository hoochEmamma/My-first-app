import React, { useRef, useState } from 'react';
import { useLibrary } from '../store';
import { Field, Modal } from './ui';
import { downloadBackup, mergeImport } from '../lib/exportImport';
import { DB_VERSION } from '../types';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { items, settings, setSettings, replaceItems } = useLibrary();
  const [tmdbKey, setTmdbKey] = useState(settings.tmdbKey);
  const [rawgKey, setRawgKey] = useState(settings.rawgKey);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const saveKeys = () => {
    setSettings({ tmdbKey: tmdbKey.trim(), rawgKey: rawgKey.trim() });
    setMessage('API keys saved.');
    setError('');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const result = mergeImport(items, parsed);
      replaceItems(result.items);
      setError('');
      setMessage(
        `Imported: ${result.added} added, ${result.updated} updated` +
          (result.skipped ? `, ${result.skipped} skipped` : '') + '.',
      );
    } catch {
      setError("That file couldn't be read as a Shelf backup.");
      setMessage('');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}
    >
      <section className="panel">
        <h3 className="panel-title">Lookup keys</h3>
        <p className="muted small">
          Stored in this browser only, never sent anywhere except the API they belong to. Books and
          audiobooks use Open Library, which needs no key.
        </p>
        <Field
          label="TMDB API key — movies & TV"
          hint="Free at themoviedb.org → Settings → API. Use the v3 API key."
        >
          <input value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Paste key" />
        </Field>
        <Field label="RAWG API key — games" hint="Free at rawg.io/apidocs.">
          <input value={rawgKey} onChange={(e) => setRawgKey(e.target.value)} placeholder="Paste key" />
        </Field>
        <button className="btn btn-primary" onClick={saveKeys}>Save keys</button>
      </section>

      <section className="panel">
        <h3 className="panel-title">Backup</h3>
        <p className="muted small">
          Your library lives in this browser. Export regularly and keep the file somewhere synced —
          clearing site data wipes the app's storage.
        </p>
        <div className="row">
          <button
            className="btn"
            onClick={() => downloadBackup({ version: DB_VERSION, items, settings })}
          >
            Export {items.length} item{items.length === 1 ? '' : 's'}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        <p className="muted small">
          Importing merges by title, so re-importing a backup updates entries instead of duplicating
          them. Exported files contain your library only — API keys are never included.
        </p>
      </section>

      {message && <div className="notice notice-ok">{message}</div>}
      {error && <div className="notice notice-error">{error}</div>}
    </Modal>
  );
}
