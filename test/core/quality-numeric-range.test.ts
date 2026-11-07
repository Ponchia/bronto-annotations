import { describe, expect, it } from 'vitest';
import { assertAnnotationLayoutQuality, evaluateAnnotationLayout, formatLayoutQualityIssue, formatLayoutQualityReport } from '../../src/core/quality.js';
import { createRefinementScoreWorkspace } from '../../src/core/refinement-score.js';
import { refineAnnotationLayout } from '../../src/core/layout-resolver.js';
import { eagerRefinementReference, fullQualityRefinementScore } from '../fixtures/refinement-reference.js';
import type { Box, ConnectorPath, PlacementCandidate, ResolvedAnnotation, ResolvedLayout } from '../../src/core/model.js';

const ordinaryBounds: Box = { x: 0, y: 0, width: 100, height: 100 };
const huge: Box = { x: 0, y: 0, width: 1e200, height: 1e200 };
const finiteArea: Box = { x: 0, y: 0, width: 1e154, height: 1e154 };

function note(id: string, noteBox: Box, connector: ConnectorPath = { type: 'none', points: [], d: '' }): ResolvedAnnotation {
  const point = { x: 0, y: 0 };
  return {
    id, noteBox, connector,
    annotation: { id, anchor: { type: 'point', point }, note: { title: id } },
    subject: { type: 'point', point, box: { ...point, width: 0, height: 0 } },
    anchorPoint: point,
    placement: { side: 'right', align: 'center', offset: 0, score: 0 }
  };
}

function scene(boxes: Box[], obstacles: Box[] = [], bounds = ordinaryBounds): ResolvedLayout {
  return { bounds, placementBounds: bounds, obstacles,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    annotations: boxes.map((box, index) => note(`note-${index}`, box)) };
}

const areaCases = [
  { name: 'obstacle product', layout: scene([huge], [huge], huge), metric: 'obstacleOverlapArea', type: 'obstacle-overlap' },
  { name: 'note product', layout: scene([huge, huge], [], huge), metric: 'noteOverlapArea', type: 'note-overlap' },
  { name: 'bounds product', layout: scene([huge]), metric: 'boundsOverflowArea', type: 'bounds-overflow' },
  { name: 'obstacle accumulation', layout: scene([finiteArea], [finiteArea, finiteArea], finiteArea), metric: 'obstacleOverlapArea', type: 'obstacle-overlap' },
  { name: 'many-obstacle accumulation', layout: scene([finiteArea], Array.from({ length: 32 }, () => ({
    x: 0, y: 0, width: 1e153, height: 1e154
  })), finiteArea), metric: 'obstacleOverlapArea', type: 'obstacle-overlap' },
  { name: 'note accumulation', layout: scene([finiteArea, finiteArea, finiteArea], [], finiteArea), metric: 'noteOverlapArea', type: 'note-overlap' },
  { name: 'bounds accumulation', layout: scene([
    { x: 1e154, y: 0, width: 1e154, height: 1e154 },
    { x: -1e154, y: 0, width: 1e154, height: 1e154 }
  ], [], finiteArea), metric: 'boundsOverflowArea', type: 'bounds-overflow' },
  { name: 'translated zero-width strip', layout: scene([
    { x: 1e308, y: 1e308, width: 0, height: 1 }
  ], [], { x: -1e308, y: -1e308, width: 0, height: 0 }), metric: 'boundsOverflowArea', type: 'bounds-overflow' }
] as const;

