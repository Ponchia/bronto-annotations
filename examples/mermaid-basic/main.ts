import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout,
  type AnchorAlignmentTarget,
  type Box
} from '@ponchia/annotations';
import {
  prepareMermaidAnnotations
} from '@ponchia/annotations/mermaid';
import {
  boxFromSvgElement
} from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';
import mermaid from 'mermaid';
import './styles.css';

const diagramHost = document.querySelector<HTMLElement>('#diagram');
const layer = document.querySelector<HTMLElement>('#annotations');

const flowchartSource = `
flowchart LR
  Intake[Intake] --> API[API]
  API --> Report[Report]
`;
const sequenceSource = `
sequenceDiagram
  participant API
  participant Report
  API->>Report: request report
  Report-->>API: summary ready
`;

async function render() {
  if (!diagramHost || !layer) {
    return;
  }

  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
  const [
    { svg: flowchartSvgText },
    { svg: sequenceSvgText }
  ] = await Promise.all([
    mermaid.render('mermaid-basic-flowchart', flowchartSource),
    mermaid.render('mermaid-basic-sequence', sequenceSource)
  ]);

  diagramHost.innerHTML = [
    `<div id="flowchart" class="diagram-panel diagram-panel--flowchart">${flowchartSvgText}</div>`,
    `<div id="sequence" class="diagram-panel diagram-panel--sequence">${sequenceSvgText}</div>`
  ].join('');

  const flowchartSvg = diagramHost.querySelector<SVGSVGElement>('#flowchart svg');
  const sequenceSvg = diagramHost.querySelector<SVGSVGElement>('#sequence svg');
  const shell = diagramHost.closest<HTMLElement>('.diagram-shell');

  if (!flowchartSvg || !sequenceSvg || !shell) {
    return;
  }

  tagFlowchartSvg(flowchartSvg);
  tagSequenceSvg(sequenceSvg);

  const bounds = boundsFromElement(shell);
  const coordinateSpace = createCoordinateSpace(bounds);
  const compact = bounds.width < 560;
  const sequenceTop = bounds.height * 0.5;
  const flowchartEdges = Array.from(flowchartSvg.querySelectorAll<SVGPathElement>('path.flowchart-link, g.edgePath path'));
  flowchartEdges[0]?.setAttribute('data-edge-id', 'intake-api');
  flowchartEdges[1]?.setAttribute('data-edge-id', 'api-report');

  const annotationSpecs = [
    {
      id: 'mermaid-api',
      label: 'API',
      coordinateSpace,
      note: {
        title: 'Mermaid node',
        body: 'Label lookup.'
      },
      placement: {
        side: 'top',
        allowedSides: ['top', 'bottom'],
        align: 'center',
        offset: [14, 22],
        crossOffset: [0, -28, 28]
      },
      subject: { shape: 'rect', padding: 4 },
      priority: 2
    },
    {
      id: 'mermaid-report',
      label: 'Report',
      coordinateSpace,
      note: {
        title: 'Rendered diagram',
        body: 'Rendered SVG.'
      },
      placement: {
        side: 'bottom',
        allowedSides: ['bottom', 'top'],
        align: 'center',
        offset: [14, 22],
        crossOffset: [0, -28, 28]
      },
      subject: { shape: 'rect', padding: 4 }
    },
    {
      id: 'mermaid-edge',
      edgeId: 'api-report',
      kind: 'path',
      coordinateSpace,
      note: {
        title: 'Mermaid edge',
        body: 'Anchored to a rendered flow edge.'
      },
      placement: {
        manual: {
          x: compact ? 12 : 18,
          y: compact ? 24 : 18,
          side: 'bottom'
        }
      },
      subject: { shape: 'path' }
    },
    {
      id: 'mermaid-sequence-api',
      data: { participantId: 'sequence-api' },
      coordinateSpace,
      note: {
        title: 'Sequence actor',
        body: 'Participant from rendered SVG.'
      },
      placement: compact
        ? { manual: { x: 12, y: sequenceTop - 76, side: 'right' as const } }
        : { side: 'left' as const, allowedSides: ['left' as const, 'right' as const], offset: [18, 30] },
      subject: { shape: 'rect' as const, padding: 4 },
      tone: 'info' as const
    },
    {
      id: 'mermaid-sequence-message',
      data: { messageId: 'api-report-request' },
      coordinateSpace,
      note: {
        title: 'Sequence message',
        body: 'Message label hook.'
      },
      placement: compact
        ? { manual: { x: bounds.width - 162, y: bounds.height - 74, side: 'top' as const } }
        : { manual: { x: bounds.width - 186, y: 230, side: 'bottom' as const } },
      subject: { shape: 'rect' as const, padding: 3 },
      priority: 2
    },
    {
      id: 'mermaid-sequence-route',
      edgeId: 'api-report-request',
      kind: 'path',
      coordinateSpace,
      note: {
        title: 'Sequence route',
        body: 'Anchored to a message line.'
      },
      placement: compact
        ? { manual: { x: 12, y: bounds.height - 74, side: 'top' as const } }
        : { manual: { x: bounds.width - 186, y: bounds.height - 70, side: 'top' as const } },
      subject: { shape: 'path' as const }
    }
  ];
  const prepared = prepareMermaidAnnotations(diagramHost, annotationSpecs, {
    obstacles: {
      coordinateSpace,
      padding: 4
    }
  });
  const targetAlignmentTargets: AnchorAlignmentTarget[] = [
    targetFromText(diagramHost, coordinateSpace, 'mermaid-api', '#flowchart g.node', 'API', 'rendered Mermaid API node'),
    targetFromText(diagramHost, coordinateSpace, 'mermaid-report', '#flowchart g.node', 'Report', 'rendered Mermaid Report node'),
    targetFromSelector(diagramHost, coordinateSpace, 'mermaid-edge', '#flowchart [data-edge-id="api-report"]', 'rendered Mermaid API to Report edge'),
    targetFromSelector(diagramHost, coordinateSpace, 'mermaid-sequence-api', '#sequence [data-participant-id="sequence-api"]', 'rendered Mermaid sequence API actor'),
    targetFromSelector(diagramHost, coordinateSpace, 'mermaid-sequence-message', '#sequence [data-message-id="api-report-request"]', 'rendered Mermaid sequence message label'),
    targetFromSelector(diagramHost, coordinateSpace, 'mermaid-sequence-route', '#sequence [data-edge-id="api-report-request"]', 'rendered Mermaid sequence message route')
  ];
  const layoutDefaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'Mermaid anchors',
    layoutLabel: 'Mermaid annotations',
    includeInfo: true
  });

  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...layoutDefaults,
    bounds,
    padding: 12,
    noteSizes: {
      'mermaid-api': { width: 128, height: 54 },
      'mermaid-report': { width: 144, height: 54 },
      'mermaid-edge': { width: 154, height: 58 },
      'mermaid-sequence-api': { width: compact ? 142 : 160, height: 58 },
      'mermaid-sequence-message': { width: compact ? 150 : 168, height: 58 },
      'mermaid-sequence-route': { width: compact ? 150 : 168, height: 58 }
    },
    targetAlignmentTargets,
    targetAlignmentOptions: {
      tolerance: 14,
      nearTolerance: 18
    },
    targetAlignmentFormat: {
      label: 'Mermaid target alignment',
      includeAligned: true
    },
    assertTargetAlignment: {
      label: 'Mermaid target alignment',
      failOnWarnings: true
    }
  });
  const layout = resolved.layout;
  const targetAlignment = resolved.targetAlignment;
  const targetAlignmentSummary = resolved.targetAlignmentSummary;

  layer.innerHTML = renderAnnotationsSvg(layout, {
    noteTabIndex: 0,
    title: 'Mermaid annotations',
    preserveAspectRatio: 'none'
  });

  Object.assign(window, {
    __annotationsExample: {
      name: 'mermaid-basic',
      quality: resolved.quality,
      validationSummary: resolved.validationSummary,
      qualitySummary: resolved.qualitySummary,
      targetAlignment,
      targetAlignmentSummary,
      anchorSource: 'mermaid-svg',
      renderedNodes: flowchartSvg.querySelectorAll('g.node').length,
      renderedEdges: diagramHost.querySelectorAll('[data-edge-id]').length,
      renderedSequenceActors: sequenceSvg.querySelectorAll('[data-participant-id]').length,
      renderedSequenceMessages: sequenceSvg.querySelectorAll('[data-message-id]').length,
      validation: prepared.validation,
      anchorEvidence: prepared.annotations.map((annotation) => annotation.data),
      anchorIds: prepared.annotations.map((annotation) => annotation.id),
      obstacles: resolved.obstacles
    }
  });
}

