/**
 * Real Chromium + React proof for incremental committed updates. No timing
 * thresholds: measure resolver and next-animation-frame responsiveness on the
 * host actually rendering notes, while asserting semantic parity and identity.
 * `--benchmark` adds a 200-note desktop case outside the mandatory CI gate.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeLine } from './log.mjs';

const cases = [
  { width: 1200, height: 820, count: 40, name: 'desktop' },
  { width: 390, height: 844, count: 24, name: 'mobile' }
];
if (process.argv.includes('--benchmark')) {
  cases.push({ width: 1365, height: 900, count: 200, name: 'dense-desktop' });
}

const vite = await createServer({
  configFile: false,
  root: new URL('../', import.meta.url).pathname,
  cacheDir: '.tmp/vite-incremental',
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false }
});
let browser;
try {
  await vite.listen();
  const address = vite.httpServer?.address();
  assert.ok(address && typeof address !== 'string', 'Vite server must have a local TCP address');
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

    try {
      await page.goto(`http://127.0.0.1:${address.port}/test/fixtures/incremental-browser/?count=${config.count}`, {
        waitUntil: 'networkidle', timeout: 30000
      });
      await page.waitForFunction(
        (count) => window.__incrementalBrowser?.ready === true
          && document.querySelectorAll('g.pa-annotation').length === count,
        config.count,
        { timeout: 30000 }
      );

      const actions = config.name === 'dense-desktop'
        ? [
          ['append', config.count + 1, config.count, true],
          ['remove', config.count, config.count, true],
          ['far', config.count, config.count, true],
          ['near', config.count, null, true],
          ['noop', config.count, config.count, true]
        ]
        : [
          ['append', config.count + 1, config.count, true],
          ['remove', config.count, config.count, true],
          ['far', config.count, config.count, true],
          ['near', config.count, null, true],
          ['late', config.count, config.count - 1, true],
          ['noop', config.count, config.count, true],
          // React reconciles and retains the same DOM node even when an
          // annotation's resolved object changes during full recalculation.
          ['routing', config.count, 0, true],
          ['far', config.count, 0, true]
        ];

      for (let index = 0; index < actions.length; index += 1) {
        const [buttonId, expectedNotes, expectedReused, stableFirst] = actions[index];
        await page.locator(`#${buttonId}`).click();
        await page.waitForFunction((seq) => {
          const latest = window.__incrementalBrowser?.events?.at(-1);
          return latest?.seq === seq && typeof latest.paintMs === 'number';
        }, index + 1, { timeout: 30000 });

        const event = await page.evaluate(() => window.__incrementalBrowser?.events.at(-1));
        assert.ok(event, `Missing ${buttonId} event`);
        assert.equal(event.annotations, expectedNotes, `${config.name}/${buttonId} note count`);
        assert.equal(event.noteCount, expectedNotes, `${config.name}/${buttonId} painted note count`);
        assert.ok(event.resolverMs >= 0 && Number.isFinite(event.resolverMs));
        assert.ok(event.paintMs >= 0 && Number.isFinite(event.paintMs));
        if (expectedReused !== null) {
          assert.equal(event.reused, expectedReused, `${config.name}/${buttonId} resolved prefix identity`);
        }
        if (buttonId === 'near') {
          assert.ok(event.reused > 0 && event.reused < expectedNotes,
            `${config.name}: near obstacle must recompute some, not all, note placements`);
        }
        assert.equal(event.identityPreserved, stableFirst, `${config.name}/${buttonId} stable React node`);

        // Compare EVERY action against an independent fresh resolver in the
        // browser (not in Node). This comparison occurs after the measured
        // animation frame, so it does not contaminate the timing evidence.
        await page.locator('#validate').click();
        const parity = await page.evaluate(() => window.__incrementalBrowser?.events.at(-1)?.exactParity);
        assert.equal(parity, true, `${config.name}/${buttonId} browser full-layout parity`);
      }

      assert.deepEqual(errors, [], `${config.name} browser errors`);
      const details = await page.evaluate(() => ({
        events: window.__incrementalBrowser?.events,
        paintedNotes: document.querySelectorAll('g.pa-annotation').length
      }));
      observations.push({ ...config, ...details });
    } finally {
      await context.close();
    }
  }

  writeLine(JSON.stringify({
    benchmark: 'real-react-incremental-layout',
    interpretation: 'Actual Chromium frames and React SVG DOM. Single-run observations, not frame-time SLOs.',
    observations
  }, null, 2));
} finally {
  await browser?.close();
  await vite.close();
}
