import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const consumerDir = new URL('../.tmp/dogfood-bronto-report/', import.meta.url).pathname;
const screenshotDir = new URL('../.tmp-dogfood/', import.meta.url).pathname;
const screenshotPath = join(screenshotDir, 'dogfood-bronto-report.png');
let tarball;

try {
  const { stdout } = await exec('npm', ['pack', '--json'], { cwd: root });
  const packResult = JSON.parse(stdout)[0];
  tarball = new URL(`../${packResult.filename}`, import.meta.url).pathname;

  await rm(consumerDir, { recursive: true, force: true });
  await mkdir(join(consumerDir, 'src'), { recursive: true });
  await mkdir(screenshotDir, { recursive: true });
  await writeConsumerFiles(consumerDir);
  await install(consumerDir, [
    tarball,
    '@ponchia/ui@0.6.8',
    'vite@^6.3.5'
  ]);

  const evidence = await verifyConsumer(consumerDir);
  writeLine(`Bronto report dogfood verified: ${evidence.annotationCount} annotations on ${evidence.reportClassCount} report sections. Screenshot: .tmp-dogfood/dogfood-bronto-report.png.`);
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
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bronto Report Dogfood</title>
  </head>
  <body>
    <main id="report" class="ui-report ui-report--numbered" aria-label="Annotation dogfood report">
      <header class="ui-report__cover ui-report__cover--compact ui-keep">
        <p class="ui-eyebrow">Public report dogfood</p>
        <h1 class="ui-report__title">Annotation Integration Report</h1>
        <p class="ui-report__subtitle">
          A clean consumer combines @ponchia/ui report grammar with @ponchia/annotations overlays.
        </p>
        <ul class="ui-report__meta">
          <li>Clean Vite consumer</li>
          <li>Packed annotations tarball</li>
          <li>Public report CSS</li>
        </ul>
      </header>

      <section id="summary" class="ui-report__section annotated-report-section">
        <h2 class="ui-report__section-head">Summary</h2>
        <div class="ui-report__summary">
          <div class="ui-prose">
            <p>
              The host report owns prose, tables, data, and visual language. The annotation
              package owns anchors, placement, connectors, and SVG rendering.
            </p>
          </div>
        </div>
        <div class="ui-statgrid">
          <article class="ui-stat" data-report-region="api">
            <span class="ui-stat__label">API surface</span>
            <span class="ui-stat__value">8</span>
            <span class="ui-stat__delta is-pos">subpaths</span>
          </article>
          <article class="ui-stat" data-report-region="peers">
            <span class="ui-stat__label">Hard peers</span>
            <span class="ui-stat__value">0</span>
            <span class="ui-stat__delta">root import</span>
          </article>
          <article class="ui-stat" data-report-region="proof">
            <span class="ui-stat__label">Proof</span>
            <span class="ui-stat__value">CI</span>
            <span class="ui-stat__delta is-pos">browser checked</span>
          </article>
        </div>
        <div id="summary-annotations" class="dogfood-annotation-layer" aria-label="Summary annotations"></div>
      </section>

      <section id="evidence" class="ui-report__section">
        <h2 class="ui-report__section-head">Evidence</h2>
        <figure class="ui-report__figure ui-print-exact" role="group" aria-labelledby="import-chart-caption">
          <figcaption id="import-chart-caption" class="ui-report__caption">
            Fig 1 - Public import coverage
          </figcaption>
          <ul class="ui-legend" aria-label="Import series">
            <li class="ui-legend__item">
              <span class="ui-legend__swatch" style="--chart-color: var(--chart-1); --chart-pattern: var(--chart-pattern-1)" aria-hidden="true"></span>
              <span class="ui-legend__label">Report CSS</span>
            </li>
            <li class="ui-legend__item">
              <span class="ui-legend__swatch" style="--chart-color: var(--chart-2); --chart-pattern: var(--chart-pattern-2)" aria-hidden="true"></span>
              <span class="ui-legend__label">Annotations</span>
            </li>
          </ul>
          <div class="dogfood-chart-stage">
            <svg id="import-chart" viewBox="0 0 360 128" role="img" aria-label="Public import coverage chart">
              <title>Public import coverage</title>
              <desc>Report CSS and annotation package imports are loaded in the clean consumer.</desc>
              <line x1="104" y1="18" x2="104" y2="96" stroke="var(--line)" />
              <g font-size="11" text-anchor="end" fill="var(--text-soft)">
                <text x="98" y="42">Report CSS</text>
                <text x="98" y="82">Annotations</text>
              </g>
              <rect data-series="report-css" x="104" y="26" width="188" height="22" rx="2" fill="var(--chart-1)" />
              <rect data-series="annotations" x="104" y="66" width="228" height="22" rx="2" fill="var(--chart-2)" />
              <g font-size="11" fill="var(--text)">
                <text x="300" y="42">loaded</text>
                <text x="340" y="82">packed</text>
              </g>
            </svg>
            <div id="chart-annotations" class="dogfood-annotation-layer" aria-label="Chart annotations"></div>
          </div>
          <div class="ui-table-wrap">
            <table class="ui-table ui-table--dense">
              <caption>Clean consumer import table</caption>
              <thead>
                <tr>
                  <th>Import</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>@ponchia/ui/css/report.css</td>
                  <td>loaded</td>
                </tr>
                <tr data-import-row="annotations">
                  <td>@ponchia/annotations</td>
                  <td>packed tarball</td>
                </tr>
              </tbody>
            </table>
          </div>
        </figure>
      </section>
    </main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`);
  await writeFile(join(workdir, 'src/style.css'), `:root {
  background: #eef2f4;
}

body {
  margin: 0;
}

.ui-report {
  max-width: 1060px;
  margin-inline: auto;
}

.annotated-report-section,
.dogfood-chart-stage {
  position: relative;
}

.dogfood-chart-stage {
  min-height: 250px;
  margin-block: var(--space-md);
}

#import-chart,
.dogfood-annotation-layer {
  position: absolute;
  inset: 0;
}

#import-chart,
.dogfood-annotation-layer svg {
  display: block;
  width: 100%;
  height: 100%;
}

.dogfood-annotation-layer {
  pointer-events: none;
}

.pa-annotation__note {
  filter: drop-shadow(0 5px 12px rgb(12 20 28 / 16%));
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
import '@ponchia/annotations/bronto.css';
import '@ponchia/ui';
import '@ponchia/ui/css/report.css';
import '@ponchia/ui/css/dataviz.css';
import '@ponchia/ui/css/legend.css';
import './style.css';

const evidence = {
  consumerType: 'public @ponchia/ui static report grammar',
  packageSource: 'packed tarball clean consumer',
  publicImports: [
    '@ponchia/annotations',
    '@ponchia/annotations/dom',
    '@ponchia/annotations/bronto.css',
    '@ponchia/ui',
    '@ponchia/ui/css/report.css',
    '@ponchia/ui/css/dataviz.css',
    '@ponchia/ui/css/legend.css'
  ],
  surfaces: []
};

Promise.resolve().then(main).catch((error) => {
  window.__brontoReportDogfood = {
    ready: false,
    error: error instanceof Error ? error.message : String(error),
    evidence
  };
  throw error;
});

function main() {
  evidence.surfaces.push(renderSummaryAnnotations());
  evidence.surfaces.push(renderChartAnnotations());
  evidence.annotationCount = document.querySelectorAll('.pa-annotation').length;
  evidence.connectorCount = document.querySelectorAll('.pa-annotation__connector').length;
  evidence.noteCount = document.querySelectorAll('.pa-annotation__note').length;
  evidence.reportClassCount = document.querySelectorAll('.ui-report__section').length;
  evidence.uiReportLoaded = getComputedStyle(requiredElement('.ui-report')).display !== '';
  evidence.ready = evidence.uiReportLoaded
    && evidence.reportClassCount >= 2
    && evidence.surfaces.every((surface) => surface.validationOk && surface.targetAlignmentOk && surface.qualityOk);
  window.__brontoReportDogfood = evidence;
}

function renderSummaryAnnotations() {
  const surface = requiredElement('#summary');
  const layer = requiredElement('#summary-annotations');
  const prepared = prepareDomAnnotations(surface, [
    {
      id: 'peer-stat-note',
      selector: '[data-report-region="peers"]',
      coordinateSpace: surface,
      note: {
        title: 'Real report stat',
        body: 'Anchored to a rendered @ponchia/ui stat card.'
      },
      placement: { side: ['bottom', 'top'], offset: [20, 32], crossOffset: [0, -36, 36] },
      subject: { shape: 'rect', padding: 5 },
      connector: { end: 'arrow' },
      tone: 'success',
      priority: 2
    },
    {
      id: 'proof-stat-note',
      selector: '[data-report-region="proof"]',
      coordinateSpace: surface,
      note: {
        title: 'Manual report callout',
        body: 'Manual placement uses report-surface pixels.'
      },
      placement: { manual: { x: 776, y: 36, side: 'bottom' } },
      subject: { shape: 'rect', padding: 5 },
      tone: 'accent'
    }
  ], {
    obstacles: [
      { selector: '[data-report-region="api"]', coordinateSpace: surface, inflate: 4 },
      { selector: '[data-report-region="peers"]', coordinateSpace: surface, inflate: 4 },
      { selector: '[data-report-region="proof"]', coordinateSpace: surface, inflate: 4 }
    ],
    assert: { label: 'Bronto report DOM anchors', failOnWarnings: true }
  });
  const bounds = surfaceBounds(surface);
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...generatedSurfaceLayoutDefaults({
      anchorLabel: 'Bronto report DOM anchors',
      layoutLabel: 'Bronto report DOM annotations',
      includeInfo: true
    }),
    bounds,
    padding: 12,
    noteSizes: {
      'peer-stat-note': { width: 190, height: 72 },
      'proof-stat-note': { width: 188, height: 72 }
    },
    targetAlignmentTargets: [
      targetFromElement(surface, 'peer-stat-note', '[data-report-region="peers"]', 'rendered peer stat card'),
      targetFromElement(surface, 'proof-stat-note', '[data-report-region="proof"]', 'rendered proof stat card')
    ],
    targetAlignmentOptions: { tolerance: 1, minOverlapRatio: 0.98 },
    targetAlignmentFormat: { label: 'Bronto report DOM target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Bronto report DOM target alignment', failOnWarnings: true },
    assertQuality: { label: 'Bronto report DOM annotations', minScore: 40 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Bronto report DOM annotations',
    markerIdPrefix: 'bronto-report-dom',
    noteTabIndex: 0
  });

  return surfaceEvidence('report-dom', resolved, {
    anchorSource: 'dom',
    hostClasses: ['ui-report', 'ui-statgrid', 'ui-stat'],
    manualPlacement: true
  });
}

function renderChartAnnotations() {
  const section = requiredElement('#evidence');
  const svg = requiredElement('#import-chart');
  const layer = requiredElement('#chart-annotations');
  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 52, right: 186, bottom: 40, left: 36 }
  });
  const prepared = prepareDomAnnotations(section, [
    {
      id: 'annotations-bar-note',
      selector: '[data-series="annotations"]',
      coordinateSpace: svg,
      note: {
        title: 'Report chart bar',
        body: 'Anchored to a rendered SVG bar inside the report figure.'
      },
      placement: { side: ['right', 'top'], offset: [18, 30], crossOffset: [0, -34, 34] },
      subject: { shape: 'rect', padding: 4 },
      connector: { type: 'curve', end: 'arrow' },
      tone: 'info'
    },
    {
      id: 'import-row-note',
      selector: '[data-import-row="annotations"]',
      coordinateSpace: section,
      note: {
        title: 'Report table row',
        body: 'The same report mixes SVG and DOM anchors.'
      },
      placement: { manual: { x: 498, y: 348, side: 'top' } },
      subject: { shape: 'rect', padding: 4 },
      tone: 'warning'
    }
  ], {
    obstacles: [
      { selector: '[data-series="report-css"]', coordinateSpace: svg, inflate: 3 },
      { selector: '[data-series="annotations"]', coordinateSpace: svg, inflate: 3 }
    ],
    assert: { label: 'Bronto report chart anchors', failOnWarnings: true }
  });
  svg.setAttribute('viewBox', frame.viewBox);
  svg.setAttribute('preserveAspectRatio', frame.preserveAspectRatio);
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...generatedSurfaceLayoutDefaults({
      anchorLabel: 'Bronto report chart anchors',
      layoutLabel: 'Bronto report chart annotations',
      includeInfo: true
    }),
    bounds: frame.bounds,
    padding: 12,
    noteSizes: {
      'annotations-bar-note': { width: 208, height: 78 },
      'import-row-note': { width: 188, height: 72 }
    },
    targetAlignmentTargets: [
      targetFromSvg(svg, 'annotations-bar-note', '[data-series="annotations"]', 'rendered annotations import bar'),
      targetFromElement(section, 'import-row-note', '[data-import-row="annotations"]', 'rendered annotations import table row')
    ],
    targetAlignmentOptions: { tolerance: 6, minOverlapRatio: 0.9 },
    targetAlignmentFormat: { label: 'Bronto report chart target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Bronto report chart target alignment', failOnWarnings: true },
    assertQuality: { label: 'Bronto report chart annotations', minScore: 35 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Bronto report chart annotations',
    markerIdPrefix: 'bronto-report-chart',
    noteTabIndex: 0,
    preserveAspectRatio: frame.preserveAspectRatio
  });

  return surfaceEvidence('report-chart-and-table', resolved, {
    anchorSource: 'dom-svg',
    coordinateSpaces: ['section', 'svg'],
    hostClasses: ['ui-report__figure', 'ui-legend', 'ui-table'],
    mixedCoordinateSpaces: true,
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

function surfaceBounds(element) {
  const rect = element.getBoundingClientRect();

  return { x: 0, y: 0, width: rect.width, height: rect.height };
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

function requiredElement(selector, root = document) {
  const element = root.querySelector(selector);

  if (!element) {
    throw new Error('Missing required element ' + selector);
  }

  return element;
}
`);
}

async function verifyConsumer(workdir) {
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
    await page.waitForFunction(() => window.__brontoReportDogfood !== undefined, null, { timeout: 45_000 });

    const evidence = await page.evaluate(() => window.__brontoReportDogfood);
    if (evidence?.ready !== true) {
      throw new Error(`Bronto report dogfood did not become ready: ${JSON.stringify(evidence, null, 2)}\nConsole errors:\n${consoleErrors.join('\n')}`);
    }

    assert.equal(evidence.consumerType, 'public @ponchia/ui static report grammar');
    assert.equal(evidence.packageSource, 'packed tarball clean consumer');
    assert.deepEqual(evidence.publicImports, [
      '@ponchia/annotations',
      '@ponchia/annotations/dom',
      '@ponchia/annotations/bronto.css',
      '@ponchia/ui',
      '@ponchia/ui/css/report.css',
      '@ponchia/ui/css/dataviz.css',
      '@ponchia/ui/css/legend.css'
    ]);
    assert.equal(evidence.surfaces.length, 2, 'real report dogfood should cover DOM and SVG report surfaces');
    assert.ok(evidence.reportClassCount >= 2, 'real report dogfood should render @ponchia/ui report sections');
    assert.ok(evidence.annotationCount >= 4, 'real report dogfood should render at least four annotations');
    assert.ok(evidence.connectorCount >= 4, 'real report dogfood should render visible connectors');
    assert.ok(evidence.noteCount >= 4, 'real report dogfood should render visible notes');

    for (const surface of evidence.surfaces) {
      assert.equal(surface.validationOk, true, `${surface.id} anchor validation should pass`);
      assert.equal(surface.targetAlignmentOk, true, `${surface.id} target alignment should pass`);
      assert.equal(surface.qualityOk, true, `${surface.id} layout quality should pass`);
    }

    assert.ok(evidence.surfaces.some((surface) => surface.hostClasses?.includes('ui-statgrid')), 'dogfood should prove report stat-grid anchors');
    assert.ok(evidence.surfaces.some((surface) => surface.hostClasses?.includes('ui-table')), 'dogfood should prove report table anchors');
    assert.ok(evidence.surfaces.some((surface) => surface.anchorSource === 'dom-svg' && surface.mixedCoordinateSpaces === true && surface.coordinateSpaces?.includes('section') && surface.coordinateSpaces?.includes('svg')), 'dogfood should prove mixed DOM/SVG coordinate spaces');
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
