const { spawn } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve('artifacts/practice-review');
const base = process.env.PRACTICE_TEST_URL || 'http://127.0.0.1:5190';
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(output, { recursive: true });

(async () => {
 let server, browser;
 const findings = [], errors = [];
 try {
  if (!process.env.PRACTICE_TEST_URL) {
   server = spawn(process.execPath, [join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--mode', 'svalbr', '--host', '127.0.0.1', '--port', '5190', '--strictPort'], { windowsHide: true, stdio: 'ignore' });
   let ready = false;
   for (let i = 0; i < 150; i++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await sleep(200);
   }
   assert(ready, 'Preview server did not start');
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PRACTICE_BROWSER_CHANNEL ? { channel: process.env.PRACTICE_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('heading', { name: 'Typing practice for your Svalboard.' }).waitFor();
  assert.deepEqual(await page.locator('main button').allTextContents(), ['Connect Svalboard']);
  assert.equal(await page.locator('.svalbr-brand').innerText(), 'practice');
  assert.equal(await page.getByRole('button', { name: /Import keymap|Try QWERTY example/ }).count(), 0);
  findings.push('Production onboarding: single connect action and clean practice branding');
  await page.goto(base + '/?demo');
  await page.getByRole('button', { name: 'Try QWERTY example' }).click();
  await page.getByRole('button', { name: 'Learn from the center keys' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByLabel('Practice text', { exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: 'Training modes' });
  await nav.getByRole('button', { name: 'Words', exact: true }).click();
  await page.getByRole('heading', { name: 'Words', exact: true }).waitFor();
  const next = async () => (await page.locator('[data-cursor]').textContent()).trim() || ' ';
  await page.keyboard.type(await next());
  await page.waitForFunction(() => document.querySelectorAll('[data-glyph="typed"]').length === 1);
  await page.keyboard.press('Escape');
  await page.locator('[data-practice-paused]').waitFor();
  await page.keyboard.type(await next());
  await page.waitForFunction(() => document.querySelectorAll('[data-glyph="typed"]').length === 2);
  findings.push('First character retained from sidebar focus; typing resumes paused lesson');
  await page.getByRole('button', { name: 'Lesson settings', exact: true }).click();
  await page.keyboard.type('a');
  assert.equal(await page.locator('[data-glyph="typed"]').count(), 2);
  await page.getByRole('button', { name: 'Close settings' }).click();
  findings.push('Modal input is isolated from lesson input');
  // Finish a lesson through real browser keyboard events and verify stored progress.
  const lessonText = await page.locator('[data-practice-text-card] [aria-hidden="true"]').first().innerText();
  await page.getByLabel('Practice text', { exact: true }).focus();
  await page.keyboard.type(lessonText.slice(2), { delay: 25 });
  await nav.getByRole('button', { name: 'Progress', exact: true }).click();
  await page.locator('[data-history-row]').first().waitFor();
  assert.equal(await page.getByRole('radiogroup', { name: 'Heatmap metric' }).getByRole('radio').first().textContent(), 'Errors');
  assert.equal(await page.getByRole('radio', { name: 'Errors', exact: true }).getAttribute('aria-checked'), 'true');
  findings.push('Completed lesson appears in history; Errors is the first/default heatmap');
  for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
   await page.setViewportSize(size);
   for (const mode of ['Guided', 'Words', 'Books', 'Custom', 'Source code', 'Numbers', 'Drill', 'Progress']) {
    if (size.width < 760) await page.getByRole('button', { name: 'Open navigation' }).click();
    await nav.getByRole('button', { name: mode, exact: true }).click();
    await sleep(150);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${mode} overflows at ${size.width}px`);
   }
   await page.screenshot({ path: join(output, `progress-${size.width}.png`), fullPage: true });
   findings.push(`All modes and Progress fit ${size.width}px without horizontal scrolling`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole('button', { name: 'Try QWERTY example' }).click();
  await nav.getByRole('button', { name: 'Progress', exact: true }).click();
  await page.locator('[data-history-row]').first().waitFor();
  findings.push('Progress survives reload and reloading the same keymap');
  assert.deepEqual(errors, []);
  writeFileSync(join(output, 'report.json'), JSON.stringify({ findings, errors }, null, 2));
  console.log(findings.join('\n'));
 } finally {
  await browser?.close();
  server?.kill();
 }
})().catch(e => { console.error(e); process.exitCode = 1; });