void render();

function targetFromText(
  root: ParentNode,
  coordinateSpace: SVGSVGElement,
  id: string,
  selector: string,
  text: string,
  expected: string
): AnchorAlignmentTarget {
  const element = Array.from(root.querySelectorAll(selector))
    .find((candidate) => normalizeText(candidate.textContent ?? '') === normalizeText(text));
  const box = element ? boxFromSvgElement(element, coordinateSpace) : undefined;

  return {
    id,
    expected,
    ...(box ? { box } : {})
  };
}

function targetFromSelector(
  root: ParentNode,
  coordinateSpace: SVGSVGElement,
  id: string,
  selector: string,
  expected: string
): AnchorAlignmentTarget {
  const element = root.querySelector(selector);
  const box = element ? boxFromSvgElement(element, coordinateSpace) : undefined;

  return {
    id,
    expected,
    ...(box ? { box } : {})
  };
}

function createCoordinateSpace(bounds: Box): SVGSVGElement {
  layer!.innerHTML = `<svg id="annotation-coordinate-space" class="annotation-coordinate-space" xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" preserveAspectRatio="none" aria-hidden="true"></svg>`;
  const svg = layer!.querySelector<SVGSVGElement>('#annotation-coordinate-space');

  if (!svg) {
    throw new Error('Could not create Mermaid annotation coordinate space.');
  }

  return svg;
}

