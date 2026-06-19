/**
 * React adapter API stability.
 *
 * @public Stable for `0.1.x`: `AnnotationLayer`, `useAnnotations`, rendering,
 * measurement, quality, and target-alignment props/events.
 * @experimental During `0.x`: edit-handle authoring options and edit events.
 */
export type {
  AnnotationLayerEditEvent,
  AnnotationLayerEditOptions,
  AnnotationLayerProps,
  AnnotationLayerQualityEvent,
  AnnotationLayerTargetAlignmentEvent,
  UseAnnotationsOptions
} from './types.js';
export { AnnotationLayer } from './AnnotationLayer.js';
export { useAnnotations } from './useAnnotations.js';
