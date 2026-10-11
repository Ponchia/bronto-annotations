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

### Avoid unused React layout-quality diagnostics

React's `AnnotationLayer` renders the authoritative SVG and emits `onLayout`
without computing an additional all-pairs quality report when the host has not
requested one. The full `evaluateAnnotationLayout` pass runs only when the host
supplies `onQuality`, enables `assertQuality`, or asks for `qualityDebug`.
Switching between consumers of the *same* report reuses its memoized result;
format-only changes recompute the description without rechecking geometry.
All requested quality reports, assertions and debug overlays retain their
previous semantics. Non-React code can continue calling
`evaluateAnnotationLayout` explicitly whenever the host needs diagnostics.

An isolated Node timing of the full report (20 repetitions with three warmups,
manual-note fixtures, October 2026 development box) recorded median costs of
roughly 0.26 ms at 40 annotations, 1.99 ms at 200 and 7.39 ms at 400. These are
profiling observations, not frame deadlines or benchmarks for the whole React
commit. Skipping an unrequested quality report removes avoidable quadratic
work but does not by itself guarantee 60 fps rendering on dense canvases.

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
global placement, or enabled iterative refinement still trigger full resolution.
Appending/removing suffix notes and verified spatially independent changes to
obstacles can keep a valid prefix; affected routed connectors fall back. This
is a conservative dependency proof rather than a spatial-index-based solver,
so partial updates are **not** guaranteed for arbitrary changed topology.

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
latency bounds or a promise of similar speedups for all edits. Earlier edits and global refinement still require larger recomputations.
The experimental session now handles appending/removing low-priority notes,
recomputing only the changed suffix. It also supports **conservative obstacle
invalidation** when an annotation's connector explicitly disables routing (or
is intrinsically unrouted) and every candidate note/connector bounding box
is disjoint from the changed obstacle boxes. This checks *all possible*
placement candidates, including ones omitted from `maxCandidates` output.
Candidates or connectors that might be affected trigger normal suffix
recalculation; route-aware connectors with changed host obstacles trigger full
recalculation because remote obstacles can change a visibility-graph solution.
A changed obstacle list produces a fresh layout with correct obstacle metadata
even if all resolved note identities can be reused. These conditions avoid
making unverified spatial independence claims. Capturing input value snapshots
has a small cost per update; benchmark under representative host density before
enabling the experimental optimization broadly.

### React edit-handle reuse during committed updates

A committed incremental layout preserves unchanged resolved note identities, but
React editing hosts used to rebuild every SVG edit control anyway. In
particular, a common inline `editable={{ includeAnchor: true }}` prop
recreated the options wrapper, and the pointer/keyboard handlers were tied to
the layout-array identity. `AnnotationLayer` now snapshots the supported scalar
editing options, reuses handle objects for unchanged resolved annotations,
and dispatches pointer/keyboard interactions through the latest committed host
callbacks and geometry. This keeps unchanged SVG handle subtrees memoized while
still updating their target behavior and accessibility labels when notes or
editing options actually change.

The browser proof now captures React Profiler *render* duration and committed
render count in addition to full-solver parity and the next animation frame.
One heavily shared devbox profiling pair on a 200-note desktop fixture observed
approximately 58 ms → 23 ms in React render duration and 100 ms → 42 ms to the
next animation frame for appending one note (200 winners reused). A 200-note
no-op input recreation observed 42 ms → 19 ms React render duration. These are
**single-run, resource-contention-sensitive observations**, not controlled
A/B data, compositor paint measurements, or guarantees of 60 fps. Automated
checks assert editing-handle identity, current callback semantics, keyboard
step changes and exact fresh-layout parity instead of imposing fragile timing
limits. Earlier/route-changing edits can still incur substantial work.

### React edit-handle generation on committed updates

Incremental resolution preserves resolved annotation identities for unaffected
priority-prefix winners. The React renderer also reuses these notes and their
edit handles; it now *generates* note/anchor handle geometry only for changed
winners instead of eagerly constructing and discarding two handles per
unchanged annotation. Its committed cache retains handle groups by annotation
ID, and the final list still follows priority-aware paint order. The public
`annotationEditHandles` function remains unchanged and independently usable.

To measure only this geometry/allocation work, run:

```bash
npm run benchmark:react:handles
```

