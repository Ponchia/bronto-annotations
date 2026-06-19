/**
 * Root API stability for `@ponchia/annotations`.
 *
 * @public Stable for `0.1.x`: DOM-free models, layout, geometry helpers,
 * renderer helpers, prepared-layout diagnostics, presets, and Bronto class/CSS
 * helpers.
 * @experimental During `0.x`: d3-style migration helpers, edit/authoring
 * helpers, and low-level placement candidate scoring exports.
 */
export type {
  Anchor,
  Annotation,
  AnnotationBadgeOptions,
  AnnotationConnectorOptions,
  AnnotationMetadata,
  AnnotationMotion,
  AnnotationNote,
  AnnotationNoteAlign,
  AnnotationNoteLineOptions,
  AnnotationStyle,
  AnnotationStyleVariableName,
  AnnotationSubjectOptions,
  AnnotationTone,
  AnnotationVariant,
  Box,
  ConnectorPath,
  ConnectorEnd,
  ConnectorPointMode,
  ConnectorRoutingMode,
  ConnectorRoutingOptions,
  ConnectorRoutingPreference,
  ConnectorType,
  DataAttributes,
  LayoutOptions,
  LayoutRefinementOptions,
  ManualPlacement,
  Padding,
  PaddingInput,
  PlacementAlign,
  PlacementCandidate,
  PlacementPreference,
  PlacementSide,
  Point,
  ResolvedAnnotation,
  ResolvedLayout,
  ResolvedPlacement,
  ResolvedSubject,
  Size,
  AnnotationSubjectGeometry,
  AnnotationSubjectGeometrySpace,
  SubjectShape
} from './core/model.js';
export {
  DEFAULT_NOTE_PADDING,
  DEFAULT_NOTE_SIZE,
  DEFAULT_PLACEMENT,
  DEFAULT_SIDES
} from './core/model.js';
export {
  anchorPoint,
  anchorSubject,
  boxCenter,
  boxFromPoints,
  boxForPoint,
  boxSidePoint,
  boxUnion,
  expandBox,
  insetBox,
  isFiniteBox,
  normalizeBox,
  overlapArea,
  resolvePadding
} from './core/anchors.js';
export type {
  AnnotationClassNameInput,
  AnnotationClassNameValue
} from './core/classes.js';
export {
  annotationClassName,
  brontoAnnotationClassName
} from './core/classes.js';
export type { AnnotationStyleVariables } from './core/style.js';
export { annotationStyleVariables } from './core/style.js';
export {
  connectorPath,
  connectorPathD,
  nearestPointOnBox,
  polylinePathD
} from './core/connectors.js';
export type { ConnectorRoutingContext } from './core/connectors.js';
export type {
  AnnotationAlign,
  AnnotationBounds,
  AnnotationConnectorShape,
  AnnotationOffset,
  AnnotationParts,
  AnnotationPartsOptions,
  AnnotationPartsSubject,
  AnnotationValign,
  AxisOrientation,
  AxisThresholdPathOptions,
  BandSubjectPathOptions,
  BracketSubjectPathOptions,
  CircleSubjectGeometry,
  CircleSubjectPathOptions,
  ComparisonBracePathOptions,
  ConnectorEndArrowOptions,
  ConnectorEndDotOptions,
  ConnectorOffsetOptions,
  ConnectorSubjectGeometry,
  DeclutterLabelItem,
  DeclutterLabelsOptions,
  DirectLabel,
  DirectLabelItem,
  DirectLabelsOptions,
  EncircleSubjectPathOptions,
  EnclosingCircle,
  EvidenceMarkerPathOptions,
  NotePlacement,
  NotePlacementOptions,
  NoteTransformOptions,
  OutlierClusterPathOptions,
  RectSubjectGeometry,
  RectSubjectPathOptions,
  SlopeSubjectPathOptions,
  ThresholdPathOptions,
  TimelineDirection,
  TimelineEventPathOptions
} from './core/annotation-geometry.js';
export {
  annotationParts,
  annotationTransform,
  axisThresholdPath,
  bandSubjectPath,
  bracketSubjectPath,
  circleSubjectPath,
  comparisonBracePath,
  connectorCurve,
  connectorElbow,
  connectorEndArrow,
  connectorEndDot,
  connectorLine,
  declutterLabels,
  directLabels,
  encircleSubjectPath,
  enclosingCircle,
  evidenceMarkerPath,
  notePlacement,
  noteTransform,
  outlierClusterPath,
  rectSubjectPath,
  slopeSubjectPath,
  subjectPath,
  thresholdPath,
  timelineEventPath
} from './core/annotation-geometry.js';
export {
  estimateNoteSize,
  refineAnnotationLayout,
  resolveAnnotationLayout
} from './core/layout.js';
export type {
  AnnotationEditHandle,
  AnnotationEditHandleKind,
  AnnotationEditHandleOptions,
  AnnotationEditHandlePosition,
  AnnotationEditEvent,
  AnnotationEditPhase,
  AnnotationEditPatch,
  AnnotationEditSuggestion,
  AnnotationEditSession,
  ApplyAnnotationEditOptions,
  CreateAnnotationEditDeltaOptions,
  CreateAnnotationEditEventOptions,
  CreateAnnotationEditSessionOptions
} from './core/edit.js';
export {
  annotationEditHandles,
  annotationEditPatch,
  applyAnnotationEdit,
  applyAnnotationEdits,
  createAnnotationEditDelta,
  createAnnotationEditEvent,
  createAnnotationEditSession,
  translateAnchor
} from './core/edit.js';
export type {
  LayoutQualityAssertOptions,
  LayoutQualityFormatOptions,
  LayoutQualityIssue,
  LayoutQualityIssueType,
  LayoutQualityMetrics,
  LayoutQualityOptions,
  LayoutQualityReport,
  LayoutQualitySeverity
} from './core/quality.js';
export {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityIssue,
  formatLayoutQualityReport
} from './core/quality.js';
export type {
  AdapterAnnotationLayerInput,
  AnchorAlignmentAssertInput,
  AnchorAlignmentAssertOptions,
  AnchorAlignmentDiagnostic,
  AnchorAlignmentDiagnosticStatus,
  AnchorAlignmentFormatOptions,
  AnchorAlignmentOptions,
  AnchorAlignmentReport,
  AnchorAlignmentTarget,
  AnchorSpecDiagnostic,
  AnchorSpecDiagnosticStatus,
  AnchorSpecValidationReport,
  AnchorValidationAssertInput,
  AnchorValidationAssertOptions,
  AnchorValidationFormatOptions
} from './adapters/diagnostics.js';
export {
  assertAnchorAlignmentReport,
  assertAnchorAlignmentReportIfRequested,
  assertAnchorValidationReport,
  assertAnchorValidationReportIfRequested,
  evaluateAnchorAlignment,
  formatAnchorAlignmentDiagnostic,
  formatAnchorAlignmentReport,
  formatAnchorDiagnostic,
  formatAnchorValidationReport
} from './adapters/diagnostics.js';
export type {
  GeneratedSurfaceLayoutDefaults,
  GeneratedSurfaceLayoutDefaultsOptions,
  PreparedAnnotationLayoutOptions,
  PreparedAnnotationLayoutResult
} from './adapters/layout.js';
export {
  generatedSurfaceLayoutDefaults,
  resolvePreparedAnnotationLayout
} from './adapters/layout.js';
export {
  allPlacementCandidates,
  candidateNoteBox,
  getCandidateSides,
  resolvePlacementCandidate,
  scorePlacementCandidate
} from './core/placement.js';
export type {
  AnnotationPresetBase,
  BadgeAnnotationOptions,
  D3AnnotationAccessor,
  D3AnnotationAlign,
  D3AnnotationBadgeX,
  D3AnnotationBadgeY,
  D3AnnotationConnector,
  D3AnnotationConnectorType,
  D3AnnotationDisablePart,
  D3AnnotationInverseAccessor,
  D3AnnotationLineType,
  D3AnnotationNote,
  D3AnnotationOrientation,
  D3AnnotationSubjectPoint,
  D3AnnotationSubject,
  D3AnnotationType,
  D3StyleAnnotationBuilder,
  D3StyleAnnotationBuilderInput,
  D3StyleAnnotationCollectionEditPatch,
  D3StyleAnnotationCollectionId,
  D3StyleAnnotationCollectionInput,
  D3StyleCustomAnnotationContext,
  D3StyleCustomAnnotationDefinition,
  D3StyleCustomAnnotationType,
  D3StyleAnnotationEditOptions,
  D3StyleAnnotationEditPatch,
  D3StyleAnnotationInput,
  D3StyleAnnotationOptions,
  EncircleCalloutOptions,
  PathCalloutOptions,
  PointCalloutOptions,
  PreparedD3StyleAnnotationCollection,
  RegionCalloutOptions,
  ThresholdAnnotationOptions
} from './presets/index.js';
export {
  applyD3StyleAnnotationEdit,
  applyD3StyleAnnotationCollectionEdit,
  annotationFromD3Style,
  annotationsFromD3Style,
  annotationsFromD3StyleCollection,
  annotationsFromD3StyleType,
  badgeAnnotation,
  createD3StyleAnnotationBuilder,
  d3StyleAnnotationCollectionEditPatch,
  d3StyleAnnotationEditPatch,
  defineD3StyleAnnotationType,
  encircleCallout,
  pathCallout,
  pointCallout,
  prepareD3StyleAnnotationCollection,
  regionCallout,
  thresholdAnnotation
} from './presets/index.js';
export type { SvgRenderOptions } from './svg/render.js';
export { renderAnnotationsSvg, renderAnnotationSubjectsSvg } from './svg/render.js';
