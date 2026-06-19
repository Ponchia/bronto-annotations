import { describe, expect, it } from 'vitest';
import {
  allPlacementCandidates,
  evaluateAnnotationLayout,
  getCandidateSides,
  refineAnnotationLayout,
  resolveAnnotationLayout,
  scorePlacementCandidate
} from '../../src/index.js';
import type {
  Annotation,
  Box,
  PlacementCandidate,
  ResolvedAnnotation,
  ResolvedLayout
} from '../../src/index.js';

describe('placement', () => {
  const baseAnnotation: Annotation = {
    id: 'target',
    anchor: {
      type: 'box',
      box: { x: 120, y: 100, width: 80, height: 40 }
    },
    note: {
      title: 'Target',
      body: 'Explains the highlighted region.'
    }
  };

  it('orders preferred sides first without dropping fallbacks', () => {
    expect(getCandidateSides({ side: 'left' })).toEqual(['left', 'top', 'right', 'bottom']);
    expect(getCandidateSides({ side: ['bottom', 'right'], allowedSides: ['right', 'left', 'bottom'] }))
      .toEqual(['bottom', 'right', 'left']);
  });

  it('is deterministic for repeated layout calls', () => {
    const input = {
      annotations: [
        baseAnnotation,
        {
          ...baseAnnotation,
          id: 'other',
          anchor: { type: 'point' as const, point: { x: 260, y: 220 } },
          priority: -1
        }
      ],
      bounds: { x: 0, y: 0, width: 420, height: 280 }
    };

    expect(resolveAnnotationLayout(input)).toEqual(resolveAnnotationLayout(input));
  });

  it('moves away from an obstacle when overlap is more expensive than side preference', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          ...baseAnnotation,
          placement: { side: 'top' }
        }
      ],
      bounds: { x: 0, y: 0, width: 420, height: 280 },
      obstacles: [
        { x: 60, y: 12, width: 200, height: 90 }
      ],
      noteSizes: {
        target: { width: 160, height: 72 }
      }
    });

    expect(layout.annotations[0]?.placement.side).not.toBe('top');
    expect(layout.annotations[0]?.placement.candidates[0]?.score).toBeLessThan(
      layout.annotations[0]?.placement.candidates.find((candidate) => candidate.side === 'top')?.score ?? 0
    );
  });

  it('adds collision cost for already placed annotations', () => {
    const candidate = scorePlacementCandidate({
      annotation: baseAnnotation,
      bounds: { x: 0, y: 0, width: 420, height: 280 },
      noteSize: { width: 160, height: 72 },
      obstacles: [],
      placedNotes: [
        { x: 80, y: 12, width: 160, height: 72 }
      ],
      placement: { side: 'top' },
      side: 'top',
      sideIndex: 0
    });

    expect(candidate.scoreBreakdown.annotations).toBeGreaterThan(0);
  });

  it('adds connector obstacle cost when a connector crosses an obstacle', () => {
    const candidate = scorePlacementCandidate({
      annotation: {
        ...baseAnnotation,
        anchor: { type: 'point', point: { x: 30, y: 90 } },
        connector: { type: 'straight', routing: 'none' }
      },
      bounds: { x: 0, y: 0, width: 320, height: 180 },
      noteSize: { width: 100, height: 50 },
      obstacles: [
        { x: 38, y: 84, width: 12, height: 16 }
      ],
      placedNotes: [],
      placement: { side: 'right', offset: 100 },
      side: 'right',
      sideIndex: 0
    });

    expect(candidate.scoreBreakdown.connectors).toBeGreaterThan(0);
  });

  it('automatically routes connectors around obstacles during placement', () => {
    const candidate = scorePlacementCandidate({
      annotation: {
        ...baseAnnotation,
        anchor: { type: 'point', point: { x: 0, y: 50 } },
        connector: { type: 'straight' }
      },
      bounds: { x: -20, y: 0, width: 180, height: 120 },
      noteSize: { width: 40, height: 20 },
      obstacles: [
        { x: 40, y: 40, width: 20, height: 20 }
      ],
      placedNotes: [],
      placement: { side: 'right', offset: 100 },
      side: 'right',
      sideIndex: 0
    });

    expect(candidate.connector.points).toEqual([
      { x: 0, y: 50 },
      { x: 0, y: 33 },
      { x: 67, y: 33 },
      { x: 67, y: 50 },
      { x: 100, y: 50 }
    ]);
    expect(candidate.scoreBreakdown.connectors).toBe(0);
  });

  it('scores manual connector waypoints against obstacles', () => {
    const obstacle = { x: 36, y: 84, width: 8, height: 16 };
    const crossed = scorePlacementCandidate({
      annotation: {
        ...baseAnnotation,
        anchor: { type: 'point', point: { x: 30, y: 92 } },
        connector: { type: 'straight' }
      },
      bounds: { x: 0, y: 0, width: 320, height: 180 },
      noteSize: { width: 100, height: 50 },
      obstacles: [obstacle],
      placedNotes: [],
      placement: { side: 'right' },
      side: 'right',
      sideIndex: 0
    });
    const routed = scorePlacementCandidate({
      annotation: {
        ...baseAnnotation,
        anchor: { type: 'point', point: { x: 30, y: 92 } },
        connector: {
          type: 'straight',
          points: [
            { x: 30, y: 60 },
            { x: 80, y: 60 },
            { x: 80, y: 92 }
          ]
        }
      },
      bounds: { x: 0, y: 0, width: 320, height: 180 },
      noteSize: { width: 100, height: 50 },
      obstacles: [obstacle],
      placedNotes: [],
      placement: { side: 'right' },
      side: 'right',
      sideIndex: 0
    });

    expect(crossed.scoreBreakdown.connectors).toBeGreaterThan(0);
    expect(routed.scoreBreakdown.connectors).toBe(0);
    expect(routed.score).toBeLessThan(crossed.score);
  });

  it('keeps placed notes inside padded bounds', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'padded',
          anchor: { type: 'point', point: { x: 8, y: 8 } },
          note: { title: 'Padded' },
          placement: { side: 'left' }
        }
      ],
      bounds: { x: 0, y: 0, width: 240, height: 180 },
      padding: { top: 20, right: 30, bottom: 20, left: 30 },
      noteSizes: {
        padded: { width: 120, height: 60 }
      }
    });

    expect(layout.padding).toEqual({ top: 20, right: 30, bottom: 20, left: 30 });
    expect(layout.placementBounds).toEqual({ x: 30, y: 20, width: 180, height: 140 });
    expect(layout.annotations[0]?.noteBox.x).toBeGreaterThanOrEqual(30);
    expect(layout.annotations[0]?.noteBox.y).toBeGreaterThanOrEqual(20);
  });

  it('honors explicit manual note placement and records it on the resolved placement', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'manual',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Manual' },
          placement: {
            manual: { x: 180, y: 24, side: 'right', align: 'start', clamp: false }
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 360, height: 220 },
      noteSizes: {
        manual: { width: 120, height: 52 }
      }
    });
    const resolved = layout.annotations[0];

    expect(resolved?.noteBox).toEqual({ x: 180, y: 24, width: 120, height: 52 });
    expect(resolved?.placement.manual).toBe(true);
    expect(resolved?.placement.side).toBe('right');
    expect(resolved?.placement.align).toBe('start');
    expect(resolved?.placement.candidates).toHaveLength(1);
  });

  it('clamps manual note placement to placement bounds by default', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'clamped',
          anchor: { type: 'point', point: { x: 20, y: 20 } },
          note: { title: 'Clamped' },
          placement: {
            manual: { x: -80, y: -40 }
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 240, height: 160 },
      padding: 12,
      noteSizes: {
        clamped: { width: 100, height: 44 }
      }
    });

    expect(layout.annotations[0]?.noteBox).toEqual({ x: 12, y: 12, width: 100, height: 44 });
    expect(layout.annotations[0]?.placement.manual).toBe(true);
  });

  it('searches alignments, offsets, and cross-axis nudges deterministically', () => {
    const annotation: Annotation = {
      id: 'crowded',
      anchor: { type: 'box', box: { x: 92, y: 92, width: 16, height: 16 } },
      note: { title: 'Crowded' },
      placement: { side: 'right', allowedSides: ['right'] }
    };
    const layout = resolveAnnotationLayout({
      annotations: [annotation],
      bounds: { x: 0, y: 0, width: 360, height: 260 },
      obstacles: [
        { x: 124, y: 75, width: 120, height: 70 }
      ],
      noteSizes: {
        crowded: { width: 120, height: 70 }
      }
    });
    const resolved = layout.annotations[0];

    expect(resolved?.placement.side).toBe('right');
    expect(resolved?.placement.candidates.length).toBeGreaterThan(4);
    expect(resolved?.placement.candidates.some((candidate) => candidate.crossOffset !== 0)).toBe(true);
    expect(resolved?.placement.candidates[0]?.score).toBeLessThan(
      resolved?.placement.candidates.find((candidate) => candidate.crossOffset === 0)?.score ?? Number.POSITIVE_INFINITY
    );
    expect(resolved?.placement.candidates[0]?.crossOffset).not.toBe(0);
  });

  it('can limit retained debug candidates after sorting', () => {
    const candidates = allPlacementCandidates({
      annotation: baseAnnotation,
      bounds: { x: 0, y: 0, width: 420, height: 280 },
      noteSize: { width: 160, height: 72 },
      obstacles: [],
      placedNotes: [],
      placement: { maxCandidates: 5 }
    });

    expect(candidates).toHaveLength(5);
    expect(candidates[0]?.score).toBeLessThanOrEqual(candidates.at(-1)?.score ?? Number.POSITIVE_INFINITY);
  });

  it('can refine a crowded resolved layout by moving lower-priority notes to better candidates', () => {
    const highPriorityBox = { x: 24, y: 28, width: 120, height: 64 };
    const lowPriorityBox = { x: 72, y: 48, width: 120, height: 64 };
    const lowPriorityAlternative = { x: 180, y: 132, width: 120, height: 64 };
    const layout: ResolvedLayout = {
      bounds: { x: 0, y: 0, width: 340, height: 240 },
      placementBounds: { x: 0, y: 0, width: 340, height: 240 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      obstacles: [],
      annotations: [
        resolvedCandidateAnnotation('important', highPriorityBox, [highPriorityBox], 10),
        resolvedCandidateAnnotation('supporting', lowPriorityBox, [lowPriorityBox, lowPriorityAlternative], 0)
      ]
    };
    const before = evaluateAnnotationLayout(layout);
    const refined = refineAnnotationLayout(layout);
    const after = evaluateAnnotationLayout(refined);

    expect(before.metrics.noteOverlapArea).toBeGreaterThan(0);
    expect(after.metrics.noteOverlapArea).toBe(0);
    expect(refined.annotations.find((item) => item.id === 'important')?.noteBox).toEqual(highPriorityBox);
    expect(refined.annotations.find((item) => item.id === 'supporting')?.noteBox).toEqual(lowPriorityAlternative);
  });
});

