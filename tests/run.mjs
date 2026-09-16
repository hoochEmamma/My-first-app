/**
 * Test runner: bundles the provider module for the stubbed API tests, builds the
 * app, serves dist/ on a scratch port, and drives it in a real browser.
 *
 * Usage: npm test
 */
import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PORT = Number(process.env.TEST_PORT || 4319);
const BASE = `http://localhost:${PORT}`;

let pass = 0;
const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
};

const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error(`\n${cmd} ${args.join(' ')} failed`); process.exit(1); }
};

async function waitForServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server never came up at ${url}`);
}

console.log('\nbundling provider module…');
sh('npx', ['esbuild', 'src/api/providers.ts', '--bundle', '--format=esm',
           `--outfile=${join(here, '.tmp', 'providers.mjs')}`, '--log-level=error']);

console.log('\nprovider lookup');
const apiTests = (await import('./api.test.mjs')).default;
await apiTests(check);

console.log('\nbuilding app…');
sh('npm', ['run', 'build']);

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root, stdio: 'ignore', shell: process.platform === 'win32', detached: true,
});

try {
  await waitForServer(BASE);
  console.log('\napp end to end');
  const e2e = (await import('./e2e.test.mjs')).default;
  await e2e(check, BASE);

  console.log('\nsubpath deployment (GitHub Pages)');
  const subpath = (await import('./subpath.test.mjs')).default;
  await subpath(check);
} finally {
  try { process.kill(-server.pid); } catch { try { server.kill(); } catch { /* already gone */ } }
  await rm(join(here, '.tmp'), { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
