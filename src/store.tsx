import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Item, MediaType, Session, Settings, Status } from './types';
import { loadDb, saveDb } from './lib/storage';
import { today, uid } from './lib/util';
import { progressSnapshot } from './lib/progress';
import { statusDatePatch } from './lib/status';

export type NewItem = Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'sessions' | 'tags' | 'favorite' | 'priority' | 'progress' | 'status'> &
  Partial<Pick<Item, 'sessions' | 'tags' | 'favorite' | 'priority' | 'progress' | 'status'>>;

interface LibraryValue {
  items: Item[];
  settings: Settings;
  /** True when the browser refused to persist — surfaced as a banner. */
  storageFailed: boolean;
  addItem: (draft: NewItem) => Item;
  updateItem: (id: string, patch: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  setStatus: (id: string, status: Status) => void;
  addSession: (id: string, note: string, date?: string) => void;
  deleteSession: (id: string, sessionId: string) => void;
  setSettings: (settings: Settings) => void;
  replaceItems: (items: Item[]) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const initial = useRef(loadDb()).current;
  const [items, setItems] = useState<Item[]>(initial.items);
  const [settings, setSettingsState] = useState<Settings>(initial.settings);
  const [storageFailed, setStorageFailed] = useState(false);

  useEffect(() => {
    const ok = saveDb({ version: initial.version, items, settings });
    setStorageFailed(!ok);
  }, [items, settings, initial.version]);

  const stamp = () => new Date().toISOString();

  const addItem = useCallback((draft: NewItem): Item => {
    const now = stamp();
    const item: Item = {
      tags: [],
      favorite: false,
      priority: 'medium',
      progress: {},
      status: 'backlog',
      sessions: [],
      ...draft,
      id: uid(),
      createdAt: now,
      updatedAt: now,
    };
    if (item.status === 'active' && !item.startedAt) item.startedAt = today();
    if (item.status === 'completed' && !item.finishedAt) item.finishedAt = today();
    setItems((prev) => [item, ...prev]);
    return item;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: stamp() } : i)),
    );
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /**
   * Status changes carry date side effects: starting something stamps a start
   * date, finishing stamps a finish date. Existing dates are never overwritten.
   */
  const setStatus = useCallback((id: string, status: Status) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status, ...statusDatePatch(i, status), updatedAt: stamp() } : i,
      ),
    );
  }, []);

  const addSession = useCallback((id: string, note: string, date?: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const session: Session = {
          id: uid(),
          date: date ?? today(),
          note: note.trim(),
          snapshot: progressSnapshot(i) || undefined,
        };
        return { ...i, sessions: [session, ...i.sessions], updatedAt: stamp() };
      }),
    );
  }, []);

  const deleteSession = useCallback((id: string, sessionId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, sessions: i.sessions.filter((s) => s.id !== sessionId), updatedAt: stamp() }
          : i,
      ),
    );
  }, []);

  const setSettings = useCallback((next: Settings) => setSettingsState(next), []);
  const replaceItems = useCallback((next: Item[]) => setItems(next), []);

  const value = useMemo<LibraryValue>(
    () => ({
      items,
      settings,
      storageFailed,
      addItem,
      updateItem,
      deleteItem,
      setStatus,
      addSession,
      deleteSession,
      setSettings,
      replaceItems,
    }),
    [items, settings, storageFailed, addItem, updateItem, deleteItem, setStatus, addSession, deleteSession, setSettings, replaceItems],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside a LibraryProvider');
  return ctx;
}

/** Aggregate counts used by the nav badges and the stats view. */
export function countByType(items: Item[]): Record<MediaType, number> {
  return items.reduce(
    (acc, i) => {
      acc[i.type] = (acc[i.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<MediaType, number>,
  );
}
