import { anchorSubject } from '../../src/core/anchors.js';
import { compareAnnotationIds } from '../../src/core/layout-order.js';
import { evaluateAnnotationLayout } from '../../src/core/quality.js';
import type { PlacementCandidate, ResolvedLayout } from '../../src/core/model.js';

export function fullQualityRefinementScore(layout: ResolvedLayout): number {
  const { metrics } = evaluateAnnotationLayout(layout);
  return metrics.invalidBoxCount * 100000 + metrics.boundsOverflowArea * 20
    + metrics.noteOverlapArea * 35 + metrics.obstacleOverlapArea * 12
    + metrics.connectorObstacleHits * 600 + metrics.connectorNoteHits * 120;
}

/** Reference algorithm from the pre-optimization implementation. */
export function eagerRefinementReference(layout: ResolvedLayout, workspace: PlacementCandidate[][],
  passes = 2, maxCandidates = 8): ResolvedLayout {
  if (layout.annotations.length < 2) return layout;
  let current = { ...layout, annotations: [...layout.annotations] };
  let score = fullQualityRefinementScore(current);
  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    const order = current.annotations.map((annotation, index) => ({ annotation, index }))
      .sort((a, b) => (a.annotation.annotation.priority ?? 0) - (b.annotation.annotation.priority ?? 0)
        || compareAnnotationIds(a.annotation.id, b.annotation.id)).map((entry) => entry.index);
    for (const index of order) {
      const item = current.annotations[index]!;
      const candidates = workspace[index];
      if (!candidates || candidates.length < 2 || item.placement.manual) continue;
      let best = current;
      let bestScore = score;
      for (const candidate of candidates.slice(0, maxCandidates)) {
        const a = candidate.noteBox, b = item.noteBox;
        if (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height) continue;
        const subject = anchorSubject(item.annotation.anchor, candidate.side);
        const annotations = [...current.annotations];
        annotations[index] = { ...item, subject, anchorPoint: subject.point,
          noteBox: candidate.noteBox, connector: candidate.connector,
          placement: { ...item.placement, side: candidate.side, offset: candidate.offset,
            align: candidate.align, score: candidate.score } };
        const next = { ...current, annotations };
        const nextScore = fullQualityRefinementScore(next);
        if (nextScore < bestScore - 0.0001) { best = next; bestScore = nextScore; }
      }
      if (best !== current) { current = best; score = bestScore; changed = true; }
    }
    if (!changed) break;
  }
  return current;
}
