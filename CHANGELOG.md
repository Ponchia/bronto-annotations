# Changelog

All notable changes to `@ponchia/annotations` are documented here.

This project follows SemVer. Until the package reaches `1.0.0`, minor versions
may include API changes while preserving the documented migration path whenever
reasonable.

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

- Private GitHub repository bootstrap under `Ponchia/bronto-annotations`.
- CI, release provenance workflow, Dependabot, issue templates, PR template,
  CODEOWNERS, contributing guidance, security policy, and release runbook.
