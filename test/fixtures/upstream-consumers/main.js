import { renderAnnotationsSvg, resolvePreparedAnnotationLayout } from '@ponchia/annotations';
import { prepareVegaSvgAnnotations } from '@ponchia/annotations/vega';
import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';
import '@ponchia/annotations/bronto.css';
import * as vega from 'vega';
import mermaid from 'mermaid';
import manifest from './manifest.json';
import bar from './inputs/bar-chart.vg.json';
import grouped from './inputs/grouped-bar-chart.vg.json';
import diagram from './inputs/client-services-storage.mmd?raw';
import './styles.css';

const inputs = [bar, grouped, diagram];
const descriptions = [
  [['A: 28', 'Starting category'], ['D: 91', 'Highest amount'], ['G: 19', 'Lowest amount']],
  [['A / 2: 0.9', 'Largest A value'], ['B / 2: 1.1', 'Overall maximum'], ['C / 2: 0.2', 'Smaller same-series value']],
  [['Web app', 'Calls API and local cache'], ['API gateway', 'Routes to auth and orders'], ['Orders DB', 'Stores order service data']]
];
const views = [];
const records = [];
window.__upstreamConsumers = { ready: false, records, views };

// Independent client-rectangle measurements intentionally do not reuse adapter geometry.
function measuredBox(element, stage) {
  const r = element.getBoundingClientRect(), p = stage.getBoundingClientRect();
  return { x: r.x - p.x, y: r.y - p.y, width: r.width, height: r.height };
}

// Browser client rectangles differ on SVG stroke inclusion. Measure SVG fill
// geometry through its native transform, retain the browser rectangle as a
// separate observation, and check a conservative stroked envelope for occlusion.
function noteGeometry(rect, stage) {
  const b = rect.getBBox(), m = rect.getScreenCTM(), origin = stage.getBoundingClientRect();
  if (!m) throw new Error('Unmeasurable note SVG transform');
  const points = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]
    .map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const box = { x: Math.min(...xs) - origin.x, y: Math.min(...ys) - origin.y,
    width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  const style = getComputedStyle(rect);
  const stroke = style.stroke === 'none' ? 0 : parseFloat(style.strokeWidth);
  const dx = stroke * (Math.abs(m.a) + Math.abs(m.c)) / 2;
  const dy = stroke * (Math.abs(m.b) + Math.abs(m.d)) / 2;
  return { box, painted: { x: box.x - dx, y: box.y - dy, width: box.width + 2 * dx, height: box.height + 2 * dy },
    client: measuredBox(rect, stage) };
}

