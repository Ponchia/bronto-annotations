// A low-note/high-obstacle workload. Both lanes run the identical candidate
// scorer; only its conservative broad phase changes. Timings include indexing.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createObstacleQuery } from '../dist/core/obstacle-query.js';
import { searchPlacementCandidates } from '../dist/core/placement.js';

const reports = [];
for (const count of [200, 1000]) {
  const obstacles = Array.from({ length: count }, (_, i) => ({
    x: (i % 20) * 400 - 12, y: Math.floor(i / 20) * 220 - 12,
    width: 224, height: 144
  }));
  const annotations = obstacles.slice(0, 24).map((box, i) => ({
    id: `note-${String(i).padStart(2, '0')}`, anchor: { type: 'box', box },
    note: { title: 'A measured source note' }
  }));
  const bounds = { x: -480, y: -480, width: 9000, height: Math.ceil(count / 20) * 220 + 960 };
  const solve = (indexed) => {
    const query = indexed ? createObstacleQuery(obstacles) : () => obstacles;
    const placedNotes = [];
    return annotations.map((annotation) => {
      const winner = searchPlacementCandidates({ annotation, bounds,
        noteSize: { width: 180, height: 72 }, obstacles, placedNotes }, { limit: 1 }, query)[0];
      placedNotes.push(winner.noteBox);
      return winner;
    });
  };
  assert.deepEqual(solve(true), solve(false));
  const linearMs = [], indexedMs = [];
  for (let round = 0; round < 5; round++) {
    const outputs = new Map();
    for (const indexed of round % 2 ? [true, false] : [false, true]) {
      const before = performance.now();
      outputs.set(indexed, solve(indexed));
      (indexed ? indexedMs : linearMs).push(performance.now() - before);
    }
    assert.deepEqual(outputs.get(true), outputs.get(false));
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  reports.push({ obstacles: count, notes: annotations.length, samples: 5,
    linearMs, indexedMs, medianLinearMs: median(linearMs), medianIndexedMs: median(indexedMs),
    parity: 'exact candidate geometry, score and connector equality' });
}
console.log(JSON.stringify({ environment: `${process.version} ${process.platform}/${process.arch}`,
  scope: 'Synthetic headless placement, not browser input latency; index creation included', reports }, null, 2));