function resolvedCandidateAnnotation(
  id: string,
  noteBox: Box,
  boxes: Box[],
  priority: number
): ResolvedAnnotation {
  const annotation: Annotation = {
    id,
    anchor: { type: 'point', point: { x: 40, y: 40 } },
    note: { title: id },
    connector: { type: 'straight', routing: 'none' },
    priority
  };
  const candidates = boxes.map((box, index) => candidate(box, index));

  return {
    id,
    annotation,
    subject: {
      type: 'point',
      point: { x: 40, y: 40 },
      box: { x: 40, y: 40, width: 0, height: 0 }
    },
    anchorPoint: { x: 40, y: 40 },
    noteBox,
    connector: candidates[0]!.connector,
    placement: {
      side: 'right',
      align: 'center',
      offset: 16,
      score: candidates[0]!.score,
      candidates
    }
  };
}

function candidate(noteBox: Box, index: number): PlacementCandidate {
  const connectorEnd = {
    x: noteBox.x,
    y: noteBox.y + noteBox.height / 2
  };

  return {
    side: 'right',
    align: 'center',
    offset: 16,
    crossOffset: index * 24,
    noteBox,
    rawNoteBox: noteBox,
    connector: {
      type: 'straight',
      points: [
        { x: 40, y: 40 },
        connectorEnd
      ],
      d: `M 40 40 L ${connectorEnd.x} ${connectorEnd.y}`
    },
    score: index * 10,
    scoreBreakdown: {
      preferredSide: 0,
      overflow: 0,
      obstacles: 0,
      connectors: 0,
      annotations: 0,
      distance: 0,
      alignment: 0,
      crossOffset: index * 10,
      tieBreak: index / 1000
    }
  };
}
