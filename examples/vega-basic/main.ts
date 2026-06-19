import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout,
  type AnchorAlignmentTarget
} from '@ponchia/annotations';
import {
  obstaclesFromVegaSvg,
  prepareVegaScenegraphAnnotations
} from '@ponchia/annotations/vega';
import {
  annotationFrameFromSvg,
  boxFromSvgElement
} from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';
import * as vega from 'vega';
import './styles.css';

const chart = document.querySelector<HTMLElement>('#chart');
const layer = document.querySelector<HTMLElement>('#annotations');

const spec = {
  $schema: 'https://vega.github.io/schema/vega/v6.json',
  width: 640,
  height: 320,
  padding: 48,
  data: [
    {
      name: 'table',
      values: [
        { id: 'start', x: 1, y: 3 },
        { id: 'peak', x: 2, y: 9 },
        { id: 'settled', x: 3, y: 5 }
      ]
    }
  ],
  scales: [
    { name: 'x', type: 'point', domain: { data: 'table', field: 'x' }, range: 'width' },
    { name: 'y', type: 'linear', domain: { data: 'table', field: 'y' }, nice: true, range: 'height' }
  ],
  axes: [
    { orient: 'bottom', scale: 'x', title: 'Period' },
    { orient: 'left', scale: 'y', title: 'Score' }
  ],
  marks: [
    {
      type: 'line',
      from: { data: 'table' },
      encode: {
        enter: {
          x: { scale: 'x', field: 'x' },
          y: { scale: 'y', field: 'y' },
          stroke: { value: '#0f766e' },
          strokeWidth: { value: 3 }
        }
      }
    },
    {
      name: 'points',
      type: 'symbol',
      from: { data: 'table' },
      encode: {
        enter: {
          x: { scale: 'x', field: 'x' },
          y: { scale: 'y', field: 'y' },
          size: { value: 140 },
          fill: { value: '#0f766e' },
          aria: { value: true },
          description: { signal: '"point-" + datum.id' }
        }
      }
    }
  ]
};

async function render() {
  if (!chart || !layer) {
    return;
  }

  const view = new vega.View(vega.parse(spec), { renderer: 'none' });
  await view.runAsync();
  chart.innerHTML = await view.toSVG();

  const svg = chart.querySelector<SVGSVGElement>('svg');

  if (!svg) {
    return;
  }

  const frame = annotationFrameFromSvg(svg);
  const annotationSpecs = [
    {
      id: 'vega-peak',
      markName: 'points',
      markType: 'symbol',
      datum: (datum) => (datum as { id?: string } | undefined)?.id === 'peak',
      note: {
        title: 'Generated Vega mark',
        body: 'The anchor comes from Vega scenegraph geometry.'
      },
      placement: { side: 'right' },
      subject: { shape: 'circle', padding: 4 },
      connector: { type: 'curve', end: 'arrow' },
      priority: 2
    },
    {
      id: 'vega-settled',
      markName: 'points',
      markType: 'symbol',
      datum: (datum) => (datum as { id?: string } | undefined)?.id === 'settled',
      note: {
        title: 'Scenegraph adapter',
        body: 'Annotations follow Vega output after scales and layout run.'
      },
      placement: { side: 'bottom' }
    }
  ];
  const prepared = prepareVegaScenegraphAnnotations(view, annotationSpecs, {
    obstacles: { role: 'axis', padding: 4 }
  });
  const targetAlignmentTargets: AnchorAlignmentTarget[] = [
    targetFromSvgMark(svg, 'vega-peak', 'path[aria-label="point-peak"]', 'rendered Vega peak mark'),
    targetFromSvgMark(svg, 'vega-settled', 'path[aria-label="point-settled"]', 'rendered Vega settled mark')
  ];
  const renderedMarkObstacles = obstaclesFromVegaSvg(svg, {
    markName: 'points',
    markType: 'symbol',
    coordinateSpace: svg,
    padding: 2
  });
  const layoutDefaults = generatedSurfaceLayoutDefaults({
    anchorLabel: 'Vega anchors',
    layoutLabel: 'Vega annotations'
  });

  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...layoutDefaults,
    bounds: frame.bounds,
    additionalObstacles: renderedMarkObstacles,
    padding: 12,
    placement: {
      ...layoutDefaults.placement,
      align: ['center', 'start', 'end'],
      offset: [16, 28],
      crossOffset: [0, -36, 36]
    },
    noteSizes: {
      'vega-peak': { width: 220, height: 86 },
      'vega-settled': { width: 210, height: 86 }
    },
    targetAlignmentTargets,
    targetAlignmentOptions: {
      tolerance: 10,
      nearTolerance: 12
    },
    targetAlignmentFormat: {
      label: 'Vega target alignment',
      includeAligned: true
    },
    assertTargetAlignment: {
      label: 'Vega target alignment',
      failOnWarnings: true
    }
  });
  const resolvedLayout = resolved.layout;
  const targetAlignment = resolved.targetAlignment;
  const targetAlignmentSummary = resolved.targetAlignmentSummary;

  layer.innerHTML = renderAnnotationsSvg(resolvedLayout, {
    noteTabIndex: 0,
    title: 'Vega annotations',
    preserveAspectRatio: frame.preserveAspectRatio
  });

  Object.assign(window, {
    __annotationsExample: {
      name: 'vega-basic',
      quality: resolved.quality,
      validationSummary: resolved.validationSummary,
      qualitySummary: resolved.qualitySummary,
      targetAlignment,
      targetAlignmentSummary,
      anchorSource: 'vega-scenegraph',
      renderedMarks: svg.querySelectorAll('.mark-symbol path').length,
      generatedObstacles: prepared.obstacles.length + renderedMarkObstacles.length,
      renderedSvgObstacles: renderedMarkObstacles.length,
      validation: prepared.validation,
      minCandidates: Math.min(...resolvedLayout.annotations.map((annotation) => annotation.placement.candidates.length)),
      anchorEvidence: prepared.annotations.map((annotation) => annotation.data),
      anchorIds: prepared.annotations.map((annotation) => annotation.id),
      obstacles: resolved.obstacles
    }
  });
}

void render();

function targetFromSvgMark(
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
