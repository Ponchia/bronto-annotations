/** Descriptive statistics only; never a timing gate or compositor-paint claim. */
const metrics = [
  'resolverMs', 'encodeMs', 'postMessageMs', 'requestDeliveryMs', 'workerQueueMs',
  'responseDeliveryMs', 'admissionMs', 'reactCommitAfterReceiptMs', 'rAFMs',
  'workerElapsedMs', 'jsonWireBytes', 'jsonFullBytes'
];

export function distribution(values, label = 'metric') {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(`Worker benchmark ${label} requires finite nonnegative measurements`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
  return { samples: sorted.length, min: sorted[0], median, max: sorted.at(-1) };
}

export function summarizeWorkerBenchmarks(observations) {
  const groups = new Map();
  for (const observation of observations) {
    if (![observation.count, observation.width, observation.height].every((value) =>
      Number.isSafeInteger(value) && value > 0)) throw new Error('Invalid benchmark dimensions');
    for (const [scenario, measurement] of Object.entries(observation.workloads)) {
      const key = JSON.stringify([observation.count, observation.width, observation.height, scenario]);
      const group = groups.get(key) ?? {
        count: observation.count, width: observation.width, height: observation.height,
        scenario, measurements: []
      };
      group.measurements.push(measurement);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(({ measurements, ...group }) => ({
    ...group,
    metrics: Object.fromEntries(metrics.map((metric) => [metric,
      distribution(measurements.map((row) => row[metric]), `${group.scenario}.${metric}`)]))
  }));
}

export function workerBenchmarkCases(args) {
  const benchmark = args.includes('--benchmark');
  const flags = args.filter((value) => value.startsWith('--benchmark-samples='));
  if (flags.length > 1) throw new Error('Duplicate --benchmark-samples');
  const count = flags.length ? Number(flags[0].split('=')[1]) : 3;
  if (!Number.isSafeInteger(count) || count < 1 || count > 10) {
    throw new Error('--benchmark-samples must be an integer from 1 to 10');
  }
  if (flags.length && !benchmark) throw new Error('--benchmark-samples requires --benchmark');
  const cases = [
    { name: 'desktop', width: 1200, height: 820, count: 40, sampled: false },
    { name: 'mobile', width: 390, height: 844, count: 24, sampled: false }
  ];
  if (benchmark) for (const size of [40, 200]) {
    for (const viewport of [{ name: 'desktop', width: 1365, height: 900 },
      { name: 'mobile', width: 390, height: 844 }]) {
      for (let sample = 1; sample <= count; sample++) cases.push({
        ...viewport, name: `${viewport.name}-${size}-${sample}`, count: size, sampled: true
      });
    }
  }
  return cases;
}
