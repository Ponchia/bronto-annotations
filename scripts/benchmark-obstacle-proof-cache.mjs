import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../dist/index.js';
import { writeLine } from './log.mjs';

/**
 * Optional, non-gating measurement of repeated far-obstacle updates. A first
 * update must inspect every possible note/connector candidate; subsequent
 * updates can reuse the exact geometry proof while global inputs are stable.
 * The fresh full solver remains the independent correctness reference.
 */
const observations = [];

for (const count of [40, 200]) {
  const notes = Array.from({ length: count }, (_, index) => ({
    id: `note-${String(index).padStart(3, '0')}`,
    priority: count - index,
    anchor: { type: 'point', point: {
      x: 70 + (index % 20) * 110,
      y: 65 + Math.floor(index / 20) * 64
    } },
    note: { title: `Note ${index}` },
    connector: { type: 'straight', routing: 'none' },
    placement: {
      side: ['right', 'top'], allowedSides: ['right', 'top'],
      align: 'center', allowedAligns: ['center'],
      offset: [12, 22]
    }
  }));
  const options = {
    annotations: notes,
    bounds: { x: 0, y: 0, width: 3600, height: 1000 },
    obstacles: [{ x: 3400, y: 800, width: 40, height: 30 }],
    noteSizes: Object.fromEntries(notes.map((note) => [note.id, { width: 90, height: 40 }])),
    refinement: false
  };
  const session = createIncrementalAnnotationLayoutSession(options);
  const original = session.layout;

  function update(previous, offset) {
    const next = structuredClone(previous);
    next.obstacles[0].x += offset;
    const started = performance.now();
    const layout = session.update(next);
    return { input: next, layout, elapsedMs: Number((performance.now() - started).toFixed(3)) };
  }

  const first = update(options, 13);
  const second = update(first.input, 15);
  const third = update(second.input, 11);
  const fullStarted = performance.now();
  const fresh = resolveAnnotationLayout(third.input);
  const fullMs = Number((performance.now() - fullStarted).toFixed(3));

  for (const result of [first, second, third]) {
    assert.equal(result.layout.annotations.length, count);
    assert.equal(result.layout.annotations.every((item, index) =>
      item === original.annotations[index]), true, 'Unchanged notes must retain identity');
    const control = resolveAnnotationLayout(result.input);
    assert.deepEqual(result.layout, control, 'Incremental output differs from independent full layout');
    assert.deepEqual(evaluateAnnotationLayout(result.layout), evaluateAnnotationLayout(control),
      'Layout quality differs from full resolver');
  }
  assert.deepEqual(third.layout, fresh);
  observations.push({
    count,
    initialExhaustiveProofMs: first.elapsedMs,
    cachedSecondUpdateMs: second.elapsedMs,
    cachedThirdUpdateMs: third.elapsedMs,
    fullFreshSolveMs: fullMs,
    reused: count,
    fullParity: true
  });
}

writeLine(JSON.stringify({
  benchmark: 'incremental-distant-obstacle-footprint-cache',
  interpretation: 'One-run host-dependent observations; no browser paint or latency guarantee.',
  observations
}, null, 2));
