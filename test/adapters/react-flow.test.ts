import { describe, expect, it } from 'vitest';
import {
  anchorsFromReactFlow,
  annotationsFromReactFlow,
  handleBox,
  handlePoint,
  nodeBox,
  obstaclesFromReactFlow,
  prepareReactFlowAnnotations,
  validateReactFlowAnchors
} from '../../src/adapters/react-flow.js';

describe('React Flow adapter', () => {
  it('normalizes node boxes through the viewport transform', () => {
    expect(nodeBox(
      { id: 'node', position: { x: 20, y: 30 }, width: 100, height: 40 },
      { x: 10, y: 12, zoom: 2 }
    )).toEqual({
      x: 50,
      y: 72,
      width: 200,
      height: 80
    });
  });

  it('extracts node, handle, and edge anchors from public state', () => {
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 }, width: 100, height: 40 },
      { id: 'b', position: { x: 180, y: 0 }, width: 100, height: 40 }
    ];
    const edges = [
      { id: 'a-b', source: 'a', target: 'b' }
    ];
    const anchors = anchorsFromReactFlow({ nodes, edges }, [
      { id: 'node-a', nodeId: 'a' },
      { id: 'handle-a', handle: { nodeId: 'a', side: 'right' } },
      { id: 'edge-a-b', edgeId: 'a-b' }
    ]);

    expect(anchors.map((anchor) => anchor.source)).toEqual([
      'react-flow-node',
      'react-flow-handle',
      'react-flow-edge'
    ]);
    expect(anchors[0]?.anchor.type).toBe('box');
    expect(anchors[0]?.nodeId).toBe('a');
    expect(anchors[1]?.anchor).toEqual({
      type: 'point',
      point: { x: 100, y: 20 }
    });
    expect(anchors[1]?.nodeId).toBe('a');
    expect(anchors[1]?.handleSide).toBe('right');
    expect(anchors[2]?.anchor.type).toBe('path');
    expect(anchors[2]?.edgeId).toBe('a-b');
    expect(anchors[2]?.sourceNodeId).toBe('a');
    expect(anchors[2]?.targetNodeId).toBe('b');
  });

  it('uses measured public handle geometry before falling back to node side midpoints', () => {
    const nodes = [
      {
        id: 'review',
        position: { x: 100, y: 50 },
        width: 120,
        height: 80,
        handles: [
          {
            id: 'approved',
            nodeId: 'review',
            type: 'source' as const,
            position: 'bottom' as const,
            x: 80,
            y: 72,
            width: 16,
            height: 16
          }
        ]
      }
    ];
    const anchors = anchorsFromReactFlow({
      nodes,
      viewport: { x: 10, y: 20, zoom: 2 }
    }, [
      { id: 'approved-handle', handle: { nodeId: 'review', id: 'approved', type: 'source' } },
      { id: 'missing-handle', handle: { nodeId: 'review', id: 'missing', side: 'right' } }
    ]);
    const annotations = annotationsFromReactFlow({ nodes }, [
      { id: 'approved-note', handle: { nodeId: 'review', id: 'approved', type: 'source' } }
    ]);

    expect(handleBox(nodes[0]!, nodes[0]!.handles[0]!, { x: 10, y: 20, zoom: 2 })).toEqual({
      x: 370,
      y: 264,
      width: 32,
      height: 32
    });
    expect(anchors[0]?.anchor).toEqual({
      type: 'point',
      point: { x: 386, y: 296 }
    });
    expect(anchors[0]?.box).toEqual({ x: 370, y: 264, width: 32, height: 32 });
    expect(anchors[0]?.handleId).toBe('approved');
    expect(anchors[0]?.handleType).toBe('source');
    expect(anchors[0]?.handleSide).toBe('bottom');
    expect(anchors[1]?.anchor).toEqual({
      type: 'point',
      point: { x: 450, y: 200 }
    });
    expect(annotations[0]?.data?.reactFlowHandleId).toBe('approved');
    expect(annotations[0]?.data?.reactFlowHandleType).toBe('source');
    expect(annotations[0]?.data?.reactFlowHandleSide).toBe('bottom');
  });

  it('uses measured source and target handles for default edge anchors', () => {
    const nodes = [
      {
        id: 'review',
        position: { x: 100, y: 50 },
        width: 120,
        height: 80,
        handles: [
          {
            id: 'approved',
            nodeId: 'review',
            position: 'bottom' as const,
            x: 80,
            y: 72,
            width: 16,
            height: 16
          }
        ]
      },
      {
        id: 'publish',
        position: { x: 300, y: 180 },
        width: 140,
        height: 70,
        handles: [
          {
            id: 'inbox',
            nodeId: 'publish',
            type: 'target' as const,
            position: 'top' as const,
            x: 60,
            y: -8,
            width: 16,
            height: 16
          }
        ]
      }
    ];
    const edges = [
      {
        id: 'review-publish',
        source: 'review',
        target: 'publish',
        sourceHandle: 'approved',
        targetHandle: 'inbox'
      }
    ];
    const anchors = anchorsFromReactFlow({
      nodes,
      edges,
      viewport: { x: 10, y: 20, zoom: 2 }
    }, [
      { id: 'review-publish', edgeId: 'review-publish' }
    ]);
    const annotations = annotationsFromReactFlow({ nodes, edges }, [
      { id: 'review-publish', edgeId: 'review-publish' }
    ]);

    expect(anchors[0]?.anchor).toEqual({
      type: 'path',
      points: [
        { x: 386, y: 280 },
        { x: 746, y: 380 }
      ]
    });
    expect(anchors[0]?.box).toEqual({ x: 386, y: 280, width: 360, height: 100 });
    expect(anchors[0]?.sourceHandleId).toBe('approved');
    expect(anchors[0]?.targetHandleId).toBe('inbox');
    expect(annotations[0]?.data?.reactFlowSourceHandleId).toBe('approved');
    expect(annotations[0]?.data?.reactFlowTargetHandleId).toBe('inbox');
  });

  it('reports missing targets, invalid edges, and handle fallbacks', () => {
    const report = validateReactFlowAnchors({
      nodes: [
        { id: 'review', position: { x: 100, y: 50 }, width: 120, height: 80 }
      ],
      edges: [
        { id: 'broken', source: 'review', target: 'missing' }
      ]
    }, [
      { id: 'node', nodeId: 'review' },
      { id: 'fallback-handle', handle: { nodeId: 'review', id: 'approved', side: 'right' } },
      { id: 'broken-edge', edgeId: 'broken' },
      { id: 'missing-node', nodeId: 'missing' }
    ]);

    expect(report.ok).toBe(false);
    expect(report.found).toEqual(['node', 'fallback-handle']);
    expect(report.warnings[0]).toMatchObject({
      id: 'fallback-handle',
      status: 'fallback',
      source: 'react-flow-handle'
    });
    expect(report.missing.map((item) => item.id)).toEqual(['broken-edge', 'missing-node']);
    expect(report.missing[0]?.status).toBe('invalid');
  });

  it('uses internal handle bounds and internal absolute node positions when supplied by the host', () => {
    const anchors = anchorsFromReactFlow({
      nodes: [
        {
          id: 'internal',
          position: { x: 0, y: 0 },
          width: 100,
          height: 60,
          internals: {
            positionAbsolute: { x: 240, y: 140 },
            handleBounds: {
              source: [
                {
                  id: 'done',
                  nodeId: 'internal',
                  type: 'source',
                  position: 'right',
                  x: 92,
                  y: 20,
                  width: 12,
                  height: 12
                }
              ],
              target: null
            }
          }
        }
      ]
    }, [
      { id: 'done-handle', handle: { nodeId: 'internal', id: 'done', type: 'source' } }
    ]);

    expect(anchors[0]?.box).toEqual({ x: 332, y: 160, width: 12, height: 12 });
    expect(anchors[0]?.point).toEqual({ x: 344, y: 166 });
    expect(anchors[0]?.handleSide).toBe('right');
  });

  it('creates annotations and exposes handle geometry helpers', () => {
    const annotations = annotationsFromReactFlow({
      nodes: [
        { id: 'review', position: { x: 10, y: 20 }, width: 120, height: 60 }
      ]
    }, [
      {
        id: 'review-note',
        nodeId: 'review',
        note: { title: 'Review' },
        variant: 'evidence',
        tone: 'success',
        motion: 'reveal',
        style: { noteBackground: '#f0fdf4' },
        priority: 9,
        annotationClassName: 'flow-generated-note',
        annotationData: { consumer: 'graph' },
        metadata: { owner: 'workflow' }
      }
    ]);

    expect(annotations[0]?.note.title).toBe('Review');
    expect(annotations[0]?.variant).toBe('evidence');
    expect(annotations[0]?.tone).toBe('success');
    expect(annotations[0]?.motion).toBe('reveal');
    expect(annotations[0]?.style).toEqual({ noteBackground: '#f0fdf4' });
    expect(annotations[0]?.priority).toBe(9);
    expect(annotations[0]?.className).toBe('flow-generated-note');
    expect(annotations[0]?.metadata).toEqual({ owner: 'workflow' });
    expect(annotations[0]?.data?.anchorSource).toBe('react-flow-node');
    expect(annotations[0]?.data?.reactFlowKind).toBe('node');
    expect(annotations[0]?.data?.reactFlowNodeId).toBe('review');
    expect(annotations[0]?.data?.consumer).toBe('graph');
    expect(handlePoint({ x: 10, y: 20, width: 120, height: 60 }, 'bottom')).toEqual({
      x: 70,
      y: 80
    });
  });

  it('prepares annotations, obstacles, and validation from public React Flow state', () => {
    const nodes = [
      {
        id: 'a',
        position: { x: 10, y: 20 },
        width: 100,
        height: 40,
        handles: [
          {
            id: 'out',
            type: 'source' as const,
            position: 'right' as const,
            x: 96,
            y: 16,
            width: 10,
            height: 10
          }
        ]
      },
      { id: 'b', position: { x: 180, y: 60 }, width: 120, height: 50 }
    ];
    const edges = [
      { id: 'a-b', source: 'a', target: 'b' }
    ];
    const prepared = prepareReactFlowAnnotations({
      nodes,
      edges
    }, [
      { id: 'node-a', nodeId: 'a', note: { title: 'A' } },
      { id: 'edge-a-b', edgeId: 'a-b', note: { title: 'A to B' } }
    ], {
      obstacles: { padding: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations.map((annotation) => annotation.data?.reactFlowKind)).toEqual(['node', 'edge']);
    expect(prepared.obstacles).toContainEqual({ x: 8, y: 18, width: 104, height: 44 });
    expect(prepared.obstacles).toContainEqual({ x: 104, y: 34, width: 14, height: 14 });
    expect(prepared.obstacles).toContainEqual({ x: 108, y: 38, width: 74, height: 49 });
  });

  it('extracts node, handle, and edge obstacles from public React Flow state', () => {
    const nodes = [
      {
        id: 'a',
        position: { x: 10, y: 20 },
        width: 100,
        height: 40,
        data: { kind: 'kept' },
        handles: [
          {
            id: 'out',
            type: 'source' as const,
            position: 'right' as const,
            x: 96,
            y: 16,
            width: 10,
            height: 10
          }
        ]
      },
      { id: 'b', position: { x: 180, y: 60 }, width: 120, height: 50, data: { kind: 'kept' } },
      { id: 'hidden', position: { x: 0, y: 0 }, width: 80, height: 40, data: { kind: 'hidden' } }
    ];
    const edges = [
      { id: 'a-b', source: 'a', target: 'b' },
      { id: 'skip', source: 'a', target: 'hidden' }
    ];

    expect(obstaclesFromReactFlow({
      nodes,
      edges,
      viewport: { x: 4, y: 8, zoom: 2 }
    }, {
      includeEdges: true,
      includeHandles: true,
      padding: 3,
      node: (node) => node.data?.kind !== 'hidden',
      handle: (handle) => handle.type === 'source',
      edge: (edge) => edge.id !== 'skip'
    })).toEqual([
      { x: 21, y: 45, width: 206, height: 86 },
      { x: 361, y: 125, width: 246, height: 106 },
      { x: 213, y: 77, width: 26, height: 26 },
      { x: 221, y: 85, width: 146, height: 96 }
    ]);
  });
});