The deterministic fixture compares full regeneration and changed-only
regeneration after a final low-priority note edit. It asserts the **same handle
objects, properties and ordering** before reporting times. On one ARM64
shared development host with 200 annotations and 400 edit handles, median
microbenchmark times were approximately 0.137 ms full versus 0.040 ms changed-
only, reusing 398/400 existing objects. This isolates a small operation; it
is not an end-to-end browser-frame speedup. Actual Chromium profiles still
contain larger React scripting and scheduling costs, and should guide broader
rendering improvements.

### Actual browser interaction evidence

`npm run test:browser:incremental` runs a bounded Playwright/Chromium test on
a real React `AnnotationLayer` with host-controlled resolved geometry, at 1200px
desktop and 390px mobile widths. The fixture changes node count, distant/nearby
obstacles, an anchor, and routing mode, checks React/SVG DOM stability, then
compares every changed layout against an independent fresh full resolver.
The optional `npm run benchmark:browser:incremental` adds a denser 200-note
desktop case outside the mandatory CI suite. Resolver time and the first next
animation-frame callback are recorded separately; neither is a production
latency guarantee or a display-paint timestamp.

On one ARM64 development host with Chromium, a 40-note desktop run measured:

| Committed action | Resolver | Next animation frame | Reused winners |
| --- | ---: | ---: | ---: |
| Append one note | 0.8 ms | 28.6 ms | 40/40 previous |
| Move distant obstacle | 5.6 ms | 25.9 ms | 40/40 |
| Move nearby obstacle | 3.4 ms | 27.9 ms | 27/40 |
| Edit last anchor | 0.8 ms | 20.0 ms | 39/40 |
| Enable orthogonal routing | 5.2 ms | 39.2 ms | 0/40 |

Mobile (24 notes) measured 4.1 ms resolver and 19.0 ms to the next animation
frame on the distant-obstacle action, with 24/24 winners reused. These values
are single-run observations subject to CPU contention, browser scheduling and
React reconciliation. They do **not** establish sustained 60 fps. The measured
UI frame time exceeds the pure resolver cost, so future work should profile
React render/quality evaluation and host drawing separately before attempting
worker-based layout scheduling.

### Optional Chromium renderer main-thread measurements

When investigating dense-editor frame delays, run the **optional** browser
profile outside the mandatory CI gates:

```bash
npm run benchmark:browser:profile
```

This runs the same desktop/mobile/200-annotation React/browser fixture and
adds `chromiumMainThread` to each committed action. It samples Chromium's
DevTools Protocol `Performance.getMetrics` before and after a real button
interaction. The report separates cumulative-counter deltas for JavaScript
execution (`scriptMs`), style recalculation (`styleRecalcMs`), layout
(`layoutMs`), and total browser tasks (`browserTaskMs`). It also records style
and layout operation counts, the final DOM node count and JS heap usage.

These metrics are intended to **identify** whether CPU time is being spent in
React/scripting or in browser style/layout work. The counters include
Playwright interaction, callback and measurement overhead; task time overlaps
JavaScript/style/layout times and must never be added to them. None of these
is a compositor-paint timestamp or a guarantee of a rendered frame. React
Profiler `reactRenderMs`, resolver `resolverMs`, and the time to the next
`requestAnimationFrame` callback remain separate signals. Do not set CI
budgets or remove accessible/offscreen note DOM based on one busy devbox run.

The mandatory 24/40-note `test:browser:incremental` lane also exercises the
same CDP counter path, without any timing assertion or expanded dense fixture.
That catches a broken Chromium metric interface in protected CI. The optional
`benchmark:browser:profile` command extends the evidence to 200 notes and
still must be run only under the shared heavy-work gate.

The counters use Chromium CDP only; the library and package itself
remain browser-agnostic and require no CDP dependency. Reference:
[Chrome DevTools Performance domain](https://chromedevtools.github.io/devtools-protocol/tot/Performance/)
and [Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession).

For annotated generated graphs, widen host-owned handle placement candidates
according to the **rendered** owner card size. In an additional dense React Flow
host, a 20–30 px handle offset trapped a callout inside adjacent graph nodes;
adding owner-height-based clearance candidates raised quality from 0 to 86
with no note/obstacle overlap. See `docs/dogfood-external-consumer-report.md`
for the strict host evidence and browser repro. This is a host integration
recipe, not an automatic change to the deterministic core placement policy.
