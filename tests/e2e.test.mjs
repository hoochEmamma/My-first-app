/**
 * Drives the built app in a real browser: adding items, type-aware progress,
 * the session log, persistence, backup round-tripping, and the PWA shell.
 */
import { chromium } from 'playwright';
import { readFile, copyFile, mkdir } from 'node:fs/promises';

const OUT = new URL('./.tmp/', import.meta.url).pathname;

export default async function run(check, baseUrl) {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    // Set CHROMIUM_PATH when Playwright's own download isn't the browser you want.
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

  const modal = () => page.locator('.modal');

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByText('Nothing in progress').waitFor({ timeout: 5000 });
    check('empty state renders', true);

    // --- add a TV show, as In Progress ---
    await page.getByRole('button', { name: '+ Add' }).click();
    await page.getByRole('button', { name: /📺 TV Show/ }).click();
    await page.getByRole('button', { name: 'In Progress', exact: true }).click();
    await page.getByRole('button', { name: 'Add it manually' }).click();
    await page.locator('.manual-form input').first().fill('Severance');
    await page.locator('.manual-form input').nth(1).fill('Ben Stiller');
    await page.locator('.manual-form input').nth(2).fill('2022');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.locator('.detail').waitFor({ timeout: 5000 });
    check('add a TV show manually', true);

    const tvLabels = await modal().locator('.panel').first().locator('.field-label').allTextContents();
    check(
      'progress fields are TV-shaped',
      ['Season', 'Episode', 'Total episodes'].every((l) => tvLabels.includes(l)),
      JSON.stringify(tvLabels),
    );

    const nums = modal().locator('.panel').first().locator('input[type=number]');
    await nums.nth(0).fill('2');
    await nums.nth(1).fill('4');
    await nums.nth(2).fill('19');
    await page.waitForTimeout(400);
    const label = await page.locator('.detail .progress-label').textContent();
    check('position reads back as S2 E4 of 19', label.includes('S2 E4 of 19'), label);

    await modal().getByRole('button', { name: 'Rate 4.5 stars' }).click();
    await modal().locator('textarea').fill('The severed-floor conceit holds up.');
    await page.waitForTimeout(400);
    const stars = await modal().locator('.stars-lg .star-value').textContent();
    check('half-star rating sticks', stars.trim() === '4.5', stars);

    await modal().locator('.note-form input').first().fill('Finished E4 — pacing finally clicked');
    await modal().locator('.note-form button').click();
    await page.locator('.timeline li').first().waitFor({ timeout: 3000 });
    const pill = await page.locator('.timeline .pill').first().textContent();
    check('log entry stamps where you were', pill.includes('S2 E4'), pill);

    await modal().getByRole('button', { name: 'Done' }).click();
    await page.locator('.overlay').waitFor({ state: 'detached', timeout: 3000 });

    // --- dashboard quick actions ---
    await page.locator('.now-row').first().waitFor({ timeout: 3000 });
    await page.getByRole('button', { name: '+1 episode' }).click();
    await page.waitForTimeout(300);
    const bumped = await page.locator('.now-row .progress-label').first().textContent();
    check('quick advance bumps the episode', bumped.includes('S2 E5'), bumped);

    // --- a book on the waiting list ---
    await page.getByRole('button', { name: '+ Add' }).click();
    await page.getByRole('button', { name: /📚 Book/ }).click();
    await page.getByRole('button', { name: 'Want To', exact: true }).click();
    await page.getByRole('button', { name: 'Add it manually' }).click();
    await page.locator('.manual-form input').first().fill('Piranesi');
    await page.locator('.manual-form input').nth(1).fill('Susanna Clarke');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.locator('.detail').waitFor({ timeout: 5000 });
    const bookLabels = await modal().locator('.panel').first().locator('.field-label').allTextContents();
    check('progress fields switch to book-shaped', bookLabels.includes('Current page'), JSON.stringify(bookLabels));
    await modal().getByRole('button', { name: 'Done' }).click();
    await page.locator('.overlay').waitFor({ state: 'detached', timeout: 3000 });

    await page.locator('.tab', { hasText: 'Want To' }).click();
    await page.locator('.backlog-row').first().waitFor({ timeout: 3000 });
    await page.getByRole('button', { name: '🎲 Pick for me' }).click();
    await page.getByRole('button', { name: 'Start' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('.tab', { hasText: 'Now' }).click();
    check('starting from the waiting list moves it to Now', (await page.locator('.now-row').count()) === 2);

    // --- library filtering ---
    await page.locator('.tab', { hasText: 'Library' }).click();
    await page.locator('.card').first().waitFor({ timeout: 3000 });
    await page.locator('.search').fill('piranesi');
    await page.waitForTimeout(250);
    check('search narrows the library', (await page.locator('.card').count()) === 1);
    await page.locator('.search').fill('');
    await page.waitForTimeout(250);

    // --- stats ---
    await page.locator('.tab', { hasText: 'Stats' }).click();
    await page.locator('.stat').first().waitFor({ timeout: 3000 });
    const total = await page.locator('.stat').first().locator('.stat-value').textContent();
    check('stats count both items', total.trim() === '2', total);

    // --- persistence ---
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.now-row').first().waitFor({ timeout: 5000 });
    const labels = await page.locator('.now-row .progress-label').allTextContents();
    check('progress survives a reload', labels.some((l) => l.includes('S2 E5')), JSON.stringify(labels));
    check('both items survive a reload', (await page.locator('.now-row').count()) === 2);
    await page.locator('.tab', { hasText: 'Library' }).click();
    const keptRating = await page.locator('.card', { hasText: 'Severance' }).locator('.star-value').textContent();
    check('rating survives a reload', keptRating.trim() === '4.5', keptRating);

    // --- backup round trip ---
    await page.getByRole('button', { name: 'Settings' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByRole('button', { name: /^Export 2 items$/ }).click(),
    ]);
    const backup = `${OUT}backup.json`;
    await copyFile(await download.path(), backup);
    const data = JSON.parse(await readFile(backup, 'utf8'));
    check('backup holds both items', data.items.length === 2, `got ${data.items.length}`);
    check('backup keeps session logs', Array.isArray(data.items.find((i) => i.title === 'Severance').sessions));
    check('backup never includes API keys', !JSON.stringify(data).includes('tmdbKey'));

    await page.locator('input[type=file]').setInputFiles(backup);
    await page.getByText(/Imported: 0 added, 2 updated/).waitFor({ timeout: 3000 });
    check('re-import merges instead of duplicating', true);
    await modal().getByRole('button', { name: 'Done' }).click();

    // --- phone layout ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check('no horizontal scroll at phone width', overflow <= 1, `${overflow}px`);

    // --- installable shell ---
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
      return href ? (await fetch(href)).json() : null;
    });
    check('manifest is served and parses', manifest?.short_name === 'Shelf');
    check('icons are served', await page.evaluate(async () => (await fetch('icon-512.png')).ok));
    check('service worker registers', await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active || reg.installing || reg.waiting);
    }));

    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    check('app shell opens with the network down', (await page.locator('.brand-name').textContent()) === 'Shelf');
    await page.locator('.tab', { hasText: 'Library' }).click();
    check('library is readable offline', (await page.locator('.card').count()) === 2);
    await ctx.setOffline(false);

    check('no console or page errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  } finally {
    await browser.close();
  }
}
