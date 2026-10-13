import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as current from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
let baseline;
let output;
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  const value = process.argv[++i];
  assert.ok(value && !value.startsWith('--'), `${flag} requires a value`);
  if (flag === '--baseline-module') baseline = resolve(value);
  else if (flag === '--output') output = resolve(value);
  else throw new Error(`Unknown option ${flag}`);
}
const reference = baseline ? await import(pathToFileURL(baseline).href) : current;
assert.equal(typeof reference.resolveAnnotationLayout, 'function');
const cases = [];
for (const count of [5, 12, 20]) {
  const annotations = Array.from({ length: count }, (_, i) => ({
    id: `placement-${i}`, priority: count - i, note: { title: `Note ${i}` },
    anchor: { type: 'box', box: { x: 110 + i % 5 * 235, y: 150 + Math.floor(i / 5) * 190, width: 35, height: 25 } },
    connector: { type: i % 2 ? 'straight' : 'elbow' },
    ...(i % 3 === 0 ? { placement: { side: 'right', align: 'start' } } : {})
  }));
  const options = {
    annotations, bounds: { x: 0, y: 0, width: 1400, height: 950 }, padding: 12,
    obstacles: [{ x: 350, y: 160, width: 35, height: 35 }, { x: 800, y: 420, width: 60, height: 30 }],
    noteSizes: Object.fromEntries(annotations.map((a, i) => [a.id, { width: 90 + i % 3 * 12, height: 38 + i % 2 * 8 }])),
    refinement: false
  };
  const boundedOptions = { ...options, placement: { maxCandidates: 8 } };
  const referenceOptions = baseline ? boundedOptions : options;
  const measurements = { reference: [], bounded: [] };
  let expected, actual;
  reference.resolveAnnotationLayout(referenceOptions);
  current.resolveAnnotationLayout(boundedOptions);
  // Alternate order to reduce warmup/order bias. Timings deliberately exclude
  // assertion and JSON encoding; no shared-machine timing threshold is asserted.
  for (let i = 0; i < 6; i++) {
    for (const name of i % 2 ? ['bounded', 'reference'] : ['reference', 'bounded']) {
      const start = performance.now();
      const layout = name === 'reference'
        ? reference.resolveAnnotationLayout(referenceOptions)
        : current.resolveAnnotationLayout(boundedOptions);
      measurements[name].push(performance.now() - start);
      if (name === 'reference') expected = layout;
      else actual = layout;
    }
    assert.deepEqual(actual, baseline ? expected : {
      ...expected,
      annotations: expected.annotations.map(a => ({ ...a, placement: { ...a.placement, candidates: a.placement.candidates.slice(0, 8) } }))
    }, `${count}-note exact candidate/geometry parity`);
    assert.deepEqual(current.evaluateAnnotationLayout(actual), reference.evaluateAnnotationLayout(expected));
  }
  const summary = samples => {
    const sorted = [...samples].sort((a, b) => a - b);
    return { medianMs: (sorted[2] + sorted[3]) / 2, samplesMs: samples };
  };
  const bytes = layout => Buffer.byteLength(JSON.stringify(layout));
  cases.push({ annotations: count, bounds: options.bounds, obstacles: options.obstacles.length,
    reference: { ...summary(measurements.reference), layoutJsonBytes: bytes(expected) },
    bounded: { ...summary(measurements.bounded), layoutJsonBytes: bytes(actual) },
    quality: current.evaluateAnnotationLayout(actual).metrics, exactParity: true });
}
const report = {
  benchmark: 'bounded-placement', comparison: baseline ? 'same-input historical module versus current module' : 'current exhaustive reference versus exact top-eight retention',
  referenceVersion: baseline ? JSON.parse(await readFile(resolve(dirname(baseline), '../package.json'), 'utf8')).version : 'current',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDirty: execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts/benchmark-bounded-placement.mjs'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
  runtime: { node: process.version, arch: process.arch, platform: process.platform },
  warmupsPerConfiguration: 1, samplesPerConfiguration: 6,
  units: { duration: 'milliseconds, solve only', layoutJsonBytes: 'UTF-8 JSON bytes, not heap or structured-clone bytes' },
  cases
};
const json = JSON.stringify(report, null, 2) + '\n';
if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, json); }
process.stdout.write(json);
