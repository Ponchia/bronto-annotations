import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, firefox, webkit } from 'playwright';
import { build, preview } from 'vite';
import { assertNarrowInteractions, assertObservations, verifyProvenance } from './upstream-consumers-proof.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const options = { browser: 'chromium', output: join(root, '.tmp/upstream-consumers'), fixtures: join(root, 'test/fixtures/upstream-consumers') };
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--provenance-only') options.provenanceOnly = true;
  else if (['--browser', '--output-dir', '--fixture-dir'].includes(arg)) {
    const value = process.argv[++i];
    assert.ok(value && !value.startsWith('--'), `${arg} needs a value`);
    options[arg === '--browser' ? 'browser' : arg === '--output-dir' ? 'output' : 'fixtures'] = value;
  } else throw new Error(`Unknown argument ${arg}`);
}
assert.ok(['chromium', 'firefox', 'webkit'].includes(options.browser), '--browser must be chromium|firefox|webkit');
options.output = resolve(options.output);
options.fixtures = resolve(options.fixtures);
const manifest = await verifyProvenance(options.fixtures);
if (options.provenanceOnly) {
  process.stdout.write(JSON.stringify({ passed: true, hosts: manifest.hosts.map(h => ({ id: h.id, commit: h.commit, sha256: h.sha256 })) }) + '\n');
  process.exit(0);
}
await mkdir(options.output, { recursive: true });
const results = { schema: 1, kind: 'pinned-upstream-consumers', passed: false, browser: options.browser, node: process.version, sources: manifest, cases: [] };
let server;
let browser;
try {
  // Bundle every public annotation import against the actual packed artifact,
  // without installing another dependency tree or executing lifecycle scripts.
  const { stdout: packed } = await run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', options.output], { cwd: root, timeout: 60000, maxBuffer: 1024 * 1024 });
  const pack = JSON.parse(packed)[0];
  assert.ok(pack?.filename && pack.filename === basename(pack.filename), 'Invalid npm tarball name');
  assert.ok(pack.files.some(f => f.path === 'dist/index.js'), 'Build the package before consumer verification');
  await run('tar', ['-xzf', join(options.output, pack.filename), '-C', options.output], { timeout: 30000 });
  const packedRoot = join(options.output, 'package');
  const packageJson = JSON.parse(await readFile(join(packedRoot, 'package.json'), 'utf8'));
  results.package = { name: packageJson.name, version: packageJson.version, tarball: pack.filename, sha256: createHash('sha256').update(await readFile(join(options.output, pack.filename))).digest('hex') };
  const { stdout: head } = await run('git', ['rev-parse', 'HEAD'], { cwd: root });
  const { stdout: dirty } = await run('git', ['status', '--porcelain', '--', 'src', 'package.json', 'scripts/verify-upstream-consumers.mjs', 'scripts/upstream-consumers-proof.mjs', 'test/fixtures/upstream-consumers'], { cwd: root });
  results.annotationsRevision = head.trim();
  results.annotationsDirty = dirty.trim().length > 0;
  results.hostVersions = {};
  for (const host of ['vega', 'mermaid']) results.hostVersions[host] = JSON.parse(await readFile(join(root, 'node_modules', host, 'package.json'), 'utf8')).version;
  const aliases = Object.entries(packageJson.exports).filter(([name]) => name !== './package.json').map(([name, entry]) => {
    const target = typeof entry === 'string' ? entry : entry.import ?? entry.default;
    return { find: name === '.' ? '@ponchia/annotations' : '@ponchia/annotations/' + name.slice(2), replacement: join(packedRoot, target) };
  }).sort((a, b) => b.find.length - a.find.length);
  await build({ root: options.fixtures, configFile: false, logLevel: 'error', resolve: { alias: aliases }, build: { outDir: join(options.output, 'gallery'), emptyOutDir: true, chunkSizeWarningLimit: 3000 } });
  server = await preview({ root: options.fixtures, configFile: false, logLevel: 'error', build: { outDir: join(options.output, 'gallery') }, preview: { host: '127.0.0.1', port: 0, strictPort: false } });
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  results.gallery = 'gallery/index.html';
  browser = await ({ chromium, firefox, webkit })[options.browser].launch({ headless: true });
  results.browserVersion = browser.version();
  for (const viewport of [{ name: 'desktop', width: 1360, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
    const mobile = viewport.name === 'mobile';
    const touch = mobile && options.browser !== 'firefox';
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: touch,
      ...(touch ? { isMobile: true, deviceScaleFactor: 1 } : {})
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [], failedRequests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('requestfailed', r => failedRequests.push(r.url()));
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === origin || url.protocol === 'data:' ? route.continue() : route.abort();
      });
      const response = await page.goto(origin + '/', { waitUntil: 'networkidle', timeout: 45000 });
      assert.equal(response?.status(), 200, 'Gallery must load successfully');
      await page.waitForFunction(() => window.__upstreamConsumers?.ready || window.__upstreamConsumers?.error, null, { timeout: 45000 });
      const fixtureError = await page.evaluate(() => window.__upstreamConsumers.error);
      assert.ok(!fixtureError, fixtureError);
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      const interaction = {};
      const first = page.locator('#vega-bar-chart .host .mark-rect path').first();
      await first.hover();
      await page.waitForFunction(() => window.__upstreamConsumers.views[0].signal('tooltip').amount === 28);
      interaction.vegaHoverAmount = await page.evaluate(() => window.__upstreamConsumers.views[0].signal('tooltip').amount);
      interaction.vegaHoverFill = await first.getAttribute('fill');
      interaction.vegaHoverLabel = await page.locator('#vega-bar-chart .host .mark-text text').allTextContents();
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => window.__upstreamConsumers.views[0].signal('tooltip').amount === undefined);
      const observations = await page.evaluate(() => window.measureUpstreamConsumers());
      const screenshots = [];
      for (const { id } of manifest.hosts) {
        const scroller = page.locator('#' + id + ' .scroller');
        await scroller.scrollIntoViewIfNeeded();
        await scroller.evaluate(e => { e.scrollLeft = 0; });
        const filename = `${options.browser}-${viewport.name}-${id}.png`;
        await page.locator('#' + id + ' .stage').screenshot({ path: join(options.output, filename), animations: 'disabled', timeout: 15000 });
        screenshots.push(filename);
        if (mobile) {
          let touchPointer = null;
          if (touch) {
            await scroller.evaluate(e => {
              e.dataset.touchPointers = '0';
              e.addEventListener('pointerdown', event => {
                if (event.pointerType === 'touch') e.dataset.touchPointers = String(Number(e.dataset.touchPointers) + 1);
              }, { once: true });
            });
            await scroller.tap({ position: { x: 16, y: 16 } });
            touchPointer = await scroller.evaluate(e => Number(e.dataset.touchPointers));
          }
          const before = await scroller.evaluate(e => e.scrollLeft);
          await scroller.focus();
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(id => document.querySelector('#' + id + ' .scroller').scrollLeft > 0, id, { timeout: 3000 });
          interaction[id] = { keyboardScroll: await scroller.evaluate(e => e.scrollLeft) > before, touchPointer };
          await scroller.evaluate(e => { e.scrollLeft = (e.scrollWidth - e.clientWidth) / 2; });
          const viewportFile = `${options.browser}-mobile-${id}-viewport.png`;
          await page.screenshot({ path: join(options.output, viewportFile), animations: 'disabled' });
          screenshots.push(viewportFile);
        }
      }
      const profile = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, touch: navigator.maxTouchPoints, horizontalDocumentOverflow: document.documentElement.scrollWidth > innerWidth + 1 }));
      const evidence = { viewport, interactionModel: touch ? 'touch-emulated' : mobile ? 'narrow-desktop' : 'desktop', errors, failedRequests, observations, screenshots, profile, interaction, passed: false };
      results.cases.push(evidence);
      assert.deepEqual(errors, [], 'Unexpected browser errors');
      assert.deepEqual(failedRequests, [], 'Offline fixture made failed/external requests');
      assert.equal(profile.width, viewport.width);
      assert.equal(profile.height, viewport.height);
      assert.equal(profile.horizontalDocumentOverflow, false, 'Horizontal overflow must be contained in graphic scrollers');
      if (mobile) assertNarrowInteractions(profile, interaction, manifest, touch);
      assert.equal(interaction.vegaHoverAmount, 28);
      assert.equal(interaction.vegaHoverFill, 'red');
      assert.ok(interaction.vegaHoverLabel.includes('28'), 'Upstream hover label did not render');
      assertObservations(observations, manifest);
      evidence.passed = true;
    } finally { await context.close(); }
  }
  results.passed = true;
} catch (error) {
  results.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolveClose => server?.httpServer ? server.httpServer.close(resolveClose) : resolveClose());
  await writeFile(join(options.output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ passed: results.passed, browser: results.browser, cases: results.cases.length, evidence: join(options.output, 'results.json'), ...(results.error ? { error: results.error } : {}) }) + '\n');
}
