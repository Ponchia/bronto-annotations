import { expect, it } from 'vitest';
import { layoutAnnotationPins } from '../../src/core/pins.js';
import { overlapArea } from '../../src/core/anchors.js';
const bounds = { x: 0, y: 0, width: 400, height: 300 };
const pin = (id: string, x = 180, y = 120, priority = 0) => ({ id, anchor: { x, y }, size: { width: 44, height: 44 }, priority });

it('places nearby pins disjointly, keeps the priority anchor and preserves input reading order', () => {
  const pins = [pin('b'), pin('a', 180, 120, 10), pin('c')];
  const layout = layoutAnnotationPins({ pins, bounds });
  expect(layout.pins.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  expect(layout.pins.find((p) => p.id === 'a')?.point).toEqual({ x: 180, y: 120 });
  expect(layout.omitted).toEqual([]);
  for (const a of layout.pins) for (const b of layout.pins) {
    if (a.id !== b.id) expect(overlapArea(a.box, b.box)).toBe(0);
  }
  expect(layoutAnnotationPins({ pins: [...pins].reverse(), bounds }).pins.reverse()).toEqual(layout.pins);
});
it('reports every omission and never invents a viewport-edge target for an offscreen anchor', () => {
  const result = layoutAnnotationPins({ pins: [pin('off', -1), pin('a'), pin('b')], bounds, maxDisplacement: 0 });
  expect(result.pins.map((p) => p.id)).toEqual(['a']);
  expect(result.omitted).toEqual([{ id: 'off', reason: 'outside' }, { id: 'b', reason: 'collision' }]);
  expect(layoutAnnotationPins({ pins: [pin('a'), pin('b')], bounds, maxVisible: 1 }).omitted).toEqual([{ id: 'b', reason: 'limit' }]);
});
it('keeps controls inside the supplied safe area and clear of host obstacles', () => {
  const obstacle = { x: 150, y: 90, width: 60, height: 60 };
  const result = layoutAnnotationPins({ pins: [pin('x')], bounds, obstacles: [obstacle], maxDisplacement: 80 });
  expect(result.pins).toHaveLength(1);
  expect(overlapArea(result.pins[0]!.box, obstacle)).toBe(0);
  expect(layoutAnnotationPins({ pins: [pin('edge', 1, 1)], bounds, maxDisplacement: 0 }).omitted[0]?.reason).toBe('outside');
  expect(layoutAnnotationPins({ pins: [pin('edge', 1, 1)], bounds }).pins).toHaveLength(1);
});
it('fails on invalid geometry, duplicate ids and invalid workload caps', () => {
  expect(() => layoutAnnotationPins({ pins: [pin('x'), pin('x')], bounds })).toThrow(/unique/);
  expect(() => layoutAnnotationPins({ pins: [pin('x', NaN)], bounds })).toThrow(/finite/);
  for (const maxVisible of [-1, NaN, 1.2, Infinity]) expect(() => layoutAnnotationPins({ pins: [], bounds, maxVisible })).toThrow();
  expect(() => layoutAnnotationPins({ pins: [], bounds, gap: -1 })).toThrow();
  expect(() => layoutAnnotationPins({ pins: [], bounds: { ...bounds, width: Infinity } })).toThrow();
});
it('supports reserved ids and does not mutate host records', () => {
  const pins = [pin('__proto__'), pin('constructor')];
  const before = structuredClone(pins);
  const result = layoutAnnotationPins({ pins, bounds });
  result.pins[0]!.anchor.x = 3;
  expect(pins).toEqual(before);
  expect(result.pins).toHaveLength(2);
});
