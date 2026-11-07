import { describe, expect, it } from 'vitest';
import { anchorPoint, evaluateAnchorAlignment, type Point } from '../../src/index.js';
import { anchorsFromReactFlow, annotationsFromReactFlow, prepareReactFlowAnnotations,
  validateReactFlowAnchors, type ReactFlowAnchorInput } from '../../src/adapters/react-flow.js';

const cases: Array<{ name: string; points: Point[]; expected: Point }> = [
  { name: 'two endpoints', points: [{ x: 0, y: 70 }, { x: 20, y: 70 }], expected: { x: 10, y: 70 } },
  { name: 'unequal segments', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 20 }], expected: { x: 60, y: 0 } },
  { name: 'multiple bends', points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }, { x: 20, y: 80 }], expected: { x: 80, y: 30 } },
  { name: 'diagonal', points: [{ x: 10, y: 20 }, { x: 40, y: 60 }], expected: { x: 25, y: 40 } },
  { name: 'repeated points', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 20, y: 0 }], expected: { x: 10, y: 0 } },
  { name: 'single point', points: [{ x: 3, y: 7 }], expected: { x: 3, y: 7 } },
  { name: 'zero length', points: [{ x: 3, y: 7 }, { x: 3, y: 7 }], expected: { x: 3, y: 7 } }
];
const spec = { id: 'edge-note', edgeId: 'edge', note: { title: 'Route' } };
const input = (points: Point[]): ReactFlowAnchorInput => ({
  nodes: [], edges: [{ id: 'edge', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }],
  edgePoints: () => points
});

describe('React Flow path representative point', () => {
  it.each(cases)('uses the core half-length point for $name', ({ points, expected }) => {
    const before = structuredClone(points);
    for (const point of points) Object.freeze(point);
    Object.freeze(points);
    const context = input(points);
    const result = anchorsFromReactFlow(context, [spec])[0]!;
    expect(result.point).toEqual(expected);
    expect(result.point).toEqual(anchorPoint(result.anchor));
    expect(result.anchor).toEqual({ type: 'path', points });
    if (result.anchor.type === 'path') expect(result.anchor.points).toBe(points);
    expect(result).toMatchObject({ source: 'react-flow-edge', edgeId: 'edge', sourceNodeId: 'a',
      targetNodeId: 'b', sourceHandleId: 'out', targetHandleId: 'in' });
    expect(points).toEqual(before);
    expect(evaluateAnchorAlignment(annotationsFromReactFlow(context, [spec]),
      [{ id: spec.id, point: expected }]).diagnostics[0]?.distance).toBe(0);
  });

  it('uses transformed fallback endpoints without applying a viewport to custom routes', () => {
    const context: ReactFlowAnchorInput = {
      nodes: [{ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 50 },
        { id: 'b', position: { x: 200, y: 0 }, width: 100, height: 50 }],
      edges: [{ id: 'edge', source: 'a', target: 'b' }], viewport: { x: 10, y: 20, zoom: 2 }
    };
    expect(anchorsFromReactFlow(context, [spec])[0]?.point).toEqual({ x: 310, y: 70 });
    expect(anchorsFromReactFlow({ ...context, edgePoints: () => cases[0]!.points }, [spec])[0]?.point)
      .toEqual(cases[0]!.expected);
  });

  it('rejects routes whose finite coordinates overflow resolved midpoint arithmetic', () => {
    const context = input([{ x: 0, y: 0 }, { x: Number.MAX_VALUE, y: Number.MAX_VALUE }]);
    const report = validateReactFlowAnchors(context, [spec]);
    expect(report.ok).toBe(false);
    expect(report.diagnostics[0]?.status).toBe('invalid');
    expect(() => prepareReactFlowAnnotations(context, [spec], { assert: true, obstacles: false })).toThrow(/nonfinite/);
    // Extraction is still permissive; strict validation owns rejection.
    expect(anchorsFromReactFlow(context, [spec])).toHaveLength(1);
  });
});
