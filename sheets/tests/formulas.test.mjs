/*
 * Runs the real buildStash_ / buildCharacter_ against a recording stub of the
 * Apps Script API, then inspects the formulas Google would actually receive.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const recorded = { formulas: new Map(), validations: [], checkboxRanges: [] };

/*
 * The stub only answers to methods that genuinely exist on the Apps Script
 * classes. Anything else throws, so inventing an API (this caught a call to
 * Sheet.getDataValidations, which only exists on Range) fails the test here
 * instead of at setup time in Google.
 */
const SHEET_API = new Set(['getName', 'getMaxRows', 'getMaxColumns', 'clear',
  'clearConditionalFormatRules', 'setTabColor', 'setHiddenGridlines', 'setFrozenRows',
  'setFrozenColumns', 'setColumnWidth', 'setRowHeight', 'hideColumns',
  'setConditionalFormatRules', 'insertRowBefore', 'setActiveRange', 'getRange',
  'getActiveRange', 'name']);

const RANGE_API = new Set(['setValues', 'setValue', 'setBackground', 'setFontColor',
  'setFontFamily', 'setFontSize', 'setFontWeight', 'setFontStyle', 'setVerticalAlignment',
  'setHorizontalAlignment', 'setBorder', 'setNumberFormat', 'setWrap', 'merge',
  'clearContent', 'clearDataValidations', 'getValues', 'getValue', 'getRow',
  'setDataValidation', 'insertCheckboxes', 'setFormula', 'setFormulas']);

function guard(target, allowed, label) {
  return new Proxy(target, {
    get(obj, prop) {
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'inspect') return undefined;
      if (!allowed.has(prop)) {
        throw new TypeError(`${label}.${String(prop)} is not a real Apps Script method`);
      }
      return obj[prop];
    },
  });
}

function makeRange(sheet, row, col, nRows, nCols) {
  const r = {
    setValues: () => r, setValue: () => r, setBackground: () => r, setFontColor: () => r,
    setFontFamily: () => r, setFontSize: () => r, setFontWeight: () => r, setFontStyle: () => r,
    setVerticalAlignment: () => r, setHorizontalAlignment: () => r, setBorder: () => r,
    setNumberFormat: () => r, setWrap: () => r, merge: () => r, clearContent: () => r,
    clearDataValidations: () => r, getValues: () => Array.from({ length: nRows }, () => Array(nCols).fill('')),
    getValue: () => '', getRow: () => row,
    setDataValidation: (v) => { recorded.validations.push({ sheet: sheet.name, col, v }); return r; },
    insertCheckboxes: () => { recorded.checkboxRanges.push({ sheet: sheet.name, col }); return r; },
    setFormula: (f) => { recorded.formulas.set(`${sheet.name}!${col},${row}`, f); return r; },
    setFormulas: (fs) => {
      fs.forEach((rowArr, i) => recorded.formulas.set(`${sheet.name}!${col},${row + i}`, rowArr[0]));
      return r;
    },
  };
  return guard(r, RANGE_API, 'Range');
}

function makeSheet(name) {
  const sh = {
    name,
    getName: () => name, getMaxRows: () => 300, getMaxColumns: () => 30,
    clear: () => sh, clearConditionalFormatRules: () => sh,
    setTabColor: () => sh, setHiddenGridlines: () => sh, setFrozenRows: () => sh,
    setFrozenColumns: () => sh, setColumnWidth: () => sh, setRowHeight: () => sh,
    hideColumns: () => sh, setConditionalFormatRules: () => sh, insertRowBefore: () => sh,
    setActiveRange: () => sh,
    getRange: (a, b, c, d) => (typeof a === 'string'
      ? makeRange(sh, 1, 1, 1, 1)
      : makeRange(sh, a, b, c || 1, d || 1)),
  };
  return guard(sh, SHEET_API, 'Sheet');
}

const sheets = new Map();
const chain = () => { const o = new Proxy({}, { get: (_, p) => (p === 'build' ? () => ({}) : () => chain()) }); return o; };

const SpreadsheetApp = {
  getActive: () => ({
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = makeSheet(n); sheets.set(n, s); return s; },
    getSheets: () => [...sheets.values()],
    deleteSheet: () => {}, setActiveSheet: () => {},
  }),
  newDataValidation: () => chain(),
  newConditionalFormatRule: () => chain(),
  BorderStyle: { SOLID: 'SOLID' },
  getUi: () => ({ alert: () => {}, createMenu: () => chain() }),
};

