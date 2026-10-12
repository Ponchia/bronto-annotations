/**
 * Opt-in Firefox/WebKit proof for host-owned incremental React editing and
 * module Worker revisions. Chromium remains the mandatory CI browser until
 * this lane has demonstrated repeatable parity on all supported runners.
 *
 * Run after building:
 *   npm run test:browser:cross
 *   node scripts/verify-cross-browser-interactions.mjs --browser chromium
 * Install browser engines when needed:
 *   npx playwright install --with-deps firefox webkit
 *
 * No fixed FPS, solve time or compositor-paint expectations.
 */
import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'vite';
import AxeBuilder from '@axe-core/playwright';

// Run Firefox and WebKit in opt-in CI. Allow an explicit Chromium-only
// developer repro without adding Chromium to the cross-engine CI workload.
const requestedIndex = process.argv.indexOf('--browser');
const requestedName = requestedIndex >= 0 ? process.argv[requestedIndex + 1] : undefined;
const engines = { chromium, firefox, webkit };
assert(requestedIndex < 0 || Object.hasOwn(engines, requestedName),
  'Use --browser chromium, firefox or webkit');
const suites = requestedName
  ? [[requestedName, engines[requestedName]]]
  : [['firefox', firefox], ['webkit', webkit]];
const viewports = [
  { width: 1200, height: 820, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' }
];

const server = await createServer({
  configFile: false,
  root: new URL('../', import.meta.url).pathname,
  cacheDir: '.tmp/vite-cross-browser',
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false }
});
let verified = 0;

async function visit(browser, origin, route, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 45000 });
  assert.equal(response?.status(), 200, `Bad HTTP response for ${route}`);
  return { page, context, errors };
}

async function verifyAccessibility(page, label) {
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  assert.deepEqual(report.violations.map((issue) => ({
    id: issue.id,
    impact: issue.impact,
    targets: issue.nodes.map((node) => node.target.join(' '))
  })), [], label + ': Firefox/WebKit A/AA accessibility regressions');
}

async function verifyIncremental(browser, origin, viewport, label) {
  const { page, context, errors } = await visit(browser, origin, '/examples/react-incremental/', viewport);
  try {
    await page.waitForFunction(() =>
      window.__annotationsExample?.name === 'react-incremental'
      && window.__annotationsExample.annotations.length === 4
    );
    assert.equal(await page.locator('svg.pa-annotation-layer').getAttribute('role'), 'group',
      label + ': interactive SVG must expose keyboard-focusable descendants');
    assert.equal(await page.locator('g.pa-annotation').count(), 4);

    await page.locator('#move-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Moved the final anchor');
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 3,
      label + ': late anchor move should keep the earlier placements');
    await page.locator('#append-note').click();
    await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 5);
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 4);
    await page.locator('#remove-note').click();
    await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 4);
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 4);

    await page.locator('#reset-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Reset to initial diagram');

    const handle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="signal"]').first();
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    assert.equal(await handle.evaluate((element) => element === document.activeElement), true,
      label + ': edit handle must accept keyboard focus');
    const box = await handle.boundingBox();
    assert(box && box.width > 0 && box.height > 0, label + ': edit handle missing');

    const initial = await page.evaluate(() => {
      const rect = document.querySelector('g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box')?.getBoundingClientRect();
      return rect && { x: rect.x, y: rect.y };
    });
    assert(initial, label + ': note box missing before drag');
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 18, start.y + 12, { steps: 6 });
    // Preview geometry must move *before* the host accepts a committed patch.
    await page.waitForFunction(({ x, y }) => {
      const rect = document.querySelector('g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box')?.getBoundingClientRect();
      return Boolean(rect && (Math.abs(rect.x - x) > 2 || Math.abs(rect.y - y) > 2));
    }, initial, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__annotationsExample?.action),
      'Reset to initial diagram', label + ': preview must not commit on pointer move');
    await page.mouse.up();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Edited signal by dragging');
    const edited = await page.evaluate(() => window.__annotationsExample);
    assert.equal(edited.reused, 3, label + ': commit should reuse unaffected winners');
    assert.equal(edited.quality.ok, true, label + ': quality must remain valid');
    await verifyAccessibility(page, label);
    assert.deepEqual(errors, [], label + ': unexpected browser errors');
  } finally {
    await context.close();
  }
}

