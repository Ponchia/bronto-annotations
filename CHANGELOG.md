# Changelog

All notable changes to `@ponchia/annotations` are documented here.

This project follows SemVer. Until the package reaches `1.0.0`, minor versions
may include API changes while preserving the documented migration path whenever
reasonable.

## Unreleased

### Fixed

- Only use an explicitly owned `LayoutOptions.noteSizes` entry for an
  annotation ID. Host IDs such as `__proto__`, `constructor` and
  `toString` no longer resolve inherited object properties as note sizes
  or produce invalid/NaN note geometry. Explicit own entries in standard
  and null-prototype dictionaries remain supported, including in incremental
  sessions and imported interactive-editor documents.

### Documentation and discovery

- Give desktop guide prose the wide column and topic navigation the narrow
  sidebar, matching document order; guard both desktop and mobile reading widths
  in published-browser verification.

- Make the first-use SVG and React snippets responsive; verify the exact snippets
  in clean packed consumers as well as the documentation fixtures. Document a
  standalone Vite application setup without cloning the repository.
- Add in-page section navigation, search guide descriptions, and verify static
  fragment targets in the published HTML. Keep current guides separate from
  maintainer reference and historical evidence in search results.

- Refocus the README on first use and move detailed API examples into maintained
  topic guides without removing verification evidence.
- Add executable onboarding snippets, troubleshooting, a documented example
  catalog, per-example READMEs, and a simple local example command.
- Add optional Ko-fi funding links for GitHub and npm, a funding guide, and
  support/contribution routes. No runtime API or release version changes.

### Interactive authoring examples

- Select a rendered note directly by clicking it or focusing it with the
  keyboard. The host-only text editor follows that selection without
  recalculating or committing layout geometry; existing edit handles and
  connectors are not selection targets.
- Ensure an appended annotation stays below imported negative-priority notes
  whenever the guarded demo priority range allows it. At the priority floor,
  generated notes remain JSON round-trippable and exact full-layout parity is
  preserved; the example no longer promises unchanged placements for every
  imported priority configuration.

## 0.6.9 - 2026-10-12

### Fixed

- Make incremental annotation snapshots sensitive to reference sharing, including
  cross-note aliases, omitted fields and unsafe host metadata. A changed suffix
  cannot accidentally reuse an earlier resolved note with stale source identity.
  Fingerprinting and Worker equality checks do not invoke metadata getters.
- Preserve reference topology in the experimental host-owned Worker compact
  reply example. Split/join changes, hidden properties and affected shared
  note groups fall back to authoritative snapshots rather than mixing
  incompatible old and new object graphs.
- Cancel active React pointer gestures after host layout replacement,
  unexpected pointer-capture loss, or disabling editing. An interrupted drag
  cannot commit stale coordinates through a later pointer release; completed
  edits and keyboard behavior retain their normal semantics.
- Size React's hidden DOM-measured note copies independently rather than
  stretching every note to the longest sibling. A note's CSS resize now
  updates only that note's measured width; browser regressions verify correct
  local border-box geometry beneath scaled ancestors in Chromium, Firefox
  and WebKit without treating transformed screen pixels as layout units.

### Performance

- Reuse immutable priority-prefix annotation results in the host-managed Worker
  session and skip redundant deep comparison when identical resolved winners
  have already been proven safe. Keep acknowledgement, cancellation, revision
  mismatch recovery and snapshot fallbacks in the host integration.
- Cache exhaustive, conservative candidate footprints across repeated
  independent obstacle changes in the experimental incremental session.
  Invalidate affected or globally changed geometry and preserve full-resolution
  fallbacks for obstacle-dependent connector routing. Exact geometry and
  layout-quality parity are tested against fresh synchronous resolution.
- Offer an optional 40/200-note obstacle-cache benchmark. Its single-run
  development-host timings are observational, not performance budgets or
  frame-rate guarantees.
- Store exhaustive candidate collision footprints in compact Float64 buffers
  rather than separate JavaScript boxes, preserving conservative collision
  proofs and bounding per-note proof-cache size. An opt-in GC-assisted memory
  probe checks exact placement and quality parity; sample memory savings are
  development-host observations, not universal guarantees.
- Compare actual Worker patch and snapshot messages using Node structured
  cloning, including byte-size observations, without conflating JSON payload
  estimates or next-rAF callbacks with transport bytes or compositor paint.

### Interactive authoring examples

