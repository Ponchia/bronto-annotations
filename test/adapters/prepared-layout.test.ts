import { describe, expect, it } from 'vitest';
import {
  generatedSurfaceLayoutDefaults,
  resolvePreparedAnnotationLayout,
  type PreparedAnnotationLayoutOptions
} from '../../src/index.js';
import { prepareReactFlowAnnotations } from '../../src/adapters/react-flow.js';

describe('prepared adapter layout helper', () => {
  it('resolves prepared adapter annotations into layout and quality evidence', () => {
    const prepared = prepareReactFlowAnnotations({
      nodes: [
        { id: 'api', position: { x: 70, y: 72 }, width: 72, height: 44 },
        { id: 'worker', position: { x: 230, y: 72 }, width: 88, height: 44 }
      ],
      edges: [
        { id: 'api-worker', source: 'api', target: 'worker' }
      ]
    }, [
      {
        id: 'api-note',
        nodeId: 'api',
        note: { title: 'API node' },
        placement: { side: ['bottom', 'right'] }
      }
    ], {
      assert: true,
      obstacles: { includeEdges: true, padding: 4 }
    });
    const extraObstacle = { x: 12, y: 12, width: 24, height: 24 };
    const resolved = resolvePreparedAnnotationLayout(prepared, {
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      additionalObstacles: [extraObstacle],
      assertValidation: true,
      assertTargetAlignment: { label: 'Generated graph target alignment', failOnWarnings: true },
      assertQuality: true,
      noteSizes: { 'api-note': { width: 116, height: 48 } },
      placement: {
        align: ['center', 'start', 'end'],
        offset: [16, 28],
        crossOffset: [0, -24, 24]
      },
      qualityFormat: { label: 'Generated graph annotations' },
      refinement: true,
      targetAlignmentTargets: [{
        id: 'api-note',
        expected: 'rendered API node box',
        box: { x: 70, y: 72, width: 72, height: 44 }
      }],
      targetAlignmentOptions: { minOverlapRatio: 0.98, tolerance: 0.5 },
      targetAlignmentFormat: {
        label: 'Generated graph target alignment',
        includeAligned: true
      }
    });

    expect(resolved.validation.ok).toBe(true);
    expect(resolved.annotations).toHaveLength(1);
    expect(resolved.obstacles).toContainEqual(extraObstacle);
    expect(resolved.layout.annotations[0]?.id).toBe('api-note');
    expect(resolved.quality.ok).toBe(true);
    expect(resolved.validationSummary).toContain('Annotation anchors: ok');
    expect(resolved.qualitySummary).toContain('Generated graph annotations: ok');
    expect(resolved.targetAlignment?.ok).toBe(true);
    expect(resolved.targetAlignmentSummary).toContain('Generated graph target alignment: ok');
    expect(resolved.targetAlignmentSummary).toContain('api-note: aligned rendered API node box');
  });

  it('provides generated-surface defaults for prepared adapter layouts', () => {
    const defaults = generatedSurfaceLayoutDefaults({
      anchorLabel: 'Generated graph anchors',
      failOnWarnings: true,
      includeInfo: true,
      layoutLabel: 'Generated graph layout'
    });
    const prepared = prepareReactFlowAnnotations({
      nodes: [
        { id: 'review', position: { x: 70, y: 72 }, width: 72, height: 44 }
      ]
    }, [
      {
        id: 'review-note',
        nodeId: 'review',
        note: { title: 'Review node' }
      }
    ]);
    const resolved = resolvePreparedAnnotationLayout(prepared, {
      ...defaults,
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      noteSizes: { 'review-note': { width: 132, height: 52 } }
    });

    expect(defaults.placement.side).toEqual(['right', 'bottom', 'top', 'left']);
    expect(defaults.refinement).toEqual({ passes: 2, maxCandidatesPerAnnotation: 32 });
    expect(resolved.validationSummary).toContain('Generated graph anchors: ok');
    expect(resolved.qualitySummary).toContain('Generated graph layout: ok');
    expect(resolved.quality.ok).toBe(true);
    expect(defaults.targetAlignmentFormat).toMatchObject({
      label: 'Generated graph anchors target alignment',
      includeAligned: true
    });
  });

  it('can fail fast when prepared adapter validation is missing or warning-only', () => {
    const missing = prepareReactFlowAnnotations({ nodes: [] }, [
      { id: 'missing-node', nodeId: 'missing', note: { title: 'Missing' } }
    ]);
    const fallback = prepareReactFlowAnnotations({
      nodes: [
        { id: 'review', position: { x: 70, y: 72 }, width: 72, height: 44 }
      ]
    }, [
      {
        id: 'fallback-handle',
        handle: { nodeId: 'review', id: 'source', side: 'right' },
        note: { title: 'Fallback handle' }
      }
    ]);

    expect(() => resolvePreparedAnnotationLayout(missing, {
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      assertValidation: { label: 'Generated graph anchors' }
    })).toThrow(/Generated graph anchors: failed/);
    expect(() => resolvePreparedAnnotationLayout(fallback, {
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      assertValidation: { failOnWarnings: true, label: 'Generated graph anchors' }
    })).toThrow(/1 warning/);
    expect(() => resolvePreparedAnnotationLayout(fallback, {
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      assertTargetAlignment: { label: 'Generated graph target alignment' }
    })).toThrow(/targetAlignmentTargets are required/);
  });

  it('can fail fast when prepared annotations resolve to poor layout quality', () => {
    const prepared = prepareReactFlowAnnotations({
      nodes: [
        { id: 'api', position: { x: 70, y: 72 }, width: 72, height: 44 },
        { id: 'worker', position: { x: 230, y: 72 }, width: 88, height: 44 }
      ]
    }, [
      {
        id: 'api-note',
        nodeId: 'api',
        note: { title: 'API node' },
        placement: { manual: { x: 160, y: 70, side: 'right' } }
      },
      {
        id: 'worker-note',
        nodeId: 'worker',
        note: { title: 'Worker node' },
        placement: { manual: { x: 160, y: 70, side: 'left' } }
      }
    ]);
    const options: PreparedAnnotationLayoutOptions = {
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      assertQuality: { label: 'Generated graph annotations' },
      noteSizes: {
        'api-note': { width: 140, height: 60 },
        'worker-note': { width: 140, height: 60 }
      }
    };

    expect(() => resolvePreparedAnnotationLayout(prepared, options))
      .toThrow(/Generated graph annotations assertion failed: blocking layout quality errors/);
  });
});
