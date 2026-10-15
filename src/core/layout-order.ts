import type { Annotation } from './model.js';

/** Compare opaque annotation IDs by UTF-16 code units, never the host locale. */
export function compareAnnotationIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** IDs are primary identities for diagnostics, editing and incremental sessions. */
export function assertUniqueAnnotationIds(annotations: readonly Annotation[]): void {
  const ids = new Set<string>();
  for (const annotation of annotations) {
    if (typeof annotation.id !== 'string') {
      throw new TypeError('Annotation.id must be a string.');
    }
    if (ids.has(annotation.id)) {
      throw new TypeError(`Duplicate annotation ID ${JSON.stringify(annotation.id)}; every annotation must have a unique ID.`);
    }
    ids.add(annotation.id);
  }
}

export function orderAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    return priority || compareAnnotationIds(a.id, b.id);
  });
}