- Show a runnable comparison of fixed-offset versus collision-aware note
  placement, with live geometry and diagnostics rather than static mockups.
- Provide a host-owned JSON inspector, copy action, guarded import, one-step
  undo/redo history, keyboard shortcuts and note-text editing form. Draft
  changes never commit layout work until the host explicitly applies them.
- Keep the demo's add/remove actions within the same small JSON import limits,
  generate conflict-free IDs even when user-supplied notes are named `added`,
  and preserve at least one authored note. No general-purpose serialization,
  persistence, command framework or form system is exported by the package.
- Make the demo's Move final anchor action operate on the actual final
  imported annotation rather than a reserved `signal` ID. Point and box
  anchors retain their shape, dimensions and JSON round-trip compatibility.
- Improve SVG touch gesture ownership and increase practical hit areas while
  keeping visible controls compact and leaving diagram scrolling available.

### Examples, accessibility and compatibility

- Feature runnable React incremental editing and native module Worker
  demonstrations alongside the existing static adapter examples, with clearer
  host ownership and first-use documentation.
- Verify actual desktop and mobile pointer editing, revision-safe Worker
  responses, accessibility and React Flow viewport transforms using Playwright
  Firefox and WebKit, while retaining mandatory Chromium coverage. Retain
  per-scenario screenshots and browser logs to support diagnosis.
- Simplify private React internals into editing geometry, SVG subject/connector
  rendering, marker definitions, data attributes, DOM measurement and
  frame-coalesced preview scheduling. Preserve the public component and package
  exports, memoization, SSR behavior and DOM semantics.
- Strengthen release tooling with a pinned modern npm only in the isolated
  Vitest 5/jsdom 30 check. Update Playwright/Vite, Vega-Lite and pinned GitHub
  Actions development tooling without raising the supported Node floor or
  adding package runtime dependencies.

## 0.6.8 - 2026-10-11

### Performance

- Coalesce high-frequency React `previewEdits` pointer movements to the most recent provisional visual update once per browser animation frame, avoiding redundant React reconciliation for sub-frame movement bursts.
- Preserve immediate `onEdit` notifications for every pointer movement, without changing host-owned persisted edits, authoritative layout resolution or geometry-quality scoring.

### Reliability and verification

- Invalidate pending previews on pointer completion, cancellation, a new drag, unmount, source-layout replacement or disabling previews. Old frame callbacks cannot resurrect completed gesture visuals; headless runtimes without `requestAnimationFrame` keep the previous synchronous fallback.
- Add deterministic frame-scheduler regressions for a 12-move burst, updated note and connector geometry, stable unaffected neighbors, callback counts and cancellation. Adjust existing React preview tests to await actual browser-frame rendering while retaining geometry, accessibility and keyboard assertions.
- Keep existing exported APIs, compatible peer ranges and production dependencies unchanged.

## 0.6.7 - 2026-10-11

### Performance

- Avoid reconciling a host-controlled React annotation layer when the authoritative `resolvedLayout` and semantic inputs are unchanged, even if the host recreates the annotation array or inline editing/style objects. Unchanged note content and edit controls retain their existing DOM and React identities.
- Capture immutable snapshots of mutable editing options, CSS style properties, bounds and annotation IDs during controlled updates. In-place changes correctly trigger rendering and controlled-layout validation instead of being hidden behind reference equality.

### Verification

- Add no-op and in-place-change regression coverage for editing controls, keyboard deltas, callback updates, layout identity, target alignment, accessibility labels, changed IDs and bounds.
- Validate exact fresh-layout parity and use opt-in Chromium desktop/mobile/dense profiles to distinguish React rendering, scripting and next-animation-frame timing. Measurements are illustrative and are not 60 fps guarantees.
- Preserve the existing headless API, uncontrolled React behavior, supported peers and runtime dependencies.

## 0.6.6 - 2026-10-11

### Performance

- Measure only the DOM note copies named in `ResizeObserver` notifications instead of rescanning every note for each size change. Duplicate observer entries are coalesced and unchanged note sizes retain their React state identity.
- Preserve the initial full measurement, full reconciliation on annotation/render-note updates, local CSS dimensions under transforms, and cleanup of detached note observers.

### Verification

- Add a 48-note React regression that verifies a one-note resize causes a single DOM geometry read and a two-note resize batch measures each note once. Test unrelated observer notifications, no-op sizes, added/removed notes, and existing zoom behavior.
- Keep stable exports, default headless placement, peer compatibility, browser/accessibility checks and production dependencies unchanged.

