# API Stability

**Current source contract: 0.7.x development preview.** This branch is preparing
an unpublished breaking minor release. Published 0.6.x packages retain their
old contract; follow [the 0.7 migration guide](migration-0.7.md) before upgrading.

The export manifest classifies the current contract, not an immutable promise
that every pre-1.0 minor release preserves earlier shapes. A reviewed breaking
minor change updates code, consumers, declarations and migration guidance
together. Experimental APIs remain explicitly identified.

## Stability Labels

- Stable for `0.7.x`: expected to remain source-compatible across patch
  releases.
- Experimental: available for dogfood and feedback, but may change during
  `0.x` without a deprecation window.
- Internal: not exported from package subpaths and not part of the public
  contract.

The machine-readable contract lives in
`docs/api-stability.manifest.json`. Public entrypoints carry matching source
comments with `@public` and, where applicable, `@experimental` notes.
`npm run test:api-stability` verifies that every exported name in every public
subpath is listed exactly once as stable or experimental.

## Stable for `0.7.x`

- Core models: `Point`, `Box`, `Anchor`, `Annotation`, note metadata,
  placement preferences, resolved layout types, and style/data fields.
- Core layout: `resolveAnnotationLayout`,
  `evaluateAnnotationLayout`, `assertAnnotationLayoutQuality`, and
  `formatLayoutQualityReport`.
- SVG rendering: `renderAnnotationsSvg`, subject/connectors/note rendering,
  debug boxes, data attributes, accessibility labels, and Bronto CSS classes.
- DOM/SVG utilities: DOMRect, selector, SVG element, obstacle, and validation
  helpers.
- Generated-surface prepared layout: `prepare*Annotations`,
  `resolvePreparedAnnotationLayout`, validation reports, target-alignment
  reports, and layout quality summaries.
- React layer: `AnnotationLayer`, `useAnnotations`, custom note rendering,
  measurement, quality events, and target-alignment events.
- Bronto CSS bridge: `@ponchia/annotations/bronto.css` and legacy
  `ui-annotation*` compatibility selectors.

## Experimental During `0.x`

- D3 migration helpers in `@ponchia/annotations/d3`, including builders and
  custom annotation type definitions. The root does not re-export these.
- Edit-patch authoring ergonomics, including `createAnnotationEditEvent`,
  `createAnnotationEditDelta`, `createAnnotationEditSession`, and
  `previewAnnotationEdit` (visual only).
- `createIncrementalAnnotationLayoutSession` and `AnnotationLayoutSession`:
  opt-in priority-prefix reuse for unrefined layouts, including added/removed
  suffix notes and conservatively independent obstacle changes; safe fallback
  for affected routing, global geometry, or refinement.
- React edit-handle authoring options, edit events, and the opt-in
  `AnnotationLayer.layout` render-only property until the
  authoring UX layer is hardened.
- Dense-layout tuning constants and scoring weights.
- Low-level adapter finder/traversal helpers such as rendered SVG finders, D2
  traversal helpers, and React Flow geometry helpers.

## Maintainer-only formats

Visual regression baseline files and canary publishing workflows are internal
verification tools, not exported APIs. Historical pre-release evidence does not
turn these formats into a compatibility promise for consumers.

## API Change Rules

- Once 0.7 is published, patch releases must not break the stable `0.7.x` list above.
- Normal layouts have no candidate diagnostics. Diagnostic collection never
  changes winners or the configured refinement frontier.
- React accepts either source inputs or a complete layout, not both.
- Experimental APIs can change, but README, API reference, migration docs, and
  examples must change in the same commit.
- New public subpaths require declaration checks, packed-consumer smoke tests,
  docs, and readiness/completion audit evidence.
- Root imports must remain DOM-free and free of optional peer runtime imports.
