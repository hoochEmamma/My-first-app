/**
 * SHELF - a content tracker with a Diablo II paint job.
 *
 * Builds and themes the whole spreadsheet itself, adds title lookup against
 * Open Library / TMDB / RAWG, and gives one-tap progress from a sidebar.
 *
 * Install: Extensions > Apps Script, paste this as Code.gs and Sidebar.html,
 * save, then run setupShelf() once.
 */

/* ========================= palette and vocabulary ========================= */

const C = {
  void:      '#0a0806',   // the black behind everything
  panel:     '#16120d',
  panelAlt:  '#1f1913',
  rule:      '#6b5a3e',   // ornate border gold
  gold:      '#c7b377',   // D2 body gold
  goldBright:'#e6c757',
  parchment: '#e8e0d0',
  muted:     '#8a7b63',
  blood:     '#a33a3a',
  bloodDeep: '#5c1f1f',
  mana:      '#4a4ad8',
};

// Item rarity colors, straight off the drop.
const RARITY = {
  Unique: '#bfa76a',
  Set:    '#22c022',
  Rare:   '#ffff6e',
  Magic:  '#6a6aff',
  Normal: '#e8e0d0',
};

const TYPES = ['Book', 'TV Show', 'Movie', 'Video Game', 'Audiobook', 'Podcast', 'Comic / Manga'];
const UNITS = ['pages', 'episodes', 'watched', 'hours', 'minutes', 'minutes', 'pages'];

// How far one tap moves you, per type.
const STEP = { Book: 10, 'TV Show': 1, Movie: 1, 'Video Game': 1, Audiobook: 15, Podcast: 15, 'Comic / Manga': 10 };

const STATUSES = ['In Progress', 'Want To', 'On Hold', 'Finished', 'Abandoned'];
const STATUS_COLOR = {
  'In Progress': C.goldBright,
  'Want To':     '#6a6aff',
  'On Hold':     '#ffa338',
  'Finished':    '#22c022',
  'Abandoned':   C.blood,
};

const PRIORITIES = ['High', 'Medium', 'Low'];
const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const STASH = 'STASH';
const CHAR = 'CHARACTER';
const QUEST = 'QUEST LOG';
const CUBE = 'CUBE';

const ROWS = 200;      // how far formulas and dropdowns run on STASH
const LOG_ROWS = 300;
const BAR_LEN = 12;    // segments in the text progress bar

// STASH columns, 1-indexed. Changing the order here changes it everywhere.
const COL = {
  title: 1, type: 2, creator: 3, year: 4, status: 5, priority: 6,
  current: 7, total: 8, unit: 9, pct: 10, bar: 11, where: 12,
  rating: 13, rarity: 14, review: 15, tags: 16, started: 17, finished: 18,
  fav: 19, link: 20, notes: 21, rank: 22,
};
const LAST_COL = COL.rank;

/* ============================== pure helpers ============================== */

/** Rating -> item rarity tier. Unrated things have no tier. */
function rarityFor(rating) {
  if (rating === '' || rating === null || rating === undefined) return '';
  const n = Number(rating);
  if (isNaN(n)) return '';
  if (n >= 5) return 'Unique';
  if (n >= 4) return 'Set';
  if (n >= 3) return 'Rare';
  if (n >= 2) return 'Magic';
  return 'Normal';
}