function boundsFromElement(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();

  return {
    x: 0,
    y: 0,
    width: Math.max(1, Math.ceil(rect.width)),
    height: Math.max(1, Math.ceil(rect.height))
  };
}

function tagFlowchartSvg(svg: SVGSVGElement): void {
  tagByText(svg, 'g.node', 'API', 'data-node-id', 'flow-api');
  tagByText(svg, 'g.node', 'Report', 'data-node-id', 'flow-report');
}

function tagSequenceSvg(svg: SVGSVGElement): void {
  tagByText(svg, 'g.actor, .actor', 'API', 'data-participant-id', 'sequence-api');
  tagByText(svg, 'g.actor, .actor', 'Report', 'data-participant-id', 'sequence-report');
  tagByText(svg, 'g.messageText, .messageText, text', 'request report', 'data-message-id', 'api-report-request');

  const messageRoute = svg.querySelector<SVGGeometryElement>([
    'path.messageLine0',
    'line.messageLine0',
    'path[class*="messageLine"]',
    'line[class*="messageLine"]'
  ].join(', '));

  messageRoute?.setAttribute('data-edge-id', 'api-report-request');
}

function tagByText(
  root: ParentNode,
  selector: string,
  text: string,
  attribute: string,
  value: string
): void {
  const element = Array.from(root.querySelectorAll<Element>(selector))
    .find((candidate) => normalizeText(candidate.textContent ?? '') === normalizeText(text));

  (element?.closest('g') ?? element)?.setAttribute(attribute, value);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
