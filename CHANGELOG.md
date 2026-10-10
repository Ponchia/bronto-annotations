# Changelog

All notable changes to `@ponchia/annotations` are documented here.

This project follows SemVer. Until the package reaches `1.0.0`, minor versions
may include API changes while preserving the documented migration path whenever
reasonable.

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
