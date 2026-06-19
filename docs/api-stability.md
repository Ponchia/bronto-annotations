# API Stability

`@ponchia/annotations` is at `0.1.x`. The package is usable, but public API
shape is still allowed to evolve before `1.0.0`.

## Stability Labels

- Stable for `0.1.x`: expected to remain source-compatible across patch
  releases.
- Experimental: available for dogfood and feedback, but may change during
  `0.x` without a deprecation window.
- Internal: not exported from package subpaths and not part of the public
  contract.

## Stable For `0.1.x`

- Core models: `Point`, `Box`, `Anchor`, `Annotation`, note metadata,
  placement preferences, resolved layout types, and style/data fields.
- Core layout: `resolveAnnotationLayout`, `refineAnnotationLayout`,
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
  measurement, quality events, target-alignment events, and edit events.
- Bronto CSS bridge: `@ponchia/annotations/bronto.css` and legacy
  `ui-annotation*` compatibility selectors.

## Experimental During `0.x`

- d3-style builder mutation helpers and custom annotation type definitions.
- Edit-patch authoring ergonomics beyond emitted suggested edits.
- Dense-layout tuning constants and scoring weights.
- Future visual regression baseline file format.
- Any canary-only package publishing workflow before the first public release.

## API Change Rules

- Patch releases must not break the stable `0.1.x` list above.
- Experimental APIs can change, but README, API reference, migration docs, and
  examples must change in the same commit.
- New public subpaths require declaration checks, packed-consumer smoke tests,
  docs, and readiness/completion audit evidence.
- Root imports must remain DOM-free and free of optional peer runtime imports.
