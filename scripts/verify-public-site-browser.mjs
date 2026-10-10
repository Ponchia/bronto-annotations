import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const publishedExamples = (await readdir(resolve(root, '_site/examples'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() &&
    existsSync(resolve(root, '_site/examples', entry.name, 'index.html')))
  .map((entry) => entry.name)
  .sort();
assert(publishedExamples.length >= 10, 'Expected all ten published examples for WCAG checks');
const server = await createServer({
  root: resolve(root, '_site'),
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
await server.listen();
const port = server.httpServer?.address();
if (!port || typeof port === 'string') throw Error('Vite server unavailable');
const url = 'http://127.0.0.1:' + port.port;
const browser = await chromium.launch({ headless: true });
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
let variants = 0;

async function visit(path, width) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(response.status() + ' ' + response.url());
  });
  const response = await page.goto(url + path, {
    waitUntil: 'networkidle',
    timeout: 40000,
  });
  assert.equal(response?.status(), 200, 'HTTP failure on ' + path);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  assert(
    overflow <= 0,
    'Horizontal overflow on ' + path + ' @ ' + width + 'px',
  );
  assert.equal(errors.length, 0, errors.join('; '));
  return page;
}
try {
  for (const width of [390, 1200]) {
    const home = await visit('/', width);
    assert.equal(
      await home.locator('#annotation-overlay .pa-annotation').count(),
      3,
    );
    assert((await home.locator('#layout-score').innerText()).match(/^\d+$/));
    const range = home.locator('#notes-count');
    await range.evaluate((el) => {
      el.value = '5';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.equal(
      await home.locator('#annotation-overlay .pa-annotation').count(),
      5,
    );
    assert.equal(await home.locator('#placed-count').innerText(), '5');
    const route = home.locator('#route-style');
    await route.selectOption('none');
    assert.equal(
      await home.locator('#annotation-overlay').getAttribute('data-route'),
      'none',
    );
    await home.locator('.reset-control').click();
    await home.waitForFunction(
      () => document.querySelector('#placed-count')?.textContent === '3',
    );
    assert.equal(await home.locator('#placed-count').innerText(), '3');
    const audit = await new AxeBuilder({ page: home })
      .withTags(wcagTags)
      .analyze();
    assert.equal(
      audit.violations.length,
      0,
      'Homepage axe violations: ' +
        audit.violations
          .map((x) => x.id + ': ' + x.nodes.map((n) => n.target).join('|'))
          .join(', '),
    );
    variants++;
    await home.context().close();

    const docs = await visit('/docs/', width);
    assert((await docs.locator('[data-doc-card]').count()) >= 25);
    await docs.locator('#docs-filter').fill('context quickstart');
    assert.equal(await docs.locator('[data-doc-card]:visible').count(), 1);
    await docs.locator('#docs-filter').fill('not-found-search-term');
    assert.equal(await docs.locator('[data-doc-card]:visible').count(), 0);
    const docAudit = await new AxeBuilder({ page: docs })
      .withTags(wcagTags)
      .analyze();
    assert.equal(
      docAudit.violations.length,
      0,
      'Docs index axe violations: ' +
        docAudit.violations.map((x) => x.id).join(', '),
    );
    variants++;
    await docs.context().close();

    const guide = await visit('/docs/context-quickstart.html', width);
    const guideAudit = await new AxeBuilder({ page: guide })
      .withTags(wcagTags)
      .analyze();
    assert.equal(
      guideAudit.violations.length,
      0,
      'Guide axe violations: ' +
        guideAudit.violations.map((x) => x.id).join(', '),
    );
    variants++;
    await guide.context().close();
  }
  for (const width of [390, 1200]) {
    for (const name of publishedExamples) {
      const example = await visit(`/examples/${name}/`, width);
      await example.locator('.pa-annotation').first().waitFor({ timeout: 30000 });
      const audit = await new AxeBuilder({ page: example })
        .withTags(wcagTags)
        .analyze();
      assert.equal(
        audit.violations.length,
        0,
        `Published example ${name} (${width}px) axe violations: ` +
          audit.violations.map((violation) =>
            `${violation.id} (${violation.impact}): ` +
            violation.nodes.map((node) => node.target.join(' ')).join(', '),
          ).join('; '),
      );
      variants++;
      await example.context().close();
    }
  }
  const demo = await visit('/examples/index/', 1200);
  // Exclude the badge label drawn intentionally next to the note box.
  const leaks = await demo.evaluate(() =>
    [...document.querySelectorAll('.pa-annotation')].flatMap((g) => {
      const bg = g
        .querySelector('.pa-annotation__note-box')
        ?.getBoundingClientRect();
      if (!bg) return [];
      return [
        ...g.querySelectorAll(
          '.pa-annotation__note .pa-annotation__title,.pa-annotation__note .pa-annotation__body',
        ),
      ]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return (
            box.right > bg.right + 2 ||
            box.bottom > bg.bottom + 2 ||
            box.left < bg.left - 2 ||
            box.top < bg.top - 2
          );
        })
        .map((el) => el.textContent);
    }),
  );
  assert.deepEqual(
    leaks,
    [],
    'Example index note text leaks beyond its background: ' +
      JSON.stringify(leaks),
  );
  await demo.context().close();
  // React Flow embeds keyboard-focusable note and edit-handle controls inside
  // an SVG. Its root must expose a named group, not an image role that hides
  // descendants from screen readers.
  for (const width of [390, 1200]) {
    const flow = await visit('/examples/react-flow-basic/', width);
    assert.equal(
      await flow.locator('svg.pa-annotation-layer').getAttribute('role'),
      'group',
      'Interactive React Flow SVG must preserve child focus semantics',
    );
    variants++;
    await flow.context().close();
  }
  console.log(
    'Public browser verified: ' +
      variants +
      ` viewport combinations, including ${publishedExamples.length} compiled examples at mobile and desktop sizes; WCAG audits, interactive controls, docs search and SVG containment verified.`,
  );
} finally {
  await browser.close();
  await server.close();
}
