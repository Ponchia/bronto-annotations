import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';
import { verifyAuthoringDefault, openAuthoringDiagram } from './responsive-authoring-scenario.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const publication = JSON.parse(await readFile(resolve(root, '_site/release-status.json'), 'utf8'));
const publishedExamples = (await readdir(resolve(root, '_site/examples'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() &&
    existsSync(resolve(root, '_site/examples', entry.name, 'index.html')))
  .map((entry) => entry.name)
  .sort();
assert(publishedExamples.length >= 12, 'Expected all twelve published examples for WCAG checks');
assert(publishedExamples.includes('react-worker'), 'Published Worker demo must be built');
assert(publishedExamples.includes('react-incremental'), 'Published incremental demo must be built');
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
const onboardingEvidence = resolve(root, 'browser-evidence/public-onboarding');
await mkdir(onboardingEvidence, { recursive: true });

async function visit(path, width) {
  const context = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'registry.npmjs.org')
      errors.push('Version notice must not query the npm registry at runtime');
  });
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
  const notice = page.locator('[data-release-notice]');
  assert.equal(await notice.count(), 1, 'Direct page entry lacks publication status: ' + path);
  assert(await notice.isVisible(), 'Publication status must be visible: ' + path);
  assert.match(await notice.innerText(), /Docs and demos:.*Stable npm:/s);
  const noticeBox = await notice.boundingBox();
  assert(noticeBox && noticeBox.width <= width, 'Version notice overflows narrow viewport');
  assert(noticeBox.height <= (width < 500 ? 140 : 90),
    'Collapsed version notice must leave room for page content: ' + path);
  assert.equal(await notice.locator('details').getAttribute('open'), null,
    'Install guidance should start collapsed: ' + path);
  const identity = notice.locator('[data-release-identity]');
  assert(await identity.isVisible(), 'Source and stable identities must remain visible');
  assert((await identity.innerText()).includes(publication.sourceVersion));
  assert((await identity.innerText()).includes('Stable npm: ' + publication.stableVersion));
  assert.equal(await identity.locator('a').getAttribute('href'), publication.stableDocs);
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