/** 0..1 -> a blocky bar, the way a 1998 status screen would draw it. */
function renderBar(fraction, length) {
  const len = length || BAR_LEN;
  if (fraction === '' || fraction === null || fraction === undefined) return '';
  const n = Number(fraction);
  if (isNaN(n)) return '';
  const filled = Math.max(0, Math.min(len, Math.round(n * len)));
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

/** The unit Current/Total are counted in, for a given type. */
function unitFor(type) {
  const i = TYPES.indexOf(type);
  return i === -1 ? '' : UNITS[i];
}

/** How much one tap of "advance" adds, for a given type. */
function stepFor(type) {
  return STEP[type] || 1;
}

/* ================================== menu ================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚔ SHELF')
    .addItem('Open the stash panel', 'showSidebar')
    .addSeparator()
    .addItem('Advance selected row', 'advanceSelected')
    .addItem('Mark selected finished', 'finishSelected')
    .addItem('Log an entry for selected row', 'logSelected')
    .addSeparator()
    .addItem('Set API keys', 'setKeys')
    .addItem('Rebuild / re-theme sheet', 'setupShelf')
    .addItem('Delete the example rows', 'clearExamples')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('⚔ SHELF');
  SpreadsheetApp.getUi().showSidebar(html);
}

/* ================================= setup ================================== */

function setupShelf() {
  const ss = SpreadsheetApp.getActive();
  buildCube_(ss);
  buildStash_(ss);
  buildQuest_(ss);
  buildCharacter_(ss);

  // Drop whatever blank sheet the spreadsheet was created with.
  ss.getSheets().forEach(function (s) {
    if ([STASH, CHAR, QUEST, CUBE].indexOf(s.getName()) === -1) ss.deleteSheet(s);
  });

  ss.setActiveSheet(ss.getSheetByName(CHAR));
  SpreadsheetApp.getUi().alert(
    'SHELF is ready.\n\n' +
    'Reload the page to get the ⚔ SHELF menu, then open the stash panel ' +
    'to search for titles.\n\n' +
    'Set your API keys from the menu first if you want lookup for ' +
    'films, TV and games. Books need no key.'
  );
}

/** Wipes and returns a sheet by name, creating it if needed. */
function resetSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getDataValidations();          // no-op read; validations are cleared per range below
  if (sh.getMaxRows() > 1) sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.setTabColor(C.rule);
  sh.setHiddenGridlines(true);
  return sh;
}

/** The dark stone background every sheet sits on. */
function paint_(sh) {
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setBackground(C.void)
    .setFontFamily('Georgia')
    .setFontColor(C.parchment)
    .setFontSize(10);
}

function headerRow_(sh, row, labels) {
  const r = sh.getRange(row, 1, 1, labels.length);
  r.setValues([labels])
    .setBackground(C.bloodDeep)
    .setFontColor(C.goldBright)
    .setFontFamily('Georgia')
    .setFontSize(10)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, C.rule, SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(row, 28);
}

/* ------------------------------- CUBE ------------------------------------ */

function buildCube_(ss) {
  const sh = resetSheet_(ss, CUBE);
  paint_(sh);
  sh.getRange('A1').setValue('THE HORADRIC CUBE')
    .setFontColor(C.goldBright).setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setValue('Transmutation tables. The STASH reads these - edit the units if you like.')
    .setFontColor(C.muted).setFontStyle('italic');

  headerRow_(sh, 4, ['Type', 'Unit for Current / Total', 'One tap adds']);
  const rows = TYPES.map(function (t, i) { return [t, UNITS[i], STEP[t] || 1]; });
  sh.getRange(5, 1, rows.length, 3).setValues(rows).setFontColor(C.parchment);

  headerRow_(sh, 14, ['Rating', 'Rarity']);
  const tiers = [['5', 'Unique'], ['4 - 4.5', 'Set'], ['3 - 3.5', 'Rare'], ['2 - 2.5', 'Magic'], ['0.5 - 1.5', 'Normal']];
  sh.getRange(15, 1, tiers.length, 2).setValues(tiers);
  tiers.forEach(function (t, i) {
    sh.getRange(15 + i, 2).setFontColor(RARITY[t[1]]).setFontWeight('bold');
  });

  sh.setColumnWidth(1, 140);
  sh.setColumnWidth(2, 210);
  sh.setColumnWidth(3, 110);
}

/* ------------------------------- STASH ----------------------------------- */

