/** Paired comparison with the pre-optimization full-quality reference. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { resolveAnnotationLayout, evaluateAnnotationLayout } from '../dist/index.js';
import { refineAnnotationLayout } from '../dist/core/layout-resolver.js';
import { distribution } from './worker-benchmark-summary.mjs';

const compiler = await createServer({ configFile: false, root: new URL('../', import.meta.url).pathname,
  logLevel: 'error', server: { middlewareMode: true } });
let reference;
try { reference = (await compiler.ssrLoadModule('/test/fixtures/refinement-reference.ts')).eagerRefinementReference; }
finally { await compiler.close(); }
const observations = [];
for (const count of [40, 200]) {
 for (const workload of ['already-clear', 'crowded']) {
  const annotations = Array.from({ length: count }, (_, index) => ({
    id: `node-${String(index).padStart(3, '0')}`, priority: count - index,
    anchor: { type: 'point', point: { x: 65 + index % 13 * 96, y: 75 + Math.floor(index / 13) * 79 } },
    note: { title: `Node ${index}` }, placement: { side: 'right', offset: [12, 24], align: 'center' },
    connector: { type: 'straight', routing: 'none' }
  }));
  const options = { annotations, bounds: { x: 0, y: 0, width: 1780, height: workload === 'crowded' && count === 40 ? 300 : 1400 },
    obstacles: [{ x: 1405, y: 1130, width: 60, height: 50 }],
    noteSizes: Object.fromEntries(annotations.map((note) => [note.id, workload === 'crowded' ? { width: 136, height: 110 } : { width: 84, height: 38 }])),
    diagnostics: { candidates: 8 } };
  const greedy = resolveAnnotationLayout(options);
  const frontier = greedy.diagnostics.annotations.map((row) => row.candidates);
  if (workload === 'crowded') assert(evaluateAnnotationLayout(greedy).metrics.noteOverlapArea > 0,
    'The crowded comparison must exercise actual nonzero refinement scoring');
  const old = () => reference(greedy, frontier, 2, 8);
  const current = () => refineAnnotationLayout(greedy, frontier, { passes: 2, maxCandidatesPerAnnotation: 8 });
  const expected = old();
  assert.deepStrictEqual(current(), expected);
  const samples = { reference: [], optimized: [] };
  for (let repeat = 0; repeat < 4; repeat++) {
    for (const name of repeat % 2 ? ['optimized', 'reference'] : ['reference', 'optimized']) {
      const start = performance.now();
      const layout = name === 'reference' ? old() : current();
      samples[name].push(performance.now() - start);
      assert.deepStrictEqual(layout, expected, 'Selected layout differs from the full-quality oracle');
      assert.deepStrictEqual(evaluateAnnotationLayout(layout), evaluateAnnotationLayout(expected));
    }
  }
  observations.push({ count, workload, exactLayoutAndQualityParity: true, samplesMs: samples,
    referenceMs: distribution(samples.reference), optimizedMs: distribution(samples.optimized),
    initialQuality: evaluateAnnotationLayout(greedy).metrics,
    refinedQuality: evaluateAnnotationLayout(expected).metrics });
 }
}
console.log(JSON.stringify({ schemaVersion: 1, benchmark: 'paired-exact-refinement-scoring',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  interpretation: 'Same greedy layout, fixed candidate frontier, two passes/eight candidates. Warmed alternating trials in one Node process measure refinement only, not initial placement, browser input latency or paint. The reference uses the pre-optimization full-quality algorithm. Timings are observations, not CI thresholds.',
  observations }, null, 2));
