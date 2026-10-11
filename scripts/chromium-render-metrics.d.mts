export type ChromiumMetric = { name: string; value: number };
export type ChromiumRenderMetrics = Partial<{
  scriptMs: number;
  styleRecalcMs: number;
  layoutMs: number;
  browserTaskMs: number;
  styleRecalcCount: number;
  layoutCount: number;
  domNodes: number;
  jsHeapUsedBytes: number;
}>;
export function summarizeChromiumRenderMetrics(
  before: ChromiumMetric[],
  after: ChromiumMetric[]
): ChromiumRenderMetrics;
