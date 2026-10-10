import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../dist/index.js';
import { writeLine } from './log.mjs';

// An opt-in informative benchmark, not a CI timing budget: a changed last note
// reuses the preceding priority-ordered winners; a full solve is the control.
const cases = [50, 200];
const results = [];

for (const count of cases) {
  const options = scenario(count);
  const session = createIncrementalAnnotationLayoutSession(options);
  const original = session.layout;
  const edited = structuredClone(options);
  const last = edited.annotations[edited.annotations.length - 1];
  const old = last.anchor.box;
  last.anchor = { type: 'box', box: { ...old, x: old.x + 25, y: old.y - 8 } };

  const startIncremental = performance.now();
  const increment = session.update(edited);
  const incrementalMs = performance.now() - startIncremental;
  const startFull = performance.now();
  const full = resolveAnnotationLayout(edited);
  const fullMs = performance.now() - startFull;

  assert.deepEqual(increment, full, 'Incremental update must match authoritative fresh resolution exactly');
  assert.deepEqual(evaluateAnnotationLayout(increment), evaluateAnnotationLayout(full),
    'Quality metrics must remain identical');
  assert.equal(increment.annotations.length, count);
  for (let index = 0; index < count - 1; index += 1) {
    assert.equal(increment.annotations[index], original.annotations[index],
      'Stable prefix should preserve resolved identity for React memoization');
  }
  assert.notEqual(increment.annotations[count - 1], original.annotations[count - 1]);

  results.push({
    annotations: count,
    changedIndex: count - 1,
    reusedAnnotations: count - 1,
    incrementalMs: Number(incrementalMs.toFixed(3)),
    fullMs: Number(fullMs.toFixed(3)),
    speedup: Number((fullMs / incrementalMs).toFixed(2)),
    verifiedExactParity: true
  });
}

writeLine(JSON.stringify({
  benchmark: 'incremental-layout-late-edit',
  interpretation: 'Single-run local observation; do not treat as a latency SLO.',
  results
}, null, 2));

function scenario(count) {
  const annotations = Array.from({ length: count }, (_, i) => ({
    id: `annotation-${String(i).padStart(3, '0')}`,
    priority: count - i,
    anchor: { type: 'box', box: {
      x: 56 + (i % 20) * 58 + (Math.floor(i / 20) % 2) * 14,
      y: 52 + Math.floor(i / 20) * 72 + (i % 3) * 8,
      width: 28 + (i % 5) * 4,
      height: 22 + (i % 4) * 5
    } },
    note: { title: `Annotation ${i}`, body: 'Deterministic dense layout benchmark.' },
    placement: { side: i % 2 === 0 ? 'right' : 'left', offset: [12, 22], crossOffset: [0, -18, 18] },
    connector: { type: i % 3 === 0 ? 'elbow' : 'straight' }
  }));
  const obstacles = Array.from({ length: count === 50 ? 15 : 40 }, (_, i) => ({
    x: 34 + (i % 15) * 76,
    y: 34 + Math.floor(i / 15) * 84,
    width: 44 + (i % 4) * 10,
    height: 36 + (i % 3) * 10
  }));
  return {
    annotations,
    obstacles,
    noteSizes: Object.fromEntries(annotations.map((annotation, index) => [annotation.id, {
      width: 96 + index % 4 * 12,
      height: 40 + index % 3 * 8
    }])),
    bounds: { x: 0, y: 0, width: 1280, height: 820 },
    padding: 18,
    placement: {
      side: ['right', 'bottom', 'top', 'left'],
      allowedSides: ['right'],
      align: 'center',
      allowedAligns: ['center'],
      offset: 14,
      crossOffset: 0,
      maxCandidates: 8
    },
    refinement: false
  };
}
