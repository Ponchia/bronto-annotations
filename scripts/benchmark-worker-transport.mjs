/**
 * Opt-in transport microbenchmark using the actual host-owned Worker patch
 * codec, real structuredClone and node:worker_threads MessageChannel.
 *
 * Node's MessageChannel is NOT Chromium Worker.postMessage; its timings can
 * separate synchronous cloning/dispatch from event-loop delivery on this
 * host, but cannot measure browser transport bytes, paint or frame rate.
 * It deliberately does not change the package runtime or public exports.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { MessageChannel } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../dist/index.js';
import { writeLine } from './log.mjs';

const args = process.argv.slice(2);
function positiveIntegerArg(prefix, fallback, maximum) {
  const match = args.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;
  const value = Number(match.slice(prefix.length));
  assert(Number.isSafeInteger(value) && value > 0 && value <= maximum,
    'Expected positive integer for ' + prefix + ', maximum ' + maximum);
  return value;
}
const repeat = positiveIntegerArg('--rounds=', 3, 20);
const requestedCounts = args.find((arg) => arg.startsWith('--counts='));
const counts = requestedCounts
  ? requestedCounts.slice('--counts='.length).split(',').map((value) => Number(value))
  : [40, 200];
assert(counts.length > 0 && counts.length <= 5
  && counts.every((count) => Number.isSafeInteger(count) && count >= 2 && count <= 300),
'--counts must be a comma-separated list of 2 to 300, at most five counts');

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
// The Vite SSR transformer compiles the fixture's TypeScript while preserving
// the exact comparator and codec used in the browser, with no test-only copy.
const compiler = await createServer({
  configFile: false,
  root: sourceRoot,
  logLevel: 'error',
  server: { middlewareMode: true }
});
let encodeWorkerLayout;
let applyWorkerLayout;
try {
  const fixture = await compiler.ssrLoadModule('/test/fixtures/worker-browser/layout-patch.ts');
  encodeWorkerLayout = fixture.encodeWorkerLayout;
  applyWorkerLayout = fixture.applyWorkerLayout;
} finally {
  await compiler.close();
}
assert.equal(typeof encodeWorkerLayout, 'function');
assert.equal(typeof applyWorkerLayout, 'function');

function makeOptions(count) {
  const annotations = Array.from({ length: count }, (_, index) => ({
    id: 'note-' + String(index).padStart(3, '0'),
    priority: count - index,
    anchor: { type: 'point', point: {
      x: 70 + (index % 20) * 135,
      y: 70 + Math.floor(index / 20) * 116
    }},
    note: { title: 'Note ' + index, body: 'Detailed callout ' + index },
    connector: { type: 'straight', routing: 'none' },
    placement: {
      side: ['right', 'top'],
      allowedSides: ['right', 'top'],
      align: 'center',
      allowedAligns: ['center'],
      offset: [12, 22],
      maxCandidates: 2
    }
  }));
  return {
    annotations,
    bounds: { x: 0, y: 0, width: 3600, height: 1450 },
    obstacles: [{ x: 3420, y: 1320, width: 36, height: 34 }],
    noteSizes: Object.fromEntries(annotations.map((item) =>
      [item.id, { width: 92, height: 43 }])),
    refinement: false
  };
}
const scenarios = [
  {
    name: 'distant-obstacle',
    update(options) { options.obstacles[0].x += 19; }
  },
  {
    name: 'late-note-edit',
    update(options) { options.annotations.at(-1).note.title += ' edited'; }
  },
  {
    name: 'early-note-edit',
    update(options) { options.annotations[0].note.title += ' edited'; }
  },
  {
    name: 'bounds-change',
    update(options) { options.bounds.width += 150; }
  }
];

function median(measurements) {
  const ordered = [...measurements].sort((a, b) => a - b);
  return ordered.length % 2 === 1
    ? ordered[Math.floor(ordered.length / 2)]
    : (ordered[ordered.length / 2 - 1] + ordered[ordered.length / 2]) / 2;
}
function ms(value) {
  assert(Number.isFinite(value) && value >= 0, 'Invalid benchmark measurement');
  return Math.round(value * 1000) / 1000;
}
function cloneTiming(value) {
  const samples = [];
  for (let index = 0; index < repeat; index += 1) {
    const start = performance.now();
    structuredClone(value);
    samples.push(performance.now() - start);
  }
  return ms(median(samples));
}
async function messageTiming(value) {
  const sync = [];
  const total = [];
  for (let index = 0; index < repeat; index += 1) {
    const channel = new MessageChannel();
    try {
      const received = once(channel.port2, 'message');
      const start = performance.now();
      channel.port1.postMessage(value);
      const syncTime = performance.now() - start;
      const [message] = await received;
      const elapsed = performance.now() - start;
      // Confirm the channel actually delivered the intended payload shape.
      assert.deepEqual(message?.kind, value.kind);
      sync.push(syncTime);
      total.push(elapsed);
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  }
  return { postMessageSyncMs: ms(median(sync)), deliveryElapsedMs: ms(median(total)) };
}
function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

const observations = [];
for (const count of counts) {
  for (const scenario of scenarios) {
    const originalOptions = makeOptions(count);
    const session = createIncrementalAnnotationLayoutSession(originalOptions);
    const before = session.layout;
    const nextOptions = structuredClone(originalOptions);
    scenario.update(nextOptions);

    const inputCloneMs = cloneTiming(nextOptions);
    const updateStart = performance.now();
    const updated = session.update(nextOptions);
    const incrementalMs = ms(performance.now() - updateStart);
    const solveStart = performance.now();
    const fresh = resolveAnnotationLayout(nextOptions);
    const fullSolveMs = ms(performance.now() - solveStart);
    assert.deepStrictEqual(updated, fresh, 'Incremental layout differs from full resolution');
    assert.deepStrictEqual(evaluateAnnotationLayout(updated), evaluateAnnotationLayout(fresh));

    const encodeStart = performance.now();
    const response = encodeWorkerLayout(2, 1, updated, { revision: 1, layout: before });
    const encodeMs = ms(performance.now() - encodeStart);
    const decoded = applyWorkerLayout(
      { revision: 1, layout: before }, structuredClone(response)).state.layout;
    assert.deepStrictEqual(decoded, fresh, 'Transport reconstruction differs from full layout');
    const changed = response.kind === 'patch' ? response.changed.length : count;
    const reused = count - changed;

    // Structured-cloneable payload, encoded from the actual fixture codec.
    // The snapshot comparison is the complete resolved layout object, not
    // the full Worker metadata envelope; both choices are documented.
    const replyCloneMs = cloneTiming(response);
    const fullCloneMs = cloneTiming(updated);
    const replyTransport = await messageTiming(response);
    const fullTransport = await messageTiming({ kind: 'snapshot', layout: updated });
    const fullJsonBytes = jsonBytes(updated);
    const replyJsonBytes = jsonBytes(response);
    assert(fullJsonBytes > 0 && replyJsonBytes > 0);

    observations.push({
      count,
      scenario: scenario.name,
      replyKind: response.kind,
      changed,
      reused,
      exactLayoutAndQualityParity: true,
      inputCloneMs,
      incrementalMs,
      independentFullSolveMs: fullSolveMs,
      encodeMs,
      jsonBytes: { completeLayout: fullJsonBytes, encodedReply: replyJsonBytes },
      nodeStructuredCloneMs: {
        fullLayout: fullCloneMs,
        encodedReply: replyCloneMs
      },
      nodeMessageChannelMs: {
        full: fullTransport,
        reply: replyTransport
      }
    });
  }
}
writeLine(JSON.stringify({
  benchmark: 'node-worker-transport-cost-envelope',
  repeats: repeat,
  interpretation: 'Optional Node measurements on one process. Node structuredClone and MessageChannel are not real browser Worker transport or byte counts. JSON lengths estimate text size only; callback delivery includes event-loop scheduling, and no result is a compositor paint timestamp. No latency threshold is asserted.',
  observations
}, null, 2));
