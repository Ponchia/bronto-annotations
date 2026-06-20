import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const consumerRoot = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_ROOT;
const requireConsumer = process.env.PONCHIA_ANNOTATIONS_REQUIRE_EXTERNAL_CONSUMER === '1';
const buildScript = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_BUILD_SCRIPT ?? 'build';
const routePath = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_PATH ?? '/stack/';
const consumerMode = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_MODE ?? 'stack-dom';
const distSubdir = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_DIST ?? 'dist';
const reactFlowSurfaceSelector = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_SURFACE_SELECTOR ?? '[data-flow-diagram]';
const reactFlowReadySelector = process.env.PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_READY_SELECTOR ?? '[data-flow-diagram] .react-flow__node';
const screenshotDir = new URL('../.tmp-dogfood/', import.meta.url).pathname;
const screenshotFile = consumerMode === 'react-flow'
  ? 'dogfood-external-react-flow.png'
  : 'dogfood-external-consumer.png';
const evidenceFile = consumerMode === 'react-flow'
  ? 'dogfood-external-react-flow.json'
  : 'dogfood-external-consumer.json';
const screenshotPath = join(screenshotDir, screenshotFile);
const evidencePath = join(screenshotDir, evidenceFile);

if (!consumerRoot) {
  const message = 'Skipped external consumer dogfood: set PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_ROOT to a local Astro/React consumer checkout.';

  if (requireConsumer) {
    throw new Error(message);
  }

  writeLine(message);
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
const { prepareReactFlowAnnotations } = await import('@ponchia/annotations/react-flow');

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

  if (consumerMode === 'react-flow') {
    await runExternalReactFlowDogfood(page, { css, consoleErrors, pageErrors });
  } else if (consumerMode === 'stack-dom') {
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
    consumerMode,
    surfaceType: 'rendered DOM stack page',
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
  } else {
    throw new Error(`Unsupported external consumer dogfood mode: ${consumerMode}. Expected "stack-dom" or "react-flow".`);
  }

  await page.close();
} finally {
  await browser.close();
  await server.close();
}

if (consumerMode === 'react-flow') {
  writeLine('External React Flow dogfood verified: 4 annotations on a real rendered React Flow surface. Screenshot: .tmp-dogfood/dogfood-external-react-flow.png.');
} else {
  writeLine('External consumer dogfood verified: 4 annotations on a real Astro/React stack page. Screenshot: .tmp-dogfood/dogfood-external-consumer.png.');
}