async function verifyVersionDisclosure(page, width) {
  const notice = page.locator('[data-release-notice]');
  const details = notice.locator('details');
  const summary = details.locator('summary');
  const collapsed = await notice.boundingBox();
  const guidance = details.locator('[data-release-guidance]');
  assert.equal(await guidance.isVisible(), false);
  await notice.screenshot({ path: resolve(onboardingEvidence, `version-collapsed-${width}.png`) });
  await summary.focus();
  assert(await summary.evaluate((node) => node.matches(':focus-visible')),
    'Disclosure must expose keyboard focus');
  const focus = await summary.evaluate((node) => ({
    style: getComputedStyle(node).outlineStyle,
    width: parseFloat(getComputedStyle(node).outlineWidth)
  }));
  assert(focus.style !== 'none' && focus.width >= 2, 'Disclosure needs a visible keyboard focus ring');
  await page.keyboard.press('Enter');
  assert.equal(await details.getAttribute('open'), '');
  assert(await guidance.isVisible(), 'Keyboard Enter must reveal install guidance');
  assert((await guidance.innerText()).includes(publication.stableInstall));
  if (publication.previewVersion) {
    assert((await guidance.innerText()).includes('npm install @ponchia/annotations@' + publication.previewVersion));
    assert.equal(await guidance.locator('[data-candidate-docs]').getAttribute('href'),
      `https://github.com/Ponchia/bronto-annotations/blob/v${publication.previewVersion}/docs/README.md`);
  }
  if (!publication.sourcePublished) {
    assert((await guidance.innerText()).includes('Publication of this source is not confirmed'));
    assert(!(await guidance.innerText()).includes('npm install @ponchia/annotations@' + publication.sourceVersion));
  }
  const expanded = await notice.boundingBox();
  assert(expanded && expanded.height > collapsed.height,
    'Expanded guidance must have room to display its actual content');
  assert(expanded.height <= (width < 500 ? 620 : 360) && expanded.width <= width,
    'Expanded notice should fit its viewport without clipping install commands');
  assert.equal(await guidance.locator('a:last-child').getAttribute('href'), './docs/migration-0.7.html');
  const audit = await new AxeBuilder({ page }).include('[data-release-notice]').withTags(wcagTags).analyze();
  assert.deepEqual(audit.violations, [], 'Expanded version guidance must remain accessible');
  await notice.screenshot({ path: resolve(onboardingEvidence, `version-expanded-${width}.png`) });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.textContent),
    publication.previewVersion ? 'Candidate documentation' : '0.7 migration guide');
  await page.keyboard.press('Shift+Tab');
  assert(await summary.evaluate((node) => document.activeElement === node));
  await page.keyboard.press('Space');
  assert.equal(await details.getAttribute('open'), null, 'Space must close the native disclosure');
  assert.equal(await guidance.isVisible(), false);
  assert.equal((await notice.boundingBox()).height, collapsed.height, 'Closing restores the compact size');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-release-guidance]'))), false,
    'Collapsed guidance must not leave hidden links in the keyboard order');
}
// Unlike the headless Worker fixture, this verifies the *published* Vite
// application and separately bundled module Worker. Loading the page (or
// auditing it with axe) does not prove revision/cancellation controls work.
// Each action is checked through the demo's public DOM plus its stable,
// read-only diagnostic snapshot. No frame-timing assertions on shared CI.
async function verifyPublicWorkerDemo(width) {
  const page = await visit('/examples/react-worker/', width);
  const snapshot = () => page.evaluate(() => {
    const state = window.__annotationsWorkerDemo;
    if (!state) return null;
    return {
      ready: state.ready,
      pending: state.pending,
      commits: state.commits,
      discarded: state.discarded,
      pings: state.pings,
      lastAction: state.lastAction,
      errors: state.errors,
      parity: state.freshParity()
    };
  });
  const waitFor = (predicate, value = null) => page.waitForFunction(predicate, value, { timeout: 25000 });

  try {
    await waitFor(() => window.__annotationsWorkerDemo?.ready === true);
    assert.equal(await page.locator('svg.pa-annotation-layer .pa-annotation').count(), 18);
    assert.equal(await page.locator('#worker-commits').innerText(), '0');
    assert.equal((await snapshot()).parity, true);
    assert.deepEqual((await snapshot()).errors, []);

    // A normal commit uses the real Worker-computed authoritative geometry.
    await page.locator('#worker-move').click();
    await waitFor(() => window.__annotationsWorkerDemo?.commits === 1);
    assert.equal((await snapshot()).lastAction, 'Moved final anchor');
    assert.equal((await snapshot()).parity, true);
    assert((await page.locator('g[data-annotation-id="point-17"]').textContent()).includes('moved'));

    await page.locator('#worker-obstacle').click();
    await waitFor(() => window.__annotationsWorkerDemo?.commits === 2);
    assert.equal((await snapshot()).parity, true);
    assert.equal(await page.evaluate(() => window.__annotationsExample?.obstacles?.[1]?.x), 550);

    // Obsolete replies must never overwrite the later accepted revision.
    await page.locator('#worker-burst').click();
    await waitFor(() => window.__annotationsWorkerDemo?.commits === 3
      && window.__annotationsWorkerDemo?.lastAction === 'Newer revision');
    await waitFor(() => (window.__annotationsWorkerDemo?.discarded ?? 0) >= 1);
    assert.equal((await snapshot()).parity, true);
    assert.equal(await page.locator('#worker-commits').innerText(), '3');
    assert((await page.locator('g[data-annotation-id="point-17"]').textContent()).includes('Latest wins'));

    // Clicking the UI while a deliberately slow Worker result is queued must
    // remain possible; cancellation drops the later reply without a commit.
    const discardedBeforeCancel = (await snapshot()).discarded;
    await page.locator('#worker-delay').click();
    await waitFor(() => window.__annotationsWorkerDemo?.pending === true);
    await page.locator('#worker-ping').click();
    await waitFor(() => (window.__annotationsWorkerDemo?.pings ?? 0) >= 1);
    assert.equal((await snapshot()).commits, 3);
    await page.locator('#worker-cancel').click();
    await waitFor(() => window.__annotationsWorkerDemo?.pending === false);
    await waitFor((previousCount) =>
      (window.__annotationsWorkerDemo?.discarded ?? 0) > previousCount,
      discardedBeforeCancel
    );
    const final = await snapshot();
    assert.equal(final.commits, 3, 'Cancelled Worker result must not commit');
    assert.equal(final.parity, true, 'Displayed layout must match independent full resolution');
    assert.deepEqual(final.errors, [], 'No Worker or adapter runtime errors');
    assert.match(await page.locator('#worker-status').innerText(), /ignored/i);
    assert.equal(await page.locator('svg.pa-annotation-layer .pa-annotation').count(), 18);

    if (width < 500) {
      const scroll = page.locator('.stage-scroll');
      const range = await scroll.evaluate((node) => ({
        visible: node.clientWidth,
        content: node.scrollWidth
      }));
      assert(range.content > range.visible, 'Mobile diagram must remain horizontally navigable');
      await scroll.evaluate((node) => { node.scrollLeft = 260; });
      assert((await scroll.evaluate((node) => node.scrollLeft)) > 0);
    }
  } finally {
    await page.context().close();
  }
}

