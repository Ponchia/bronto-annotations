import { describe, expect, it } from 'vitest';
import { createObstacleQuery } from '../../src/core/obstacle-query.js';
import { allPlacementCandidates, searchPlacementCandidates } from '../../src/core/placement.js';
import type { Annotation, Box } from '../../src/core/model.js';

const boxes = (n: number): Box[] => Array.from({ length: n }, (_, i) => ({
  x: (i % 20) * 320, y: Math.floor(i / 20) * 220, width: 160, height: 100
}));

describe('conservative obstacle broad phase', () => {
  it('keeps contact, duplicate entries and original order while rejecting distant rectangles', () => {
    const input = boxes(1000);
    input.push(input[0]!);
    const query = createObstacleQuery(input);
    expect(query({ x: 160, y: 0, width: 160, height: 0 })).toEqual([input[0], input[1], input[1000]]);
    expect(query({ x: 10, y: 10, width: 1, height: 1 })).toEqual([input[0], input[1000]]);
    expect(query({ x: -100, y: -100, width: 1, height: 1 })).toEqual([]);
  });

  it('retains the linear behavior for small, invalid and nonfinite query geometry', () => {
    const input = boxes(63);
    expect(createObstacleQuery(input)({ x: 0, y: 0, width: 1, height: 1 })).toBe(input);
    const malformed = [...boxes(64), { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 10 }];
    expect(createObstacleQuery(malformed)({ x: 0, y: 0, width: 1, height: 1 })).toBe(malformed);
    const normal = boxes(100);
    expect(createObstacleQuery(normal)({ x: NaN, y: 0, width: 1, height: 1 })).toBe(normal);
  });

  it('does not reuse stale geometry when a caller mutates its obstacles between searches', () => {
    const input = boxes(100);
    const bounds = { x: -20, y: -20, width: 1, height: 1 };
    expect(createObstacleQuery(input)(bounds)).toEqual([]);
    input[0]!.x = -20;
    input[0]!.y = -20;
    expect(createObstacleQuery(input)(bounds)).toEqual([input[0]]);
  });

  it.each(Array.from({ length: 12 }, (_, seed) => seed))('matches the linear scorer for ranked, bounded, manual and routed search %i', (seed) => {
    let state = 12977 + seed;
    const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
      const obstacles = Array.from({ length: 96 }, () => ({
        x: Math.floor(next() * 2000) - 400, y: Math.floor(next() * 1400) - 300,
        width: next() * 180, height: next() * 100
      }));
      const annotation: Annotation = {
        id: `note-${seed}`, anchor: { type: 'point', point: { x: 50 + next() * 300, y: 50 + next() * 200 } },
        note: { title: 'Readable note' },
        // Bound the routing graph in this scoring-parity test; full default
        // routing is exercised by the public-API consumer comparison.
        connector: { type: seed % 2 ? 'straight' : 'elbow', routing: { mode: 'orthogonal', maxObstacles: 8 } }
      };
      const input = { annotation, bounds: { x: -200, y: -150, width: 1200, height: 800 },
        noteSize: { width: 156, height: 64 }, obstacles, placedNotes: [{ x: 400, y: 200, width: 180, height: 70 }],
        placement: seed % 3 === 0 ? { manual: { x: 180, y: 90, clamp: false } } : { offset: [16, 40], crossOffset: [-20, 0, 20] }
      };
      for (const options of [{}, { limit: 1 }, { limit: 8 }]) {
        expect(allPlacementCandidates(input, options)).toEqual(searchPlacementCandidates(input, options, () => obstacles));
      }
  });
});