async function runExternalReactFlowDogfood(page, { css, consoleErrors, pageErrors }) {
  await page.waitForSelector(reactFlowSurfaceSelector, { timeout: 45_000 });
  await page.evaluate((selector) => {
    const surface = document.querySelector(selector) ?? document.querySelector('[data-flow-diagram]');
    surface?.scrollIntoView({ block: 'center' });
  }, reactFlowSurfaceSelector);
  await page.waitForSelector(reactFlowReadySelector, { timeout: 45_000 });
  await page.waitForFunction(({ surfaceSelector }) => {
    const surface = document.querySelector(surfaceSelector) ?? document.querySelector('[data-flow-diagram]');

    return Boolean(
      surface
        && surface.querySelectorAll('.react-flow__node[data-id]').length >= 2
        && surface.querySelectorAll('.react-flow__edge[data-id]').length >= 1
    );
  }, { surfaceSelector: reactFlowSurfaceSelector }, { timeout: 45_000 });
  await page.waitForTimeout(500);

  const measured = await page.evaluate(measureExternalReactFlowPage, {
    surfaceSelector: reactFlowSurfaceSelector
  });
  assert.ok(measured.nodes.length >= 2, 'external React Flow dogfood should measure at least two rendered nodes');
  assert.ok(measured.edges.length >= 1, 'external React Flow dogfood should measure at least one rendered edge route');
  assert.ok(measured.handles.length >= 1, 'external React Flow dogfood should measure rendered handles');

  const { prepared, targets, selected } = prepareExternalReactFlowAnnotations(measured);
  const defaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'External React Flow anchors',
    layoutLabel: 'External React Flow annotations',
    failOnWarnings: true,
    includeInfo: true
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...defaults,
    bounds: measured.bounds,
    noteSizes: {
      reactFlowEntry: { width: 188, height: 78 },
      reactFlowRoute: { width: 196, height: 78 },
      reactFlowHandle: { width: 194, height: 78 },
      reactFlowTerminal: { width: 190, height: 78 }
    },
    assertQuality: {
      label: 'External React Flow annotations',
      minScore: 45,
      includeWarnings: true,
      maxIssues: 8
    },
    targetAlignmentTargets: targets,
    assertTargetAlignment: {
      label: 'External React Flow target alignment',
      failOnWarnings: true,
      includeAligned: true
    },
    targetAlignmentOptions: { tolerance: 2, nearTolerance: 10, minOverlapRatio: 0.9 }
  });

  const svg = renderAnnotationsSvg(resolved.layout, {
    markerIdPrefix: 'external-react-flow-dogfood',
    includeQualityIssues: resolved.quality,
    preserveAspectRatio: 'none',
    title: 'External React Flow dogfood annotations'
  });

  await page.evaluate(injectAnnotationLayer, { css, svg, bounds: measured.bounds });
  const browserEvidence = await page.evaluate(readInjectedEvidence);

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`external React Flow dogfood emitted browser errors: ${[...consoleErrors, ...pageErrors].join('\n')}`);
  }

  assert.equal(browserEvidence.annotationGroups, 4, 'external React Flow dogfood should inject four annotations');
  assert.equal(browserEvidence.visibleNotes, 4, 'external React Flow dogfood should render four visible notes');
  assert.equal(browserEvidence.visibleConnectors, 4, 'external React Flow dogfood should render four visible connectors');
  assert.ok(browserEvidence.layerBox.width > 0 && browserEvidence.layerBox.height > 0, 'external React Flow dogfood layer must be visible');
  assert.ok(browserEvidence.text.includes('Rendered node'), 'external React Flow dogfood should render note text');

  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await writeFile(evidencePath, JSON.stringify({
    consumerType: 'external Astro/React writing site',
    consumerMode,
    surfaceType: 'rendered React Flow diagram',
    routePath,
    surfaceSelector: reactFlowSurfaceSelector,
    readySelector: reactFlowReadySelector,
    packageSource: 'current checkout through public package imports',
    buildScript,
    measured: {
      surfaceCount: measured.counts.surfaces,
      nodeCount: measured.nodes.length,
      edgeCount: measured.edges.length,
      handleCount: measured.handles.length,
      routePointCount: measured.edges.reduce((total, edge) => total + edge.points.length, 0),
      selected
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
    screenshot: '.tmp-dogfood/dogfood-external-react-flow.png'
  }, null, 2));
}

