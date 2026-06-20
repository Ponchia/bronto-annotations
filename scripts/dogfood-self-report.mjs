import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const consumerDir = new URL('../.tmp/dogfood-self-report/', import.meta.url).pathname;
const screenshotDir = new URL('../.tmp-dogfood/', import.meta.url).pathname;
const screenshotPath = join(screenshotDir, 'dogfood-self-report.png');
const projectEvidence = await readProjectEvidence();
let tarball;

try {
  const { stdout } = await exec('npm', ['pack', '--json'], { cwd: root });
  const packResult = JSON.parse(stdout)[0];
  tarball = new URL(`../${packResult.filename}`, import.meta.url).pathname;

  await rm(consumerDir, { recursive: true, force: true });
  await mkdir(join(consumerDir, 'src'), { recursive: true });
  await mkdir(screenshotDir, { recursive: true });
  await writeConsumerFiles(consumerDir, projectEvidence);
  await install(consumerDir, [tarball]);

  const evidence = await verifyConsumer(consumerDir, projectEvidence);
  writeLine(`Self dogfood report verified: ${evidence.annotationCount} annotations from ${evidence.dataSources.length} project evidence files. Screenshot: .tmp-dogfood/dogfood-self-report.png.`);
} finally {
  if (tarball) {
    await rm(tarball, { force: true });
  }
}

async function readProjectEvidence() {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const readiness = JSON.parse(await readFile(new URL('../docs/readiness-matrix.json', import.meta.url), 'utf8'));
  const audit = JSON.parse(await readFile(new URL('../docs/completion-audit.json', import.meta.url), 'utf8'));
  const provenRequirements = audit.requirements.filter((requirement) => requirement.status === 'proven');

  return {
    packageName: pkg.name,
    packageVersion: pkg.version,
    readinessStatus: readiness.status,
    auditStatus: audit.status,
    dataSources: [
      'docs/readiness-matrix.json',
      'docs/completion-audit.json',
      'package.json'
    ],
    counts: {
      publicExports: readiness.publicExports.length,
      contexts: readiness.contexts.length,
      capabilities: readiness.capabilities.length,
      requiredScripts: readiness.requiredScripts.length,
      requirements: audit.requirements.length,
      provenRequirements: provenRequirements.length
    },
    exports: readiness.publicExports.map((entry) => ({
      subpath: entry.subpath,
      declaration: entry.declaration,
      termCount: entry.terms.length
    })),
    capabilities: readiness.capabilities.slice(-7).map((capability) => ({
      id: capability.id,
      evidenceCount: capability.evidence.length
    })),
    requirements: audit.requirements.slice(-8).map((requirement) => ({
      id: requirement.id,
      status: requirement.status,
      evidenceCount: requirement.evidence.length
    }))
  };
}

