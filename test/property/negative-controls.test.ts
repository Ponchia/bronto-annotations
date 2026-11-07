// @vitest-environment jsdom
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { anchorPoint, renderAnnotationsSvg, resolveAnnotationLayout } from '../../src/index.js';
import { anchorsFromD2Diagram, validateD2DiagramAnchors } from '../../src/adapters/d2.js';
import {
  invalidCoordinatesProperty, layoutProperty, midpointProperty,
  repeatedSegmentsProperty, serializationProperty, translationProperty
} from './properties.js';

// Run the SAME predicates against deliberately broken implementations. These
// controls never edit source, and must find and replay a minimized failure.
const controls = {
  'vertex instead of arc-length midpoint': midpointProperty((...args) =>
    anchorsFromD2Diagram(...args).map(result => ({ ...result,
      point: result.anchor.type === 'path' ? result.anchor.points[0]! : result.point }))),
  'absolute coordinate bias': translationProperty((...args) => {
    const point = anchorPoint(...args);
    return { x: Math.abs(point.x), y: point.y };
  }),
  'duplicate segments produce NaN': repeatedSegmentsProperty((...args) => {
    const [anchor] = args;
    if (anchor.type === 'path' && anchor.points.length > 1
      && anchor.points[0]!.x === anchor.points[1]!.x && anchor.points[0]!.y === anchor.points[1]!.y) {
      return { x: NaN, y: NaN };
    }
    return anchorPoint(...args);
  }),
  'validation accepts nonfinite coordinates': invalidCoordinatesProperty((...args) =>
    ({ ...validateD2DiagramAnchors(...args), ok: true })),
  'layout silently drops annotations': layoutProperty(options =>
    ({ ...resolveAnnotationLayout(options), annotations: [] })),
  'renderer emits unescaped markup': serializationProperty((...args) =>
    renderAnnotationsSvg(...args).replaceAll('&lt;', '<'))
};

describe('property negative controls', () => {
  for (const [name, property] of Object.entries(controls)) {
    it(`detects and replays: ${name}`, () => {
      const result = fc.check<unknown[]>(property, { seed: 20261107, numRuns: 100 });
      assert.equal(result.failed, true);
      assert.notEqual(result.counterexample, null);
      assert.notEqual(result.counterexamplePath, null);
      const replay = fc.check<unknown[]>(property, {
        seed: result.seed, path: result.counterexamplePath!, numRuns: 100, endOnFailure: true
      });
      assert.equal(replay.failed, true);
      assert.deepEqual(replay.counterexample, result.counterexample);
    });
  }
});
