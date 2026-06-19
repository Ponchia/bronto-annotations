import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const consumerDir = new URL('../.tmp/dogfood-clean-consumer/', import.meta.url).pathname;
const screenshotDir = new URL('../.tmp-dogfood/', import.meta.url).pathname;
const screenshotPath = join(screenshotDir, 'dogfood-report.png');
let tarball;

try {
  const { stdout } = await exec('npm', ['pack', '--json'], { cwd: root });
  const packResult = JSON.parse(stdout)[0];
  tarball = new URL(`../${packResult.filename}`, import.meta.url).pathname;

  await rm(consumerDir, { recursive: true, force: true });
  await rm(screenshotDir, { recursive: true, force: true });
  await mkdir(join(consumerDir, 'src'), { recursive: true });
  await mkdir(screenshotDir, { recursive: true });
  await writeConsumerFiles(consumerDir);
  await install(consumerDir, [
    tarball,
    'vega@^6.2.0',
    'vega-lite@^6.4.3',
    'mermaid@^11.15.0'
  ]);

  const evidence = await verifyDogfoodConsumer(consumerDir);
  console.log(`Dogfood clean consumer verified: ${evidence.annotationCount} annotations across ${evidence.surfaces.length} report surfaces. Screenshot: .tmp-dogfood/dogfood-report.png.`);
} finally {
  if (tarball) {
    await rm(tarball, { force: true });
  }
}

