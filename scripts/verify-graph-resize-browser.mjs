/** Verify compiled graph examples across actual same-page viewport changes. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'site-dir': { type: 'string', default: resolve(root, '_site') },
  host: { type: 'string' },
} });
const site = resolve(values['site-dir']);
const hosts = {
  'react-flow-basic': {
    frame: '.flow-shell', count: 3,
    target: '.react-flow__node[data-id="review"]', note: 'flow-review',
  },
  'mermaid-basic': {
    frame: '.diagram-shell', count: 7,
    target: '#flowchart [data-node-id="flow-api"]', note: 'mermaid-api',
  },
};
assert(!values.host || Object.hasOwn(hosts, values.host), 'Unknown graph host');
const selected = values.host ? [values.host] : Object.keys(hosts);
for (const name of selected) await access(resolve(site, 'examples', name, 'index.html'));
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = resolve(site, '.' + pathname);
    if (file !== site && !file.startsWith(site + sep)) throw new Error('Outside site');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    response.end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
let browser;
const observations = [];
const failures = [];
try {
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  for (const name of selected) {
    const host = hosts[name];
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.url().startsWith(origin) && response.status() >= 400)
          errors.push(`${response.status()} ${response.url()}`);
      });
      const response = await page.goto(`${origin}/examples/${name}/`, { waitUntil: 'networkidle' });
      assert.equal(response?.status(), 200, name);
      let initialText;
      // No reload between widths: initial rendering must not conceal stale geometry.
      for (const width of [1200, 320, 390, 768, 1200, 320]) {
        try {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForFunction(({ frameSelector, count }) => {
          const frame = document.querySelector(frameSelector);
          const svg = frame?.querySelector('svg.pa-annotation-layer');
          if (!frame || !svg) return false;
          const bounds = frame.getBoundingClientRect();
          const viewBox = svg.viewBox.baseVal;
          return frame.querySelectorAll('.pa-annotation__note').length === count
            && Math.abs(bounds.width - viewBox.width) <= 2
            && Math.abs(bounds.height - viewBox.height) <= 2;
        }, { frameSelector: host.frame, count: host.count }, { timeout: 8000, polling: 100 });
        // Let resize observers and the next paint finish without a fixed time delay.
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        assert.deepEqual(errors, [], `${name} runtime errors after resize to ${width}px`);
        const result = await page.evaluate(({ frameSelector, targetSelector, annotationId }) => {
          const frame = document.querySelector(frameSelector);
          const bounds = frame.getBoundingClientRect();
          const svg = frame.querySelector('svg.pa-annotation-layer');
          const notes = [...frame.querySelectorAll('.pa-annotation__note')].map(note => {
            const box = note.querySelector('.pa-annotation__note-box').getBoundingClientRect();
            const semanticNote = note.getAttribute('role') === 'note' ? note : note.querySelector('[role="note"]');
            const text = [...note.querySelectorAll('.pa-annotation__title,.pa-annotation__body')];
            return {
              id: semanticNote?.getAttribute('data-annotation-id') ?? null,
              text: text.map(el => el.textContent).join(' ').replace(/\s+/g, ' ').trim(),
              contained: box.left >= bounds.left - 2 && box.right <= bounds.right + 2
                && box.top >= bounds.top - 2 && box.bottom <= bounds.bottom + 2,
              textContained: text.every(el => {
                const b = el.getBoundingClientRect();
                return b.left >= box.left - 2 && b.right <= box.right + 2
                  && b.top >= box.top - 2 && b.bottom <= box.bottom + 2;
              }),
              readable: text.every(el => {
                const matrix = typeof el.getScreenCTM === 'function'
                  ? el.getScreenCTM() : el.closest('svg')?.getScreenCTM();
                const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 0;
                return parseFloat(getComputedStyle(el).fontSize) * scale >= 11;
              }),
              focusable: semanticNote?.getAttribute('tabindex') === '0'
                && Boolean(semanticNote.getAttribute('aria-label')),
            };
          });
          const target = document.querySelector(targetSelector)?.getBoundingClientRect();
          const subject = frame.querySelector(`.pa-annotation[data-annotation-id="${annotationId}"] .pa-annotation__subject`)?.getBoundingClientRect();
          const alignmentError = target && subject
            ? Math.max(...['left', 'right', 'top', 'bottom'].map(edge => Math.abs(target[edge] - subject[edge])))
            : null;
          let scrollRegion = frame.parentElement;
          while (scrollRegion && scrollRegion !== document.body
            && !(scrollRegion.scrollWidth > scrollRegion.clientWidth + 2
              && /auto|scroll/.test(getComputedStyle(scrollRegion).overflowX))) {
            scrollRegion = scrollRegion.parentElement;
          }
          return {
            documentOverflow: document.documentElement.scrollWidth - innerWidth,
            frame: { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right },
            viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
            notes, alignmentError,
            scrollable: scrollRegion && scrollRegion !== document.body ? {
              focusable: scrollRegion.tabIndex >= 0,
              named: Boolean(scrollRegion.getAttribute('aria-label') || scrollRegion.getAttribute('aria-labelledby')),
            } : null,
            quality: window.__annotationsExample?.quality?.ok,
          };
        }, { frameSelector: host.frame, targetSelector: host.target, annotationId: host.note });
        observations.push({ host: name, viewport: width, ...result });
        assert.equal(result.documentOverflow, 0, `${name} document overflow at ${width}px`);
        assert.equal(result.notes.length, host.count, `${name} must retain every note`);
        assert(result.notes.every(note => typeof note.id === 'string' && note.id.length > 0), `${name} must retain note identities`);
        assert.equal(result.quality, true, `${name} quality assertions must remain effective`);
        assert(result.notes.every(note => note.contained), `${name} has clipped notes at ${width}px`);
        assert(result.notes.every(note => note.textContained), `${name} has clipped text at ${width}px`);
        assert(result.notes.every(note => note.readable), `${name} shrinks note text at ${width}px`);
        assert(result.notes.every(note => note.focusable), `${name} loses focusable note semantics`);
        // Subjects include a deliberate 4-unit border around their target.
        assert(result.alignmentError !== null && result.alignmentError <= 8,
          `${name} subject is misaligned with live host DOM at ${width}px: ${result.alignmentError}`);
        const content = result.notes.map(({ id, text }) => ({ id, text })).sort((a, b) => a.id.localeCompare(b.id));
        if (initialText) assert.deepEqual(content, initialText, `${name} must not omit or truncate authored text on resize`);
        else initialText = content;
        if (result.scrollable || result.frame.right > width + 1 || result.frame.left < -1) {
          assert(result.scrollable?.focusable && result.scrollable.named,
            `${name} must expose an accessible local scroll region for wider geometry`);
          const region = await page.evaluateHandle(frameSelector => {
            let node = document.querySelector(frameSelector)?.parentElement;
            while (node && node !== document.body) {
              if (node.scrollWidth > node.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return node;
              node = node.parentElement;
            }
            return null;
          }, host.frame);
          try {
            const element = region.asElement();
            assert(element, 'Local graph viewport must exist');
            await element.evaluate(node => { node.scrollLeft = 0; });
            await element.focus();
            await page.keyboard.press('ArrowRight');
            await page.waitForFunction(node => node.scrollLeft > 0, element, { timeout: 2500 });
            assert.equal(await page.evaluate(() => window.scrollX), 0, 'Arrow navigation must not move the document sideways');
            await element.evaluate(node => { node.scrollLeft = 0; });
          } finally { await region.dispose(); }
        }
        } catch (error) {
          const snapshot = await page.evaluate(frameSelector => {
            const frame = document.querySelector(frameSelector);
            const svg = frame?.querySelector('svg.pa-annotation-layer');
            return { frameWidth: frame?.getBoundingClientRect().width,
              svgWidth: svg?.viewBox.baseVal.width,
              noteCount: frame?.querySelectorAll('.pa-annotation__note').length };
          }, host.frame);
          failures.push({ host: name, viewport: width, message: error.message, runtimeErrors: [...errors], snapshot });
          // A fatal host crash will not recover from another viewport change.
          if (errors.length && !snapshot.noteCount) break;
        }
      }
    } catch (error) {
      failures.push({ host: name, message: error.message });
    } finally { await context.close(); }
  }
} finally {
  try { await browser?.close(); }
  finally { if (server.listening) await new Promise(done => server.close(done)); }
}
const evidence = resolve(root, 'browser-evidence/graph-resize');
await mkdir(evidence, { recursive: true });
await writeFile(resolve(evidence, 'results.json'), JSON.stringify({ observations, failures }, null, 2) + '\n');
assert.deepEqual(failures, [], 'Graph resize regressions: ' + JSON.stringify(failures));
console.log(`Graph resize verified: ${observations.length} same-page states, live anchor alignment, retained readable notes, quality and containment.`);
