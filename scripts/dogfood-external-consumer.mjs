import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const exec = promisify(execFile);
const consumerRoot = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_ROOT;
const requireConsumer = process.env.PONCHIA_ANNOTATIONS_REQUIRE_EXTERNAL_CONSUMER === '1';
const buildScript = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_BUILD_SCRIPT ?? 'build';
const routePath = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_PATH ?? '/stack/';
const distSubdir = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_DIST ?? 'dist';
const screenshotDir = new URL('../.tmp-dogfood/', import.meta.url).pathname;
const screenshotPath = join(screenshotDir, 'dogfood-external-consumer.png');
const evidencePath = join(screenshotDir, 'dogfood-external-consumer.json');

if (!consumerRoot) {
  const message = 'Skipped external consumer dogfood: set PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_ROOT to a local Astro/React consumer checkout.';

  if (requireConsumer) {
    throw new Error(message);
  }

  console.log(message);
  process.exit(0);
}

const root = resolve(consumerRoot);
const distRoot = resolve(root, distSubdir);
await assertDirectory(root, 'external consumer root');

if (process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_SKIP_BUILD !== '1') {
  await exec('npm', ['--prefix', root, 'run', buildScript], {
    maxBuffer: 1024 * 1024 * 20
  });
}

await assertDirectory(distRoot, 'external consumer dist directory');

const {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout
} = await import('@ponchia/annotations');
const { anchorFromDOMRect } = await import('@ponchia/annotations/dom');

const css = await readFile(new URL('../dist/bronto.css', import.meta.url), 'utf8');
const server = await serveStatic(distRoot);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(new URL(routePath, server.url).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stack-layer-diagram .stack-layer', { timeout: 45_000 });
  await page.evaluate(() => window.scrollTo(0, 0));

  const measured = await page.evaluate(measureExternalStackPage);
  assert.equal(measured.targets.length, 4, 'external dogfood should measure four annotation targets');
  assert.ok(measured.obstacles.length >= 5, 'external dogfood should measure real diagram obstacles');

  const prepared = prepareAnnotationsFromMeasurements(measured, { anchorFromDOMRect });
  const defaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'External consumer anchors',
    layoutLabel: 'External consumer annotations',
    failOnWarnings: true,
    includeInfo: true
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...defaults,
    bounds: measured.bounds,
    noteSizes: {
      summaryMetric: { width: 174, height: 72 },
      interfaceLayer: { width: 190, height: 82 },
      coreChip: { width: 164, height: 70 },
      flowStep: { width: 184, height: 74 }
    },
    assertQuality: {
      label: 'External consumer annotations',
      minScore: 45,
      includeWarnings: true,
      maxIssues: 8
    },
    targetAlignmentTargets: measured.targets.map((target) => ({
      id: target.id,
      expected: `external consumer selector ${target.selector}`,
      box: target.box,
      minOverlapRatio: 0.95
    })),
    assertTargetAlignment: {
      label: 'External consumer target alignment',
      failOnWarnings: true,
      includeAligned: true
    },
    targetAlignmentOptions: { tolerance: 0.5, minOverlapRatio: 0.95 }
  });

  const svg = renderAnnotationsSvg(resolved.layout, {
    markerIdPrefix: 'external-dogfood',
    includeQualityIssues: resolved.quality,
    preserveAspectRatio: 'none',
    title: 'External consumer dogfood annotations'
  });

  await page.evaluate(injectAnnotationLayer, { css, svg, bounds: measured.bounds });
  const browserEvidence = await page.evaluate(readInjectedEvidence);

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`external consumer dogfood emitted browser errors: ${[...consoleErrors, ...pageErrors].join('\n')}`);
  }

  assert.equal(browserEvidence.annotationGroups, 4, 'external dogfood should inject four annotations');
  assert.equal(browserEvidence.visibleNotes, 4, 'external dogfood should render four visible notes');
  assert.equal(browserEvidence.visibleConnectors, 4, 'external dogfood should render four visible connectors');
  assert.ok(browserEvidence.layerBox.width > 0 && browserEvidence.layerBox.height > 0, 'external dogfood layer must be visible');
  assert.ok(browserEvidence.text.includes('Layer card'), 'external dogfood should render note text');

  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(evidencePath, JSON.stringify({
    consumerType: 'external Astro/React writing site',
    routePath,
    packageSource: 'current checkout through public package imports',
    buildScript,
    measured: {
      targetCount: measured.targets.length,
      obstacleCount: measured.obstacles.length,
      stackLayerCount: measured.counts.stackLayers,
      summaryMetricCount: measured.counts.summaryMetrics,
      flowStepCount: measured.counts.flowSteps
    },
    validation: {
      ok: resolved.validation.ok,
      summary: resolved.validationSummary
    },
    targetAlignment: {
      ok: resolved.targetAlignment?.ok,
      summary: resolved.targetAlignmentSummary
    },
    quality: {
      ok: resolved.quality.ok,
      score: resolved.quality.score,
      issueCount: resolved.quality.metrics.issueCount,
      summary: resolved.qualitySummary
    },
    browser: browserEvidence,
    screenshot: '.tmp-dogfood/dogfood-external-consumer.png'
  }, null, 2));

  await page.close();
} finally {
  await browser.close();
  await server.close();
}