async function verifyReactFlow(browser, origin, viewport, label) {
  const { page, context, errors } = await visit(browser, origin, '/examples/react-flow-basic/', viewport);
  try {
    await page.waitForFunction(() => {
      const sample = window.__annotationsExample;
      return sample?.name === 'react-flow-basic'
        && sample.viewportTransformActive === true
        && sample.annotations?.some((note) => note.id === 'flow-review');
    }, null, { timeout: 45000 });

    const original = await page.evaluate(() => {
      const note = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box');
      const rect = note?.getBoundingClientRect();
      const sample = window.__annotationsExample;
      return {
        box: rect ? { x: rect.x, y: rect.y } : null,
        viewport: sample?.viewport,
        transformed: sample?.viewportTransformActive,
        quality: sample?.quality
      };
    });
    assert(original.box && original.transformed && original.quality?.ok,
      label + ': initial transformed graph annotations must be valid');

    const handle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="flow-review"]').first();
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    assert.equal(await handle.evaluate((element) => element === document.activeElement), true,
      label + ': transformed edit handle must support keyboard focus');
    const geometry = await handle.boundingBox();
    assert(geometry && geometry.width > 0 && geometry.height > 0,
      label + ': transformed React Flow edit control missing');

    const start = { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    try {
      await page.mouse.move(start.x + 14, start.y + 10, { steps: 5 });
      await page.waitForFunction((before) => {
        const rect = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box')
          ?.getBoundingClientRect();
        return Boolean(rect && (Math.abs(rect.x - before.x) > 2 || Math.abs(rect.y - before.y) > 2));
      }, original.box, { timeout: 15000 });
      assert.equal(await page.evaluate(() =>
        window.__annotationsExample?.editPatchIds?.includes('flow-review') ?? false),
      false, label + ': preview must not persist before pointer release');
    } finally {
      await page.mouse.up();
    }

    await page.waitForFunction(() => {
      const sample = window.__annotationsExample;
      const edit = window.__annotationsLastEdit;
      return edit?.annotationId === 'flow-review'
        && edit.phase === 'end'
        && sample?.editPatchIds?.includes('flow-review')
        && sample.annotations?.find((note) => note.id === 'flow-review')?.manual;
    }, null, { timeout: 15000 });
    const committed = await page.evaluate(() => {
      const sample = window.__annotationsExample;
      const manual = sample.annotations.find((note) => note.id === 'flow-review')?.manual;
      return { x: manual?.x, quality: sample.quality, transformed: sample.viewportTransformActive };
    });
    assert(Number.isFinite(committed.x) && committed.quality?.ok && committed.transformed,
      label + ': transformed drag must commit a valid host-owned placement');

    // Keyboard editing uses the same coordinate adapter but must not depend
    // on pointer capture or the transient pointer preview.
    const updatedHandle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="flow-review"]').first();
    await updatedHandle.focus();
    await updatedHandle.press('ArrowRight');
    await page.waitForFunction((previousX) => {
      const sample = window.__annotationsExample;
      const manual = sample?.annotations?.find((note) => note.id === 'flow-review')?.manual;
      return Number.isFinite(manual?.x) && Math.abs(manual.x - previousX) >= 0.5;
    }, committed.x, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__annotationsExample?.quality?.ok), true,
      label + ': keyboard editing must preserve layout quality');

    await verifyAccessibility(page, label);
    assert.deepEqual(errors, [], label + ': transformed React Flow browser errors');
  } finally {
    await context.close();
  }
}

