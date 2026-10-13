// Public preset facade. Migration machinery stays separate from simple callouts.
export type {
  AnnotationPresetBase
} from './model.js';
export type {
  PointCalloutOptions,
  RegionCalloutOptions,
  PathCalloutOptions,
  EncircleCalloutOptions,
  ThresholdAnnotationOptions,
  BadgeAnnotationOptions
} from './basic.js';
export {
  pointCallout,
  regionCallout,
  pathCallout,
  encircleCallout,
  thresholdAnnotation,
  badgeAnnotation
} from './basic.js';
export type {
  D3AnnotationDisablePart,
  D3AnnotationType,
  D3AnnotationConnectorType,
  D3AnnotationOrientation,
  D3AnnotationAlign,
  D3AnnotationLineType,
  D3AnnotationConnector,
  D3AnnotationSubjectPoint,
  D3AnnotationBadgeX,
  D3AnnotationBadgeY,
  D3AnnotationNote,
  D3AnnotationSubject,
  D3StyleAnnotationInput,
  D3AnnotationAccessor,
  D3AnnotationInverseAccessor,
  D3StyleAnnotationOptions,
  D3StyleAnnotationCollectionId,
  D3StyleAnnotationCollectionInput,
  PreparedD3StyleAnnotationCollection,
  D3StyleCustomAnnotationContext,
  D3StyleCustomAnnotationDefinition,
  D3StyleCustomAnnotationType,
  D3StyleAnnotationEditOptions,
  D3StyleAnnotationEditPatch,
  D3StyleAnnotationCollectionEditPatch,
  D3StyleAnnotationBuilderInput,
  D3StyleAnnotationBuilder
} from './d3-types.js';
export {
  defineD3StyleAnnotationType,
  annotationsFromD3StyleType,
  annotationFromD3Style,
  annotationsFromD3Style,
  prepareD3StyleAnnotationCollection,
  annotationsFromD3StyleCollection,
  d3StyleAnnotationEditPatch,
  applyD3StyleAnnotationEdit,
  d3StyleAnnotationCollectionEditPatch,
  applyD3StyleAnnotationCollectionEdit,
  createD3StyleAnnotationBuilder
} from './d3-style.js';
