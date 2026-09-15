/** Core data model for the content tracker. */

export type MediaType =
  | 'book'
  | 'audiobook'
  | 'tv'
  | 'movie'
  | 'game'
  | 'podcast'
  | 'comic';

/** Where an item sits in your pipeline. */
export type Status = 'backlog' | 'active' | 'paused' | 'completed' | 'dropped';

export type Priority = 'low' | 'medium' | 'high';

/**
 * Progress is one bag of optional fields; which ones matter is decided by the
 * media type's `progressKind`. Storing it flat (rather than as a discriminated
 * union) means changing an item's type never destroys data you already entered.
 */
export interface Progress {
  /** Books, comics. */
  page?: number;
  totalPages?: number;
  /** TV. */
  season?: number;
  episode?: number;
  totalEpisodes?: number;
  /** Audiobooks, podcasts — stored as minutes. */
  minutes?: number;
  totalMinutes?: number;
  /** Games. */
  hours?: number;
  /** Games, and a manual override for anything else. */
  percent?: number;
}

/** One dated entry in an item's timeline. */
export interface Session {
  id: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  note: string;
  /** Snapshot of where you were when the entry was written. */
  snapshot?: string;
}

export interface SourceRef {
  provider: 'tmdb' | 'openlibrary' | 'rawg' | 'manual';
  id: string;
  url?: string;
}

export interface Item {
  id: string;
  type: MediaType;
  title: string;
  /** Author, director, studio, developer — label varies by type. */
  creator?: string;
  year?: number;
  coverUrl?: string;
  status: Status;
  progress: Progress;
  /** 0.5–5 in half-star steps. Undefined means unrated. */
  rating?: number;
  review?: string;
  tags: string[];
  favorite: boolean;
  priority: Priority;
  /** ISO dates, `YYYY-MM-DD`. */
  startedAt?: string;
  finishedAt?: string;
  sessions: Session[];
  source?: SourceRef;
  createdAt: string;
  updatedAt: string;
}

/** Everything persisted to browser storage, under one version stamp. */
export interface Database {
  version: number;
  items: Item[];
  settings: Settings;
}

export interface Settings {
  tmdbKey: string;
  rawgKey: string;
}

export const DB_VERSION = 1;

export interface MediaTypeConfig {
  label: string;
  plural: string;
  icon: string;
  creatorLabel: string;
  progressKind: 'pages' | 'episodes' | 'duration' | 'hours' | 'binary';
  /** Which lookup provider backs this type, if any. */
  provider: 'tmdb-movie' | 'tmdb-tv' | 'openlibrary' | 'rawg' | null;
}

export const MEDIA_TYPES: Record<MediaType, MediaTypeConfig> = {
  book: {
    label: 'Book',
    plural: 'Books',
    icon: '📚',
    creatorLabel: 'Author',
    progressKind: 'pages',
    provider: 'openlibrary',
  },
  audiobook: {
    label: 'Audiobook',
    plural: 'Audiobooks',
    icon: '🎧',
    creatorLabel: 'Author / Narrator',
    progressKind: 'duration',
    provider: 'openlibrary',
  },
  tv: {
    label: 'TV Show',
    plural: 'TV',
    icon: '📺',
    creatorLabel: 'Network / Creator',
    progressKind: 'episodes',
    provider: 'tmdb-tv',
  },
  movie: {
    label: 'Movie',
    plural: 'Movies',
    icon: '🎬',
    creatorLabel: 'Director / Studio',
    progressKind: 'binary',
    provider: 'tmdb-movie',
  },
  game: {
    label: 'Video Game',
    plural: 'Games',
    icon: '🎮',
    creatorLabel: 'Developer',
    progressKind: 'hours',
    provider: 'rawg',
  },
  podcast: {
    label: 'Podcast',
    plural: 'Podcasts',
    icon: '🎙️',
    creatorLabel: 'Host',
    progressKind: 'duration',
    provider: null,
  },
  comic: {
    label: 'Comic / Manga',
    plural: 'Comics',
    icon: '💥',
    creatorLabel: 'Author / Artist',
    progressKind: 'pages',
    provider: null,
  },
};

export const MEDIA_TYPE_ORDER: MediaType[] = [
  'book',
  'tv',
  'movie',
  'game',
  'audiobook',
  'podcast',
  'comic',
];

export interface StatusConfig {
  label: string;
  /** Short verb-y description used in empty states. */
  blurb: string;
  color: string;
}

export const STATUSES: Record<Status, StatusConfig> = {
  active: { label: 'In Progress', blurb: 'things you are on right now', color: '#4ade80' },
  backlog: { label: 'Want To', blurb: 'things you plan to get to', color: '#60a5fa' },
  paused: { label: 'On Hold', blurb: 'started but set aside', color: '#fbbf24' },
  completed: { label: 'Finished', blurb: 'things you have been through', color: '#a78bfa' },
  dropped: { label: 'Dropped', blurb: 'things you gave up on', color: '#f87171' },
};

export const STATUS_ORDER: Status[] = ['active', 'backlog', 'paused', 'completed', 'dropped'];

export const PRIORITIES: Record<Priority, { label: string; weight: number }> = {
  high: { label: 'High', weight: 0 },
  medium: { label: 'Medium', weight: 1 },
  low: { label: 'Low', weight: 2 },
};