function buildStash_(ss) {
  const sh = resetSheet_(ss, STASH);
  paint_(sh);

  const heads = ['Title', 'Type', 'Creator', 'Year', 'Status', 'Priority', 'Current', 'Total',
    'Unit', '%', 'Progress', 'Where I Am', 'Rating', 'Rarity', 'Review', 'Tags',
    'Started', 'Finished', 'Fav', 'Link', 'Notes', '#'];
  headerRow_(sh, 1, heads);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  const widths = [230, 110, 150, 55, 105, 80, 70, 70, 80, 55, 130, 110, 65, 80, 280, 140, 95, 95, 45, 160, 220, 40];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  // Formula columns, armed all the way down so new rows just work.
  const unit = [], pct = [], bar = [], rarity = [], rank = [];
  for (let r = 2; r <= ROWS; r++) {
    unit.push(['=IFERROR(INDEX(' + CUBE + "!$B$5:$B$11,MATCH(B" + r + ',' + CUBE + '!$A$5:$A$11,0)),"")']);
    pct.push(['=IF(E' + r + '="Finished",1,IFERROR(G' + r + '/H' + r + ',""))']);
    bar.push(['=IF(J' + r + '="","",REPT("█",ROUND(J' + r + '*' + BAR_LEN + ',0))&REPT("░",' +
      BAR_LEN + '-ROUND(J' + r + '*' + BAR_LEN + ',0)))']);
    rarity.push(['=IFS(M' + r + '="","",M' + r + '>=5,"Unique",M' + r + '>=4,"Set",M' + r +
      '>=3,"Rare",M' + r + '>=2,"Magic",TRUE,"Normal")']);
    rank.push(['=IF($E' + r + '="In Progress",COUNTIFS($E$2:$E' + r + ',"In Progress"),"")']);
  }
  sh.getRange(2, COL.unit, unit.length, 1).setFormulas(unit).setFontColor(C.muted).setFontStyle('italic');
  sh.getRange(2, COL.pct, pct.length, 1).setFormulas(pct).setNumberFormat('0%').setFontColor(C.gold);
  sh.getRange(2, COL.bar, bar.length, 1).setFormulas(bar).setFontColor(C.goldBright).setFontFamily('Courier New');
  sh.getRange(2, COL.rarity, rarity.length, 1).setFormulas(rarity).setFontWeight('bold');
  sh.getRange(2, COL.rank, rank.length, 1).setFormulas(rank).setFontColor(C.muted);
  sh.hideColumns(COL.rank);

  sh.getRange(2, COL.title, ROWS - 1, 1).setFontColor(C.parchment).setFontWeight('bold');
  sh.getRange(2, COL.started, ROWS - 1, 2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, COL.rating, ROWS - 1, 1).setNumberFormat('0.0').setHorizontalAlignment('center');

  dropdown_(sh, COL.type, TYPES);
  dropdown_(sh, COL.status, STATUSES);
  dropdown_(sh, COL.priority, PRIORITIES);
  dropdown_(sh, COL.rating, RATINGS);
  sh.getRange(2, COL.fav, ROWS - 1, 1).insertCheckboxes();

  const rules = [];
  STATUSES.forEach(function (s) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(s)
      .setBackground(C.panelAlt)
      .setFontColor(STATUS_COLOR[s])
      .setBold(true)
      .setRanges([sh.getRange(2, COL.status, ROWS - 1, 1)])
      .build());
  });
  Object.keys(RARITY).forEach(function (tier) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(tier)
      .setFontColor(RARITY[tier])
      .setBackground(C.panel)
      .setBold(true)
      .setRanges([sh.getRange(2, COL.rarity, ROWS - 1, 1)])
      .build());
    // A rare drop should read as one across the row.
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$N2="' + tier + '"')
      .setFontColor(RARITY[tier])
      .setRanges([sh.getRange(2, COL.title, ROWS - 1, 1)])
      .build());
  });
  sh.setConditionalFormatRules(rules);

  const examples = [
    ['Piranesi', 'Book', 'Susanna Clarke', 2020, 'In Progress', 'Medium', 148, 245, null, null, null,
      '', 4.5, null, 'Strange and quiet. Halls 40-62 in one sitting.', 'fantasy',
      new Date(2026, 8, 5), '', false, '', 'EXAMPLE - delete me'],
    ['Severance', 'TV Show', 'Dan Erickson', 2022, 'In Progress', 'High', 5, 19, null, null, null,
      'S2 E5', null, null, '', 'sci-fi', new Date(2026, 7, 2), '', true, '', 'EXAMPLE - delete me'],
    ['Disco Elysium', 'Video Game', 'ZA/UM', 2019, 'Finished', 'Medium', 41, 41, null, null, null,
      '', 5, null, 'Best writing in the medium.', 'rpg',
      new Date(2026, 3, 2), new Date(2026, 4, 20), true, '', 'EXAMPLE - delete me'],
  ];
  examples.forEach(function (row, i) {
    row.forEach(function (v, c) {
      if (v === null) return;                       // leave the formula columns alone
      sh.getRange(2 + i, c + 1).setValue(v);
    });
  });
}

