# Shelf

A personal tracker for everything you read, watch, play and listen to — what you're
on right now, what you've finished, what you thought of it, and what's next.

Runs entirely in your browser. No account, no server, no one else's copy of your taste.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

To build a static copy you can host anywhere (Netlify, Vercel, GitHub Pages, a folder
on a NAS):

```bash
npm run build    # outputs dist/
npm run preview  # serve dist/ locally to check it
```

`dist/` must be served over HTTP — opening `index.html` straight off disk won't work,
because browsers block ES modules on `file://`.

## What it tracks

Seven media types, each with progress fields that fit it:

| Type | Progress tracked |
| --- | --- |
| 📚 Book, 💥 Comic / Manga | current page of total |
| 📺 TV Show | season, episode, episodes of total |
| 🎬 Movie | watched / not watched |
| 🎮 Video Game | hours played, percent complete |
| 🎧 Audiobook, 🎙️ Podcast | position and total length |

Five statuses — **In Progress**, **Want To**, **On Hold**, **Finished**, **Dropped** —
and four views:

- **Now** — what you're in the middle of, with one-tap progress bumps (`+1 episode`,
  `+10 pages`) and a box to log where you got to.
- **Library** — everything, searchable across titles, creators, tags and your own
  reviews, filterable by type and status.
- **Want To** — the waiting list, grouped by priority, with a 🎲 *Pick for me* button
  for when you can't decide.
- **Stats** — totals, pages read, hours played, ratings, and a breakdown by type.

Every item holds a half-star rating, a free-text review, tags, start and finish dates,
and a **session log** — dated entries that stamp where you were at the time, so you get
a timeline of how you moved through something.

## Title lookup

Search pulls in covers, creators, years, page counts and episode counts automatically.
Two of the three sources need a free API key, pasted into **Settings**:

| Source | Covers | Key |
| --- | --- | --- |
| [Open Library](https://openlibrary.org) | books, audiobooks | none needed |
| [TMDB](https://www.themoviedb.org/settings/api) | movies, TV | free — v3 API key |
| [RAWG](https://rawg.io/apidocs) | games | free |

Keys are stored in your browser only and are sent to their own API and nowhere else.
Everything works without them — podcasts and comics have no lookup source at all, and
any title can be typed in by hand from the *Add it manually* link.

> RAWG is used instead of IGDB because IGDB can't be called from a browser: it blocks
> cross-origin requests and needs a server-side token exchange, which an app with no
> backend doesn't have.

## Your data

Everything lives in this browser's `localStorage` under the key `shelf.db`. That means
it's private and works offline, but also that **clearing site data wipes it**. Use
**Settings → Export** to download a JSON backup and keep it somewhere synced.

Importing merges by id, then by type + title, so re-importing a backup updates existing
entries instead of duplicating them. Backups contain your library only — API keys are
never included in the export.

The app is installable: with the built version open, your browser's *Install* / *Add to
Home Screen* option gives it an icon and its own window, and a service worker caches the
shell so it opens with no connection.

## Tests

```bash
npm test
```

Bundles the lookup module and runs it against stubbed API payloads, then builds the app
and drives the real thing in a headless browser — adding items, type-aware progress, the
session log, persistence across reloads, the backup round trip, phone layout, and the
offline shell. If Playwright hasn't downloaded a browser yet, run
`npx playwright install chromium` first, or point `CHROMIUM_PATH` at one you already have.

The stubbed tests verify this app's parsing and error handling, not the upstream APIs —
those response shapes are taken from each provider's documentation.

## Layout

```
src/
  types.ts              data model + the media-type and status registries
  store.tsx             React context holding the library, persisted on every change
  api/providers.ts      Open Library / TMDB / RAWG search and detail lookup
  lib/
    storage.ts          load, save, and defensively normalize stored data
    progress.ts         percent-complete, position labels, quick-advance
    exportImport.ts     backup download and merge-on-import
    status.ts           the date bookkeeping that rides along with status changes
  components/           dialogs, cards, and shared UI primitives
  views/                Now, Library, Want To, Stats
```

Adding a media type is a matter of one entry in `MEDIA_TYPES` (plus a `progressKind`
branch in `progress.ts` if it needs a shape none of the others use).
