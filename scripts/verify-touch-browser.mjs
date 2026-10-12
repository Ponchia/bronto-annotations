/**
 * Real Chromium mobile-emulated touch input for the published React editor.
 * Uses CDP Input.dispatchTouchEvent, not synthetic PointerEvents: browser
 * scrolling can claim a gesture before JS prevents the default.
 *
 * Tests this intentional input boundary:
 * - initiating a touch on an edit handle drags the note and never scrolls
 * - an unrelated swipe outside a handle still scrolls the host diagram
 * - touch cancellation restores the provisional view without host commit
 *
 * Chromium touch emulation is not a physical-device/stylus certification.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  root: new URL('../', import.meta.url).pathname,
  cacheDir: '.tmp/vite-touch-browser',
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false }
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce'
});
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});

let cdp;
let touching = false;
async function touch(type, point, id = 1) {
  const touchPoints = type === 'touchEnd' || type === 'touchCancel' ? [] : [
    { x: point.x, y: point.y, id, force: 1 }
  ];
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  touching = type !== 'touchEnd' && type !== 'touchCancel';
}
async function moveTouch(from, dx, dy, id = 1) {
  for (let i = 1; i <= 5; i += 1) {
    await touch('touchMove', {
      x: from.x + dx * i / 5,
      y: from.y + dy * i / 5
    }, id);
    // A real touchscreen emits separate movement frames.
    await page.waitForTimeout(35);
  }
}
const getEditor = () => page.evaluate(() => window.__annotationsExample);
const getScroll = () => page.locator('.stage-scroll').evaluate((el) => el.scrollLeft);
const reset = async () => {
  await page.locator('#reset-note').click();
  await page.waitForFunction(() =>
    window.__annotationsExample?.action === 'Reset to initial diagram');
};

try {
  await server.listen();
  const address = server.httpServer?.address();
  assert(address && typeof address !== 'string', 'Vite did not start');
  cdp = await context.newCDPSession(page);
  const response = await page.goto(
    `http://127.0.0.1:${address.port}/examples/react-incremental/`,
    { waitUntil: 'networkidle', timeout: 45000 }
  );
  assert.equal(response?.status(), 200, 'Interactive editor did not load');
  await page.waitForFunction(() => window.__annotationsExample?.annotations.length === 4);
  await reset();

  const handle = page.locator(
    '.pa-annotation__edit-handle--note[data-annotation-id="signal"]').first();
  const scrollable = page.locator('.stage-scroll');
  await handle.scrollIntoViewIfNeeded();
  const position = await handle.boundingBox();
  assert(position && position.width > 0 && position.height > 0,
    'Touch editing handle is not measurable');
  const start = {
    x: position.x + position.width / 2,
    y: position.y + position.height / 2
  };
  const styles = await page.evaluate(() => {
    const hit = document.querySelector('.pa-annotation__edit-hit--note');
    const circle = document.querySelector('.pa-annotation__edit-handle--note');
    const scroller = document.querySelector('.stage-scroll');
    return {
      hit: hit ? getComputedStyle(hit).touchAction : undefined,
      handle: circle ? getComputedStyle(circle).touchAction : undefined,
      scroll: scroller ? getComputedStyle(scroller).touchAction : undefined
    };
  });
  assert.equal(styles.hit, 'none',
    'Only touch handles must disable browser pan/zoom (hit target)');
  assert.equal(styles.handle, 'none',
    'Only touch handles must disable browser pan/zoom (visible handle)');
  assert.notEqual(styles.scroll, 'none',
    'The host diagram must retain ordinary swipe navigation');

  const initial = await getEditor();
  const initialManual = initial.annotations.find((item) => item.id === 'signal')?.manual;
  assert(initialManual, 'Missing initial signal placement');
  const beforeNoteRect = await page.evaluate(() => {
    const rect = document.querySelector(
      'g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box'
    )?.getBoundingClientRect();
    return rect ? { x: rect.x, y: rect.y } : null;
  });
  assert(beforeNoteRect, 'Missing initial visual note geometry');
  const scrollBefore = await getScroll();
  await touch('touchStart', start);
  try {
    await moveTouch(start, 28, 14);
    await page.waitForFunction((previous) => {
      const note = document.querySelector(
        'g.pa-annotation[data-annotation-id="signal"] .pa-annotation__note-box'
      )?.getBoundingClientRect();
      return Boolean(note && (Math.abs(note.x - previous.x) > 3
        || Math.abs(note.y - previous.y) > 3));
    }, beforeNoteRect, { timeout: 12000 });
    assert.equal((await getEditor()).action, 'Reset to initial diagram',
      'Preview moved without an authoritative host commit');
    assert(Math.abs(await getScroll() - scrollBefore) < 3,
      'Dragging an edit handle unexpectedly scrolled the diagram');
  } finally {
    await touch('touchEnd', start);
  }
  await page.waitForFunction(() =>
    window.__annotationsExample?.action === 'Edited signal by dragging');
  const edited = await getEditor();
  const editedManual = edited.annotations.find((item) => item.id === 'signal')?.manual;
  assert(editedManual && Math.abs(editedManual.x - initialManual.x) > 8,
    'Real touchscreen drag must commit a changed note placement');
  assert.equal(edited.quality.ok, true, 'Touch edit must preserve placement quality');
  assert(Math.abs(await getScroll() - scrollBefore) < 3,
    'Releasing the touch should not pan the host diagram');

  // Actual cancellation must remove an in-flight visual projection without
  // persisting the partially authored placement.
  await reset();
  await handle.scrollIntoViewIfNeeded();
  const cancelBox = await handle.boundingBox();
  assert(cancelBox, 'Missing handle for cancellation');
  const cancelStart = {
    x: cancelBox.x + cancelBox.width / 2,
    y: cancelBox.y + cancelBox.height / 2
  };
  const beforeCancel = await getEditor();
  await touch('touchStart', cancelStart, 2);
  try {
    await moveTouch(cancelStart, 22, 12, 2);
  } finally {
    await touch('touchCancel', cancelStart, 2);
  }
  await page.waitForTimeout(90);
  const cancelled = await getEditor();
  assert.equal(cancelled.action, beforeCancel.action,
    'Cancelled touch must not produce a host commit');
  assert.deepEqual(cancelled.annotations.find((item) => item.id === 'signal')?.manual,
    beforeCancel.annotations.find((item) => item.id === 'signal')?.manual,
    'Touch cancellation changed the authoritative note');

  // Starting the swipe outside interactive circles must still allow native
  // horizontal scrolling in a mobile overflow viewport.
  await scrollable.evaluate((el) => { el.scrollLeft = 0; });
  await page.waitForTimeout(60);
  const area = await page.evaluate(() => {
    const root = document.querySelector('.stage-scroll');
    if (!root) throw new Error('Missing diagram scroller');
    const box = root.getBoundingClientRect();
    for (const yOffset of [65, 110, 165, 220, 275]) {
      for (const xOffset of [115, 160, 210]) {
        const x = Math.round(Math.min(box.right - 26, box.left + xOffset));
        const y = Math.round(Math.min(box.bottom - 26, box.top + yOffset));
        const target = document.elementFromPoint(x, y);
        if (target && !target.closest(
          '.pa-annotation__edit-handle, .pa-annotation__edit-hit, .toolbar'
        )) return { x, y };
      }
    }
    throw new Error('No non-interactive stage touch point in viewport');
  });
  const beforePan = await getEditor();
  await touch('touchStart', area, 3);
  try {
    await moveTouch(area, -105, 2, 3);
  } finally {
    await touch('touchEnd', area, 3);
  }
  await page.waitForTimeout(130);
  assert(await getScroll() > 20,
    'Swiping the diagram outside editing controls should still scroll');
  assert.equal((await getEditor()).action, beforePan.action,
    'Touch pan should never commit an annotation edit');
  assert.deepEqual(browserErrors, [], 'Browser console errors');

  process.stdout.write(JSON.stringify({
    kind: 'real-chromium-mobile-touch',
    touchAction: styles,
    editCommitted: true,
    cancelledGesture: true,
    ordinarySwipeScrolls: true,
    quality: edited.quality.score
  }, null, 2) + '\n');
} finally {
  if (touching && cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      .catch(() => {});
  }
  await context.close();
  await browser.close();
  await server.close();
}