function dropdown_(sh, col, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, col, ROWS - 1, 1).setDataValidation(rule);
}

/* ----------------------------- QUEST LOG --------------------------------- */

function buildQuest_(ss) {
  const sh = resetSheet_(ss, QUEST);
  paint_(sh);
  headerRow_(sh, 1, ['Date', 'Title', 'Where I Was', 'What Happened']);
  sh.setFrozenRows(1);
  [110, 230, 130, 620].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 1, LOG_ROWS, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(2, 2, LOG_ROWS, 1).setFontColor(C.gold).setFontWeight('bold');

  sh.getRange(2, 1, 2, 4).setValues([
    [new Date(2026, 8, 14), 'Severance', 'S2 E5', 'The pacing finally clicked. EXAMPLE - delete me.'],
    [new Date(2026, 8, 12), 'Piranesi', 'p. 148', 'Halls 40 through 62 in one sitting. EXAMPLE - delete me.'],
  ]);
}

/* ----------------------------- CHARACTER --------------------------------- */

function buildCharacter_(ss) {
  const sh = resetSheet_(ss, CHAR);
  paint_(sh);
  [40, 250, 120, 140, 150, 60, 420].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  sh.getRange('B2').setValue('S H E L F')
    .setFontColor(C.goldBright).setFontSize(26).setFontWeight('bold').setFontFamily('Georgia');
  sh.getRange('B3').setValue('Everything you have read, watched, played and heard.')
    .setFontColor(C.muted).setFontStyle('italic');

  const S = "'" + STASH + "'";
  const Q = "'" + QUEST + "'";
  const st = S + '!$E$2:$E$' + ROWS;
  const ty = S + '!$B$2:$B$' + ROWS;
  const cur = S + '!$G$2:$G$' + ROWS;
  const rt = S + '!$M$2:$M$' + ROWS;
  const fin = S + '!$R$2:$R$' + ROWS;

  banner_(sh, 5, 'CHARACTER');
  const stats = [
    ['Items in stash', '=COUNTA(' + S + '!$A$2:$A$' + ROWS + ')'],
    ['On the go', '=COUNTIF(' + st + ',"In Progress")'],
    ['Awaiting', '=COUNTIF(' + st + ',"Want To")'],
    ['Set aside', '=COUNTIF(' + st + ',"On Hold")'],
    ['Vanquished', '=COUNTIF(' + st + ',"Finished")'],
    ['Abandoned', '=COUNTIF(' + st + ',"Abandoned")'],
    ['Vanquished this year', '=COUNTIFS(' + st + ',"Finished",' + fin + ',">="&DATE(YEAR(TODAY()),1,1))'],
    ['Quest log entries', '=COUNTA(' + Q + '!$A$2:$A$' + LOG_ROWS + ')'],
    ['Average rating', '=IFERROR(AVERAGEIF(' + rt + ',">0"),"-")'],
    ['Pages turned', '=SUMIF(' + ty + ',"Book",' + cur + ')+SUMIF(' + ty + ',"Comic / Manga",' + cur + ')'],
    ['Hours played', '=SUMIF(' + ty + ',"Video Game",' + cur + ')'],
    ['Minutes heard', '=SUMIF(' + ty + ',"Audiobook",' + cur + ')+SUMIF(' + ty + ',"Podcast",' + cur + ')'],
  ];
  stats.forEach(function (s, i) {
    const r = 6 + i;
    sh.getRange(r, 2).setValue(s[0]).setFontColor(C.muted);
    sh.getRange(r, 3).setFormula(s[1]).setFontColor(C.goldBright).setFontWeight('bold').setFontSize(12);
  });
  sh.getRange(15, 3).setNumberFormat('0.0');
  sh.getRange(7, 7).setValue('Totals add up the Current column, so set Current = Total when you finish something.')
    .setFontColor(C.muted).setFontStyle('italic').setWrap(true);

  banner_(sh, 19, 'ON THE GO');
  sh.getRange(20, 2, 1, 4).setValues([['Title', 'Type', '%', 'Progress']])
    .setFontColor(C.gold).setFontWeight('bold');
  for (let k = 1; k <= 8; k++) {
    const r = 20 + k;
    const m = 'MATCH(' + k + ',' + S + '!$V$2:$V$' + ROWS + ',0)';
    sh.getRange(r, 2).setFormula('=IFERROR(INDEX(' + S + '!$A$2:$A$' + ROWS + ',' + m + '),"")')
      .setFontColor(C.parchment).setFontWeight('bold');
    sh.getRange(r, 3).setFormula('=IFERROR(INDEX(' + ty + ',' + m + '),"")').setFontColor(C.muted);
    sh.getRange(r, 4).setFormula('=IFERROR(INDEX(' + S + '!$J$2:$J$' + ROWS + ',' + m + '),"")')
      .setNumberFormat('0%').setFontColor(C.gold);
    sh.getRange(r, 5).setFormula('=IFERROR(INDEX(' + S + '!$K$2:$K$' + ROWS + ',' + m + '),"")')
      .setFontColor(C.goldBright).setFontFamily('Courier New');
  }

  banner_(sh, 31, 'BY TYPE');
  sh.getRange(32, 2, 1, 3).setValues([['Type', 'Held', 'Vanquished']]).setFontColor(C.gold).setFontWeight('bold');
  TYPES.forEach(function (t, i) {
    const r = 33 + i;
    sh.getRange(r, 2).setValue(t).setFontColor(C.parchment);
    sh.getRange(r, 3).setFormula('=COUNTIF(' + ty + ',$B' + r + ')').setFontColor(C.gold);
    sh.getRange(r, 4).setFormula('=COUNTIFS(' + ty + ',$B' + r + ',' + st + ',"Finished")').setFontColor(C.gold);
  });

  banner_(sh, 42, 'TREASURE CLASS');
  sh.getRange(43, 2, 1, 2).setValues([['Rarity', 'Count']]).setFontColor(C.gold).setFontWeight('bold');
  Object.keys(RARITY).forEach(function (tier, i) {
    const r = 44 + i;
    sh.getRange(r, 2).setValue(tier).setFontColor(RARITY[tier]).setFontWeight('bold');
    sh.getRange(r, 3).setFormula('=COUNTIF(' + S + '!$N$2:$N$' + ROWS + ',$B' + r + ')').setFontColor(C.gold);
  });
}

