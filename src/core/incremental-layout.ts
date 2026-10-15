import { normalizeBox, isFiniteBox } from './anchors.js';
import { allPlacementCandidates } from './placement.js';

import { orderAnnotations } from './layout-order.js';
import { resolveAnnotationLayout, resolveAnnotationLayoutFrom, noteSizeFor, mergePlacement, validateLayoutOptions } from './layout-resolver.js';
import type { Annotation, Box, LayoutOptions, ResolvedLayout } from './model.js';

/** @experimental A host-owned incremental resolver for stable input geometry.
 *
 * Candidate placement only considers *earlier* priority-ordered notes, so a
 * change late in that order can reuse the exact resolved prefix. A changed
 * obstacle, bounds, default placement, padding or refinement configuration
 * triggers a full resolution. Refinement itself always uses the full resolver
 * because later notes can influence earlier winners during iterative passes.
 *
 * Inputs are fingerprinted by value after each successful update, including
 * deeply mutated annotation objects and per-note effective sizes. Unsupported
 * cyclic/opaque values conservatively disable reuse. Keep the returned layout
 * immutable: mutating a resolved winner invalidates this optimization.
 */
export function createIncrementalAnnotationLayoutSession(options: LayoutOptions): AnnotationLayoutSession {
  let current = resolveAnnotationLayout(options);
  let previousSnapshot = captureIncrementalSnapshot(options);
  // Lazily memoize exhaustive placement footprints only for this session.
  // The cache is bounded by annotation index and is valid solely when both
  // the per-note fingerprint and global placement geometry stay unchanged.
  const obstacleFootprints = new Map<number, ObstacleFootprintCacheEntry>();

  return {
    get layout() { return current; },
    update(next: LayoutOptions) {
      validateLayoutOptions(next);
      const nextSnapshot = captureIncrementalSnapshot(next);
      const nextCount = nextSnapshot.annotations.length;
      const changedObstacles = obstacleChanges(
        previousSnapshot.obstacles, nextSnapshot.obstacles
      );
      let reuse = 0;
      // Candidate search depends on all global placement inputs. A changed or
      // unsupported global fingerprint invalidates every cached footprint;
      // removed suffix indices are pruned to keep the session cache bounded.
      if (nextSnapshot.globals === undefined
        || nextSnapshot.globals !== previousSnapshot.globals) {
        obstacleFootprints.clear();
      }
      for (const index of obstacleFootprints.keys()) {
        if (index >= nextCount) obstacleFootprints.delete(index);
      }

      // A refinement pass may move earlier winners in response to *later*
      // notes. Never keep a prefix across that global optimization.
      if (!refinementEnabled(next.refinement) && previousSnapshot.globals !== undefined
        && previousSnapshot.globals === nextSnapshot.globals
        && previousSnapshot.annotations.length === current.annotations.length) {
        // Insertion/removal at the end of priority order cannot change
        // previously placed notes. For earlier changes, only the suffix is
        // invalidated; the normal resolver still recomputes the rest exactly.
        const ordered = orderAnnotations(next.annotations);

        while (reuse < Math.min(nextCount, current.annotations.length)) {
          const before = previousSnapshot.annotations[reuse];
          const after = nextSnapshot.annotations[reuse];
          if (before === undefined || after === undefined || before !== after) break;
          if (changedObstacles.length > 0 && !safeFromObstacleChanges(
            ordered[reuse]!, next, current.placementBounds, changedObstacles,
            obstacleFootprints, reuse, after
          )) break;
          reuse += 1;
        }
      }

      // A changed (or newly appended) note can reference an object from an
      // earlier note. If that earlier note was cloned by the host, retaining
      // the old prefix object would break the new cross-note identity graph.
      // The ordinary fingerprint already proves unchanged *values*; here we
      // additionally require source identity only for cross-prefix aliases
      // that will be reconstructed in the changed suffix.
      if (reuse > 0 && reuse < nextCount) {
        const ordered = orderAnnotations(next.annotations);
        for (let index = reuse; index < nextCount; index += 1) {
          for (const owner of nextSnapshot.crossAliasOwners[index] ?? []) {
            if (owner < reuse && ordered[owner] !== current.annotations[owner]?.annotation) {
              reuse = owner;
            }
          }
        }
      }

      // Preserve the previous object graph for no-op updates so rendered
      // React hosts can avoid rerendering unaffected annotations.
      const identicalLayout = reuse === nextCount
        && reuse === current.annotations.length
        && previousSnapshot.globals !== undefined
        && previousSnapshot.globals === nextSnapshot.globals
        && previousSnapshot.diagnostics === nextSnapshot.diagnostics
        && changedObstacles.length === 0;
      const nextLayout = identicalLayout
        ? current
        : resolveAnnotationLayoutFrom(next, reuse ? current.annotations.slice(0, reuse) : [],
          canReuseDiagnostics(previousSnapshot, nextSnapshot) ? current.diagnostics : undefined);
      current = nextLayout;
      previousSnapshot = nextSnapshot;
      return nextLayout;
    }
  };
}