try {
  for (const width of [390, 1200]) {
    const home = await visit('/', width);
    await verifyVersionDisclosure(home, width);
    assert.equal(
      await home.locator('#annotation-overlay .pa-annotation').count(),
      3,
    );
    assert((await home.locator('#layout-score').innerText()).match(/^\d+$/));
    // Compare the same geometry and annotation set under fixed offsets versus
    // collision-aware candidate search. Both modes use the real resolver,
    // renderer and quality evaluator; no illustrative score is hardcoded.
    const mode = home.locator('#placement-mode');
    const overlay = home.locator('#annotation-overlay');
    const readMetrics = () => home.evaluate(() => {
      const element = document.querySelector('#annotation-overlay');
      return {
        mode: element?.getAttribute('data-mode'),
        score: Number(element?.getAttribute('data-score')),
        noteOverlap: Number(element?.getAttribute('data-note-overlap')),
        obstacleOverlap: Number(element?.getAttribute('data-obstacle-overlap')),
        noteCount: Number(element?.getAttribute('data-placed'))
      };
    });
    const automatic = await readMetrics();
    assert.equal(automatic.mode, 'automatic');
    assert.equal(automatic.noteCount, 3);
    await mode.selectOption('fixed');
    const fixed = await readMetrics();
    assert.equal(fixed.mode, 'fixed');
    assert.equal(await home.locator('#plot-mode-label').innerText(), 'FIXED OFFSETS');
    assert.equal(fixed.noteCount, automatic.noteCount);
    assert(fixed.noteOverlap + fixed.obstacleOverlap > 0,
      'The fixed offset baseline should visibly encounter this scene');
    assert(fixed.score < automatic.score,
      'Automatic placement should outperform the documented fixed-offset baseline');
    assert.match(await home.locator('#placement-mode-note').innerText(), /18 units right/);
    assert.equal(
      await home.locator('#obstacle-overlap-count').innerText() === 'None',
      fixed.obstacleOverlap === 0
    );
    await mode.selectOption('automatic');
    const recovered = await readMetrics();
    assert.deepEqual(recovered, automatic,
      'Switching the same inputs back to automatic must restore the exact metrics');
    assert.equal(await overlay.getAttribute('data-mode'), 'automatic');
    assert.equal(await home.locator('#plot-mode-label').innerText(), 'COLLISION-AWARE');

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
    await mode.selectOption('fixed');
    await home.locator('.reset-control').click();
    await home.waitForFunction(
      () => document.querySelector('#placed-count')?.textContent === '3'
        && document.querySelector('#annotation-overlay')?.getAttribute('data-mode') === 'automatic',
    );
    assert.equal(await home.locator('#placed-count').innerText(), '3');
    assert.equal(await mode.inputValue(), 'automatic');
    assert.deepEqual(await readMetrics(), automatic,
      'Native reset restores both the placement mode and measured metrics');
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
    await docs.locator('#docs-filter').fill('  WRAPPING    missing  ');
    assert.equal(await docs.locator('[data-doc-card]:visible').count(), 1,
      'Search must match normalized words from the guide description, not just its title');
    assert((await docs.locator('[data-doc-card]:visible h2').innerText()).includes('Troubleshooting'));
    assert.equal(await docs.locator('[data-doc-group]:visible').count(), 1,
      'Unmatched documentation groups should not leave empty headings behind');
    await docs.locator('#docs-filter').fill('not-found-search-term');
    assert.equal(await docs.locator('[data-doc-card]:visible').count(), 0);
    assert.equal(await docs.locator('[data-doc-group]:visible').count(), 0);
    assert(await docs.locator('#docs-filter-empty').isVisible());
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
    await docs.locator('#docs-filter').fill('');
    await docs.screenshot({ path: resolve(onboardingEvidence, `docs-index-${width}.png`), fullPage: false });
    await docs.context().close();

    for (const [path, evidenceName] of [
      ['/docs/context-quickstart.html', 'adapter-chooser'],
      ['/docs/getting-started.html', 'getting-started'],
      ['/docs/troubleshooting.html', 'troubleshooting'],
      ['/examples/', 'example-catalog'],
    ]) {
      const guide = await visit(path, width);
      if (path.startsWith('/docs/')) {
        const article = await guide.locator('.docs-prose').boundingBox();
        const sidebar = await guide.locator('.docs-sidebar').boundingBox();
        assert(article && sidebar, 'Published guides must have prose and topic navigation');
        if (width >= 1000) {
          assert(article.width > sidebar.width * 2,
            `Desktop guide prose must own the wide column: ${path} article=${article.width}, sidebar=${sidebar.width}`);
          assert(sidebar.x >= article.x + article.width,
            'Desktop topic navigation must follow the article on its right');
        } else {
          assert(article.width >= width - 60,
            'Mobile guide prose must use the available single-column width');
        }
      }
      const guideAudit = await new AxeBuilder({ page: guide })
        .withTags(wcagTags)
        .analyze();
      assert.equal(
        guideAudit.violations.length,
        0,
        `Guide ${path} (${width}px) axe violations: ` +
          guideAudit.violations.map((x) => x.id).join(', '),
      );
      if (path === '/docs/getting-started.html') {
        await guide.locator('details.docs-contents summary').click();
        await guide.locator('nav[aria-label="On this page"] a[href="#use-it-in-react"]').click();
        assert.equal(new URL(guide.url()).hash, '#use-it-in-react');
        const y = await guide.locator('#use-it-in-react').evaluate((node) => node.getBoundingClientRect().top);
        assert(y >= 0 && y < 100, 'Section link must scroll to the actual React heading');
        await guide.evaluate(() => scrollTo(0, 0));
        await guide.locator('details.docs-contents summary').click();
      }
      await guide.screenshot({ path: resolve(onboardingEvidence, `${evidenceName}-${width}.png`), fullPage: false });
      variants++;
      await guide.context().close();
    }
  }
  for (const width of [390, 1200]) {
    for (const name of publishedExamples) {
      const example = await visit(`/examples/${name}/`, width);
      if (name === 'react-incremental') {
        // The narrow host starts with readable notes and a closed diagram.
        // Verify that initial reading surface before opening the optional SVG;
        // retain the same visible-diagram and WCAG checks below afterward.
        await verifyAuthoringDefault(example, `Published incremental example (${width}px)`);
        const notes = example.locator('.note-list');
        await notes.waitFor({ timeout: 30000 });
        assert.equal(await notes.locator('ol > li').count(), 4);
        for (const [id, title, body] of [
          ['intake', 'Intake', 'Source geometry stays fixed.'],
          ['triage', 'Triage', 'Previous placements can be reused.'],
          ['delivery', 'Delivery', 'One authoritative resolved layout.'],
          ['signal', 'Live marker', 'Move this anchor or drag the note.'],
        ]) {
          const row = notes.locator('li').filter({ has: example.locator(`button[data-note-id="${id}"]`) });
          assert(await row.isVisible(), `Authored note ${id} must be readable before opening the diagram`);
          assert.equal(await row.locator('button strong').innerText(), title);
          assert(await row.locator('p').isVisible(), `Full body for ${id} must be visible in the note list`);
          assert.equal(await row.locator('p').innerText(), body,
            `The note list must preserve the complete authored body for ${id}`);
        }
        const disclosure = example.locator('button#diagram-disclosure');
        assert.equal(await disclosure.getAttribute('aria-controls'), 'full-diagram');
        await openAuthoringDiagram(example);
        assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
      }
      await example.locator('.pa-annotation').first().waitFor({ timeout: 30000 });
      if (name === 'svg-basic') {
        const strokes = await example.evaluate(() => {
          const chart = document.querySelector('.base-chart__line');
          const connector = document.querySelector('.pa-annotation__connector');
          return chart && connector ? [getComputedStyle(chart).stroke, getComputedStyle(connector).stroke] : [];
        });
        assert.equal(strokes.length, 2, 'SVG chart and annotation connector must both render');
        assert.notEqual(strokes[0], strokes[1], 'Host chart edges must remain visually distinct from annotation connectors');
      }
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
  for (const width of [390, 1200]) {
    await verifyPublicWorkerDemo(width);
    variants++;
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
      ` viewport combinations, including ${publishedExamples.length} compiled examples at mobile and desktop sizes; WCAG audits, real Worker revisions/cancellation, interactive controls, docs search and SVG containment verified.`,
  );
} finally {
  await browser.close();
  await server.close();
}
