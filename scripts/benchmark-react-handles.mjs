/**
 * Optional development-only comparison: fully regenerating edit-handle
 * geometry versus regenerating only a committed changed annotation suffix.
 * This isolates allocation/geometry work; it is NOT a React frame benchmark.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { annotationEditHandles, createIncrementalAnnotationLayoutSession } from '../dist/index.js';
import { annotationsForPaint } from '../dist/core/order.js';

const count = Number(process.env.ANNOTATIONS_HANDLE_BENCHMARK_COUNT ?? 200);
assert.ok(Number.isInteger(count) && count >= 2 && count <= 3000);
const annotations = Array.from({ length: count }, (_, index) => ({
  id: `note-${index}`,
  priority: count - index,
  anchor: { type: 'point', point: { x: 20 + index * 8, y: 120 } },
  note: { title: `Note ${index}` },
  placement: { manual: { x: 30 + index * 8, y: 180, clamp: false } }
}));
const noteSizes = Object.fromEntries(annotations.map((item) => [item.id, { width: 70, height: 42 }]));
const options = {
  annotations,
  bounds: { x: 0, y: 0, width: Math.max(count * 10 + 300, 2300), height: 400 },
  noteSizes,
  refinement: false
};
const session = createIncrementalAnnotationLayoutSession(options);
const before = session.layout;
const edited = structuredClone(annotations);
edited.at(-1).note.title = 'Edited last note';
const after = session.update({ ...options, annotations: edited });
const handlesBefore = annotationEditHandles(before, { includeAnchor: true });
const previousAnnotation = new Map(before.annotations.map((item) => [item.id, item]));
const nextAnnotation = new Map(after.annotations.map((item) => [item.id, item]));
const previousById = new Map(handlesBefore.map((handle) => [handle.id, handle]));
const groupedBefore = groupHandles(handlesBefore);
const editOptions = { includeAnchor: true };

function groupHandles(handles) {
  const groups = new Map();
  for (const handle of handles) {
    const group = groups.get(handle.annotationId);
    if (group) group.push(handle);
    else groups.set(handle.annotationId, [handle]);
  }
  return groups;
}

function fullRegeneration() {
  return annotationEditHandles(after, editOptions).map((handle) =>
    previousAnnotation.get(handle.annotationId) === nextAnnotation.get(handle.annotationId)
      ? previousById.get(handle.id) ?? handle
      : handle
  );
}

function deltaRegeneration() {
  const changed = after.annotations.filter((item) => previousAnnotation.get(item.id) !== item);
  const refreshed = groupHandles(annotationEditHandles({ ...after, annotations: changed }, editOptions));
  return annotationsForPaint(after.annotations).flatMap((item) =>
    (previousAnnotation.get(item.id) === item ? groupedBefore : refreshed).get(item.id) ?? []
  );
}

const expected = fullRegeneration();
const actual = deltaRegeneration();
assert.deepEqual(actual, expected, 'Incremental handle geometry and paint ordering differ');
const reusedHandles = actual.filter((handle) => previousById.get(handle.id) === handle).length;
assert.equal(reusedHandles, 2 * (count - 1));

function sample(fn) {
  for (let i = 0; i < 120; i += 1) fn();
  const times = [];
  for (let i = 0; i < 500; i += 1) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  return times.sort((a, b) => a - b)[250];
}
const fullMs = sample(fullRegeneration);
const deltaMs = sample(deltaRegeneration);
console.log(JSON.stringify({
  benchmark: 'react-handle-generation',
  interpretation: '200+ sample microbenchmark with warmup. Times exclude React/browser rendering and are not frame SLOs.',
  annotations: count,
  handles: handlesBefore.length,
  changedAnnotations: 1,
  reusedHandles,
  sameGeometryAndOrdering: true,
  fullGenerationMedianMs: Number(fullMs.toFixed(4)),
  incrementalMedianMs: Number(deltaMs.toFixed(4)),
  speedup: Number((fullMs / deltaMs).toFixed(2))
}, null, 2));
