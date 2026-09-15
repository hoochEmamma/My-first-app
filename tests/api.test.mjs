/**
 * Provider parsing and error handling, against stubbed responses shaped like
 * each API's documented payload. No network access required.
 */
import { searchProvider, enrichResult, lookupAvailability, LookupError } from './.tmp/providers.mjs';

export default async function run(check) {
  const routes = new Map();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    for (const [frag, res] of routes) {
      if (String(url).includes(frag)) {
        if (typeof res === 'number') return { ok: false, status: res, json: async () => ({}) };
        if (res === 'throw') throw new TypeError('Failed to fetch');
        return { ok: true, status: 200, json: async () => res };
      }
    }
    throw new Error(`unstubbed url: ${url}`);
  };

  const keys = { tmdbKey: 'K', rawgKey: 'K' };

  routes.set('openlibrary.org/search.json', {
    docs: [{ key: '/works/OL20659236W', title: 'Piranesi', author_name: ['Susanna Clarke'],
             first_publish_year: 2020, cover_i: 10523193, number_of_pages_median: 245 }],
  });
  {
    const [r] = await searchProvider('book', 'piranesi', keys);
    check('openlibrary maps core fields', r.title === 'Piranesi' && r.creator === 'Susanna Clarke' && r.year === 2020);
    check('openlibrary builds cover url', r.coverUrl === 'https://covers.openlibrary.org/b/id/10523193-M.jpg', r.coverUrl);
    check('openlibrary pre-fills page count', r.totals?.totalPages === 245);
    check('openlibrary links back to the work', r.url === 'https://openlibrary.org/works/OL20659236W', r.url);
  }

  routes.set('/search/tv', { results: [{ id: 95396, name: 'Severance', first_air_date: '2022-02-17',
                                         poster_path: '/abc.jpg', overview: 'Work-life balance, surgically.' }] });
  routes.set('/3/tv/95396', { number_of_episodes: 19, created_by: [{ name: 'Dan Erickson' }], networks: [{ name: 'Apple TV+' }] });
  {
    const [r] = await searchProvider('tv', 'severance', keys);
    check('tmdb tv reads name and air date', r.title === 'Severance' && r.year === 2022);
    check('tmdb builds poster url', r.coverUrl === 'https://image.tmdb.org/t/p/w342/abc.jpg', r.coverUrl);
    const e = await enrichResult('tv', r, keys);
    check('tmdb enrich adds episode total', e.totals?.totalEpisodes === 19);
    check('tmdb enrich prefers creator over network', e.creator === 'Dan Erickson', e.creator);
  }

  routes.set('/search/movie', { results: [{ id: 27205, title: 'Inception', release_date: '2010-07-15', poster_path: '/i.jpg' }] });
  routes.set('/3/movie/27205', { runtime: 148, credits: { crew: [{ job: 'Editor', name: 'X' }, { job: 'Director', name: 'Christopher Nolan' }] } });
  {
    const [r] = await searchProvider('movie', 'inception', keys);
    const e = await enrichResult('movie', r, keys);
    check('tmdb movie finds the director among crew', e.creator === 'Christopher Nolan', e.creator);
    check('tmdb movie captures runtime', e.totals?.totalMinutes === 148);
  }

  routes.set('rawg.io/api/games?', { results: [{ id: 3498, name: 'Outer Wilds', released: '2019-05-28',
                                                 background_image: 'https://m.rawg.io/x.jpg', playtime: 21, slug: 'outer-wilds' }] });
  routes.set('rawg.io/api/games/3498', { developers: [{ name: 'Mobius Digital' }] });
  {
    const [r] = await searchProvider('game', 'outer wilds', keys);
    check('rawg maps name, year and playtime', r.title === 'Outer Wilds' && r.year === 2019 && r.typicalHours === 21);
    const e = await enrichResult('game', r, keys);
    check('rawg enrich adds developer', e.creator === 'Mobius Digital', e.creator);
  }

  {
    const noKeys = { tmdbKey: '', rawgKey: '' };
    check('books need no key', lookupAvailability('book', noKeys).ready === true);
    check('tv reports the key it needs', lookupAvailability('tv', noKeys).needs === 'TMDB API key');
    check('podcasts report no lookup source', lookupAvailability('podcast', keys).supported === false);

    let msg = '';
    try { await searchProvider('tv', 'x', noKeys); } catch (e) { msg = e instanceof LookupError ? e.message : 'wrong error type'; }
    check('missing key fails with a fixable message', msg.includes('Settings'), msg);

    routes.set('/search/movie', 401);
    msg = '';
    try { await searchProvider('movie', 'x', keys); } catch (e) { msg = e.message; }
    check('401 points at the key, not the network', msg.includes('rejected the API key'), msg);

    routes.set('/search/movie', 'throw');
    msg = '';
    try { await searchProvider('movie', 'x', keys); } catch (e) { msg = e.message; }
    check('network failure suggests manual entry', msg.includes('manually'), msg);

    routes.set('/3/tv/95396', 500);
    const e = await enrichResult('tv', { provider: 'tmdb', id: '95396', title: 'Severance', year: 2022 }, keys);
    check('a failed enrich falls back to the search hit', e.title === 'Severance' && e.year === 2022);
  }

  globalThis.fetch = realFetch;
}
