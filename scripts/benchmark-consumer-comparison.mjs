/** Compare a deliberately selected installed baseline with the current built
 * package, using public APIs only. No registry access or package installation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as candidate from '../dist/index.js';

const entry = process.argv[2];
if (!entry) throw new Error('Pass the reviewed baseline dist/index.js path');
const baseline = await import(pathToFileURL(resolve(entry)).href);
const reports = [];
for (const count of [200, 1000]) {
  const obstacles = Array.from({ length: count }, (_, i) => ({
    x: (i % 20) * 400 - 12, y: Math.floor(i / 20) * 220 - 12, width: 224, height: 144
  }));
  const annotations = obstacles.slice(0, 24).map((box, i) => ({
    id: `note-${String(i).padStart(2, '0')}`, anchor: { type: 'box', box }, note: { title: 'A measured source note' }
  }));
  const options = { annotations, obstacles, defaultNoteSize: { width: 180, height: 72 }, padding: 8,
    bounds: { x: -480, y: -480, width: 9000, height: Math.ceil(count / 20) * 220 + 960 } };
  assert.deepEqual(candidate.resolveAnnotationLayout(options), baseline.resolveAnnotationLayout(options));
  const beforeMs = [], afterMs = [];
  for (let round = 0; round < 5; round++) {
    const values = new Map();
    for (const improved of round % 2 ? [true, false] : [false, true]) {
      const start = performance.now();
      values.set(improved, (improved ? candidate : baseline).resolveAnnotationLayout(options));
      (improved ? afterMs : beforeMs).push(performance.now() - start);
    }
    assert.deepEqual(values.get(true), values.get(false));
    assert.deepEqual(candidate.evaluateAnnotationLayout(values.get(true)), baseline.evaluateAnnotationLayout(values.get(false)));
  }
  const median = (values) => [...values].sort((a, b) => a - b)[2];
  reports.push({ notes: 24, obstacles: count, beforeMs, afterMs, medianBeforeMs: median(beforeMs), medianAfterMs: median(afterMs), parity: 'complete layout and quality report' });
}
console.log(JSON.stringify({ environment: `${process.version} ${process.platform}/${process.arch}`,
  baselineEntrySha256: createHash('sha256').update(readFileSync(resolve(entry))).digest('hex'),
  scope: 'Synthetic public-API consumer; five alternating warmed samples, index creation included; not browser latency', reports }, null, 2));
