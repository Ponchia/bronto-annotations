import { orderAnnotations, assertUniqueAnnotationIds, compareAnnotationIds } from './layout-order.js';
import { anchorSubject, insetBox, isFiniteBox, normalizeBox, resolvePadding } from './anchors.js';
import { allPlacementCandidates, assertPlacementPreference } from './placement.js';
import { DEFAULT_NOTE_SIZE, DEFAULT_NOTE_PADDING } from './model.js';
import { evaluateAnnotationLayout } from './quality.js';
import { createRefinementScoreWorkspace } from './refinement-score.js';
import { wrapNoteText, countTextGraphemes } from './text.js';
import type { Annotation, Box, LayoutDiagnostics, LayoutOptions, LayoutRefinementOptions, PlacementCandidate, PlacementPreference, ResolvedAnnotation, ResolvedLayout, Size } from './model.js';

export function resolveAnnotationLayout(options: LayoutOptions): ResolvedLayout {
  return resolveAnnotationLayoutFrom(options);
}

/** @internal Compute a suffix after an unchanged greedy prefix. Reused
 * diagnostics must already cover the requested retention. Refinement always
 * starts with a complete search, since it can move earlier winners.
 */
export function resolveAnnotationLayoutFrom(
  options: LayoutOptions,
  reused: ResolvedAnnotation[] = [],
  reusedDiagnostics?: LayoutDiagnostics
): ResolvedLayout {
  validateLayoutOptions(options);
  const diagnosticLimit = options.diagnostics?.candidates;
  const refinement = normalizeRefinement(options.refinement ?? false);
  const frontierLimit = refinement.enabled
    ? boundedInteger(refinement.maxCandidatesPerAnnotation, 32, 1, 256) : 1;
  const limit = diagnosticLimit === 'all' ? undefined : Math.max(frontierLimit, diagnosticLimit ?? 1);
  const workspace: PlacementCandidate[][] = [];
  const diagnostics: LayoutDiagnostics | undefined = diagnosticLimit === undefined
    ? undefined : { annotations: [] };
  const bounds = normalizeBox(options.bounds);
  const padding = resolvePadding(options.padding);
  const placementBounds = insetBox(bounds, padding);
  const obstacles = (options.obstacles ?? [])
    .map(normalizeBox)
    .filter(isFiniteBox);
  const placedNotes: ResolvedAnnotation[] = [...reused];
  // Reuse the existing prefix's original winners and avoid recomputing their
  // connector routing / placement scores when later annotations change.
  const placedNoteBoxes: Box[] = [];
  const ordered = orderAnnotations(options.annotations);

  for (const [index, item] of reused.entries()) {
    if (diagnostics && diagnosticLimit !== undefined) {
      const retained = reusedDiagnostics?.annotations[index];
      const candidates = retained?.id === item.id
        ? diagnosticLimit === 'all' || retained.candidates.length <= diagnosticLimit
          ? retained.candidates : retained.candidates.slice(0, diagnosticLimit)
        : allPlacementCandidates({
          annotation: ordered[index]!, bounds: placementBounds,
          noteSize: noteSizeFor(ordered[index]!, options), obstacles,
          placedNotes: placedNoteBoxes,
          placement: mergePlacement(options.placement, ordered[index]!.placement)
        }, diagnosticLimit === 'all' ? {} : { limit: diagnosticLimit });
      diagnostics.annotations.push({ id: item.id, candidates });
    }
    placedNoteBoxes.push(item.noteBox);
  }

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
    }, { limit });
    const winner = candidates[0];
    const subject = anchorSubject(annotation.anchor, winner?.side);

    if (!winner) {
      continue;
    }

    placedNoteBoxes.push(winner.noteBox);
    if (refinement.enabled) workspace.push(candidates.slice(0, frontierLimit));
    if (diagnostics) {
      diagnostics.annotations.push({
        id: annotation.id,
        candidates: diagnosticLimit === 'all' ? candidates : candidates.slice(0, diagnosticLimit)
      });
    }
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
        ...(placement.manual ? { manual: true } : {})
      }
    });
  }

  const layout = {
    bounds,
    placementBounds,
    padding,
    annotations: placedNotes,
    obstacles,
    ...(diagnostics ? { diagnostics } : {})
  };

  return refinement.enabled
    ? refineAnnotationLayout(layout, workspace, refinement)
    : layout;
}

