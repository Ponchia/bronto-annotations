/** Private, per-refinement scratch. Never retained in returned layouts. */
import { isFiniteBox, overlapArea } from './anchors.js';
import { connectorIntersections, overflowArea } from './quality-geometry.js';
import type { ResolvedAnnotation, ResolvedLayout } from './model.js';

// Bound both quadratic scratch and obstacle storage. Larger layouts retain the
// established full evaluator; the optimization must not create an unbounded
// per-session cache or alter the supported input domain.
const MAX_SCALAR_CELLS = 131072; // At most 1 MiB of Float64 storage.

export interface RefinementScoreWorkspace {
  scoreReplacement(index: number, annotation: ResolvedAnnotation): number;
  commit(index: number, annotation: ResolvedAnnotation): void;
}

export function createRefinementScoreWorkspace(layout: ResolvedLayout): RefinementScoreWorkspace | undefined {
  const count = layout.annotations.length;
  const obstacleCount = layout.obstacles.length;
  const cells = 2 * count * count + count * obstacleCount + 3 * count;
  if (!Number.isSafeInteger(cells) || cells > MAX_SCALAR_CELLS) return undefined;
  const annotations = [...layout.annotations];
  const invalid = new Float64Array(count);
  const overflow = new Float64Array(count);
  const obstacleArea = new Float64Array(count * obstacleCount);
  const connectorObstacleHits = new Float64Array(count);
  const noteArea = new Float64Array(count * count);
  const connectorNoteHits = new Float64Array(count * count);
  const positive = (value: number) => value > 0 ? value : 0;

  function update(index: number, annotation: ResolvedAnnotation): void {
    annotations[index] = annotation;
    invalid[index] = Number(!isFiniteBox(annotation.noteBox));
    overflow[index] = positive(overflowArea(annotation.noteBox, layout.placementBounds ?? layout.bounds));
    let hits = 0;
    for (let obstacleIndex = 0; obstacleIndex < obstacleCount; obstacleIndex++) {
      const obstacle = layout.obstacles[obstacleIndex]!;
      obstacleArea[index * obstacleCount + obstacleIndex] = positive(overlapArea(annotation.noteBox, obstacle));
      hits += connectorIntersections(annotation.connector, obstacle).length;
    }
    connectorObstacleHits[index] = hits;
    for (let otherIndex = 0; otherIndex < count; otherIndex++) {
      const other = annotations[otherIndex]!;
      if (otherIndex !== index) {
        const first = Math.min(index, otherIndex);
        const second = Math.max(index, otherIndex);
        // Keep argument order identical to the full evaluator as well as
        // addition order. This matters for exact floating-point parity.
        noteArea[first * count + second] = positive(overlapArea(
          annotations[first]!.noteBox, annotations[second]!.noteBox));
      }
      connectorNoteHits[index * count + otherIndex] = annotation.id === other.id
        ? 0 : connectorIntersections(annotation.connector, other.noteBox).length;
      connectorNoteHits[otherIndex * count + index] = annotation.id === other.id
        ? 0 : connectorIntersections(other.connector, annotation.noteBox).length;
    }
  }

  function score(): number {
    let invalidCount = 0;
    let overflowTotal = 0;
    let obstacleTotal = 0;
    let connectorObstacleTotal = 0;
    let noteTotal = 0;
    let connectorNoteTotal = 0;
    for (let index = 0; index < count; index++) {
      invalidCount += invalid[index]!;
      if (overflow[index]! > 0) overflowTotal += overflow[index]!;
      for (let obstacleIndex = 0; obstacleIndex < obstacleCount; obstacleIndex++) {
        const area = obstacleArea[index * obstacleCount + obstacleIndex]!;
        if (area > 0) obstacleTotal += area;
      }
      connectorObstacleTotal += connectorObstacleHits[index]!;
    }
    // Do not subtract old totals or regroup floating-point areas. Re-sum the
    // cached contributions in exactly the public quality evaluator's order.
    for (let first = 0; first < count; first++) {
      for (let second = first + 1; second < count; second++) {
        const area = noteArea[first * count + second]!;
        if (area > 0) noteTotal += area;
      }
    }
    for (let index = 0; index < connectorNoteHits.length; index++) {
      connectorNoteTotal += connectorNoteHits[index]!;
    }
    return invalidCount * 100000 + overflowTotal * 20 + noteTotal * 35
      + obstacleTotal * 12 + connectorObstacleTotal * 600 + connectorNoteTotal * 120;
  }

  for (let index = 0; index < count; index++) update(index, annotations[index]!);
  return {
    scoreReplacement(index, annotation) {
      const original = annotations[index]!;
      try {
        update(index, annotation);
        return score();
      } finally {
        // Candidate trials must not alter the next trial or authoritative base.
        update(index, original);
      }
    },
    commit: update
  };
}
