# Performance And Stress Testing

Annotation layout should stay deterministic and fast enough for report
generation and interactive authoring surfaces.

## Start with the common workload

For an unrefined chart or diagram with approximately 5–20 notes, supply measured
`noteSizes` and retain only the diagnostics the host uses:

```ts
const layout = resolveAnnotationLayout({
  annotations,
  bounds,
  noteSizes,
  placement: { maxCandidates: 8 }
});
```

For the same inputs, the bounded search returns the exact first eight candidates
of the exhaustive ranking, including scores and routed connector geometry. It
is not an approximate shortlist and does not narrow permitted sides or offsets.
The search remains exhaustive when no retention limit is specified. A retention
limit can affect **iterative refinement**, which chooses among retained
candidates; use matching refinement frontiers when comparing configurations.

Do not serialize every candidate into application history or send an unbounded
diagnostic graph through a Worker merely to paint the winning placements. The
public React Worker example now explicitly retains eight candidates per note;
the historical transport measurements below and in `worker-layout.md` include
larger diagnostic graphs and must not be treated as the current demo payload.

## Reproduce bounded-search measurements

`npm run benchmark:placement` alternates exhaustive and exact top-eight solves
on the same 5, 12 and 20-note inputs. Six measured samples follow a warmup for
each configuration. It checks exact retained candidate, geometry and quality
parity and reports serialized layout size alongside solver duration.

To compare a historical build with identical bounded inputs, pass
`-- --baseline-module /path/to/other-checkout/dist/index.js`. Build that checkout
separately first. The module path is developer-supplied local code; do not point
it at untrusted code. `--output <file>` retains the JSON report. Timings and JSON
byte counts are observations, not frame deadlines or browser clone-cost claims.

## Placement quality is a separate gate

`npm run test:quality` renders and measures the
[placement-quality corpus](placement-quality.md). Feasible fixtures must meet
explicit overlap/occlusion budgets; deliberately impossible fixtures must expose
their problems without losing notes. It compares exact geometry and quality,
retained JSON bytes, and fixed-host resize movement. Timings are observations,
not a substitute for those correctness checks or a frame-rate promise.

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
- A positive integer `placement.maxCandidates` to limit **retained** ranked/debug
  candidates. Bounded searches now skip connector routing only when a cheap
  geometric lower bound proves a candidate cannot enter the exact retained set.
  This is not a hard evaluation or latency budget: worst-case searches still
  examine every candidate, and the unrestricted default remains exhaustive.
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
High-frequency pointer movement is coalesced to at most one provisional
React preview update per browser animation frame. Intermediate movement
callbacks remain synchronous for custom host tools; only the visual
projection is coalesced, keeping the latest movement. Pending frames are
canceled on release/cancellation/unmount or when authoritative geometry
changes. No worker, timing budget or browser-specific public API is added.
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

The experimental input fingerprint also preserves metadata alias topology,
explicit `undefined`, sparse arrays and negative zero. It invalidates a note
when shared metadata becomes independent (or vice versa), even if the values
look identical in JSON. Cross-annotation reference sharing is also tracked:
unchanged sharing patterns retain stable prefixes, while new relationships
between a changed suffix and cloned earlier notes invalidate the affected
owners as well. Cyclic, opaque or accessor-backed metadata conservatively
falls back to full resolution instead of reusing potentially stale objects.
This favors reference correctness without needlessly sacrificing incremental
updates for ordinary host sharing.

Hosts should continue using the visual-only `previewAnnotationEdit` during
pointer movement and the authoritative incremental session only when
committing edits. Consumer-owned Web Worker resolution has been tested in real
Chromium and can keep the main thread responsive during expensive full reflows;
see `docs/worker-layout.md` for measured transport and React timeline caveats.
A **package-owned** asynchronous Worker API remains future work, and no
public synchronous API or quality threshold was changed.
The host-owned Worker proof now isolates request/reply scheduling and React
commit from Worker comparison/encoding. In a 200-annotation compact update,
~489 ms of comparison/patch encoding dominated a ~0.2 ms reply-delivery
estimate; see the measured one-run observations in `docs/worker-layout.md`.
Future gains should address safe value/alias comparison rather than assuming
postMessage transport is the entire bottleneck.

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

