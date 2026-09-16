/**
 * GitHub Pages serves a project site from a subpath (/<repo>/), not a domain
 * root, which is where relative asset paths, manifest scope and service worker
 * scope usually break. This serves dist/ that way and checks the app survives.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, '..', 'dist');
const SUBPATH = '/My-first-app/';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export default async function run(check) {
  const requested = [];
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split('?')[0]);
    if (path.endsWith('/')) path += 'index.html';
    requested.push(path);
    if (!path.startsWith(SUBPATH)) {
      res.writeHead(404).end('not found');   // anything outside the subpath is a bug
      return;
    }
    try {
      const file = join(DIST, normalize(path.slice(SUBPATH.length)));
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });

  const port = Number(process.env.SUBPATH_PORT || 4321);
  await new Promise((resolve) => server.listen(port, resolve));
  const base = `http://localhost:${port}${SUBPATH}`;

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const problems = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(`PAGEERROR: ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`REQFAIL: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url()}`));

  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    check('app boots from a subpath', (await page.locator('.brand-name').textContent()) === 'Shelf');
    check('nothing 404s from a subpath', problems.length === 0, problems.join(' | '));

    const strays = requested.filter((p) => !p.startsWith(SUBPATH));
    check('no request escapes to the domain root', strays.length === 0, strays.join(', '));

    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
      const res = await fetch(href);
      return res.ok ? res.json() : null;
    });
    check('manifest resolves against the subpath', manifest?.short_name === 'Shelf');
    check('manifest start_url stays in scope', manifest?.start_url === './', manifest?.start_url);

    const icon = await page.evaluate(async () => {
      const res = await fetch('icon-512.png');
      return { ok: res.ok, url: res.url };
    });
    check('icons resolve under the subpath', icon.ok && icon.url.includes(`${SUBPATH}icon-512.png`), icon.url);

    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    check('service worker scope is the subpath', scope.endsWith(SUBPATH), scope);

    await page.getByRole('button', { name: '+ Add' }).click();
    await page.getByRole('button', { name: 'Add it manually' }).click();
    await page.locator('.manual-form input').first().fill('Subpath Test');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.locator('.modal').getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(800);

    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    check('opens offline from the subpath', (await page.locator('.brand-name').textContent().catch(() => null)) === 'Shelf');
    await page.locator('.tab', { hasText: 'Library' }).click();
    check('library readable offline', (await page.locator('.card-title').first().textContent()) === 'Subpath Test');
    await ctx.setOffline(false);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check('safe-area insets cause no horizontal overflow', overflow <= 1, `${overflow}px`);
  } finally {
    await browser.close();
    server.close();
  }
}
