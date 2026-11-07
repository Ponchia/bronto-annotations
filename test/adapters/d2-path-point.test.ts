import { describe, expect, it } from 'vitest';
import { anchorPoint, evaluateAnchorAlignment, resolveAnnotationLayout } from '../../src/index.js';
import { anchorsFromD2Diagram, annotationsFromD2Diagram, type D2DiagramLike } from '../../src/adapters/d2.js';
import type { Point } from '../../src/core/model.js';

const routes: Array<{ name: string; points: Point[]; midpoint: Point }> = [
  { name: 'two endpoints', points: [{ x: 0, y: 70 }, { x: 20, y: 70 }], midpoint: { x: 10, y: 70 } },
  { name: 'unequal segments', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }], midpoint: { x: 60, y: 0 } },
  { name: 'multiple bends', points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }, { x: 20, y: 80 }], midpoint: { x: 80, y: 30 } },
  { name: 'diagonal segment', points: [{ x: 10, y: 20 }, { x: 40, y: 60 }], midpoint: { x: 25, y: 40 } },
  { name: 'repeated starting point', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 }], midpoint: { x: 10, y: 0 } },
  { name: 'single point', points: [{ x: 3, y: 7 }], midpoint: { x: 3, y: 7 } },
  { name: 'zero-length route', points: [{ x: 3, y: 7 }, { x: 3, y: 7 }], midpoint: { x: 3, y: 7 } },
];

const spec = { id: 'route-note', connectionId: 'route', note: { title: 'Route' } };
const diagramFor = (route: Point[]): D2DiagramLike => ({
  connections: [{ id: 'route', src: 'source', dst: 'target', label: 'Connection', classes: ['important'], route }]
});

describe('compiled D2 representative path point', () => {
  it.each(routes)('uses the core half-length point for $name', ({ points, midpoint }) => {
    const diagram = diagramFor(points);
    const original = structuredClone(diagram);
    for (const point of points) Object.freeze(point);
    Object.freeze(points);
    const result = anchorsFromD2Diagram(diagram, [spec])[0]!;

    expect(result.point).toEqual(midpoint);
    expect(result.point).toEqual(anchorPoint(result.anchor));
    expect(result.anchor).toEqual({ type: 'path', points });
    expect(result).toMatchObject({ id: 'route-note', d2Kind: 'connection', connectionId: 'route',
      src: 'source', dst: 'target', source: 'd2-diagram', label: 'Connection', className: 'important' });
    expect(diagram).toEqual(original);
  });

  it('agrees with the generated annotation and layout without changing route bounds', () => {
    const points = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 120 }];
    const diagram = diagramFor(points);
    const result = anchorsFromD2Diagram(diagram, [spec])[0]!;
    const annotations = annotationsFromD2Diagram(diagram, [spec]);
    const layout = resolveAnnotationLayout({ annotations, bounds: { x: 0, y: 0, width: 640, height: 360 } });

    expect(result.box).toEqual({ x: 100, y: 100, width: 100, height: 20 });
    expect(result.point).toEqual({ x: 160, y: 100 });
    expect(layout.annotations[0]?.anchorPoint).toEqual(result.point);
    const alignment = evaluateAnchorAlignment(annotations, [{ id: spec.id, point: result.point }]);
    expect(alignment.diagnostics[0]?.distance).toBe(0);
  });

  it('keeps empty routes missing and shape centers unchanged', () => {
    const diagram = { ...diagramFor([]), shapes: [{ id: 'shape', pos: { x: 20, y: 30 }, width: 80, height: 40 }] };
    const results = anchorsFromD2Diagram(diagram, [spec, { id: 'shape-note', shapeId: 'shape' }]);
    expect(results).toHaveLength(1);
    expect(results[0]?.point).toEqual({ x: 60, y: 50 });
    expect(results[0]?.box).toEqual({ x: 20, y: 30, width: 80, height: 40 });
  });
});
