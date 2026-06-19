import type { ResolvedAnnotation } from './model.js';

export function annotationsForPaint(annotations: readonly ResolvedAnnotation[]): ResolvedAnnotation[] {
  return [...annotations].sort((a, b) => {
    const priority = (a.annotation.priority ?? 0) - (b.annotation.priority ?? 0);

    return priority || a.id.localeCompare(b.id);
  });
}