async function renderHost(source, input, index) {
  const article = document.createElement('article');
  article.id = source.id;
  article.innerHTML = `<h2>${source.id}</h2><p><a href="${source.sourceUrl}">Upstream source</a> · ${source.commit.slice(0, 12)} · ${source.host === 'vega' ? 'BSD-3-Clause' : 'MIT'}</p><div class="scroller" tabindex="0" role="region" aria-label="Scrollable ${source.id}"><div class="stage"><div class="host"></div><div class="overlay"></div></div></div><details><summary>Original upstream input and adaptations</summary><pre></pre><ul></ul></details>`;
  document.querySelector('#gallery').append(article);
  article.querySelector('pre').textContent = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  for (const adaptation of source.adaptations) {
    const li = document.createElement('li'); li.textContent = adaptation; article.querySelector('ul').append(li);
  }
  const stage = article.querySelector('.stage'), host = article.querySelector('.host');
  let view;
  if (source.host === 'vega') {
    // Font-only adaptation; data, width, encodings and hover signals remain upstream-authored.
    const spec = structuredClone(input);
    spec.config = { ...spec.config, axis: { labelFontSize: 14, titleFontSize: 14 }, text: { fontSize: 14 } };
    view = new vega.View(vega.parse(spec), { renderer: 'svg' }).initialize(host).hover();
    await view.runAsync();
    views.push(view);
  } else {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', fontSize: 16 });
    const rendered = await mermaid.render('upstream-flowchart', input);
    host.innerHTML = rendered.svg;
  }
  const svg = host.querySelector('svg');
  if (!svg) throw new Error(`${source.id}: missing rendered SVG`);
  const native = source.host === 'vega'
    ? { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')) }
    : { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height };
  svg.setAttribute('width', String(native.width)); svg.setAttribute('height', String(native.height));
  svg.style.width = `${native.width}px`; svg.style.height = `${native.height}px`;
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${source.id}, original upstream graphic`);
  host.style.left = '220px'; host.style.top = '150px';
  const bounds = { x: 0, y: 0, width: native.width + 440, height: native.height + 300 };
  stage.style.width = `${bounds.width}px`; stage.style.height = `${bounds.height}px`;
  await document.fonts.ready;
  await new Promise(requestAnimationFrame);
  const marks = [...svg.querySelectorAll(source.host === 'vega' ? '.mark-rect path' : 'g.node')];
  if (marks.length !== source.expectedMarks) throw new Error(`${source.id}: wrong mark count ${marks.length}`);
  const targets = source.host === 'vega'
    ? (index === 0 ? [marks[0], marks[3], marks[6]] : [marks[2], marks[6], marks[10]])
    : ['Web app', 'API gateway', 'Orders DB'].map(label => marks.find(node => node.textContent.trim() === label));
  const specs = targets.map((target, n) => {
    if (!target) throw new Error(`${source.id}: target ${n} missing`);
    target.setAttribute('data-fixture-target', String(n));
    return {
      id: `${source.id}-${n}`, selector: `[data-fixture-target="${n}"]`, coordinateSpace: stage,
      note: { title: descriptions[index][n][0], body: descriptions[index][n][1], wrap: 22, maxLines: 3 },
      placement: { side: ['left', 'right', 'top', 'bottom'], maxCandidates: 8 },
      subject: { shape: 'none' }, connector: { type: 'straight', end: 'dot' }
    };
  });
  const protectedSelector = source.host === 'vega'
    ? '.mark-rect path, .mark-text text, .mark-rule line, .mark-rule path'
    : 'g.node, g.cluster, .edgeLabel, path.flowchart-link';
  const prepare = source.host === 'vega' ? prepareVegaSvgAnnotations : prepareMermaidAnnotations;
  const prepared = prepare(svg, specs, { assert: true, obstacles: { selector: protectedSelector, coordinateSpace: stage } });
  // The untouched Vega tooltip has no text until hovered; zero-area invisible
  // elements cannot occlude a note and are excluded from obstacle geometry.
  prepared.obstacles = prepared.obstacles.filter(b => b.width > 0 && b.height > 0);
  const targetBoxes = targets.map(target => measuredBox(target, stage));
  const hostBox = measuredBox(svg, stage);
  const protectedHostBoxes = [...prepared.obstacles, hostBox];
  // Keep actual protected content distinct from solver clearance. A note's
  // one-pixel stroke can cover content even when its fill merely touches it.
  const inflate = box => ({ x: box.x - 4, y: box.y - 4,
    width: box.width + 8, height: box.height + 8 });
  prepared.obstacles = prepared.obstacles.map(inflate);
  // Generate exact clearance alternatives from measured host geometry, rather
  // than hoping coarse hard-coded offsets happen to clear a chart/diagram edge.
  prepared.annotations = prepared.annotations.map(annotation => {
    const box = annotation.anchor.box;
    if (!box) throw new Error('Expected rendered box anchor');
    const clearance = [box.x - hostBox.x, hostBox.x + hostBox.width - box.x - box.width,
      box.y - hostBox.y, hostBox.y + hostBox.height - box.y - box.height].map(n => n + 12);
    return { ...annotation, placement: { ...annotation.placement, offset: [20, 80, 160, 240, ...clearance] } };
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    bounds, padding: 12, defaultNoteSize: { width: 180, height: 100 },
    placement: { maxCandidates: 8, align: ['center', 'start', 'end'], offset: [20, 80, 160, 240], crossOffset: [0, -120, 120] },
    refinement: { passes: 2, maxCandidatesPerAnnotation: 8 },
    additionalObstacles: [inflate(hostBox)],
    targetAlignmentTargets: specs.map((spec, n) => ({ id: spec.id, box: targetBoxes[n] })),
    targetAlignmentOptions: { tolerance: 0.25, nearTolerance: 0.5 },
    assertTargetAlignment: { failOnWarnings: true }
  });
  article.querySelector('.overlay').innerHTML = renderAnnotationsSvg(resolved.layout, { title: `${source.id} callouts`, noteTabIndex: 0, markerIdPrefix: source.id });
  const record = { id: source.id, source, bounds, prepared, resolved, targets, stage, svg, view, protectedHostBoxes };
  records.push(record);
}

// Measurements are refreshed after interactions/scrolling, including painted text containment.
window.measureUpstreamConsumers = () => records.map(record => {
  const { stage, svg, resolved, targets } = record;
  const noteElements = [...stage.querySelectorAll('.pa-annotation__note')];
  const textElements = [...stage.querySelectorAll('.pa-annotation__note text')];
  const noteMeasurements = noteElements.map(e => noteGeometry(e.querySelector('rect'), stage));
  const hostTexts = [...svg.querySelectorAll('text, .nodeLabel')].filter(e => e.textContent.trim());
  const pixels = element => {
    const matrix = element.getScreenCTM?.() ?? element.closest('svg')?.getScreenCTM();
    return parseFloat(getComputedStyle(element).fontSize) * (matrix ? Math.hypot(matrix.a, matrix.b) : 1);
  };
  return {
    id: record.id, bounds: record.bounds, expectedNotes: record.source.expectedNotes,
    expectedMarks: record.source.expectedMarks,
    renderedMarks: svg.querySelectorAll(record.source.host === 'vega' ? '.mark-rect path' : 'g.node').length,
    renderedNotes: noteElements.length, renderedConnectors: stage.querySelectorAll('.pa-annotation__connector').length,
    validation: record.prepared.validation.ok, alignment: resolved.targetAlignment,
    quality: resolved.quality.metrics,
    anchorBoxes: record.prepared.annotations.map(a => a.anchor.box),
    targetBoxes: targets.map(t => measuredBox(t, stage)),
    noteBoxes: noteMeasurements.map(m => m.box),
    paintedNoteBoxes: noteMeasurements.map(m => m.painted),
    browserNoteBoxes: noteMeasurements.map(m => m.client),
    layoutNoteBoxes: resolved.layout.annotations.map(a => a.noteBox),
    obstacleBoxes: resolved.layout.obstacles,
    protectedHostBoxes: record.protectedHostBoxes,
    candidateCounts: resolved.layout.annotations.map(a => a.placement.candidates.length),
    finiteConnectorPoints: resolved.layout.annotations.every(a => a.connector.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))),
    text: textElements.map(e => ({ text: e.textContent, box: measuredBox(e, stage), noteBox: noteGeometry(e.closest('.pa-annotation__note').querySelector('rect'), stage).box, pixels: pixels(e) })),
    minHostTextPixels: Math.min(...hostTexts.map(pixels)),
    minNoteTextPixels: Math.min(...textElements.map(pixels)),
    hostTextCount: hostTexts.length,
    scroller: { clientWidth: stage.parentElement.clientWidth, scrollWidth: stage.parentElement.scrollWidth, scrollLeft: stage.parentElement.scrollLeft },
    manualPlacements: resolved.layout.annotations.filter(a => a.placement.manual).length
  };
});

try {
  for (let i = 0; i < manifest.hosts.length; i++) await renderHost(manifest.hosts[i], inputs[i], i);
  await document.fonts.ready;
  window.__upstreamConsumers.ready = true;
} catch (error) {
  window.__upstreamConsumers.error = String(error.stack ?? error);
  throw error;
}
