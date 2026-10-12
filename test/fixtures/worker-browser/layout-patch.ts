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

// Share the exact conservative comparator with the published Worker example.
// Neither the comparator nor the patch protocol is a package runtime export.
import {
  canReuseWorkerAnnotation,
  canReuseWorkerCrossNoteGraph
} from '../../../examples/react-worker/layout-equality.js';
export { canReuseWorkerAnnotation } from '../../../examples/react-worker/layout-equality.js';

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
  // Per-note comparison alone cannot preserve aliases that cross note
  // boundaries. A changed shared owner/sibling must travel as one graph.
  // A full snapshot is the conservative recovery for topology changes.
  if (!canReuseWorkerCrossNoteGraph(
    acknowledged.layout.annotations, layout.annotations,
    changed.map((item) => item.index)
  )) return snapshot();
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
