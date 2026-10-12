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
import {
  captureBrowserEvidence, evidenceError, writeBrowserEvidence
} from './browser-evidence.mjs';

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
// Limit a local repro to one existing suite without affecting the protected
// default, which continues to verify every example in both browser engines.
const scenarioIndex = process.argv.indexOf('--scenario');
const scenario = scenarioIndex < 0 ? undefined : process.argv[scenarioIndex + 1];
assert(scenarioIndex < 0 || ['incremental', 'dom-measure', 'react-flow', 'worker'].includes(scenario),
  'Use --scenario incremental, dom-measure, react-flow or worker');
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
const evidenceDir = process.env.ANNOTATIONS_CROSS_BROWSER_EVIDENCE_DIR?.trim();
const captureByScenario = new Map();
const outcomeCases = [];

async function visit(browser, origin, route, viewport, label) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  async function close() {
    const result = await captureBrowserEvidence(page, evidenceDir, label);
    captureByScenario.set(label, { ...result, browserErrors: errors.slice(-20) });
    await context.close();
  }
  try {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 45000 });
    assert.equal(response?.status(), 200, `Bad HTTP response for ${route}`);
  } catch (error) {
    await close();
    throw error;
  }
  return { page, context, errors, close };
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
  const { page, context, errors, close } = await visit(browser, origin, '/examples/react-incremental/', viewport, label);
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

    // Real pointer capture can end without pointercancel. Releasing capture on
    // the actual SVG edit handle must abandon the gesture, restore the
    // provisional note and suppress a subsequent pointerup commit.
    await page.locator('#reset-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Reset to initial diagram');
    // DOMRect uses viewport-relative coordinates. Scroll the handle into view
    // BEFORE the initial measurement or the test can mistake scrolling for a
    // stale note projection (especially on a horizontally scrollable mobile
    // stage).
    await handle.scrollIntoViewIfNeeded();
    const beforeCaptureLoss = await page.evaluate(() => {
      const note = document.querySelector(
        'g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box');
      const rect = note?.getBoundingClientRect();
      const manual = window.__annotationsExample.annotations
        .find((item) => item.id === 'signal')?.manual;
      return { x: rect?.x, y: rect?.y, manual };
    });
    assert(Number.isFinite(beforeCaptureLoss.x) && Number.isFinite(beforeCaptureLoss.y),
      label + ': reset signal note is not measurable');
    await page.evaluate(() => {
      const target = document.querySelector(
        '.pa-annotation__edit-handle--note[data-annotation-id="signal"]');
      if (!target) throw new Error('Missing pointer capture target');
      const probe = { pointerId: null, lost: false };
      window.__annotationsCaptureProbe = probe;
      target.addEventListener('pointerdown', (event) => {
        probe.pointerId = event.pointerId;
      }, { once: true });
      target.addEventListener('lostpointercapture', (event) => {
        probe.lost = event.pointerId === probe.pointerId;
      }, { once: true });
    });
    const captureBox = await handle.boundingBox();
    assert(captureBox, label + ': capture target has no bounding box');
    const captureStart = {
      x: captureBox.x + captureBox.width / 2,
      y: captureBox.y + captureBox.height / 2
    };
    await page.mouse.move(captureStart.x, captureStart.y);
    await page.mouse.down();
    try {
      await page.waitForFunction(() =>
        window.__annotationsCaptureProbe?.pointerId !== null);
      await page.mouse.move(captureStart.x + 18, captureStart.y + 12, { steps: 5 });
      await page.waitForFunction((previous) => {
        const rect = document.querySelector(
          'g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box')
          ?.getBoundingClientRect();
        return Boolean(rect && (Math.abs(rect.x - previous.x) > 2
          || Math.abs(rect.y - previous.y) > 2));
      }, beforeCaptureLoss, { timeout: 15000 });

      await page.evaluate(() => {
        const target = document.querySelector(
          '.pa-annotation__edit-handle--note[data-annotation-id="signal"]');
        const pointerId = window.__annotationsCaptureProbe?.pointerId;
        if (!target?.hasPointerCapture(pointerId)) {
          throw new Error('The real edit handle never captured the active pointer');
        }
        target.releasePointerCapture(pointerId);
      });
      // Processing the next pointer event delivers lostpointercapture in
      // browsers where capture release is processed asynchronously.
      await page.mouse.move(captureStart.x + 21, captureStart.y + 13);
      await page.waitForFunction(() => window.__annotationsCaptureProbe?.lost === true);
      await page.waitForFunction((previous) => {
        const rect = document.querySelector(
          'g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box')
          ?.getBoundingClientRect();
        return Boolean(rect && Math.abs(rect.x - previous.x) < 2
          && Math.abs(rect.y - previous.y) < 2);
      }, beforeCaptureLoss, { timeout: 15000 });
    } finally {
      await page.mouse.up();
    }
    await page.evaluate(() => new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const afterCaptureLoss = await page.evaluate(() => {
      const sample = window.__annotationsExample;
      return {
        action: sample?.action,
        manual: sample?.annotations.find((item) => item.id === 'signal')?.manual,
        qualityOk: sample?.quality?.ok
      };
    });
    assert.equal(afterCaptureLoss.action, 'Reset to initial diagram',
      label + ': lost pointer capture must never persist the abandoned drag');
    assert.deepEqual(afterCaptureLoss.manual, beforeCaptureLoss.manual,
      label + ': lost capture changed the authoritative manual placement');
    assert.equal(afterCaptureLoss.qualityOk, true);
    await verifyAccessibility(page, label);
    assert.deepEqual(errors, [], label + ': unexpected browser errors');
  } finally {
    await close();
  }
}