function banner_(sh, row, label) {
  sh.getRange(row, 2, 1, 5).merge()
    .setValue('❖  ' + label + '  ❖')
    .setBackground(C.bloodDeep)
    .setFontColor(C.goldBright)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBorder(true, true, true, true, false, false, C.rule, SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(row, 26);
}

/* ============================ row operations ============================== */

/** The STASH row the cursor is on, or null with a complaint shown. */
function selectedRow_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getActiveSheet();
  if (sh.getName() !== STASH) {
    SpreadsheetApp.getUi().alert('Stand in the STASH first, then pick a row.');
    return null;
  }
  const row = sh.getActiveRange().getRow();
  if (row < 2 || !sh.getRange(row, COL.title).getValue()) {
    SpreadsheetApp.getUi().alert('That row is empty.');
    return null;
  }
  return { sh: sh, row: row };
}

function advanceSelected() {
  const sel = selectedRow_();
  if (!sel) return;
  advanceRow(sel.row);
}

/** Adds one step of progress to a row. Also callable from the sidebar. */
function advanceRow(row) {
  const sh = SpreadsheetApp.getActive().getSheetByName(STASH);
  const type = sh.getRange(row, COL.type).getValue();
  const cur = Number(sh.getRange(row, COL.current).getValue()) || 0;
  const next = cur + stepFor(type);
  sh.getRange(row, COL.current).setValue(next);
  if (!sh.getRange(row, COL.status).getValue()) {
    sh.getRange(row, COL.status).setValue('In Progress');
  }
  if (!sh.getRange(row, COL.started).getValue()) {
    sh.getRange(row, COL.started).setValue(new Date());
  }
  return { current: next, unit: unitFor(type) };
}

function finishSelected() {
  const sel = selectedRow_();
  if (!sel) return;
  finishRow(sel.row);
}

function finishRow(row) {
  const sh = SpreadsheetApp.getActive().getSheetByName(STASH);
  sh.getRange(row, COL.status).setValue('Finished');
  if (!sh.getRange(row, COL.finished).getValue()) {
    sh.getRange(row, COL.finished).setValue(new Date());
  }
  const total = sh.getRange(row, COL.total).getValue();
  if (total) sh.getRange(row, COL.current).setValue(total);
  return true;
}

