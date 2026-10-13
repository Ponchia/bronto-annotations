# Placement quality evaluation

This evaluation checks authored host geometry against semantic quality budgets and
compares exhaustive candidate retention with explicit `maxCandidates: 8`. It
complements the performance stress benchmark: known-feasible fixtures must fail
when notes overlap, overflow bounds, disappear, shrink, or occlude host content.

These are synthetic fixtures authored for this package. They are **not independent
adoption evidence, upstream examples, or an external competitor comparison**.
Consumer adoption requires independent human use and review in a real host.

## Reproduce

Use the repository's existing dependency and build workflow. From the checkout:

```sh
npm run build
npx vitest run test/scripts/placement-quality.test.ts
node scripts/placement-quality-corpus.mjs
node scripts/verify-placement-quality.mjs
```

The CLI defaults to `.tmp/placement-quality`. To preserve results across builds
(the build's clean step removes `.tmp`), choose an explicit directory:

```sh
node scripts/placement-quality-corpus.mjs --output-dir /tmp/annotation-quality-review
node scripts/verify-placement-quality.mjs --output-dir /tmp/annotation-quality-review
```

`npm run test:quality` builds the package and runs this corpus. Node 22 CI
retains its JSON and gallery alongside browser evidence. The existing stress
benchmark remains a separate latency guard.

Open `index.html` in the output directory. Each reference/bounded pair includes complete
host shapes, host labels, SVG annotation notes, and connectors. The dashed boundary
shows the padded placement bounds. Images retain their native dimensions instead
of shrinking chart labels into unreadable side-by-side thumbnails. Wide displays
show a pair side by side; smaller displays stack them in focusable scroll regions.
Standalone `.svg` files contain their own
annotation styles and can be inspected separately. `results.json` records every
case, including failures; generation writes artifacts **before** asserting quality
budgets, and both scripts exit nonzero on a failed verification.

The standalone verifier reads the saved JSON, compares its fixture configuration
with the checked-in corpus, and recomputes diagnostics from selected geometry.
It does not trust a saved `passed` label or saved measurement totals. It does not
rerun placement or authenticate arbitrary third-party reports. For new source,
rebuild and generate fresh evidence rather than only verifying old output.

## Authored cases and budgets

`test/fixtures/placement-quality/corpus.json` owns fixed host geometry, stable note
IDs, text, note sizes, obstacles, viewport bounds, and the reviewed expectation.
There is no randomness or browser-dependent note measurement in the solve.

| Host | Notes | Bounds in SVG/CSS pixels | Reviewed expectation |
| --- | ---: | --- | --- |
| Monthly bar chart | 5 | 960 × 600; 480 × 980 | Zero note overlap, bounds overflow, and host occlusion |
| Operating report | 5 | 960 × 600; 480 × 980 | Same zero budgets |
| Architecture graph | 6 | 960 × 600; 480 × 980 | Same zero budgets |
| Long-text report | 5 | 960 × 980; 480 × 980 | Same zero budgets; full multi-line text |
| Impossible crowded review | 5 | 400 × 220; 240 × 220 | Nonzero note-overlap errors must remain visible |

All cases have 16-pixel viewport padding. The narrow chart is authored as a
horizontal-bar reflow. The long-text report has rows tall enough for its
140-pixel notes. These host choices are part of the fixture, not runtime layout
features. All feasible obstacle-occlusion budgets are zero. Connector hits remain
reported; they are not silently treated as proof of readability.

The impossible cases retain all five 180 × 100 notes. Their total note area
exceeds the padded viewport area, proving that disjoint notes cannot fit. A
passing evaluation means the expected failure was detected; the gallery labels
these cases **EXPECTED PROBLEMS — NOT A GOOD LAYOUT**. Removing a note, hiding it,
reducing its box, or suppressing its overlap diagnostics is not an acceptable fix.

During initial fixture review, the wide long-text host's 105-pixel row spacing
failed the zero-overlap budget for 140-pixel notes, and narrow vertical bars caused
neighboring-bar occlusion. The authored host geometry was corrected to 175-pixel
rows and horizontal narrow bars. Note counts and zero budgets were retained.
Future fixture adjustments should preserve failed evidence and explain the host
or semantic reason; do not increase budgets to hide a real quality regression.

## Comparison and measurements

Both supported configurations use the same notes, obstacles, bounds, and enabled
refinement: two passes over at most eight candidates per annotation. The reference
omits `placement.maxCandidates`; the bounded run sets it to eight. This compares
exhaustive search/retention with bounded retention while keeping the refinement
frontier identical. It does not claim that eight-candidate refinement equals
unrestricted refinement over every candidate.

Selected IDs, subjects, anchor points, note boxes, connector points and paths,
placement sides, alignments, offsets, and scores must match **exactly**, as must
quality metrics and issue lists. Retained candidate lists intentionally differ:
the reference retains more than eight per note and the bounded run retains eight.
No internal optimization API is required.

The JSON contains source commit, a dirty flag for evaluated source/fixture/script
paths, Node/platform/architecture, full fixture inputs, resolved counts, selected
geometry, candidate counts and bytes, and timing observations. Candidate bytes are
the sum of UTF-8 JSON encodings of each retained per-note candidate array. They
are **not JavaScript heap measurements**. Selected geometry is stored without
candidate arrays; the gallery can be reproduced from the fixture and geometry.

Each configuration gets one warmup solve and three measured solves. Samples,
warmup duration, and median are in milliseconds and cover resolution/refinement
only; diagnostics, serialization, and rendering are outside that timer. All
samples are retained. There are no machine-specific timing pass limits. Measured
solves must produce deterministic selected geometry. Tests exclude timing fields
from deterministic equality assertions.

Area metrics are in squared SVG/CSS pixels:

- Note-overlap area sums pairwise rectangle intersections, counting a pair once.
- Obstacle-occlusion area sums note/obstacle intersections; overlapping obstacles
  can count the same region more than once.
- Bounds-overflow area measures each note's true rectangular area outside the
  padded viewport, counting corner overflow once. The package's original report
  is also retained; its overflow metric sums outside edge strips.
- Connector-obstacle and connector-note hits count intersecting polyline segments,
  using the package diagnostics. Own-note connector contacts are ignored by the
  package's default. A connector starting inside or touching its host subject's
  obstacle can produce a hit; this is not necessarily an unrelated crossing.

Resize evidence narrows only the viewport's right boundary by eight pixels, keeping
host geometry and note sizes fixed. Stable IDs match before/after layouts. JSON
records both bounds, per-note `dxPx`, `dyPx`, Euclidean movement in pixels, mean
and maximum distance, and placement-side changes. Both resized configurations
must still have exact parity and satisfy their fixture expectations. Movement is
an observation without a pass threshold; zero is a valid observation. This is
not a responsive host reflow test or an incremental-session continuity claim.

## Limits and human review

Rectangle diagnostics do not establish visual quality, accessibility, semantic
anchor correctness, or consumer usefulness. Inspect the full gallery for text
legibility, connector ambiguity, host content visibility, and sensible note/host
relationships. Authored note sizes and character wrapping do not measure actual
font glyphs, localization, zoom, device pixel ratio, or a consumer's DOM.

Connector diagnostics test polyline segments, including boundary contacts. They
do not count connector/connector crossings, graph-edge crossings, stroke-width
occlusion, or curved-path interior geometry. Architecture edges are rendered host
content, but only authored rectangular node obstacles participate in avoidance.
The static SVG gallery is not a keyboard, screen-reader, contrast, or responsive
accessibility audit. Consumer adoption needs independent human use; these
geometric checks and manual specimens cannot substitute for that evidence.