console.log('External consumer dogfood verified: 4 annotations on a real Astro/React stack page. Screenshot: .tmp-dogfood/dogfood-external-consumer.png.');

function prepareAnnotationsFromMeasurements(measured, dom) {
  const noteById = {
    summaryMetric: {
      title: 'Metric group',
      body: 'Real report counters measured from the host DOM.',
      wrap: 22
    },
    interfaceLayer: {
      title: 'Layer card',
      body: 'A generated stack layer becomes a box anchor.',
      wrap: 24
    },
    coreChip: {
      title: 'Core tool',
      body: 'Small chips stay addressable as obstacles and targets.',
      wrap: 22
    },
    flowStep: {
      title: 'Flow step',
      body: 'Ordered process rows can be annotated without app state.',
      wrap: 23
    }
  };
  const placementById = {
    summaryMetric: { side: ['bottom', 'right', 'left'], align: ['center', 'start'], offset: [18, 28], crossOffset: [0, 36, -36] },
    interfaceLayer: { side: ['right', 'bottom', 'left'], align: ['center', 'start'], offset: [18, 30], crossOffset: [0, 44, -44] },
    coreChip: { side: ['top', 'bottom', 'right'], align: ['center', 'start'], offset: [14, 24], crossOffset: [0, 30, -30] },
    flowStep: { side: ['left', 'top', 'right'], align: ['center', 'end'], offset: [16, 28], crossOffset: [0, 34, -34] }
  };
  const toneById = {
    summaryMetric: 'info',
    interfaceLayer: 'accent',
    coreChip: 'success',
    flowStep: 'warning'
  };

  return {
    annotations: measured.targets.map((target) => ({
      id: target.id,
      anchor: dom.anchorFromDOMRect(rectLike(target.box), { kind: 'box' }),
      note: noteById[target.id],
      placement: placementById[target.id],
      connector: { type: 'elbow', end: 'arrow', routing: { mode: 'orthogonal', padding: 10 } },
      subject: { shape: 'rect', padding: 4, cornerRadius: 6, data: { sourceSelector: target.selector } },
      variant: target.id === 'coreChip' ? 'badge' : 'callout',
      tone: toneById[target.id],
      data: { externalTarget: target.id, selector: target.selector },
      metadata: { measuredText: target.text }
    })),
    obstacles: measured.obstacles,
    validation: {
      ok: true,
      found: measured.targets.map((target) => target.id),
      warnings: [],
      missing: [],
      diagnostics: measured.targets.map((target) => ({
        id: target.id,
        source: 'external-dom',
        status: 'found',
        expected: `selector "${target.selector}"`,
        found: true
      }))
    }
  };
}

function measureExternalStackPage() {
  const selectors = [
    ['summaryMetric', '.stack-summary-metrics > div:first-child'],
    ['interfaceLayer', '.stack-layer-diagram .stack-layer:first-child'],
    ['coreChip', '.stack-layer:first-child .stack-tool-chip--core:first-child'],
    ['flowStep', '.stack-example:first-child .stack-example__steps li:nth-child(2)']
  ];
  const targets = selectors.map(([id, selector]) => measureElement(id, selector)).filter(Boolean);
  const obstacles = [
    ...document.querySelectorAll('.stack-layer, .stack-summary-metrics > div, .stack-example, .stack-tool-chip')
  ].map((element) => elementBox(element)).filter((box) => box.width > 0 && box.height > 0);
  const doc = document.documentElement;
  const body = document.body;

  return {
    title: document.title,
    route: location.pathname,
    bounds: {
      x: 0,
      y: 0,
      width: Math.max(doc.scrollWidth, body.scrollWidth, doc.clientWidth),
      height: Math.max(doc.scrollHeight, body.scrollHeight, doc.clientHeight)
    },
    counts: {
      stackLayers: document.querySelectorAll('.stack-layer').length,
      summaryMetrics: document.querySelectorAll('.stack-summary-metrics > div').length,
      flowSteps: document.querySelectorAll('.stack-example__steps li').length
    },
    targets,
    obstacles
  };

  function measureElement(id, selector) {
    const element = document.querySelector(selector);

    if (!element) {
      return undefined;
    }

    return {
      id,
      selector,
      box: elementBox(element),
      text: normalizeText(element.textContent ?? '')
    };
  }

  function elementBox(element) {
    const rect = element.getBoundingClientRect();

    return {
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    };
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim().slice(0, 120);
  }
}

