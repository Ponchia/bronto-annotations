import { describe, expect, it } from 'vitest';
import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityIssue,
  formatLayoutQualityReport,
  resolveAnnotationLayout
} from '../../src/index.js';
import type {
  Annotation,
  ResolvedAnnotation,
  ResolvedLayout
} from '../../src/index.js';

describe('layout quality evaluation', () => {
  it('reports a clean layout as ok with no blocking issues', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'clean',
          anchor: { type: 'point', point: { x: 80, y: 80 } },
          note: { title: 'Clean' }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 },
      noteSizes: {
        clean: { width: 120, height: 60 }
      }
    });
    const report = evaluateAnnotationLayout(layout);

    expect(report.ok).toBe(true);
    expect(report.metrics.noteOverlapArea).toBe(0);
    expect(report.metrics.boundsOverflowArea).toBe(0);
  });

  it('formats and asserts layout quality reports for CI and generated reports', () => {
    const layout = warningLayout();
    const report = evaluateAnnotationLayout(layout);
    const summary = formatLayoutQualityReport(report, {
      includeInfo: true,
      label: 'Report annotations',
      maxIssues: 2
    });

    expect(report.ok).toBe(true);
    expect(summary).toContain('Report annotations: ok');
    expect(summary).toContain('warning obstacle-overlap target=warning obstacle=0 area=800');
    expect(formatLayoutQualityIssue(report.issues[0]!)).toContain('overlaps obstacle 0');
    expect(() => assertAnnotationLayoutQuality(report)).not.toThrow();
    expect(() => assertAnnotationLayoutQuality(report, { failOnWarnings: true, label: 'Report annotations' }))
      .toThrow(/Report annotations assertion failed: 1 warning/);
    expect(() => assertAnnotationLayoutQuality(report, { minScore: 100 }))
      .toThrow(/below required minimum 100/);
  });

  it('reports note overlap, overflow, obstacle overlap, and connector crossings', () => {
    const layout: ResolvedLayout = {
      bounds: { x: 0, y: 0, width: 180, height: 140 },
      placementBounds: { x: 0, y: 0, width: 180, height: 140 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      obstacles: [
        { x: 48, y: 64, width: 28, height: 22 }
      ],
      annotations: [
        resolved('a', { x: 60, y: 50, width: 80, height: 50 }),
        resolved('b', { x: 90, y: 70, width: 110, height: 50 })
      ]
    };
    const report = evaluateAnnotationLayout(layout);

    expect(report.ok).toBe(false);
    expect(report.score).toBeLessThan(100);
    expect(report.issues.map((issue) => issue.type)).toEqual(expect.arrayContaining([
      'note-overlap',
      'bounds-overflow',
      'obstacle-overlap',
      'connector-obstacle',
      'connector-note'
    ]));
    expect(report.metrics.noteOverlapArea).toBeGreaterThan(0);
    expect(report.metrics.boundsOverflowArea).toBeGreaterThan(0);
    expect(report.metrics.connectorObstacleHits).toBeGreaterThan(0);
    expect(() => assertAnnotationLayoutQuality(report, { label: 'Broken annotations' }))
      .toThrow(/Broken annotations assertion failed: blocking layout quality errors/);
  });
});

function warningLayout(): ResolvedLayout {
  return {
    bounds: { x: 0, y: 0, width: 240, height: 160 },
    placementBounds: { x: 0, y: 0, width: 240, height: 160 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    obstacles: [
      { x: 80, y: 40, width: 40, height: 20 }
    ],
    annotations: [
      resolved('warning', { x: 70, y: 34, width: 120, height: 60 })
    ]
  };
}

function resolved(id: string, noteBox: { x: number; y: number; width: number; height: number }): ResolvedAnnotation {
  const annotation: Annotation = {
    id,
    anchor: { type: 'point', point: { x: 20, y: 70 } },
    note: { title: id },
    connector: { type: 'straight' }
  };

  return {
    id,
    annotation,
    subject: {
      type: 'point',
      point: { x: 20, y: 70 },
      box: { x: 20, y: 70, width: 0, height: 0 }
    },
    anchorPoint: { x: 20, y: 70 },
    noteBox,
    connector: {
      type: 'straight',
      points: [
        { x: 20, y: 70 },
        { x: noteBox.x, y: noteBox.y + noteBox.height / 2 }
      ],
      d: `M 20 70 L ${noteBox.x} ${noteBox.y + noteBox.height / 2}`
    },
    placement: {
      side: 'right',
      align: 'center',
      offset: 16,
      score: 0,
      candidates: []
    }
  };
}
