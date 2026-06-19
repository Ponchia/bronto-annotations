# End-To-End Scope And Verification

Status: implemented for the current public package surface.

## Completed Scope

The package now ships:

- TypeScript ESM build, declarations, package exports, tests, examples, and an
  umbrella `npm run check`.
- DOM-free core types for `Point`, `Box`, `Anchor`, `Annotation`, note metadata,
  placement preferences, resolved layouts, priorities, note sizes, bounds
  padding, obstacles, overlap scoring, multi-candidate placement search,
  opt-in bounded layout refinement for crowded layers, connector-obstacle
  scoring, deterministic candidates, subject options, connector styles,
  connector endpoint offsets, obstacle-aware orthogonal
  connector routing, priority-aware paint ordering, typed variants/tones/motion hints, per-annotation CSS
  variable style overrides, style-aware plain-data presets, and connector paths, plus
  explicit manual note placement in viewBox coordinates.
- DOM-free annotation geometry helpers for annotation/note transforms, bounded
  note placement, circle/rect/threshold/bracket/band/slope/comparison/cluster/
  encircle/timeline/evidence subject paths, deterministic enclosing circles,
  connector line/elbow/curve paths, connector dot/arrow ends, connector
  start/end offsets, direct labels, simple label decluttering, obstacle-aware
  connector detours, grouped annotation parts, and first-class renderer subject
  geometry for bracket/band/slope/comparison/cluster/encircle/axis/timeline/
  evidence subjects.
- DOM-free d3-annotation-style conversion helpers for `x`/`y` plus `dx`/`dy`
  offsets and `nx`/`ny` absolute note positions, callout/circle/rect/threshold/
  badge type aliases, disabled parts, relative connector waypoints, d3 callout
  note-line defaults, `note.lineType`, `note.orientation`, d3-style
  `note.align`, `note.bgPadding`, `note.wrapSplitter`, `color` style mapping,
  full package `style` overrides,
  negative `annotationCalloutRect` subject dimensions, encircling from `subject.points`,
  `annotationBadge` subject side hints, datum accessors, and edit round-tripping
  back to d3-style `x`/`y`, `dx`/`dy`,
  `nx`/`ny`, datum fields, negative rect anchors, and threshold subject ranges.
  These are migration helpers only; they do not import D3,
  mutate selections, or own chart scales.
- DOM-free edit-handle geometry, anchor translation, edit-patch extraction, and
  immutable edit-application helpers for authoring surfaces.
- SVG rendering for subjects, structured subject geometry, custom subject
  paths, connectors, notes, data attributes, accessible labels, optional
  focusable notes, optional focusable edit handles, and debug candidate boxes.
- React adapter with `AnnotationLayer`, `useAnnotations`, `ResizeObserver`
  measurement, `renderNote`, `onLayout`, debug mode, custom labels, optional
  focusable notes, optional edit handles, pointer and keyboard callbacks that emit suggested
  `placement.manual` or translated-anchor data, SVG `preserveAspectRatio`
  coordinate conversion for pointer edits, and server-render-safe effects.
- DOM/SVG utilities for `DOMRect`, element, selector, id, transformed
  `getBBox`, transformed SVG path sampling, selector obstacles,
  `getBoundingClientRect`, and SVG coordinate conversion with
  `preserveAspectRatio` fallback behavior, plus selector annotation conversion,
  validation diagnostics, and prepared annotation/obstacle bundles.
- Adapter subpaths for Vega/Vega-Lite, Mermaid, D2, and React Flow.
  Each adapter exposes lower-level anchor/annotation/obstacle/validation
  functions plus `prepare*Annotations` helpers that bundle annotations,
  generated-host obstacles, and validation reports for layout.
- `@ponchia/annotations/bronto.css` as a styling bridge only, including
  Bronto-compatible annotation variants, tones, edit handles, real
  `@ponchia/ui` token fallbacks, legacy `ui-annotation*` static-SVG aliases,
  class recipe helpers, and reduced-motion-safe motion classes.
- Eight examples that import public package subpaths.

## Public Subpaths

```text
@ponchia/annotations
@ponchia/annotations/dom
@ponchia/annotations/react
@ponchia/annotations/vega
@ponchia/annotations/mermaid
@ponchia/annotations/d2
@ponchia/annotations/react-flow
@ponchia/annotations/bronto.css
```