/** @internal Refine using the solver's private, ranked greedy search frontier. */
export function refineAnnotationLayout(
  layout: ResolvedLayout,
  workspace: PlacementCandidate[][],
  refinement: boolean | LayoutRefinementOptions = true
): ResolvedLayout {
  const options = normalizeRefinement(refinement);

  if (!options.enabled || layout.annotations.length < 2) {
    return layout;
  }

  let current = cloneLayout(layout);
  let currentScore = refinementScore(current);
  // Every score contribution is nonnegative: zero is already a global lower
  // bound. Preserve the existing shallow-clone return behavior without trials.
  if (currentScore === 0) return current;
  const scoring = createRefinementScoreWorkspace(current);
  const passes = boundedInteger(options.passes, 2, 1, 8);
  const maxCandidates = boundedInteger(options.maxCandidatesPerAnnotation, 32, 1, 256);

  for (let pass = 0; pass < passes; pass += 1) {
    let changed = false;

    for (const index of refinementOrder(current.annotations)) {
      const item = current.annotations[index];

      const candidates = workspace[index];
      if (!item || !candidates || candidates.length < 2 || item.placement.manual) {
        continue;
      }

      let bestLayout = current;
      let bestScore = currentScore;

      for (const candidate of candidates.slice(0, maxCandidates)) {
        if (sameBox(candidate.noteBox, item.noteBox)) {
          continue;
        }

        const next = applyCandidate(current, index, candidate);
        const nextScore = scoring
          ? scoring.scoreReplacement(index, next.annotations[index]!)
          : refinementScore(next);

        if (nextScore < bestScore - 0.0001) {
          bestLayout = next;
          bestScore = nextScore;
        }
      }

      if (bestLayout !== current) {
        current = bestLayout;
        currentScore = bestScore;
        scoring?.commit(index, current.annotations[index]!);
        changed = true;
        if (currentScore === 0) return current;
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
    ...titleLines.map(countTextGraphemes),
    ...bodyLines.map(countTextGraphemes)
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

export function noteSizeFor(annotation: Annotation, options: LayoutOptions): Size {
  if (annotation.note.visible === false) {
    return { width: 0, height: 0 };
  }

  // Annotation IDs are arbitrary host strings, including "__proto__" and
  // "constructor". A plain noteSizes object inherits those properties even
  // when the host never specified a size for the annotation. Only an *own*
  // entry may override the estimate, regardless of the map's prototype.
  const sizes = options.noteSizes;
  const supplied = sizes && Object.hasOwn(sizes, annotation.id)
    ? sizes[annotation.id] : undefined;
  return supplied ?? estimateNoteSize(annotation, options.defaultNoteSize ?? DEFAULT_NOTE_SIZE);
}

export function mergePlacement(
  base: PlacementPreference | undefined,
  override: PlacementPreference | undefined
): PlacementPreference {
  assertPlacementPreference(base);
  assertPlacementPreference(override);
  return {
    ...(base ?? {}),
    ...(override ?? {})
  };
}

/** @internal Validate even no-op incremental updates and empty layouts. */
export function validateLayoutOptions(options: LayoutOptions): void {
  assertUniqueAnnotationIds(options.annotations);
  assertPlacementPreference(options.placement);
  for (const annotation of options.annotations) assertPlacementPreference(annotation.placement);
  const diagnostics = options.diagnostics;
  if (diagnostics !== undefined && (!diagnostics || typeof diagnostics !== 'object'
    || Array.isArray(diagnostics)
    || (diagnostics.candidates !== 'all'
      && (!Number.isSafeInteger(diagnostics.candidates) || diagnostics.candidates <= 0)))) {
    throw new TypeError("diagnostics.candidates must be a positive safe integer or 'all'; omit diagnostics to disable collection");
  }
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
      return priority || compareAnnotationIds(a.annotation.id, b.annotation.id);
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
