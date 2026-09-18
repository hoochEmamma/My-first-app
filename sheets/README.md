# SHELF — the spreadsheet build

A content tracker that lives in Google Sheets and looks like a Diablo II
inventory screen. The script builds and themes the whole spreadsheet itself, so
there is nothing to upload and no file to convert.

## Install

1. Make a blank spreadsheet at [sheets.new](https://sheets.new).
2. **Extensions → Apps Script.**
3. Replace the contents of `Code.gs` with this folder's `Code.gs`.
4. **File → + → HTML**, name it exactly `Sidebar` (Apps Script adds the `.html`
   itself — a file called `Sidebar.html.html` is the usual mistake), and paste in
   `Sidebar.html`.
5. Save with Ctrl/Cmd+S.
6. Go back to the spreadsheet tab and **reload the page**.
7. **⚔ SHELF → ⭐ BUILD THE SHEET (start here).** Approve the permission prompt;
   the "Google hasn't verified this app" screen is expected for a script you
   pasted yourself — *Advanced* → *Go to … (unsafe)* → *Allow*.
8. Reload once more. The full menu appears.

There is no need to touch the function dropdown or the **Run** button in the
editor. The menu is built by `onOpen`, which is a simple trigger and needs no
authorization, so it shows up on reload whether or not the sheet has been built
yet. Before the first build the menu deliberately offers only the build step.

## The four tabs

| Tab | What it is |
| --- | --- |
| **CHARACTER** | Your stats screen. Counts, totals, what you're part-way through, and a treasure-class breakdown. All formulas. |
| **STASH** | One row per thing. This is the only tab you type in. |
| **QUEST LOG** | Dated entries for where you got to. Newest first. |
| **CUBE** | The transmutation tables: which unit each type counts in, and how far one tap moves you. Edit these. |

## Rarity

Your rating is the item's rarity, which is the whole joke and also genuinely
useful — a five-star book reads as a gold drop from across the sheet.

| Rating | Tier | Colour |
| --- | --- | --- |
| 5 | Unique | gold |
| 4 – 4.5 | Set | green |
| 3 – 3.5 | Rare | yellow |
| 2 – 2.5 | Magic | blue |
| 0.5 – 1.5 | Normal | white |

The title column takes the rarity colour too, so the STASH reads like a loot
list. Progress draws as `█████░░░░░░░` — Sheets has no data bars, and a blocky
text gauge suits the era better anyway.

## The stash panel

**⚔ SHELF → Open the stash panel** opens the sidebar. It does two things:

**Seek** — search Open Library, TMDB or RAWG and add a result as one row, with
creator, year, cover source, episode or page counts filled in. Pick whether it
lands as Want To, In Progress or Finished.

**Equipped** — shows the STASH row your cursor is on, with its bar, and three
buttons: advance one step, vanquish (mark finished), and log an entry. The step
size comes from the CUBE: 10 pages, 1 episode, 15 minutes, 1 hour.

The same three actions are on the ⚔ SHELF menu if you'd rather keep the sidebar
closed.

## Keys

**⚔ SHELF → Set API keys.** Books, audiobooks and comics use Open Library and
need no key. Films and TV need a free [TMDB](https://www.themoviedb.org/settings/api)
key (the v3 one); games need a free [RAWG](https://rawg.io/apidocs) key.
Podcasts have no lookup source — type those in by hand.

Keys go in Script Properties, not in a cell, so they are not part of the
spreadsheet and don't travel if you share it. Lookup runs server-side, which is
also why this build could use IGDB for games if you ever wanted it — the browser
version couldn't, since IGDB blocks cross-origin calls.

## Tests

```bash
node tests/logic.test.mjs      # rarity tiers, bar rendering, unit and step tables
node tests/formulas.test.mjs   # runs the real builders against a stubbed Sheets API
```

`formulas.test.mjs` is the one that matters: it executes `buildStash_` and
`buildCharacter_` against a recording stub and asserts on the exact formula
strings Google would receive, so a column reference can't silently drift out of
sync with the `COL` map.

What the tests cannot cover: none of this has been run inside Google. The
formulas, colours and API calls are verified by construction and by the rendered
sidebar, not by a live spreadsheet.
