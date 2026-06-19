import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout,
  resolveAnnotationLayout,
  type Annotation,
  type Box,
  type LayoutOptions
} from '@ponchia/annotations';
import {
  AnnotationLayer,
  type AnnotationLayerProps,
  type AnnotationLayerQualityEvent
} from '@ponchia/annotations/react';
import { annotationFrameFromSvg, prepareDomAnnotations } from '@ponchia/annotations/dom';
import { prepareVegaScenegraphAnnotations } from '@ponchia/annotations/vega';
import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';
import { prepareD2DiagramAnnotations } from '@ponchia/annotations/d2';
import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';
import '@ponchia/annotations/bronto.css';

declare const hostRoot: ParentNode;
declare const mermaidSvg: SVGSVGElement;

type ChartDatum = {
  id: string;
  x: number;
  y: number;
};

const manualAnnotation: Annotation = {
  id: 'manual-note',
  anchor: { type: 'point', point: { x: 120, y: 88 } },
  note: {
    title: 'Manual note',
    body: 'The host can pin a note while the engine still routes connectors.'
  },
  connector: { end: 'arrow' },
  placement: { manual: { x: 220, y: 54, side: 'left' } }
};

const manualObstacles: Box[] = [
  { x: 104, y: 72, width: 32, height: 32 }
];

const quickstartLayout = resolveAnnotationLayout({
  annotations: [manualAnnotation],
  obstacles: manualObstacles,
  bounds: { x: 0, y: 0, width: 420, height: 260 },
  padding: 16,
  placement: {
    side: ['right', 'bottom', 'top', 'left'],
    align: ['center', 'start', 'end'],
    offset: [16, 28],
    crossOffset: [0, -32, 32]
  },
  refinement: { passes: 2, maxCandidatesPerAnnotation: 32 }
});

const quickstartQuality = evaluateAnnotationLayout(quickstartLayout);
assertAnnotationLayoutQuality(quickstartQuality, {
  failOnWarnings: true,
  label: 'Report annotations',
  minScore: 95
});
formatLayoutQualityReport(quickstartQuality, { includeInfo: true });
const quickstartSvg = renderAnnotationsSvg(quickstartLayout, {
  title: 'Annotations',
  markerIdPrefix: 'surface-annotations',
  preserveAspectRatio: 'xMidYMid meet'
});

const domPrepared = prepareDomAnnotations(hostRoot, [{
  selector: '#metric-card',
  id: 'dom-metric',
  note: { title: 'Measured DOM region' },
  placement: { side: ['right', 'bottom'], offset: [16, 24] }
}], {
  obstacles: [{ selector: '.host-obstacle', inflate: 4 }]
});
const domGeneratedDefaults = generatedSurfaceLayoutDefaults({
  anchorLabel: 'DOM docs anchors',
  layoutLabel: 'DOM docs annotations'
});
const domResolved = resolvePreparedAnnotationLayout(domPrepared, {
  ...domGeneratedDefaults,
  bounds: { x: 0, y: 0, width: 420, height: 260 }
});
void domResolved.validationSummary;
void domResolved.qualitySummary;
const mermaidFrame = annotationFrameFromSvg(mermaidSvg, {
  padding: { top: 24, right: 48, bottom: 24, left: 48 }
});

const vegaPrepared = prepareVegaScenegraphAnnotations<ChartDatum>({
  scenegraph: () => ({
    root: {
      items: [{
        mark: { name: 'points', marktype: 'symbol', role: 'mark' },
        datum: { id: 'peak', x: 12, y: 34 },
        bounds: { x1: 64, y1: 68, x2: 92, y2: 96 }
      }]
    }
  })
}, [{
  id: 'vega-peak',
  markName: 'points',
  datum: (datum) => datum?.id === 'peak',
  note: { title: 'Generated Vega mark' },
  placement: { side: ['right', 'top'], offset: [18, 28] },
  annotationData: { source: 'vega-scenegraph' }
}], {
  assert: { label: 'Vega docs anchors' },
  obstacles: { padding: 4 }
});

const mermaidPrepared = prepareMermaidAnnotations(mermaidSvg, [{
  id: 'mermaid-api',
  label: 'API',
  labelMatch: 'contains',
  coordinateSpace: mermaidSvg,
  note: { title: 'Rendered Mermaid node' },
  placement: { side: ['right', 'bottom'], offset: 18 },
  annotationData: { source: 'mermaid-svg' }
}], {
  assert: { label: 'Mermaid docs anchors' },
  obstacles: { coordinateSpace: mermaidSvg, inflate: 4 }
});

const d2Prepared = prepareD2DiagramAnnotations({
  shapes: [
    { id: 'process', pos: { x: 64, y: 68 }, width: 74, height: 44, label: 'Process' }
  ],
  connections: [
    {
      id: 'api-process',
      src: 'api',
      dst: 'process',
      route: [{ x: 20, y: 90 }, { x: 64, y: 90 }]
    }
  ]
}, [{
  id: 'd2-process',
  shapeId: 'process',
  note: { title: 'Compiled D2 shape' },
  placement: { side: ['right', 'top'], offset: [16, 24] },
  annotationData: { source: 'd2-diagram' }
}], {
  assert: { label: 'D2 docs anchors' },
  obstacles: { includeConnections: true, padding: 4 }
});

const reactFlowPrepared = prepareReactFlowAnnotations({
  nodes: [{
    id: 'review',
    position: { x: 64, y: 68 },
    width: 74,
    height: 44,
    internals: {
      handleBounds: {
        source: [{ id: 'out', type: 'source', position: 'right', x: 70, y: 16, width: 8, height: 8 }]
      }
    }
  }],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
}, [{
  id: 'react-flow-review',
  handle: { nodeId: 'review', id: 'out', type: 'source', side: 'right' },
  note: { title: 'React Flow handle' },
  placement: { side: ['right', 'bottom'], offset: 18 },
  annotationData: { source: 'react-flow-state' }
}], {
  assert: { failOnWarnings: true, label: 'React Flow docs anchors' },
  obstacles: { includeEdges: true, padding: 4 }
});

const publicRecipeOptions: LayoutOptions = {
  annotations: [
    ...domPrepared.annotations,
    ...vegaPrepared.annotations,
    ...mermaidPrepared.annotations,
    ...d2Prepared.annotations,
    ...reactFlowPrepared.annotations
  ],
  obstacles: [
    ...domPrepared.obstacles,
    ...vegaPrepared.obstacles,
    ...mermaidPrepared.obstacles,
    ...d2Prepared.obstacles,
    ...reactFlowPrepared.obstacles
  ],
  bounds: { x: 0, y: 0, width: 420, height: 260 },
  padding: 12
};

const publicRecipeLayout = resolveAnnotationLayout(publicRecipeOptions);
const reactLayerProps: AnnotationLayerProps = {
  ...publicRecipeOptions,
  assertQuality: domGeneratedDefaults.assertQuality,
  editHandleTabIndex: 0,
  label: 'Documentation annotation layer',
  markerIdPrefix: 'docs-react',
  preserveAspectRatio: 'xMidYMid meet',
  qualityFormat: domGeneratedDefaults.qualityFormat,
  renderNote: (annotation) => annotation.annotation.note.title ?? null,
  onLayout: (layout) => {
    void layout.annotations.length;
  },
  onQuality: (event: AnnotationLayerQualityEvent) => {
    void event.quality.ok;
    void event.summary;
  }
};

void quickstartQuality.ok;
void quickstartSvg;
void publicRecipeLayout.annotations.length;
void reactLayerProps;
void AnnotationLayer;
