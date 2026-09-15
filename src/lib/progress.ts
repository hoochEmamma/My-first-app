import { Item, MEDIA_TYPES, Progress } from '../types';
import { clamp, formatMinutes } from './util';

/**
 * Percent complete for an item, or undefined when there is nothing to compute
 * from (e.g. a book with no total page count). Completed items always read 100.
 */
export function computePercent(item: Item): number | undefined {
  if (item.status === 'completed') return 100;
  const { progress } = item;
  const kind = MEDIA_TYPES[item.type].progressKind;

  switch (kind) {
    case 'pages':
      if (progress.totalPages && progress.page !== undefined) {
        return clamp((progress.page / progress.totalPages) * 100, 0, 100);
      }
      break;
    case 'episodes':
      if (progress.totalEpisodes && progress.episode !== undefined) {
        return clamp((progress.episode / progress.totalEpisodes) * 100, 0, 100);
      }
      break;
    case 'duration':
      if (progress.totalMinutes && progress.minutes !== undefined) {
        return clamp((progress.minutes / progress.totalMinutes) * 100, 0, 100);
      }
      break;
    case 'hours':
    case 'binary':
      break;
  }
  // `percent` doubles as the games field and as a manual override elsewhere.
  if (progress.percent !== undefined) return clamp(progress.percent, 0, 100);
  return undefined;
}

/** Human-readable position, e.g. `p. 210 / 480`, `S2 E4`, `31h played`. */
export function progressLabel(item: Item): string {
  const { progress } = item;
  const kind = MEDIA_TYPES[item.type].progressKind;

  switch (kind) {
    case 'pages': {
      if (progress.page === undefined) return progress.totalPages ? `0 / ${progress.totalPages} pages` : 'Not started';
      return progress.totalPages
        ? `p. ${progress.page} / ${progress.totalPages}`
        : `p. ${progress.page}`;
    }
    case 'episodes': {
      const parts: string[] = [];
      if (progress.season !== undefined) parts.push(`S${progress.season}`);
      if (progress.episode !== undefined) parts.push(`E${progress.episode}`);
      if (parts.length === 0) return 'Not started';
      let label = parts.join(' ');
      if (progress.totalEpisodes) label += ` of ${progress.totalEpisodes}`;
      return label;
    }
    case 'duration': {
      if (progress.minutes === undefined) return 'Not started';
      return progress.totalMinutes
        ? `${formatMinutes(progress.minutes)} / ${formatMinutes(progress.totalMinutes)}`
        : formatMinutes(progress.minutes);
    }
    case 'hours': {
      const bits: string[] = [];
      if (progress.hours !== undefined) bits.push(`${progress.hours}h played`);
      if (progress.percent !== undefined) bits.push(`${Math.round(progress.percent)}%`);
      return bits.length ? bits.join(' · ') : 'Not started';
    }
    case 'binary':
      return item.status === 'completed' ? 'Watched' : 'Not watched';
  }
}

/** The short string stamped onto a session-log entry. */
export function progressSnapshot(item: Item): string {
  const label = progressLabel(item);
  return label === 'Not started' ? '' : label;
}

/**
 * The one-tap "I did a bit more" button on the dashboard. Returns the label and
 * the progress it would produce, or null for types with nothing to bump.
 */
export function quickAdvance(item: Item): { label: string; progress: Progress } | null {
  const p = item.progress;
  switch (MEDIA_TYPES[item.type].progressKind) {
    case 'pages':
      return { label: '+10 pages', progress: { ...p, page: (p.page ?? 0) + 10 } };
    case 'episodes':
      return { label: '+1 episode', progress: { ...p, episode: (p.episode ?? 0) + 1 } };
    case 'duration':
      return { label: '+15 min', progress: { ...p, minutes: (p.minutes ?? 0) + 15 } };
    case 'hours':
      return { label: '+1 hour', progress: { ...p, hours: (p.hours ?? 0) + 1 } };
    case 'binary':
      return null;
  }
}
