import { useMemo, useState } from 'react';
import {
  Item,
  MEDIA_TYPES,
  MEDIA_TYPE_ORDER,
  MediaType,
  STATUSES,
  STATUS_ORDER,
  Status,
} from '../types';
import { useLibrary } from '../store';
import { Chip, EmptyState } from '../components/ui';
import { ItemCard } from '../components/ItemCard';

type Sort = 'updated' | 'title' | 'rating' | 'year' | 'finished';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'finished', label: 'Recently finished' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'year', label: 'Newest release' },
];

/** Free-text match across the fields worth searching. */
function matches(item: Item, q: string): boolean {
  if (!q) return true;
  const haystack = [item.title, item.creator, item.review, ...item.tags]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function compare(a: Item, b: Item, sort: Sort): number {
  switch (sort) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'rating':
      return (b.rating ?? -1) - (a.rating ?? -1);
    case 'year':
      return (b.year ?? -1) - (a.year ?? -1);
    case 'finished':
      return (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '');
    case 'updated':
    default:
      return b.updatedAt.localeCompare(a.updatedAt);
  }
}

export function LibraryView({ onOpen, onAdd }: { onOpen: (item: Item) => void; onAdd: () => void }) {
  const { items } = useLibrary();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<MediaType | 'all'>('all');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [sort, setSort] = useState<Sort>('updated');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => (type === 'all' || i.type === type))
      .filter((i) => (status === 'all' || i.status === status))
      .filter((i) => (!favoritesOnly || i.favorite))
      .filter((i) => matches(i, q))
      .sort((a, b) => compare(a, b, sort));
  }, [items, query, type, status, sort, favoritesOnly]);

  const typeCount = (t: MediaType) => items.filter((i) => i.type === t).length;
  const statusCount = (s: Status) => items.filter((i) => i.status === s).length;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title="Your library is empty"
        body="Add the first thing you're reading, watching, or playing and it'll show up here."
        action={<button className="btn btn-primary" onClick={onAdd}>Add something</button>}
      />
    );
  }

  return (
    <div className="stack">
      <div className="filters">
        <input
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, creators, tags, reviews…"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="chip-row">
        <Chip active={type === 'all'} onClick={() => setType('all')} count={items.length}>All types</Chip>
        {MEDIA_TYPE_ORDER.filter((t) => typeCount(t) > 0).map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)} count={typeCount(t)}>
            {MEDIA_TYPES[t].icon} {MEDIA_TYPES[t].plural}
          </Chip>
        ))}
      </div>

      <div className="chip-row">
        <Chip active={status === 'all'} onClick={() => setStatus('all')}>Any status</Chip>
        {STATUS_ORDER.filter((s) => statusCount(s) > 0).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)} count={statusCount(s)}>
            {STATUSES[s].label}
          </Chip>
        ))}
        <Chip active={favoritesOnly} onClick={() => setFavoritesOnly((v) => !v)}>♥ Favorites</Chip>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" title="No matches" body="Nothing here fits those filters. Try loosening them." />
      ) : (
        <>
          <p className="muted small">{visible.length} of {items.length}</p>
          <div className="grid">
            {visible.map((i) => <ItemCard key={i.id} item={i} onOpen={() => onOpen(i)} />)}
          </div>
        </>
      )}
    </div>
  );
}
