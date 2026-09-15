import { MediaType, MEDIA_TYPES, Progress, Settings, SourceRef } from '../types';

/** A normalized hit from any provider, ready to become an Item. */
export interface SearchResult {
  provider: SourceRef['provider'];
  id: string;
  title: string;
  creator?: string;
  year?: number;
  coverUrl?: string;
  /** Totals we can pre-fill on the item's progress (page count, episodes...). */
  totals?: Pick<Progress, 'totalPages' | 'totalEpisodes' | 'totalMinutes'>;
  /** Typical playtime in hours, games only. */
  typicalHours?: number;
  blurb?: string;
  url?: string;
}

export class LookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LookupError';
  }
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342';

async function getJson(url: string, providerLabel: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new LookupError(
      `Couldn't reach ${providerLabel}. Check your connection, or add the title manually.`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new LookupError(`${providerLabel} rejected the API key. Check it in Settings.`);
  }
  if (res.status === 429) {
    throw new LookupError(`${providerLabel} is rate-limiting requests. Wait a moment and retry.`);
  }
  if (!res.ok) {
    throw new LookupError(`${providerLabel} returned an error (${res.status}).`);
  }
  return res.json();
}

function yearOf(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) && y > 0 ? y : undefined;
}

/* ---------------------------------- books --------------------------------- */

async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
  const url =
    'https://openlibrary.org/search.json?limit=12&fields=key,title,author_name,' +
    `first_publish_year,cover_i,number_of_pages_median&q=${encodeURIComponent(query)}`;
  const data = await getJson(url, 'Open Library');
  const docs: any[] = Array.isArray(data?.docs) ? data.docs : [];
  return docs.map((d) => ({
    provider: 'openlibrary' as const,
    id: String(d.key ?? ''),
    title: String(d.title ?? 'Untitled'),
    creator: Array.isArray(d.author_name) ? d.author_name.slice(0, 2).join(', ') : undefined,
    year: typeof d.first_publish_year === 'number' ? d.first_publish_year : undefined,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    totals: d.number_of_pages_median ? { totalPages: d.number_of_pages_median } : undefined,
    url: d.key ? `https://openlibrary.org${d.key}` : undefined,
  }));
}

/* ------------------------------ movies and TV ----------------------------- */

async function searchTmdb(
  query: string,
  kind: 'movie' | 'tv',
  key: string,
): Promise<SearchResult[]> {
  if (!key) {
    throw new LookupError('Add a TMDB API key in Settings to look up movies and TV.');
  }
  const url =
    `https://api.themoviedb.org/3/search/${kind}?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query)}&include_adult=false`;
  const data = await getJson(url, 'TMDB');
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  return results.slice(0, 12).map((r) => ({
    provider: 'tmdb' as const,
    id: String(r.id),
    title: String(kind === 'movie' ? (r.title ?? r.original_title) : (r.name ?? r.original_name)),
    year: yearOf(kind === 'movie' ? r.release_date : r.first_air_date),
    coverUrl: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : undefined,
    blurb: typeof r.overview === 'string' ? r.overview : undefined,
    url: `https://www.themoviedb.org/${kind}/${r.id}`,
  }));
}

/**
 * Search results omit runtime, episode counts and credits, so pull the detail
 * record once the user actually picks a title.
 */
async function enrichTmdb(
  result: SearchResult,
  kind: 'movie' | 'tv',
  key: string,
): Promise<SearchResult> {
  const url =
    `https://api.themoviedb.org/3/${kind}/${result.id}?api_key=${encodeURIComponent(key)}` +
    (kind === 'movie' ? '&append_to_response=credits' : '');
  const d = await getJson(url, 'TMDB');
  if (kind === 'movie') {
    const director = (d?.credits?.crew ?? []).find((c: any) => c.job === 'Director')?.name;
    const studio = Array.isArray(d?.production_companies) ? d.production_companies[0]?.name : undefined;
    return {
      ...result,
      creator: director ?? studio,
      totals: d?.runtime ? { totalMinutes: d.runtime } : result.totals,
    };
  }
  const creator = Array.isArray(d?.created_by) && d.created_by.length
    ? d.created_by.map((c: any) => c.name).join(', ')
    : Array.isArray(d?.networks) && d.networks.length
      ? d.networks[0]?.name
      : undefined;
  return {
    ...result,
    creator,
    totals: d?.number_of_episodes ? { totalEpisodes: d.number_of_episodes } : result.totals,
  };
}