function prepareExternalReactFlowAnnotations(measured) {
  const nodes = measured.nodes.map((node) => ({
    id: node.id,
    position: { x: node.box.x, y: node.box.y },
    width: node.box.width,
    height: node.box.height,
    measured: { width: node.box.width, height: node.box.height },
    handles: measured.handles
      .filter((handle) => handle.nodeId === node.id)
      .map((handle) => ({
        ...(handle.handleId ? { id: handle.handleId } : {}),
        nodeId: node.id,
        x: handle.box.x - node.box.x,
        y: handle.box.y - node.box.y,
        width: handle.box.width,
        height: handle.box.height,
        ...(handle.position ? { position: handle.position } : {}),
        ...(handle.type ? { type: handle.type } : {})
      })),
    data: { label: node.text }
  }));
  const edges = measured.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    data: {
      source: 'rendered-react-flow-route',
      pointCount: edge.points.length
    }
  }));
  const entryNode = measured.nodes[0];
  const terminalNode = measured.nodes[measured.nodes.length - 1];
  const routedEdge = measured.edges.find((edge) => edge.points.length >= 2);
  const handle = measured.handles.find((item) => item.type === 'source')
    ?? measured.handles.find((item) => item.position)
    ?? measured.handles[0];

  assert.ok(entryNode, 'external React Flow dogfood should have an entry node');
  assert.ok(terminalNode, 'external React Flow dogfood should have a terminal node');
  assert.ok(routedEdge, 'external React Flow dogfood should have a routed edge');
  assert.ok(handle, 'external React Flow dogfood should have a measured handle');

  const specs = [
    {
      id: 'reactFlowEntry',
      nodeId: entryNode.id,
      note: {
        title: 'Rendered node',
        body: 'Actual React Flow node measured after host layout.',
        wrap: 24
      },
      placement: { side: ['right', 'bottom', 'left'], align: ['center', 'start'], offset: [18, 30], crossOffset: [0, 42, -42] },
      connector: { type: 'elbow', end: 'arrow', routing: { mode: 'orthogonal', padding: 10 } },
      subject: { shape: 'rect', padding: 4, cornerRadius: 6, data: { source: 'rendered-node' } },
      variant: 'callout',
      tone: 'accent',
      priority: 20,
      annotationData: { externalTarget: 'entry-node', reactFlowNodeId: entryNode.id }
    },
    {
      id: 'reactFlowRoute',
      edgeId: routedEdge.id,
      note: {
        title: 'Rendered route',
        body: 'The edge anchor follows generated SVG route points.',
        wrap: 24
      },
      placement: { side: ['right', 'left', 'top'], align: ['center', 'start'], offset: [20, 32], crossOffset: [0, 44, -44] },
      connector: { type: 'curve', end: 'dot' },
      subject: { shape: 'path', data: { source: 'rendered-edge-route' } },
      variant: 'curve',
      tone: 'info',
      priority: 18,
      annotationData: { externalTarget: 'edge-route', reactFlowEdgeId: routedEdge.id }
    },
    {
      id: 'reactFlowHandle',
      handle: {
        nodeId: handle.nodeId,
        ...(handle.handleId ? { id: handle.handleId } : {}),
        ...(handle.position ? { side: handle.position } : {}),
        ...(handle.type ? { type: handle.type } : {}),
        center: true
      },
      note: {
        title: 'Measured handle',
        body: 'Handle geometry came from React Flow DOM attributes.',
        wrap: 24
      },
      placement: { side: ['left', 'right', 'bottom'], align: ['center', 'start'], offset: [18, 28], crossOffset: [0, 36, -36] },
      connector: { type: 'straight', end: 'arrow' },
      subject: { shape: 'point', radius: 5, data: { source: 'rendered-handle' } },
      variant: 'badge',
      tone: 'success',
      priority: 16,
      annotationData: { externalTarget: 'handle', reactFlowNodeId: handle.nodeId }
    },
    {
      id: 'reactFlowTerminal',
      nodeId: terminalNode.id,
      note: {
        title: 'Terminal node',
        body: 'Final node shares the post-fitView coordinate space.',
        wrap: 24
      },
      placement: { side: ['left', 'top', 'right'], align: ['center', 'end'], offset: [18, 30], crossOffset: [0, 42, -42] },
      connector: { type: 'elbow', end: 'arrow', routing: { mode: 'orthogonal', padding: 10 } },
      subject: { shape: 'rect', padding: 4, cornerRadius: 6, data: { source: 'rendered-node' } },
      variant: 'callout',
      tone: 'warning',
      priority: 14,
      annotationData: { externalTarget: 'terminal-node', reactFlowNodeId: terminalNode.id }
    }
  ];
  const prepared = prepareReactFlowAnnotations({
    nodes,
    edges,
    edgePoints: (edge) => measured.edges.find((item) => item.id === edge.id)?.points
  }, specs, {
    obstacles: {
      includeNodes: true,
      includeHandles: true,
      includeEdges: true,
      padding: 4
    },
    assert: {
      label: 'External React Flow anchors',
      failOnWarnings: true,
      includeFound: true
    }
  });

  return {
    prepared,
    targets: [
      {
        id: 'reactFlowEntry',
        expected: `rendered React Flow node "${entryNode.id}"`,
        box: entryNode.box,
        minOverlapRatio: 0.9
      },
      {
        id: 'reactFlowRoute',
        expected: `rendered React Flow edge route "${routedEdge.id}"`,
        points: routedEdge.points,
        minOverlapRatio: 0.9
      },
      {
        id: 'reactFlowHandle',
        expected: `rendered React Flow handle on "${handle.nodeId}"`,
        point: boxCenter(handle.box),
        tolerance: 4
      },
      {
        id: 'reactFlowTerminal',
        expected: `rendered React Flow node "${terminalNode.id}"`,
        box: terminalNode.box,
        minOverlapRatio: 0.9
      }
    ],
    selected: {
      entryNodeId: entryNode.id,
      terminalNodeId: terminalNode.id,
      edgeId: routedEdge.id,
      handleNodeId: handle.nodeId,
      handlePosition: handle.position,
      handleType: handle.type
    }
  };
}

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

