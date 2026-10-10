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
avoids recalculating the full layout or quality report per pointer event.
Memoized annotation and edit-handle trees also keep unrelated custom React
notes and hidden DOM-measurement copies from rendering on each drag update.
The host still commits and re-resolves once at gesture end. Hosts using an
incremental committed-layout session can also pass its authoritative result to
`AnnotationLayer.resolvedLayout`, avoiding a second full solver pass in the
React renderer. This opt-in controlled mode requires explicit host-managed
note sizes rather than the component's `measure="dom"` path. Custom SVG/DOM hosts
can use the experimental `previewAnnotationEdit` helper. Preview connectors
skip obstacle-aware routing and converge to the authoritative path on commit.

These results still do not make full 200-note relayouts suitable for every
animation frame. Hosts should memoize stable inputs, persist only edited
annotation deltas, and avoid recomputing dense layouts on every pointer move.
The experimental `createIncrementalAnnotationLayoutSession` now supports
**prefix-preserving committed updates**: with unchanged global geometry and
without refinement, the resolver keeps the exact winners before the first
changed priority-ordered annotation and resolves the affected suffix. This
preserves fresh-layout geometry, path routing and diagnostics; an unchanged
input yields the same layout object. Late-note edits can therefore be much
cheaper than rebuilding the full layout. Host-authored changes to bounds,
obstacles, global placement or order, and all iterative refinement requests
still trigger a full resolver pass. This is not a spatial-index-based solver,
and it does **not** guarantee partial updates for arbitrary changed topology.

Hosts should continue using the visual-only `previewAnnotationEdit` during
pointer movement and the authoritative incremental session only when
committing edits. Worker-backed asynchronous resolution remains future work;
no public synchronous API or quality threshold was changed.

### Incremental late-edit benchmark

Run the optional comparison without changing the existing full-layout CI
performance thresholds:

```bash
npm run benchmark:incremental
```

This benchmarks a single edit to the final priority-ordered annotation against
an entire fresh resolution and asserts **deep equality** of the result and
quality metrics. One observed development-host run gave:

| Fixture | Fresh full layout | Committed last-note update | Reused winners |
| --- | ---: | ---: | ---: |
| 50 annotations | 923 ms | 23 ms | 49/50 |
| 200 annotations | 4,086 ms | 11 ms | 199/200 |

These are individual illustrative measurements from October 2026, not stable
latency bounds or a promise of similar speedups for all edits. Earlier edits,
reordered annotations, changed host obstacles/bounds, and global refinement
force larger recomputations. Capturing input value snapshots has a small cost
per update; benchmark under representative host density before enabling the
experimental optimization broadly.

For annotated generated graphs, widen host-owned handle placement candidates
according to the **rendered** owner card size. In an additional dense React Flow
host, a 20–30 px handle offset trapped a callout inside adjacent graph nodes;
adding owner-height-based clearance candidates raised quality from 0 to 86
with no note/obstacle overlap. See `docs/dogfood-external-consumer-report.md`
for the strict host evidence and browser repro. This is a host integration
recipe, not an automatic change to the deterministic core placement policy.
