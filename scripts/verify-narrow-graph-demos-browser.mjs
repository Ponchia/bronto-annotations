import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Run after the package build. Exporting the page scenario also lets a local
// playwright-cli session exercise exactly the same checks as CI.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const output = resolve(process.env.ANNOTATIONS_GRAPH_EVIDENCE ?? resolve(root, '.tmp/narrow-graph-demos'));
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const base of ['/', '/bronto-annotations/']) {
      const server = await createServer({ root, base, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
      try {
        await server.listen();
        const address = server.httpServer.address();
        const page = await browser.newPage();
        try {
          results.push(...await verifyNarrowGraphDemos(page, `http://127.0.0.1:${address.port}${base}`, output));
        } finally {
          await page.close();
        }
      } finally {
        await server.close();
      }
    }
    await writeFile(resolve(output, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
    console.log(`Narrow graph demos passed: ${results.length} browser cases across root and prefixed routes.`);
  } finally {
    await browser.close();
  }
}

export async function verifyNarrowGraphDemos(page, baseUrl, output) {
  const results = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('pageerror', onError);
  page.on('console', onConsole);
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const settle = async () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const prefix = baseUrl.endsWith('/bronto-annotations/') ? 'prefixed' : 'root';

  async function inspect(name, phase, width) {
    await settle();
    const evidence = await page.evaluate(() => {
      const box = element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const groups = [...document.querySelectorAll('.pa-annotation')];
      const notes = groups.map(group => ({ id: group.dataset.annotationId, ...box(group.querySelector('.pa-annotation__note-box')) }));
      const textOverflow = groups.flatMap(group => {
        const note = box(group.querySelector('.pa-annotation__note-box'));
        return [...group.querySelectorAll('text, .pa-annotation__title, .pa-annotation__body')].filter(text => {
          const r = box(text);
          return r.x < note.x - 1 || r.y < note.y - 1 || r.right > note.right + 1 || r.bottom > note.bottom + 1;
        }).map(text => `${group.dataset.annotationId}: ${text.textContent}`);
      });
      const overlaps = notes.flatMap((a, i) => notes.slice(i + 1).filter(b =>
        Math.min(a.right, b.right) - Math.max(a.x, b.x) > 0.5 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 0.5
      ).map(b => [a.id, b.id]));
      const data = window.__annotationsExample;
      const targets = data?.name === 'react-flow-basic'
        ? [['flow-review', '.react-flow__node[data-id="review"]']]
        : [
          ['mermaid-api', '#flowchart [data-node-id="flow-api"]'],
          ['mermaid-report', '#flowchart [data-node-id="flow-report"]'],
          ['mermaid-translated-data', '#flowchart [data-node-id="flow-intake"]'],
          ['mermaid-sequence-api', '#sequence [data-participant-id="sequence-api"]'],
          ['mermaid-sequence-message', '#sequence [data-message-id="api-report-request"]']
        ];
      // Read current rendered targets independently of the adapter's retained
      // alignment report: a stale report can still say ok after a resize.
      const alignment = targets.map(([id, selector]) => {
        const subject = document.querySelector(`.pa-annotation[data-annotation-id="${id}"] .pa-annotation__subject`);
        const target = document.querySelector(selector);
        if (!subject || !target) return { id, distance: null };
        const a = box(subject), b = box(target);
        return { id, distance: Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) };
      });
      const scroller = document.querySelector('.graph-scroll');
      return {
        notes: notes.length, textOverflow, overlaps, alignment,
        quality: data?.quality, targetAlignment: data?.targetAlignment?.ok,
        documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
        scrollWidth: scroller?.scrollWidth, clientWidth: scroller?.clientWidth,
        connectors: document.querySelectorAll('.pa-annotation__connector').length,
        viewportTransformActive: data?.viewportTransformActive
      };
    });
    const label = `${prefix} ${name} ${width}px ${phase}`;
    check(errors.length === 0, `${label}: browser errors: ${errors.join('\n')}`);
    check(evidence.notes === (name === 'react-flow-basic' ? 3 : 7), `${label}: missing notes`);
    check(evidence.connectors >= evidence.notes, `${label}: missing connectors`);
    check(evidence.quality?.ok && evidence.targetAlignment, `${label}: quality/alignment failed`);
    check(evidence.quality.metrics.noteOverlapArea === 0 && evidence.quality.metrics.boundsOverflowArea === 0 && evidence.quality.metrics.obstacleOverlapArea === 0, `${label}: layout collisions/overflow`);
    check(evidence.documentWidth <= evidence.viewportWidth, `${label}: global horizontal overflow`);
    check(evidence.overlaps.length === 0, `${label}: rendered note overlap ${JSON.stringify(evidence.overlaps)}`);
    check(evidence.textOverflow.length === 0, `${label}: text escapes note boxes ${evidence.textOverflow.join(', ')}`);
    check(evidence.alignment.every(target => target.distance !== null && target.distance < 2), `${label}: stale rendered anchor ${JSON.stringify(evidence.alignment)}`);
    if (name === 'react-flow-basic') check(evidence.viewportTransformActive, `${label}: graph viewport was not transformed`);
    results.push({ name, prefix, phase, width, ...evidence });
  }

  try {
    for (const name of ['react-flow-basic', 'mermaid-basic']) {
      for (const width of [320, 360, 390, 560, 600, 730, 768, 1200]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${baseUrl}examples/${name}/`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => !!window.__annotationsExample, null, { timeout: 15000 });
        await inspect(name, 'mount', width);
        if (output) await page.screenshot({ path: `${output}/${prefix}-${name}-${width}.png`, fullPage: true });
        // Every note must be reachable inside the local scroll region. Its
        // keyboard focus must not pan the whole document horizontally.
        for (const note of await page.locator('.pa-annotation__note-box').all()) {
          await note.scrollIntoViewIfNeeded();
          const reachable = await note.evaluate(element => {
            const a = element.getBoundingClientRect();
            const b = document.querySelector('.graph-scroll').getBoundingClientRect();
            return a.left >= b.left - 1 && a.right <= b.right + 1;
          });
          check(reachable, `${name} ${width}px: note cannot be scrolled into view`);
        }
        await inspect(name, 'scrolled', width);
        if (width === 320) {
          const scroller = page.locator('.graph-scroll');
          const help = page.locator('#graph-scroll-help');
          check(await help.isVisible(), `${name}: horizontal exploration must have a visible hint`);
          check(await scroller.getAttribute('aria-describedby') === 'graph-scroll-help',
            `${name}: keyboard scroll region must expose the same instruction`);
          check((await help.innerText()).includes('arrow keys'), `${name}: explain keyboard navigation`);
          await scroller.evaluate(element => { element.scrollLeft = 0; });
          await scroller.focus();
          await page.keyboard.press('ArrowRight');
          await page.waitForFunction(() => document.querySelector('.graph-scroll').scrollLeft > 0);
          await scroller.evaluate(element => { element.scrollLeft = element.scrollWidth; });
          await settle();
          if (output) await page.screenshot({ path: `${output}/${prefix}-${name}-${width}-scrolled.png`, fullPage: true });
        }
      }
      // Exercise live resizing, including both layout breakpoints, without a
      // navigation that could conceal stale geometry.
      for (const width of [320, 560, 600, 730, 768, 390, 1200]) {
        await page.setViewportSize({ width, height: 844 });
        await inspect(name, 'resized', width);
      }
      // An embedding host may pan/scale the whole diagram. Trigger a size
      // observation while transformed to catch bounds measured in screen px.
      await page.locator('.graph-scroll').evaluate(element => {
        element.style.transformOrigin = 'top left';
        element.style.transform = 'translate(8px, 6px) scale(0.8)';
        element.style.width = '680px';
      });
      await inspect(name, 'host-transform', 1200);
      if (name === 'react-flow-basic') {
        const note = page.locator('.pa-annotation[data-annotation-id="flow-review"] .pa-annotation__note-box');
        const handle = page.locator('.pa-annotation__edit-handle--note[data-annotation-id="flow-review"]');
        const before = await note.boundingBox();
        const h = await handle.boundingBox();
        await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
        await page.mouse.down();
        // The compact note starts at the left padding boundary: move inward
        // and up so this tests conversion, not intentional bounds clamping.
        await page.mouse.move(h.x + h.width / 2 + 8, h.y + h.height / 2 - 8, { steps: 4 });
        await page.mouse.up();
        await page.waitForFunction(() => window.__annotationsExample?.editPatchIds.includes('flow-review'));
        const after = await note.boundingBox();
        check(Math.abs(after.x - before.x - 8) < 1 && Math.abs(after.y - before.y + 8) < 1, `Scaled host drag did not preserve client-space movement: ${JSON.stringify({ before, after })}`);
        await inspect(name, 'host-transform-edit', 1200);
      }
    }
    return results;
  } finally {
    page.off('pageerror', onError);
    page.off('console', onConsole);
  }
}
