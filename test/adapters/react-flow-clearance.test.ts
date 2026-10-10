import { describe, expect, it } from 'vitest';
import { overlapArea } from '../../src/core/anchors.js';
import { allPlacementCandidates } from '../../src/core/placement.js';
import { handleClearanceOffsets } from '../../scripts/react-flow-handle-clearance.mjs';
import type { Annotation, Box, PlacementPreference } from '../../src/core/model.js';

const graphNodes = [
  { id: 'entry', box: { x: 294, y: 436, width: 250, height: 199 } },
  { id: 'action', box: { x: 613, y: 324, width: 250, height: 199 } },
  { id: 'collaboration', box: { x: 613, y: 558, width: 250, height: 186 } },
  { id: 'state', box: { x: 932, y: 558, width: 250, height: 186 } },
  { id: 'executor', box: { x: 932, y: 324, width: 250, height: 225 } }
];

function resolveHandlePlacement(placement: PlacementPreference) {
  const anchor: Annotation = {
    id: 'handle',
    anchor: { type: 'point', point: { x: 543.863, y: 536.04 } },
    note: { title: 'Graph handle' },
    connector: { type: 'straight' }
  };
  const placedNotes: Box[] = [
    { x: 325, y: 648, width: 188, height: 78 },
    { x: 384, y: 332, width: 196, height: 78 }
  ];
  const obstacles: Box[] = graphNodes.map(({ box }) => box);
  const winner = allPlacementCandidates({
    annotation: anchor,
    bounds: { x: 12, y: 12, width: 1256, height: 1076 },
    noteSize: { width: 194, height: 78 },
    placement,
    obstacles,
    placedNotes
  })[0]!;
  return {
    winner,
    obstacleOverlap: obstacles.reduce((total, box) => total + overlapArea(box, winner.noteBox), 0),
    noteOverlap: placedNotes.reduce((total, box) => total + overlapArea(box, winner.noteBox), 0)
  };
}

describe('external React Flow handle clearance recipe', () => {
  it('derives far-side candidates from the rendered owner size', () => {
    expect(handleClearanceOffsets({ nodeId: 'entry' }, graphNodes)).toEqual([18, 28, 121, 225]);
    expect(handleClearanceOffsets({ nodeId: 'compact' }, [{ id: 'compact', box: { height: 60 } }]))
      .toEqual([18, 28, 45, 86]);
    expect(handleClearanceOffsets({ nodeId: 'unknown' }, [])).toEqual([18, 28, 100, 186]);
  });

  it('escapes a dense card cluster instead of overlapping its owner and neighbors', () => {
    const narrow = resolveHandlePlacement({
      side: ['left', 'right', 'bottom'],
      align: ['center', 'start'],
      offset: [18, 28],
      crossOffset: [0, 36, -36]
    });
    expect(narrow.obstacleOverlap).toBeGreaterThan(0);

    const adaptive = resolveHandlePlacement({
      side: ['top', 'right', 'left', 'bottom'],
      align: ['center', 'start'],
      offset: handleClearanceOffsets({ nodeId: 'entry' }, graphNodes),
      crossOffset: [0, 36, -36]
    });
    expect(adaptive.winner.side).toBe('top');
    expect(adaptive.obstacleOverlap).toBe(0);
    expect(adaptive.noteOverlap).toBe(0);
    expect(adaptive.winner.noteBox.y + adaptive.winner.noteBox.height).toBeLessThan(graphNodes[1]!.box.y);
  });
});
