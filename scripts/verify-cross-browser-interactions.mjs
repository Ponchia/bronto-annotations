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
  return { page, errors, close };
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
  const { page, errors, close } = await visit(browser, origin, '/examples/react-incremental/', viewport, label);
  try {
    await page.waitForFunction(() =>
      window.__annotationsExample?.name === 'react-incremental'
      && window.__annotationsExample.annotations.length === 4
    );
    assert.equal(await page.locator('svg.pa-annotation-layer').getAttribute('role'), 'group',
      label + ': interactive SVG must expose keyboard-focusable descendants');
    assert.equal(await page.locator('g.pa-annotation').count(), 4);
    assert.equal(await page.locator('#undo-edit').isDisabled(), true);
    assert.equal(await page.locator('#redo-edit').isDisabled(), true);
    // CSS style values are checked in Firefox/WebKit; only Chromium can run
    // the real touchStart/move/end/cancel CDP gesture below in its own lane.
    const touchStyles = await page.evaluate(() => ({
      hit: getComputedStyle(document.querySelector('.pa-annotation__edit-hit--note')).touchAction,
      handle: getComputedStyle(document.querySelector('.pa-annotation__edit-handle--note')).touchAction,
      scroller: getComputedStyle(document.querySelector('.stage-scroll')).touchAction
    }));
    assert.equal(touchStyles.hit, 'none', label + ': enlarged hit circle must own touch drags');
    assert.equal(touchStyles.handle, 'none', label + ': editing circle must own touch drags');
    assert.notEqual(touchStyles.scroller, 'none',
      label + ': host stage must retain ordinary touch scrolling');

    const inspector = page.locator('.annotation-source');
    await inspector.locator('summary').click();
    const exportedAnnotations = async () =>
      JSON.parse(await page.locator('#annotation-json').textContent());
    const originalData = await exportedAnnotations();
    assert.equal(originalData.length, 4, label + ': JSON must contain the original host inputs');
    assert.equal(originalData.find((note) => note.id === 'signal')?.placement?.manual?.x, 307);
    assert.equal(Object.hasOwn(originalData[0], 'candidates'), false,
      label + ': computed placement candidates should not be exported');
    assert.equal(await page.locator('#copy-annotations').isEnabled(), true);

    // The text editor also follows a note selected directly from the canvas.
    // No layout resolution, undo entry or persisted annotation edit is allowed
    // merely because a user clicked or keyboard-focused a visible note.
    const initialSelectionChanges = await page.evaluate(() =>
      window.__annotationsExample.changes);
    const intakeNote = page.locator(
      'g.pa-annotation[data-annotation-id="intake"] .pa-annotation__note-box');
    await intakeNote.focus();
    await page.waitForFunction(() =>
      document.querySelector('#text-editor-note')?.value === 'intake');
    const triageNote = page.locator(
      'g.pa-annotation[data-annotation-id="triage"] .pa-annotation__note-box');
    await triageNote.click();
    await page.waitForFunction(() =>
      document.querySelector('#text-editor-note')?.value === 'triage');
    assert.match(await page.locator('.selection-hint [role="status"]').innerText(), /Selected:\s*Triage/,
      label + ': selecting a canvas note did not update the visible selection status');
    assert.equal(await page.evaluate(() => window.__annotationsExample.changes),
      initialSelectionChanges, label + ': selecting a canvas note committed a diagram edit');
    assert.equal(await page.locator('#undo-edit').isDisabled(), true,
      label + ': canvas selection added an undo step');

    // Basic text authoring should not require manually rewriting JSON.
    // Draft typing is not a committed layout action; Apply is one undo step.
    await page.locator('#text-editor-note').selectOption('signal');
    const originalChanges = await page.evaluate(() => window.__annotationsExample.changes);
    await page.locator('#text-editor-title').fill('');
    await page.locator('#text-editor-body').fill('');
    assert.equal(await page.locator('#apply-note-text').isDisabled(), true,
      label + ': empty note fields must not commit');
    assert.equal(await page.locator('.note-text-editor-error[role="alert"]').count(), 1);
    await page.locator('#text-editor-title').fill('Signal updated');
    await page.locator('#text-editor-body').fill('Edited through the host form.');
    assert.equal(await page.evaluate(() => window.__annotationsExample.changes), originalChanges,
      label + ': typing a draft must not solve or commit');
    await page.locator('#apply-note-text').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Edited signal text');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')?.note?.title,
      'Signal updated');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')?.note?.body,
      'Edited through the host form.');
    assert.equal(await page.evaluate(() => window.__annotationsExample.changes), originalChanges + 1);
    assert.equal(await page.evaluate(() => window.__annotationsExample.quality.ok), true);
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Edited signal text');
    assert.deepEqual((await exportedAnnotations()).find((note) => note.id === 'signal')?.note,
      originalData.find((note) => note.id === 'signal')?.note);
    await page.locator('#redo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Edited signal text');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')?.note?.title,
      'Signal updated');
    await page.locator('#reset-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Reset to initial diagram');
    assert.deepEqual(await exportedAnnotations(), originalData);

    // Round-trip host-authored inputs in the *same* editor without changing
    // the library API or persisting candidate/diagnostic layouts.
    await page.locator('#edit-current-json').click();
    const importField = page.locator('#annotation-import-input');
    assert.deepEqual(JSON.parse(await importField.inputValue()), originalData,
      label + ': starting draft differs from exported authored JSON');
    const imported = structuredClone(originalData);
    imported.find((note) => note.id === 'signal').placement.manual.x += 15;
    await importField.fill(JSON.stringify(imported));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 4 annotations from JSON');
    assert.equal(await page.locator('#annotation-import-error').count(), 0);
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 0,
      label + ': importing a new authoritative session must not report old reuse');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, 322);
    assert.equal(await page.evaluate(() => window.__annotationsExample.quality.ok), true);
    assert.equal(await page.locator('#undo-edit').isEnabled(), true);
    assert.equal(await page.locator('#redo-edit').isDisabled(), true);

    // Import is one reversible transaction: it never records intermediate
    // candidate geometry or adds one history entry per imported annotation.
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Imported 4 annotations from JSON');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, 307);
    assert.equal(await page.locator('#redo-edit').isEnabled(), true);
    await page.locator('#redo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Imported 4 annotations from JSON');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, 322);
    assert.equal(await page.evaluate(() => window.__annotationsExample.quality.ok), true);

    const committedBeforeInvalid = await page.evaluate(() =>
      window.__annotationsExample.changes);
    const duplicate = structuredClone(imported);
    duplicate[1].id = duplicate[0].id;
    await importField.fill(JSON.stringify(duplicate));
    await page.locator('#load-annotation-json').click();
    await page.locator('#annotation-import-error').waitFor();
    assert.match(await page.locator('#annotation-import-error').innerText(), /duplicate annotation id/i);
    assert.equal(await page.evaluate(() => window.__annotationsExample.changes),
      committedBeforeInvalid, label + ': malformed import modified committed state');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, 322, label + ': failed import replaced the layout');
    // Ctrl+Z while authoring JSON is the browser's native field undo. It must
    // not revert the host's previously committed annotations.
    await importField.focus();
    await importField.press('Control+z');
    assert.equal(await page.evaluate(() => window.__annotationsExample.changes),
      committedBeforeInvalid, label + ': JSON draft undo changed committed history');

    // Imported inputs and the toolbar must honor the *same* maximum. Never
    // allow a generated 11th note whose exported JSON cannot be reloaded.
    const maximum = Array.from({ length: 10 }, (_, index) => ({
      id: `imported-${index}`,
      anchor: { type: 'point', point: { x: 65 + index * 72, y: 410 } },
      note: { title: `Imported ${index + 1}` }
    }));
    await importField.fill(JSON.stringify(maximum));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 10 annotations from JSON');
    assert.equal((await exportedAnnotations()).length, 10);
    assert.equal(await page.locator('#append-note').isDisabled(), true,
      label + ': add action would exceed importable annotation limit');
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Imported 10 annotations from JSON');
    assert.equal((await exportedAnnotations()).length, 4);
    assert.equal(await page.locator('#append-note').isEnabled(), true);
    await page.locator('#redo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Imported 10 annotations from JSON');
    assert.equal((await exportedAnnotations()).length, 10);
    assert.equal(await page.locator('#append-note').isDisabled(), true);

    // Imports may use the demo's historical "added" ID legitimately. The
    // toolbar must generate a fresh ID rather than treating that imported
    // document as its own previously-added note.
    const withCollision = [
      { id: 'added', anchor: { type: 'point', point: { x: 125, y: 120 } },
        note: { title: 'Imported added' } },
      { id: 'custom', anchor: { type: 'point', point: { x: 420, y: 130 } },
        note: { title: 'Other imported note' } }
    ];
    await importField.fill(JSON.stringify(withCollision));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 2 annotations from JSON');
    assert.equal(await page.locator('#append-note').isEnabled(), true);
    assert.equal(await page.locator('#remove-note').isEnabled(), true);
    await page.locator('#append-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Appended an annotation');
    const appended = await exportedAnnotations();
    assert.deepEqual(appended.map((item) => item.id), ['added', 'custom', 'added-2'],
      label + ': adding a note overwrote an imported reserved-looking ID');
    assert.deepEqual(appended[0], withCollision[0]);
    await page.locator('#remove-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Removed the final note');
    assert.deepEqual(await exportedAnnotations(), withCollision,
      label + ': remove-final deleted a different imported annotation');
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Removed the final note');
    assert.deepEqual((await exportedAnnotations()).map((item) => item.id),
      ['added', 'custom', 'added-2']);
    await page.locator('#redo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Removed the final note');
    assert.deepEqual(await exportedAnnotations(), withCollision);

    await importField.fill(JSON.stringify([withCollision[0]]));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 1 annotations from JSON');
    assert.equal(await page.locator('#remove-note').isDisabled(), true,
      label + ': demo allowed deletion of its sole imported note');

    // The move action is about the final authored anchor, not the built-in
    // "signal" ID. A fully imported one-note *box* document must retain its
    // anchor type, dimensions, note text and exact JSON round-trip.
    const importedBox = [{
      id: 'host-box',
      anchor: {
        type: 'box', side: 'left',
        box: { x: 120, y: 210, width: 75, height: 38 }
      },
      note: { title: 'Host supplied box' }
    }];
    await importField.fill(JSON.stringify(importedBox));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 1 annotations from JSON');
    assert.equal(await page.locator('#move-note').isEnabled(), true,
      label + ': Move final anchor is disabled for an imported box without signal');
    await page.locator('#move-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Moved the final anchor');
    const movedHost = await exportedAnnotations();
    assert.deepEqual(movedHost[0].anchor, {
      type: 'box', side: 'left',
      box: { x: 175, y: 262, width: 75, height: 38 }
    }, label + ': move final anchor changed the imported box type or dimensions');
    assert.deepEqual(movedHost[0].note, importedBox[0].note);
    await page.locator('#edit-current-json').click();
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 1 annotations from JSON');
    assert.equal(await page.locator('#annotation-import-error').count(), 0,
      label + ': a moved imported box can no longer round-trip through JSON');
    assert.deepEqual(await exportedAnnotations(), movedHost);
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Moved the final anchor');
    assert.deepEqual(await exportedAnnotations(), importedBox,
      label + ': no-op reimport added a false undo step or lost the old box');
    await page.locator('#redo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Moved the final anchor');
    assert.deepEqual(await exportedAnnotations(), movedHost);

    // Imported IDs are unconstrained host strings, not object-map field
    // declarations. Reading a plain noteSizes object must not accidentally
    // find inherited Object.prototype members like constructor or __proto__.
    // Those yielded NaN note-box coordinates before the core own-key guard.
    const specialIds = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
    const hostNames = specialIds.map((id, index) => ({
      id,
      anchor: { type: 'point', point: { x: 90 + index * 200, y: 172 } },
      note: { title: `Host note ${index + 1}` },
      placement: { manual: { x: 45 + index * 200, y: 62, side: 'top' } }
    }));
    await importField.fill(JSON.stringify(hostNames));
    await page.locator('#load-annotation-json').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Imported 4 annotations from JSON');
    assert.equal(await page.locator('#annotation-import-error').count(), 0);
    assert.deepEqual((await exportedAnnotations()).map((item) => item.id), specialIds);
    const safeBoxes = await page.evaluate(() =>
      window.__annotationsExample.annotations.map((item) => ({
        id: item.id,
        noteBox: item.noteBox
      }))
    );
    assert.equal(safeBoxes.length, specialIds.length);
    for (const { id, noteBox } of safeBoxes) {
      assert(Object.values(noteBox).every(Number.isFinite),
        `${label}: imported ${id} used an inherited note-size key: ${JSON.stringify(noteBox)}`);
      assert(noteBox.width > 0 && noteBox.height > 0);
    }
    await page.locator('#move-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Moved the final anchor');
    assert.deepEqual((await exportedAnnotations()).map((item) => item.id), specialIds,
      label + ': toolbar action changed imported special-looking IDs');
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Moved the final anchor');
    assert.deepEqual(await exportedAnnotations(), hostNames,
      label + ': undo could not restore imported special-ID annotations');

    await page.locator('#reset-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Reset to initial diagram');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, 307);

    await page.locator('#move-note').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Moved the final anchor');
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 3,
      label + ': late anchor move should keep the earlier placements');

    // Shortcuts work outside text editors; they undo committed host state.
    await page.locator('#move-note').focus();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Moved the final anchor');
    assert.deepEqual((await exportedAnnotations()).find((note) => note.id === 'signal')?.anchor,
      originalData.find((note) => note.id === 'signal')?.anchor,
      label + ': Ctrl+Z did not restore the prior anchor');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Moved the final anchor');
    assert.equal(await page.evaluate(() => window.__annotationsExample.quality.ok), true);
    await page.locator('#append-note').click();
    await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 5);
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 4);
    assert.equal((await exportedAnnotations()).length, 5,
      label + ': exported inputs must reflect committed additions');
    await page.locator('#remove-note').click();
    await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 4);
    assert.equal(await page.evaluate(() => window.__annotationsExample?.reused), 4);
    assert.equal((await exportedAnnotations()).length, 4,
      label + ': exported inputs must reflect committed removals');

    await page.locator('#copy-annotations').click();
    await page.waitForFunction(() =>
      (document.querySelector('#copy-status')?.textContent?.length ?? 0) > 0);
    assert.match(await page.locator('#copy-status').innerText(), /copied|clipboard unavailable/i);

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
    const exportedAfterDrag = await exportedAnnotations();
    assert.equal(exportedAfterDrag.length, 4);
    assert.notEqual(exportedAfterDrag.find((note) => note.id === 'signal')?.placement?.manual?.x, 307,
      label + ': live JSON must reflect the completed pointer edit');

    // Pointer movement did not pollute undo history: undo reverts the one
    // committed drag, and redo restores exactly that authored placement.
    await page.locator('#undo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Undid: Edited signal by dragging');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, 307);
    await page.locator('#redo-edit').click();
    await page.waitForFunction(() =>
      window.__annotationsExample?.action === 'Redid: Edited signal by dragging');
    assert.equal((await exportedAnnotations()).find((note) => note.id === 'signal')
      ?.placement?.manual?.x, exportedAfterDrag.find((note) => note.id === 'signal')?.placement?.manual?.x);

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
  const { page, errors, close } = await visit(browser, origin, '/examples/react-basic/', viewport, label);
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
  const { page, errors, close } = await visit(browser, origin, '/examples/react-flow-basic/', viewport, label);
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
      // The note starts just above a padded review-node obstacle. Move
      // outward, not downward into protected content: this test validates
      // the edit gesture rather than deliberately forcing an invalid note.
      await page.mouse.move(start.x - 14, start.y - 10, { steps: 5 });
      try {
        await page.waitForFunction((before) => {
          const rect = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box')
            ?.getBoundingClientRect();
          return Boolean(rect && (Math.abs(rect.x - before.x) > 2 || Math.abs(rect.y - before.y) > 2));
        }, original.box, { timeout: 15000 });
      } catch (error) {
        // If Firefox/WebKit never paint the preview, retain actionable input
        // and geometry evidence rather than reporting only a generic timeout.
        const diagnostic = await page.evaluate(({ x, y }) => {
          const rect = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box')
            ?.getBoundingClientRect();
          return {
            rect: rect ? { x: rect.x, y: rect.y } : null,
            topElement: document.elementFromPoint(x, y)?.outerHTML.slice(0, 600),
            activeElement: document.activeElement?.outerHTML.slice(0, 600),
            lastEdit: window.__annotationsLastEdit,
            quality: window.__annotationsExample?.quality,
            editPatchIds: window.__annotationsExample?.editPatchIds
          };
        }, start);
        throw new Error(label + ': preview did not move: ' + JSON.stringify({
          before: original.box, diagnostic, browserErrors: errors
        }) + ': ' + String(error));
      }
      assert.equal(await page.evaluate(() =>
        window.__annotationsExample?.editPatchIds?.includes('flow-review') ?? false),
      false, label + ': preview must not persist before pointer release');
    } finally {
      await page.mouse.up();
    }

    try {
      await page.waitForFunction(() => {
        const sample = window.__annotationsExample;
        const edit = window.__annotationsLastEdit;
        return edit?.annotationId === 'flow-review'
          && edit.phase === 'end'
          && sample?.editPatchIds?.includes('flow-review')
          && sample.annotations?.find((note) => note.id === 'flow-review')?.manual;
      }, null, { timeout: 15000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const sample = window.__annotationsExample;
        const rect = document.querySelector('g[data-annotation-id="flow-review"] .pa-annotation__note-box')
          ?.getBoundingClientRect();
        return {
          lastEdit: window.__annotationsLastEdit,
          patchIds: sample?.editPatchIds,
          annotations: sample?.annotations,
          quality: sample?.quality,
          noteRect: rect ? { x: rect.x, y: rect.y } : null
        };
      });
      throw new Error(label + ': transformed edit did not commit: ' + JSON.stringify({
        diagnostic, browserErrors: errors
      }) + ': ' + String(error));
    }
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
    await updatedHandle.press('ArrowLeft');
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
  const { page, errors, close } = await visit(browser, origin, '/examples/react-worker/', viewport, label);
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
      leanLayout: window.__annotationsWorkerDemo.leanLayout,
      measuring: Boolean(document.querySelector('.pa-annotation-layer__measurer')),
      workerErrors: window.__annotationsWorkerDemo.errors
    }));
    assert.equal(state.commits, 2, label + ': cancelled result must not commit');
    assert.equal(state.parity, true, label + ': committed state must remain authoritative');
    assert.equal(state.leanLayout, true, label + ': default Worker payload must omit candidate diagnostics');
    assert.equal(state.measuring, false, label + ': Worker layout rendering must never self-measure');
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
