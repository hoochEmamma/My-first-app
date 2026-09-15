import { Item, MEDIA_TYPES, STATUSES } from '../types';
import { Cover, ProgressBar, StarRating } from './ui';
import { computePercent, progressLabel } from '../lib/progress';

export function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const percent = computePercent(item);
  const showBar = item.status === 'active' || item.status === 'paused';

  return (
    <button className="card" onClick={onOpen}>
      <div className="card-cover">
        <Cover url={item.coverUrl} type={item.type} />
        {item.favorite && <span className="card-fav" aria-label="Favorite">♥</span>}
        <span className="card-type" title={MEDIA_TYPES[item.type].label}>
          {MEDIA_TYPES[item.type].icon}
        </span>
      </div>
      <div className="card-body">
        <strong className="card-title">{item.title}</strong>
        <span className="muted small ellipsis">
          {[item.creator, item.year].filter(Boolean).join(' · ') || MEDIA_TYPES[item.type].label}
        </span>
        {item.rating !== undefined && <StarRating value={item.rating} readOnly size="sm" />}
        {showBar && (
          <>
            <ProgressBar percent={percent} color={STATUSES[item.status].color} />
            <span className="muted small">{progressLabel(item)}</span>
          </>
        )}
        {item.status !== 'active' && (
          <span className="status-pill" style={{ color: STATUSES[item.status].color }}>
            {STATUSES[item.status].label}
          </span>
        )}
      </div>
    </button>
  );
}
