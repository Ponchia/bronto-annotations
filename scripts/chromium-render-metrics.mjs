/**
 * Turn two Chromium DevTools Protocol Performance.getMetrics snapshots into
 * a bounded diagnostic report. This is an OPTIONAL browser benchmark helper;
 * it does not measure compositor paint or provide a latency budget.
 *
 * Durations are cumulative counters in seconds. Their deltas are recorded in
 * milliseconds; TaskDuration overlaps other counters and is NOT a sum of
 * script/style/layout time. Windows include automation/callback overhead.
 */

const DURATION_METRICS = {
  ScriptDuration: 'scriptMs',
  RecalcStyleDuration: 'styleRecalcMs',
  LayoutDuration: 'layoutMs',
  TaskDuration: 'browserTaskMs'
};
const COUNT_METRICS = {
  RecalcStyleCount: 'styleRecalcCount',
  LayoutCount: 'layoutCount'
};

export function summarizeChromiumRenderMetrics(before, after) {
  const old = new Map(before.map(({ name, value }) => [name, value]));
  const current = new Map(after.map(({ name, value }) => [name, value]));
  const report = {};

  const delta = (name, scale = 1) => {
    const start = old.get(name);
    const end = current.get(name);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return undefined;
    }
    return Math.round((end - start) * scale * 1000) / 1000;
  };

  for (const [cdpName, key] of Object.entries(DURATION_METRICS)) {
    const elapsed = delta(cdpName, 1000);
    if (elapsed !== undefined) report[key] = elapsed;
  }
  for (const [cdpName, key] of Object.entries(COUNT_METRICS)) {
    const count = delta(cdpName);
    if (count !== undefined) report[key] = count;
  }

  const liveSnapshot = (name) => {
    const value = current.get(name);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };
  const domNodes = liveSnapshot('Nodes');
  if (domNodes !== undefined) report.domNodes = domNodes;
  const heapUsed = liveSnapshot('JSHeapUsedSize');
  if (heapUsed !== undefined) report.jsHeapUsedBytes = heapUsed;

  return report;
}
