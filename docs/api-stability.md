# API Stability

**Current package:** `0.6.x` (pre-1.0). The stable/experimental export manifest was first frozen for the `0.1.x` compatibility policy; this document records that historical floor, while minor-version changes must still be reviewed through the release notes before upgrading consumers.

`@ponchia/annotations` is currently pre-1.0. The package is usable, but its
experimental authoring API can still evolve before `1.0.0`.

## Choosing an API today

Prefer the stable rendering and layout APIs for a first integration. Consult the
[release notes](https://github.com/Ponchia/bronto-annotations/releases) for the
exact version installed in your application, especially across minor updates.
The `0.1.x` label below is the historical policy identifier in the verification
manifest, **not an instruction to install version 0.1**. The manifest still
classifies the current exported names; this guide does not broaden their
compatibility guarantees beyond the recorded policy.

For experimental editing or incremental layout, pin the version in your
application and test upgrades against your own interactions and geometry.
Example-only history, JSON forms, and Worker protocols are not public package APIs.

## Stability Labels

- Stable for `0.1.x`: expected to remain source-compatible across patch
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
  measurement, quality events, and target-alignment events.
- Bronto CSS bridge: `@ponchia/annotations/bronto.css` and legacy
  `ui-annotation*` compatibility selectors.

## Experimental During `0.x`

- d3-style builder mutation helpers and custom annotation type definitions.
- Edit-patch authoring ergonomics, including `createAnnotationEditEvent`,
  `createAnnotationEditDelta`, `createAnnotationEditSession`, and
  `previewAnnotationEdit` (visual only).
- `createIncrementalAnnotationLayoutSession` and `AnnotationLayoutSession`:
  opt-in priority-prefix reuse for unrefined layouts, including added/removed
  suffix notes and conservatively independent obstacle changes; safe fallback
  for affected routing, global geometry, or refinement.
- React edit-handle authoring options, edit events, and the opt-in
  `AnnotationLayer.resolvedLayout` controlled-layout property until the
  authoring UX layer is hardened.
- Dense-layout tuning constants and scoring weights.
- Low-level adapter finder/traversal helpers such as rendered SVG finders, D2
  traversal helpers, and React Flow geometry helpers.

## Maintainer-only formats

Visual regression baseline files and canary publishing workflows are internal
verification tools, not exported APIs. Historical pre-release evidence does not
turn these formats into a compatibility promise for consumers.

## API Change Rules

- Patch releases must not break the stable `0.1.x` list above.
- Experimental APIs can change, but README, API reference, migration docs, and
  examples must change in the same commit.
- New public subpaths require declaration checks, packed-consumer smoke tests,
  docs, and readiness/completion audit evidence.
- Root imports must remain DOM-free and free of optional peer runtime imports.
