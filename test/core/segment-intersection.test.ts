import { describe, expect, it } from 'vitest';
import { segmentIntersectsBox } from '../../src/core/segment-intersection.js';
import {
  evaluateAnnotationLayout,
  resolveAnnotationLayout,
  scorePlacementCandidate
} from '../../src/index.js';
import type { Annotation, Box } from '../../src/index.js';

const distant: Box = { x: 1500, y: 1100, width: 70, height: 60 };

const annotation: Annotation = {
  id: 'remote-collinear',
  anchor: { type: 'point', point: { x: 60, y: 1100 } },
  note: { title: 'Remote' },
  connector: { type: 'straight', routing: 'none' },
  placement: { side: 'right', allowedSides: ['right'], align: 'center', allowedAligns: ['center'] }
};

describe('bounded segment / rectangle intersections shared by placement, routing and quality', () => {
  it('rejects disjoint collinear horizontal segments and distant parallel edges', () => {
    expect(segmentIntersectsBox({ x: 60, y: 1100 }, { x: 70, y: 1100 }, distant)).toBe(false);
    expect(segmentIntersectsBox({ x: 10, y: 1100 }, { x: 60, y: 1100 }, distant)).toBe(false);
    expect(segmentIntersectsBox({ x: 1600, y: 1180 }, { x: 1620, y: 1180 }, distant)).toBe(false);
  });

  it('rejects disjoint collinear vertical and diagonal segments', () => {
    const box = { x: 30, y: 40, width: 20, height: 20 };
    expect(segmentIntersectsBox({ x: 30, y: -40 }, { x: 30, y: 0 }, box)).toBe(false);
    expect(segmentIntersectsBox({ x: 0, y: 0 }, { x: 10, y: 10 }, box)).toBe(false);
  });

  it('still reports true intersections and exact boundary contacts', () => {
    const box = { x: 30, y: 40, width: 20, height: 20 };
    expect(segmentIntersectsBox({ x: 0, y: 50 }, { x: 70, y: 50 }, box)).toBe(true);
    expect(segmentIntersectsBox({ x: 30, y: 0 }, { x: 30, y: 40 }, box)).toBe(true);
    expect(segmentIntersectsBox({ x: 40, y: 50 }, { x: 41, y: 51 }, box)).toBe(true);
    expect(segmentIntersectsBox({ x: 0, y: 10 }, { x: 75, y: 65 }, box)).toBe(true);
  });

  it('does not penalize or report a distant collinear obstacle in candidate scoring', () => {
    const bounds = { x: 0, y: 0, width: 1750, height: 1450 };
    const candidateInput = {
      annotation,
      bounds,
      noteSize: { width: 92, height: 38 },
      placedNotes: [],
      placement: { side: 'right' as const, allowedSides: ['right' as const] },
      side: 'right' as const,
      sideIndex: 0,
      offset: 6,
      crossOffset: 0
    };
    const without = scorePlacementCandidate({ ...candidateInput, obstacles: [] });
    const withDistant = scorePlacementCandidate({ ...candidateInput, obstacles: [distant] });
    expect(withDistant).toEqual(without);
    expect(withDistant.scoreBreakdown.connectors).toBe(0);

    const layout = resolveAnnotationLayout({
      annotations: [annotation], bounds, obstacles: [distant],
      noteSizes: { [annotation.id]: { width: 92, height: 38 } }
    });
    const report = evaluateAnnotationLayout(layout);
    expect(report.metrics.connectorObstacleHits).toBe(0);
    expect(report.issues.filter((issue) => issue.type === 'connector-obstacle')).toHaveLength(0);
  });
});
