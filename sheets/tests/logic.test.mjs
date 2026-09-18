import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../Code.gs', import.meta.url).pathname, 'utf8');
const ctx = vm.createContext({});
// Top-level `const` is a lexical binding, not a property of the context, so
// evaluate a trailing expression to hand the values back out.
const exported = vm.runInContext(
  src + '\n;({rarityFor, renderBar, unitFor, stepFor, TYPES, UNITS, STATUSES, PROVIDER, RARITY, COL, STEP});',
  ctx,
);

let pass = 0; const bad = [];
const is = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok  ${label}`); }
  else { bad.push(label); console.log(`  XX  ${label}  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const { rarityFor, renderBar, unitFor, stepFor, TYPES, UNITS, STATUSES, PROVIDER, RARITY, COL } = exported;

console.log('rating -> rarity');
is('5 is Unique', rarityFor(5), 'Unique');
is('4.5 is Set', rarityFor(4.5), 'Set');
is('4 is Set', rarityFor(4), 'Set');
is('3.5 is Rare', rarityFor(3.5), 'Rare');
is('2 is Magic', rarityFor(2), 'Magic');
is('1.5 is Normal', rarityFor(1.5), 'Normal');
is('0.5 is Normal', rarityFor(0.5), 'Normal');
is('unrated has no tier', rarityFor(''), '');
is('null has no tier', rarityFor(null), '');
is('junk has no tier', rarityFor('abc'), '');
is('every tier has a colour', Object.keys(RARITY).sort(), ['Magic','Normal','Rare','Set','Unique']);

console.log('\nprogress bar');
is('empty renders nothing', renderBar(''), '');
is('zero is all hollow', renderBar(0), '░'.repeat(12));
is('full is all solid', renderBar(1), '█'.repeat(12));
is('half splits evenly', renderBar(0.5), '█'.repeat(6) + '░'.repeat(6));
is('5/19 rounds to 3', renderBar(5 / 19), '█'.repeat(3) + '░'.repeat(9));
is('over 1 clamps', renderBar(1.8), '█'.repeat(12));
is('negative clamps', renderBar(-0.4), '░'.repeat(12));
is('bar is always full width', renderBar(0.37).length, 12);
is('custom length honoured', renderBar(0.5, 4), '██░░');

console.log('\ntype tables');
is('units line up with types', UNITS.length, TYPES.length);
is('book counts pages', unitFor('Book'), 'pages');
is('tv counts episodes', unitFor('TV Show'), 'episodes');
is('game counts hours', unitFor('Video Game'), 'hours');
is('audiobook counts minutes', unitFor('Audiobook'), 'minutes');
is('unknown type has no unit', unitFor('Nonsense'), '');
is('a book tap is 10 pages', stepFor('Book'), 10);
is('a tv tap is 1 episode', stepFor('TV Show'), 1);
is('an audiobook tap is 15 min', stepFor('Audiobook'), 15);
is('unknown type steps by 1', stepFor('Nonsense'), 1);
is('every type has a step', TYPES.filter(t => !stepFor(t)).length, 0);
is('every type has a provider entry', TYPES.filter(t => !(t in PROVIDER)).length, 0);

console.log('\ncolumn map');
is('columns are unique', new Set(Object.values(COL)).size, Object.keys(COL).length);
is('columns are contiguous from 1',
   Object.values(COL).sort((a, b) => a - b),
   Array.from({ length: Object.keys(COL).length }, (_, i) => i + 1));
is('statuses match the sheet vocabulary', STATUSES.length, 5);

console.log(`\n${pass} passed, ${bad.length} failed`);
export default bad.length;
if (import.meta.url === `file://${process.argv[1]}`) process.exit(bad.length ? 1 : 0);
