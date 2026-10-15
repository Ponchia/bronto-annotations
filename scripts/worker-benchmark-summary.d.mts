export interface Distribution { samples: number; min: number; median: number; max: number; }
export interface WorkerBenchmarkObservation { count: number; width: number; height: number; workloads: Record<string, Record<string, number>>; }
export function distribution(values: number[], label?: string): Distribution;
export function summarizeWorkerBenchmarks(observations: WorkerBenchmarkObservation[]): Array<{ count: number; width: number; height: number; scenario: string; metrics: Record<string, Distribution> }>;
export function workerBenchmarkCases(args: string[]): Array<{ name: string; width: number; height: number; count: number; sampled: boolean }>;
