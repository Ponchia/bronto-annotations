import type { Annotation } from './model.js';

export function orderAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    return priority || a.id.localeCompare(b.id);
  });
}

