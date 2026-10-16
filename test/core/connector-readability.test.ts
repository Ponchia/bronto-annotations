import { describe, expect, it } from 'vitest';
import { connectorReadability, createReadabilityWorkspace } from '../../src/core/connector-readability.js';
import { connectorPath } from '../../src/core/connectors.js';
import { refineAnnotationLayout, resolveAnnotationLayout } from '../../src/core/layout-resolver.js';
import { evaluateAnnotationLayout, assertAnnotationLayoutQuality } from '../../src/core/quality.js';
import type { ConnectorPath, Box, PlacementCandidate, ResolvedAnnotation, ResolvedLayout } from '../../src/core/model.js';

const route = (...pairs: [number, number][]): ConnectorPath => ({ type: 'straight',
  points: pairs.map(([x, y]) => ({ x, y })), d: '' });
function item(id: string, connector: ConnectorPath, noteBox: Box = { x: 300, y: 300, width: 40, height: 30 }): ResolvedAnnotation {
  const point = connector.points[0] ?? { x: 0, y: 0 };
  return { id, annotation: { id, anchor: { type: 'point', point }, note: { title: id },
    connector: { type: connector.type, routing: 'none' } },
    anchorPoint: point, subject: { type: 'point', point, box: { ...point, width: 0, height: 0 } },
    noteBox, connector, placement: { side: 'right', align: 'center', offset: 16, score: 0 } };
}
function layout(annotations: ResolvedAnnotation[]): ResolvedLayout {
  const bounds = { x: 0, y: 0, width: 500, height: 400 };
  return { bounds, placementBounds: bounds, padding: { left: 0, right: 0, top: 0, bottom: 0 }, obstacles: [], annotations };
}
function candidate(annotation: ResolvedAnnotation, noteBox: Box): PlacementCandidate {
  return { side: 'right', align: 'center', offset: 16, crossOffset: 0, score: 0,
    noteBox, rawNoteBox: noteBox,
    connector: connectorPath(annotation.anchorPoint, noteBox, { type: 'straight', routing: 'none' }),
    scoreBreakdown: { preferredSide: 0, overflow: 0, obstacles: 0, connectors: 0,
      annotations: 0, distance: 0, alignment: 0, crossOffset: 0, tieBreak: 0 } };
}
function crossingFixture() {
  const a = item('__proto__', route([20, 50], [220, 180]), { x: 220, y: 180, width: 50, height: 30 });
  const b = item('B', route([20, 150], [220, 50]), { x: 220, y: 20, width: 50, height: 30 });
  const source = layout([a, b]);
  const frontier = [[candidate(a, a.noteBox), candidate(a, { x: 80, y: 20, width: 50, height: 30 })], [candidate(b, b.noteBox)]];
  return { source, frontier };
}