function measureExternalReactFlowPage({ surfaceSelector }) {
  const surface = document.querySelector(surfaceSelector) ?? document.querySelector('[data-flow-diagram]');

  if (!surface) {
    return {
      title: document.title,
      route: location.pathname,
      bounds: documentBounds(),
      counts: { surfaces: 0, nodes: 0, edges: 0, handles: 0 },
      surface: undefined,
      nodes: [],
      handles: [],
      edges: []
    };
  }

  const nodeElements = [...surface.querySelectorAll('.react-flow__node[data-id]')];
  const handleElements = [...surface.querySelectorAll('.react-flow__handle')];
  const nodes = nodeElements.map((element) => ({
    id: element.getAttribute('data-id'),
    box: elementBox(element),
    text: normalizeText(element.textContent ?? '')
  })).filter((node) => node.id && node.box.width > 0 && node.box.height > 0);
  const handles = handleElements.map((element) => {
    const box = elementBox(element);
    const className = element.getAttribute('class') ?? '';

    return {
      nodeId: element.getAttribute('data-nodeid'),
      handleId: element.getAttribute('data-handleid') || undefined,
      position: placementSide(element.getAttribute('data-handlepos')),
      type: className.includes(' source ') || className.endsWith(' source') ? 'source'
        : className.includes(' target ') || className.endsWith(' target') ? 'target'
          : undefined,
      box
    };
  }).filter((handle) => handle.nodeId && handle.box.width > 0 && handle.box.height > 0);
  const edges = [...surface.querySelectorAll('.react-flow__edge[data-id]')].map((element, index) => {
    const path = element.querySelector('path');
    const points = path ? documentPathPoints(path) : [];
    const fallbackId = `rendered-edge-${index + 1}`;
    const sourceNodeId = closestNodeId(points[0], nodes) ?? nodes[0]?.id ?? fallbackId;
    const targetNodeId = closestNodeId(points[points.length - 1], nodes) ?? nodes[nodes.length - 1]?.id ?? sourceNodeId;

    return {
      id: element.getAttribute('data-id') || fallbackId,
      box: elementBox(element),
      points,
      sourceNodeId,
      targetNodeId
    };
  }).filter((edge) => edge.points.length >= 2);

  return {
    title: document.title,
    route: location.pathname,
    bounds: documentBounds(),
    counts: {
      surfaces: document.querySelectorAll('[data-flow-diagram]').length,
      nodes: nodeElements.length,
      edges: surface.querySelectorAll('.react-flow__edge[data-id]').length,
      handles: handleElements.length
    },
    surface: {
      selector: surfaceSelector,
      slug: surface.getAttribute('data-flow-diagram') || undefined,
      box: elementBox(surface)
    },
    nodes,
    handles,
    edges
  };

  function documentPathPoints(path) {
    const matrix = path.getScreenCTM();
    const svg = path.ownerSVGElement;

    if (!matrix || !svg || typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
      return pathBoxFallback(path);
    }

    const length = path.getTotalLength();

    if (!Number.isFinite(length) || length <= 0) {
      return pathBoxFallback(path);
    }

    const point = svg.createSVGPoint();
    const count = Math.max(6, Math.min(20, Math.ceil(length / 70)));
    const sampled = [];

    for (let index = 0; index <= count; index += 1) {
      const local = path.getPointAtLength(length * (index / count));
      point.x = local.x;
      point.y = local.y;
      const screen = point.matrixTransform(matrix);
      sampled.push({
        x: round(screen.x + window.scrollX),
        y: round(screen.y + window.scrollY)
      });
    }

    return dedupePoints(sampled);
  }

  function pathBoxFallback(path) {
    const box = elementBox(path);

    return [
      { x: box.x, y: box.y + box.height / 2 },
      { x: box.x + box.width, y: box.y + box.height / 2 }
    ];
  }

  function dedupePoints(points) {
    return points.filter((point, index) => {
      const previous = points[index - 1];

      return !previous || Math.abs(point.x - previous.x) > 0.2 || Math.abs(point.y - previous.y) > 0.2;
    });
  }

  function closestNodeId(point, candidates) {
    if (!point) {
      return undefined;
    }

    let best;

    for (const node of candidates) {
      const center = {
        x: node.box.x + node.box.width / 2,
        y: node.box.y + node.box.height / 2
      };
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!best || distance < best.distance) {
        best = { id: node.id, distance };
      }
    }

    return best?.id;
  }

  function placementSide(value) {
    return value === 'top' || value === 'right' || value === 'bottom' || value === 'left'
      ? value
      : undefined;
  }

  function documentBounds() {
    const doc = document.documentElement;
    const body = document.body;

    return {
      x: 0,
      y: 0,
      width: Math.max(doc.scrollWidth, body.scrollWidth, doc.clientWidth),
      height: Math.max(doc.scrollHeight, body.scrollHeight, doc.clientHeight)
    };
  }

  function elementBox(element) {
    const rect = element.getBoundingClientRect();

    return {
      x: round(rect.left + window.scrollX),
      y: round(rect.top + window.scrollY),
      width: round(rect.width),
      height: round(rect.height)
    };
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function round(value) {
    return Math.round(value * 1000) / 1000;
  }
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

function boxCenter(box) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}
