/** Run after npm run site:build: node scripts/verify-demo-navigation-browser.mjs */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(root, '_site');
const catalog = JSON.parse(await readFile(resolve(root, 'examples/catalog.json'), 'utf8'));
assert.equal(Object.keys(catalog).length, 12);
const evidence = resolve(root, 'browser-evidence/demo-navigation');
await mkdir(evidence, { recursive: true });
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
// Serve the same artifact under root and repository prefixes; never use an SPA
// fallback, which could make a broken guide destination appear to succeed.
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
      .replace(/^\/bronto-annotations\//, '/');
    let file = resolve(site, '.' + path);
    if (file !== site && !file.startsWith(site + sep)) throw new Error('Outside site');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
let variants = 0;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const prefix of ['/', '/bronto-annotations/']) {
    for (const [name, example] of Object.entries(catalog)) {
      for (const width of [320, 390, 768, 1200]) {
        await page.setViewportSize({ width, height: 900 });
        const path = `${prefix}examples/${name}/`;
        const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200, path);
        const nav = page.getByRole('navigation', { name: 'Demo navigation', exact: true });
        assert.equal(await nav.count(), 1, path);
        assert(await nav.isVisible(), path);
        assert.equal(await nav.locator('.demo-navigation-title').innerText(), example.title);
        assert.equal(await page.locator('main').count(), 1, 'Preserve a single app main: ' + path);
        assert.equal(await page.locator('link[href$="/site.css"]').count(), 0, 'No full site CSS in demo');
        const labels = await page.locator('nav').evaluateAll((nodes) => nodes.map((node) =>
          node.getAttribute('aria-label') ?? node.getAttribute('aria-labelledby')));
        assert.equal(new Set(labels).size, labels.length, 'Distinct navigation landmarks: ' + path);
        const box = await nav.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width, 'Navigation fits: ' + path);
        assert(box.height <= (width < 500 ? 140 : 90), 'Navigation stays compact: ' + path);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
          `No horizontal overflow: ${path} @ ${width}`);
        const links = nav.locator('a');
        assert.equal(await links.count(), 3);
        const destinations = [`${prefix}#playground`, `${prefix}examples/`, `${prefix}docs/${example.guide}.html`];
        await links.first().focus();
        for (let index = 0; index < 3; index++) {
          const link = links.nth(index);
          assert(await link.evaluate((node) => document.activeElement === node), 'Tab order: ' + path);
          const focus = await link.evaluate((node) => ({ visible: node.matches(':focus-visible'),
            style: getComputedStyle(node).outlineStyle, width: parseFloat(getComputedStyle(node).outlineWidth) }));
          assert(focus.visible && focus.style !== 'none' && focus.width >= 2, 'Visible keyboard focus');
          const hit = await link.boundingBox();
          assert(hit.height >= 44 && hit.x >= 0 && hit.x + hit.width <= width, 'Visible touch target');
          const href = await link.evaluate((node) => node.href);
          assert.equal(href, origin + destinations[index], 'Catalog destination: ' + path);
          // Check every distinct link, including actual guide content and fragment.
          if (width === 320) {
            const target = await page.request.get(href);
            assert.equal(target.status(), 200, href);
            const html = await target.text();
            assert.match(html, /<h1\b/);
            if (index === 0) assert.match(html, /id="playground"/);
          }
          await page.keyboard.press('Tab');
        }
        assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('[data-demo-navigation]'))), false,
          'Keyboard can leave navigation');
        const audit = await new AxeBuilder({ page }).include('[data-demo-navigation]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
        assert.deepEqual(audit.violations, [], `Navigation accessibility: ${path} @ ${width}`);
        if (name === 'react-incremental' && prefix === '/') {
          await page.screenshot({ path: resolve(evidence, `editor-${width}.png`) });
        }
        // Enter must follow each native link, not merely expose a correct href.
        if (width === 390) {
          for (let index = 0; index < 3; index++) {
            if (index) await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
            await page.locator('[data-demo-navigation] a').nth(index).focus();
            await Promise.all([
              page.waitForURL(origin + destinations[index]),
              page.keyboard.press('Enter'),
            ]);
            assert.equal(page.url(), origin + destinations[index]);
          }
        }
        variants++;
      }
    }
  }
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  assert(pack.files.length > 0);
  assert(!pack.files.some(({ path }) => /^(?:_site|site|scripts|examples|test|browser-evidence)\//.test(path)
    || path.includes('demo-navigation')), 'Navigation and its evidence stay out of the npm package');
  console.log(`Demo navigation passed: ${variants} browser variants, 12 catalog guides, keyboard destinations, accessibility and package exclusion.`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