## 0.6.5 - 2026-10-11

### Performance

- Generate React annotation editing handles only for changed resolved annotations after committed incremental updates. Retain existing committed handle objects and SVG controls for unchanged notes, rather than rebuilding every note/anchor handle and discarding the results.
- Preserve exact priority-aware paint ordering, keyboard/pointer interactions, accessibility labels and option-change regeneration. No public API or dependency changes.

### Verification

- Add regression coverage for changed last notes, no-op inputs, append/remove of lower-priority annotations, stable note/handle identities and editing-option changes.
- Provide an optional handle-generation microbenchmark verifying exact object/geometry/ordering parity before reporting the isolated cost. The experiment does not assert or promise a sustained browser-frame speedup.

## 0.6.4 - 2026-10-11

### Performance

- Skip redundant note-size estimation and temporary size-map merging when a React host supplies an authoritative `AnnotationLayer.resolvedLayout`. The host's incremental session already owns the final annotation note-box geometry, so repeated committed updates no longer perform size work in the React renderer.
- Preserve standard uncontrolled note-size estimation and DOM measurement behavior when an external layout is not supplied or the host switches out of controlled mode.

### Verification

- Add focused React regression cases checking that host-controlled commits avoid estimator-only note property reads while normal uncontrolled rendering still performs size estimation. Keep the complete browser, compatibility, accessibility and packaged-consumer checks unchanged.
- Preserve stable exports, existing experimental API behavior and production dependency ranges.

## 0.6.3 - 2026-10-11

### Performance

- Preserve unchanged React SVG editing handle objects across committed incremental layout updates, reducing redundant editing-control reconciliation when the host only changes a later annotation.
- Stabilize semantically equivalent inline editing options and pointer/keyboard event-handler identities while dispatching through the latest committed host geometry and callbacks.
- Extend the Chromium desktop, mobile and 200-note profiling fixture with React Profiler render durations and committed render counts. Observed improvements are illustrative rather than strict timing budgets.

### Verification

- Add React regression coverage for unchanged edit-handle identities, no-op input recreation, late-note commits, updated pointer callback targeting, mutable editing options and keyboard steps.
- Preserve existing DOM semantics, accessibility, deterministic layout geometry and the complete headless API and dependency contract.

## 0.6.2 - 2026-10-10

### Performance

- Avoid the quadratic annotation quality-report pass in passive and host-controlled React layers that do not request `onQuality`, `assertQuality` or `qualityDebug`. Explicit consumers retain the same metrics, assertions and debug overlays, with report formatting changes reusing the existing quality calculation.

### Fixed

- Make `onLayout` notifications independent of unrelated quality, alignment and debug setting changes. Toggling the quality overlay or changing quality-report formatting no longer emits false layout-change callbacks.

### Verification

- Add regression tests proving no unrequested report work, preserved callback and assertion semantics, stable React rendering and notification independence. Continue validating all existing browser, accessibility, clean-consumer, Node and public-site lanes.
- Preserve package exports, supported peer ranges and runtime dependencies.

## 0.6.1 - 2026-10-10

### Fixed

- Correct false connector/obstacle intersections caused by distant collinear line segments. Shared bounded geometry checks now drive routing, candidate penalties and layout-quality diagnostics, preserving genuine edge contact without penalizing unrelated host geometry.

### Performance

- Extend the existing experimental incremental layout session to reuse unchanged higher-priority placements after appending/removing lower-priority annotations and certain moved host obstacles. Conservatively invalidate the affected suffix, consider every possible candidate (including those omitted from `maxCandidates`) and fall back to a fresh layout for orthogonal routing, global changes or refinement.
- Keep updated obstacle metadata and exact fresh-resolution parity when geometry changes, including nested in-place host edits.

### Verification

- Add deterministic topology, collision and randomized parity regression tests, plus actual Chromium/React desktop and mobile browser checks for changed obstacles, annotations and routing. Provide a separate 200-annotation browser benchmark with measured resolver and next-animation-frame timings; these are observations rather than a 60 fps guarantee.
- Preserve existing stable exports and package compatibility, with no new production dependencies.

## 0.6.0 - 2026-10-10

### Added