async function writeConsumerFiles(workdir) {
  await writeFile(join(workdir, 'package.json'), `${JSON.stringify({
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite --host 127.0.0.1'
    }
  }, null, 2)}\n`);
  await writeFile(join(workdir, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Annotation Dogfood Report</title>
  </head>
  <body>
    <main class="report-shell" aria-label="Dogfood report">
      <header class="report-header">
        <p class="eyebrow">Clean consumer dogfood</p>
        <h1>Annotation Readiness Report</h1>
        <p>DOM report regions, a Vega-Lite generated chart, and a Mermaid generated diagram annotated from public package imports.</p>
      </header>

      <section id="report-surface" class="surface report-surface" aria-label="Report summary regions">
        <div class="kpi-grid">
          <article class="kpi-card" data-region="adoption">
            <span class="label">Adoption</span>
            <strong>82%</strong>
            <p>Three teams have moved from static notes to generated anchors.</p>
          </article>
          <article class="kpi-card" data-region="risk">
            <span class="label">Open risk</span>
            <strong>Medium</strong>
            <p>Coordinate-space conventions need to stay explicit in consumer docs.</p>
          </article>
          <article class="kpi-card" data-region="release">
            <span class="label">Release state</span>
            <strong>Canary next</strong>
            <p>The API is usable enough for private package publishing trials.</p>
          </article>
        </div>
        <div id="report-annotations" class="annotation-layer" aria-label="Report annotations"></div>
      </section>

      <section id="chart-surface" class="surface generated-surface" aria-label="Vega-Lite chart surface">
        <div>
          <h2>Vega-Lite Generated Chart</h2>
          <p>The annotation anchor is extracted after Vega-Lite compiles and Vega renders the actual bar geometry.</p>
        </div>
        <div class="host-frame">
          <div id="chart-host" class="generated-host"></div>
          <div id="chart-annotations" class="annotation-layer" aria-label="Vega-Lite chart annotations"></div>
        </div>
      </section>

      <section id="diagram-surface" class="surface generated-surface" aria-label="Mermaid diagram surface">
        <div>
          <h2>Mermaid Generated Diagram</h2>
          <p>The annotations target rendered Mermaid node labels and rendered edge paths, not source text positions.</p>
        </div>
        <div class="host-frame">
          <div id="diagram-host" class="generated-host"></div>
          <div id="diagram-annotations" class="annotation-layer" aria-label="Mermaid diagram annotations"></div>
        </div>
      </section>
    </main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`);
  await writeFile(join(workdir, 'src/style.css'), `:root {
  color: #17202a;
  background: #eef3f6;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.report-shell {
  width: min(1120px, calc(100vw - 48px));
  margin: 0 auto;
  padding: 28px 0 42px;
}

.report-header {
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #7a4b12;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 8px;
  font-size: 34px;
  line-height: 1.08;
}

h2 {
  margin-bottom: 4px;
  font-size: 18px;
}

.surface {
  position: relative;
  margin-top: 18px;
  overflow: hidden;
  border: 1px solid #c4d0d6;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 22px rgb(45 61 76 / 10%);
}

.report-surface {
  min-height: 320px;
  padding: 22px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.kpi-card {
  min-height: 162px;
  padding: 18px;
  border: 1px solid #d8e1e7;
  border-radius: 8px;
  background: #f9fbfc;
}

.kpi-card strong {
  display: block;
  margin: 8px 0;
  color: #0d5963;
  font-size: 30px;
}

.label {
  color: #566873;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.generated-surface {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 12px;
  min-height: 430px;
  padding: 20px;
}

.host-frame {
  position: relative;
  min-height: 360px;
}

.generated-host,
.annotation-layer {
  position: absolute;
  inset: 0;
}

.generated-host svg,
.annotation-layer svg {
  display: block;
  width: 100%;
  height: 100%;
}

.annotation-layer {
  pointer-events: none;
}

.pa-annotation__note {
  filter: drop-shadow(0 5px 10px rgb(23 32 42 / 16%));
}
`);
  await writeFile(join(workdir, 'src/main.js'), `import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout
} from '@ponchia/annotations';
import {
  annotationFrameFromSvg,
  boxFromElement,
  boxFromSvgElement,
  prepareDomAnnotations
} from '@ponchia/annotations/dom';
import {
  obstaclesFromVegaSvg,
  prepareVegaScenegraphAnnotations
} from '@ponchia/annotations/vega';
import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';
import '@ponchia/annotations/bronto.css';
import * as vega from 'vega';
import { compile } from 'vega-lite';
import mermaid from 'mermaid';
import './style.css';

const evidence = {
  packageSource: 'packed tarball clean consumer',
  publicImports: [
    '@ponchia/annotations',
    '@ponchia/annotations/dom',
    '@ponchia/annotations/vega',
    '@ponchia/annotations/mermaid',
    '@ponchia/annotations/bronto.css'
  ],
  surfaces: [],
  friction: []
};

main().catch((error) => {
  window.__dogfood = {
    ready: false,
    error: error instanceof Error ? error.message : String(error),
    evidence
  };
  throw error;
});

async function main() {
  evidence.surfaces.push(renderDomReportAnnotations());
  evidence.surfaces.push(await renderVegaLiteAnnotations());
  evidence.surfaces.push(await renderMermaidAnnotations());
  evidence.annotationCount = document.querySelectorAll('.pa-annotation').length;
  evidence.connectorCount = document.querySelectorAll('.pa-annotation__connector').length;
  evidence.noteCount = document.querySelectorAll('.pa-annotation__note').length;
  evidence.ready = evidence.surfaces.every((surface) => surface.validationOk && surface.targetAlignmentOk && surface.qualityOk);
  window.__dogfood = evidence;
}

function renderDomReportAnnotations() {
  const surface = requiredElement('#report-surface');
  const layer = requiredElement('#report-annotations');
  const prepared = prepareDomAnnotations(surface, [
    {
      id: 'risk-region-note',
      selector: '[data-region="risk"]',
      coordinateSpace: surface,
      note: {
        title: 'DOM report anchor',
        body: 'Measured from the rendered report card.'
      },
      placement: { side: ['bottom', 'top'], offset: [18, 30], crossOffset: [0, -36, 36] },
      subject: { shape: 'rect', padding: 5 },
      connector: { end: 'arrow' },
      tone: 'warning',
      priority: 2
    },
    {
      id: 'release-card-note',
      selector: '[data-region="release"]',
      coordinateSpace: surface,
      note: {
        title: 'Manual editorial note',
        body: 'Manual placement stays in surface pixels.'
      },
      placement: { manual: { x: 842, y: 228, side: 'top' } },
      subject: { shape: 'rect', padding: 5 },
      tone: 'accent'
    }
  ], {
    obstacles: [
      { selector: '[data-region="adoption"]', coordinateSpace: surface, inflate: 4 },
      { selector: '[data-region="risk"]', coordinateSpace: surface, inflate: 4 },
      { selector: '[data-region="release"]', coordinateSpace: surface, inflate: 4 }
    ],
    assert: { label: 'Dogfood DOM anchors', failOnWarnings: true }
  });
  const rect = surface.getBoundingClientRect();
  const defaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'Dogfood DOM anchors',
    layoutLabel: 'Dogfood DOM annotations',
    includeInfo: true
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...defaults,
    bounds: { x: 0, y: 0, width: rect.width, height: rect.height },
    padding: 12,
    noteSizes: {
      'risk-region-note': { width: 188, height: 72 },
      'release-card-note': { width: 184, height: 72 }
    },
    targetAlignmentTargets: [
      targetFromElement(surface, 'risk-region-note', '[data-region="risk"]', 'rendered risk report card'),
      targetFromElement(surface, 'release-card-note', '[data-region="release"]', 'rendered release report card')
    ],
    targetAlignmentOptions: { tolerance: 1, minOverlapRatio: 0.98 },
    targetAlignmentFormat: { label: 'Dogfood DOM target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Dogfood DOM target alignment', failOnWarnings: true },
    assertQuality: { label: 'Dogfood DOM annotations', minScore: 45 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Dogfood DOM report annotations',
    markerIdPrefix: 'dogfood-dom',
    noteTabIndex: 0
  });

  return surfaceEvidence('dom-report', resolved, {
    anchorSource: 'dom',
    manualPlacement: true
  });
}

async function renderVegaLiteAnnotations() {
  const host = requiredElement('#chart-host');
  const layer = requiredElement('#chart-annotations');
  const vegaLiteSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    width: 420,
    height: 220,
    data: {
      values: [
        { id: 'baseline', phase: 'Baseline', value: 42 },
        { id: 'release', phase: 'Release', value: 76 },
        { id: 'stabilize', phase: 'Stabilize', value: 58 }
      ]
    },
    mark: {
      type: 'bar',
      tooltip: true,
      aria: true,
      description: { expr: "'bar-' + datum.id" }
    },
    encoding: {
      x: { field: 'phase', type: 'nominal', title: 'Phase' },
      y: { field: 'value', type: 'quantitative', title: 'Readiness score' },
      color: { field: 'phase', type: 'nominal', legend: null }
    }
  };
  const compiled = compile(vegaLiteSpec).spec;
  const view = new vega.View(vega.parse(compiled), { renderer: 'none' });

  await view.runAsync();
  host.innerHTML = await view.toSVG();

  const svg = requiredElement('#chart-host svg');
  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 38, right: 230, bottom: 44, left: 54 }
  });
  const prepared = prepareVegaScenegraphAnnotations(view, [{
    id: 'vega-release-note',
    markName: 'marks',
    markType: 'rect',
    datum: (datum) => datum?.id === 'release',
    note: {
      title: 'Vega-Lite bar',
      body: 'Anchor comes from the compiled Vega scenegraph.'
    },
    placement: { side: ['right', 'top'], offset: [20, 32], crossOffset: [0, -42, 42] },
    subject: { shape: 'rect', padding: 4 },
    connector: { type: 'curve', end: 'arrow' },
    tone: 'success',
    priority: 2,
    metadata: { consumer: 'dogfood-report' }
  }], {
    obstacles: { markName: 'marks', markType: 'rect', padding: 4 },
    assert: { label: 'Dogfood Vega-Lite anchors', failOnWarnings: true }
  });
  const renderedObstacles = obstaclesFromVegaSvg(svg, {
    selector: '[role="graphics-symbol"]',
    coordinateSpace: svg,
    padding: 3
  });
  svg.setAttribute('viewBox', frame.viewBox);
  svg.setAttribute('preserveAspectRatio', frame.preserveAspectRatio);
  const defaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'Dogfood Vega-Lite anchors',
    layoutLabel: 'Dogfood Vega-Lite annotations',
    includeInfo: true
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...defaults,
    bounds: frame.bounds,
    additionalObstacles: renderedObstacles,
    padding: 12,
    noteSizes: {
      'vega-release-note': { width: 210, height: 78 }
    },
    targetAlignmentTargets: [
      targetFromSvg(svg, 'vega-release-note', '[aria-label="bar-release"]', 'rendered Vega-Lite Release bar')
    ],
    targetAlignmentOptions: { tolerance: 10, minOverlapRatio: 0.9 },
    targetAlignmentFormat: { label: 'Dogfood Vega-Lite target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Dogfood Vega-Lite target alignment', failOnWarnings: true },
    assertQuality: { label: 'Dogfood Vega-Lite annotations', minScore: 40 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Dogfood Vega-Lite annotations',
    markerIdPrefix: 'dogfood-vega',
    noteTabIndex: 0,
    preserveAspectRatio: frame.preserveAspectRatio
  });

  return surfaceEvidence('vega-lite-chart', resolved, {
    anchorSource: 'vega-scenegraph',
    compiledFromVegaLite: true,
    renderedMarkSelector: '[aria-label="bar-release"]',
    renderedMarkCount: svg.querySelectorAll('[role="graphics-symbol"]').length
  });
}

