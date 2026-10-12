import {
  anchorSubject,
  insetBox,
  isFiniteBox,
  normalizeBox,
  resolvePadding
} from './anchors.js';
import {
  allPlacementCandidates
} from './placement.js';
import {
  DEFAULT_NOTE_SIZE,
  DEFAULT_NOTE_PADDING,
  DEFAULT_PLACEMENT
} from './model.js';
import { evaluateAnnotationLayout } from './quality.js';
import { wrapNoteText } from './text.js';
import type {
  Annotation,
  Box,
  LayoutOptions,
  LayoutRefinementOptions,
  PlacementCandidate,
  PlacementPreference,
  ResolvedAnnotation,
  ResolvedLayout,
  Size
} from './model.js';

export function resolveAnnotationLayout(options: LayoutOptions): ResolvedLayout {
  return resolveAnnotationLayoutFrom(options);
}

/** @internal Compute a suffix after an unchanged priority-ordered prefix. */
function resolveAnnotationLayoutFrom(
  options: LayoutOptions,
  reused: ResolvedAnnotation[] = []
): ResolvedLayout {
  const bounds = normalizeBox(options.bounds);
  const padding = resolvePadding(options.padding);
  const placementBounds = insetBox(bounds, padding);
  const obstacles = (options.obstacles ?? [])
    .map(normalizeBox)
    .filter(isFiniteBox);
  const placedNotes: ResolvedAnnotation[] = [...reused];
  // Reuse the existing prefix's original winners and avoid recomputing their
  // connector routing / placement scores when later annotations change.
  const placedNoteBoxes = reused.map((item) => item.noteBox);
  const ordered = orderAnnotations(options.annotations);

  for (const annotation of ordered.slice(reused.length)) {
    const placement = mergePlacement(options.placement, annotation.placement);
    const noteSize = noteSizeFor(annotation, options);
    const candidates = allPlacementCandidates({
      annotation,
      bounds: placementBounds,
      noteSize,
      obstacles,
      placedNotes: placedNoteBoxes,
      placement
    });
    const winner = candidates[0];
    const subject = anchorSubject(annotation.anchor, winner?.side);

    if (!winner) {
      continue;
    }

    placedNoteBoxes.push(winner.noteBox);
    placedNotes.push({
      id: annotation.id,
      annotation,
      subject,
      anchorPoint: subject.point,
      noteBox: winner.noteBox,
      connector: winner.connector,
      placement: {
        side: winner.side,
        offset: winner.offset,
        align: winner.align,
        score: winner.score,
        ...(placement.manual ? { manual: true } : {}),
        candidates
      }
    });
  }

  const layout = {
    bounds,
    placementBounds,
    padding,
    annotations: placedNotes,
    obstacles
  };

  return options.refinement
    ? refineAnnotationLayout(layout, options.refinement)
    : layout;
}

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

  return {
    get layout() { return current; },
    update(next: LayoutOptions) {
      const nextSnapshot = captureIncrementalSnapshot(next);
      const nextCount = nextSnapshot.annotations.length;
      const changedObstacles = obstacleChanges(
        previousSnapshot.obstacles, nextSnapshot.obstacles
      );
      let reuse = 0;

      // A refinement pass may move earlier winners in response to *later*
      // notes. Never keep a prefix across that global optimization.
      if (!next.refinement && previousSnapshot.globals !== undefined
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
            ordered[reuse]!, next, current.placementBounds, changedObstacles
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
        && changedObstacles.length === 0;
      const nextLayout = identicalLayout
        ? current
        : resolveAnnotationLayoutFrom(next, reuse ? current.annotations.slice(0, reuse) : []);
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

type IncrementalSnapshot = {
  globals: string | undefined;
  obstacles: Box[];
  annotations: Array<string | undefined>;
  crossAliasOwners: number[][];
};

function captureIncrementalSnapshot(options: LayoutOptions): IncrementalSnapshot {
  const ordered = orderAnnotations(options.annotations);
  const cross = crossAnnotationTopology(ordered);
  const globals = incrementalFingerprint({
    bounds: options.bounds,
    padding: options.padding,
    placement: options.placement,
    defaultNoteSize: options.defaultNoteSize,
    refinement: options.refinement
  });
  return {
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
 * Routing-capable connectors can change paths even when the new obstacle is
 * far away, because orthogonal routing selects and sorts global obstacles.
 * Only explicitly unrouted (or intrinsically unrouted) connectors qualify.
 * For those, consider EVERY possible candidate note/connector footprint, not
 * only candidates retained by maxCandidates. No intersecting changed boxes
 * means the scores, order, winner and SVG paths remain exactly the same.
 */
function safeFromObstacleChanges(
  annotation: Annotation,
  options: LayoutOptions,
  placementBounds: Box,
  changedObstacles: Box[]
): boolean {
  const connector = annotation.connector;
  const type = connector?.type ?? 'elbow';
  const routing = connector?.routing;
  if (type !== 'none' && type !== 'curve' && routing !== 'none'
    && !(typeof routing === 'object' && routing?.mode === 'none')) {
    return false;
  }

  const completePlacement = mergePlacement(options.placement, annotation.placement);
  delete completePlacement.maxCandidates;
  const candidates = allPlacementCandidates({
    annotation,
    bounds: placementBounds,
    noteSize: noteSizeFor(annotation, options),
    obstacles: [],
    placedNotes: [],
    placement: completePlacement
  });
  if (candidates.length === 0) return false;

  for (const candidate of candidates) {
    const bounds = [candidate.noteBox, ...candidate.connector.points.slice(1).map((point, index) => {
      const from = candidate.connector.points[index]!;
      return {
        x: Math.min(from.x, point.x),
        y: Math.min(from.y, point.y),
        width: Math.abs(from.x - point.x),
        height: Math.abs(from.y - point.y)
      };
    })];
    for (const box of bounds) {
      if (!isFiniteBox(box)) return false;
      for (const changed of changedObstacles) {
        // Closed boundaries over-invalidate intentionally: collision/routing
        // checks have different touch semantics, and recomputing is safer.
        if (box.x <= changed.x + changed.width && box.x + box.width >= changed.x
          && box.y <= changed.y + changed.height && box.y + box.height >= changed.y) {
          return false;
        }
      }
    }
  }
  return true;
}

function orderAnnotations(annotations: Annotation[]): Annotation[] {
  return [...annotations].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    return priority || a.id.localeCompare(b.id);
  });
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

export function refineAnnotationLayout(
  layout: ResolvedLayout,
  refinement: boolean | LayoutRefinementOptions = true
): ResolvedLayout {
  const options = normalizeRefinement(refinement);

  if (!options.enabled || layout.annotations.length < 2) {
    return layout;
  }

  let current = cloneLayout(layout);
  let currentScore = refinementScore(current);
  const passes = boundedInteger(options.passes, 2, 1, 8);
  const maxCandidates = boundedInteger(options.maxCandidatesPerAnnotation, 32, 1, 256);

  for (let pass = 0; pass < passes; pass += 1) {
    let changed = false;

    for (const index of refinementOrder(current.annotations)) {
      const item = current.annotations[index];

      if (!item || item.placement.candidates.length < 2 || item.placement.manual) {
        continue;
      }

      let bestLayout = current;
      let bestScore = currentScore;

      for (const candidate of item.placement.candidates.slice(0, maxCandidates)) {
        if (sameBox(candidate.noteBox, item.noteBox)) {
          continue;
        }

        const next = applyCandidate(current, index, candidate);
        const nextScore = refinementScore(next);

        if (nextScore < bestScore - 0.0001) {
          bestLayout = next;
          bestScore = nextScore;
        }
      }

      if (bestLayout !== current) {
        current = bestLayout;
        currentScore = bestScore;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return current;
}

export function estimateNoteSize(annotation: Annotation, base: Size = DEFAULT_NOTE_SIZE): Size {
  if (annotation.note.visible === false) {
    return { width: 0, height: 0 };
  }

  const padding = annotation.note.padding === undefined
    ? DEFAULT_NOTE_PADDING
    : resolvePadding(annotation.note.padding);
  const wrap = annotation.note.wrap ?? 38;
  const splitter = annotation.note.wrapSplitter;
  const titleLines = annotation.note.title
    ? wrapNoteText(annotation.note.title, { maxChars: Math.max(18, Math.min(30, wrap)), maxLines: 2, splitter })
    : [];
  const bodyLines = annotation.note.body
    ? wrapNoteText(annotation.note.body, { maxChars: wrap, maxLines: annotation.note.maxLines ?? 4, splitter })
    : [];
  const lineHeight = noteLineVisible(annotation.note.line) ? 10 : 0;
  const longestLine = Math.max(
    0,
    ...titleLines.map((line) => line.length),
    ...bodyLines.map((line) => line.length)
  );
  const estimatedTextWidth = longestLine * 7.2 + padding.left + padding.right;
  const width = Math.min(Math.max(base.width, estimatedTextWidth), 320);
  const titleHeight = titleLines.length * 18;
  const bodyHeight = bodyLines.length * 17;
  const gap = titleLines.length > 0 && bodyLines.length > 0 ? 8 : 0;
  const height = Math.max(base.height, padding.top + padding.bottom + lineHeight + titleHeight + gap + bodyHeight);

  return { width, height };
}

function noteLineVisible(line: Annotation['note']['line']): boolean {
  if (line === undefined) {
    return false;
  }

  if (typeof line === 'boolean') {
    return line;
  }

  return line.visible !== false;
}

function noteSizeFor(annotation: Annotation, options: LayoutOptions): Size {
  if (annotation.note.visible === false) {
    return { width: 0, height: 0 };
  }

  return options.noteSizes?.[annotation.id]
    ?? estimateNoteSize(annotation, options.defaultNoteSize ?? DEFAULT_NOTE_SIZE);
}

function mergePlacement(
  base: PlacementPreference | undefined,
  override: PlacementPreference | undefined
): PlacementPreference {
  return {
    ...(base ?? {}),
    ...(override ?? {})
  };
}

function normalizeRefinement(refinement: boolean | LayoutRefinementOptions): Required<LayoutRefinementOptions> {
  if (refinement === true) {
    return {
      enabled: true,
      passes: 2,
      maxCandidatesPerAnnotation: 32
    };
  }

  if (refinement === false) {
    return {
      enabled: false,
      passes: 0,
      maxCandidatesPerAnnotation: 0
    };
  }

  return {
    enabled: refinement.enabled !== false,
    passes: refinement.passes ?? 2,
    maxCandidatesPerAnnotation: refinement.maxCandidatesPerAnnotation ?? 32
  };
}

function cloneLayout(layout: ResolvedLayout): ResolvedLayout {
  return {
    ...layout,
    annotations: [...layout.annotations]
  };
}

function refinementOrder(annotations: ResolvedAnnotation[]): number[] {
  return annotations
    .map((annotation, index) => ({ annotation, index }))
    .sort((a, b) => {
      const priority = (a.annotation.annotation.priority ?? 0) - (b.annotation.annotation.priority ?? 0);
      return priority || a.annotation.id.localeCompare(b.annotation.id);
    })
    .map((entry) => entry.index);
}

function applyCandidate(
  layout: ResolvedLayout,
  annotationIndex: number,
  candidate: PlacementCandidate
): ResolvedLayout {
  const item = layout.annotations[annotationIndex]!;
  const subject = anchorSubject(item.annotation.anchor, candidate.side);
  const annotations = [...layout.annotations];

  annotations[annotationIndex] = {
    ...item,
    subject,
    anchorPoint: subject.point,
    noteBox: candidate.noteBox,
    connector: candidate.connector,
    placement: {
      ...item.placement,
      side: candidate.side,
      offset: candidate.offset,
      align: candidate.align,
      score: candidate.score
    }
  };

  return {
    ...layout,
    annotations
  };
}

function refinementScore(layout: ResolvedLayout): number {
  const report = evaluateAnnotationLayout(layout);

  return report.metrics.invalidBoxCount * 100000
    + report.metrics.boundsOverflowArea * 20
    + report.metrics.noteOverlapArea * 35
    + report.metrics.obstacleOverlapArea * 12
    + report.metrics.connectorObstacleHits * 600
    + report.metrics.connectorNoteHits * 120;
}

function sameBox(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }): boolean {
  return first.x === second.x
    && first.y === second.y
    && first.width === second.width
    && first.height === second.height;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const finiteValue = value ?? fallback;

  if (!Number.isFinite(finiteValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(finiteValue), min), max);
}
