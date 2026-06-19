import { describe, expect, it } from 'vitest';
import {
  anchorPoint,
  anchorSubject,
  boxFromPoints,
  boxSidePoint,
  overlapArea
} from '../../src/index.js';

describe('anchors', () => {
  it('resolves box sides deterministically', () => {
    const box = { x: 10, y: 20, width: 100, height: 60 };

    expect(boxSidePoint(box, 'top')).toEqual({ x: 60, y: 20 });
    expect(boxSidePoint(box, 'right')).toEqual({ x: 110, y: 50 });
    expect(anchorPoint({ type: 'box', box, side: 'bottom' })).toEqual({ x: 60, y: 80 });
  });

  it('uses the midpoint of a path as its anchor point', () => {
    const subject = anchorSubject({
      type: 'path',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 }
      ]
    });

    expect(subject.point).toEqual({ x: 100, y: 0 });
    expect(boxFromPoints(subject.type === 'path' ? subject.points : [])).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100
    });
  });

  it('calculates overlap as area, not edge contact', () => {
    expect(overlapArea(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 10, y: 10, width: 20, height: 20 }
    )).toBe(100);
    expect(overlapArea(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 20, y: 0, width: 20, height: 20 }
    )).toBe(0);
  });
});
