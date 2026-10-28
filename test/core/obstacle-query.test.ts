import { describe, expect, it } from 'vitest';
import { createObstacleQuery } from '../../src/core/obstacle-query.js';
import { overlapArea } from '../../src/core/anchors.js';
import { segmentIntersectsBox } from '../../src/core/segment-intersection.js';
import type { Box } from '../../src/core/model.js';

const obstacles = Array.from({ length: 1000 }, (_, i) => ({
  x: (i % 25) * 400, y: Math.floor(i / 25) * 220, width: 240, height: 120
}));

describe('solve-local obstacle broad phase', () => {
  it('keeps exact overlap sums and boundary contact in original order, including duplicates', () => {
    const boxes = [...obstacles, obstacles[0]!, { x: 240, y: 0, width: 0, height: 120 }];
    const query = createObstacleQuery(boxes)!;
    for (let i = 0; i < 80; i++) {
      const box = { x: i * 37.125, y: i * 11.75, width: 321.25, height: 183.5 };
      const candidates = query(box);
      expect(candidates.reduce((sum, entry) => sum + overlapArea(box, entry), 0))
        .toBe(boxes.reduce((sum, entry) => sum + overlapArea(box, entry), 0));
      expect(candidates).toEqual(boxes.filter((entry) => entry.x <= box.x + box.width
        && entry.x + entry.width >= box.x && entry.y <= box.y + box.height
        && entry.y + entry.height >= box.y));
    }
    const point = { x: 240, y: 60 };
    const selected = query({ ...point, width: 0, height: 0 });
    expect(selected.filter((box) => segmentIntersectsBox(point, point, box))).toEqual(
      boxes.filter((box) => segmentIntersectsBox(point, point, box))
    );
    expect(selected).toHaveLength(3);
  });

  it('falls back for small, negative, nonfinite or overflowing low-level geometry', () => {
    expect(createObstacleQuery(obstacles.slice(0, 20))).toBeUndefined();
    for (const bad of [
      { x: 0, y: 0, width: -1, height: 1 },
      { x: NaN, y: 0, width: 1, height: 1 },
      { x: Number.MAX_VALUE, y: 0, width: Number.MAX_VALUE, height: 1 }
    ]) expect(createObstacleQuery([...obstacles, bad])).toBeUndefined();
    const query = createObstacleQuery(obstacles)!;
    expect(query({ x: Infinity, y: 0, width: 1, height: 1 })).toBe(obstacles);
    expect(query({ x: 0, y: 0, width: -1, height: 1 })).toBe(obstacles);
  });

  it('reduces a local query without changing the caller data', () => {
    const frozen = Object.freeze(obstacles.map((box) => Object.freeze({ ...box })));
    const before = JSON.stringify(frozen);
    const query = createObstacleQuery(frozen)!;
    expect(query({ x: 0, y: 0, width: 300, height: 140 })).toHaveLength(1);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it('keeps duplicate noninteger contributions in their original summation order', () => {
    const box: Box = { x: 0, y: 0, width: 1e10, height: 1e10 };
    const input = Array.from({ length: 60 }, (_, i) => ({
      x: i % 2 ? 1 : 0, y: 0, width: i % 3 ? 0.1 : 1e8, height: 0.3333333333333
    }));
    const query = createObstacleQuery(input)!;
    expect(query(box)).toEqual(input);
    expect(query(box).reduce((sum, item) => sum + overlapArea(box, item), 0))
      .toBe(input.reduce((sum, item) => sum + overlapArea(box, item), 0));
  });
});
