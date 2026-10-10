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
- `placement.allowedSides` and `placement.allowedAligns` when the host truly
  needs fewer placement alternatives; these constrain evaluated search space
- `placement.maxCandidates` only to limit **retained** ranked/debug candidates:
  it does not limit how many candidates are evaluated or speed up the search
- `connector: { routing: 'none' }` only where connector avoidance is unnecessary
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

## Dense Connector Routing: October 2026

Profiling the deterministic fixture identified orthogonal connector routing as
its primary cost, particularly repeated visibility-graph construction and
full-frontier sorting. The implementation now rejects obviously disjoint
routing obstacles using a conservative segment-bounds check, reuses the list
of previously placed note boxes, and filters graph obstacles by the relevant
row/column. It also uses a distance-and-key-ordered binary heap for shortest
paths, and appends graph edges directly instead of rebuilding arrays.

The changes keep the public API, candidate ordering, geometry and route
selection intact. Deterministic fixtures (including manual placements and
routed box/point anchors) were compared before and after; their selected
positions, candidate scores, connector paths, and quality metrics matched.
The `test/core/connectors.test.ts` regressions also cover padded near misses
and boundary contact, where overly aggressive fast paths can break routes.

Measurements on one development host, using `node scripts/benchmark-layout.mjs
--assert` with the same fixture, were:

| Fixture | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| 50 notes, 15 obstacles | 1,153 ms | 597 ms | Around 1.9× faster in this run |
| 200 notes, 40 obstacles | 8,596 ms | 4,140 ms | Around 2.1× faster in this run |

The 200-annotation fixture uses a single timed run, so results should be
interpreted as indicative rather than a stable latency guarantee. Absolute
timings vary with CPU contention and Node version. The existing generous
benchmark ceilings have **not** been tightened simply because one run improved.

For interactive React surfaces, `AnnotationLayer` can opt into
`previewEdits` to project only the active annotation while dragging. This
avoids recalculating the full layout or quality report per pointer event; the
host still commits and re-resolves once at gesture end. Custom SVG/DOM hosts
can use the experimental `previewAnnotationEdit` helper. Preview connectors
skip obstacle-aware routing and converge to the authoritative path on commit.

These results still do not make full 200-note relayouts suitable for every
animation frame. Hosts should memoize stable inputs, persist only edited
annotation deltas, and avoid recomputing dense layouts on every pointer move.
Incremental/worker-backed resolution remains an optional future design rather
than a hidden compatibility change in the current API.