/** @experimental Mutable resolver session; updates return authoritative layout snapshots. */
export type AnnotationLayoutSession = {
  readonly layout: ResolvedLayout;
  update(options: LayoutOptions): ResolvedLayout;
};

function refinementEnabled(refinement: LayoutOptions['refinement']): boolean {
  return refinement === true || (typeof refinement === 'object'
    && refinement !== null && refinement.enabled !== false);
}

type IncrementalSnapshot = {
  diagnostics: number | 'all' | undefined;
  globals: string | undefined;
  obstacles: Box[];
  annotations: Array<string | undefined>;
  crossAliasOwners: number[][];
};

function canReuseDiagnostics(before: IncrementalSnapshot, after: IncrementalSnapshot): boolean {
  return before.diagnostics === 'all' || before.diagnostics === after.diagnostics
    || typeof before.diagnostics === 'number' && typeof after.diagnostics === 'number'
      && before.diagnostics >= after.diagnostics;
}

function captureIncrementalSnapshot(options: LayoutOptions): IncrementalSnapshot {
  const ordered = orderAnnotations(options.annotations);
  const cross = crossAnnotationTopology(ordered);
  const globals = incrementalFingerprint({
    bounds: options.bounds,
    padding: options.padding,
    placement: options.placement,
    defaultNoteSize: options.defaultNoteSize,
    // These three public spellings mean the same disabled solver.
    refinement: refinementEnabled(options.refinement) ? options.refinement : false
  });
  return {
    diagnostics: options.diagnostics?.candidates,
    globals,
    // Snapshot normalized obstacles by value: hosts can mutate a node/box in
    // place after the prior update, so retaining the original references is
    // unsafe. Invalid host boxes are removed by the full resolver too.
    obstacles: (options.obstacles ?? []).map(normalizeBox).filter(isFiniteBox),
    annotations: ordered.map((annotation, index) => {
      const value = incrementalFingerprint({ annotation, noteSize: noteSizeFor(annotation, options) });
      const aliases = cross?.signatures[index];
      return value === undefined || aliases === undefined
        ? undefined
        : JSON.stringify([value, aliases]);
    }),
    crossAliasOwners: cross?.owners ?? []
  };
}

function obstacleChanges(before: Box[], after: Box[]): Box[] {
  const changed: Box[] = [];
  for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
    const old = before[index];
    const next = after[index];
    if (old && next && old.x === next.x && old.y === next.y
      && old.width === next.width && old.height === next.height) continue;
    if (old) changed.push(old);
    if (next) changed.push(next);
  }
  return changed;
}

/**
 * Conservative spatial dependency proof for a changed host obstacle.
 * Routing-capable connectors may select a different global visibility path,
 * even when the changed obstacle is far away, so they always fall back.
 *
 * For unrouted notes, every possible placement candidate (including ones
 * omitted from diagnostics) contributes note/connector footprint boxes.
 * The same exhaustive footprints can be reused across committed obstacle
 * edits when the per-note and global geometry fingerprints have not changed.
 * Cached boxes prove only spatial independence; they never substitute for
 * an authoritative layout when intersection is possible.
 */
// Each stored rectangle occupies 4 doubles (32 bytes). Decline to cache
// unusually large per-note candidate sets rather than retaining an unbounded
// auxiliary geometry graph. A skipped proof always triggers the ordinary
// authoritative suffix/full-resolution fallback, never unsafe reuse.
const MAX_CACHED_FOOTPRINTS_PER_ANNOTATION = 4096;

// Four Float64 values per conservative candidate footprint, ordered
// [left, top, right, bottom]. Using doubles preserves the existing geometric
// comparisons without retaining thousands of short-lived Box objects and
// connector-segment arrays in a dense host-owned session.
type ObstacleFootprintCacheEntry = {
  fingerprint: string;
  footprints: Float64Array | null;
};

