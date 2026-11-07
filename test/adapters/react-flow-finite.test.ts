import { describe, expect, it } from 'vitest';
import {
  anchorsFromReactFlow,
  prepareReactFlowAnnotations,
  validateReactFlowAnchors,
  type ReactFlowAnchorInput,
  type ReactFlowAnchorSpec,
  type ReactFlowNodeLike
} from '../../src/adapters/react-flow.js';

const nodeSpec: ReactFlowAnchorSpec = { id: 'node-note', nodeId: 'node' };
const handleSpec: ReactFlowAnchorSpec = { id: 'handle-note', handle: { nodeId: 'node', id: 'out' } };
const edgeSpec: ReactFlowAnchorSpec = { id: 'edge-note', edgeId: 'edge' };
const nonfinite = [NaN, Infinity, -Infinity];

function input(): ReactFlowAnchorInput {
  return {
    nodes: [
      {
        id: 'node', position: { x: 10, y: 20 }, measured: { width: 80, height: 40 },
        handles: [{ id: 'out', type: 'source', position: 'right', x: 80, y: 20, width: 4, height: 4 }]
      },
      { id: 'target', position: { x: 200, y: 20 }, width: 80, height: 40 }
    ],
    edges: [{ id: 'edge', source: 'node', target: 'target', sourceHandle: 'out' }]
  };
}

function expectInvalid(value: ReactFlowAnchorInput, specs: ReactFlowAnchorSpec[]) {
  const report = validateReactFlowAnchors(value, specs);
  expect(report.ok).toBe(false);
  expect(report.found).toEqual([]);
  expect(report.warnings).toEqual([]);
  expect(report.diagnostics.map((diagnostic) => diagnostic.status)).toEqual(specs.map(() => 'invalid'));
  expect(() => prepareReactFlowAnnotations(value, specs, { assert: true })).toThrow('React Flow anchors: failed');
}