function logSelected() {
  const sel = selectedRow_();
  if (!sel) return;
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Quest log', 'What happened?', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  logRow(sel.row, res.getResponseText());
}

/** Appends a dated quest-log entry, stamped with where you were. */
function logRow(row, note) {
  if (!note) return false;
  const ss = SpreadsheetApp.getActive();
  const stash = ss.getSheetByName(STASH);
  const log = ss.getSheetByName(QUEST);

  const title = stash.getRange(row, COL.title).getValue();
  const where = stash.getRange(row, COL.where).getValue();
  const cur = stash.getRange(row, COL.current).getValue();
  const unit = unitFor(stash.getRange(row, COL.type).getValue());
  const at = where || (cur !== '' ? cur + ' ' + unit : '');

  log.insertRowBefore(2);
  log.getRange(2, 1, 1, 4).setValues([[new Date(), title, at, note]]);
  log.getRange(2, 1).setNumberFormat('yyyy-mm-dd');
  log.getRange(2, 1, 1, 4).setBackground(C.void).setFontColor(C.parchment).setFontFamily('Georgia');
  log.getRange(2, 2).setFontColor(C.gold).setFontWeight('bold');
  return true;
}

function clearExamples() {
  const ss = SpreadsheetApp.getActive();
  const stash = ss.getSheetByName(STASH);
  const log = ss.getSheetByName(QUEST);
  let removed = 0;

  for (let r = ROWS; r >= 2; r--) {
    const note = String(stash.getRange(r, COL.notes).getValue() || '');
    if (note.indexOf('EXAMPLE') === 0) {
      stash.getRange(r, 1, 1, LAST_COL).clearContent();
      // The formula columns are cleared with everything else; put them back.
      restoreFormulas_(stash, r);
      removed++;
    }
  }
  for (let r = LOG_ROWS; r >= 2; r--) {
    const note = String(log.getRange(r, 4).getValue() || '');
    if (note.indexOf('EXAMPLE') !== -1) { log.getRange(r, 1, 1, 4).clearContent(); removed++; }
  }
  SpreadsheetApp.getUi().alert('Cleared ' + removed + ' example rows.');
}

function restoreFormulas_(sh, r) {
  sh.getRange(r, COL.unit).setFormula('=IFERROR(INDEX(' + CUBE + "!$B$5:$B$11,MATCH(B" + r + ',' + CUBE + '!$A$5:$A$11,0)),"")');
  sh.getRange(r, COL.pct).setFormula('=IF(E' + r + '="Finished",1,IFERROR(G' + r + '/H' + r + ',""))');
  sh.getRange(r, COL.bar).setFormula('=IF(J' + r + '="","",REPT("█",ROUND(J' + r + '*' + BAR_LEN +
    ',0))&REPT("░",' + BAR_LEN + '-ROUND(J' + r + '*' + BAR_LEN + ',0)))');
  sh.getRange(r, COL.rarity).setFormula('=IFS(M' + r + '="","",M' + r + '>=5,"Unique",M' + r +
    '>=4,"Set",M' + r + '>=3,"Rare",M' + r + '>=2,"Magic",TRUE,"Normal")');
  sh.getRange(r, COL.rank).setFormula('=IF($E' + r + '="In Progress",COUNTIFS($E$2:$E' + r + ',"In Progress"),"")');
}

/* ============================== title lookup ============================== */
/*
 * Runs server-side, so keys never touch a cell and CORS is not a concern.
 * Books use Open Library (no key). Films and TV use TMDB, games use RAWG.
 */

const PROVIDER = {
  'Book': 'openlibrary',
  'Audiobook': 'openlibrary',
  'Comic / Manga': 'openlibrary',
  'Movie': 'tmdb-movie',
  'TV Show': 'tmdb-tv',
  'Video Game': 'rawg',
  'Podcast': null,
};