/* ---------------------------------- games --------------------------------- */

async function searchRawg(query: string, key: string): Promise<SearchResult[]> {
  if (!key) {
    throw new LookupError('Add a RAWG API key in Settings to look up games.');
  }
  const url =
    `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}` +
    `&search=${encodeURIComponent(query)}&page_size=12`;
  const data = await getJson(url, 'RAWG');
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  return results.map((r) => ({
    provider: 'rawg' as const,
    id: String(r.id),
    title: String(r.name ?? 'Untitled'),
    year: yearOf(r.released),
    coverUrl: typeof r.background_image === 'string' ? r.background_image : undefined,
    typicalHours: typeof r.playtime === 'number' && r.playtime > 0 ? r.playtime : undefined,
    url: r.slug ? `https://rawg.io/games/${r.slug}` : undefined,
  }));
}

async function enrichRawg(result: SearchResult, key: string): Promise<SearchResult> {
  const d = await getJson(
    `https://api.rawg.io/api/games/${result.id}?key=${encodeURIComponent(key)}`,
    'RAWG',
  );
  const developer = Array.isArray(d?.developers) && d.developers.length
    ? d.developers[0]?.name
    : Array.isArray(d?.publishers) && d.publishers.length
      ? d.publishers[0]?.name
      : undefined;
  return { ...result, creator: developer };
}

/* --------------------------------- dispatch -------------------------------- */

/** Whether this media type can be looked up at all, given current settings. */
export function lookupAvailability(
  type: MediaType,
  settings: Settings,
): { supported: boolean; ready: boolean; needs?: string } {
  const provider = MEDIA_TYPES[type].provider;
  if (!provider) return { supported: false, ready: false };
  if (provider === 'openlibrary') return { supported: true, ready: true };
  if (provider === 'rawg') {
    return { supported: true, ready: Boolean(settings.rawgKey), needs: 'RAWG API key' };
  }
  return { supported: true, ready: Boolean(settings.tmdbKey), needs: 'TMDB API key' };
}

export async function searchProvider(
  type: MediaType,
  query: string,
  settings: Settings,
): Promise<SearchResult[]> {
  const provider = MEDIA_TYPES[type].provider;
  switch (provider) {
    case 'openlibrary':
      return searchOpenLibrary(query);
    case 'tmdb-movie':
      return searchTmdb(query, 'movie', settings.tmdbKey);
    case 'tmdb-tv':
      return searchTmdb(query, 'tv', settings.tmdbKey);
    case 'rawg':
      return searchRawg(query, settings.rawgKey);
    default:
      throw new LookupError('No lookup source is wired up for this type — add it manually.');
  }
}

/**
 * Best-effort detail fetch. A failure here is not worth blocking on: the search
 * hit already carries title, year and cover, so fall back to it.
 */
export async function enrichResult(
  type: MediaType,
  result: SearchResult,
  settings: Settings,
): Promise<SearchResult> {
  try {
    const provider = MEDIA_TYPES[type].provider;
    if (provider === 'tmdb-movie') return await enrichTmdb(result, 'movie', settings.tmdbKey);
    if (provider === 'tmdb-tv') return await enrichTmdb(result, 'tv', settings.tmdbKey);
    if (provider === 'rawg') return await enrichRawg(result, settings.rawgKey);
    return result;
  } catch {
    return result;
  }
}
