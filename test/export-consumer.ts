import {
  annotationParts,
  annotationEditHandles,
  annotationTransform,
  circleSubjectPath,
  connectorPathD,
  declutterLabels,
  directLabels,
  encircleCallout,
  encircleSubjectPath,
  enclosingCircle,
  annotationFromD3Style,
  annotationsFromD3Style,
  annotationsFromD3StyleCollection,
  annotationsFromD3StyleType,
  applyD3StyleAnnotationCollectionEdit,
  applyD3StyleAnnotationEdit,
  assertAnchorAlignmentReport,
  assertAnchorAlignmentReportIfRequested,
  assertAnchorValidationReport,
  assertAnchorValidationReportIfRequested,
  assertAnnotationLayoutQuality,
  annotationEditPatch,
  annotationClassName,
  annotationStyleVariables,
  applyAnnotationEdit,
  applyAnnotationEdits,
  brontoAnnotationClassName,
  createAnnotationEditDelta,
  createAnnotationEditEvent,
  createAnnotationEditSession,
  createD3StyleAnnotationBuilder,
  d3StyleAnnotationCollectionEditPatch,
  defineD3StyleAnnotationType,
  evaluateAnnotationLayout,
  evaluateAnchorAlignment,
  formatAnchorAlignmentDiagnostic,
  formatAnchorAlignmentReport,
  formatLayoutQualityIssue,
  formatLayoutQualityReport,
  formatAnchorDiagnostic,
  formatAnchorValidationReport,
  generatedSurfaceLayoutDefaults,
  refineAnnotationLayout,
  notePlacement,
  pointCallout,
  prepareD3StyleAnnotationCollection,
  resolvePreparedAnnotationLayout,
  allPlacementCandidates,
  DEFAULT_NOTE_PADDING,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  subjectPath,
  translateAnchor,
  type Annotation,
  type AnnotationBadgeOptions,
  type AnnotationConnectorOptions,
  type AnchorAlignmentAssertInput,
  type AnchorAlignmentAssertOptions,
  type AnchorAlignmentFormatOptions,
  type AnchorAlignmentOptions,
  type AnchorAlignmentReport,
  type AnchorAlignmentTarget,
  type AnchorSpecValidationReport,
  type AnchorValidationAssertInput,
  type AnchorValidationAssertOptions,
  type AnchorValidationFormatOptions,
  type ConnectorPointMode,
  type ConnectorRoutingContext,
  type ConnectorRoutingMode,
  type ConnectorRoutingOptions,
  type ConnectorRoutingPreference,
  type GeneratedSurfaceLayoutDefaults,
  type GeneratedSurfaceLayoutDefaultsOptions,
  type AnnotationEditHandle,
  type AnnotationEditEvent,
  type AnnotationEditHandlePosition,
  type AnnotationEditPhase,
  type AnnotationEditPatch,
  type AnnotationEditSession,
  type AnnotationEditSuggestion,
  type CreateAnnotationEditDeltaOptions,
  type CreateAnnotationEditEventOptions,
  type CreateAnnotationEditSessionOptions,
  type AnnotationClassNameInput,
  type AnnotationClassNameValue,
  type ApplyAnnotationEditOptions,
  type AnnotationParts,
  type AnnotationMetadata,
  type AnnotationMotion,
  type AnnotationNoteAlign,
  type AnnotationNoteLineOptions,
  type AnnotationStyle,
  type AnnotationStyleVariableName,
  type AnnotationStyleVariables,
  type AnnotationSubjectGeometry,
  type AnnotationSubjectGeometrySpace,
  type AnnotationTone,
  type AnnotationVariant,
  type DataAttributes,
  type D3AnnotationConnector,
  type D3AnnotationDisablePart,
  type D3AnnotationAlign,
  type D3AnnotationBadgeX,
  type D3AnnotationBadgeY,
  type D3AnnotationInverseAccessor,
  type D3AnnotationLineType,
  type D3AnnotationNote,
  type D3AnnotationOrientation,
  type D3AnnotationSubjectPoint,
  type D3AnnotationSubject,
  type D3AnnotationType,
  type D3StyleAnnotationBuilder,
  type D3StyleAnnotationBuilderInput,
  type D3StyleAnnotationCollectionEditPatch,
  type D3StyleAnnotationCollectionId,
  type D3StyleAnnotationCollectionInput,
  type D3StyleCustomAnnotationContext,
  type D3StyleCustomAnnotationDefinition,
  type D3StyleCustomAnnotationType,
  type D3StyleAnnotationEditOptions,
  type D3StyleAnnotationEditPatch,
  type D3StyleAnnotationInput,
  type D3StyleAnnotationOptions,
  type DirectLabel,
  type EncircleCalloutOptions,
  type EncircleSubjectPathOptions,
  type EnclosingCircle,
  type ManualPlacement,
  type LayoutRefinementOptions,
  type LayoutQualityAssertOptions,
  type LayoutQualityFormatOptions,
  type Padding,
  type PaddingInput,
  type PreparedAnnotationLayoutOptions,
  type PreparedAnnotationLayoutResult,
  type PreparedD3StyleAnnotationCollection
} from '@ponchia/annotations';
import {
  AnnotationLayer,
  useAnnotations,
  type AnnotationLayerEditEvent,
  type AnnotationLayerQualityEvent,
  type AnnotationLayerTargetAlignmentEvent,
  type AnnotationLayerProps
} from '@ponchia/annotations/react';
import {
  anchorFromBox,
  anchorFromDOMRect,
  anchorFromElement,
  anchorFromId,
  anchorFromSelector,
  anchorsFromSelectors,
  annotationFrameFromSvg,
  annotationsFromDomSelectors,
  boxFromDOMRect,
  boxFromElement,
  boxFromSvgElement,
  clientBoxToSvgBox,
  obstaclesFromElements,
  obstaclesFromSelector,
  obstaclesFromSelectors,
  prepareDomAnnotations,
  svgPointFromClient,
  validateDomAnchors,
  type DomAnnotationLayerInput,
  type DomAnnotationSpec,
  type DomAnchorValidationReport,
  type ElementAnchorOptions,
  type ExtractedAnchor,
  type SelectorObstacleSpec
} from '@ponchia/annotations/dom';
import {
  annotationsFromVegaScenegraph,
  annotationsFromVegaScales,
  annotationsFromVegaView,
  anchorsFromVegaView,
  anchorsFromVegaScales,
  anchorsFromVegaScenegraph,
  anchorsFromVegaSvg,
  annotationsFromVegaSvg,
  findVegaSvgElement,
  obstaclesFromVegaScales,
  obstaclesFromVegaScenegraph,
  obstaclesFromVegaSvg,
  obstaclesFromVegaView,
  prepareVegaScaleAnnotations,
  prepareVegaScenegraphAnnotations,
  prepareVegaSvgAnnotations,
  prepareVegaViewAnnotations,
  validateVegaScaleAnchors,
  validateVegaScenegraphAnchors,
  validateVegaSvgAnchors,
  validateVegaViewAnchors,
  type VegaAnchorResult,
  type VegaAnchorValidationReport,
  type VegaAnnotationLayerInput,
  type VegaScaleObstacleOptions,
  type VegaScenegraphAnchorSpec,
  type VegaScenegraphObstacleOptions,
  type VegaSvgAnchorSpec,
  type VegaSvgAnnotationSpec,
  type VegaSvgObstacleOptions,
  type VegaViewAnchorSpec,
  type VegaViewObstacleOptions
} from '@ponchia/annotations/vega';
import {
  annotationsFromMermaidSvg,
  anchorsFromMermaidSvg,
  findMermaidElement,
  formatAnchorValidationReport as formatMermaidAnchorValidationReport,
  obstaclesFromMermaidSvg,
  prepareMermaidAnnotations,
  validateMermaidSvgAnchors,
  type MermaidAnchorResult,
  type MermaidAnchorValidationReport,
  type MermaidAnnotationLayerInput,
  type MermaidAnchorSpec
} from '@ponchia/annotations/mermaid';
import {
  annotationsFromD2Diagram,
  annotationsFromD2Svg,
  anchorsFromD2Diagram,
  anchorsFromD2Svg,
  findD2SvgElement,
  obstaclesFromD2Diagram,
  obstaclesFromD2Svg,
  prepareD2DiagramAnnotations,
  prepareD2SvgAnnotations,
  validateD2DiagramAnchors,
  validateD2SvgAnchors,
  type D2AnchorResult,
  type D2AnnotationLayerInput,
  type D2AnchorValidationReport,
  type D2DiagramAnchorSpec,
  type D2LabelMatch,
  type D2SvgAnchorSpec,
  type D2SvgObstacleOptions
} from '@ponchia/annotations/d2';
import {
  annotationsFromReactFlow,
  anchorsFromReactFlow,
  handleBox,
  handlePoint,
  nodeBox,
  obstaclesFromReactFlow,
  prepareReactFlowAnnotations,
  validateReactFlowAnchors,
  type ReactFlowAnnotationLayerInput,
  type ReactFlowAnchorResult,
  type ReactFlowAnchorValidationReport,
  type ReactFlowHandleLike,
  type ReactFlowObstacleOptions,
  type ReactFlowAnchorSpec
} from '@ponchia/annotations/react-flow';
import '@ponchia/annotations/bronto.css';