async function renderMermaidAnnotations() {
  const host = requiredElement('#diagram-host');
  const layer = requiredElement('#diagram-annotations');
  const source = [
    'flowchart LR',
    '  Capture[Capture data] --> Review[Review report]',
    '  Review --> Publish[Publish report]'
  ].join('\\n');

  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
  const result = await mermaid.render('dogfood-mermaid-diagram', source);
  host.innerHTML = result.svg;

  const svg = requiredElement('#diagram-host svg');
  const edgePaths = Array.from(svg.querySelectorAll('path.flowchart-link, g.edgePath path'));
  edgePaths[0]?.setAttribute('data-edge-id', 'capture-review');
  edgePaths[1]?.setAttribute('data-edge-id', 'review-publish');
  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 70, right: 180, bottom: 70, left: 90 }
  });
  const prepared = prepareMermaidAnnotations(svg, [
    {
      id: 'mermaid-review-note',
      label: 'Review report',
      coordinateSpace: svg,
      note: {
        title: 'Mermaid node',
        body: 'Matched after Mermaid rendered SVG.'
      },
      placement: { side: ['top', 'bottom'], offset: [18, 30], crossOffset: [0, -38, 38] },
      subject: { shape: 'rect', padding: 5 },
      connector: { end: 'arrow' },
      tone: 'info',
      priority: 2
    },
    {
      id: 'mermaid-edge-note',
      selector: 'path[data-edge-id="review-publish"]',
      kind: 'path',
      coordinateSpace: svg,
      note: {
        title: 'Rendered edge',
        body: 'Selector targets the generated path.'
      },
      placement: { manual: { x: frame.bounds.x + 18, y: frame.bounds.y + 18, side: 'bottom' } },
      subject: { shape: 'path' },
      tone: 'accent'
    }
  ], {
    obstacles: { coordinateSpace: svg, padding: 4 },
    assert: { label: 'Dogfood Mermaid anchors', failOnWarnings: true }
  });
  svg.setAttribute('viewBox', frame.viewBox);
  svg.setAttribute('preserveAspectRatio', frame.preserveAspectRatio);
  const defaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'Dogfood Mermaid anchors',
    layoutLabel: 'Dogfood Mermaid annotations',
    includeInfo: true
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...defaults,
    bounds: frame.bounds,
    padding: 12,
    noteSizes: {
      'mermaid-review-note': { width: 176, height: 70 },
      'mermaid-edge-note': { width: 164, height: 66 }
    },
    targetAlignmentTargets: [
      targetFromText(svg, 'mermaid-review-note', 'g.node', 'Review report', 'rendered Mermaid Review node'),
      targetFromSvg(svg, 'mermaid-edge-note', 'path[data-edge-id="review-publish"]', 'rendered Mermaid Review to Publish edge')
    ],
    targetAlignmentOptions: { tolerance: 14, nearTolerance: 18 },
    targetAlignmentFormat: { label: 'Dogfood Mermaid target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Dogfood Mermaid target alignment', failOnWarnings: true },
    assertQuality: { label: 'Dogfood Mermaid annotations', minScore: 35 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Dogfood Mermaid annotations',
    markerIdPrefix: 'dogfood-mermaid',
    noteTabIndex: 0,
    preserveAspectRatio: frame.preserveAspectRatio
  });

  return surfaceEvidence('mermaid-flowchart', resolved, {
    anchorSource: 'mermaid-svg',
    renderedNodeCount: svg.querySelectorAll('g.node').length,
    renderedEdgeCount: svg.querySelectorAll('[data-edge-id]').length,
    manualPlacement: true
  });
}

