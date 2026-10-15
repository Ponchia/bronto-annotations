import {
  applyAnnotationEdits,
  evaluateAnnotationLayout,
  resolveAnnotationLayout,
  type AnnotationEditPatch,
  type LayoutOptions,
  type LayoutQualityReport
} from '@ponchia/annotations';

/**
 * The editor host, not AnnotationLayer, decides whether a suggested edit is
 * acceptable. Keep an invalid preview provisional instead of committing it
 * and throwing in the strict layout-quality assertion during the next render.
 */
export function validateHostAnnotationEdit(
  layoutOptions: LayoutOptions,
  patch: AnnotationEditPatch
): LayoutQualityReport {
  const proposedAnnotations = applyAnnotationEdits(layoutOptions.annotations, patch, { missing: 'throw' });
  const proposedLayout = resolveAnnotationLayout({
    ...layoutOptions,
    annotations: proposedAnnotations
  });
  return evaluateAnnotationLayout(proposedLayout);
}
