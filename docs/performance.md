# Performance And Stress Testing

Annotation layout should stay deterministic and fast enough for report
generation and interactive authoring surfaces.

## Benchmark Gate

Run:

```bash
npm run test:performance
```

The benchmark resolves deterministic layouts for:

- 10 annotations with obstacles
- 50 annotations with obstacles
- 200 annotations with obstacles

The gate uses bounded candidate counts and no refinement so it stays suitable
for normal CI. It checks that layouts finish within generous CI-safe thresholds,
produce all expected annotations, have no bounds overflow, and expose placement
candidates for debugging.

## Interpretation

This is not a micro-benchmark suite. It is a regression guard for accidental
algorithmic slowdowns in candidate generation, obstacle scoring, and layout
resolution.

For performance-sensitive consumers, prefer:

- host-provided `noteSizes` when available
- bounded `placement.maxCandidates`
- generated obstacles that represent real collision risks, not every invisible
  host primitive
- `refinement` only for surfaces where note overlap matters more than latency


## Connector visibility checks

The 0.3 implementation rejects disjoint segment/rectangle extents before
intersection tests and handles orthogonal segments without allocating corner
objects. This also fixes false detours for disjoint collinear segments.

On ARM64 Linux with Node 24, the unchanged 50-annotation fixture measured
2,687 ms before this change and 1,103 ms afterward (three-iteration medians).
The 200-annotation fixture measured 5,503 ms afterward. These are development
measurements, not a promise for every machine; the existing 2,500 ms and
15,000 ms ceilings remain unchanged. Layout quality checks still run.
