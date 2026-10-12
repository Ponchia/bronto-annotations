/**
 * Consumer-owned layout transport. This is a *host integration experiment*,
 * not an @ponchia/annotations export, Worker runtime or persistence API.
 *
 * Only apply patches to the exact acknowledged revision. A missing baseline,
 * changed annotation order/count, or unsafe comparison produces a snapshot.
 * Never reuse mutable resolved layouts: the host owns their immutability.
 */
import type { ResolvedAnnotation, ResolvedLayout } from '@ponchia/annotations';

type LayoutFields = Omit<ResolvedLayout, 'annotations'>;
type LayoutSnapshot = {
  kind: 'snapshot';
  revision: number;
  baseRevision: number;
  layout: ResolvedLayout;
};
type LayoutPatch = {
  kind: 'patch';
  revision: number;
  baseRevision: number;
  fields: LayoutFields;
  count: number;
  changed: Array<{ index: number; annotation: ResolvedAnnotation }>;
};
export type LayoutResponse = LayoutSnapshot | LayoutPatch;
export type LayoutRevision = { revision: number; layout: ResolvedLayout };
export class LayoutRevisionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutRevisionMismatchError';
  }
}

/**
 * Compare plain cloneable data without conflating `undefined` and missing
 * keys (JSON.stringify does). Unknown classes, cyclic references,
 * symbols, non-plain metadata and getter failures conservatively count as
 * changed rather than preserving a potentially stale React node. Shared
 * aliases must also be structurally identical: comparing two equal-looking
 * copies with different reference sharing would retain a stale host object.
 */
export function canReuseWorkerAnnotation(first: unknown, second: unknown): boolean {
  const seenA = new WeakMap<object, object>();
  const seenB = new WeakMap<object, object>();

  function same(a: unknown, b: unknown, parentsA: Set<object>, parentsB: Set<object>): boolean {
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      return Object.is(a, b);
    }
    if (parentsA.has(a) || parentsB.has(b)) return false;
    // Enforce a one-to-one mapping of references across the *whole* object
    // graph, not just the current recursion branch. Otherwise two references
    // to one source object can be misclassified as two independent objects.
    // Natural aliases in resolved geometry (noteBox/candidate or subject/point)
    // remain reusable when the other graph has the same alias topology.
    if (seenA.has(a) || seenB.has(b)) {
      return seenA.get(a) === b && seenB.get(b) === a;
    }
    const arrays = Array.isArray(a) && Array.isArray(b);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (arrays && (a as unknown[]).length !== (b as unknown[]).length) return false;
    if (!arrays && (Object.getPrototypeOf(a) !== Object.prototype
      || Object.getPrototypeOf(b) !== Object.prototype)) return false;
    if (Object.getOwnPropertySymbols(a).length || Object.getOwnPropertySymbols(b).length) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    seenA.set(a, b);
    seenB.set(b, a);
    parentsA.add(a);
    parentsB.add(b);
    try {
      for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        const left = Object.getOwnPropertyDescriptor(a, key);
        const right = Object.getOwnPropertyDescriptor(b, key);
        if (!left || !right || !('value' in left) || !('value' in right)) return false;
        if (!same(left.value, right.value, parentsA, parentsB)) return false;
      }
      return true;
    } finally {
      parentsA.delete(a);
      parentsB.delete(b);
    }
  }
  try {
    return same(first, second, new Set(), new Set());
  } catch {
    return false;
  }
}

export function encodeWorkerLayout(
  revision: number,
  baseRevision: number,
  layout: ResolvedLayout,
  acknowledged?: LayoutRevision
): LayoutResponse {
  if (!Number.isSafeInteger(revision) || revision <= 0
    || !Number.isSafeInteger(baseRevision) || baseRevision < 0
    || revision <= baseRevision) throw new Error('Invalid Worker layout revisions');
  const snapshot = (): LayoutSnapshot => ({ kind: 'snapshot', revision, baseRevision, layout });
  if (!acknowledged || acknowledged.revision !== baseRevision
    || acknowledged.layout.annotations.length !== layout.annotations.length) return snapshot();

  const changed: LayoutPatch['changed'] = [];
  for (let index = 0; index < layout.annotations.length; index += 1) {
    const next = layout.annotations[index]!;
    const previous = acknowledged.layout.annotations[index]!;
    if (previous.id !== next.id) return snapshot();
    // An incremental session retains exact, immutable ResolvedAnnotation
    // objects for proven-unaffected priority prefixes. Object identity is a
    // much cheaper proof than traversing the candidate/connector graph again.
    // Callers must never mutate a returned resolved layout in place.
    if (previous !== next && !canReuseWorkerAnnotation(previous, next)) {
      changed.push({ index, annotation: next });
    }
  }
  // Dense changes are unlikely to make a patch smaller than a snapshot.
  if (changed.length > layout.annotations.length / 2) return snapshot();
  const { annotations: _annotations, ...fields } = layout;
  return { kind: 'patch', revision, baseRevision, fields, count: layout.annotations.length, changed };
}

export function applyWorkerLayout(previous: LayoutRevision, response: LayoutResponse): {
  state: LayoutRevision;
  reused: number;
  changed: number;
} {
  if (!Number.isSafeInteger(response.revision) || response.revision <= previous.revision) {
    throw new LayoutRevisionMismatchError('Worker response revision is stale');
  }
  if (response.baseRevision !== previous.revision) {
    throw new LayoutRevisionMismatchError('Worker response base revision differs from acknowledged host layout');
  }
  if (response.kind === 'snapshot') {
    if (!response.layout || !Array.isArray(response.layout.annotations)) {
      throw new LayoutRevisionMismatchError('Worker snapshot has no resolved annotation array');
    }
    return {
      state: { revision: response.revision, layout: response.layout },
      reused: 0,
      changed: response.layout.annotations.length
    };
  }

  // The Worker is host-owned, but a malformed reply must still trigger the
  // host's revision-mismatch/snapshot-recovery path rather than crashing React
  // with a TypeError or installing incomplete global geometry.
  if (response.kind !== 'patch' || !response.fields
    || !response.fields.bounds || !response.fields.placementBounds
    || !response.fields.padding || !Array.isArray(response.fields.obstacles)) {
    throw new LayoutRevisionMismatchError('Worker patch is missing authoritative layout fields');
  }
  const before = previous.layout.annotations;
  if (response.count !== before.length || !Array.isArray(response.changed)) {
    throw new LayoutRevisionMismatchError('Worker patch note count does not match host layout');
  }
  const updated = before.slice();
  let lastIndex = -1;
  for (const change of response.changed) {
    if (!change || typeof change !== 'object'
      || !Number.isSafeInteger(change.index) || change.index <= lastIndex
      || change.index >= updated.length || change.index < 0) {
      throw new LayoutRevisionMismatchError('Worker patch index must be strictly ascending and in bounds');
    }
    if (!change.annotation || updated[change.index]!.id !== change.annotation.id) {
      throw new LayoutRevisionMismatchError('Worker patch changed an annotation ID or omitted its result');
    }
    updated[change.index] = change.annotation;
    lastIndex = change.index;
  }
  return {
    state: { revision: response.revision, layout: { ...response.fields, annotations: updated } },
    reused: before.length - response.changed.length,
    changed: response.changed.length
  };
}
