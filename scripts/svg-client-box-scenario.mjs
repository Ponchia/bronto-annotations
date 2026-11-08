import assert from 'node:assert/strict';

/** Native SVG matrices and an independently computed DOMQuad enclosure. */
export async function verifySvgClientBoxes(browser, baseUrl, modulePath = '/dist/dom/index.js') {
  let checks = 0;
  for (const width of [360, 1200]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      // The repository need not serve an index document at '/'. Fulfill only
      // this isolated HTML fixture; modules and SVG geometry remain native.
      const fixtureUrl = new URL('/__annotation-svg-box-fixture__', baseUrl).href;
      await page.route(fixtureUrl, route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><html><body></body></html>'
      }));
      const response = await page.goto(fixtureUrl);
      assert.equal(response?.status(), 200, 'SVG fixture document must load');
      await page.setContent('<style>body{margin:0}svg{position:absolute;left:200px;top:200px;transform-origin:0 0}</style><svg width="200" height="150" viewBox="-20 10 100 75"></svg>');
      const results = await page.evaluate(async url => {
        const { clientBoxToSvgBox, svgPointFromClient } = await import(url);
        const svg = document.querySelector('svg');
        const boxes = [
          { x: 200, y: 200, width: 100, height: 100 },
          { x: -12.25, y: 4.75, width: 0.125, height: 27.5 },
          { x: 33, y: 42, width: -20, height: 15 },
          { x: 33, y: 42, width: -20, height: -15 },
          { x: 33, y: 42, width: 0, height: 15 },
          { x: 33, y: 42, width: 20, height: 0 },
          { x: 33, y: 42, width: 0, height: 0 }
        ];
        const outcomes = [];
        for (const transform of ['none', 'translate(17px,-11px) scale(2,.75)', 'rotate(45deg)',
          'rotate(-35deg)', 'skewX(30deg)', 'skewY(-25deg)', 'scale(-1,1)',
          'rotate(25deg) scale(-1.5,.75)', 'matrix(1,.4,-.3,1.2,13,-7)']) {
          svg.style.transform = transform;
          const inverse = svg.getScreenCTM().inverse();
          for (const box of boxes) {
            const corners = [[box.x, box.y], [box.x + box.width, box.y],
              [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]]
              .map(([x,y]) => new DOMPoint(x,y).matrixTransform(inverse));
            const bounds = new DOMQuad(...corners).getBounds();
            const expected = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
            const actual = clientBoxToSvgBox(svg, box);
            // SVGPoint can round coordinates to single precision. Require the
            // entire quad within a small absolute tolerance in these fixtures.
            const tolerance = 0.0001;
            const close = Object.keys(expected).every(key => Math.abs(actual[key] - expected[key]) <= tolerance);
            const contains = corners.every(p => p.x >= actual.x - tolerance && p.y >= actual.y - tolerance
              && p.x <= actual.x + actual.width + tolerance && p.y <= actual.y + actual.height + tolerance);
            outcomes.push({ transform, box, actual, expected, passed: close && contains });
          }
        }
        svg.style.transform = 'scale(0,1)';
        // Compare with the actual SVG API, not an assumption that every browser
        // reports a singular CSS transform as a singular matrix. Some hosts
        // report an invertible placeholder for non-rendered/collapsed surfaces.
        const screen = svg.getScreenCTM();
        let nativeBox, nativeError;
        try {
          if (screen) {
            const inverse = screen.inverse();
            const nativePoints = [[200,200],[300,200],[300,300],[200,300]].map(([x,y]) => {
              const point = svg.createSVGPoint(); point.x=x; point.y=y;
              return point.matrixTransform(inverse);
            });
            const b = new DOMQuad(...nativePoints).getBounds();
            nativeBox = {x:b.x,y:b.y,width:b.width,height:b.height};
          } else {
            // A zero-width viewport has no usable fallback; retained client
            // coordinates are the existing documented missing-mapping policy.
            nativeBox = boxes[0];
          }
        } catch (error) { nativeError = error.name; }
        let actualBox, actualError;
        try { actualBox = clientBoxToSvgBox(svg, boxes[0]); }
        catch (error) { actualError = error.name; }
        const singular = {
          hostReportsInvertibleMatrix: Boolean(screen && screen.a * screen.d - screen.b * screen.c),
          nativeError: nativeError ?? null,
          passed: nativeError ? actualError === nativeError : !actualError &&
            Object.keys(nativeBox).every(key => Object.is(actualBox[key], nativeBox[key])
              || Math.abs(actualBox[key] - nativeBox[key]) < 0.0001)
        };
        // Keep the public single-point API aligned with the box conversion.
        svg.style.transform = 'rotate(45deg)';
        const expectedPoint = new DOMPoint(220, 230).matrixTransform(svg.getScreenCTM().inverse());
        const point = svgPointFromClient(svg, { x: 220, y: 230 });
        outcomes.push({ name: 'single-point compatibility', passed:
          Math.abs(point.x - expectedPoint.x) < 0.0001 && Math.abs(point.y - expectedPoint.y) < 0.0001 });
        outcomes.push({ name: 'native collapsed-surface mapping and failure policy', ...singular });
        return outcomes;
      }, new URL(modulePath, baseUrl).href);
      for (const result of results) assert(result.passed, JSON.stringify({ width, ...result }));
      checks += results.length;
      assert.deepEqual(errors, [], 'SVG client conversion page errors');
    } finally { await context.close(); }
  }
  console.log(`SVG client boxes verified: ${checks} native affine-enclosure and failure-boundary cases.`);
  return checks;
}
