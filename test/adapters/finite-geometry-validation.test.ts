import { describe, expect, it, vi } from 'vitest';
import {
  anchorsFromD2Diagram,
  prepareD2DiagramAnnotations,
  validateD2DiagramAnchors,
  type D2DiagramLike
} from '../../src/adapters/d2.js';
import {
  anchorsFromVegaView,
  prepareVegaScaleAnnotations,
  prepareVegaScenegraphAnnotations,
  prepareVegaViewAnnotations,
  validateVegaScaleAnchors,
  validateVegaScenegraphAnchors,
  validateVegaViewAnchors,
  type VegaScaleViewLike,
  type VegaScenegraphItem,
  type VegaViewAnchorSpec
} from '../../src/adapters/vega.js';
import type { AnchorSpecValidationReport } from '../../src/adapters/diagnostics.js';
import type { Point } from '../../src/core/model.js';

const strict = { assert: true, obstacles: false } as const;
const permissive = { obstacles: false } as const;
const shapeSpec = [{ id: 'note', shapeId: 'shape' }];
const routeSpec = [{ id: 'note', connectionId: 'edge' }];
const max = Number.MAX_VALUE;

function expectInvalid(report: AnchorSpecValidationReport, source: string) {
  expect(report.ok).toBe(false);
  expect(report.found).toEqual([]);
  expect(report.diagnostics).toEqual([expect.objectContaining({
    id: 'note', source, status: 'invalid', found: false,
    reason: expect.stringMatching(/finite/i)
  })]);
}

function diagramWithRoute(route: Point[]): D2DiagramLike {
  return { connections: [{ id: 'edge', src: 'a', dst: 'b', route }] };
}

describe('compiled D2 resolved geometry validation', () => {
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite shape components (%s)', (value) => {
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      const box = { x: 10, y: 20, width: 30, height: 40, [field]: value };
      const diagram = { shapes: [{ id: 'shape', pos: { x: box.x, y: box.y }, width: box.width, height: box.height }] };
      expectInvalid(validateD2DiagramAnchors(diagram, shapeSpec), 'd2-diagram');
      expect(() => prepareD2DiagramAnnotations(diagram, shapeSpec, strict)).toThrow(/finite/i);
      const prepared = prepareD2DiagramAnnotations(diagram, shapeSpec, permissive);
      expect(prepared.validation.ok).toBe(false);
      expect(prepared.annotations[0]?.anchor).toEqual({ type: 'box', box });
      expect(anchorsFromD2Diagram(diagram, shapeSpec)).toHaveLength(1);
    }
  });

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite route coordinates (%s)', (value) => {
    for (const field of ['x', 'y'] as const) {
      const route = [{ x: 0, y: 0 }, { x: 2, y: 3, [field]: value }, { x: 10, y: 10 }];
      const diagram = diagramWithRoute(route);
      expectInvalid(validateD2DiagramAnchors(diagram, routeSpec), 'd2-diagram');
      expect(() => prepareD2DiagramAnnotations(diagram, routeSpec, strict)).toThrow(/finite/i);
      expect(prepareD2DiagramAnnotations(diagram, routeSpec, permissive).annotations[0]?.anchor)
        .toEqual({ type: 'path', points: route });
    }
  });

  it.each([
    [{ x: -max, y: 0 }, { x: max, y: 0 }],
    [{ x: 0, y: 0 }, { x: max, y: max }]
  ])('rejects overflowing route bounds or midpoint', (...route) => {
    const diagram = diagramWithRoute(route);
    expectInvalid(validateD2DiagramAnchors(diagram, routeSpec), 'd2-diagram');
    expect(() => prepareD2DiagramAnnotations(diagram, routeSpec, strict)).toThrow(/finite/i);
  });

  it('rejects overflowing shape extents even when its center is finite', () => {
    const diagram = { shapes: [{ id: 'shape', pos: { x: max * 0.75, y: 0 }, width: max / 2, height: 0 }] };
    expect(Number.isFinite(anchorsFromD2Diagram(diagram, shapeSpec)[0]?.point.x)).toBe(true);
    expectInvalid(validateD2DiagramAnchors(diagram, shapeSpec), 'd2-diagram');
    expect(() => prepareD2DiagramAnnotations(diagram, shapeSpec, strict)).toThrow(/finite/i);
  });

  it.each([
    [{ x: 3, y: 4 }],
    [{ x: 3, y: 4 }, { x: 3, y: 4 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 90 }]
  ])('preserves finite single-point, zero-length and bent routes', (...route) => {
    expect(prepareD2DiagramAnnotations(diagramWithRoute(route), routeSpec, strict).validation.ok).toBe(true);
  });

  it('preserves shape precedence over a same-label invalid connection and finite dimensions', () => {
    const diagram = {
      shapes: [{ id: 'shape', label: 'shared', pos: { x: 10, y: 20 }, width: -5, height: 0 }],
      connections: [{ id: 'edge', label: 'shared', src: 'a', dst: 'b', route: [{ x: NaN, y: 0 }] }]
    };
    const specs = [{ id: 'note', label: 'shared' }];
    expect(prepareD2DiagramAnnotations(diagram, specs, strict).validation.ok).toBe(true);
    expect(anchorsFromD2Diagram(diagram, specs)[0]?.shapeId).toBe('shape');
  });

  it('preserves missing-target and empty-route diagnostics', () => {
    expect(validateD2DiagramAnchors({}, shapeSpec).diagnostics[0]).toMatchObject({
      status: 'missing', reason: 'No compiled D2 shape or connection matched shape id "shape".'
    });
    expect(validateD2DiagramAnchors(diagramWithRoute([]), routeSpec).diagnostics[0]).toMatchObject({
      status: 'missing', reason: 'D2 connection matched connection id "edge", but it has no route points.'
    });
  });
});

