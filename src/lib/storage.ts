import { DB_VERSION, Database, Item, Priority, Settings, Status } from '../types';
import { uid } from './util';

const STORAGE_KEY = 'shelf.db';

export function emptyDb(): Database {
  return { version: DB_VERSION, items: [], settings: { tmdbKey: '', rawgKey: '' } };
}

/**
 * Coerce an unknown object into a valid Item, filling defaults for anything
 * missing. Used for both stored data and user-supplied import files, so it has
 * to assume every field may be absent or the wrong shape.
 */
export function normalizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.title !== 'string' || r.title.trim() === '') return null;

  const now = new Date().toISOString();
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;

  const progressRaw = (r.progress ?? {}) as Record<string, unknown>;
  const sessionsRaw = Array.isArray(r.sessions) ? r.sessions : [];

  return {
    id: str(r.id) ?? uid(),
    type: (typeof r.type === 'string' ? r.type : 'book') as Item['type'],
    title: r.title.trim(),
    creator: str(r.creator),
    year: num(r.year),
    coverUrl: str(r.coverUrl),
    status: (typeof r.status === 'string' ? r.status : 'backlog') as Status,
    progress: {
      page: num(progressRaw.page),
      totalPages: num(progressRaw.totalPages),
      season: num(progressRaw.season),
      episode: num(progressRaw.episode),
      totalEpisodes: num(progressRaw.totalEpisodes),
      minutes: num(progressRaw.minutes),
      totalMinutes: num(progressRaw.totalMinutes),
      hours: num(progressRaw.hours),
      percent: num(progressRaw.percent),
    },
    rating: num(r.rating),
    review: str(r.review),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
    favorite: r.favorite === true,
    priority: (typeof r.priority === 'string' ? r.priority : 'medium') as Priority,
    startedAt: str(r.startedAt),
    finishedAt: str(r.finishedAt),
    sessions: sessionsRaw
      .map((s) => {
        if (!s || typeof s !== 'object') return null;
        const sr = s as Record<string, unknown>;
        if (typeof sr.date !== 'string') return null;
        return {
          id: str(sr.id) ?? uid(),
          date: sr.date,
          note: typeof sr.note === 'string' ? sr.note : '',
          snapshot: str(sr.snapshot),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null),
    source: (r.source ?? undefined) as Item['source'],
    createdAt: str(r.createdAt) ?? now,
    updatedAt: str(r.updatedAt) ?? now,
  };
}

export function normalizeDb(raw: unknown): Database {
  const db = emptyDb();
  if (!raw || typeof raw !== 'object') return db;
  const r = raw as Record<string, unknown>;

  if (Array.isArray(r.items)) {
    db.items = r.items
      .map(normalizeItem)
      .filter((i): i is Item => i !== null);
  }
  const s = (r.settings ?? {}) as Record<string, unknown>;
  db.settings = {
    tmdbKey: typeof s.tmdbKey === 'string' ? s.tmdbKey : '',
    rawgKey: typeof s.rawgKey === 'string' ? s.rawgKey : '',
  };
  return db;
}

/**
 * Storage can throw or come back empty — private windows, cleared site data,
 * blocked cookies — so every read and write is guarded and the app is expected
 * to keep working on an empty database.
 */
export function loadDb(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    return normalizeDb(JSON.parse(raw));
  } catch {
    return emptyDb();
  }
}

export function saveDb(db: Database): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

export function saveSettings(settings: Settings): void {
  const db = loadDb();
  saveDb({ ...db, settings });
}
