import { describe, expect, it } from 'vitest';
import { summarizeChromiumRenderMetrics } from '../../scripts/chromium-render-metrics.mjs';

const before = [
  { name: 'ScriptDuration', value: 0.1 },
  { name: 'RecalcStyleDuration', value: 0.02 },
  { name: 'LayoutDuration', value: 0.05 },
  { name: 'TaskDuration', value: 0.5 },
  { name: 'LayoutCount', value: 10 },
  { name: 'RecalcStyleCount', value: 20 },
  { name: 'Nodes', value: 1200 },
  { name: 'JSHeapUsedSize', value: 50000 }
];
const after = [
  { name: 'LayoutCount', value: 12 },
  { name: 'TaskDuration', value: 0.8 },
  { name: 'RecalcStyleDuration', value: 0.035 },
  { name: 'LayoutDuration', value: 0.065 },
  { name: 'ScriptDuration', value: 0.15 },
  { name: 'RecalcStyleCount', value: 23 },
  { name: 'Nodes', value: 1230 },
  { name: 'JSHeapUsedSize', value: 54000 }
];

describe('optional Chromium main-thread performance metrics', () => {
  it('reports duration deltas in milliseconds, counter deltas and final gauges', () => {
    expect(summarizeChromiumRenderMetrics(before, after)).toEqual({
      scriptMs: 50,
      styleRecalcMs: 15,
      layoutMs: 15,
      browserTaskMs: 300,
      styleRecalcCount: 3,
      layoutCount: 2,
      domNodes: 1230,
      jsHeapUsedBytes: 54000
    });
  });
  it('omits unavailable metrics instead of inventing zero durations', () => {
    expect(summarizeChromiumRenderMetrics([], [
      { name: 'Nodes', value: 25 }, { name: 'JSHeapUsedSize', value: 1024 }
    ])).toEqual({ domNodes: 25, jsHeapUsedBytes: 1024 });
  });
  it('omits reset and non-finite counters while retaining valid measurements', () => {
    expect(summarizeChromiumRenderMetrics(before, [
      { name: 'ScriptDuration', value: 0.01 },
      { name: 'RecalcStyleDuration', value: Number.NaN },
      { name: 'LayoutDuration', value: 0.08 },
      { name: 'LayoutCount', value: 0 },
      { name: 'TaskDuration', value: 0.7 },
      { name: 'JSHeapUsedSize', value: -100 }
    ])).toEqual({ layoutMs: 30, browserTaskMs: 200 });
  });
  it('does not modify input arrays or depend on metric ordering', () => {
    const original = structuredClone(before);
    const first = summarizeChromiumRenderMetrics(before, after);
    const second = summarizeChromiumRenderMetrics([...before].reverse(), [...after].reverse());
    expect(first).toEqual(second);
    expect(before).toEqual(original);
  });
});
