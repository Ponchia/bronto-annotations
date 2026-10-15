/**
 * Optional, GC-enabled memory observation for the host-owned obstacle proof
 * cache. Runs against the actual compiled headless resolver. Never included
 * in CI's performance gate, because heap/RSS readings depend on Node/V8,
 * architecture, concurrent work and GC timing.
 *
 *   npm run benchmark:obstacle-cache:memory
 *   npm run benchmark:obstacle-cache:memory -- --count=40 --updates=20
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../dist/index.js';
import { writeLine } from './log.mjs';

function integerArg(key, fallback, max) {
  const arg = process.argv.slice(2).find((item) => item.startsWith(key));
  if (!arg) return fallback;
  const value = Number(arg.slice(key.length));
  assert(Number.isSafeInteger(value) && value >= 1 && value <= max,
    key + ' must be an integer between 1 and ' + max);
  return value;
}
const count = integerArg('--count=', 200, 300);
const updates = integerArg('--updates=', 14, 100);
assert(typeof globalThis.gc === 'function',
  'Run this optional memory probe with node --expose-gc');

const notes = Array.from({ length: count }, (_, index) => ({
  id: 'note-' + String(index).padStart(3, '0'),
  priority: count - index,
  anchor: { type: 'point', point: {
    x: 50 + (index % 20) * 110,
    y: 50 + Math.floor(index / 20) * 85
  } },
  note: { title: 'Note ' + index },
  connector: { type: 'straight', routing: 'none' },
  placement: {
    side: ['left', 'right', 'top', 'bottom'],
    allowedSides: ['left', 'right', 'top', 'bottom'],
    align: 'center', allowedAligns: ['center', 'start', 'end'],
    offset: [6, 12, 18, 24, 32], crossOffset: [0, -12, 12]
  }
}));
const options = {
  annotations: notes,
  bounds: { x: 0, y: 0, width: 3600, height: 1500 },
  obstacles: [{ x: 3450, y: 1300, width: 25, height: 20 }],
  noteSizes: Object.fromEntries(notes.map((note) =>
    [note.id, { width: 90, height: 43 }])),
  refinement: false
};
const start = performance.now();
const session = createIncrementalAnnotationLayoutSession(options);
const coldSolveMs = performance.now() - start;
const initialLayout = session.layout;

function sampleMemory() {
  globalThis.gc();
  globalThis.gc();
  const { heapUsed, arrayBuffers, rss } = process.memoryUsage();
  return { heapUsed, arrayBuffers, rss };
}
const difference = (before, after) => Object.fromEntries(
  Object.keys(before).map((key) => [key, after[key] - before[key]])
);
function roundedMs(value) {
  return Math.round(value * 1000) / 1000;
}

const cold = sampleMemory();
options.obstacles[0].x += 9;
const warmStart = performance.now();
const warmLayout = session.update(options);
const initialProofMs = performance.now() - warmStart;
assert(warmLayout.annotations.every((item, index) =>
  item === initialLayout.annotations[index]),
'Independent obstacle changes must retain all resolved winners');
const warmed = sampleMemory();

const warmUpdateMs = [];
for (let index = 0; index < updates; index += 1) {
  options.obstacles[0].x += index % 2 === 0 ? -7 : 7;
  const now = performance.now();
  const updated = session.update(options);
  warmUpdateMs.push(roundedMs(performance.now() - now));
  assert(updated.annotations.every((item, i) => item === initialLayout.annotations[i]),
    'Repeated independent obstacles must not discard unchanged placements');
}
const repeated = sampleMemory();
const full = resolveAnnotationLayout(options);
assert.deepEqual(session.layout, full, 'Memory probe output differs from a fresh full resolve');
assert.deepEqual(evaluateAnnotationLayout(session.layout), evaluateAnnotationLayout(full),
  'Memory probe changed layout quality');

const retained = difference(cold, warmed);
const drift = difference(warmed, repeated);
writeLine(JSON.stringify({
  benchmark: 'obstacle-footprint-cache-retained-memory',
  count,
  updates,
  coldSolveMs: roundedMs(coldSolveMs),
  firstExhaustiveProofMs: roundedMs(initialProofMs),
  repeatedUpdateMs: warmUpdateMs,
  memory: {
    cold,
    warmed,
    repeated,
    firstProofDeltaBytes: retained,
    repeatedUpdateDriftBytes: drift,
    firstProofHeapPlusArrayBuffersBytes: retained.heapUsed + retained.arrayBuffers
  },
  fullLayoutAndQualityParity: true,
  interpretation: 'One GC-enabled Node process; heap, ArrayBuffer and RSS readings are observational, not browser memory, memory limits, or reproducible CI thresholds. Candidate arrays and runtime JIT/GC can affect all snapshots.'
}, null, 2));
