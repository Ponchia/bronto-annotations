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
  host.style.left = '200px'; host.style.top = '150px';
  const bounds = { x: 0, y: 0, width: native.width + 400, height: native.height + 300 };
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
  const prepared = prepare(svg, specs, { assert: true, obstacles: { selector: protectedSelector, coordinateSpace: stage, padding: 2 } });
  // The untouched Vega tooltip has no text until hovered; zero-area invisible
  // elements cannot occlude a note and are excluded from obstacle geometry.
  prepared.obstacles = prepared.obstacles.filter(b => b.width > 0 && b.height > 0);
  const targetBoxes = targets.map(target => measuredBox(target, stage));
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    bounds, padding: 12, defaultNoteSize: { width: 180, height: 100 },
    placement: { maxCandidates: 8, align: ['center', 'start', 'end'], offset: [20, 80, 160, 240], crossOffset: [0, -120, 120] },
    refinement: { passes: 2, maxCandidatesPerAnnotation: 8 },
    additionalObstacles: [measuredBox(svg, stage)],
    targetAlignmentTargets: specs.map((spec, n) => ({ id: spec.id, box: targetBoxes[n] })),
    targetAlignmentOptions: { tolerance: 0.25, nearTolerance: 0.5 },
    assertTargetAlignment: { failOnWarnings: true }
  });
  article.querySelector('.overlay').innerHTML = renderAnnotationsSvg(resolved.layout, { title: `${source.id} callouts`, noteTabIndex: 0, markerIdPrefix: source.id });
  const record = { id: source.id, source, bounds, prepared, resolved, targets, stage, svg, view };
  records.push(record);
}

// Measurements are refreshed after interactions/scrolling, including painted text containment.
window.measureUpstreamConsumers = () => records.map(record => {
  const { stage, svg, resolved, targets } = record;
  const noteElements = [...stage.querySelectorAll('.pa-annotation__note')];
  const textElements = [...stage.querySelectorAll('.pa-annotation__note text')];
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
    noteBoxes: noteElements.map(e => measuredBox(e.querySelector('rect'), stage)),
    layoutNoteBoxes: resolved.layout.annotations.map(a => a.noteBox),
    obstacleBoxes: resolved.layout.obstacles,
    candidateCounts: resolved.layout.annotations.map(a => a.placement.candidates.length),
    finiteConnectorPoints: resolved.layout.annotations.every(a => a.connector.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))),
    text: textElements.map(e => ({ text: e.textContent, box: measuredBox(e, stage), noteBox: measuredBox(e.closest('.pa-annotation__note').querySelector('rect'), stage), pixels: pixels(e) })),
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