### Independent DOM note measurements

Each hidden React DOM measurement copy uses its own max-content border-box
width, rather than stretching to the widest sibling in the hidden measurer.
This prevents a resized note from changing unrelated notes' measured widths
and eliminates cascading unnecessary layout invalidations. The painted note
inside the SVG foreignObject still fills the width computed for *its* note.

The Firefox/WebKit browser suite includes real ResizeObserver tests under a
CSS-scaled host surface: local computed dimensions must update the edited
note's authoritative layout, while the other note's size remains unchanged.
It also verifies that boundingClientRect's transformed screen pixels are not
misinterpreted as SVG local dimensions. No performance timing budget is
asserted.

### Repeated distant-obstacle edits

A host-managed incremental session can reuse the exhaustive candidate geometry
needed to prove that a changed obstacle is disjoint from every placement
alternative. On the first distant-obstacle update, the conservative proof still
enumerates all candidates, including those excluded from the retained
`maxCandidates` list. Later commits reuse that **session-local proof** when
the annotation value/size fingerprint and global bounds, placement, padding,
and refinement settings are unchanged.

The cache stores geometry only for annotation indices in the current session;
it is cleared on changed/unsafe global settings and pruned when notes disappear.
Routing-dependent connectors still use the existing full-resolution fallback,
and any possible obstacle intersection invalidates the affected suffix. Hosts
must keep returned resolved layouts immutable. The public synchronous APIs,
candidate scoring and placement quality are unchanged.

Run `npm run benchmark:obstacle-cache` to compare a first exhaustive proof,
two cached distant-obstacle updates, and an independent fresh full resolution
for 40/200 notes. The script asserts exact geometry and quality parity but
**does not impose timing budgets**. A cold solve and genuinely affected
topology can still be expensive.

One October 2026 shared-development-host observation, in milliseconds:

| Fixture | First exhaustive proof | Cached second update | Cached third update | Fresh full solve |
| --- | ---: | ---: | ---: | ---: |
| 40 notes | 17.9 | 4.2 | 2.1 | 12.1 |
| 200 notes | 46.1 | 8.2 | 8.9 | 42.3 |

These are individual non-controlled timings; they illustrate why repeated
spatial-independence proofs are worth caching and do **not** promise a similar
speedup on other hosts, layouts, or routed connectors.

The session cache now stores each conservative candidate footprint as four
**Float64** coordinates (left, top, right, bottom), rather than keeping a
separate JavaScript object for every note/connector segment. This preserves
double-precision intersection semantics, including fractional coordinates and
boundary contact. The cache declines more than 4,096 footprints per annotation
(128 KiB of stored coordinates), conservatively recomputing instead of keeping
an oversized auxiliary proof. Host-owned note counts and placement options
still determine the overall cost.

Run the independent, **opt-in** memory probe with Node's explicit GC:

```bash
npm run benchmark:obstacle-cache:memory -- --count=200 --updates=14
```

On two separate runs of a 200-note, many-candidate fixture on the October
2026 shared ARM development host, the pre-compaction object-based cache
retained about **26.84–26.86 MB** more heap plus ArrayBuffer memory after the
first distant-obstacle proof. The Float64 cache retained about
**8.68 MB**, mostly as ArrayBuffers, with exact priority-prefix, layout and
quality parity. In this fixture that was roughly **68% less** additional
retained memory. After another 14 distant-obstacle updates, both variants
showed under 0.35 MB of additional measured heap and no additional ArrayBuffer
retention for the compact case.

Those figures are GC-assisted V8 observations from independent processes,
not guaranteed application heap savings, binary message sizes, leak-proof
evidence, or browser memory measurements. RSS and one-run solve timings remain
sensitive to the allocator, JIT, load and garbage collection. Benchmark your
own obstacle/candidate density before relying on these observations.