const styleVariableName: AnnotationStyleVariableName = '--custom-annotation-token';
const annotationStyle: AnnotationStyle = {
  color: '#d12f6a',
  lineColor: '#7c2d12',
  vars: { [styleVariableName]: 'demo' }
};
const annotationStyleVars: AnnotationStyleVariables = annotationStyleVariables(annotationStyle);
const annotations: Annotation[] = [
  {
    id: 'typed',
    anchor: { type: 'point', point: { x: 10, y: 20 } },
    note: {
      title: 'Typed',
      data: { role: 'type-check' } satisfies DataAttributes,
      metadata: { source: 'fixture' } satisfies AnnotationMetadata
    },
    subject: {
      path: circleSubjectPath({ radius: 6 }),
      data: { helper: 'subject-path' }
    },
    variant: 'circle',
    tone: 'warning',
    motion: 'draw',
    style: annotationStyle,
    metadata: { owner: 'consumer' } satisfies AnnotationMetadata
  }
];
const padding: Padding = { top: 1, right: 2, bottom: 3, left: 4 };
const paddingInput: PaddingInput = { top: 2, left: 2 };
const elementAnchorOptions: ElementAnchorOptions = { kind: 'point', inflate: 2 };
const domAnnotationSpec: DomAnnotationSpec = { selector: '#target', note: { title: 'DOM' } };
const selectorObstacleSpec: SelectorObstacleSpec = { selector: '.host-obstacle', inflate: 2 };
const variant: AnnotationVariant = 'badge';
const tone: AnnotationTone = 'accent';
const motion: AnnotationMotion = 'reveal';
const noteAlign: AnnotationNoteAlign = 'center';
const noteLine: AnnotationNoteLineOptions = { length: 96, offset: 8 };
const badgeOptions: AnnotationBadgeOptions = { label: '1', radius: 10, x: 'right', y: 'top' };
const editHandlePosition: AnnotationEditHandlePosition = 'bottom-right';
const manualPlacement: ManualPlacement = { x: 24, y: 32, side: 'right' };
const refinementOptions: LayoutRefinementOptions = { passes: 1, maxCandidatesPerAnnotation: 8 };
const editSuggestion: AnnotationEditSuggestion = {
  annotationId: 'typed',
  suggestedPlacement: { manual: manualPlacement }
};
const editPatch: AnnotationEditPatch = annotationEditPatch(editSuggestion);
const editApplyOptions: ApplyAnnotationEditOptions = { missing: 'ignore' };
const annotationClassInput: AnnotationClassNameInput = {
  variant,
  tone,
  motion,
  className: ['typed-extra'] satisfies AnnotationClassNameValue
};
const annotationPartsResult: AnnotationParts = annotationParts({
  dx: 24,
  dy: 12,
  subject: { type: 'circle', radius: 8 }
});
const connectorOptions: AnnotationConnectorOptions = {
  type: 'curve',
  end: 'arrow',
  pointMode: 'absolute',
  points: [{ x: 12, y: 8 }],
  routing: { mode: 'orthogonal', padding: 6 },
  startOffset: 4,
  endOffset: 8
};
const connectorPointMode: ConnectorPointMode = 'relative';
const connectorRoutingMode: ConnectorRoutingMode = 'orthogonal';
const connectorRoutingPreference: ConnectorRoutingPreference = 'horizontal';
const connectorRoutingOptions: ConnectorRoutingOptions = { mode: connectorRoutingMode, preference: connectorRoutingPreference };
const connectorRoutingContext: ConnectorRoutingContext = {
  bounds: { x: 0, y: 0, width: 160, height: 120 },
  obstacles: [{ x: 40, y: 40, width: 20, height: 20 }]
};
const directLabelResults: Array<DirectLabel<string>> = directLabels([
  { key: 'typed', anchor: { x: 10, y: 20 }, size: 12 }
], { cross: 100 });
const annotationSubjectGeometry: AnnotationSubjectGeometry = {
  type: 'bracket',
  x1: -20,
  y1: 0,
  x2: 20,
  y2: 0
};
const encirclePathOptions: EncircleSubjectPathOptions = {
  points: [
    { x: 10, y: 20 },
    { x: 30, y: 20 }
  ],
  radius: 2,
  padding: 4
};
const d3SubjectPoint: D3AnnotationSubjectPoint = [30, 20];
const encircleCircle: EnclosingCircle = enclosingCircle(encirclePathOptions.points);
const encircleOptions: EncircleCalloutOptions = {
  id: 'encircle-preset',
  points: [{ x: 10, y: 20 }, { x: 30, y: 20 }],
  pointRadius: 2,
  padding: 4,
  note: { title: 'Encircle' }
};
const annotationSubjectGeometrySpace: AnnotationSubjectGeometrySpace = 'anchor';
const structuredSubjectAnnotation: Annotation = {
  id: 'structured-subject',
  anchor: { type: 'point', point: { x: 20, y: 30 } },
  note: { title: 'Structured' },
  subject: {
    geometry: annotationSubjectGeometry,
    geometrySpace: annotationSubjectGeometrySpace
  }
};
const vegaSvgSpec: VegaSvgAnchorSpec = {
  id: 'points',
  markName: 'points',
  markType: 'symbol',
  role: 'mark'
};
const vegaSvgAnnotationSpec: VegaSvgAnnotationSpec = {
  ...vegaSvgSpec,
  note: { title: 'Rendered mark' },
  variant: 'badge',
  tone: 'info',
  motion: 'reveal',
  style: { color: '#2563eb' },
  priority: 2,
  annotationClassName: 'typed-vega-note',
  annotationData: { consumer: 'typed-chart' },
  metadata: { typed: true }
};
const vegaScenegraphObstacleOptions: VegaScenegraphObstacleOptions = {
  role: 'axis',
  padding: 2
};
const vegaSvgObstacleOptions: VegaSvgObstacleOptions = {
  markName: 'points',
  padding: 2
};
const d2SvgSpec: D2SvgAnchorSpec = {
  id: 'edge-note',
  connectionId: 'process-output',
  kind: 'path',
  variant: 'elbow',
  tone: 'warning',
  motion: 'draw',
  style: { lineColor: '#ca8a04' },
  annotationClassName: 'typed-d2-note',
  annotationData: { consumer: 'typed-diagram' },
  metadata: { typed: true }
};
const d2SvgObstacleOptions: D2SvgObstacleOptions = {
  includeConnections: true,
  padding: 2
};
const d2LabelMatch: D2LabelMatch = 'contains';
const mermaidSpec: MermaidAnchorSpec = {
  id: 'typed-mermaid',
  className: 'important-node',
  data: { nodeId: 'typed' },
  edgeSourceId: 'typed-source',
  edgeTargetId: 'typed-target',
  labelMatch: 'contains',
  variant: 'callout',
  tone: 'accent',
  motion: 'pulse',
  style: { noteBackground: '#eef2ff' },
  annotationClassName: 'typed-mermaid-note',
  annotationData: { consumer: 'typed-diagram' },
  metadata: { typed: true }
};
const reactFlowHandle: ReactFlowHandleLike = {
  id: 'typed-handle',
  type: 'source',
  position: 'right',
  x: 8,
  y: 4,
  width: 10,
  height: 10
};
const reactFlowObstacleOptions: ReactFlowObstacleOptions = {
  includeHandles: true,
  includeEdges: true,
  padding: 2,
  handle: (handle) => handle.id === 'typed-handle'
};
const reactFlowEdgeAnchorResult: ReactFlowAnchorResult = {
  id: 'typed-edge',
  anchor: { type: 'path', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
  box: { x: 0, y: 0, width: 10, height: 10 },
  point: { x: 10, y: 10 },
  source: 'react-flow-edge',
  edgeId: 'typed-edge',
  sourceNodeId: 'source',
  targetNodeId: 'target',
  sourceHandleId: 'out',
  targetHandleId: 'in'
};
const mermaidEdgeAnchorResult: MermaidAnchorResult = {
  id: 'typed-mermaid-edge',
  anchor: { type: 'path', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
  box: { x: 0, y: 0, width: 10, height: 10 },
  point: { x: 10, y: 10 },
  element: {} as Element,
  source: 'mermaid-svg',
  mermaidKind: 'edge',
  edgeSourceId: 'typed-source',
  edgeTargetId: 'typed-target'
};
const d3AnnotationType: D3AnnotationType = 'annotationCalloutCircle';
const d3AnnotationAlign: D3AnnotationAlign = 'middle';
const d3AnnotationOrientation: D3AnnotationOrientation = 'leftRight';
const d3AnnotationLineType: D3AnnotationLineType = 'vertical';
const d3BadgeX: D3AnnotationBadgeX = 'right';
const d3BadgeY: D3AnnotationBadgeY = 'top';
const d3Connector: D3AnnotationConnector = {
  type: 'curve',
  points: [[12, -8]],
  end: 'arrow',
  className: 'typed-d3-connector',
  data: { connectorKind: 'typed' }
};
const d3Note: D3AnnotationNote = {
  title: 'D3',
  label: 'Compatible',
  wrap: 24,
  wrapSplitter: /[,;]/,
  align: d3AnnotationAlign,
  orientation: d3AnnotationOrientation,
  lineType: d3AnnotationLineType,
  className: 'typed-d3-note',
  data: { noteKind: 'typed' },
  metadata: { source: 'typed-d3' }
};
const d3Subject: D3AnnotationSubject = {
  radius: 8,
  radiusPadding: 2,
  points: [{ x: 10, y: 20 }, d3SubjectPoint],
  className: 'typed-d3-subject',
  data: { subjectKind: 'typed' }
};
const d3BadgeSubject: D3AnnotationSubject = {
  text: 'B',
  radius: 9,
  x: d3BadgeX,
  y: d3BadgeY,
  className: 'typed-d3-badge',
  data: { badgeKind: 'typed' }
};
const d3NegativeRectSubject: D3AnnotationSubject = { x: 0, y: 0, width: -54, height: -28 };
const d3Disable: D3AnnotationDisablePart = 'connector';
const d3StyleInput: D3StyleAnnotationInput<{ x: number; y: number }> = {
  id: 'd3-style',
  type: d3AnnotationType,
  data: { x: 18, y: 22 },
  annotationData: { hook: 'typed-d3' },
  dx: 40,
  dy: -12,
  nx: 100,
  ny: 40,
  note: d3Note,
  subject: d3Subject,
  connector: d3Connector,
  style: annotationStyle,
  metadata: { typed: true }
};
const d3StyleOptions: D3StyleAnnotationOptions<{ x: number; y: number }> = {
  x: 'x',
  y: (datum) => datum.y
};
const d3CollectionIds: D3StyleAnnotationCollectionId<{ x: number; y: number }> = (annotation, index) =>
  annotation.id ?? `typed-d3-collection-${index + 1}`;
const d3StyleCollection: D3StyleAnnotationCollectionInput<{ x: number; y: number }> = {
  annotations: [d3StyleInput],
  type: d3AnnotationType,
  accessors: d3StyleOptions,
  accessorsInverse: {
    x: 'x',
    y: (value) => ({ y: value })
  },
  ids: d3CollectionIds,
  editMode: true,
  notePadding: 4,
  textWrap: 28
};
const d3StyleBuilderInput: D3StyleAnnotationBuilderInput<{ x: number; y: number }> = {
  type: d3AnnotationType,
  accessors: d3StyleOptions
};
const d3StyleBuilder: D3StyleAnnotationBuilder<{ x: number; y: number }> =
  createD3StyleAnnotationBuilder(d3StyleBuilderInput)
    .annotations([d3StyleInput])
    .editMode(true)
    .notePadding(4);
const d3PreparedCollection: PreparedD3StyleAnnotationCollection<{ x: number; y: number }> =
  prepareD3StyleAnnotationCollection(d3StyleCollection);
const d3InverseAccessor: D3AnnotationInverseAccessor<{ x: number; y: number }> = 'x';
const d3StyleEditOptions: D3StyleAnnotationEditOptions<{ x: number; y: number }> = {
  ...d3StyleOptions,
  accessorsInverse: {
    x: d3InverseAccessor,
    y: (value) => ({ y: value })
  }
};
const d3StyleEditPatch: D3StyleAnnotationEditPatch<{ x: number; y: number }> = {
  data: { x: 24, y: 32 },
  dx: 12,
  dy: -8,
  nx: 36,
  ny: 44
};
const d3StyleCollectionEditPatchResult: D3StyleAnnotationCollectionEditPatch<{ x: number; y: number }> =
  d3StyleAnnotationCollectionEditPatch(d3StyleCollection, {
    annotationId: 'd3-style',
    suggestedAnchor: { type: 'point', point: { x: 24, y: 32 } }
  });
const validationFormatOptions: AnchorValidationFormatOptions = {
  label: 'Typed anchors',
  maxDiagnostics: 2
};
const validationAssertOptions: AnchorValidationAssertOptions = {
  ...validationFormatOptions,
  failOnWarnings: true
};
const validationAssertInput: AnchorValidationAssertInput = validationAssertOptions;
const typedValidationReport: AnchorSpecValidationReport = {
  ok: true,
  found: ['typed'],
  warnings: [],
  missing: [],
  diagnostics: [{
    id: 'typed',
    source: 'typed-source',
    status: 'found',
    expected: 'selector ".typed"',
    found: true
  }]
};
const alignmentFormatOptions: AnchorAlignmentFormatOptions = {
  label: 'Typed alignment',
  includeAligned: true,
  maxDiagnostics: 2
};
const alignmentAssertOptions: AnchorAlignmentAssertOptions = {
  ...alignmentFormatOptions,
  failOnWarnings: true
};
const alignmentAssertInput: AnchorAlignmentAssertInput = alignmentAssertOptions;
const alignmentTargets: AnchorAlignmentTarget[] = [{
  id: 'typed',
  point: { x: 10, y: 20 },
  tolerance: 1
}];
const typedAlignmentReport: AnchorAlignmentReport = evaluateAnchorAlignment(annotations, alignmentTargets, {
  minOverlapRatio: 0.75
});
const d3StyleCustomDefinition: D3StyleCustomAnnotationDefinition<{ x: number; y: number }> = {
  baseType: 'annotationCalloutRect',
  defaults: {
    dx: 24,
    dy: -12,
    subject: { width: 20, height: 10, x: -10, y: -5 },
    note: { lineType: 'vertical' }
  },
  transform: (annotation, context: D3StyleCustomAnnotationContext<{ x: number; y: number }>) => ({
    ...annotation,
    variant: 'band',
    metadata: {
      ...annotation.metadata,
      index: context.index
    }
  })
};
const d3StyleCustomType: D3StyleCustomAnnotationType<{ x: number; y: number }> =
  defineD3StyleAnnotationType(d3StyleCustomDefinition);
const vegaValidation: VegaAnchorValidationReport = validateVegaViewAnchors({
  data: () => [{ id: 'typed', x: 1, y: 2 }]
}, [
  { id: 'typed', x: 'x', y: 'y' }
]);
const mermaidValidation: MermaidAnchorValidationReport = {
  ok: true,
  found: [],
  warnings: [],
  missing: [],
  diagnostics: []
};
const d2Validation: D2AnchorValidationReport = validateD2DiagramAnchors({
  shapes: [{ id: 'typed', pos: { x: 0, y: 0 }, width: 10, height: 10 }]
}, [
  { id: 'typed-note', shapeId: 'typed' }
]);
const reactFlowValidation: ReactFlowAnchorValidationReport = validateReactFlowAnchors({
  nodes: [{ id: 'typed', position: { x: 0, y: 0 }, width: 10, height: 10 }]
}, [
  { id: 'typed-note', nodeId: 'typed' }
]);
const vegaPrepared: VegaAnnotationLayerInput = {
  annotations,
  obstacles: [],
  validation: vegaValidation
};
const mermaidPrepared: MermaidAnnotationLayerInput = {
  annotations,
  obstacles: [],
  validation: mermaidValidation
};
const d2Prepared: D2AnnotationLayerInput = {
  annotations,
  obstacles: [],
  validation: d2Validation
};
const reactFlowPrepared: ReactFlowAnnotationLayerInput = {
  annotations,
  obstacles: [],
  validation: reactFlowValidation
};
const adapterRoot = {} as ParentNode;
const domValidation: DomAnchorValidationReport = validateDomAnchors(adapterRoot, [domAnnotationSpec]);
const domPrepared: DomAnnotationLayerInput = prepareDomAnnotations(adapterRoot, [domAnnotationSpec], {
  obstacles: [selectorObstacleSpec],
  assert: validationAssertInput
});
annotationsFromDomSelectors(adapterRoot, [domAnnotationSpec]);
prepareVegaScenegraphAnnotations({
  scenegraph: () => ({ root: { items: [] } })
}, [], { obstacles: vegaScenegraphObstacleOptions, assert: true });
prepareVegaSvgAnnotations(adapterRoot, [vegaSvgAnnotationSpec], { obstacles: vegaSvgObstacleOptions, assert: validationAssertInput });
prepareMermaidAnnotations(adapterRoot, [mermaidSpec], { assert: true });
prepareD2DiagramAnnotations({ shapes: [] }, [], { assert: true });
prepareD2SvgAnnotations(adapterRoot, [d2SvgSpec], { obstacles: d2SvgObstacleOptions, assert: validationAssertInput });
prepareReactFlowAnnotations({ nodes: [] }, [], { obstacles: reactFlowObstacleOptions, assert: true });
void vegaPrepared;
void mermaidPrepared;
void d2Prepared;
void reactFlowPrepared;
void domValidation;
void domPrepared;

const layout = resolveAnnotationLayout({
  annotations: [
    ...annotations.map((annotation) => ({
      ...annotation,
      placement: { manual: manualPlacement }
    })),
    structuredSubjectAnnotation
  ],
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  refinement: refinementOptions
});
refineAnnotationLayout(layout, true);
const editHandles: AnnotationEditHandle[] = annotationEditHandles(layout);
const editPhase: AnnotationEditPhase = 'move';
const editEventOptions: CreateAnnotationEditEventOptions = {
  annotation: layout.annotations[0]!,
  handle: editHandles[0]!,
  origin: editHandles[0]!.point,
  point: { x: editHandles[0]!.point.x + 4, y: editHandles[0]!.point.y + 6 },
  phase: editPhase
};
const authoringEditEvent: AnnotationEditEvent = createAnnotationEditEvent(editEventOptions);
const editDeltaOptions: CreateAnnotationEditDeltaOptions = {
  annotation: layout.annotations[0]!,
  handle: editHandles[0]!,
  delta: { x: 2, y: 3 },
  phase: 'end'
};
createAnnotationEditDelta(editDeltaOptions);
const editSessionOptions: CreateAnnotationEditSessionOptions = {
  layout,
  handle: editHandles[0]!
};
const editSession: AnnotationEditSession = createAnnotationEditSession(editSessionOptions);
applyAnnotationEdits(annotations, editSession.end({ x: editSession.origin.x + 2, y: editSession.origin.y + 3 }));
const editedAnnotation = applyAnnotationEdit(annotations[0]!, editPatch);
applyAnnotationEdits([editedAnnotation], editSuggestion, editApplyOptions);
applyAnnotationEdits([editedAnnotation], authoringEditEvent, editApplyOptions);
annotationClassName(annotationClassInput);
brontoAnnotationClassName({ variant: 'bracket', tone: 'info', motion: 'draw' });
formatAnchorDiagnostic(typedValidationReport.diagnostics[0]!);
formatAnchorValidationReport(typedValidationReport, validationFormatOptions);
formatMermaidAnchorValidationReport(typedValidationReport);
assertAnchorValidationReport(typedValidationReport, validationAssertOptions);
assertAnchorValidationReportIfRequested(typedValidationReport, validationAssertInput);
formatAnchorAlignmentReport(typedAlignmentReport, alignmentFormatOptions);
formatAnchorAlignmentDiagnostic(typedAlignmentReport.diagnostics[0]!);
assertAnchorAlignmentReport(typedAlignmentReport, alignmentAssertOptions);
assertAnchorAlignmentReportIfRequested(typedAlignmentReport, alignmentAssertInput);

renderAnnotationsSvg(layout, {
  editHandleTabIndex: 0,
  includeEditHandles: true,
  includeQualityIssues: true,
  markerIdPrefix: 'typed-layer',
  noteTabIndex: 0,
  preserveAspectRatio: 'xMinYMin meet'
});
subjectPath(annotationSubjectGeometry);
encircleSubjectPath(encirclePathOptions);
void encircleCircle;
const qualityReport = evaluateAnnotationLayout(layout);
const qualityAssertOptions: LayoutQualityAssertOptions = { label: 'typed layout', minScore: 90 };
const qualityFormatOptions: LayoutQualityFormatOptions = { includeInfo: true, maxIssues: 4 };
const targetAlignmentOptions: AnchorAlignmentOptions = { minOverlapRatio: 0.9, tolerance: 1 };
const targetAlignmentFormatOptions: AnchorAlignmentFormatOptions = { includeAligned: true, label: 'typed target alignment' };
const targetAlignmentTargets: AnchorAlignmentTarget[] = [{
  id: 'typed',
  expected: 'typed target point',
  point: { x: 10, y: 20 }
}];
formatLayoutQualityReport(qualityReport, qualityFormatOptions);
if (qualityReport.issues[0]) {
  formatLayoutQualityIssue(qualityReport.issues[0]);
}
assertAnnotationLayoutQuality(qualityReport, qualityAssertOptions);
const generatedDefaultsOptions: GeneratedSurfaceLayoutDefaultsOptions = {
  anchorLabel: 'typed prepared anchors',
  failOnWarnings: true,
  includeInfo: true,
  layoutLabel: 'typed prepared layout'
};
const generatedDefaults: GeneratedSurfaceLayoutDefaults = generatedSurfaceLayoutDefaults(generatedDefaultsOptions);
const preparedLayoutOptions: PreparedAnnotationLayoutOptions = {
  ...generatedDefaults,
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  assertQuality: true,
  assertTargetAlignment: { label: 'typed target alignment', failOnWarnings: true },
  targetAlignmentTargets,
  targetAlignmentOptions,
  targetAlignmentFormat: targetAlignmentFormatOptions,
  validationFormat: { ...generatedDefaults.validationFormat, includeFound: true }
};
const preparedLayout: PreparedAnnotationLayoutResult = resolvePreparedAnnotationLayout({
  annotations,
  obstacles: [],
  validation: typedValidationReport
}, preparedLayoutOptions);
void preparedLayout.validationSummary;
void preparedLayout.targetAlignment;
void preparedLayout.targetAlignmentSummary;
void preparedLayout.qualitySummary;
connectorPathD({ x: 0, y: 0 }, { x: 10, y: 10, width: 20, height: 20 }, connectorOptions);
connectorPathD(
  { x: 0, y: 50 },
  { x: 100, y: 40, width: 40, height: 20 },
  { type: 'straight', routing: connectorRoutingOptions },
  connectorRoutingContext
);
annotationTransform({ x: 1, y: 2 });
circleSubjectPath({ radius: 8 });
notePlacement({
  x: 10,
  y: 20,
  width: 40,
  height: 20,
  bounds: { x: 0, y: 0, width: 100, height: 100 }
});
declutterLabels([{ pos: 10, size: 12 }]);
translateAnchor({ type: 'point', point: { x: 1, y: 2 } }, { x: 3, y: 4 });
const preset = pointCallout({
  id: 'preset',
  point: { x: 10, y: 20 },
  note: { title: 'Preset' },
  style: annotationStyle
});
const encirclePreset = encircleCallout(encircleOptions);
annotationFromD3Style({ id: 'disabled-d3', x: 1, y: 2, disable: [d3Disable] });
annotationFromD3Style({ id: 'negative-rect-d3', type: 'annotationCalloutRect', x: 1, y: 2, subject: d3NegativeRectSubject });
annotationFromD3Style({ id: 'badge-d3', type: 'annotationBadge', x: 1, y: 2, subject: d3BadgeSubject });
annotationsFromD3Style([d3StyleInput], d3StyleOptions);
annotationsFromD3StyleCollection(d3StyleCollection);
d3StyleBuilder.toAnnotations();
d3StyleBuilder.applyEdit({
  annotationId: 'd3-style',
  suggestedAnchor: { type: 'point', point: { x: 24, y: 32 } }
});
annotationsFromD3StyleType(d3StyleCustomType, [d3StyleInput], d3StyleOptions);
applyD3StyleAnnotationCollectionEdit(d3StyleCollection, {
  annotationId: 'd3-style',
  suggestedAnchor: { type: 'point', point: { x: 24, y: 32 } },
  suggestedPlacement: { manual: { x: 44, y: 20 } }
});
applyD3StyleAnnotationEdit(d3StyleInput, {
  annotationId: 'd3-style',
  suggestedAnchor: { type: 'point', point: { x: 24, y: 32 } },
  suggestedPlacement: { manual: { x: 44, y: 20 } }
}, d3StyleEditOptions);
void d3PreparedCollection;
void d3StyleBuilder;
void d3StyleEditPatch;
void d3StyleCollectionEditPatchResult;
allPlacementCandidates({
  annotation: preset,
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  noteSize: { width: 40, height: 20 },
  obstacles: [],
  placedNotes: [],
  placement: { maxCandidates: 2 }
});
allPlacementCandidates({
  annotation: encirclePreset,
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  noteSize: { width: 40, height: 20 },
  obstacles: [],
  placedNotes: [],
  placement: { maxCandidates: 2 }
});

const props: AnnotationLayerProps = {
  annotations,
  assertQuality: generatedDefaults.assertQuality,
  bounds: { x: 0, y: 0, width: 100, height: 100 },
  editable: { includeAnchor: true, noteHandlePosition: editHandlePosition, keyboardStep: 2, keyboardLargeStep: 12 },
  editHandleTabIndex: -1,
  qualityDebug: true,
  onEdit: (event: AnnotationLayerEditEvent) => {
    void event.suggestedPlacement?.manual.x;
    void event.suggestedAnchor?.type;
    void event.suggestedAnnotation?.id;
  },
  onQuality: (event: AnnotationLayerQualityEvent) => {
    void event.quality.ok;
    void event.summary;
    void event.layout.annotations.length;
  },
  markerIdPrefix: 'typed-layer',
  noteTabIndex: 0,
  preserveAspectRatio: 'xMinYMin meet',
  qualityFormat: generatedDefaults.qualityFormat,
  assertTargetAlignment: { label: 'typed React target alignment', failOnWarnings: true },
  targetAlignmentTargets,
  targetAlignmentOptions,
  targetAlignmentFormat: targetAlignmentFormatOptions,
  onTargetAlignment: (event: AnnotationLayerTargetAlignmentEvent) => {
    void event.targetAlignment.ok;
    void event.summary;
    void event.layout.annotations.length;
  }
};

void AnnotationLayer;
void useAnnotations;
void props;
void padding;
void paddingInput;
void elementAnchorOptions;
void selectorObstacleSpec;
void variant;
void tone;
void motion;
void noteAlign;
void noteLine;
void badgeOptions;
void annotationStyleVars;
void editHandlePosition;
void DEFAULT_NOTE_PADDING;
void manualPlacement;
void annotationPartsResult;
void connectorOptions;
void connectorPointMode;
void directLabelResults;
void editHandles;
void vegaValidation;
void mermaidValidation;
void d2Validation;
void reactFlowValidation;
void anchorFromDOMRect({
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  left: 0,
  top: 0,
  right: 10,
  bottom: 10
});
void boxFromDOMRect({ left: 0, top: 0, right: 10, bottom: 10 });
void anchorFromBox({ x: 0, y: 0, width: 10, height: 10 });
void anchorFromElement;
void anchorFromId;
void anchorFromSelector;
void anchorsFromSelectors;
void boxFromElement;
void boxFromSvgElement;
void annotationFrameFromSvg;
void clientBoxToSvgBox;
void obstaclesFromElements;
void obstaclesFromSelector;
void obstaclesFromSelectors;
void svgPointFromClient;
void anchorsFromVegaView({ data: () => [{ id: 'typed', x: 10, y: 20 }] }, [
  { id: 'typed', x: 'x', y: 'y' } satisfies VegaViewAnchorSpec<{ id: string; x: number; y: number }>
]);
void annotationsFromVegaView({ data: () => [{ id: 'typed', x: 10, y: 20 }] }, [
  { id: 'typed', x: 'x', y: 'y' } satisfies VegaViewAnchorSpec<{ id: string; x: number; y: number }>
]);
void prepareVegaViewAnnotations({ data: () => [{ id: 'typed', x: 10, y: 20, width: 4, height: 6 }] }, [
  { id: 'typed', x: 'x', y: 'y', width: 'width', height: 'height' } satisfies VegaViewAnchorSpec<{ id: string; x: number; y: number; width: number; height: number }>
]);
void obstaclesFromVegaView({ data: () => [{ id: 'typed', x: 10, y: 20, width: 4, height: 6 }] }, {
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height'
} satisfies VegaViewObstacleOptions<{ id: string; x: number; y: number; width: number; height: number }>);
void anchorsFromVegaScales({
  data: () => [{ id: 'typed', x: 1, y: 2 }],
  scale: () => (value: unknown) => Number(value)
}, [
  { id: 'typed', xScale: 'x', yScale: 'y', x: 'x', y: 'y' }
]);
void annotationsFromVegaScales({
  data: () => [{ id: 'typed', x: 1, y: 2 }],
  scale: () => (value: unknown) => Number(value)
}, [
  { id: 'typed', xScale: 'x', yScale: 'y', x: 'x', y: 'y' }
]);
void prepareVegaScaleAnnotations({
  data: () => [{ id: 'typed', x: 1, y: 2, width: 4, height: 6 }],
  scale: () => (value: unknown) => Number(value)
}, [
  { id: 'typed', xScale: 'x', yScale: 'y', x: 'x', y: 'y', width: 'width', height: 'height' }
]);
void obstaclesFromVegaScales({
  data: () => [{ id: 'typed', x: 1, y: 2, width: 4, height: 6 }],
  scale: () => (value: unknown) => Number(value)
}, {
  xScale: 'x',
  yScale: 'y',
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height'
} satisfies VegaScaleObstacleOptions<{ id: string; x: number; y: number; width: number; height: number }>);
void validateVegaScaleAnchors;
void anchorsFromVegaScenegraph({
  scenegraph: () => ({ root: { items: [{ mark: { name: 'typed' }, bounds: { x1: 0, y1: 0, x2: 10, y2: 10 } }] } })
}, [
  { id: 'typed', markName: 'typed' } satisfies VegaScenegraphAnchorSpec
]);
void validateVegaScenegraphAnchors;
void annotationsFromVegaScenegraph({
  scenegraph: () => ({ root: { items: [{ mark: { name: 'typed' }, bounds: { x1: 0, y1: 0, x2: 10, y2: 10 } }] } })
}, [
  { id: 'typed', markName: 'typed' } satisfies VegaScenegraphAnchorSpec
]);
void obstaclesFromVegaScenegraph({
  scenegraph: () => ({ root: { items: [{ mark: { name: 'typed' }, bounds: { x1: 0, y1: 0, x2: 10, y2: 10 } }] } })
}, { markName: 'typed' });
void anchorsFromVegaSvg;
void annotationsFromVegaSvg;
void findVegaSvgElement;
void obstaclesFromVegaSvg;
void validateVegaSvgAnchors;
void vegaSvgSpec;
void vegaSvgObstacleOptions;
void d2SvgSpec;
void d2LabelMatch;
void anchorsFromD2Diagram({ shapes: [{ id: 'typed', pos: { x: 0, y: 0 }, width: 10, height: 10 }] }, [
  { id: 'typed-note', shapeId: 'typed' } satisfies D2DiagramAnchorSpec,
  { id: 'typed-label-note', label: 'Typed', labelMatch: d2LabelMatch } satisfies D2DiagramAnchorSpec
]);
void annotationsFromD2Diagram({ shapes: [{ id: 'typed', pos: { x: 0, y: 0 }, width: 10, height: 10 }] }, [
  { id: 'typed-note', shapeId: 'typed' } satisfies D2DiagramAnchorSpec,
  { id: 'typed-label-note', label: 'Typed', labelMatch: d2LabelMatch } satisfies D2DiagramAnchorSpec
]);
void obstaclesFromD2Diagram({ shapes: [{ id: 'typed', pos: { x: 0, y: 0 }, width: 10, height: 10 }] });
void anchorsFromD2Svg;
void annotationsFromD2Svg;
void findD2SvgElement;
void obstaclesFromD2Svg;
void validateD2SvgAnchors;
void d2SvgObstacleOptions;
void anchorsFromReactFlow({ nodes: [{ id: 'typed', position: { x: 0, y: 0 }, width: 10, height: 10 }] }, [
  { id: 'typed-note', nodeId: 'typed' } satisfies ReactFlowAnchorSpec
]);
void annotationsFromReactFlow({ nodes: [{ id: 'typed', position: { x: 0, y: 0 }, width: 10, height: 10 }] }, [
  {
    id: 'typed-note',
    nodeId: 'typed',
    variant: 'evidence',
    tone: 'success',
    motion: 'focus',
    style: { textColor: '#166534' },
    annotationClassName: 'typed-flow-note',
    annotationData: { consumer: 'typed-graph' },
    metadata: { typed: true }
  } satisfies ReactFlowAnchorSpec
]);
void nodeBox({ id: 'typed', position: { x: 0, y: 0 }, width: 40, height: 20 });
void handleBox({ id: 'typed', position: { x: 0, y: 0 }, width: 40, height: 20 }, reactFlowHandle);
void handlePoint({ x: 0, y: 0, width: 40, height: 20 }, 'right');
void obstaclesFromReactFlow({ nodes: [{ id: 'typed', position: { x: 0, y: 0 }, width: 10, height: 10 }] }, reactFlowObstacleOptions);
void reactFlowHandle;
void reactFlowEdgeAnchorResult;
void reactFlowObstacleOptions;
void anchorsFromMermaidSvg;
void annotationsFromMermaidSvg;
void findMermaidElement;
void obstaclesFromMermaidSvg;
void validateMermaidSvgAnchors;
void mermaidSpec;
void mermaidEdgeAnchorResult;
void (undefined as unknown as ExtractedAnchor | undefined);
void (undefined as unknown as MermaidAnchorSpec | undefined);
void (undefined as unknown as VegaAnchorResult | undefined);
void (undefined as unknown as MermaidAnchorResult | undefined);
void (undefined as unknown as D2AnchorResult | undefined);
void (undefined as unknown as ReactFlowAnchorResult | undefined);