describe('quality numerical range evidence', () => {
  it.each(areaCases)('preserves $name overflow through JSON', ({ layout, metric, type, name }) => {
    const report = evaluateAnnotationLayout(layout);
    expect(report.metrics[metric]).toBe(Infinity);
    expect(report.metrics.invalidBoxCount).toBe(0);
    expect(report.ok).toBe(false);
    expect(report.score).toBe(0);
    expect(report.issues.some(issue => issue.type === type)).toBe(true);
    expect(report.geometryValid).toBe(metric === 'obstacleOverlapArea');
    expect(report).toHaveProperty('numericDiagnostics', expect.arrayContaining([
      { path: `metrics.${metric}`, value: 'Infinity' }
    ]));
    const saved = JSON.parse(JSON.stringify(report));
    expect(saved.metrics[metric]).toBeNull();
    expect(saved.numericDiagnostics).toEqual(report.numericDiagnostics);
    const matching = report.issues.filter(issue => issue.type === type);
    if (name.endsWith('accumulation')) {
      expect(matching.every(issue => Number.isFinite(issue.area))).toBe(true);
    } else {
      const index = report.issues.findIndex(issue => issue.type === type);
      expect(saved.numericDiagnostics).toContainEqual({ path: `issues[${index}].area`, value: 'Infinity' });
      expect(saved.issues[index].area).toBeNull();
    }
  });

  it('keeps finite metrics and their text finite even when refinement weights overflow', () => {
    const report = evaluateAnnotationLayout(scene([finiteArea], [finiteArea], finiteArea));
    expect(report.metrics.obstacleOverlapArea).toBe(1e308);
    expect(report).not.toHaveProperty('numericDiagnostics');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(formatLayoutQualityIssue(report.issues[0]!)).toContain('area=1e+308');
  });

  it('uses deterministic paths for every nonfinite field without mutating the layout', () => {
    const layout = scene([huge, huge], [huge]);
    const before = structuredClone(layout);
    const report = evaluateAnnotationLayout(layout);
    expect(report).toHaveProperty('numericDiagnostics', [
      { path: 'metrics.boundsOverflowArea', value: 'Infinity' },
      { path: 'metrics.noteOverlapArea', value: 'Infinity' },
      { path: 'metrics.obstacleOverlapArea', value: 'Infinity' },
      ...Array.from({ length: 5 }, (_, index) => ({ path: `issues[${index}].area`, value: 'Infinity' }))
    ]);
    expect(evaluateAnnotationLayout(layout)).toEqual(report);
    expect(layout).toEqual(before);
  });

  it('distinguishes diagnostic issue positions from original invalid obstacle indices', () => {
    const report = evaluateAnnotationLayout(scene([huge], [
      { x: 0, y: 0, width: -1, height: 1 }, huge
    ], huge));
    expect(report.metrics.invalidBoxCount).toBe(1);
    expect(report.issues[0]).toMatchObject({ type: 'invalid-box', obstacleIndex: 0 });
    expect(report.issues[1]).toMatchObject({ type: 'obstacle-overlap', obstacleIndex: 1, area: Infinity });
    expect(report.numericDiagnostics).toEqual([
      { path: 'metrics.obstacleOverlapArea', value: 'Infinity' },
      { path: 'issues[1].area', value: 'Infinity' }
    ]);
  });

  it('preserves normal-coordinate metrics, issue ordering and score', () => {
    const report = evaluateAnnotationLayout(scene(
      [{ x: 10, y: 10, width: 20, height: 20 }, { x: 20, y: 20, width: 20, height: 20 }],
      [{ x: 15, y: 15, width: 10, height: 10 }]
    ));
    expect(report.metrics).toEqual({ annotationCount: 2, issueCount: 3, invalidBoxCount: 0,
      boundsOverflowArea: 0, noteOverlapArea: 100, obstacleOverlapArea: 125,
      connectorObstacleHits: 0, connectorNoteHits: 0 });
    expect(report.issues.map(issue => [issue.type, issue.area])).toEqual([
      ['obstacle-overlap', 100], ['obstacle-overlap', 25], ['note-overlap', 100]
    ]);
    expect(report.score).toBe(95.75);
    expect(report).not.toHaveProperty('numericDiagnostics');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
    expect(formatLayoutQualityReport(evaluateAnnotationLayout(scene([]))))
      .toBe('Annotation layout quality: ok (score 100, 0 errors, 0 warnings, 0 info, 0 issues).');
  });

  it('keeps zero-size boxes valid without multiplying overflow distances by zero', () => {
    const bounds = { x: -1e308, y: -1e308, width: 1, height: 1 };
    const report = evaluateAnnotationLayout(scene([{ x: 1e308, y: 1e308, width: 0, height: 0 }], [], bounds));
    expect(report.metrics.invalidBoxCount).toBe(0);
    expect(report.metrics.boundsOverflowArea).toBe(0);
    expect(report.ok).toBe(true);
    expect(report).not.toHaveProperty('numericDiagnostics');
    for (const [width, height] of [[0, 1], [1, 0]]) {
      const line = evaluateAnnotationLayout(scene([{ x: 1e308, y: 1e308, width: width!, height: height! }], [], bounds));
      expect(line.metrics.invalidBoxCount).toBe(0);
      expect(line.metrics.boundsOverflowArea).toBe(Infinity);
      expect(line.geometryValid).toBe(false);
    }
  });

  it('retains invalid-box diagnostics for negative dimensions and nonfinite far edges', () => {
    const bad = { x: 0, y: 0, width: -1, height: 1 };
    const edge = { x: 1e308, y: 0, width: 1e308, height: 1 };
    const report = evaluateAnnotationLayout(scene([bad, edge], [bad], edge));
    expect(report.metrics.invalidBoxCount).toBe(4);
    expect(report.issues.every(issue => issue.type === 'invalid-box')).toBe(true);
    expect(report.geometryValid).toBe(false);
    expect(report.hostContentClear).toBe(false);
    expect(report).not.toHaveProperty('numericDiagnostics');
  });

  it('records intermediate distance overflow even when a tiny dimension could yield a finite real area', () => {
    const report = evaluateAnnotationLayout(scene([
      { x: 1e308, y: 0, width: 0, height: 1e-308 }
    ], [], { x: -1e308, y: 0, width: 0, height: 1 }));
    expect(report.metrics.invalidBoxCount).toBe(0);
    expect(report.metrics.boundsOverflowArea).toBe(Infinity);
    expect(report).toHaveProperty('numericDiagnostics', [
      { path: 'metrics.boundsOverflowArea', value: 'Infinity' },
      { path: 'issues[0].area', value: 'Infinity' }
    ]);
  });

  it('does not reject a common extreme translation whose computed metrics remain finite', () => {
    const translated = { x: 1e300, y: -1e300, width: 1, height: 1 };
    const report = evaluateAnnotationLayout(scene([translated], [], translated));
    expect(report.ok).toBe(true);
    expect(report.metrics.boundsOverflowArea).toBe(0);
    expect(report).not.toHaveProperty('numericDiagnostics');
  });

  it('records total path-length overflow separately from geometric feasibility', () => {
    const layout = scene([{ x: 0, y: 0, width: 0, height: 0 }, { x: 0, y: 0, width: 0, height: 0 }]);
    for (const item of layout.annotations) item.connector = {
      type: 'straight', points: [{ x: 0, y: 0 }, { x: 1e308, y: 0 }], d: ''
    };
    const report = evaluateAnnotationLayout(layout, { readability: true });
    expect(report.ok).toBe(true);
    expect(report.readability).toMatchObject({ complete: false, invalidConnectorCount: 0, totalConnectorLength: Infinity });
    expect(report).toHaveProperty('numericDiagnostics', [{ path: 'readability.totalConnectorLength', value: 'Infinity' }]);
    const saved = JSON.parse(JSON.stringify(report));
    expect(saved.readability.totalConnectorLength).toBeNull();
    expect(saved.numericDiagnostics).toEqual(report.numericDiagnostics);
    expect(formatLayoutQualityReport(report, { includeInfo: false, maxIssues: 0 }))
      .toContain('numeric range readability.totalConnectorLength=Infinity');
    expect(() => assertAnnotationLayoutQuality(report)).not.toThrow();
    expect(evaluateAnnotationLayout(layout)).not.toHaveProperty('numericDiagnostics');
  });

  it.each(['difference', 'sum'])('retains incomplete readability for an unrepresentable individual route (%s)', kind => {
    const layout = scene([{ x: 0, y: 0, width: 0, height: 0 }]);
    layout.annotations[0]!.connector = { type: 'straight', d: '', points: kind === 'difference'
      ? [{ x: -1e308, y: 0 }, { x: 1e308, y: 0 }]
      : [{ x: 0, y: 0 }, { x: 1e308, y: 0 }, { x: 0, y: 0 }] };
    const report = evaluateAnnotationLayout(layout, { readability: true });
    expect(report.ok).toBe(true);
    expect(report.readability).toMatchObject({ complete: false, invalidConnectorCount: 1, totalConnectorLength: 0 });
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it.each(areaCases)('keeps exact fast/full scoring through $name trials, commits and recovery', ({ layout }) => {
    const before = structuredClone(layout);
    const workspace = createRefinementScoreWorkspace(layout)!;
    expect(workspace).toBeDefined();
    const original = layout.annotations[0]!;
    const candidates = [original, note(original.id, { x: 0, y: 0, width: 0, height: 0 }),
      note(original.id, { x: -1e308, y: -1e308, width: 0, height: 1 }),
      note(original.id, { x: 0, y: 0, width: -1, height: 1 }), original];
    for (const candidate of candidates) {
      const annotations = [...layout.annotations]; annotations[0] = candidate;
      const expected = fullQualityRefinementScore({ ...layout, annotations });
      expect(workspace.scoreReplacement(0, candidate)).toBe(expected);
      workspace.commit(0, candidate);
      expect(workspace.scoreReplacement(0, candidate)).toBe(expected);
    }
    expect(layout).toEqual(before);
  });

  it('preserves selected refinement geometry from an overflowing initial score', () => {
    const layout = scene([huge, huge], [], huge);
    const candidates = layout.annotations.map(item => [item.noteBox, ordinaryBounds,
      { x: 50, y: 50, width: 0, height: 0 }].map((noteBox): PlacementCandidate => ({
      side: 'right', align: 'center', offset: 0, crossOffset: 0,
      noteBox, rawNoteBox: noteBox, connector: item.connector, score: 0,
      scoreBreakdown: { preferredSide: 0, overflow: 0, obstacles: 0, connectors: 0,
        annotations: 0, distance: 0, alignment: 0, crossOffset: 0, tieBreak: 0 }
    })));
    expect(fullQualityRefinementScore(layout)).toBe(Infinity);
    const expected = eagerRefinementReference(layout, candidates, 3, 3);
    const actual = refineAnnotationLayout(layout, candidates, { passes: 3, maxCandidatesPerAnnotation: 3 });
    expect(actual).toEqual(expected);
    expect(fullQualityRefinementScore(actual)).toBe(0);
    expect(evaluateAnnotationLayout(actual)).toEqual(evaluateAnnotationLayout(expected));
  });
});
