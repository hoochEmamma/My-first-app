import { Database, Item } from '../types';
import { normalizeItem } from './storage';
import { today } from './util';

export function downloadBackup(db: Database): void {
  const payload = {
    app: 'shelf',
    exportedAt: new Date().toISOString(),
    version: db.version,
    items: db.items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shelf-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  items: Item[];
}

/**
 * Merge an imported file into the existing library. Items are matched by id
 * first, then by type+title, so re-importing a backup updates in place instead
 * of creating duplicates.
 */
export function mergeImport(existing: Item[], raw: unknown): ImportResult {
  const container = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const incomingRaw = Array.isArray(container.items)
    ? container.items
    : Array.isArray(raw)
      ? raw
      : [];

  const byId = new Map(existing.map((i) => [i.id, i]));
  const byTitle = new Map(existing.map((i) => [`${i.type}::${i.title.toLowerCase()}`, i]));
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, items: [...existing] };

  for (const entry of incomingRaw) {
    const item = normalizeItem(entry);
    if (!item) {
      result.skipped++;
      continue;
    }
    const match = byId.get(item.id) ?? byTitle.get(`${item.type}::${item.title.toLowerCase()}`);
    if (match) {
      const idx = result.items.findIndex((i) => i.id === match.id);
      result.items[idx] = { ...item, id: match.id };
      result.updated++;
    } else {
      result.items.push(item);
      byId.set(item.id, item);
      byTitle.set(`${item.type}::${item.title.toLowerCase()}`, item);
      result.added++;
    }
  }
  return result;
}