async function writeConsumerFiles(workdir, data) {
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
    <title>Self Dogfood Evidence Report</title>
  </head>
  <body>
    <main class="report-shell" aria-label="Self dogfood evidence report">
      <header class="report-header">
        <p class="eyebrow">Self dogfood</p>
        <h1>Release Evidence Report</h1>
        <p>
          A clean consumer installs the packed annotations package and renders
          a report from the package's own readiness and completion evidence.
        </p>
      </header>

      <section id="summary-surface" class="surface summary-surface" aria-label="Project evidence summary">
        <div>
          <p class="eyebrow">Current package</p>
          <h2 id="package-title"></h2>
          <p id="package-status" class="summary-copy"></p>
        </div>
        <div id="metric-grid" class="metric-grid" aria-label="Evidence metrics"></div>
        <div class="table-wrap">
          <table class="evidence-table">
            <caption>Recent proven requirements from the completion audit</caption>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Status</th>
                <th>Evidence entries</th>
              </tr>
            </thead>
            <tbody id="requirements-table"></tbody>
          </table>
        </div>
        <div id="summary-annotations" class="annotation-layer" aria-label="Summary annotations"></div>
      </section>

      <section id="chart-surface" class="surface generated-surface" aria-label="Readiness chart surface">
        <div class="surface-intro">
          <p class="eyebrow">Generated chart</p>
          <h2>Readiness Matrix Counts</h2>
          <p>The chart bars are generated from the current readiness matrix JSON.</p>
        </div>
        <div class="host-frame">
          <svg id="readiness-chart" role="img" aria-labelledby="readiness-chart-title readiness-chart-desc"></svg>
          <div id="chart-annotations" class="annotation-layer" aria-label="Readiness chart annotations"></div>
        </div>
      </section>

      <section id="flow-surface" class="surface generated-surface" aria-label="Release flow diagram surface">
        <div class="surface-intro">
          <p class="eyebrow">Generated diagram</p>
          <h2>Evidence-To-Release Flow</h2>
          <p>The diagram is built from current capability and requirement state.</p>
        </div>
        <div class="host-frame">
          <svg id="release-flow" role="img" aria-labelledby="release-flow-title release-flow-desc"></svg>
          <div id="flow-annotations" class="annotation-layer" aria-label="Release flow annotations"></div>
        </div>
      </section>
    </main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`);
  await writeFile(join(workdir, 'src/project-evidence.js'), `export const projectEvidence = ${JSON.stringify(data, null, 2)};\n`);
  await writeFile(join(workdir, 'src/style.css'), `:root {
  color: #17202a;
  background: #edf2f4;
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
  padding: 30px 0 44px;
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
  font-size: 20px;
}

.summary-copy {
  max-width: 760px;
  color: #52636f;
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

.summary-surface {
  min-height: 530px;
  padding: 22px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.metric-card {
  min-height: 122px;
  padding: 16px;
  border: 1px solid #d8e1e7;
  border-radius: 8px;
  background: #f9fbfc;
}

.metric-card strong {
  display: block;
  margin: 7px 0 4px;
  color: #0d5963;
  font-size: 30px;
  line-height: 1;
}

.metric-label {
  color: #52636f;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.metric-detail {
  color: #52636f;
  font-size: 13px;
  line-height: 1.35;
}

.table-wrap {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid #d8e1e7;
  border-radius: 8px;
}

.evidence-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.evidence-table caption {
  padding: 10px 12px;
  color: #52636f;
  font-weight: 700;
  text-align: left;
}

.evidence-table th,
.evidence-table td {
  padding: 9px 12px;
  border-top: 1px solid #e2e9ee;
  text-align: left;
}

.evidence-table th {
  color: #52636f;
  font-size: 12px;
  text-transform: uppercase;
}

.generated-surface {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 18px;
  min-height: 410px;
  padding: 20px;
}

.surface-intro p:last-child {
  color: #52636f;
}

.host-frame {
  position: relative;
  min-height: 350px;
}

#readiness-chart,
#release-flow,
.annotation-layer {
  position: absolute;
  inset: 0;
}

#readiness-chart,
#release-flow,
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
import '@ponchia/annotations/bronto.css';
import { projectEvidence } from './project-evidence.js';
import './style.css';

const evidence = {
  consumerType: 'self-dogfood project evidence report',
  packageSource: 'packed tarball clean consumer',
  publicImports: [
    '@ponchia/annotations',
    '@ponchia/annotations/dom',
    '@ponchia/annotations/bronto.css'
  ],
  dataSources: projectEvidence.dataSources,
  counts: projectEvidence.counts,
  surfaces: []
};

Promise.resolve().then(main).catch((error) => {
  window.__selfDogfood = {
    ready: false,
    error: error instanceof Error ? error.message : String(error),
    evidence
  };
  throw error;
});

function main() {
  renderSummaryHost();
  renderChartHost();
  renderFlowHost();
  evidence.surfaces.push(renderSummaryAnnotations());
  evidence.surfaces.push(renderChartAnnotations());
  evidence.surfaces.push(renderFlowAnnotations());
  evidence.annotationCount = document.querySelectorAll('.pa-annotation').length;
  evidence.connectorCount = document.querySelectorAll('.pa-annotation__connector').length;
  evidence.noteCount = document.querySelectorAll('.pa-annotation__note').length;
  evidence.ready = evidence.surfaces.every((surface) => surface.validationOk && surface.targetAlignmentOk && surface.qualityOk)
    && evidence.annotationCount >= 6
    && evidence.connectorCount >= 6
    && evidence.noteCount >= 6
    && evidence.counts.provenRequirements === evidence.counts.requirements;
  window.__selfDogfood = evidence;
}

function renderSummaryHost() {
  requiredElement('#package-title').textContent = projectEvidence.packageName + ' ' + projectEvidence.packageVersion;
  requiredElement('#package-status').textContent = 'Readiness status: ' + projectEvidence.readinessStatus + '. Completion audit status: ' + projectEvidence.auditStatus + '.';
  const metrics = [
    ['publicExports', 'Public exports', 'package subpaths with declarations'],
    ['contexts', 'Examples', 'browser-verified host contexts'],
    ['capabilities', 'Capabilities', 'readiness capability groups'],
    ['requiredScripts', 'Check scripts', 'scripts wired through npm run check'],
    ['requirements', 'Requirements', 'completion audit groups'],
    ['provenRequirements', 'Proven', 'requirements with direct evidence']
  ];
  const grid = requiredElement('#metric-grid');
  grid.innerHTML = metrics.map(([key, label, detail]) => '<article class="metric-card" data-metric-card="' + key + '"><span class="metric-label">' + label + '</span><strong>' + projectEvidence.counts[key] + '</strong><span class="metric-detail">' + detail + '</span></article>').join('');

  const tbody = requiredElement('#requirements-table');
  tbody.innerHTML = projectEvidence.requirements.map((requirement) => '<tr data-requirement-id="' + requirement.id + '"><td>' + formatId(requirement.id) + '</td><td>' + requirement.status + '</td><td>' + requirement.evidenceCount + '</td></tr>').join('');
}

function renderChartHost() {
  const svg = requiredElement('#readiness-chart');
  const metrics = [
    ['publicExports', 'Exports', '#1d6f7a'],
    ['contexts', 'Contexts', '#8a5a12'],
    ['capabilities', 'Capabilities', '#4c6f2d'],
    ['requiredScripts', 'Scripts', '#734f96'],
    ['requirements', 'Requirements', '#0d5963']
  ];
  const values = metrics.map(([key, label, color]) => ({
    key,
    label,
    color,
    value: projectEvidence.counts[key]
  }));
  const max = Math.max(...values.map((item) => item.value), 1);
  const chart = { width: 620, height: 260, left: 165, right: 28, top: 38, gap: 28, barHeight: 24 };
  const scale = (chart.width - chart.left - chart.right) / max;
  const rows = values.map((item, index) => {
    const y = chart.top + index * (chart.barHeight + chart.gap);
    const width = Math.max(12, item.value * scale);
    return '<g data-metric-row="' + item.key + '">'
      + '<text x="' + (chart.left - 12) + '" y="' + (y + 17) + '" text-anchor="end" font-size="12" fill="#52636f">' + item.label + '</text>'
      + '<rect data-metric-bar="' + item.key + '" x="' + chart.left + '" y="' + y + '" width="' + width.toFixed(2) + '" height="' + chart.barHeight + '" rx="3" fill="' + item.color + '"></rect>'
      + '<text x="' + (chart.left + width + 8).toFixed(2) + '" y="' + (y + 17) + '" font-size="12" fill="#17202a">' + item.value + '</text>'
      + '</g>';
  }).join('');

  svg.setAttribute('viewBox', '0 0 ' + chart.width + ' ' + chart.height);
  svg.innerHTML = '<title id="readiness-chart-title">Readiness matrix counts</title>'
    + '<desc id="readiness-chart-desc">Bars generated from current readiness matrix counts.</desc>'
    + '<line x1="' + chart.left + '" y1="22" x2="' + chart.left + '" y2="230" stroke="#c4d0d6"></line>'
    + rows;
}

function renderFlowHost() {
  const svg = requiredElement('#release-flow');
  const nodes = [
    { id: 'evidence', label: 'Evidence files', x: 28, y: 96 },
    { id: 'adapters', label: 'Adapters', x: 190, y: 50 },
    { id: 'checks', label: 'Check suite', x: 350, y: 96 },
    { id: 'release', label: 'Release lane', x: 512, y: 50 },
    { id: 'limits', label: 'Known limits', x: 512, y: 150 }
  ];
  const edges = [
    ['evidence', 'adapters', 'M112,112 C145,112 150,66 190,66', 'evidence-adapters'],
    ['adapters', 'checks', 'M274,66 C308,66 312,112 350,112', 'adapters-checks'],
    ['checks', 'release', 'M434,112 C468,112 472,66 512,66', 'checks-release'],
    ['checks', 'limits', 'M434,128 C468,128 472,166 512,166', 'checks-limits']
  ];
  const edgeMarkup = edges.map(([, , d, id]) => '<path data-flow-edge="' + id + '" d="' + d + '" fill="none" stroke="#80919b" stroke-width="3" marker-end="url(#flow-arrow)"></path>').join('');
  const nodeMarkup = nodes.map((node) => '<g data-flow-node="' + node.id + '" transform="translate(' + node.x + ' ' + node.y + ')">'
    + '<rect width="114" height="48" rx="7" fill="#f9fbfc" stroke="#c4d0d6"></rect>'
    + '<text x="57" y="28" text-anchor="middle" font-size="12" font-weight="700" fill="#17202a">' + node.label + '</text>'
    + '</g>').join('');

  svg.setAttribute('viewBox', '0 0 670 260');
  svg.innerHTML = '<title id="release-flow-title">Evidence to release flow</title>'
    + '<desc id="release-flow-desc">Generated diagram showing evidence files, adapters, checks, release lane, and known limits.</desc>'
    + '<defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#80919b"></path></marker></defs>'
    + edgeMarkup
    + nodeMarkup;
}

function renderSummaryAnnotations() {
  const surface = requiredElement('#summary-surface');
  const layer = requiredElement('#summary-annotations');
  const prepared = prepareDomAnnotations(surface, [
    {
      id: 'exports-card-note',
      selector: '[data-metric-card="publicExports"]',
      coordinateSpace: surface,
      note: {
        title: 'Package subpaths',
        body: 'Anchored to counts from the readiness matrix.'
      },
      placement: { side: ['bottom', 'top'], offset: [18, 30], crossOffset: [0, -42, 42] },
      subject: { shape: 'rect', padding: 5 },
      connector: { end: 'arrow' },
      tone: 'info',
      priority: 2
    },
    {
      id: 'pre-release-row-note',
      selector: '[data-requirement-id="pre-release-hardening"]',
      coordinateSpace: surface,
      note: {
        title: 'Real audit row',
        body: 'The row is rendered from completion-audit.json.'
      },
      placement: { manual: { x: 802, y: 406, side: 'left' } },
      subject: { shape: 'rect', padding: 4 },
      connector: { type: 'elbow', end: 'arrow' },
      tone: 'warning'
    }
  ], {
    obstacles: [
      { selector: '[data-metric-card="publicExports"]', coordinateSpace: surface, inflate: 4 },
      { selector: '[data-metric-card="requirements"]', coordinateSpace: surface, inflate: 4 },
      { selector: '[data-requirement-id="pre-release-hardening"]', coordinateSpace: surface, inflate: 3 }
    ],
    assert: { label: 'Self dogfood summary anchors', failOnWarnings: true }
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...generatedSurfaceLayoutDefaults({
      anchorLabel: 'Self dogfood summary anchors',
      layoutLabel: 'Self dogfood summary annotations',
      includeInfo: true
    }),
    bounds: surfaceBounds(surface),
    padding: 12,
    noteSizes: {
      'exports-card-note': { width: 194, height: 72 },
      'pre-release-row-note': { width: 188, height: 72 }
    },
    targetAlignmentTargets: [
      targetFromElement(surface, 'exports-card-note', '[data-metric-card="publicExports"]', 'public exports metric card'),
      targetFromElement(surface, 'pre-release-row-note', '[data-requirement-id="pre-release-hardening"]', 'pre-release audit table row')
    ],
    targetAlignmentOptions: { tolerance: 1, minOverlapRatio: 0.96 },
    targetAlignmentFormat: { label: 'Self dogfood summary target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Self dogfood summary target alignment', failOnWarnings: true },
    assertQuality: { label: 'Self dogfood summary annotations', minScore: 35 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Self dogfood summary annotations',
    markerIdPrefix: 'self-summary',
    noteTabIndex: 0
  });

  return surfaceEvidence('project-summary', resolved, {
    anchorSource: 'real-project-dom',
    dataSource: 'docs/completion-audit.json',
    manualPlacement: true
  });
}

function renderChartAnnotations() {
  const surface = requiredElement('#chart-surface');
  const svg = requiredElement('#readiness-chart');
  const layer = requiredElement('#chart-annotations');
  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 46, right: 230, bottom: 38, left: 26 }
  });
  const prepared = prepareDomAnnotations(surface, [
    {
      id: 'requirements-bar-note',
      selector: '[data-metric-bar="requirements"]',
      coordinateSpace: svg,
      note: {
        title: 'Audit requirement count',
        body: 'Generated from completion-audit.json.'
      },
      placement: { side: ['right', 'top'], offset: [20, 32], crossOffset: [0, -42, 42] },
      subject: { shape: 'rect', padding: 4 },
      connector: { type: 'curve', end: 'arrow' },
      tone: 'success',
      priority: 2
    },
    {
      id: 'scripts-bar-note',
      selector: '[data-metric-bar="requiredScripts"]',
      coordinateSpace: svg,
      note: {
        title: 'Check coverage',
        body: 'Every required script is part of npm run check.'
      },
      placement: { side: ['right', 'bottom'], offset: [20, 32], crossOffset: [0, -42, 42] },
      subject: { shape: 'rect', padding: 4 },
      connector: { type: 'curve', end: 'arrow' },
      tone: 'accent'
    }
  ], {
    obstacles: [{ selector: '[data-metric-bar]', coordinateSpace: svg, inflate: 3 }],
    assert: { label: 'Self dogfood chart anchors', failOnWarnings: true }
  });
  svg.setAttribute('viewBox', frame.viewBox);
  svg.setAttribute('preserveAspectRatio', frame.preserveAspectRatio);
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...generatedSurfaceLayoutDefaults({
      anchorLabel: 'Self dogfood chart anchors',
      layoutLabel: 'Self dogfood chart annotations',
      includeInfo: true
    }),
    bounds: frame.bounds,
    padding: 12,
    noteSizes: {
      'requirements-bar-note': { width: 194, height: 72 },
      'scripts-bar-note': { width: 190, height: 72 }
    },
    targetAlignmentTargets: [
      targetFromSvg(svg, 'requirements-bar-note', '[data-metric-bar="requirements"]', 'requirements bar from audit data'),
      targetFromSvg(svg, 'scripts-bar-note', '[data-metric-bar="requiredScripts"]', 'required scripts bar from readiness data')
    ],
    targetAlignmentOptions: { tolerance: 6, minOverlapRatio: 0.9 },
    targetAlignmentFormat: { label: 'Self dogfood chart target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Self dogfood chart target alignment', failOnWarnings: true },
    assertQuality: { label: 'Self dogfood chart annotations', minScore: 35 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Self dogfood chart annotations',
    markerIdPrefix: 'self-chart',
    noteTabIndex: 0,
    preserveAspectRatio: frame.preserveAspectRatio
  });

  return surfaceEvidence('readiness-chart', resolved, {
    anchorSource: 'generated-svg-chart',
    dataSource: 'docs/readiness-matrix.json',
    renderedBarCount: svg.querySelectorAll('[data-metric-bar]').length
  });
}