describe('opt-in polyline readability evidence', () => {
  it('counts pairs once, including internal elbows, but excludes shared endpoints and collinear contact', () => {
    const crossing = [item('a', route([0, 0], [10, 10])), item('b', route([0, 10], [10, 0]))];
    expect(connectorReadability(crossing).connectorCrossingPairs).toBe(1);
    const folded = [item('a', route([0, 0], [5, 5], [10, 0])), item('b', route([0, 5], [5, 5], [10, 5]))];
    expect(connectorReadability(folded).connectorCrossingPairs).toBe(1);
    for (const other of [route([0, 0], [10, 0]), route([2, 2], [8, 8]), route([10, 10], [20, 0])]) {
      expect(connectorReadability([crossing[0]!, item('c', other)]).connectorCrossingPairs).toBe(0);
    }
    expect(connectorReadability([item('a', route([0, 0], [5, 5], [5, 5], [10, 10])), crossing[1]!])
      .connectorCrossingPairs).toBe(1);
  });
  it('measures length and actual bends without treating duplicate points as turns', () => {
    const report = connectorReadability([item('a', route([0, 0], [3, 0], [3, 0], [6, 0], [6, 4]))]);
    expect(report.totalConnectorLength).toBe(10);
    expect(report.connectorBendCount).toBe(1);
    expect(report.complete).toBe(true);
    expect(connectorReadability([item('zero', route([4, 4], [4, 4]))])).toMatchObject({
      evaluatedConnectorCount: 1, totalConnectorLength: 0, connectorBendCount: 0, complete: true });
  });
  it('does not certify a curved control polygon or invalid coordinates as measured geometry', () => {
    const report = connectorReadability([item('curve', { ...route([0, 0], [10, 10]), type: 'curve' }),
      item('bad', route([NaN, 0], [10, 10])), item('none', { type: 'none', points: [], d: '' })]);
    expect(report).toMatchObject({ complete: false, skippedCurveCount: 1, invalidConnectorCount: 1,
      evaluatedConnectorCount: 0, connectorCrossingPairs: 0 });
  });
  it('handles negative and very large finite coordinates without overflowing orientation products', () => {
    expect(connectorReadability([item('a', route([-1e150, -1e150], [1e150, 1e150])),
      item('b', route([-1e150, 1e150], [1e150, -1e150]))]).connectorCrossingPairs).toBe(1);
  });
  it('retains crossings and bends at mixed finite scales instead of normalizing a direction to zero', () => {
    expect(connectorReadability([item('long', route([0, 0], [1e200, 0])),
      item('tiny', route([1, -1e-200], [1, 1e-200]))])).toMatchObject({
      connectorCrossingPairs: 1, complete: true });
    expect(connectorReadability([item('bend', route([0, 0], [1e200, 0], [1e200, 1e-200]))]))
      .toMatchObject({ connectorBendCount: 1, complete: true });
  });
  it('resolves nearly collinear finite determinants without manufacturing a parallel route', () => {
    const e = Number.EPSILON;
    expect(connectorReadability([item('a', route([0, 0], [1, 1])),
      item('b', route([0.5, 0.5 + e], [0.5 + e, 0.5]))]).connectorCrossingPairs).toBe(1);
  });
  it('only extends a quality report when requested and does not redefine geometric validity or score', () => {
    const { source } = crossingFixture();
    const plain = evaluateAnnotationLayout(source);
    const report = evaluateAnnotationLayout(source, { readability: true });
    expect(plain.readability).toBeUndefined();
    expect(plain.ok).toBe(true);
    expect(report.ok).toBe(plain.ok);
    expect(report.score).toBe(plain.score);
    expect(report.readability).toMatchObject({ connectorCrossingPairs: 1, complete: true });
    expect(report.issues).toContainEqual(expect.objectContaining({ type: 'connector-crossing',
      severity: 'info', annotationIds: ['__proto__', 'B'] }));
    expect(() => assertAnnotationLayoutQuality(report)).not.toThrow();
    expect(() => assertAnnotationLayoutQuality(report, { failOnInfo: true })).toThrow();
  });
  it('keeps replacement trials and commits exactly aligned with independent full recomputation', () => {
    const annotations = [item('a', route([0, 0], [10, 10])), item('b', route([0, 10], [10, 0])),
      item('c', route([5, -10], [5, 15]))];
    const workspace = createReadabilityWorkspace(annotations);
    const metrics = (items: ResolvedAnnotation[]) => {
      const r = connectorReadability(items);
      return { connectorCrossingPairs: r.connectorCrossingPairs,
        totalConnectorLength: r.totalConnectorLength, connectorBendCount: r.connectorBendCount };
    };
    expect(workspace.score()).toEqual(metrics(annotations));
    for (let index = 0; index < annotations.length; index++) {
      const next = route([-5, index * 4], [15, index * 4]);
      const changed = annotations.map((entry, i) => i === index ? { ...entry, connector: next } : entry);
      expect(workspace.replacement(index, next)).toEqual(metrics(changed));
      expect(workspace.score()).toEqual(metrics(annotations));
      workspace.commit(index, next);
      annotations[index] = changed[index]!;
      expect(workspace.score()).toEqual(metrics(annotations));
    }
  });
});

describe('conservative readability refinement', () => {
  it('untangles an otherwise geometrically valid layout without changing default refinement', () => {
    const { source, frontier } = crossingFixture();
    const saved = structuredClone(source);
    const normal = refineAnnotationLayout(source, frontier, { passes: 2, maxCandidatesPerAnnotation: 8 });
    expect(normal).toEqual(source);
    const refined = refineAnnotationLayout(source, frontier, { passes: 2, maxCandidatesPerAnnotation: 8, readability: true });
    expect(connectorReadability(refined.annotations).connectorCrossingPairs).toBe(0);
    expect(connectorReadability(refined.annotations).totalConnectorLength)
      .toBeLessThan(connectorReadability(source.annotations).totalConnectorLength);
    expect(evaluateAnnotationLayout(refined).metrics).toEqual(evaluateAnnotationLayout(source).metrics);
    expect(source).toEqual(saved);
  });
  it('does not trade shorter connectors for new obstacle/note collisions or move manual notes', () => {
    const { source, frontier } = crossingFixture();
    source.obstacles = [{ x: 75, y: 15, width: 65, height: 40 }];
    expect(refineAnnotationLayout(source, frontier, { readability: true })).toEqual(source);
    source.obstacles = [];
    source.annotations[0]!.placement.manual = true;
    expect(refineAnnotationLayout(source, frontier, { readability: true })).toEqual(source);
  });
  it('preserves selected geometry across diagnostic retention with the same readability frontier', () => {
    const annotations = Array.from({ length: 6 }, (_, i) => ({ id: `note-${i}`,
      anchor: { type: 'point' as const, point: { x: 75 + (i % 3) * 85, y: 80 + Math.floor(i / 3) * 100 } },
      note: { title: `Note ${i}` }, connector: { type: 'straight' as const, routing: 'none' as const } }));
    const options = { annotations, bounds: { x: 0, y: 0, width: 600, height: 400 },
      noteSizes: Object.fromEntries(annotations.map((a) => [a.id, { width: 100, height: 45 }])),
      refinement: { passes: 2, maxCandidatesPerAnnotation: 8, readability: true } };
    const normal = resolveAnnotationLayout(options);
    for (const candidates of [1, 8, 'all'] as const) {
      expect(resolveAnnotationLayout({ ...options, diagnostics: { candidates } }).annotations).toEqual(normal.annotations);
    }
  });
});
