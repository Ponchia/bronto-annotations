import { describe, expect, it, vi } from 'vitest';
import {
  anchorsFromReactFlow,
  annotationsFromReactFlow,
  obstaclesFromReactFlow,
  prepareReactFlowAnnotations,
  validateReactFlowAnchors,
  type ReactFlowAnchorInput
} from '../../src/adapters/react-flow.js';

function input(): ReactFlowAnchorInput {
  return {
    nodes: [
      { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50 },
      { id: 'b', position: { x: 200, y: 0 }, width: 100, height: 50 }
    ],
    edges: [{ id: 'edge', source: 'a', target: 'b' }]
  };
}

const spec = { id: 'note', edgeId: 'edge', note: { title: 'Changing route' } };
const route = () => [{ x: 100, y: 25 }, { x: 200, y: 25 }];
const edgeObstacles = { includeNodes: false, includeHandles: false, includeEdges: true };

describe('React Flow preparation route snapshot', () => {
  it.each([false, edgeObstacles] as const)('uses the validated route when obstacles are %j', (obstacles) => {
    const data = input();
    data.edgePoints = vi.fn()
      .mockReturnValueOnce(route())
      .mockReturnValue([{ x: NaN, y: 25 }, { x: 200, y: 25 }]);

    const prepared = prepareReactFlowAnnotations(data, [spec], { assert: true, obstacles });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.anchor).toEqual({ type: 'path', points: route() });
    expect(prepared.obstacles).toEqual(obstacles === false ? [] : [{ x: 100, y: 25, width: 100, height: 0 }]);
    expect(data.edgePoints).toHaveBeenCalledExactlyOnceWith(data.edges![0], data.nodes);
  });

  it('takes a fresh snapshot for each preparation call', () => {
    const data = input();
    data.edgePoints = vi.fn().mockReturnValueOnce(route()).mockReturnValue([{ x: 5, y: 6 }]);

    const first = prepareReactFlowAnnotations(data, [spec], { assert: true });
    const second = prepareReactFlowAnnotations(data, [spec], { assert: true });

    expect(first.annotations[0]?.anchor).toEqual({ type: 'path', points: route() });
    expect(second.annotations[0]?.anchor).toEqual({ type: 'path', points: [{ x: 5, y: 6 }] });
    expect(second.obstacles).toContainEqual({ x: 5, y: 6, width: 0, height: 0 });
    expect(data.edgePoints).toHaveBeenCalledTimes(2);
  });

  it('copies route arrays and points before another callback or obstacle filter mutates them', () => {
    const data = input();
    const shared = route();
    data.edges!.push({ id: 'other', source: 'a', target: 'b' });
    data.edgePoints = vi.fn((edge) => {
      if (edge.id === 'other') {
        shared[0]!.x = NaN;
        shared.push({ x: Infinity, y: 0 });
        return [{ x: 8, y: 9 }];
      }
      return shared;
    });

    const prepared = prepareReactFlowAnnotations(data, [spec, { id: 'other-note', edgeId: 'other' }], {
      assert: true,
      obstacles: { ...edgeObstacles, edge: () => { shared.length = 0; return true; } }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations.map(({ anchor }) => anchor)).toEqual([
      { type: 'path', points: route() }, { type: 'path', points: [{ x: 8, y: 9 }] }
    ]);
    expect(prepared.obstacles).toEqual([
      { x: 100, y: 25, width: 100, height: 0 }, { x: 8, y: 9, width: 0, height: 0 }
    ]);
    expect(data.edgePoints).toHaveBeenCalledTimes(2);
  });

  it('caches the resolved fallback when the callback returns undefined', () => {
    const data = input();
    data.edges!.push({ id: 'other', source: 'a', target: 'b' });
    data.edgePoints = vi.fn((edge) => {
      if (edge.id === 'other') {
        data.nodes[0]!.position!.x = NaN;
        return [{ x: 8, y: 9 }];
      }
      return undefined;
    });

    const prepared = prepareReactFlowAnnotations(data, [spec, { id: 'other-note', edgeId: 'other' }], {
      assert: true, obstacles: edgeObstacles
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.anchor).toEqual({ type: 'path', points: route() });
    expect(prepared.obstacles[0]).toEqual({ x: 100, y: 25, width: 100, height: 0 });
    expect(data.edgePoints).toHaveBeenCalledTimes(2);
  });

  it('preserves custom route authority without nodes or a finite viewport', () => {
    const data = input();
    data.nodes = [];
    data.viewport = { x: NaN, y: Infinity, zoom: NaN };
    data.edgePoints = vi.fn(() => route());

    const prepared = prepareReactFlowAnnotations(data, [spec], { assert: true, obstacles: edgeObstacles });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.anchor).toEqual({ type: 'path', points: route() });
    expect(prepared.obstacles).toEqual([{ x: 100, y: 25, width: 100, height: 0 }]);
    expect(data.edgePoints).toHaveBeenCalledTimes(1);
  });

  it.each([{ points: [] }, { points: [{ x: NaN, y: 25 }] }])('retains an invalid custom route instead of falling back: %j', ({ points }) => {
    const data = input();
    data.edgePoints = vi.fn().mockReturnValueOnce(points).mockReturnValue(route());

    const prepared = prepareReactFlowAnnotations(data, [spec], { obstacles: edgeObstacles });

    expect(prepared.validation.ok).toBe(false);
    expect(prepared.validation.diagnostics[0]?.status).toBe('invalid');
    expect(prepared.annotations).toHaveLength(points.length ? 1 : 0);
    expect(prepared.obstacles).toHaveLength(points.length ? 1 : 0);
    if (points.length) {
      expect(prepared.annotations[0]?.anchor).toEqual({ type: 'path', points });
      expect(prepared.obstacles[0]?.x).toBeNaN();
    }
    expect(data.edgePoints).toHaveBeenCalledTimes(1);
  });

  it('asserts before resolving obstacle-only edges', () => {
    const data = input();
    data.edges!.push({ id: 'other', source: 'a', target: 'b' });
    data.edgePoints = vi.fn(() => []);

    expect(() => prepareReactFlowAnnotations(data, [spec], { assert: true })).toThrow('React Flow anchors: failed');
    expect(data.edgePoints).toHaveBeenCalledExactlyOnceWith(data.edges![0], data.nodes);
  });

  it.each([true, false])('propagates the original callback exception with assert=%s', (assert) => {
    const data = input();
    const error = new Error('host route unavailable');
    data.edgePoints = vi.fn(() => { throw error; });

    expect(() => prepareReactFlowAnnotations(data, [spec], { assert })).toThrow(error);
    expect(data.edgePoints).toHaveBeenCalledTimes(1);
    expect(() => prepareReactFlowAnnotations(data, [], { assert })).toThrow(error);
    expect(data.edgePoints).toHaveBeenCalledTimes(2);
  });

  it('preserves first-match and authoring precedence for duplicate specs and edge ids', () => {
    const data = input();
    const first = data.edges![0]!;
    const second = { ...first };
    data.edges!.push(second, first);
    data.edgePoints = vi.fn((edge) => edge === first ? route() : [{ x: 8, y: 9 }]);

    const prepared = prepareReactFlowAnnotations(data, [spec, { ...spec, note: { title: 'Ignored duplicate authoring' } }], {
      assert: true, obstacles: edgeObstacles
    });

    expect(prepared.validation.diagnostics).toHaveLength(2);
    expect(prepared.annotations).toHaveLength(2);
    expect(prepared.annotations.map(({ note }) => note)).toEqual([spec.note, spec.note]);
    expect(prepared.annotations.map(({ anchor }) => anchor)).toEqual([
      { type: 'path', points: route() }, { type: 'path', points: route() }
    ]);
    expect(prepared.obstacles).toEqual([
      { x: 100, y: 25, width: 100, height: 0 }, { x: 8, y: 9, width: 0, height: 0 },
      { x: 100, y: 25, width: 100, height: 0 }
    ]);
    expect(data.edgePoints).toHaveBeenCalledTimes(2);
    expect(data.edgePoints).toHaveBeenNthCalledWith(2, second, data.nodes);
  });

  it('keeps node-before-handle-before-edge precedence and skips missing targets', () => {
    const data = input();
    data.edgePoints = vi.fn(() => { throw new Error('unused route'); });

    const prepared = prepareReactFlowAnnotations(data, [
      { ...spec, nodeId: 'a', handle: { nodeId: 'b' } },
      { ...spec, id: 'handle-note', handle: { nodeId: 'a' } },
      { ...spec, id: 'missing-node', nodeId: 'missing' },
      { ...spec, id: 'missing-edge', edgeId: 'missing' }
    ], { obstacles: false });

    expect(prepared.annotations.map(({ anchor }) => anchor.type)).toEqual(['box', 'point']);
    expect(prepared.validation.diagnostics.map(({ status }) => status)).toEqual(['found', 'fallback', 'missing', 'missing']);
    expect(data.edgePoints).not.toHaveBeenCalled();
  });

  it.each([false, { includeEdges: false }, { edge: () => false }] as const)('does not resolve excluded obstacle routes: %j', (obstacles) => {
    const data = input();
    data.edgePoints = vi.fn(() => { throw new Error('excluded route'); });

    prepareReactFlowAnnotations(data, [], { obstacles });

    expect(data.edgePoints).not.toHaveBeenCalled();
  });

  it('preserves obstacle filters, padding and original callback arguments', () => {
    const data = input();
    data.edges!.push({ id: 'excluded', source: 'a', target: 'b' });
    data.edgePoints = vi.fn(() => route());
    const edgeFilter = vi.fn((edge) => edge.id !== 'excluded');

    const prepared = prepareReactFlowAnnotations(data, [], {
      obstacles: { ...edgeObstacles, padding: 2, edge: edgeFilter }
    });

    expect(prepared.obstacles).toEqual([{ x: 98, y: 23, width: 104, height: 4 }]);
    expect(edgeFilter).toHaveBeenCalledTimes(2);
    expect(edgeFilter).toHaveBeenNthCalledWith(2, data.edges![1]);
    expect(data.edgePoints).toHaveBeenCalledExactlyOnceWith(data.edges![0], data.nodes);
  });

  it('leaves standalone extraction and validation uncached', () => {
    const data = input();
    const points = route();
    data.edgePoints = vi.fn(() => points);

    const anchors = anchorsFromReactFlow(data, [spec, spec]);
    expect(anchors[0]?.anchor).toEqual({ type: 'path', points });
    if (anchors[0]?.anchor.type === 'path') expect(anchors[0].anchor.points).toBe(points);
    expect(data.edgePoints).toHaveBeenCalledTimes(2);
    validateReactFlowAnchors(data, [spec, spec]);
    expect(data.edgePoints).toHaveBeenCalledTimes(4);
    annotationsFromReactFlow(data, [spec, spec]);
    expect(data.edgePoints).toHaveBeenCalledTimes(6);
    obstaclesFromReactFlow(data, edgeObstacles);
    expect(data.edgePoints).toHaveBeenCalledTimes(7);
  });
});