- Add the experimental `AnnotationLayer.resolvedLayout` prop for React hosts that already calculate an authoritative layout through `createIncrementalAnnotationLayoutSession` or `resolveAnnotationLayout`. This avoids an otherwise redundant full layout solve after committed edits and retains unchanged custom React notes.
- Validate matching host annotation IDs and bounds, and reject incompatible component-owned DOM measurement when the host supplies the authoritative layout. React quality reports, edit handles, target-alignment callbacks and server rendering use the same resolved geometry.

### Documentation and verification

- Document host-owned React layout state, the difference between drag previews and committed incremental updates, explicit note sizing, and normal fallback behavior.
- Add controlled React tests for no-op updates, stable neighboring note rendering, exact committed geometry, quality and layout callbacks, server rendering, and invalid host input guards. Preserve the existing React layer's default behavior and public exports.

## 0.5.0 - 2026-10-10

### Added

- Add experimental DOM-free `createIncrementalAnnotationLayoutSession` and its `AnnotationLayoutSession` type for deterministic priority-prefix reuse after committed edits. Unchanged earlier annotation winners retain identity; later placements and connectors are recomputed.
- Snapshot effective input values to detect nested in-place edits and note-size changes. Fall back to complete resolution when global geometry, obstacles, ordering, annotation count or iterative refinement can affect other winners.
- Add the optional `npm run benchmark:incremental` comparison with deep layout/quality parity against fresh full resolution. Sample late-note edits measured 23 ms versus 923 ms for 50 notes and 11 ms versus 4,086 ms for 200 notes on one development host (single-run observations, not guarantees).

### Integration evidence

- Verify the existing React Flow adapter against a second, real dense external graph host with five rendered nodes, five edges and ten handles. A host-owned handle-clearance placement recipe raised layout quality from 0 to 86/100 with zero note/obstacle overlaps while preserving four exact anchor alignments.
- Add strict external React Flow host verification, a rendered-owner-height clearance recipe, and deterministic collision regression fixtures without introducing a dependency on the host app.

### Tests and documentation

- Add differential tests for incremental no-op, late/early changes, in-place mutations, size updates, priority/count changes, changed bounds/obstacles, refinement, failed-update recovery and regular expressions.
- Document experimental import/use contracts and the distinction between visual drag previews and authoritative incremental updates, with the normal synchronous resolver unchanged.

## 0.4.1 - 2026-10-10

### Performance

- Keep React note, edit-handle, SVG marker and DOM measurement subtrees stable while previewing changes to a single annotation. Unchanged custom `renderNote` callbacks are no longer reinvoked on every pointer movement.
- Cache authoritative layout-quality debug geometry during visual-only previews, leaving report semantics, pointer/keyboard editing, accessibility roles and SSR markup intact.

### Verification

- Add dense React authoring regression coverage with 32 notes and repeated pointer movement, including stable hidden measurement copies and unaffected note content.
- Preserve the public API, compatibility matrix, existing packed consumers, accessibility checks and browser visual baselines.

## 0.4.0 - 2026-10-10

### Added

- Introduce experimental DOM-free `previewAnnotationEdit`, a visual-only projection for a single edited annotation without resolving the entire layout or rerouting around obstacles during pointer movement.
- Add opt-in `AnnotationLayer.previewEdits` for immediate live note, anchor, connector and edit-handle feedback while dragging. Unedited neighbors and authoritative layout/quality reports remain stable until the host commits.
- Demonstrate the preview in React and transformed React Flow examples and document usage for custom headless integrations.

### Fixed

- Ignore unrelated pointer IDs during an active drag and roll back cancelled pointer gestures without persisting an unfinished edit.

### Verification

- Add core/React tests for visual projection, clipping, unchanged neighbor layouts, edit cancellation and pointer identity; require real browser drag previews before mouse release.
- Preserve the existing synchronous headless layout and package compatibility contract; dynamic host-geometry incremental resolution remains planned separately.

## 0.3.3 - 2026-10-10

### Performance

- Speed up dense annotation layouts by skipping unnecessary orthogonal connector routing, replacing full-frontier sorting with a stable binary heap, and reducing per-candidate graph allocations and geometry checks.
- Preserve existing note positions, connector paths, candidate scoring, and layout-quality metrics in deterministic before/after comparisons, with added padded-obstacle and boundary-contact tests.
- Document reproducible benchmark observations, host integration guidance, and remaining limits of dense full-layout recalculation without changing the public API.

### Verification

- Run 212 unit tests, adapter/browser examples, packaged consumers, legacy Bronto UI CSS parity, TypeScript/React/Vega compatibility checks, and public-site checks.