The root import has no optional runtime peer requirement. Optional adapters are
duck-typed around public host geometry and rendered SVG, so a consumer can import
the root package without React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui`.

## Adapter Boundaries

All generated-surface annotation specs preserve normal annotation authoring
fields such as `note`, `placement`, `subject`, `connector`, `variant`, `tone`,
`motion`, `style`, `priority`, and `metadata`. Where host lookup uses names like
`className` or `data`, the adapter exposes `annotationClassName` and
`annotationData` for annotation-layer classes and consumer data, while keeping
host provenance in `annotation.data`.

### Vega/Vega-Lite

The Vega adapter extracts anchors from a View-like public `data()` API,
`view.scale()` output, generated scenegraph item bounds, rendered SVG selectors,
or rendered SVG mark metadata (`markName`, `markType`, and `role`). Scenegraph
and scale helpers apply `view.padding()` when the host View exposes it, and
scenegraph helpers also apply Vega's SVG export `view.origin()` offset when it
is available. View-data and scale helpers can derive generated mark obstacle
boxes from the same data geometry used for anchors, and their prepared helpers
include spec-derived obstacles by default. Rendered SVG helpers can derive
obstacle boxes from selectors or the same mark metadata used for anchors.
Scenegraph and SVG annotations carry
generated mark provenance in `annotation.data`, including mark name, mark type,
role, rendered element id, and datum index when the host provides those fields.
Validation helpers report missing or invalid data, scale, scenegraph, and
rendered SVG anchor specs without throwing. Rendered SVG metadata anchors use a
single concrete child mark when available; multi-mark layers should use a
selector or scenegraph datum predicate. Vega-Lite support uses the public
Vega-Lite-to-Vega compile/render path: a host compiles or renders Vega-Lite into
a Vega View or SVG, then passes that generated geometry to this adapter. The
package does not need a `vega-lite` peer dependency. It does not create chart
specs, own scales, or infer chart semantics.

### Mermaid

The Mermaid adapter runs after Mermaid has rendered SVG. It can find elements by
selector, id, partial Mermaid id, node id, edge id, cluster id, class, `data-*`
attribute, exact or contains label text, and edge paths. Requested edge path
anchors prefer the child `<path>` over the parent edge group, and edges can be
targeted by rendered source/target endpoint ids when the generated edge id is
not known. Annotations carry rendered-SVG provenance, including whether the
anchor came from a label, selector, node id, edge id, cluster id, Mermaid id,
class, data selector, or edge endpoint ids. It also exposes a validation helper
for missing rendered SVG targets. It does not parse Mermaid source or own diagram layout.

### D2

The D2 adapter can use compiled diagram shape/connection geometry, including
nested diagrams, layers, scenarios, steps, and rendered SVG selectors, shape
ids, connection ids, labels, classes, and data attributes. It does not parse D2
source or execute D2 itself. Compiled-geometry and rendered SVG helpers can
derive obstacle boxes for placement, and rendered connection path specs prefer a
child route `<path>` over a wrapper group. Annotations carry generated shape
ids, connection ids, route endpoints, and shape-versus-route kind in
`annotation.data` when the host geometry exposes them. Validation helpers report
missing compiled shapes/connections, unrouted connections, and missing rendered
SVG targets.

### React Flow

The React Flow adapter maps public node, measured handle, edge, and viewport
geometry into anchors and obstacle boxes. It reads public node `handles` and
host-supplied internal handle bounds when available, with node-side fallback when
a handle has not been measured. `prepareReactFlowAnnotations` includes measured
handle and edge obstacles by default; lower-level obstacle extraction exposes
`includeHandles` and `includeEdges`. Default edge anchors use measured `sourceHandle`
and `targetHandle` centers when available, and host-supplied `edgePoints` can
override the path for custom routed edges. It carries node ids, handle
ids/types/sides, edge ids, edge endpoint ids, and edge source/target handle ids
in `annotation.data`. It does not own graph layout, interaction policy, or application state.
Its validation helper reports missing nodes/edges, invalid edge routes, and
handle fallback warnings.

All `prepare*Annotations` helpers now share a fail-fast `assert` option. Passing
`assert: true` throws on missing/invalid targets with adapter-specific
diagnostics; passing `assert: { failOnWarnings: true }` also rejects fallback
targets such as unmeasured React Flow handles.

## Examples

- `index`: browsable entry point linking every verified example context from a
  small annotated overview.
- `svg-basic`: static SVG geometry.
- `react-basic`: React annotation layer with DOM note measurement.
- `bronto-report`: CSS bridge over report geometry.
  Includes a migrated `ui-annotation*` static-SVG snippet so browser
  verification proves legacy Bronto report annotation styling still applies.
- `dom-basic`: anchors from measured DOM regions.
- `vega-basic`: annotations extracted from generated Vega scenegraph geometry
  with generated axis obstacles. Vega-Lite consumers use the same adapter after
  public Vega-Lite-to-Vega compilation or rendering.
- `mermaid-basic`: annotations extracted from rendered Mermaid SVG labels and
  edge paths.
- `d2-basic`: annotations extracted from compiled D2 diagram geometry, with
  rendered D2 SVG obstacles included in placement.
- `react-flow-basic`: annotations and node/handle/edge obstacles extracted
  from React Flow state.
- `style-gallery`: package styling specimen covering every public annotation
  variant, all tones, all motion hints, package-prefixed classes, and
  Bronto-compatible CSS styling.

## Verification Gates

`npm run check` runs:

- TypeScript build and declaration generation.
- Unit tests for core anchors, geometry, placement, bounded refinement,
  collisions, connectors, SVG rendering, React rendering, DOM/SVG extraction,
  DOM prepared annotation bundles, and every adapter.
- Documentation snippet smoke tests for the shared layout shape,
  generated-surface quickstart helpers, SVG rendering, layout quality checks,
  and React server rendering.
- Type checks for every public subpath, including public-import docs recipe
  snippets for React, DOM, Vega, Mermaid, D2, React Flow, and `bronto.css`.
- Runtime export checks for every public subpath and declaration file.
- D3-annotation parity checks for the supported Susie Lu-style authoring
  aliases, note/subject/connector fields, custom d3-style conversion helpers,
  accessors, inverse edit mapping, and explicit no-D3-selection/runtime
  component boundary.
- Bronto annotation parity checks for the old public `ui-annotation*` CSS
  surface, Bronto geometry helper exports, package-prefixed renderer classes,
  and the no-hard-`@ponchia/ui` dependency boundary.
- Optional upstream Bronto comparison against a local `@ponchia/ui` checkout
  when one is available, covering annotation selectors, helper exports,
  legacy CSS declaration properties, custom properties, and keyframes.
- Vite builds for every example.
- Packed tarball content checks plus clean-consumer smokes for root, React, CSS,
  DOM, Vega, Mermaid, D2, and React Flow subpaths, including clean
  Vite/Chromium browser consumers that import from the packed package, check
  rendered computed styles, render real DOM/report, Vega, Mermaid, D2, and React
  Flow surfaces with optional peers installed, verify each annotation subject
  aligns with the generated host target, and prove legacy `ui-annotation*`
  report snippets are styled by the packed CSS bridge.
- Browser verification for every example through a local Vite server.
- Browser screenshot evidence checks that every expected desktop/mobile PNG and
  packed-consumer PNG was generated, has the expected dimensions, is not a
  placeholder, and contains varied, non-background, sufficiently contrasted
  visible content.
- Readiness matrix verification that maps every public export, required example
  context, Bronto CSS bridge, d3-style ergonomics bridge, and generated-surface
  adapter claim to current source, tests, packed-consumer smoke, browser
  evidence, and documented limits.
- Completion audit verification that maps the original requested product scope
  and success criteria to direct source, test, example, packed-consumer,
  browser, screenshot, styling, docs, hygiene, and boundary evidence.
- Public hygiene scan for local paths, internal project names, internal URLs, and
  obvious secret patterns.
- Layout-quality diagnostics for invalid boxes, note overlap, bounds overflow,
  obstacle overlap, connector-obstacle crossings, and connector-note crossings.
- Deterministic geometry-helper tests for path strings, transforms, connector
  trimming, obstacle-aware connector routing, direct labels, and clean-consumer
  root imports.
- Manual-placement and edit-handle tests for core layout, configurable note
  handle positions, SVG rendering, React drag and keyboard callback payloads,
  translated anchor suggestions, immutable edit application, public type
  imports, and clean-consumer tarball use.
- Custom subject-path and structured subject-geometry tests for static SVG
  output, React output, public type imports, and clean-consumer tarball use.
- Note styling tests for text alignment, Bronto-compatible note-line and label
  parts, shared long-word wrapping, padding-aware size estimation, React
  alignment classes, public type imports, and clean-consumer tarball use.
- Compact badge tests for badge-only SVG rendering, React rendering, hidden note
  sizing/suppression, preset output, public type imports, and browser example
  coverage.
- D3-style migration tests for callout circle, computed encircling from
  `subject.points`, negative callout rect dimensions, curve waypoints,
  thresholds, badges, badge side hints, `nx`/`ny` absolute note coordinates,
  disabled parts, default callout note lines, note line types, note orientation/alignment,
  background padding, custom note wrap splitting, color-to-style-variable mapping,
  package style overrides, datum accessors, edit
  round-tripping, public type imports, exports, and clean-consumer tarball use.
- Adapter validation tests for missing Mermaid rendered labels, D2 missing and
  unrouted targets, Vega missing/invalid specs across extraction modes, React
  Flow missing/invalid/fallback targets, prepared annotation/obstacle/validation
  bundles, target-alignment diagnostics, public type imports, exports, and
  clean-consumer tarball use.
- Vega View/scale tests prove generated data geometry can become both anchors
  and obstacles for automatic placement without requiring scenegraph or SVG
  extraction.
- Cross-adapter authoring contract tests proving Vega, Mermaid, D2, and React
  Flow adapters preserve manual placement and normal annotation fields while
  extracting generated host geometry.
- Generated-surface placement contract tests proving Vega, Mermaid, D2, and
  React Flow prepared annotations can mix automatic placement, manual placement,
  generated obstacles, validation reports, target-alignment checks,
  layout-quality checks, and real layout resolution without note overlap or
  bounds overflow.
- Optional peer boundary tests for root import purity, adapter duck-typing, and
  package `peerDependenciesMeta` marking every adapter/renderer peer optional.
- Bronto CSS bridge tests for emitted `pa-annotation*` classes, legacy
  `ui-annotation*` static-SVG classes including connector ends and badges,
  class recipe helpers, packed CSS export, pointer-transparent overlays with
  interactive edit handles, and report text halo styling.

The core placement search now evaluates side, alignment, distance, and
cross-axis nudge candidates deterministically. This gives generated charts and
diagrams more usable layouts in crowded surfaces without introducing a
non-deterministic solver.

`docs/integration-recipes.md` records the first-use integration path for SVG
figures, DOM/report regions, React layers, Vega/Vega-Lite, Mermaid, D2, and
React Flow. It shows automatic and manual placement, validation, obstacle
extraction, layout quality checks, and the public package imports expected for
each host context.
`docs/context-quickstart.md` provides the shorter adapter chooser for host
contexts, imports, anchor sources, first helpers, generated-surface timing,
manual placement, and common integration mistakes.
`docs/api-reference.md` lists the primary exports for every public subpath and
documents the boundary each adapter keeps.
`docs/migration-guide.md` records practical migration paths from
d3-annotation-style authoring data and existing Bronto UI annotation CSS/helper
usage into the package's DOM-free core, renderers, adapters, and CSS bridge.

Browser verification runs every example at desktop and mobile viewports. It
checks expected text, non-empty annotation layers, visible notes/connectors, no
note overlap, no note overflow, no note-over-obstacle overlap, no horizontal
page overflow, no console/page errors, package computed style health for note
boxes, titles, connectors, and subjects in every example, per-annotation
computed style overrides, Bronto legacy `ui-annotation*` computed styles for
note text, connector ends, and evidence badges in the report example, full
variant/tone/motion class coverage in the style gallery example, clean
adapter validation reports for generated host targets, and adapter evidence
that host geometry was rendered and used. Vega must prove the generated mark
name/type, Mermaid must prove rendered label and edge anchors, and D2 must prove compiled
shape and connection-route ids plus rendered SVG obstacle extraction. React
Flow must prove rendered node/handle/edge DOM selectors, node/handle/edge
provenance from public flow state, and generated node/edge obstacles. The verifier also compares
rendered annotation subjects against actual generated Vega marks, Mermaid
nodes/edges, D2 shapes/routes, and React Flow nodes, handles, or edges, so metadata-only adapter
success is not enough. Screenshots are captured under `.tmp/screenshots`.

Rendered SVG overlays can match host `preserveAspectRatio` behavior. This is
required for generated diagrams such as D2 when their SVG uses non-default
alignment like `xMinYMin meet`. SVG and React renderers also accept a
`markerIdPrefix` so multiple annotation layers can coexist in one document
without connector marker ID collisions.

## Known Limits

- Placement is a deterministic candidate scorer with optional bounded
  refinement over generated candidates. It is intentionally not a force
  simulation, constraint solver, or annealing engine.
- Connector routing supports straight, elbow, curve, disabled connectors,
  endpoint offsets, manual waypoints, lightweight orthogonal obstacle detours,
  and dot/arrow ends. The scorer considers note overlaps and
  connector-obstacle crossings.
- DOM/SVG extraction depends on host-rendered geometry being measurable.
- Vega/Vega-Lite, Mermaid, D2, and React Flow adapters are geometry adapters
  only; they do not own host rendering, parsing, scales, graph layout, state, or
  persistence.
- The Bronto bridge is CSS-only and intentionally not a design-system dependency.
- Geometry helpers are deterministic SVG-building helpers. They are not a D3
  lifecycle, source-parser, or persistence layer.
- React edit handles are an authoring adapter surface, not persisted state. The
  host app decides whether and where to store suggested manual placement or
  translated anchor geometry.

## Future Work

- Additional dense-layout recipes for very heavily annotated reports.
- Additional connector routing strategies beyond orthogonal obstacle detours.
- More adapter recipes for common SVG mark and diagram structures.
- Optional editor/authoring affordances for interactive annotation creation.
- Optional canvas/WebGL render helpers for consumers that cannot use SVG.
- Advanced accessibility recipes for host apps that need custom roving focus or
  synchronized external note lists.