function injectAnnotationLayer({ css, svg, bounds }) {
  const style = document.createElement('style');
  style.setAttribute('data-pa-external-dogfood-style', '');
  style.textContent = `${css}
[data-pa-external-dogfood-layer] {
  position: absolute;
  inset: 0 auto auto 0;
  width: ${bounds.width}px;
  height: ${bounds.height}px;
  pointer-events: none;
  z-index: 2147483000;
}
[data-pa-external-dogfood-layer] .pa-annotation-layer {
  display: block;
  width: 100%;
  height: 100%;
}`;

  if (getComputedStyle(document.body).position === 'static') {
    document.body.style.position = 'relative';
  }

  const previous = document.querySelector('[data-pa-external-dogfood-layer]');
  previous?.remove();
  document.querySelector('[data-pa-external-dogfood-style]')?.remove();

  const layer = document.createElement('div');
  layer.setAttribute('data-pa-external-dogfood-layer', '');
  layer.setAttribute('aria-label', 'External consumer dogfood annotations');
  layer.innerHTML = svg;
  document.head.append(style);
  document.body.append(layer);
}

function readInjectedEvidence() {
  const layer = document.querySelector('[data-pa-external-dogfood-layer]');
  const notes = [...document.querySelectorAll('[data-pa-external-dogfood-layer] .pa-annotation__note')];
  const connectors = [...document.querySelectorAll('[data-pa-external-dogfood-layer] .pa-annotation__connector')];
  const groups = [...document.querySelectorAll('[data-pa-external-dogfood-layer] .pa-annotation[data-annotation-id]')];
  const layerBox = rectJson(layer?.getBoundingClientRect());

  return {
    annotationGroups: groups.length,
    visibleNotes: notes.filter((note) => visibleBox(note.getBoundingClientRect())).length,
    visibleConnectors: connectors.filter((connector) => connector.getAttribute('d')).length,
    layerBox,
    text: layer?.textContent ?? ''
  };

  function visibleBox(rect) {
    return rect.width > 0 && rect.height > 0;
  }

  function rectJson(rect) {
    return rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : { x: 0, y: 0, width: 0, height: 0 };
  }
}

async function serveStatic(rootDir) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const file = await resolveStaticPath(rootDir, url.pathname);
      response.writeHead(200, { 'content-type': contentType(file) });
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : 'Static server error');
    }
  });

  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  const address = server.address();
  assert.ok(address && typeof address === 'object', 'external dogfood static server must expose an address');

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    })
  };
}

async function resolveStaticPath(rootDir, pathname) {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded.endsWith('/')
    ? join(rootDir, decoded, 'index.html')
    : join(rootDir, decoded);
  const normalized = normalize(requested);

  if (!normalized.startsWith(rootDir + sep) && normalized !== rootDir) {
    throw new Error('Refusing to serve a path outside the external consumer dist directory.');
  }

  const info = await stat(normalized).catch(async (error) => {
    if (error?.code === 'ENOENT' && !extname(normalized)) {
      return stat(join(normalized, 'index.html'));
    }

    throw error;
  });

  if (info.isDirectory()) {
    return join(normalized, 'index.html');
  }

  if (!extname(normalized) && basename(normalized) !== 'index.html') {
    return join(normalized, 'index.html');
  }

  return normalized;
}

function contentType(path) {
  switch (extname(path)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

async function assertDirectory(path, label) {
  const info = await stat(path).catch((error) => {
    throw new Error(`Expected ${label} at ${path}: ${error.message}`);
  });

  if (!info.isDirectory()) {
    throw new Error(`Expected ${label} to be a directory: ${path}`);
  }
}

function rectLike(box) {
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height
  };
}