const src = readFileSync(new URL('../Code.gs', import.meta.url).pathname, 'utf8');
const ctx = vm.createContext({ SpreadsheetApp, console });
const X = vm.runInContext(src + '\n;({buildStash_, buildCharacter_, buildCube_, buildQuest_, COL, BAR_LEN, TYPES, ROWS});', ctx);

const ss = SpreadsheetApp.getActive();
X.buildCube_(ss); X.buildStash_(ss); X.buildQuest_(ss); X.buildCharacter_(ss);

let pass = 0; const bad = [];
const is = (l, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok  ${l}`); } else { bad.push(l); console.log(`  XX  ${l}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
};
const f = (key) => recorded.formulas.get(key);

console.log('generated STASH formulas, row 2');
is('unit', f('STASH!9,2'), '=IFERROR(INDEX(CUBE!$B$5:$B$11,MATCH(B2,CUBE!$A$5:$A$11,0)),"")');
is('percent', f('STASH!10,2'), '=IF(E2="Finished",1,IFERROR(G2/H2,""))');
is('bar', f('STASH!11,2'), '=IF(J2="","",REPT("█",ROUND(J2*12,0))&REPT("░",12-ROUND(J2*12,0)))');
is('rarity coerces before comparing', f('STASH!14,2'),
   '=IF(M2="","",IFS(IFERROR(VALUE(M2),-1)<0,"",IFERROR(VALUE(M2),-1)>=5,"Unique",' +
   'IFERROR(VALUE(M2),-1)>=4,"Set",IFERROR(VALUE(M2),-1)>=3,"Rare",' +
   'IFERROR(VALUE(M2),-1)>=2,"Magic",TRUE,"Normal"))');
is('a text rating cannot reach a high tier', f('STASH!14,2').includes('VALUE(M2)'), true);
is('rank', f('STASH!22,2'), '=IF($E2="In Progress",COUNTIFS($E$2:$E2,"In Progress"),"")');

console.log('\nlast row is armed too');
is(`rank at row ${X.ROWS}`, f(`STASH!22,${X.ROWS}`),
   `=IF($E${X.ROWS}="In Progress",COUNTIFS($E$2:$E${X.ROWS},"In Progress"),"")`);
is('every formula column filled to the last row',
   [9, 10, 11, 14, 22].map(c => recorded.formulas.has(`STASH!${c},${X.ROWS}`)), [true, true, true, true, true]);

console.log('\nbar uses real block glyphs, not escapes');
is('solid block present', f('STASH!11,2').includes('█'), true);
is('hollow block present', f('STASH!11,2').includes('░'), true);
is('no stray backslash-u', /\\u/.test(f('STASH!11,2')), false);

console.log('\nCHARACTER formulas point at the right columns');
const chr = [...recorded.formulas.entries()].filter(([k]) => k.startsWith('CHARACTER'));
is('character sheet has formulas', chr.length > 20, true);
const all = chr.map(([, v]) => v).join(' ');
is('reads STASH status column E', all.includes("'STASH'!$E$2:$E$200"), true);
is('reads STASH rank column V', all.includes("'STASH'!$V$2:$V$200"), true);
is('reads STASH rarity column N', all.includes("'STASH'!$N$2:$N$200"), true);
is('sheet name with a space is quoted', /(?<!')STASH!/.test(all.replace(/'STASH'!/g, '')), false);
is('no CHARACTER formula references a missing sheet',
   [...all.matchAll(/'?([A-Z ]+)'?!\$/g)].map(m => m[1].trim()).filter(n => !['STASH', 'QUEST LOG', 'CUBE', 'CHARACTER'].includes(n)), []);

console.log('\ndropdowns and checkboxes landed');
is('four dropdown columns', recorded.validations.map(v => v.col).sort((a, b) => a - b), [2, 5, 6, 13]);
is('favourite is a checkbox', recorded.checkboxRanges.map(c => c.col), [19]);

console.log(`\n${pass} passed, ${bad.length} failed`);
export default bad.length;
if (import.meta.url === `file://${process.argv[1]}`) process.exit(bad.length ? 1 : 0);
