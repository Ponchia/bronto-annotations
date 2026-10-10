/**
 * React adapter API stability.
 *
 * @public Stable for `0.1.x`: `AnnotationLayer`, `useAnnotations`, rendering,
 * measurement, quality, and target-alignment props/events.
 * @experimental During `0.x`: edit-handle authoring options, edit events,
 * and the opt-in host-owned resolvedLayout renderer input.
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

export { AnnotationPin } from './AnnotationPin.js';
export type { AnnotationPinProps } from './AnnotationPin.js';
