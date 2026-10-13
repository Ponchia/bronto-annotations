/**
 * React input-mode resolution and render-only layout presentation.
 * @public Stable for 0.7.x: rendering, measurement and diagnostic callbacks.
 * @experimental Editing events/options remain experimental during 0.x.
 * The 0.7 development preview deliberately removes the dual-source props API.
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
