# API Stability

The current package carries forward the contract introduced in **0.7**, with
additive 0.8 and 0.9 APIs. Published 0.6.x packages retain their old contract; follow
[the 0.7 migration guide](migration-0.7.md) before upgrading. Use the
[installation guide](getting-started.md#choose-your-version) for the confirmed
stable package and matching documentation.

The export manifest classifies the current contract, not an immutable promise
that every pre-1.0 minor release preserves earlier shapes. A reviewed breaking
minor change updates code, consumers, declarations and migration guidance
together. Experimental APIs remain explicitly identified.

## Stability Labels

- Stable for `0.7.x`: the contract introduced in 0.7 and inherited by 0.8 and 0.9.
  Stable exports remain source-compatible across patch releases in their minor line.
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

- Patch releases must preserve the stable contract for their released minor line;
  0.8 and 0.9 retain the stable `0.7.x` API listed above.
- Normal layouts have no candidate diagnostics. Diagnostic collection never
  changes winners or the configured refinement frontier.
- React accepts either source inputs or a complete layout, not both.
- Experimental APIs can change, but README, API reference, migration docs, and
  examples must change in the same commit.
- New public subpaths require declaration checks, packed-consumer smoke tests,
  docs, and readiness/completion audit evidence.
- Root imports must remain DOM-free and free of optional peer runtime imports.


### Experimental readability extension

`LayoutReadabilityReport`, `LayoutQualityOptions.readability`, and
`LayoutRefinementOptions.readability` remain experimental in the 0.8 and 0.9 source lines. They are opt-in; existing geometry validity, default solver selection and
quality scores remain unchanged. The report describes polylines only and records
unmeasured curves/invalid routes explicitly. See the [core guide](core-guide.md#optional-connector-readability).

The root `layoutAnnotationPins` helper and its `AnnotationPinInput`, `AnnotationPinLayout`, `AnnotationPinLayoutOptions` and `AnnotationPinPlacement` types are experimental. Bounded placement and explicit omission are not an optimal-packing guarantee.

### Numeric report evidence (0.9)

`LayoutQualityReport.numericDiagnostics` is an additive optional field. It
records nonfinite report values by path without altering existing metrics,
geometry validity or assertion policies. Reports whose numeric fields are all
finite retain their previous shape. This does not make arbitrary layout objects
JSON-serializable, promise exact geometry at extreme scales, or automatically
rehydrate a saved report. The existing export names and subpaths are unchanged.
