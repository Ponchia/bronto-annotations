import { performance } from 'node:perf_hooks';
import {
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../dist/index.js';
import { writeLine } from './log.mjs';

const assertMode = process.argv.includes('--assert');
const cases = [
  { name: 'small', annotations: 10, obstacles: 5, iterations: 5, maxMedianMs: 500 },
  { name: 'medium', annotations: 50, obstacles: 15, iterations: 3, maxMedianMs: 2500 },
  { name: 'large', annotations: 200, obstacles: 40, iterations: 1, maxMedianMs: 15000 }
];
const results = [];

for (const testCase of cases) {
  const annotations = generatedAnnotations(testCase.annotations);
  const obstacles = generatedObstacles(testCase.obstacles);
  const noteSizes = Object.fromEntries(annotations.map((annotation, index) => [
    annotation.id,
    {
      width: 96 + (index % 4) * 12,
      height: 40 + (index % 3) * 8
    }
  ]));
  const durations = [];
  let layout;

  resolveAnnotationLayout(layoutOptions({ annotations, obstacles, noteSizes }));

  for (let iteration = 0; iteration < testCase.iterations; iteration += 1) {
    const start = performance.now();
    layout = resolveAnnotationLayout(layoutOptions({ annotations, obstacles, noteSizes }));
    durations.push(performance.now() - start);
  }

  const quality = evaluateAnnotationLayout(layout);
  const medianMs = median(durations);
  const result = {
    name: testCase.name,
    annotations: testCase.annotations,
    obstacles: testCase.obstacles,
    iterations: testCase.iterations,
    medianMs: Number(medianMs.toFixed(3)),
    maxMedianMs: testCase.maxMedianMs,
    resolved: layout.annotations.length,
    boundsOverflowArea: quality.metrics.boundsOverflowArea,
    noteOverlapArea: quality.metrics.noteOverlapArea,
    candidateCount: layout.annotations.reduce((count, annotation) => count + annotation.placement.candidates.length, 0)
  };

  results.push(result);

  if (assertMode) {
    assertBenchmarkResult(result);
  }
}

writeLine(JSON.stringify({
  benchmark: 'layout-stress',
  generatedAt: new Date(0).toISOString(),
  results
}, null, 2));

function layoutOptions({ annotations, obstacles, noteSizes }) {
  return {
    annotations,
    obstacles,
    noteSizes,
    bounds: { x: 0, y: 0, width: 1280, height: 820 },
    padding: 18,
    placement: {
      side: ['right', 'bottom', 'top', 'left'],
      allowedSides: ['right'],
      align: 'center',
      allowedAligns: ['center'],
      offset: 14,
      crossOffset: 0,
      maxCandidates: 8
    },
    refinement: false
  };
}

function generatedAnnotations(count) {
  return Array.from({ length: count }, (_, index) => {
    const column = index % 20;
    const row = Math.floor(index / 20);
    const x = 56 + column * 58 + (row % 2) * 14;
    const y = 52 + row * 72 + (column % 3) * 8;

    return {
      id: `benchmark-${index}`,
      anchor: {
        type: 'box',
        box: {
          x,
          y,
          width: 28 + (index % 5) * 4,
          height: 22 + (index % 4) * 5
        }
      },
      note: {
        title: `Benchmark ${index}`,
        body: 'Deterministic layout stress annotation.'
      },
      priority: count - index,
      placement: {
        side: index % 2 === 0 ? ['right', 'bottom', 'top'] : ['left', 'top', 'bottom'],
        offset: [12, 22],
        crossOffset: [0, -18, 18]
      },
      connector: {
        type: index % 3 === 0 ? 'elbow' : 'straight'
      }
    };
  });
}

function generatedObstacles(count) {
  return Array.from({ length: count }, (_, index) => {
    const column = index % 15;
    const row = Math.floor(index / 15);

    return {
      x: 34 + column * 76,
      y: 34 + row * 84,
      width: 44 + (index % 4) * 10,
      height: 30 + (index % 3) * 12
    };
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function assertBenchmarkResult(result) {
  if (result.resolved !== result.annotations) {
    throw new Error(`${result.name} benchmark resolved ${result.resolved}/${result.annotations} annotations`);
  }

  if (result.medianMs > result.maxMedianMs) {
    throw new Error(`${result.name} benchmark median ${result.medianMs}ms exceeded ${result.maxMedianMs}ms`);
  }

  if (result.boundsOverflowArea > 0) {
    throw new Error(`${result.name} benchmark overflowed bounds by ${result.boundsOverflowArea}`);
  }

  if (result.candidateCount < result.annotations) {
    throw new Error(`${result.name} benchmark did not retain placement candidates`);
  }
}
