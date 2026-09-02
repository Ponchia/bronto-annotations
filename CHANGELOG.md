# Changelog

All notable changes to `@ponchia/annotations` are documented here.

This project follows SemVer. Until the package reaches `1.0.0`, minor versions
may include API changes while preserving the documented migration path whenever
reasonable.

## Unreleased

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
