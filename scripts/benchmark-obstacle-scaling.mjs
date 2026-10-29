/** Repeated many-obstacle workload. Optional reference is an inspected compiled
 * package entry; there is no package installation or network execution here. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { resolveAnnotationLayout } from '../dist/index.js';
import { writeLine } from './log.mjs';

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const rounds = Number(arg('rounds') ?? 3);
assert.ok(Number.isSafeInteger(rounds) && rounds >= 1 && rounds <= 20, 'rounds must be 1–20');
const reference = arg('reference');
const oracle = reference ? (await import(pathToFileURL(resolve(reference)).href)).resolveAnnotationLayout : undefined;
assert.ok(!reference || typeof oracle === 'function', 'reference must export resolveAnnotationLayout');
const output = [];
for (const count of [200, 1000]) {
  const obstacles = Array.from({ length: count }, (_, index) => ({
    x: (index % 20) * 400, y: Math.floor(index / 20) * 220, width: 240, height: 120
  }));
  const options = {
    bounds: { x: -480, y: -480, width: 9000, height: Math.ceil(count / 20) * 220 + 960 },
    padding: 8,
    defaultNoteSize: { width: 180, height: 72 },
    obstacles,
    annotations: obstacles.slice(0, 24).map((box, index) => ({
      id: `note-${String(index).padStart(2, '0')}`,
      anchor: { type: 'box', box }, note: { title: `Note ${index}` }
    }))
  };
  const expected = oracle?.(options);
  const actual = resolveAnnotationLayout(options);
  if (expected) assert.deepEqual(actual, expected);
  const samples = { candidate: [], reference: [] };
  for (let round = 0; round < rounds; round++) {
    const modes = round % 2 ? ['candidate', 'reference'] : ['reference', 'candidate'];
    for (const mode of modes) {
      const solve = mode === 'candidate' ? resolveAnnotationLayout : oracle;
      if (!solve) continue;
      const started = performance.now();
      const layout = solve(options);
      samples[mode].push(performance.now() - started);
      assert.deepEqual(layout, actual);
    }
  }
  const median = (values) => values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;
  output.push({ obstacles: count, notes: 24, samplesMs: samples, medianMs: { candidate: median(samples.candidate), reference: median(samples.reference) }, exactParity: Boolean(oracle) });
}
const report = { environment: { node: process.version, platform: process.platform, arch: process.arch }, rounds, workload: 'synthetic many-obstacle host; not browser input latency', results: output };
const text = `${JSON.stringify(report, null, 2)}\n`;
if (arg('output')) await writeFile(resolve(arg('output')), text);
writeLine(text);