function renderFlowAnnotations() {
  const surface = requiredElement('#flow-surface');
  const svg = requiredElement('#release-flow');
  const layer = requiredElement('#flow-annotations');
  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 50, right: 190, bottom: 50, left: 38 }
  });
  const prepared = prepareDomAnnotations(surface, [
    {
      id: 'release-node-note',
      selector: '[data-flow-node="release"]',
      coordinateSpace: svg,
      note: {
        title: 'Release lane',
        body: 'Driven by checked release decisions.'
      },
      placement: { side: ['top', 'right'], offset: [18, 30], crossOffset: [0, -38, 38] },
      subject: { shape: 'rect', padding: 5 },
      connector: { end: 'arrow' },
      tone: 'info',
      priority: 2
    },
    {
      id: 'check-edge-note',
      selector: '[data-flow-edge="checks-release"]',
      kind: 'path',
      coordinateSpace: svg,
      note: {
        title: 'Checked transition',
        body: 'The generated path links checks to release.'
      },
      placement: { manual: { x: 382, y: 194, side: 'top' } },
      subject: { shape: 'path' },
      connector: { type: 'elbow', end: 'arrow' },
      tone: 'accent'
    }
  ], {
    obstacles: [{ selector: '[data-flow-node]', coordinateSpace: svg, inflate: 5 }],
    assert: { label: 'Self dogfood flow anchors', failOnWarnings: true }
  });
  svg.setAttribute('viewBox', frame.viewBox);
  svg.setAttribute('preserveAspectRatio', frame.preserveAspectRatio);
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...generatedSurfaceLayoutDefaults({
      anchorLabel: 'Self dogfood flow anchors',
      layoutLabel: 'Self dogfood flow annotations',
      includeInfo: true
    }),
    bounds: frame.bounds,
    padding: 12,
    noteSizes: {
      'release-node-note': { width: 178, height: 70 },
      'check-edge-note': { width: 182, height: 70 }
    },
    targetAlignmentTargets: [
      targetFromSvg(svg, 'release-node-note', '[data-flow-node="release"]', 'release lane diagram node'),
      targetFromSvg(svg, 'check-edge-note', '[data-flow-edge="checks-release"]', 'checks to release diagram edge')
    ],
    targetAlignmentOptions: { tolerance: 12, nearTolerance: 18 },
    targetAlignmentFormat: { label: 'Self dogfood flow target alignment', includeAligned: true },
    assertTargetAlignment: { label: 'Self dogfood flow target alignment', failOnWarnings: true },
    assertQuality: { label: 'Self dogfood flow annotations', minScore: 35 }
  });

  layer.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Self dogfood flow annotations',
    markerIdPrefix: 'self-flow',
    noteTabIndex: 0,
    preserveAspectRatio: frame.preserveAspectRatio
  });

  return surfaceEvidence('release-flow-diagram', resolved, {
    anchorSource: 'generated-svg-diagram',
    dataSource: 'docs/readiness-matrix.json',
    renderedNodeCount: svg.querySelectorAll('[data-flow-node]').length,
    renderedEdgeCount: svg.querySelectorAll('[data-flow-edge]').length,
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

function formatId(value) {
  return value.replaceAll('-', ' ');
}
`);
}

async function verifyConsumer(workdir, expected) {
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
    assert.ok(address && typeof address === 'object', 'self dogfood Vite server must expose an address');

    const page = await browser.newPage({ viewport: { width: 1280, height: 1180 } });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__selfDogfood !== undefined, null, { timeout: 45_000 });

    const evidence = await page.evaluate(() => window.__selfDogfood);
    if (evidence?.ready !== true) {
      throw new Error(`Self dogfood report did not become ready: ${JSON.stringify(evidence, null, 2)}\nConsole errors:\n${consoleErrors.join('\n')}`);
    }

    assert.equal(evidence.consumerType, 'self-dogfood project evidence report');
    assert.equal(evidence.packageSource, 'packed tarball clean consumer');
    assert.deepEqual(evidence.publicImports, [
      '@ponchia/annotations',
      '@ponchia/annotations/dom',
      '@ponchia/annotations/bronto.css'
    ]);
    assert.deepEqual(evidence.dataSources, expected.dataSources);
    assert.deepEqual(evidence.counts, expected.counts, 'self dogfood report must use current repo evidence counts');
    assert.equal(evidence.surfaces.length, 3, 'self dogfood should cover summary, chart, and flow surfaces');
    assert.ok(evidence.annotationCount >= 6, 'self dogfood should render at least six annotations');
    assert.ok(evidence.connectorCount >= 6, 'self dogfood should render visible connectors');
    assert.ok(evidence.noteCount >= 6, 'self dogfood should render visible notes');

    for (const surface of evidence.surfaces) {
      assert.equal(surface.validationOk, true, `${surface.id} anchor validation should pass`);
      assert.equal(surface.targetAlignmentOk, true, `${surface.id} target alignment should pass`);
      assert.equal(surface.qualityOk, true, `${surface.id} layout quality should pass`);
    }

    assert.ok(evidence.surfaces.some((surface) => surface.anchorSource === 'real-project-dom' && surface.dataSource === 'docs/completion-audit.json'), 'self dogfood should prove DOM anchors from completion audit data');
    assert.ok(evidence.surfaces.some((surface) => surface.anchorSource === 'generated-svg-chart' && surface.renderedBarCount >= 5), 'self dogfood should prove generated SVG chart anchors');
    assert.ok(evidence.surfaces.some((surface) => surface.anchorSource === 'generated-svg-diagram' && surface.renderedNodeCount >= 5 && surface.renderedEdgeCount >= 4), 'self dogfood should prove generated SVG diagram anchors');
    assert.deepEqual(consoleErrors, [], 'self dogfood browser should not emit console errors');

    const visibleNotes = await page.locator('.pa-annotation__note').count();
    const visibleConnectors = await page.locator('.pa-annotation__connector').count();
    const visibleBars = await page.locator('[data-metric-bar]').count();
    const visibleNodes = await page.locator('[data-flow-node]').count();
    assert.ok(visibleNotes >= 6, 'self dogfood browser should contain rendered note groups');
    assert.ok(visibleConnectors >= 6, 'self dogfood browser should contain rendered connectors');
    assert.ok(visibleBars >= 5, 'self dogfood browser should render generated chart bars');
    assert.ok(visibleNodes >= 5, 'self dogfood browser should render generated diagram nodes');

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
