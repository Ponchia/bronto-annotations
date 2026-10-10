# Changelog

All notable changes to `@ponchia/annotations` are documented here.

This project follows SemVer. Until the package reaches `1.0.0`, minor versions
may include API changes while preserving the documented migration path whenever
reasonable.

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
