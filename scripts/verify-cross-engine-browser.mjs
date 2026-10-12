/**
 * Focused Firefox/WebKit interoperability proof for the two React authoring
 * examples. Chromium has deeper geometry/quality/visual baselines elsewhere;
 * these checks catch engine-specific pointer, module Worker and SVG regressions.
 * No hardware-dependent timing or native browser paint assumptions.
 */
import assert from 'node:assert/strict';
import { firefox, webkit } from 'playwright';
import { createServer } from 'vite';
import AxeBuilder from '@axe-core/playwright';
import { writeLine } from './log.mjs';

const browsers = [ ['firefox', firefox], ['webkit', webkit] ];
const viewports = [
  { name: 'desktop', width: 1200, height: 820 },
  { name: 'mobile', width: 390, height: 844 }
];
const server = await createServer({
  configFile: false,
  root: new URL('../', import.meta.url).pathname,
  cacheDir: '.tmp/vite-cross-engine',
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false }
});
const results = [];
let baseUrl;

async function checkAccessibility(page, label) {
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(audit.violations.map((item) => item.id), [],
    `${label}: WCAG A/AA violations`);
}

async function verifyIncremental(page, label) {
  await page.goto(`${baseUrl}/examples/react-incremental/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__annotationsExample?.name === 'react-incremental');
  assert.equal(await page.locator('g.pa-annotation').count(), 4, `${label}: initial notes`);
  assert.equal(await page.evaluate(() => window.__annotationsExample.quality.ok), true);

  await page.locator('#move-note').click();
  await page.waitForFunction(() => window.__annotationsExample?.action === 'Moved the final anchor');
  assert.equal(await page.evaluate(() => window.__annotationsExample.reused), 3,
    `${label}: unchanged earlier placements`);
  await page.locator('#append-note').click();
  await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 5);
  await page.locator('#remove-note').click();
  await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 4);
  await page.locator('#reset-note').click();
  await page.waitForFunction(() => window.__annotationsExample?.action === 'Reset to initial diagram');

  const edit = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="signal"]').first();
  await edit.scrollIntoViewIfNeeded();
  const box = await edit.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, `${label}: edit handle missing`);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const original = await page.evaluate(() => {
    const rect = document.querySelector('g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box')?.getBoundingClientRect();
    return rect ? { x: rect.x, y: rect.y } : null;
  });
  assert.ok(original, `${label}: rendered note missing`);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(start.x + 22, start.y + 15, { steps: 5 });
    await page.waitForFunction((before) => {
      const rect = document.querySelector('g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box')?.getBoundingClientRect();
      return Boolean(rect && (Math.abs(rect.x - before.x) > 2 || Math.abs(rect.y - before.y) > 2));
    }, original, { timeout: 12000 });
  } finally {
    await page.mouse.up();
  }
  await page.waitForFunction(() => window.__annotationsExample?.action === 'Edited signal by dragging');
  const final = await page.evaluate(() => window.__annotationsExample);
  assert.equal(final.reused, 3, `${label}: drag retained earlier placements`);
  assert.equal(final.quality.ok, true, `${label}: drag produced valid layout`);
  assert.equal(await page.locator('g.pa-annotation').count(), 4);
  await checkAccessibility(page, label);
  return { dragCommitted: true, reused: final.reused, quality: final.quality.score };
}

async function verifyWorker(page, label, mobile) {
  await page.goto(`${baseUrl}/examples/react-worker/`, { waitUntil: 'domcontentloaded' });
  const waitFor = (predicate, value) => page.waitForFunction(predicate, value, { timeout: 30000 });
  const state = () => page.evaluate(() => window.__annotationsWorkerDemo);
  await waitFor(() => window.__annotationsWorkerDemo?.ready === true);
  assert.equal(await page.locator('g.pa-annotation').count(), 18, `${label}: initial Worker notes`);
  assert.equal(await page.evaluate(() => window.__annotationsWorkerDemo.freshParity()), true);

  await page.locator('#worker-move').click();
  await waitFor(() => window.__annotationsWorkerDemo?.commits === 1);
  await page.locator('#worker-obstacle').click();
  await waitFor(() => window.__annotationsWorkerDemo?.commits === 2);
  await page.locator('#worker-burst').click();
  await waitFor(() => window.__annotationsWorkerDemo?.commits === 3);
  await waitFor(() => (window.__annotationsWorkerDemo?.discarded ?? 0) >= 1);
  assert.equal(await page.evaluate(() => window.__annotationsWorkerDemo.freshParity()), true,
    `${label}: supersession corrupted authoritative layout`);

  const beforeCancel = (await state()).discarded;
  await page.locator('#worker-delay').click();
  await waitFor(() => window.__annotationsWorkerDemo?.pending === true);
  await page.locator('#worker-ping').click();
  await waitFor(() => (window.__annotationsWorkerDemo?.pings ?? 0) >= 1);
  await page.locator('#worker-cancel').click();
  await waitFor(() => window.__annotationsWorkerDemo?.pending === false);
  await waitFor((oldCount) => (window.__annotationsWorkerDemo?.discarded ?? 0) > oldCount,
    beforeCancel);
  const final = await state();
  assert.equal(final.commits, 3, `${label}: cancelled reply was accepted`);
  assert.equal(await page.evaluate(() => window.__annotationsWorkerDemo.freshParity()), true);
  assert.deepEqual(final.errors, [], `${label}: Worker runtime errors`);
  assert.equal(await page.locator('g.pa-annotation').count(), 18);
  if (mobile) {
    const stage = page.locator('.stage-scroll');
    assert.ok(await stage.evaluate((el) => el.scrollWidth > el.clientWidth),
      `${label}: mobile stage should scroll horizontally`);
    await stage.evaluate((el) => { el.scrollLeft = 220; });
    assert.ok(await stage.evaluate((el) => el.scrollLeft) > 0,
      `${label}: mobile stage could not scroll`);
  }
  await checkAccessibility(page, label);
  return { commits: final.commits, cancelled: true, discarded: final.discarded };
}

try {
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address !== 'string', 'No Vite dev server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
  // Keep this immutable local name bound before creating any pages.
  for (const [browserName, engine] of browsers) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        try {
          for (const example of ['react-incremental', 'react-worker']) {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
              if (message.type() === 'error') errors.push(message.text());
            });
            try {
              const label = `${browserName}/${viewport.name}/${example}`;
              const detail = example === 'react-incremental'
                ? await verifyIncremental(page, label)
                : await verifyWorker(page, label, viewport.name === 'mobile');
              assert.deepEqual(errors, [], `${label}: browser errors`);
              results.push({ browser: browserName, viewport: viewport.name, example, ...detail });
            } finally {
              await page.close();
            }
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}
writeLine(JSON.stringify({ proof: 'cross-engine-interactive-annotations',
  engines: ['firefox', 'webkit'],
  scenarios: results.length,
  results,
  interpretation: 'Functional interaction and accessibility checks; no frame or paint timing assertions.'
}, null, 2));