function setKeys() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const t = ui.prompt('TMDB key', 'For films and TV. Free at themoviedb.org (v3 auth key). ' +
    'Leave blank to keep the current one.', ui.ButtonSet.OK_CANCEL);
  if (t.getSelectedButton() !== ui.Button.OK) return;
  if (t.getResponseText().trim()) props.setProperty('TMDB_KEY', t.getResponseText().trim());

  const r = ui.prompt('RAWG key', 'For games. Free at rawg.io/apidocs. ' +
    'Leave blank to keep the current one.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  if (r.getResponseText().trim()) props.setProperty('RAWG_KEY', r.getResponseText().trim());

  ui.alert('Keys stored. Books and audiobooks need no key at all.');
}

function keys_() {
  const p = PropertiesService.getScriptProperties();
  return { tmdb: p.getProperty('TMDB_KEY') || '', rawg: p.getProperty('RAWG_KEY') || '' };
}

/** Which types the sidebar can search right now, given stored keys. */
function lookupStatus() {
  const k = keys_();
  const out = {};
  TYPES.forEach(function (t) {
    const p = PROVIDER[t];
    out[t] = {
      supported: !!p,
      ready: p === 'openlibrary' ? true : p === 'rawg' ? !!k.rawg : !!k.tmdb,
      needs: p === 'rawg' ? 'RAWG key' : p ? 'TMDB key' : '',
    };
  });
  return out;
}

function fetchJson_(url, label) {
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code === 401 || code === 403) throw new Error(label + ' rejected the key. Set it from the SHELF menu.');
  if (code === 429) throw new Error(label + ' is rate limiting. Wait a moment.');
  if (code >= 400) throw new Error(label + ' returned ' + code + '.');
  return JSON.parse(res.getContentText());
}

/**
 * Called from the sidebar. Returns plain objects so they survive the
 * google.script.run boundary.
 */
function searchTitles(type, query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const k = keys_();

  switch (PROVIDER[type]) {
    case 'openlibrary': {
      const d = fetchJson_('https://openlibrary.org/search.json?limit=12&fields=key,title,' +
        'author_name,first_publish_year,cover_i,number_of_pages_median&q=' + encodeURIComponent(q), 'Open Library');
      return (d.docs || []).map(function (x) {
        return {
          title: x.title || 'Untitled',
          creator: (x.author_name || []).slice(0, 2).join(', '),
          year: x.first_publish_year || '',
          cover: x.cover_i ? 'https://covers.openlibrary.org/b/id/' + x.cover_i + '-M.jpg' : '',
          total: x.number_of_pages_median || '',
          link: x.key ? 'https://openlibrary.org' + x.key : '',
        };
      });
    }
    case 'tmdb-movie':
    case 'tmdb-tv': {
      if (!k.tmdb) throw new Error('No TMDB key yet. Set it from the ⚔ SHELF menu.');
      const kind = PROVIDER[type] === 'tmdb-movie' ? 'movie' : 'tv';
      const d = fetchJson_('https://api.themoviedb.org/3/search/' + kind + '?api_key=' +
        encodeURIComponent(k.tmdb) + '&include_adult=false&query=' + encodeURIComponent(q), 'TMDB');
      return (d.results || []).slice(0, 12).map(function (x) {
        return {
          id: x.id, kind: kind,
          title: kind === 'movie' ? (x.title || x.original_title) : (x.name || x.original_name),
          creator: '',
          year: String(kind === 'movie' ? (x.release_date || '') : (x.first_air_date || '')).slice(0, 4),
          cover: x.poster_path ? 'https://image.tmdb.org/t/p/w185' + x.poster_path : '',
          total: '',
          blurb: x.overview || '',
          link: 'https://www.themoviedb.org/' + kind + '/' + x.id,
        };
      });
    }
    case 'rawg': {
      if (!k.rawg) throw new Error('No RAWG key yet. Set it from the ⚔ SHELF menu.');
      const d = fetchJson_('https://api.rawg.io/api/games?key=' + encodeURIComponent(k.rawg) +
        '&page_size=12&search=' + encodeURIComponent(q), 'RAWG');
      return (d.results || []).map(function (x) {
        return {
          id: x.id, kind: 'game',
          title: x.name || 'Untitled',
          creator: '',
          year: String(x.released || '').slice(0, 4),
          cover: x.background_image || '',
          total: x.playtime || '',
          link: x.slug ? 'https://rawg.io/games/' + x.slug : '',
        };
      });
    }
    default:
      throw new Error('No lookup source for ' + type + '. Add it by hand in the STASH.');
  }
}

