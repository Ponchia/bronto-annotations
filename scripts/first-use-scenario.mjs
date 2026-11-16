import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Exercise the built public journey, including failed enhancement. */
export async function verifyFirstUse({ browser, siteUrl, evidence, stableInstall }) {
  await mkdir(evidence, { recursive: true });
  const widths = [320, 375, 768, 1440];
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.goto(siteUrl, { waitUntil: 'networkidle' });
      assert(await page.locator('#playground-layout').isVisible());
      assert(!await page.locator('#playground-fallback').isVisible());
      assert.equal(await page.locator('#annotation-overlay .pa-annotation').count(), 3);
      const labels = await page.locator('.plot-header, .plot-metrics span').evaluateAll(nodes =>
        nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
      assert(labels.every(size => size >= 12), `Chart labels must remain readable at ${width}px: ${labels}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await page.locator('#toggle-placement').focus();
      assert(await page.locator('#toggle-placement').evaluate(node => node.matches(':focus-visible')));
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#annotation-overlay').getAttribute('data-mode'), 'fixed');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#annotation-overlay').getAttribute('data-mode'), 'automatic');
      await page.locator('#playground').screenshot({ path: resolve(evidence, `playground-${width}.png`) });

      // A 200% root font setting retains the layout viewport and SVG coordinates.
      // It enlarges rem-based UI text; pixel-sized SVG text, browser zoom and
      // physical-device font settings require separate evidence.
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '32px');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0,
        `Text enlarged to 200% must reflow at ${width}px`);
      assert(await page.locator('#placement-mode').isVisible());
      await page.locator('#placement-mode').selectOption('fixed');
      assert.equal(await page.locator('#annotation-overlay').getAttribute('data-mode'), 'fixed');
      await page.locator('#playground').screenshot({ path: resolve(evidence, `text-200-${width}.png`) });
    } finally { await context.close(); }
  }

  for (const failure of ['disabled-javascript', 'blocked-module']) {
    const context = await browser.newContext({
      javaScriptEnabled: failure !== 'disabled-javascript', viewport: { width: 375, height: 900 },
    });
    try {
      const page = await context.newPage();
      if (failure === 'blocked-module') await page.route('**/assets/*.js', route => route.abort('blockedbyclient'));
      await page.goto(siteUrl, { waitUntil: 'networkidle' });
      const fallback = page.locator('#playground-fallback');
      assert(await fallback.isVisible(), `${failure}: static recovery must remain visible`);
      assert(!await page.locator('#playground-layout').isVisible(), 'Do not offer inert playground controls');
      assert(!await page.locator('.install [data-copy]').isVisible(), 'Do not offer an inert Copy button');
      assert((await page.locator('.install code').innerText()).includes(stableInstall));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await fallback.screenshot({ path: resolve(evidence, `${failure}-375.png`) });
      await fallback.getByRole('link', { name: 'first annotation guide' }).click();
      assert((await page.locator('.docs-prose').innerText()).includes(stableInstall));
      assert(await page.locator('#if-the-first-run-fails').isVisible());
      assert(await page.locator('pre').first().isVisible());
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0,
        'The first-use guide must remain readable without JavaScript and with enlarged text');
    } finally { await context.close(); }
  }

  // Capture the actual host-owned editor, preserving its narrow reading list.
  // These images document a real edit and undo, not a reconstructed mockup.
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      await page.goto(`${siteUrl}/examples/react-incremental/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => Boolean(window.__annotationsExample));
      const initial = await page.locator('#annotation-json').textContent();
      assert.equal(await page.locator('#text-editor-title').inputValue(), 'Live marker');
      await page.screenshot({ path: resolve(evidence, `editor-before-${width}.png`), fullPage: true });
      await page.locator('#text-editor-title').fill('Reviewed signal');
      await page.locator('#apply-note-text').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.note-list li button strong').last().innerText(), 'Reviewed signal');
      const notes = JSON.parse(await page.locator('#annotation-json').textContent());
      const before = JSON.parse(initial);
      assert.deepEqual(notes.slice(0, 3), before.slice(0, 3), 'Editing one note must preserve its neighbors');
      assert.equal(notes[3].note.title, 'Reviewed signal');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await page.screenshot({ path: resolve(evidence, `editor-applied-${width}.png`), fullPage: true });
      await page.locator('.note-text-editor').screenshot({ path: resolve(evidence, `editor-controls-${width}.png`) });
      if (width === 1440) await page.locator('.stage-scroll').screenshot({ path: resolve(evidence, 'editor-diagram-1440.png') });
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.equal(await page.locator('#annotation-json').textContent(), initial, 'Undo must restore the exact authored scene');
    } finally { await context.close(); }
  }
  console.log('First-use journey verified: four widths, 200% root font reflow, keyboard comparison, disabled JavaScript and blocked module recovery.');
  console.log('Real editing journey captured at four widths: change title, Apply text with keyboard, verify unchanged neighbors, Undo.');
}