### Incremental DOM note-size measurements

React hosts using `AnnotationLayer measure="dom"` still need an initial full
measurement of their visible notes, and must reconcile all notes when the
annotation collection or note renderer changes. However, browser
`ResizeObserver` callbacks now report the *specific* measured elements that
changed. The adapter maps these entries to their note IDs, measures only
those nodes (once per ID within a batch) and updates the corresponding sizes
without scanning every unaffected note. This avoids repeated
`getBoundingClientRect` and `getComputedStyle` calls during a one-note resize
in a dense layout, while retaining local-unit CSS zoom handling, no-op
updates and detached-node cleanup.

A 48-note deterministic React/DOM regression checks that an event for one
resized note causes exactly **one** geometry read, while a batch mentioning
two notes with a duplicate entry causes **two** reads. These counts test the
measurement path itself; the resulting authoritative layout can still need
full recomputation when its note sizes change. For hosts that own measured
sizes and committed incremental resolution, `resolvedLayout` remains the
preferred controlled integration. No browser frame-time guarantee is implied.

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

### No-op controlled React rendering

A host may refresh its annotation array and inline `editable`/CSS style
objects even though an authoritative `resolvedLayout` session returns the
**same** layout object. A controlled React layer now uses an internal memo
boundary to skip the annotation renderer altogether when that authoritative
layout, annotation IDs, bounds, and every presentation/interaction prop are
semantically unchanged. It compares supported inline edit options and shallow
CSS style values instead of their disposable wrapper-object identity.

This optimization applies only to `resolvedLayout` mode. A host changing the
layout, annotation membership, callbacks, accessibility labels, or editing
semantics still renders normally. Host target-alignment reporting that reads
raw annotations remains reactive to their source changes. The wrapper captures
scalar edit-option and CSS style values, bounds and annotation IDs on each
controlled parent render, so in-place host mutations remain visible to the
memo boundary. `onLayout` and quality callbacks retain their existing
subscription semantics. The caller must not mutate an authoritative resolved
layout in place; recompute it via
`createIncrementalAnnotationLayoutSession.update` when content really changes.

Two independent opt-in desktop/mobile/200-note Chromium profiling runs on the
shared development host observed these **no-op** results:

| Case | Before: React render | After: React render | Before: next rAF | After: next rAF |
| --- | ---: | ---: | ---: | ---: |
| Desktop, 40 notes | 3.7 ms | 0 ms | 11.4 ms | 6.7 ms |
| Mobile, 24 notes | 2.6 ms | 0 ms | 9.4 ms | 11.1 ms |
| Dense desktop, 200 notes | 17.7 ms | 0 ms | 35.7 ms | 12.0 ms |

These are separate single-run observations, subject to CPU contention and
browser scheduling; the React duration may be zero on a memo bailout, but the
page still has other host/UI scripting and work before the next frame. Do not
interpret rAF callback timing as compositor painting or a guaranteed 60 fps.
The existing full-layout parity and keyboard/pointer/accessibility regression
checks stay intact, and no rendering virtualization is enabled by default.

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

### Off-main-thread full-layout proof

`npm run test:browser:worker` validates a **consumer-owned** module Worker that
calculates full layouts separately from React. It covers real desktop/mobile
Chromium, out-of-order responses, stale/cancelled result handling and exact
fresh-layout parity. The Node 22 CI lane also verifies the actual bundled Vite
production Worker. `npm run benchmark:browser:worker` adds a 200-annotation
case outside the required CI performance gates. The host still owns the Worker,
revision tokens and `AnnotationLayer.resolvedLayout` updates; the package's
synchronous solver stays the default. The browser proof also tests compact,
acknowledged patches for unchanged annotation results, and records JSON-size
estimates (caching the full-size baseline instead of reserializing all notes on
every compact response) together with cloning, patch-admission, React and next-rAF timings;
these measures do not guarantee a frame-rate improvement. See [the Worker integration
recipe](worker-layout.md) for limitations around CPU cancellation, structured
cloning, React identity, and end-to-end timings.
