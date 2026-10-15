import { describe, expect, it } from 'vitest';
import { distribution, summarizeWorkerBenchmarks, workerBenchmarkCases } from '../../scripts/worker-benchmark-summary.mjs';
function event(resolverMs: number) {
  return { resolverMs, encodeMs: 2, postMessageMs: 0.1, requestDeliveryMs: 1,
    workerQueueMs: 0, responseDeliveryMs: 1, admissionMs: 0.1,
    reactCommitAfterReceiptMs: 3, rAFMs: 12, workerElapsedMs: 9,
    jsonWireBytes: 320, jsonFullBytes: 42000 };
}
describe('repeated Worker cost evidence', () => {
  it('preserves inputs and reports odd, even and single-sample distributions', () => {
    const values = [9, 1, 3];
    expect(distribution(values)).toEqual({ samples: 3, min: 1, median: 3, max: 9 });
    expect(values).toEqual([9, 1, 3]);
    expect(distribution([8, 2])).toEqual({ samples: 2, min: 2, median: 5, max: 8 });
    expect(distribution([4]).median).toBe(4);
  });
  it('rejects absent, negative and nonfinite data instead of masking broken instrumentation', () => {
    for (const values of [[], [NaN], [-1], [Infinity]]) expect(() => distribution(values)).toThrow('finite nonnegative');
  });
  it('separates workload, density and viewport instead of pooling unlike measurements', () => {
    const rows = [
      { count: 200, width: 1365, height: 900, workloads: { anchor: event(10), obstacle: event(1) } },
      { count: 200, width: 1365, height: 900, workloads: { anchor: event(20), obstacle: event(3) } },
      { count: 200, width: 390, height: 844, workloads: { anchor: event(100) } },
      { count: 40, width: 1365, height: 900, workloads: { anchor: event(5) } }
    ];
    const result = summarizeWorkerBenchmarks(rows);
    expect(result).toHaveLength(4);
    expect(result[0]?.metrics.resolverMs).toEqual({ samples: 2, min: 10, median: 15, max: 20 });
    expect(result[1]?.metrics.resolverMs?.median).toBe(2);
    expect(result[2]?.metrics.resolverMs?.samples).toBe(1);
    expect(() => summarizeWorkerBenchmarks([{ ...rows[0]!, count: 0 }])).toThrow('dimensions');
    expect(() => summarizeWorkerBenchmarks([{ count: 40, width: 390, height: 844, workloads: { broken: {} } }])).toThrow('finite');
  });
  it('keeps the ordinary smoke small and bounds repeated desktop/mobile experiments', () => {
    expect(workerBenchmarkCases([])).toHaveLength(2);
    expect(workerBenchmarkCases(['--benchmark']).filter((row) => row.sampled)).toHaveLength(12);
    expect(workerBenchmarkCases(['--benchmark', '--benchmark-samples=1'])).toHaveLength(6);
    for (const flags of [['--benchmark-samples=2'], ['--benchmark', '--benchmark-samples=0'],
      ['--benchmark', '--benchmark-samples=11'], ['--benchmark', '--benchmark-samples=2.5'],
      ['--benchmark', '--benchmark-samples=NaN'], ['--benchmark', '--benchmark-samples=1', '--benchmark-samples=2']]) {
      expect(() => workerBenchmarkCases(flags)).toThrow();
    }
  });
});