async function verifyWorker(browser, origin, viewport, label) {
  const { page, context, errors } = await visit(browser, origin, '/examples/react-worker/', viewport);
  try {
    await page.waitForFunction(() => window.__annotationsWorkerDemo?.ready === true,
      null, { timeout: 45000 });
    assert.equal(await page.locator('g.pa-annotation').count(), 18);
    assert.equal(await page.evaluate(() => window.__annotationsWorkerDemo.freshParity()), true);

    await page.locator('#worker-move').click();
    await page.waitForFunction(() => window.__annotationsWorkerDemo?.commits === 1,
      null, { timeout: 45000 });
    assert.equal(await page.evaluate(() => window.__annotationsWorkerDemo.freshParity()), true,
      label + ': accepted worker revision must match fresh full resolution');
    await page.locator('#worker-burst').click();
    await page.waitForFunction(() => window.__annotationsWorkerDemo?.commits === 2
      && window.__annotationsWorkerDemo.lastAction === 'Newer revision',
      null, { timeout: 45000 });
    await page.waitForFunction(() => (window.__annotationsWorkerDemo?.discarded ?? 0) >= 1,
      null, { timeout: 45000 });
    assert.equal(await page.evaluate(() => window.__annotationsWorkerDemo.freshParity()), true,
      label + ': obsolete revision must not overwrite the accepted one');

    const before = await page.evaluate(() => window.__annotationsWorkerDemo.discarded);
    await page.locator('#worker-delay').click();
    await page.waitForFunction(() => window.__annotationsWorkerDemo?.pending === true);
    await page.locator('#worker-ping').click();
    await page.waitForFunction(() => (window.__annotationsWorkerDemo?.pings ?? 0) > 0);
    await page.locator('#worker-cancel').click();
    await page.waitForFunction(() => window.__annotationsWorkerDemo?.pending === false);
    await page.waitForFunction((count) =>
      (window.__annotationsWorkerDemo?.discarded ?? 0) > count, before,
      { timeout: 45000 });
    const state = await page.evaluate(() => ({
      commits: window.__annotationsWorkerDemo.commits,
      parity: window.__annotationsWorkerDemo.freshParity(),
      workerErrors: window.__annotationsWorkerDemo.errors
    }));
    assert.equal(state.commits, 2, label + ': cancelled result must not commit');
    assert.equal(state.parity, true, label + ': committed state must remain authoritative');
    assert.deepEqual(state.workerErrors, [], label + ': Worker runtime errors');
    await verifyAccessibility(page, label);
    assert.deepEqual(errors, [], label + ': browser console or runtime errors');

    if (viewport.width < 500) {
      const scroll = page.locator('.stage-scroll');
      const range = await scroll.evaluate((node) =>
        ({ visible: node.clientWidth, content: node.scrollWidth }));
      assert(range.content > range.visible, label + ': mobile diagram must be scrollable');
      await scroll.evaluate((node) => { node.scrollLeft = 220; });
      assert((await scroll.evaluate((node) => node.scrollLeft)) > 0,
        label + ': mobile horizontal scrolling did not respond');
    }
  } finally {
    await context.close();
  }
}

try {
  await server.listen();
  const address = server.httpServer?.address();
  assert(address && typeof address !== 'string', 'Vite server unavailable');
  const origin = `http://127.0.0.1:${address.port}`;
  for (const [name, engine] of suites) {
    let browser;
    try {
      browser = await engine.launch({ headless: true });
    } catch (error) {
      throw new Error(`${name} browser cannot launch. Install with "npx playwright install --with-deps ${name}". Cause: ${error}`);
    }
    try {
      for (const viewport of viewports) {
        const label = `${name}/${viewport.name}`;
        await verifyIncremental(browser, origin, viewport, label);
        await verifyReactFlow(browser, origin, viewport, label);
        await verifyWorker(browser, origin, viewport, label);
        verified += 3;
        process.stdout.write(`PASS ${label}: incremental editing, transformed React Flow edits and Worker revision/cancel\n`);
      }
    } finally {
      await browser.close();
    }
  }
  process.stdout.write(`Cross-browser verified: ${verified} integration cases; no frame-rate or paint guarantee.\n`);
} finally {
  await server.close();
}
