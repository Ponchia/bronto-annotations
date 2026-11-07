import { describe, expect, it } from 'vitest';
import { nodeBox, prepareReactFlowAnnotations } from '../../src/adapters/react-flow.js';
import type { ReactFlowNodeLike } from '../../src/adapters/react-flow.js';

const viewport = { x: 10, y: -20, zoom: 2 };
const nodeOrigin: [number, number] = [0.5, 0.5];

describe('React Flow origin coordinates', () => {
  const publicNode = {
    id: 'node', position: { x: 100, y: 80 },
    width: 120, height: 80, measured: { width: 100, height: 40 }
  };

  it.each([
    ['public position', publicNode],
    ['legacy absolute position', { ...publicNode, positionAbsolute: { x: 50, y: 60 } }],
    ['internal absolute position', {
      ...publicNode, positionAbsolute: { x: 900, y: 900 },
      internals: { positionAbsolute: { x: 50, y: 60 } }
    }]
  ])('places equivalent %s geometry at the same viewport coordinates', (_label, node) => {
    expect(nodeBox(node, viewport, nodeOrigin)).toEqual({
      x: 110, y: 100, width: 200, height: 80
    });
  });

  it('uses a per-node origin before the shared origin for public positions', () => {
    const node = { ...publicNode, origin: [1, 0] as [number, number] };
    expect(nodeBox(node, viewport, nodeOrigin)).toEqual({
      x: 10, y: 140, width: 200, height: 80
    });
    expect(nodeBox({ ...node, origin: [0, 0] }, viewport, nodeOrigin)).toEqual({
      x: 210, y: 140, width: 200, height: 80
    });
  });

  it('keeps node, handle, edge and obstacle geometry aligned for resolved child positions', () => {
    const nodes: ReactFlowNodeLike[] = [
      {
        id: 'child', position: { x: 20, y: 30 }, width: 100, height: 40,
        internals: {
          positionAbsolute: { x: 250, y: 160 },
          handleBounds: { source: [{
            id: 'out', type: 'source', position: 'right',
            x: 95, y: 15, width: 10, height: 10
          }] }
        }
      },
      { id: 'target', position: { x: 500, y: 300 }, width: 80, height: 60 }
    ];
    const before = structuredClone(nodes);
    const prepared = prepareReactFlowAnnotations({
      nodes, viewport, nodeOrigin,
      edges: [{ id: 'edge', source: 'child', target: 'target', sourceHandle: 'out' }]
    }, [
      { id: 'node-note', nodeId: 'child' },
      { id: 'handle-note', handle: { nodeId: 'child', id: 'out', type: 'source' } },
      { id: 'fallback-note', handle: { nodeId: 'child', id: 'missing', side: 'bottom' } },
      { id: 'edge-note', edgeId: 'edge' }
    ]);

    expect(prepared.annotations.map((annotation) => annotation.anchor)).toEqual([
      { type: 'box', box: { x: 510, y: 300, width: 200, height: 80 } },
      { type: 'point', point: { x: 720, y: 340 } },
      { type: 'point', point: { x: 610, y: 380 } },
      { type: 'path', points: [{ x: 710, y: 340 }, { x: 930, y: 580 }] }
    ]);
    expect(prepared.obstacles).toEqual([
      { x: 510, y: 300, width: 200, height: 80 },
      { x: 930, y: 520, width: 160, height: 120 },
      { x: 700, y: 330, width: 20, height: 20 },
      { x: 710, y: 340, width: 220, height: 240 }
    ]);
    expect(prepared.validation.ok).toBe(true);
    expect(nodes).toEqual(before);
  });
});
