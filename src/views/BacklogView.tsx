import { useMemo, useState } from 'react';
import { Item, MEDIA_TYPES, MEDIA_TYPE_ORDER, MediaType, Priority, PRIORITIES } from '../types';
import { useLibrary } from '../store';
import { Chip, Cover, EmptyState } from '../components/ui';
import { formatDate } from '../lib/util';

const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];

function BacklogRow({ item, onOpen, highlight }: { item: Item; onOpen: () => void; highlight?: boolean }) {
  const { setStatus, updateItem } = useLibrary();
  return (
    <article className={highlight ? 'backlog-row backlog-row-pick' : 'backlog-row'}>
      <button className="backlog-cover" onClick={onOpen} aria-label={`Open ${item.title}`}>
        <Cover url={item.coverUrl} type={item.type} />
      </button>
      <div className="backlog-main">
        <button className="now-title" onClick={onOpen}>{item.title}</button>
        <span className="muted small">
          {MEDIA_TYPES[item.type].icon} {[item.creator, item.year].filter(Boolean).join(' · ')}
        </span>
        <span className="muted small">Added {formatDate(item.createdAt.slice(0, 10))}</span>
      </div>
      <div className="backlog-actions">
        <select
          value={item.priority}
          onChange={(e) => updateItem(item.id, { priority: e.target.value as Priority })}
          aria-label="Priority"
        >
          {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITIES[p].label}</option>)}
        </select>
        <button className="btn btn-sm btn-primary" onClick={() => setStatus(item.id, 'active')}>Start</button>
      </div>
    </article>
  );
}

export function BacklogView({ onOpen, onAdd }: { onOpen: (item: Item) => void; onAdd: () => void }) {
  const { items } = useLibrary();
  const [type, setType] = useState<MediaType | 'all'>('all');
  const [pick, setPick] = useState<string | null>(null);

  const backlog = useMemo(
    () => items.filter((i) => i.status === 'backlog' && (type === 'all' || i.type === type)),
    [items, type],
  );

  const typeCount = (t: MediaType) => items.filter((i) => i.status === 'backlog' && i.type === t).length;

  const surprise = () => {
    if (backlog.length === 0) return;
    setPick(backlog[Math.floor(Math.random() * backlog.length)].id);
  };

  if (items.filter((i) => i.status === 'backlog').length === 0) {
    return (
      <EmptyState
        icon="🔖"
        title="Nothing on the waiting list"
        body="This is where things you want to get to live. Add a few and pick one when you're ready."
        action={<button className="btn btn-primary" onClick={onAdd}>Add something</button>}
      />
    );
  }

  return (
    <div className="stack">
      <div className="chip-row">
        <Chip active={type === 'all'} onClick={() => setType('all')}>All types</Chip>
        {MEDIA_TYPE_ORDER.filter((t) => typeCount(t) > 0).map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)} count={typeCount(t)}>
            {MEDIA_TYPES[t].icon} {MEDIA_TYPES[t].plural}
          </Chip>
        ))}
        <button className="btn btn-sm" onClick={surprise}>🎲 Pick for me</button>
      </div>

      {backlog.length === 0 ? (
        <EmptyState icon="🔍" title="Nothing of that type" body="Try another filter." />
      ) : (
        PRIORITY_ORDER.map((p) => {
          const group = backlog.filter((i) => i.priority === p);
          if (group.length === 0) return null;
          return (
            <section key={p}>
              <h2 className="section-title">{PRIORITIES[p].label} priority <span className="muted">{group.length}</span></h2>
              <div className="backlog-list">
                {group.map((i) => (
                  <BacklogRow key={i.id} item={i} onOpen={() => onOpen(i)} highlight={pick === i.id} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