async function verifyDomMeasurements(browser, origin, viewport, label) {
  const { page, context, errors, close } = await visit(browser, origin, '/examples/react-basic/', viewport, label);
  try {
    // This example uses AnnotationLayer measure="dom" and a live ResizeObserver.
    // The hidden DOM note copies are measured in *local CSS units*, not pixels
    // already scaled by the host surface's transform.
    const noteId = 'queue';
    await page.waitForFunction((id) => {
      const host = window.__annotationsExample;
      const measurement = Array.from(document.querySelectorAll(
        '.pa-annotation-layer__measurer > .pa-annotation__note-box'
      )).find((node) => node.querySelector('.pa-annotation__title')?.textContent === 'Input queue');
      const cssWidth = measurement && Number.parseFloat(getComputedStyle(measurement).width);
      const layoutWidth = host?.annotations?.find((note) => note.id === id)?.noteBox?.width;
      return host?.name === 'react-basic' && host.quality?.ok === true
        && Number.isFinite(cssWidth) && cssWidth > 0
        && Math.abs(layoutWidth - Math.ceil(cssWidth)) <= 1;
    }, noteId, { timeout: 30000 });

    const before = await page.evaluate((id) => {
      const host = window.__annotationsExample;
      const measurement = Array.from(document.querySelectorAll(
        '.pa-annotation-layer__measurer > .pa-annotation__note-box'
      )).find((node) => node.querySelector('.pa-annotation__title')?.textContent === 'Input queue');
      const note = host.annotations.find((item) => item.id === id);
      const sibling = host.annotations.find((item) => item.id === 'decision');
      return {
        width: note.noteBox.width,
        height: note.noteBox.height,
        siblingWidth: sibling.noteBox.width,
        computed: Number.parseFloat(getComputedStyle(measurement).width),
        screen: measurement.getBoundingClientRect().width
      };
    }, noteId);
    assert(before.width > 0 && before.height > 0 && before.siblingWidth > 0,
      label + ': initial DOM note measurement missing');

    const changed = await page.evaluate((original) => {
      const surface = document.querySelector('.flow-surface');
      const measurement = Array.from(document.querySelectorAll(
        '.pa-annotation-layer__measurer > .pa-annotation__note-box'
      )).find((node) => node.querySelector('.pa-annotation__title')?.textContent === 'Input queue');
      if (!surface || !measurement) throw new Error('DOM measurement fixture missing');
      surface.style.transformOrigin = 'top left';
      surface.style.transform = 'scale(0.8)';
      // A known local border-box change must not be confused with its
      // transform-scaled getBoundingClientRect counterpart.
      const newWidth = Math.ceil(original.computed) + 14;
      measurement.style.width = `${newWidth}px`;
      const computed = Number.parseFloat(getComputedStyle(measurement).width);
      const screen = measurement.getBoundingClientRect().width;
      return { newWidth, computed, screen };
    }, before);

    assert(Math.abs(changed.computed - changed.newWidth) < 1,
      label + ': note style did not change its local width');
    assert(Math.abs(changed.screen / changed.computed - 0.8) < 0.04,
      label + ': transform did not produce a meaningfully different screen-space measurement');

    // The real ResizeObserver must report the changed note. The renderer
    // should use local computed dimensions, preserving the unrelated note.
    try {
      await page.waitForFunction(({ id, expected, siblingWidth }) => {
        const host = window.__annotationsExample;
        const note = host?.annotations?.find((item) => item.id === id);
        const other = host?.annotations?.find((item) => item.id === 'decision');
        return Math.abs((note?.noteBox?.width ?? 0) - expected) < 1
          && Math.abs((other?.noteBox?.width ?? 0) - siblingWidth) < 1;
      }, { id: noteId, expected: changed.newWidth, siblingWidth: before.siblingWidth },
      { timeout: 9000 });
    } catch (cause) {
      const diagnostics = await page.evaluate(() => {
        const host = window.__annotationsExample;
        const nodes = Array.from(document.querySelectorAll(
          '.pa-annotation-layer__measurer > .pa-annotation__note-box'
        ));
        return {
          quality: host?.quality,
          annotations: host?.annotations?.map((item) =>
            ({ id: item.id, noteBox: item.noteBox })),
          notes: nodes.map((node) => ({
            text: node.querySelector('.pa-annotation__title')?.textContent,
            style: node.getAttribute('style'),
            computed: getComputedStyle(node).width,
            rect: node.getBoundingClientRect().width
          })),
          scale: getComputedStyle(document.querySelector('.flow-surface')).transform,
          computedNoteCount: nodes.length
        };
      });
      throw new Error(label + ': DOM ResizeObserver did not converge: ' +
        JSON.stringify({ before, changed, diagnostics, errors }), { cause });
    }

    const after = await page.evaluate((id) => {
      const host = window.__annotationsExample;
      const measurement = Array.from(document.querySelectorAll(
        '.pa-annotation-layer__measurer > .pa-annotation__note-box'
      )).find((node) => node.querySelector('.pa-annotation__title')?.textContent === 'Input queue');
      return {
        noteBox: host.annotations.find((item) => item.id === id)?.noteBox,
        cssWidth: Number.parseFloat(getComputedStyle(measurement).width),
        screenWidth: measurement.getBoundingClientRect().width,
        qualityOk: host.quality?.ok
      };
    }, noteId);
    assert(after.noteBox?.width === changed.newWidth,
      label + ': local DOM width was not propagated into authoritative note geometry');
    assert(Math.abs(after.screenWidth / after.cssWidth - 0.8) < 0.04,
      label + ': scaled screen width disagreed with local layout width');
    assert(after.qualityOk === true,
      label + ': changed DOM measurement invalidated annotation layout quality');

    await verifyAccessibility(page, label + '/DOM-measure');
    assert.deepEqual(errors, [], label + ': DOM-measured browser console or runtime errors');
  } finally {
    await close();
  }
}