function safeFromObstacleChanges(
  annotation: Annotation,
  options: LayoutOptions,
  placementBounds: Box,
  changedObstacles: Box[],
  cache: Map<number, ObstacleFootprintCacheEntry>,
  index: number,
  fingerprint: string
): boolean {
  const connector = annotation.connector;
  const type = connector?.type ?? 'elbow';
  const routing = connector?.routing;
  if (type !== 'none' && type !== 'curve' && routing !== 'none'
    && !(typeof routing === 'object' && routing?.mode === 'none')) {
    return false;
  }

  let cached = cache.get(index);
  if (!cached || cached.fingerprint !== fingerprint) {
    cached = {
      fingerprint,
      footprints: collectObstacleFootprints(annotation, options, placementBounds)
    };
    cache.set(index, cached);
  }
  if (!cached.footprints) return false;

  for (let offset = 0; offset < cached.footprints.length; offset += 4) {
    const left = cached.footprints[offset]!;
    const top = cached.footprints[offset + 1]!;
    const right = cached.footprints[offset + 2]!;
    const bottom = cached.footprints[offset + 3]!;
    for (const changed of changedObstacles) {
      // Closed boundaries deliberately over-invalidate: collision and routing
      // checks have different touch semantics. Recompute whenever uncertain.
      if (left <= changed.x + changed.width && right >= changed.x
        && top <= changed.y + changed.height && bottom >= changed.y) {
        return false;
      }
    }
  }
  return true;
}

function collectObstacleFootprints(
  annotation: Annotation,
  options: LayoutOptions,
  placementBounds: Box
): Float64Array | null {
  const completePlacement = mergePlacement(options.placement, annotation.placement);
  const candidates = allPlacementCandidates({
    annotation,
    bounds: placementBounds,
    noteSize: noteSizeFor(annotation, options),
    obstacles: [],
    placedNotes: [],
    placement: completePlacement
  });
  if (candidates.length === 0) return null;

  // The all-candidate proof is intentionally exhaustive, even when the host
  // retains only a few ranked/debug candidates. Calculate the exact storage
  // needed once instead of allocating a Box per connector line segment.
  let count = 0;
  for (const candidate of candidates) {
    count += 1 + Math.max(candidate.connector.points.length - 1, 0);
    // At most 128 KiB of retained footprint coordinates per annotation.
    // All-candidate geometry can legitimately exceed this for unusual custom
    // placement searches; it is safer to re-resolve than cache a huge proof.
    if (!Number.isSafeInteger(count) || count > MAX_CACHED_FOOTPRINTS_PER_ANNOTATION) {
      return null;
    }
  }
  const footprints = new Float64Array(count * 4);
  let offset = 0;
  const append = (x: number, y: number, width: number, height: number): boolean => {
    // Identical safety predicate to isFiniteBox. Keep overflowed right/bottom
    // endpoints conservative just as Box.x + Box.width was before.
    if (!Number.isFinite(x) || !Number.isFinite(y)
      || !Number.isFinite(width) || !Number.isFinite(height)
      || width < 0 || height < 0) return false;
    footprints[offset++] = x;
    footprints[offset++] = y;
    footprints[offset++] = x + width;
    footprints[offset++] = y + height;
    return true;
  };
  for (const candidate of candidates) {
    const box = candidate.noteBox;
    if (!append(box.x, box.y, box.width, box.height)) return null;
    const points = candidate.connector.points;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1]!;
      const to = points[index]!;
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      const width = Math.abs(from.x - to.x);
      const height = Math.abs(from.y - to.y);
      if (!append(x, y, width, height)) return null;
    }
  }
  return footprints;
}

type CrossAnnotationTopology = { signatures: string[]; owners: number[][] };