/**
 * Second call for the details a search result omits - director, episode counts,
 * developer. Best effort: a failure here just means a thinner row.
 */
function enrich_(type, hit) {
  const k = keys_();
  try {
    if (PROVIDER[type] === 'tmdb-movie') {
      const d = fetchJson_('https://api.themoviedb.org/3/movie/' + hit.id + '?api_key=' +
        encodeURIComponent(k.tmdb) + '&append_to_response=credits', 'TMDB');
      const dir = ((d.credits || {}).crew || []).filter(function (c) { return c.job === 'Director'; })[0];
      hit.creator = dir ? dir.name : ((d.production_companies || [])[0] || {}).name || '';
      hit.total = d.runtime || '';
    } else if (PROVIDER[type] === 'tmdb-tv') {
      const d = fetchJson_('https://api.themoviedb.org/3/tv/' + hit.id + '?api_key=' +
        encodeURIComponent(k.tmdb), 'TMDB');
      hit.creator = (d.created_by || []).map(function (c) { return c.name; }).join(', ') ||
        ((d.networks || [])[0] || {}).name || '';
      hit.total = d.number_of_episodes || '';
    } else if (PROVIDER[type] === 'rawg') {
      const d = fetchJson_('https://api.rawg.io/api/games/' + hit.id + '?key=' +
        encodeURIComponent(k.rawg), 'RAWG');
      hit.creator = ((d.developers || [])[0] || {}).name ||
        ((d.publishers || [])[0] || {}).name || '';
    }
  } catch (err) {
    // keep the search hit as-is
  }
  return hit;
}

/** First empty STASH row, or 0 when the sheet is full. */
function firstFreeRow_(sh) {
  const titles = sh.getRange(2, COL.title, ROWS - 1, 1).getValues();
  for (let i = 0; i < titles.length; i++) {
    if (!titles[i][0]) return i + 2;
  }
  return 0;
}

/** Called from the sidebar when a search result is picked. */
function addResult(type, hit, status) {
  const sh = SpreadsheetApp.getActive().getSheetByName(STASH);
  const row = firstFreeRow_(sh);
  if (!row) throw new Error('The STASH is full. Widen ROWS in the script and rebuild.');

  const full = enrich_(type, hit);
  sh.getRange(row, COL.title).setValue(full.title);
  sh.getRange(row, COL.type).setValue(type);
  if (full.creator) sh.getRange(row, COL.creator).setValue(full.creator);
  if (full.year) sh.getRange(row, COL.year).setValue(Number(full.year) || full.year);
  if (full.total) sh.getRange(row, COL.total).setValue(Number(full.total) || full.total);
  if (full.link) sh.getRange(row, COL.link).setValue(full.link);
  sh.getRange(row, COL.status).setValue(status || 'Want To');
  sh.getRange(row, COL.priority).setValue('Medium');
  if (status === 'In Progress') sh.getRange(row, COL.started).setValue(new Date());
  if (status === 'Finished') {
    sh.getRange(row, COL.finished).setValue(new Date());
    if (full.total) sh.getRange(row, COL.current).setValue(Number(full.total) || 0);
  }
  sh.setActiveRange(sh.getRange(row, COL.title));
  return { row: row, title: full.title, creator: full.creator || '', unit: unitFor(type) };
}

/** What the sidebar shows for the row the cursor is on. */
function selectionInfo() {
  const sh = SpreadsheetApp.getActive().getActiveSheet();
  if (sh.getName() !== STASH) return null;
  const row = sh.getActiveRange().getRow();
  if (row < 2) return null;
  const title = sh.getRange(row, COL.title).getValue();
  if (!title) return null;
  const type = sh.getRange(row, COL.type).getValue();
  return {
    row: row,
    title: title,
    type: type,
    status: sh.getRange(row, COL.status).getValue(),
    current: sh.getRange(row, COL.current).getValue(),
    total: sh.getRange(row, COL.total).getValue(),
    pct: sh.getRange(row, COL.pct).getValue(),
    bar: sh.getRange(row, COL.bar).getValue(),
    rarity: sh.getRange(row, COL.rarity).getValue(),
    unit: unitFor(type),
    step: stepFor(type),
  };
}
