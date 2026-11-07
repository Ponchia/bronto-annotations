import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  assertAnnotationLayoutQuality, evaluateAnnotationLayout, formatLayoutQualityReport,
  resolveAnnotationLayout, type Box, type ResolvedLayout
} from '../../src/index.js';

const finite = (): Box => ({ x: 20, y: 20, width: 10, height: 10 });
const fields = ['x', 'y', 'width', 'height'] as const;
const invalid = fields.flatMap(field => [NaN, Infinity, -Infinity].map(value => ({
  name: `${field}=${String(value)}`, box: { ...finite(), [field]: value }
}))).concat([
  { name: 'negative width', box: { ...finite(), width: -1 } },
  { name: 'negative height', box: { ...finite(), height: -1 } },
  { name: 'overflowing right edge', box: { ...finite(), x: Number.MAX_VALUE, width: Number.MAX_VALUE } },
  { name: 'overflowing bottom edge', box: { ...finite(), y: Number.MAX_VALUE, height: Number.MAX_VALUE } }
]);
const empty = (): ResolvedLayout => resolveAnnotationLayout({
  annotations: [], bounds: { x: 0, y: 0, width: 600, height: 400 }
});
const scene = (): ResolvedLayout => resolveAnnotationLayout({
  annotations: [{ id: 'note', anchor: { type: 'point', point: { x: 80, y: 80 } },
    note: { title: 'Note' }, placement: { manual: { x: 200, y: 100, side: 'right' } } }],
  bounds: { x: 0, y: 0, width: 600, height: 400 }, noteSizes: { note: { width: 90, height: 50 } }
});

function finiteMetrics(report: ReturnType<typeof evaluateAnnotationLayout>) {
  expect(Object.values(report.metrics).every(Number.isFinite)).toBe(true);
  expect(Number.isFinite(report.score)).toBe(true);
}

describe('quality input geometry', () => {
  it.each(invalid)('rejects obstacle $name even without annotations', ({ box }) => {
    const layout = empty();
    layout.obstacles = [finite(), box];
    const report = evaluateAnnotationLayout(layout);
    expect(report).toMatchObject({ ok: false, geometryValid: false, hostContentClear: false });
    expect(report.metrics.invalidBoxCount).toBe(1);
    expect(report.issues).toContainEqual(expect.objectContaining({
      type: 'invalid-box', severity: 'error', obstacleIndex: 1
    }));
    expect(() => assertAnnotationLayoutQuality(report)).toThrow(/obstacle 1/i);
    finiteMetrics(report);
  });

  it.each(invalid)('rejects effective bounds $name without inventing overflow metrics', ({ box }) => {
    const report = evaluateAnnotationLayout(scene(), { bounds: box });
    expect(report.ok).toBe(false);
    expect(report.geometryValid).toBe(false);
    expect(report.metrics.invalidBoxCount).toBe(1);
    expect(report.metrics.boundsOverflowArea).toBe(0);
    expect(report.issues).toContainEqual(expect.objectContaining({ type: 'invalid-box', message: expect.stringMatching(/bounds/i) }));
    finiteMetrics(report);
  });

  it.each(invalid)('rejects note $name and keeps the report serializable', ({ box }) => {
    const layout = scene();
    layout.annotations[0]!.noteBox = box;
    const report = evaluateAnnotationLayout(layout);
    expect(report.ok).toBe(false);
    expect(report.metrics.invalidBoxCount).toBe(1);
    expect(report.issues).toContainEqual(expect.objectContaining({ type: 'invalid-box', annotationId: 'note' }));
    finiteMetrics(report);
  });

  it('retains original obstacle indices and counts each invalid input once', () => {
    const layout = scene();
    const onNote = { ...layout.annotations[0]!.noteBox };
    layout.obstacles = [{ ...finite(), x: NaN }, onNote, { ...finite(), y: Infinity }];
    const report = evaluateAnnotationLayout(layout);
    expect(report.metrics.invalidBoxCount).toBe(2);
    expect(report.metrics.obstacleOverlapArea).toBe(4500);
    expect(report.issues.filter(issue => issue.type === 'invalid-box').map(issue => issue.obstacleIndex)).toEqual([0, 2]);
    expect(report.issues.filter(issue => issue.type === 'obstacle-overlap').map(issue => issue.obstacleIndex)).toEqual([1]);
    expect(formatLayoutQualityReport(report)).toContain('obstacle=2');
    finiteMetrics(report);
  });

  it('uses explicit obstacles/bounds instead of superseded layout values', () => {
    const layout = scene();
    layout.obstacles = [{ ...finite(), x: NaN }];
    layout.placementBounds = { ...layout.bounds, width: NaN };
    expect(evaluateAnnotationLayout(layout, { obstacles: [], bounds: layout.bounds }).ok).toBe(true);
  });

  it('preserves valid zero-size boxes and does not mutate frozen inputs', () => {
    const layout = scene();
    layout.obstacles = [{ x: 10, y: 10, width: 0, height: 0 }, finite()];
    const before = structuredClone(layout);
    const freeze = (value: unknown): void => {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    };
    freeze(layout);
    const report = evaluateAnnotationLayout(layout);
    expect(report.ok).toBe(true);
    expect(layout).toEqual(before);
    expect(evaluateAnnotationLayout(empty(), { bounds: { x: 0, y: 0, width: 0, height: 0 } }).ok).toBe(true);
  });

  it('detects corrupted obstacles across generated positions without unconditional rejection', () => {
    fc.assert(fc.property(
      fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }),
      fc.constantFrom(...fields), fc.constantFrom(NaN, Infinity, -Infinity),
      (x, y, field, bad) => {
        const obstacle = { x, y, width: 10, height: 10 };
        const layout = empty();
        expect(evaluateAnnotationLayout(layout, { obstacles: [obstacle] }).ok).toBe(true);
        const report = evaluateAnnotationLayout(layout, { obstacles: [{ ...obstacle, [field]: bad }] });
        expect(report.ok).toBe(false);
        expect(report.metrics.invalidBoxCount).toBe(1);
        finiteMetrics(report);
      }
    ), { seed: 20261107, numRuns: 150 });
  });
});
