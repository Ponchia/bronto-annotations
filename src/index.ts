/**
 * Root API stability for `@ponchia/annotations`.
 *
 * @public Stable for `0.7.x`: DOM-free models, layout, geometry helpers,
 * renderer helpers, prepared-layout diagnostics, presets, and Bronto class/CSS
 * helpers.
 * @experimental During `0.x`: edit/authoring
 * helpers, polyline readability evidence/refinement, and low-level placement candidate scoring exports.
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
  LayoutDiagnostics,
  AnnotationPlacementDiagnostics,
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
  resolveAnnotationLayout,
  createIncrementalAnnotationLayoutSession
} from './core/layout.js';
export type { AnnotationLayoutSession } from './core/layout.js';
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
  previewAnnotationEdit,
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
  LayoutReadabilityReport,
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
export type { PlacementSearchOptions } from './core/placement.js';
export type {
  BadgeAnnotationOptions,
  EncircleCalloutOptions,
  PathCalloutOptions,
  PointCalloutOptions,
  RegionCalloutOptions,
  ThresholdAnnotationOptions
} from './presets/basic.js';
export type { AnnotationPresetBase } from './presets/model.js';
export {
  badgeAnnotation,
  encircleCallout,
  pathCallout,
  pointCallout,
  regionCallout,
  thresholdAnnotation
} from './presets/basic.js';
export type { SvgRenderOptions } from './svg/render.js';
export { renderAnnotationsSvg, renderAnnotationSubjectsSvg } from './svg/render.js';

/** @experimental Bounded pin placement; the host owns visibility and discussion state. */
export { layoutAnnotationPins } from './core/pin-layout.js';
export type {
  AnnotationPinInput,
  AnnotationPinLayout,
  AnnotationPinLayoutOptions,
  AnnotationPinPlacement
} from './core/pin-layout.js';
