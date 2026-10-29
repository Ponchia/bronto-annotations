import { describe, expect, it } from 'vitest';
import { layoutAnnotationPins } from '../../src/index.js';
import { overlapArea } from '../../src/core/anchors.js';
const bounds = { x: 0, y: 0, width: 300, height: 220 };
const pin = (id: string, x = 100, y = 100, priority = 0) => ({ id, point: { x, y }, size: { width: 44, height: 44 }, priority });

describe('bounded two-dimensional pins', () => {
  it('keeps selected priority, source order and every omitted identity', () => {
    const result = layoutAnnotationPins([pin('a'), pin('selected', 100, 100, 1), pin('z', 200), pin('last', 200, 180)], { bounds, limit: 2 });
    expect(result.placements.map((item) => item.id)).toEqual(['selected', 'last']);
    expect(result.omitted).toEqual([{ id: 'a', reason: 'collision' }, { id: 'z', reason: 'limit' }]);
    expect(result.placements.every((item) => !item.leader)).toBe(true);
  });
  it('reports impossible scenes without shrinking or silently dropping targets', () => {
    const result = layoutAnnotationPins([pin('__proto__'), pin('constructor'), pin('toString')], { bounds: { x: 75, y: 75, width: 50, height: 50 } });
    expect(result.placements).toHaveLength(1); expect(result.omitted).toHaveLength(2);
    expect(result.placements[0]?.box.width).toBe(44);
  });
  it('never fabricates edge pins for off-screen anchors and never moves without opt-in', () => {
    expect(layoutAnnotationPins([pin('outside', -1), pin('near', 5)], { bounds }).omitted).toEqual([
      { id: 'outside', reason: 'bounds' }, { id: 'near', reason: 'bounds' }
    ]);
    const result = layoutAnnotationPins([pin('near', 5)], { bounds, maxDisplacement: 30 });
    expect(result.placements[0]?.point.x).toBe(22);
    expect(result.placements[0]?.leader).toEqual({ from: { x: 5, y: 100 }, to: { x: 22, y: 100 } });
  });
  it('uses bounded alternatives with leaders and protects obstacles and hit areas', () => {
    const inputs = [pin('a'), pin('b'), pin('c')];
    const snapshot = JSON.stringify(inputs);
    const result = layoutAnnotationPins(inputs, { bounds, maxDisplacement: 100, obstacles: [{ x: 0, y: 0, width: 60, height: 60 }] });
    expect(result.placements).toHaveLength(3);
    for (const item of result.placements) {
      expect(item.box.x).toBeGreaterThanOrEqual(0);
      expect(item.box.y + item.box.height).toBeLessThanOrEqual(220);
      for (const other of result.placements) if (other.id !== item.id) expect(overlapArea(item.box, other.box)).toBe(0);
    }
    expect(JSON.stringify(inputs)).toBe(snapshot);
    expect(layoutAnnotationPins(inputs, { bounds, maxDisplacement: 100, obstacles: [{ x: 0, y: 0, width: 60, height: 60 }] })).toEqual(result);
  });
  it('rejects duplicate IDs, nonfinite geometry, impossible options and invalid sizes', () => {
    expect(() => layoutAnnotationPins([pin('a'), pin('a')], { bounds })).toThrow(/unique/);
    expect(() => layoutAnnotationPins([pin('a', NaN)], { bounds })).toThrow(/finite/);
    expect(() => layoutAnnotationPins([{ ...pin('a'), size: { width: 0, height: 44 } }], { bounds })).toThrow(/positive/);
    expect(() => layoutAnnotationPins([], { bounds, limit: -1 })).toThrow(/limit/);
    expect(() => layoutAnnotationPins([], { bounds, gap: Infinity })).toThrow(/gap/);
    expect(() => layoutAnnotationPins([], { bounds: { ...bounds, width: -1 } })).toThrow(/bounds/);
    expect(layoutAnnotationPins([pin('a')], { bounds, limit: 0 }).omitted).toEqual([{ id: 'a', reason: 'limit' }]);
  });
});