function surfaceEvidence(id, resolved, extra) {
  return {
    id,
    validationOk: resolved.validation.ok,
    targetAlignmentOk: resolved.targetAlignment?.ok === true,
    qualityOk: resolved.quality.ok,
    score: resolved.quality.score,
    annotationIds: resolved.layout.annotations.map((annotation) => annotation.id),
    validationSummary: resolved.validationSummary,
    targetAlignmentSummary: resolved.targetAlignmentSummary,
    qualitySummary: resolved.qualitySummary,
    ...extra
  };
}

function targetFromElement(root, id, selector, expected) {
  const element = requiredElement(selector, root);

  return {
    id,
    expected,
    box: boxFromElement(element, { coordinateSpace: root })
  };
}

function targetFromSvg(svg, id, selector, expected) {
  const element = requiredElement(selector, svg);

  return {
    id,
    expected,
    box: boxFromSvgElement(element, svg)
  };
}

function targetFromText(svg, id, selector, text, expected) {
  const element = Array.from(svg.querySelectorAll(selector))
    .find((candidate) => normalizeText(candidate.textContent ?? '') === normalizeText(text));

  if (!element) {
    throw new Error(\`Expected rendered text target \${text}\`);
  }

  return {
    id,
    expected,
    box: boxFromSvgElement(element, svg)
  };
}

function normalizeText(value) {
  return value.replace(/\\s+/g, ' ').trim();
}

function requiredElement(selector, root = document) {
  const element = root.querySelector(selector);

  if (!element) {
    throw new Error(\`Missing required element \${selector}\`);
  }

  return element;
}
`);
}

async function verifyDogfoodConsumer(workdir) {
  const server = await createServer({
    root: workdir,
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 0
    }
  });
  const browser = await chromium.launch();
  const consoleErrors = [];

  try {
    await server.listen();

    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object', 'dogfood Vite server must expose an address');

    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__dogfood !== undefined, null, { timeout: 45_000 });

    const evidence = await page.evaluate(() => window.__dogfood);
    if (evidence?.ready !== true) {
      throw new Error(`Dogfood consumer did not become ready: ${JSON.stringify(evidence, null, 2)}\nConsole errors:\n${consoleErrors.join('\n')}`);
    }

    assert.equal(evidence.packageSource, 'packed tarball clean consumer');
    assert.deepEqual(evidence.publicImports, [
      '@ponchia/annotations',
      '@ponchia/annotations/dom',
      '@ponchia/annotations/vega',
      '@ponchia/annotations/mermaid',
      '@ponchia/annotations/bronto.css'
    ]);
    assert.equal(evidence.surfaces.length, 3, 'dogfood report should cover DOM, Vega-Lite, and Mermaid surfaces');
    assert.ok(evidence.annotationCount >= 5, 'dogfood report should render at least five annotations');
    assert.ok(evidence.connectorCount >= 5, 'dogfood report should render visible connectors');
    assert.ok(evidence.noteCount >= 5, 'dogfood report should render visible notes');

    for (const surface of evidence.surfaces) {
      assert.equal(surface.validationOk, true, `${surface.id} anchor validation should pass`);
      assert.equal(surface.targetAlignmentOk, true, `${surface.id} target alignment should pass`);
      assert.equal(surface.qualityOk, true, `${surface.id} layout quality should pass`);
    }

    assert.ok(evidence.surfaces.some((surface) => surface.compiledFromVegaLite), 'dogfood report should prove a Vega-Lite compiled chart');
    assert.ok(evidence.surfaces.some((surface) => surface.anchorSource === 'mermaid-svg' && surface.renderedEdgeCount >= 2), 'dogfood report should prove rendered Mermaid edge anchors');

    const visibleNotes = await page.locator('.pa-annotation__note').count();
    const visibleConnectors = await page.locator('.pa-annotation__connector').count();
    assert.ok(visibleNotes >= 5, 'dogfood browser should contain rendered note groups');
    assert.ok(visibleConnectors >= 5, 'dogfood browser should contain rendered connectors');
    assert.deepEqual(consoleErrors, [], 'dogfood browser should not emit console errors');

    await page.screenshot({ path: screenshotPath, fullPage: true });

    return evidence;
  } finally {
    await browser.close();
    await server.close();
  }
}

async function install(workdir, packages) {
  await exec('npm', [
    'install',
    '--silent',
    '--no-audit',
    '--no-fund',
    ...packages
  ], { cwd: workdir });
}