async function verifyReactFlow(browser, origin, viewport, label) {
  const { page, context, errors, close } = await visit(browser, origin, '/examples/react-flow-basic/', viewport, label);
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
    await close();
  }
}

async function verifyWorker(browser, origin, viewport, label) {
  const { page, context, errors, close } = await visit(browser, origin, '/examples/react-worker/', viewport, label);
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
    await close();
  }
}

let failure;
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
        const scenarios = [
          ['incremental', verifyIncremental],
          ['dom-measure', verifyDomMeasurements],
          ['react-flow', verifyReactFlow],
          ['worker', verifyWorker]
        ];
        for (const [scenarioName, verify] of scenarios) {
          if (scenario && scenario !== scenarioName) continue;
          const caseLabel = `${label}/${scenarioName}`;
          const start = performance.now();
          try {
            await verify(browser, origin, viewport, caseLabel);
            const captured = captureByScenario.get(caseLabel) ?? {};
            assert(!evidenceDir || captured.screenshot,
              `${caseLabel}: screenshot missing: ${captured.screenshotError ?? 'unknown cause'}`);
            outcomeCases.push({
              label: caseLabel, outcome: 'passed',
              durationMs: Math.round(performance.now() - start), ...captured
            });
            verified += 1;
            process.stdout.write(`PASS ${caseLabel}\n`);
          } catch (error) {
            outcomeCases.push({
              label: caseLabel, outcome: 'failed',
              durationMs: Math.round(performance.now() - start),
              error: evidenceError(error),
              ...(captureByScenario.get(caseLabel) ?? {})
            });
            throw error;
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
  process.stdout.write(`Cross-browser verified: ${verified} integration cases; no frame-rate or paint guarantee.\n`);
} catch (error) {
  failure = error;
} finally {
  try {
    await server.close();
  } catch (error) {
    failure ??= error;
  }
  try {
    await writeBrowserEvidence(evidenceDir, {
      kind: 'annotation-browser-interactions',
      generatedAt: new Date().toISOString(),
      headSha: process.env.GITHUB_SHA || null,
      engines: suites.map(([name]) => name),
      viewports,
      verified,
      cases: outcomeCases,
      passed: !failure
    });
  } catch (error) {
    failure ??= error;
  }
}
if (failure) throw failure;