## 0.3.2 - 2026-10-10

### Accessibility

- Interactive SVG and React annotation layers now expose named accessibility groups when they contain keyboard-focusable notes, edit controls, or custom note content, while passive layers retain their original image role.
- Preserve edit-handle and note keyboard interaction semantics in assistive technologies for React Flow diagrams; resolve the previously reported serious nested-interactive accessibility issue.
- Add headless SVG and React regressions and real Chromium/axe checks at mobile and desktop viewports.

## 0.3.1 - 2026-10-10

### Changed

- Publish a fully navigable Bronto Annotations website using real interactive placement, complete examples, source links and 25 authored HTML documentation pages.
- Improve first-use documentation, public npm metadata and social previews while keeping the framework-independent headless core and its exported API unchanged.
- Make the compiled example index notes legible within their boxes and enforce their visible text containment in browser tests.

### Security

- Patch development transitive dependencies including `smol-toml`, `source-map-js`, DOMPurify and KaTeX, with zero remaining npm audit advisories; sanitize generated Markdown HTML with DOMPurify.

### Verification

- Add CI-gated GitHub Pages publication, all-example route checks, 700+ internal link assertions, responsive browser checks and accessibility coverage for the public website.

## 0.3.0 - 2026-09-09

- Avoid false connector detours for disjoint collinear obstacles and accelerate orthogonal visibility checks.
- Refresh development dependencies to clear the current audit advisories.
- Add DOM Range measurement for wrapped text in viewport or scaled local coordinates.
- Add an accessible React annotation pin for host-owned overlays and discussion controls.
- Align explanatory annotation typography with BrontoUI 0.11: sans-serif, sentence case.

## 0.2.2 - 2026-09-02

### Fixed

- The DOM measurer now carries each annotation's style variables, exactly as
  the drawn note does. A border declared through `--pa-annotation-border`
  computed to no border in the measuring copy, so every note measured 2px
  narrower than it was drawn, and a title that fit the measurer wrapped at
  the drawn box's sub-pixel edge with its second line clipped. The stylesheet
  also keeps that border with a `currentColor` fallback where no colour is
  set.

## 0.2.1 - 2026-08-20

### Fixed

- DOM measurement (`measure="dom"`) now reads each note's used local size via
  `getComputedStyle` instead of trusting `getBoundingClientRect`, which reports
  post-transform pixels. Under an ancestor CSS scale — a zoomed canvas, a
  fitted diagram — notes were measured at `size × scale` and laid out at that
  width in local units, wrapping their own text one syllable per line below
  scale 1. The client rect remains the fallback where the environment performs
  no layout.

## 0.2.0 - 2026-06-20

### Changed

- Added public-repo security automation for CodeQL, Dependency Review,
  OpenSSF Scorecard, Dependabot security updates, private vulnerability
  reporting, and secret scanning.
- Added explicit public acknowledgement that Susie Lu's d3-annotation and
  react-annotation work are the primary inspiration for the package.
- Switched future npm releases to the tag-driven, protected-environment CI/CD
  lane used by the public Ponchia packages.

## 0.1.0 - 2026-06-19

### Added

- DOM-free annotation models, anchors, placement, collision scoring, connector
  geometry, edit patches, quality reports, and generated-surface layout helpers.
- SVG renderer with subjects, connectors, notes, debug boxes, data attributes,
  accessible labels, focusable notes, edit handles, and Bronto-compatible CSS.
- React adapter with `AnnotationLayer`, `useAnnotations`, DOM note measurement,
  quality and target-alignment callbacks, SSR-safe behavior, custom note
  rendering, and edit events.
- DOM/SVG utilities for selectors, DOMRects, SVG `getBBox`, coordinate spaces,
  obstacles, validation, and prepared annotation inputs.
- Vega, Mermaid, D2, and React Flow adapters with anchor extraction, obstacle
  extraction, validation, provenance, manual placement preservation, and
  prepared-layout workflows.
- d3-annotation-style authoring helpers and Bronto UI annotation parity helpers.
- Public examples, API docs, migration docs, readiness/completion audits,
  packed-consumer smoke tests, and browser verification.

### Repository

- Public GitHub repository bootstrap under `Ponchia/bronto-annotations`.
- CI, release provenance workflow, Dependabot, issue templates, PR template,
  CODEOWNERS, contributing guidance, security policy, and release runbook.
