import { describe, expect, it } from 'vitest';
import { evaluateAnnotationLayout, resolveAnnotationLayout, resolvePreparedAnnotationLayout } from '../../src/index.js';
import { prepareD2DiagramAnnotations } from '../../src/adapters/d2.js';

function prepared() {
  return prepareD2DiagramAnnotations({ shapes: [
    { id: 'selected', pos: { x: 100, y: 100 }, width: 50, height: 30 },
    { id: 'invalid-obstacle', pos: { x: NaN, y: 0 }, width: 20, height: 20 }
  ] }, [{ id: 'note', shapeId: 'selected', note: { title: 'Selected' },
    placement: { manual: { x: 250, y: 100, side: 'right' } } }], { assert: true });
}
const options = { bounds: { x: 0, y: 0, width: 600, height: 400 },
  noteSizes: { note: { width: 90, height: 50 } } };

describe('prepared quality input boundary', () => {
  it('reports unselected invalid host obstacles despite selected-anchor validation passing', () => {
    const input = prepared();
    const originalIndex = input.obstacles.findIndex(box => !Number.isFinite(box.x));
    expect(input.validation.ok).toBe(true);
    const result = resolvePreparedAnnotationLayout(input, options);
    expect(result.quality.ok).toBe(false);
    expect(result.quality.metrics.invalidBoxCount).toBe(1);
    expect(result.quality.issues).toContainEqual(expect.objectContaining({ type: 'invalid-box', obstacleIndex: originalIndex }));
    expect(result.obstacles).toEqual(input.obstacles);
    expect(() => resolvePreparedAnnotationLayout(input, { ...options, assertQuality: true }))
      .toThrow(/invalid|finite/i);
  });

  it('checks additional obstacles and honors explicit exclusion of prepared obstacles', () => {
    const input = prepared();
    expect(resolvePreparedAnnotationLayout(input, { ...options, includePreparedObstacles: false, assertQuality: true }).quality.ok).toBe(true);
    expect(() => resolvePreparedAnnotationLayout(input, { ...options, includePreparedObstacles: false,
      additionalObstacles: [{ x: 0, y: 0, width: Infinity, height: 20 }], assertQuality: true }))
      .toThrow(/obstacle 0/i);
  });

  it('normalizes finite negative obstacle dimensions while retaining the original prepared data', () => {
    const input = prepared();
    input.obstacles = [{ x: 430, y: 250, width: -20, height: -10 }];
    const before = structuredClone(input);
    const result = resolvePreparedAnnotationLayout(input, { ...options, assertQuality: true });
    expect(result.quality.ok).toBe(true);
    expect(result.layout.obstacles).toEqual([{ x: 410, y: 240, width: 20, height: 10 }]);
    expect(input).toEqual(before);
  });

  it('keeps raw resolution permissive but allows quality inspection of original obstacles', () => {
    const input = prepared();
    const layout = resolveAnnotationLayout({ ...options, annotations: input.annotations, obstacles: input.obstacles });
    expect(layout.obstacles.every(box => Number.isFinite(box.x))).toBe(true);
    expect(evaluateAnnotationLayout(layout).ok).toBe(true);
    const report = evaluateAnnotationLayout(layout, { obstacles: input.obstacles });
    expect(report.ok).toBe(false);
    expect(report.metrics.invalidBoxCount).toBe(1);
  });
});
