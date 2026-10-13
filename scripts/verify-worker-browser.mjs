/**
 * Real Chromium/browser-owned Worker proof: expensive *full* layout solving
 * runs away from React's main thread. Cancellation/supersession discards stale
 * responses but does not interrupt CPU work already running in a Worker.
 *
 * This is a consumer-owned integration experiment, not a new stable package
 * export. Never assert frame-duration thresholds on shared CI hardware.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { build, createServer, preview } from 'vite';
import { writeLine } from './log.mjs';

const production = process.argv.includes('--production');
const cases = [
  { name: 'desktop', width: 1200, height: 820, count: 40 },
  { name: 'mobile', width: 390, height: 844, count: 24 }
];
if (process.argv.includes('--benchmark')) {
  cases.push({ name: 'dense-desktop', width: 1365, height: 900, count: 200 });
}

let server;
let browser;
try {
  if (production) {
    const fixtureRoot = new URL('../test/fixtures/worker-browser/', import.meta.url).pathname;
    const output = new URL('../.tmp/worker-production', import.meta.url).pathname;
    await build({
      configFile: false,
      root: fixtureRoot,
      build: { outDir: output, emptyOutDir: true },
      logLevel: 'error'
    });
    const assets = await readdir(join(output, 'assets'));
    assert.ok(assets.some((file) => /^layout\.worker-[A-Za-z0-9_-]+\.js$/.test(file)),
      'Vite production build did not emit a separate Worker module');
    server = await preview({
      configFile: false,
      root: fixtureRoot,
      build: { outDir: output },
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
      logLevel: 'error'
    });
  } else {
    server = await createServer({
      configFile: false,
      root: new URL('../', import.meta.url).pathname,
      cacheDir: '.tmp/vite-worker',
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 0, strictPort: false }
    });
    await server.listen();
  }
  const address = server.httpServer?.address();
  assert.ok(address && typeof address !== 'string', 'Worker fixture Vite server did not start');
  browser = await chromium.launch({ headless: true });
  const observations = [];

  for (const config of cases) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => errors.push(`Request failed: ${request.url()}: ${request.failure()?.errorText}`));

    async function clickAndConfirm(button, action, expectedCount, pingWhileWorking = false) {
      await page.locator(`#${button}`).click();
      if (pingWhileWorking) {
        // A *real* 200-note full solver is executing inside the Worker. The
        // host must still accept an unrelated main-thread click while it is
        // pending; no CI millisecond budget is imposed on shared runners.
        await page.locator('#worker-ping').click();
      }
      await page.waitForFunction((expected) => {
        const proof = window.__workerProof;
        const event = proof?.events.at(-1);
        return event?.action === expected.action && event.id === expected.id
          && typeof event.noteCount === 'number'
          && typeof event.reactCommitAfterReceiptMs === 'number';
      }, { action, id: expectedCount }, { timeout: 45000 });
      const event = await page.evaluate(() => window.__workerProof?.events.at(-1));
      assert.ok(event, `${config.name}/${action}: response missing`);
      assert.equal(event.action, action);
      assert.equal(event.noteCount, config.count);
      assert.ok(event.workerElapsedMs >= event.resolverMs);
      assert.ok(event.rAFMs >= 0 && Number.isFinite(event.rAFMs));
      assert.ok(event.reused >= 0 && event.reused <= config.count);
      assert.ok(['patch', 'snapshot'].includes(event.transport));
      assert.ok(event.encodeMs >= 0 && Number.isFinite(event.encodeMs));
      assert.ok(event.postMessageMs >= 0 && Number.isFinite(event.postMessageMs));
      assert.ok(event.admissionMs >= 0 && Number.isFinite(event.admissionMs));
      // Cross-context relative epoch timestamps separate initial dispatch,
      // Worker queue/delay and reply scheduling from the solver itself.
      // These values are observations, not 60fps budgets or pure clone costs.
      for (const metric of ['requestDeliveryMs', 'workerQueueMs', 'responseDeliveryMs']) {
        assert.ok(event[metric] >= 0 && Number.isFinite(event[metric]),
          `${config.name}/${action}: missing finite ${metric}`);
      }
      assert.ok(event.reactCommitAfterReceiptMs >= 0
        && Number.isFinite(event.reactCommitAfterReceiptMs),
      `${config.name}/${action}: React commit timing missing`);
      assert.ok(event.jsonWireBytes > 0 && event.jsonFullBytes > 0);
      assert.ok(event.changed >= 0 && event.changed <= config.count);
      const parity = await page.evaluate(() => window.__workerProof?.checkParity());
      assert.equal(parity, true, `${config.name}/${action}: worker layout must match full main-thread solver`);
      const lean = await page.evaluate(() => {
        const layout = window.__workerProof?.lastLayout;
        return layout && !Object.hasOwn(layout, 'diagnostics')
          && layout.annotations.every((item) => !Object.hasOwn(item.placement, 'candidates'))
          && !document.querySelector('.pa-annotation-layer__measurer');
      });
      assert.equal(lean, true, `${config.name}/${action}: default Worker result must stay lean and render only`);
      return event;
    }

    try {
      await page.goto(`http://127.0.0.1:${address.port}${production ? '/' : '/test/fixtures/worker-browser/'}?count=${config.count}`, {
        waitUntil: 'domcontentloaded', timeout: 30000
      });
      await page.waitForFunction((count) => window.__workerProof?.ready === true
        && document.querySelectorAll('g.pa-annotation').length === count,
      config.count, { timeout: 30000 });
      const initial = await page.evaluate(() => window.__workerProof?.checkParity());
      assert.equal(initial, true, 'Initial worker fixture must match full geometry');

      // Real full resolution happens in the worker; result is installed as a
      // controlled React layout without re-invoking the resolver in render.
      const anchor = await clickAndConfirm('worker-anchor', 'anchor', 1, config.count >= 200);
      if (config.count >= 200) {
        assert.ok(anchor.uiPingsAtCommit >= 1, 'Main-thread click was blocked while the dense Worker solver ran');
      }
      const obstacle = await clickAndConfirm('worker-obstacle', 'obstacle', 2);
      assert.equal(anchor.transport, 'snapshot', 'First request should establish the Worker baseline');
      assert.equal(obstacle.transport, 'patch', 'Worker should patch its acknowledged host baseline');
      assert.equal(obstacle.changed, 0, 'A far obstacle must not re-send unchanged notes');
      assert.ok(obstacle.jsonWireBytes < obstacle.jsonFullBytes / 2,
        'The compact reply must be materially smaller than the full resolved array');

      // Burst: delayed old response arrives after a newer one. The host must
      // ignore it, preserving the latest annotation text, layout and quality.
      await page.locator('#worker-burst').click();
      await page.waitForFunction(() => window.__workerProof?.events.at(-1)?.action === 'newest-request'
        && typeof window.__workerProof?.events.at(-1)?.noteCount === 'number',
      { timeout: 45000 });
      await page.waitForFunction(() => (window.__workerProof?.dropped ?? 0) >= 1,
        { timeout: 45000 });
      const burst = await page.evaluate(() => ({
        current: window.__workerProof?.events.at(-1),
        dropped: window.__workerProof?.dropped,
        parity: window.__workerProof?.checkParity(),
        latestTitle: window.__workerProof?.lastLayout.annotations.at(-1)?.annotation.note.title
      }));
      assert.equal(burst.current?.action, 'newest-request', 'Stale reply overwrote the latest worker result');
      assert.equal(burst.current?.transport, 'patch', 'Newer request should use its acknowledged base');
      assert.equal(burst.parity, true);
      assert.match(burst.latestTitle ?? '', /^Latest burst /);

      // An in-flight request is intentionally cancelled in host state. Since
      // Worker CPU tasks are not preemptible, the reply must simply be ignored.
      await page.locator('#worker-delay').click();
      await page.waitForFunction(() => window.__workerProof?.pendingId !== null);
      await page.locator('#worker-ping').click();
      await page.locator('#worker-cancel').click();
      await page.waitForFunction(() => (window.__workerProof?.dropped ?? 0) >= 2,
        { timeout: 45000 });
      const afterCancel = await page.evaluate(() => ({
        pendingId: window.__workerProof?.pendingId,
        dropped: window.__workerProof?.dropped,
        pings: window.__workerProof?.pings,
        lastAction: window.__workerProof?.events.at(-1)?.action,
        parity: window.__workerProof?.checkParity(),
        noteCount: document.querySelectorAll('g.pa-annotation').length,
        status: document.querySelector('#worker-status')?.textContent
      }));
      assert.equal(afterCancel.pendingId, null);
      assert.ok((afterCancel.pings ?? 0) >= 1, 'Main thread UI ping did not respond while Worker was pending');
      assert.equal(afterCancel.lastAction, 'newest-request', 'Cancelled layout incorrectly committed');
      assert.equal(afterCancel.noteCount, config.count);
      assert.equal(afterCancel.parity, true);
      assert.match(afterCancel.status ?? '', /Cancelled request/);

      // The host's real Worker-generated React DOM stays keyboard-usable and
      // semantically named in both desktop/mobile viewports.
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      assert.deepEqual(accessibility.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target.join(' '))
      })), [], `${config.name}: WCAG violations`);
      assert.deepEqual(errors, [], `${config.name}: browser errors`);
      observations.push({
        name: config.name,
        width: config.width,
        height: config.height,
        count: config.count,
        anchor,
        obstacle,
        burst,
        afterCancel,
        errors
      });
    } finally {
      await context.close();
    }
  }
  writeLine(JSON.stringify({
    proof: 'host-owned-off-main-thread-annotation-layout',
    buildMode: production ? 'production-bundled-worker' : 'vite-development-worker',
        interpretation: 'Chromium/Vite Worker and React SVG. JSON reply/full sizes approximate bytes, not structured-clone bytes. Epoch-relative requestDelivery/responseDelivery include cloning, event-loop scheduling and cross-context clock skew; workerQueue includes deliberate fixture delays. postMessage measures only the synchronous caller interval; React useLayoutEffect timestamps a commit in dev and production; Profiler render duration is development-only, neither measures paint. rAF is not compositor paint, and cancellation does not interrupt Worker CPU.',
    observations
  }, null, 2));
} finally {
  await browser?.close();
  if (server) {
    if (production) {
      await new Promise((resolve, reject) => {
        server.httpServer.close((error) => error ? reject(error) : resolve());
      });
    } else {
      await server.close();
    }
  }
}