describe('React Flow finite geometry validation', () => {
  it('rejects a measured node with a nonfinite position', () => {
    const report = validateReactFlowAnchors({
      nodes: [{ id: 'node', position: { x: NaN, y: 0 }, measured: { width: 80, height: 40 } }]
    }, [{ id: 'annotation', nodeId: 'node' }]);

    expect(report.ok).toBe(false);
    expect(report.diagnostics[0]?.status).toBe('invalid');
    expect(report.found).toEqual([]);
  });

  describe.each(nonfinite)('nonfinite value %s', (value) => {
    it.each(['x', 'y'] as const)('rejects node position %s in nodes, handles and default edges', (axis) => {
      const data = input();
      data.nodes[0]!.position![axis] = value;
      expectInvalid(data, [nodeSpec, handleSpec, edgeSpec]);
    });

    it.each(['width', 'height'] as const)('rejects measured node %s', (dimension) => {
      const data = input();
      data.nodes[0]!.measured![dimension] = value;
      expectInvalid(data, [nodeSpec]);
    });

    it.each(['x', 'y', 'width', 'height'] as const)('rejects measured handle %s', (field) => {
      const data = input();
      data.nodes[0]!.handles![0]![field] = value;
      expectInvalid(data, [handleSpec, edgeSpec]);
    });

    it.each(['x', 'y'] as const)('rejects nonfinite custom route %s', (axis) => {
      const data = input();
      data.edgePoints = () => [{ x: 0, y: 0 }, { x: 10, y: 20, [axis]: value }];
      expectInvalid(data, [edgeSpec]);
    });

    it.each(['x', 'y', 'zoom'] as const)('rejects viewport %s even with a custom route', (field) => {
      const data = input();
      data.viewport = { x: 0, y: 0, zoom: 1, [field]: value };
      expectInvalid(data, [nodeSpec, handleSpec, edgeSpec]);
      data.edgePoints = () => [{ x: 0, y: 0 }];
      expectInvalid(data, [edgeSpec]);
    });

    it('rejects nonfinite fallback geometry without misreporting an unmeasured handle', () => {
      const data = input();
      data.nodes[0]!.handles = [];
      data.nodes[0]!.position!.x = value;
      expectInvalid(data, [handleSpec]);
    });
  });

  it.each([
    { positionAbsolute: { x: Infinity, y: 0 } },
    { internals: { positionAbsolute: { x: 0, y: NaN } } },
    { origin: [NaN, 0] as [number, number] },
    { measured: undefined, width: Infinity, height: 40 }
  ])('validates the selected node geometry source: %j', (override) => {
    const data = input();
    Object.assign(data.nodes[0]!, override);
    expectInvalid(data, [nodeSpec]);
  });

  it('rejects nonfinite public node origin and finite arithmetic overflow', () => {
    const data = input();
    data.nodeOrigin = [0, Infinity];
    expectInvalid(data, [nodeSpec, handleSpec, edgeSpec]);
    delete data.nodeOrigin;
    data.viewport = { x: 0, y: 0, zoom: Number.MAX_VALUE };
    expectInvalid(data, [nodeSpec, handleSpec, edgeSpec]);
    delete data.viewport;
    data.nodes[0]!.position!.x = Number.MAX_VALUE;
    data.nodes[0]!.measured!.width = Number.MAX_VALUE;
    expectInvalid(data, [nodeSpec]);
    data.nodes[0]!.handles![0]!.width = Number.MAX_VALUE;
    expectInvalid(data, [handleSpec, edgeSpec]);
    data.edgePoints = () => [{ x: -Number.MAX_VALUE, y: 0 }, { x: Number.MAX_VALUE, y: 0 }];
    expectInvalid(data, [edgeSpec]);
  });

  it.each([0, -1])('continues rejecting node dimensions %s', (width) => {
    const data = input();
    data.nodes[0]!.measured!.width = width;
    expectInvalid(data, [nodeSpec]);
  });

  it('rejects negative measured handle dimensions', () => {
    const data = input();
    data.nodes[0]!.handles![0]!.width = -1;
    expectInvalid(data, [handleSpec]);
  });

  it('keeps missing targets missing despite nonfinite viewport input', () => {
    const report = validateReactFlowAnchors({ nodes: [], viewport: { x: NaN, y: 0, zoom: 1 } }, [nodeSpec, handleSpec, edgeSpec]);
    expect(report.diagnostics.map((diagnostic) => diagnostic.status)).toEqual(['missing', 'missing', 'missing']);
  });

  it('keeps unavailable routes invalid', () => {
    const data = input();
    data.nodes = [];
    expectInvalid(data, [edgeSpec]);
    data.edgePoints = () => [];
    expectInvalid(data, [edgeSpec]);
  });

  it.each([
    [{ x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 10 }],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }]
  ])('accepts finite degenerate routes %j', (...points) => {
    const data = input();
    data.nodes = [];
    data.edgePoints = () => points;
    expect(validateReactFlowAnchors(data, [edgeSpec]).ok).toBe(true);
  });

  it('accepts measured zero-size handles and finite unmeasured-parent fallback', () => {
    const data = input();
    data.nodes[0]!.handles![0]!.width = 0;
    data.nodes[0]!.handles![0]!.height = 0;
    expect(validateReactFlowAnchors(data, [handleSpec]).diagnostics[0]?.status).toBe('found');
    data.nodes = [{ id: 'node', position: { x: 10, y: 20 } }];
    const prepared = prepareReactFlowAnnotations(data, [handleSpec], { assert: true });
    expect(prepared.validation.ok).toBe(true);
    expect(prepared.validation.warnings[0]?.status).toBe('fallback');
    expect(prepared.annotations[0]?.anchor).toEqual({ type: 'point', point: { x: 10, y: 20 } });
  });

  it('uses authoritative absolute positions and measured sizes without inspecting unused fields', () => {
    const node: ReactFlowNodeLike = {
      id: 'node', position: { x: NaN, y: NaN }, width: Infinity, height: NaN,
      origin: [NaN, NaN], measured: { width: 80, height: 40 },
      internals: { positionAbsolute: { x: 10, y: 20 } }
    };
    expect(validateReactFlowAnchors({ nodes: [node], nodeOrigin: [NaN, NaN] }, [nodeSpec]).ok).toBe(true);
  });

  it('retains explicit permissive authoring when assertions are disabled', () => {
    const data = input();
    data.nodes[0]!.position!.x = NaN;
    const extracted = anchorsFromReactFlow(data, [nodeSpec]);
    expect(extracted[0]?.box.x).toBeNaN();
    const prepared = prepareReactFlowAnnotations(data, [nodeSpec], { assert: false, obstacles: false });
    expect(prepared.validation.ok).toBe(false);
    expect(prepared.annotations[0]?.anchor).toEqual(extracted[0]?.anchor);
  });
});
