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
  options.refinement = { passes: 2, maxCandidatesPerAnnotation: 8 };
  const configurations = {
    normal: options,
    diagnostics8: { ...options, diagnostics: { candidates: 8 } },
    diagnosticsAll: { ...options, diagnostics: { candidates: 'all' } },
    ...(baseline ? { historical: options } : {})
  };
  const measurements = Object.fromEntries(Object.keys(configurations).map(name => [name, []]));
  const layouts = {};
  for (const [name, input] of Object.entries(configurations)) {
    (name === 'historical' ? reference : current).resolveAnnotationLayout(input);
  }
  // Alternate order to reduce warmup/order bias. Timings exclude assertions and JSON encoding.
  for (let i = 0; i < 6; i++) {
    const names = Object.keys(configurations);
    if (i % 2) names.reverse();
    for (const name of names) {
      const start = performance.now();
      layouts[name] = (name === 'historical' ? reference : current).resolveAnnotationLayout(configurations[name]);
      measurements[name].push(performance.now() - start);
    }
    const selected = layout => ({ ...layout, diagnostics: undefined,
      annotations: layout.annotations.map(a => {
        const { candidates, ...placement } = a.placement;
        return { ...a, placement };
      }) });
    for (const name of names) {
      assert.deepEqual(selected(layouts[name]), selected(layouts.normal), `${count}-note ${name} winner/score parity`);
      assert.deepEqual(current.evaluateAnnotationLayout(layouts[name]), current.evaluateAnnotationLayout(layouts.normal));
    }
    assert.equal(Object.hasOwn(layouts.normal, 'diagnostics'), false);
    assert.deepEqual(layouts.diagnostics8.diagnostics.annotations,
      layouts.diagnosticsAll.diagnostics.annotations.map(entry => ({ ...entry, candidates: entry.candidates.slice(0, 8) })));
  }
  const summary = samples => {
    const sorted = [...samples].sort((a, b) => a - b);
    return { medianMs: (sorted[2] + sorted[3]) / 2, samplesMs: samples };
  };
  cases.push({ annotations: count, bounds: options.bounds, obstacles: options.obstacles.length,
    configurations: Object.fromEntries(Object.keys(configurations).map(name => [name, {
      ...summary(measurements[name]), layoutJsonBytes: Buffer.byteLength(JSON.stringify(layouts[name]))
    }])),
    quality: current.evaluateAnnotationLayout(layouts.normal).metrics, exactWinnerParity: true });
}
const report = {
  benchmark: 'bounded-placement', comparison: 'normal default versus opt-in diagnostics with equal refinement; historical payloads are intentionally different',
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