function crossAnnotationTopology(annotations: Annotation[]): CrossAnnotationTopology | undefined {
  const firstOwner = new WeakMap<object, { index: number; path: string }>();
  const signatures: string[] = [];
  const owners: number[][] = [];
  try {
    for (let index = 0; index < annotations.length; index += 1) {
      const inspected = new WeakSet<object>();
      const aliases: Array<[path: string, owner: number, ownerPath: string]> = [];
      const referencedOwners = new Set<number>();
      const pending: Array<{ value: unknown; path: string }> = [
        { value: annotations[index], path: '$' }
      ];
      while (pending.length > 0) {
        const next = pending.pop()!;
        const value = next.value;
        if (!value || typeof value !== 'object' || inspected.has(value)) continue;
        inspected.add(value);
        const first = firstOwner.get(value);
        if (first && first.index !== index) {
          aliases.push([next.path, first.index, first.path]);
          referencedOwners.add(first.index);
        } else if (!first) {
          firstOwner.set(value, { index, path: next.path });
        }
        // Reverse push to preserve property traversal order. Repeated aliases
        // *within* a note are captured by the per-note fingerprint instead.
        const keys = Reflect.ownKeys(value);
        for (let keyIndex = keys.length - 1; keyIndex >= 0; keyIndex -= 1) {
          const key = keys[keyIndex]!;
          const descriptor = Object.getOwnPropertyDescriptor(value, key);
          if (!descriptor) throw new Error('Uninspectable host metadata');
          // Accessors are not stored references. Never invoke a getter: the
          // per-annotation fingerprint separately forbids reuse of the note
          // containing it. Still inspect the remaining *data* properties so
          // an unrelated safe prefix need not be discarded, and so aliases
          // from this invalidated suffix to earlier notes remain visible.
          if (!('value' in descriptor)) continue;
          // Symbol-bearing objects also fail the per-annotation fingerprint;
          // follow their data references for cross-note owner detection.
          const segment = typeof key === 'string' ? JSON.stringify(key) : 'symbol';
          pending.push({ value: descriptor.value, path: `${next.path}/${segment}` });
        }
      }
      signatures.push(JSON.stringify(aliases));
      owners.push([...referencedOwners]);
    }
    return { signatures, owners };
  } catch {
    // Proxy traps or other uninspectable metadata make cross-note sharing
    // unknowable. In those cases, a complete resolution is safer than reuse.
    return undefined;
  }
}

// Stable and alias-aware snapshots of host inputs. A naive JSON.stringify
// conflates shared-reference metadata with independent objects of the same
// value, omitted keys with undefined values, sparse array slots with explicit
// undefined, and -0 with +0. Any of those would incorrectly preserve a stale
// resolved annotation after a committed edit. Use an unambiguous tagged value
// representation, including first-occurrence IDs for repeated references.
//
// This is deliberately conservative for cyclic, opaque or accessor-backed
// values: if no trustworthy snapshot exists, the session resolves afresh.
// The metadata may be host-supplied, so never invoke getters or toJSON hooks.
const fingerprintFunctions = new WeakMap<Function, number>();
let fingerprintFunctionCount = 0;
function incrementalFingerprint(input: unknown): string | undefined {
  const seen = new WeakMap<object, number>();
  const active = new WeakSet<object>();
  let nextId = 0;

  function encode(value: unknown): unknown {
    if (value === null) return ['null'];
    if (value === undefined) return ['undefined'];
    switch (typeof value) {
      case 'boolean': return ['boolean', value];
      case 'string': return ['string', value];
      case 'number':
        if (Number.isNaN(value)) return ['nan'];
        if (Object.is(value, -0)) return ['negative-zero'];
        if (!Number.isFinite(value)) return ['nonfinite', String(value)];
        return ['number', value];
      case 'bigint': return ['bigint', String(value)];
      case 'symbol': throw new Error('Uncloneable symbol metadata');
      case 'function': {
        let id = fingerprintFunctions.get(value);
        if (id === undefined) {
          id = ++fingerprintFunctionCount;
          fingerprintFunctions.set(value, id);
        }
        return ['function', id];
      }
      case 'object': break;
    }

    const object = value as object;
    if (active.has(object)) throw new Error('Cyclic annotation metadata');
    const repeated = seen.get(object);
    if (repeated !== undefined) return ['reference', repeated];
    const id = ++nextId;
    seen.set(object, id);
    active.add(object);
    try {
      if (object instanceof RegExp) {
        // Match the supported splitter's actual state, including lastIndex
        // when a host mutates a global/sticky expression in place.
        if (Reflect.ownKeys(object).some((key) => key !== 'lastIndex')) {
          throw new Error('Unsupported RegExp metadata fields');
        }
        return ['regexp', id, object.source, object.flags, encode(object.lastIndex)];
      }
      const array = Array.isArray(object);
      const prototype = Object.getPrototypeOf(object);
      if (array ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null) {
        throw new Error('Unsupported host metadata type');
      }
      const entries: unknown[] = [];
      for (const key of Reflect.ownKeys(object)) {
        if (typeof key !== 'string') throw new Error('Symbol property in metadata');
        if (array && key === 'length') continue;
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
          throw new Error('Accessor or hidden property in host metadata');
        }
        entries.push([key, encode(descriptor.value)]);
      }
      return array
        ? ['array', id, (object as unknown[]).length, entries]
        : ['object', id, prototype === null ? 'null-prototype' : 'plain', entries];
    } finally {
      active.delete(object);
    }
  }
  try {
    return JSON.stringify(encode(input));
  } catch {
    // Unsafe snapshots disable prefix reuse, never a successful full solve.
    return undefined;
  }
}
