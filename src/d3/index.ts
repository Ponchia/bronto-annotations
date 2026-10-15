/**
 * D3-style migration bridge, isolated from the normal annotations API.
 * @public During 0.7.x: explicitly scoped, DOM-free migration helpers.
 * @experimental Builder and authoring helpers may evolve during 0.x.
 */
export type {
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
  PreparedD3StyleAnnotationCollection
} from '../presets/d3-types.js';
export {
  applyD3StyleAnnotationEdit,
  applyD3StyleAnnotationCollectionEdit,
  annotationFromD3Style,
  annotationsFromD3Style,
  annotationsFromD3StyleCollection,
  annotationsFromD3StyleType,
  createD3StyleAnnotationBuilder,
  d3StyleAnnotationCollectionEditPatch,
  d3StyleAnnotationEditPatch,
  defineD3StyleAnnotationType,
  prepareD3StyleAnnotationCollection
} from '../presets/d3-style.js';
