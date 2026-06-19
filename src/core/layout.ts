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
  LayoutOptions,
  LayoutRefinementOptions,
  PlacementCandidate,
  PlacementPreference,
  ResolvedAnnotation,
  ResolvedLayout,
  Size
} from './model.js';

export function resolveAnnotationLayout(options: LayoutOptions): ResolvedLayout {
  const bounds = normalizeBox(options.bounds);
  const padding = resolvePadding(options.padding);
  const placementBounds = insetBox(bounds, padding);
  const obstacles = (options.obstacles ?? [])
    .map(normalizeBox)
    .filter(isFiniteBox);
  const placedNotes: ResolvedAnnotation[] = [];
  const ordered = [...options.annotations].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    return priority || a.id.localeCompare(b.id);
  });

  for (const annotation of ordered) {
    const placement = mergePlacement(options.placement, annotation.placement);
    const noteSize = noteSizeFor(annotation, options);
    const candidates = allPlacementCandidates({
      annotation,
      bounds: placementBounds,
      noteSize,
      obstacles,
      placedNotes: placedNotes.map((item) => item.noteBox),
      placement
    });
    const winner = candidates[0];
    const subject = anchorSubject(annotation.anchor, winner?.side);

    if (!winner) {
      continue;
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