describe('Vega resolved geometry validation', () => {
  const view = { data: () => [{ x: 10, y: 20 }] };
  const viewCases: Array<[string, VegaViewAnchorSpec<{ x: number; y: number }>]> = [
    ['NaN point', { id: 'note', point: () => ({ x: NaN, y: 0 }) }],
    ['infinite point', { id: 'note', point: () => ({ x: 0, y: -Infinity }) }],
    ['NaN box', { id: 'note', box: () => ({ x: 0, y: NaN, width: 1, height: 2 }) }],
    ['infinite box dimension', { id: 'note', box: () => ({ x: 0, y: 0, width: Infinity, height: 2 }) }],
    ['infinite offset', { id: 'note', x: 'x', y: 'y', offset: { x: Infinity, y: 0 } }],
    ['overflowing translation', { id: 'note', point: () => ({ x: max, y: 0 }), offset: { x: max, y: 0 } }],
    ['overflowing extent', { id: 'note', box: () => ({ x: max * 0.75, y: 0, width: max / 2, height: 0 }) }],
    ['overflowing endpoint difference', { id: 'note', x: () => -max, y: 'y', x2: () => max, y2: 'y' }]
  ];

  it.each(viewCases)('rejects %s without changing permissive view extraction', (_, spec) => {
    expectInvalid(validateVegaViewAnchors(view, [spec]), 'vega-view');
    expect(() => prepareVegaViewAnnotations(view, [spec], strict)).toThrow(/finite/i);
    const prepared = prepareVegaViewAnnotations(view, [spec], permissive);
    expect(prepared.validation.ok).toBe(false);
    expect(prepared.annotations[0]?.anchor).toEqual(anchorsFromVegaView(view, [spec])[0]?.anchor);
    expect(prepared.annotations).toHaveLength(1);
  });

  it('validates only the selected datum and honors box callback precedence', () => {
    const point = vi.fn(() => ({ x: NaN, y: Infinity }));
    const x = vi.fn(() => NaN);
    const spec = { id: 'note', box: () => ({ x: 3, y: 4, width: -2, height: 0 }), point, x };
    expect(prepareVegaViewAnnotations(view, [spec], strict).validation.ok).toBe(true);
    expect(point).not.toHaveBeenCalled();
    expect(x).not.toHaveBeenCalled();
    const mixedView = { data: () => [{ x: NaN, y: 0 }, { x: 5, y: 6 }] };
    expect(prepareVegaViewAnnotations(mixedView, [{ id: 'note', datum: (_, index) => index === 1, point: (d) => d }], strict).validation.ok).toBe(true);
    expectInvalid(validateVegaViewAnchors(mixedView, [{ id: 'note', point: (d) => d }]), 'vega-view');
  });

  const scaleSpec = [{ id: 'note', xScale: 'x', yScale: 'y', x: 'x', y: 'y' }];
  const scaleCases: Array<[string, VegaScaleViewLike<{ x: number; y: number }>]> = [
    ['NaN scale output', { ...view, scale: () => () => NaN }],
    ['infinite bandwidth', { ...view, scale: () => Object.assign(() => 0, { bandwidth: () => Infinity }) }],
    ['nonfinite origin', { ...view, scale: () => Number, origin: () => [Infinity, 0] }],
    ['nonfinite padding', { ...view, scale: () => Number, padding: () => ({ left: NaN }) }],
    ['overflowing origin plus padding', { ...view, scale: () => Number, origin: () => [max, 0], padding: () => max }]
  ];

  it.each(scaleCases)('rejects %s in scale preparation', (_, scaleView) => {
    expectInvalid(validateVegaScaleAnchors(scaleView, scaleSpec), 'vega-scale');
    expect(() => prepareVegaScaleAnnotations(scaleView, scaleSpec, strict)).toThrow(/finite/i);
    expect(prepareVegaScaleAnnotations(scaleView, scaleSpec, permissive).annotations).toHaveLength(1);
  });

  it('preserves explicit offsets overriding unused invalid scale origins', () => {
    const scaleView = { ...view, scale: () => Number, origin: (): [number, number] => [NaN, Infinity] };
    expect(prepareVegaScaleAnnotations(scaleView, [{ ...scaleSpec[0]!, offset: { x: 0, y: 0 } }], strict).validation.ok).toBe(true);
    expect(() => prepareVegaScaleAnnotations({ ...view, scale: () => Number }, [{ ...scaleSpec[0]!, offset: { x: NaN, y: 0 } }], strict)).toThrow(/finite/i);
  });

  const sceneSpec = [{ id: 'note', markName: 'target' }];
  const sceneCases: Array<[string, VegaScenegraphItem]> = [
    ['NaN bounds', { bounds: { x1: NaN, y1: 0, x2: 1, y2: 2 } }],
    ['infinite bounds', { bounds: { x1: 0, y1: 0, x2: 1, y2: Infinity } }],
    ['overflowing bounds', { bounds: { x1: -max, y1: 0, x2: max, y2: 0 } }],
    ['overflowing extent', { x: max * 0.75, y: 0, width: max / 2, height: 0 }]
  ];

  it.each(sceneCases)('rejects %s in scenegraph preparation', (_, geometry) => {
    const sceneView = { scenegraph: () => ({ root: { name: 'target', ...geometry } }) };
    expectInvalid(validateVegaScenegraphAnchors(sceneView, sceneSpec), 'vega-scenegraph');
    expect(() => prepareVegaScenegraphAnnotations(sceneView, sceneSpec, strict)).toThrow(/finite/i);
    expect(prepareVegaScenegraphAnnotations(sceneView, sceneSpec, permissive).annotations).toHaveLength(1);
  });

  it('checks scenegraph translation and preserves explicit offset precedence', () => {
    const sceneView = { scenegraph: () => ({ name: 'target', x: 0, y: 0 }), origin: (): [number, number] => [Infinity, 0] };
    expectInvalid(validateVegaScenegraphAnchors(sceneView, sceneSpec), 'vega-scenegraph');
    expect(prepareVegaScenegraphAnnotations(sceneView, [{ ...sceneSpec[0]!, offset: { x: 0, y: 0 } }], strict).validation.ok).toBe(true);
  });

  it('preserves missing and thrown-callback diagnostics', () => {
    expect(validateVegaViewAnchors({ data: () => [] }, [{ id: 'note', x: 'x', y: 'y' }]).diagnostics[0]).toMatchObject({ status: 'missing' });
    expect(validateVegaScenegraphAnchors({ scenegraph: () => ({ name: 'other' }) }, sceneSpec).diagnostics[0]).toMatchObject({ status: 'missing' });
    expect(validateVegaViewAnchors(view, [{ id: 'note', point: () => { throw new Error('callback failed'); } }]).diagnostics[0])
      .toMatchObject({ status: 'invalid', reason: 'callback failed' });
  });
});
