import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout,
  type AnchorAlignmentTarget
} from '@ponchia/annotations';
import {
  prepareMermaidAnnotations
} from '@ponchia/annotations/mermaid';
import {
  annotationFrameFromSvg,
  boxFromSvgElement
} from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';
import mermaid from 'mermaid';
import './styles.css';

const diagramHost = document.querySelector<HTMLElement>('#diagram');
const layer = document.querySelector<HTMLElement>('#annotations');

const source = `
flowchart LR
  Intake[Intake] --> API[API]
  API --> Report[Report]
`;

async function render() {
  if (!diagramHost || !layer) {
    return;
  }

  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
  const { svg: svgText } = await mermaid.render('mermaid-basic-diagram', source);
  diagramHost.innerHTML = svgText;

  const svg = diagramHost.querySelector<SVGSVGElement>('svg');

  if (!svg) {
    return;
  }

  const edgePaths = Array.from(svg.querySelectorAll<SVGPathElement>('path.flowchart-link, g.edgePath path'));
  edgePaths[0]?.setAttribute('data-edge-id', 'intake-api');
  edgePaths[1]?.setAttribute('data-edge-id', 'api-report');

  const frame = annotationFrameFromSvg(svg, {
    padding: { top: 64, right: 90, bottom: 64, left: 90 }
  });
  const viewBox = svg.viewBox.baseVal;
  const annotationSpecs = [
    {
      id: 'mermaid-api',
      label: 'API',
      coordinateSpace: svg,
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
      coordinateSpace: svg,
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
      coordinateSpace: svg,
      note: {
        title: 'Mermaid edge',
        body: 'Anchored to a rendered flow edge.'
      },
      placement: {
        manual: {
          x: frame.bounds.x + 8,
          y: viewBox.y - 58,
          side: 'bottom'
        }
      },
      subject: { shape: 'path' }
    }
  ];
  const prepared = prepareMermaidAnnotations(svg, annotationSpecs, {
    obstacles: {
      coordinateSpace: svg,
      padding: 4
    }
  });
  const targetAlignmentTargets: AnchorAlignmentTarget[] = [
    targetFromText(svg, 'mermaid-api', 'g.node', 'API', 'rendered Mermaid API node'),
    targetFromText(svg, 'mermaid-report', 'g.node', 'Report', 'rendered Mermaid Report node'),
    targetFromSelector(svg, 'mermaid-edge', 'path[data-edge-id="api-report"]', 'rendered Mermaid API to Report edge')
  ];
  svg.setAttribute('viewBox', frame.viewBox);
  const layoutDefaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'Mermaid anchors',
    layoutLabel: 'Mermaid annotations'
  });

  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...layoutDefaults,
    bounds: frame.bounds,
    padding: 12,
    noteSizes: {
      'mermaid-api': { width: 128, height: 54 },
      'mermaid-report': { width: 144, height: 54 },
      'mermaid-edge': { width: 154, height: 58 }
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
    preserveAspectRatio: frame.preserveAspectRatio
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
      renderedNodes: svg.querySelectorAll('g.node').length,
      renderedEdges: svg.querySelectorAll('[data-edge-id]').length,
      validation: prepared.validation,
      anchorEvidence: prepared.annotations.map((annotation) => annotation.data),
      anchorIds: prepared.annotations.map((annotation) => annotation.id),
      obstacles: resolved.obstacles
    }
  });
}

void render();

function targetFromText(
  svg: SVGSVGElement,
  id: string,
  selector: string,
  text: string,
  expected: string
): AnchorAlignmentTarget {
  const element = Array.from(svg.querySelectorAll(selector))
    .find((candidate) => normalizeText(candidate.textContent ?? '') === normalizeText(text));
  const box = element ? boxFromSvgElement(element, svg) : undefined;

  return {
    id,
    expected,
    ...(box ? { box } : {})
  };
}

function targetFromSelector(
  svg: SVGSVGElement,
  id: string,
  selector: string,
  expected: string
): AnchorAlignmentTarget {
  const element = svg.querySelector(selector);
  const box = element ? boxFromSvgElement(element, svg) : undefined;

  return {
    id,
    expected,
    ...(box ? { box } : {})
  };
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
