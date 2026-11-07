import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Real CSS/Range geometry from the built DOM helper. No mocked rectangles,
// source transpilation or optional host peers are used in this browser check.
export async function verifyRangeTransforms(browser) {
  const code = await readFile(new URL('../dist/dom/range.js', import.meta.url), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  let checks = 0;
  for (const width of [360, 1200]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.setContent(`<style>
        body { margin: 60px; } #host, #ancestor { transform-origin: 0 0; }
        #space { box-sizing: content-box; width: 220px; height: 90px; border: 3px solid;
          padding: 20px; overflow: auto; transform-origin: 0 0; font: 16px monospace; }
        #content { width: 500px; height: 300px; } #text { white-space: nowrap; }
        </style><div id="host"><div id="ancestor"><div id="space"><div id="content">
        <span id="text">Selected passage</span></div></div></div></div>`);
      await page.evaluate(async url => { globalThis.measureRangeForTest = (await import(url)).measureRangeAnchor; }, moduleUrl);
      const measure = async (css, target = 'space') => page.evaluate(({ css, target }) => {
        const space = document.getElementById('space');
        document.getElementById('host').style.cssText = '';
        document.getElementById('ancestor').style.cssText = '';
        space.style.cssText = '';
        document.getElementById(target).style.cssText = css;
        space.scrollLeft = 10; space.scrollTop = 5;
        const range = document.createRange(); range.selectNodeContents(document.getElementById('text'));
        return { local: globalThis.measureRangeForTest(range, { coordinateSpace: space }),
          viewport: globalThis.measureRangeForTest(range) };
      }, { css, target });
      const baseline = (await measure('')).local;
      assert.equal(baseline.status, 'resolved');
      const nearBaseline = result => {
        assert.equal(result.status, 'resolved');
        assert.equal(result.rects.length, baseline.rects.length);
        for (const key of ['x', 'y', 'width', 'height']) {
          assert(Math.abs(result.box[key] - baseline.box[key]) < 0.1,
            `Range ${key} changed under supported 2D transforms at ${width}px`);
        }
      };
      for (const css of [
        'translate: 20px 40px; scale: 2 3',
        'translate: calc(10% + 2px) 20%; scale: 1.25 0.75',
        'translate: 20px 40px 0px; scale: 2 3 1',
        'rotate: 0deg', 'rotate: 360deg', 'rotate: x 0deg',
        'rotate: 400grad', 'rotate: 1turn',
        'transform: translate(20px, 40px) scale(2, 3)', 'perspective: 500px'
      ]) {
        for (const target of ['space', 'ancestor']) { nearBaseline((await measure(css, target)).local); checks++; }
      }
      for (const css of [
        'rotate: 30deg', 'rotate: x 30deg', 'rotate: 0 0 1 30deg',
        'scale: -1 1', 'scale: 1 -1', 'scale: -1', 'scale: 1 1 2',
        'translate: 0px 0px 20px', 'transform: rotate(30deg)', 'transform: skewX(20deg)',
        'offset-path: path("M 0 0 L 30 40"); offset-distance: 20px'
      ]) {
        for (const target of ['space', 'ancestor']) {
          const result = await measure(css, target);
          assert.equal(result.local.status, 'unsupported', `${target} ${css} at ${width}px`);
          assert.deepEqual(result.local.rects, []); assert.equal(result.local.box, undefined);
          assert.equal(result.viewport.status, 'resolved', 'Viewport mode must remain independent of local conversion'); checks++;
        }
      }
      for (const css of ['scale: 0', 'display: none']) {
        assert.equal((await measure(css)).local.status, 'unsupported'); checks++;
      }
      // A containing element in shadow DOM must inspect its rendered hosts;
      // a slotted element must inspect the slot's ancestors as well.
      for (const mode of ['shadow', 'slot']) {
        const result = await page.evaluate(mode => {
          const host = document.createElement('div'); document.body.append(host);
          const shadow = host.attachShadow({ mode: 'open' });
          const space = document.createElement('div'); space.textContent = 'Shadow passage';
          space.style.cssText = 'width:200px;height:80px;padding:10px;border:2px solid;font:16px monospace';
          let transformed;
          if (mode === 'shadow') { shadow.append(space); transformed = host; }
          else { const wrapper = document.createElement('div'); wrapper.append(document.createElement('slot'));
            shadow.append(wrapper); host.append(space); transformed = wrapper; }
          const range = document.createRange(); range.selectNodeContents(space);
          const before = globalThis.measureRangeForTest(range, { coordinateSpace: space });
          transformed.style.rotate = '30deg';
          const after = globalThis.measureRangeForTest(range, { coordinateSpace: space });
          host.remove(); return { before, after };
        }, mode);
        assert.equal(result.before.status, 'resolved'); assert.equal(result.after.status, 'unsupported'); checks++;
      }
      // Keep the helper's owning-document realm correct, including iframe CSS
      // matrix constructors and scroll geometry rather than global instanceof.
      const iframe = await page.evaluate(async () => {
        const frame = document.createElement('iframe'); document.body.append(frame);
        frame.contentDocument.body.innerHTML = '<div style="width:200px;height:80px;overflow:auto;padding:10px;border:2px solid"><div style="width:500px;height:300px"><span>Frame passage</span></div></div>';
        const space = frame.contentDocument.querySelector('div');
        space.scrollLeft = 13; space.scrollTop = 7;
        const range = frame.contentDocument.createRange(); range.selectNodeContents(space.querySelector('span'));
        const before = globalThis.measureRangeForTest(range, { coordinateSpace: space });
        space.style.cssText += ';translate:20px 10px;scale:2 3;transform:matrix(1.25,0,0,0.75,5,7)';
        const after = globalThis.measureRangeForTest(range, { coordinateSpace: space });
        space.style.rotate = '30deg';
        const rotated = globalThis.measureRangeForTest(range, { coordinateSpace: space });
        const scroll = { x: space.scrollLeft, y: space.scrollTop };
        frame.remove(); return { before, after, rotated, scroll };
      });
      assert.equal(iframe.before.status, 'resolved'); assert.equal(iframe.after.status, 'resolved');
      assert.deepEqual(iframe.scroll, { x: 13, y: 7 });
      for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(iframe.before.box[key] - iframe.after.box[key]) < 0.1);
      assert.equal(iframe.rotated.status, 'unsupported'); checks++;
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  console.log(`Range transforms verified: ${checks} real-browser cases, including positive 2D geometry, unsupported rotation/reflection, composed ancestors and iframe realms.`);
}
