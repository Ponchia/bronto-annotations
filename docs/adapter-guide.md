# DOM and generated-surface adapters

[Documentation index](README.md) · [First annotation](getting-started.md)

This maintained guide contains the detailed examples previously in the root
README. Read only the sections relevant to your integration.

## DOM And SVG Utilities

```ts
import { extractedAnchorFromElement, prepareDomAnnotations } from '@ponchia/annotations/dom';

const anchor = extractedAnchorFromElement(document.querySelector('#target')!, {
  id: 'target',
  coordinateSpace: document.querySelector('#surface')!,
  source: 'dom-rect'
});

const prepared = prepareDomAnnotations(document, [
  {
    selector: '#target',
    coordinateSpace: document.querySelector('#surface')!,
    note: { title: 'Measured region' }
  }
], {
  obstacles: [{ selector: '.host-obstacle', coordinateSpace: document.querySelector('#surface')! }]
});
```

The DOM subpath creates anchors and obstacle boxes from `DOMRect`, DOM elements,
SVG elements, selectors, ids, `getBBox`, `getBoundingClientRect`, and SVG
coordinate conversion. For SVG elements, transformed `getBBox()` geometry,
sampled path points, client boxes, and `preserveAspectRatio` fallback math are
normalized into the requested SVG coordinate space. It also exposes
`annotationsFromDomSelectors`, `validateDomAnchors`, and `prepareDomAnnotations`
so host apps can turn selectors into annotation data, obstacle boxes, and
diagnostics in one step. It is a browser utility layer; the core remains plain
data.
Use `annotationFrameFromSvg` to derive layout `bounds`, a matching annotation
layer `viewBox`, and `preserveAspectRatio` from rendered SVG output.

## Adapters

Adapters convert host geometry into annotations or anchors. They do not render
or lay out the host surface.

```ts
import {
  annotationsFromVegaScales,
  annotationsFromVegaScenegraph,
  obstaclesFromVegaScales,
  obstaclesFromVegaScenegraph,
  obstaclesFromVegaSvg,
  obstaclesFromVegaView,
  prepareVegaScaleAnnotations,
  prepareVegaScenegraphAnnotations,
  prepareVegaViewAnnotations,
  validateVegaSvgAnchors
} from '@ponchia/annotations/vega';
import {
  annotationsFromMermaidSvg,
  prepareMermaidAnnotations,
  validateMermaidSvgAnchors
} from '@ponchia/annotations/mermaid';
import {
  annotationsFromD2Diagram,
  obstaclesFromD2Diagram,
  obstaclesFromD2Svg,
  prepareD2DiagramAnnotations,
  validateD2SvgAnchors
} from '@ponchia/annotations/d2';
import {
  annotationsFromReactFlow,
  obstaclesFromReactFlow,
  prepareReactFlowAnnotations,
  validateReactFlowAnchors
} from '@ponchia/annotations/react-flow';
```

For generated surfaces, the `prepare*Annotations` helpers are the safest default:
they return `{ annotations, obstacles, validation }` from the same host geometry,
ready to pass into `resolvePreparedAnnotationLayout` once the host supplies
bounds:

```ts
import {
  generatedSurfaceLayoutDefaults,
  resolvePreparedAnnotationLayout
} from '@ponchia/annotations';
import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';

const prepared = prepareMermaidAnnotations(svg, [
  { id: 'api-note', label: 'API', note: { title: 'API' } }
]);

const resolved = resolvePreparedAnnotationLayout(prepared, {
  ...generatedSurfaceLayoutDefaults({
    anchorLabel: 'Mermaid anchors',
    includeInfo: true,
    layoutLabel: 'Mermaid annotation layout'
  }),
  bounds: svg.viewBox.baseVal,
  targetAlignmentTargets: [{
    id: 'api-note',
    expected: 'rendered Mermaid API node',
    box: { x: 96, y: 48, width: 86, height: 44 }
  }],
  assertTargetAlignment: {
    label: 'Mermaid target alignment',
    failOnWarnings: true
  },
  targetAlignmentFormat: {
    label: 'Mermaid target alignment',
    includeAligned: true
  }
});

resolved.layout;
resolved.validationSummary;
resolved.targetAlignmentSummary;
resolved.quality;
resolved.qualitySummary;
```

Use `evaluateAnchorAlignment` when a host app wants a non-throwing proof that
prepared anchors still match the generated mark, node, handle, edge, or route
geometry it expected. It accepts point, box, and path targets and returns
`aligned`, `warnings`, `missing`, distance, and overlap diagnostics. Pair it
with `assertAnchorAlignmentReport` in tests or strict runtime checks, or pass
the same targets to `resolvePreparedAnnotationLayout` with
`assertTargetAlignment` when validation, target alignment, and layout quality
should fail in one integration call.

Adapter annotation specs preserve authoring fields such as `note`, `placement`,
`subject`, `connector`, `variant`, `tone`, `motion`, `style`, `priority`, and
`metadata`. Generated-surface adapters reserve host lookup fields such as
`className` and `data` for rendered diagram/chart selectors when needed; use
`annotationClassName` and `annotationData` for annotation-layer classes and
consumer data. Adapter provenance is merged into `annotation.data` first, then
`annotationData` is applied so host apps can tag or override consumer-facing
data attributes deliberately.

- Vega/Vega-Lite: extract from a Vega View-like `data()` API, `view.scale()`
  output, generated scenegraph mark bounds, rendered SVG selectors, or rendered
  SVG mark metadata (`markName`, `markType`, and `role`). Vega-Lite support uses
  the public Vega-Lite-to-Vega compile/render path: compile or render the
  Vega-Lite chart into a Vega View or SVG, then use this adapter against that
  generated geometry. No `vega-lite` peer is required by this package.
  Scenegraph and scale helpers apply `view.padding()` automatically, and
  scenegraph helpers also apply Vega's SVG export `view.origin()` offset when
  the host View exposes it. View-data and scale helpers can derive obstacle
  boxes from the same generated data geometry used for anchors;
  `prepareVegaViewAnnotations` and `prepareVegaScaleAnnotations` include
  matching spec-derived obstacles by default and accept richer obstacle options
  when the host wants all marks. Rendered SVG helpers can also derive obstacle boxes
  from selectors or mark metadata. Metadata-matched rendered SVG anchors use the
  concrete child mark element when the matched wrapper contains exactly one mark;
  multi-mark layers should use a selector or scenegraph datum predicate.
  Generated scenegraph and SVG annotations expose provenance such as
  `data.anchorSource`,
  `data.vegaMarkName`, `data.vegaMarkType`, `data.vegaRole`,
  `data.vegaElementId`, and `data.datumIndex`.
- Mermaid: extract from rendered SVG ids, labels, nodes, edge paths, clusters,
  classes, `data-*` hooks, or selectors. Exact and contains label matching are
  supported, and requested edge path anchors prefer the rendered path over the
  parent edge group. Edges can be targeted by generated edge id or by rendered
  source/target endpoint ids when the host knows the connected node ids but not
  Mermaid's generated edge id. Annotations expose whether the anchor came from a
  rendered label, node id, edge id, cluster id, Mermaid id, class, data selector,
  or selector.
- D2: extract from compiled D2 diagram shapes/routes, including nested diagrams,
  or rendered SVG selectors, shape ids, connection ids, labels, classes, and data
  attributes. Exact and contains label matching are supported for compiled and
  rendered D2 labels. Requested rendered connection path anchors prefer the child
  route `<path>` over the wrapper group. Compiled diagram helpers and rendered
  SVG helpers can both derive obstacle boxes for placement. Compiled and SVG
  annotations expose generated shape ids, connection ids, route endpoints, and
  whether the anchor is a shape or connection route when the host geometry
  exposes them.
- React Flow: extract from public node, measured handle, edge, and viewport
  geometry. Node `handles` and host-supplied `internals.handleBounds` are used
  when present, with node-side fallback when a handle has not been measured.
  Edge anchors use measured `sourceHandle` and `targetHandle` centers when
  available, while `edgePoints` remains the override for custom routed edges.
  Node, measured handle, and optional edge obstacles can be derived from the
  same public state; `prepareReactFlowAnnotations` includes handles and edges
  by default, while `obstaclesFromReactFlow` exposes `includeHandles` and
  `includeEdges` for custom obstacle sets.
  Annotations expose node ids, handle ids/types/sides, edge ids, edge endpoint
  ids, and source/target handle ids. The `react-flow-basic` example runs
  against a transformed viewport and stores dragged note edits as host-owned
  annotation patches, leaving graph state in React Flow.

Adapters also provide obstacle helpers where useful, so host-generated axes,
diagram nodes, edge labels, shapes, and routes can participate in placement
scoring.

Use adapter validation helpers before layout when the host surface is generated
or user-authored. The `prepare*Annotations` helpers accept `assert: true` or
`assert: { label, failOnWarnings }` to fail fast while still returning the same
validation report on success. Standalone validation helpers return a
non-throwing report with `found`, `warnings`, `missing`, and per-spec
diagnostics:

```ts
import {
  assertAnchorValidationReport,
  formatAnchorValidationReport
} from '@ponchia/annotations';

const report = validateMermaidSvgAnchors(svg, [
  { id: 'api-note', label: 'API' },
  { id: 'worker-note', label: 'Worker' }
]);

assertAnchorValidationReport(report, { label: 'Mermaid anchors' });
formatAnchorValidationReport(report, { label: 'Mermaid anchors' });
```

Vega exposes `validateVegaViewAnchors`, `validateVegaScaleAnchors`,
`validateVegaScenegraphAnchors`, and `validateVegaSvgAnchors`; D2 exposes
`validateD2DiagramAnchors` and `validateD2SvgAnchors`; Mermaid exposes
`validateMermaidSvgAnchors`; React Flow exposes `validateReactFlowAnchors`.
Use `formatAnchorValidationReport` when the host app should show the diagnostics
instead of throwing.
Use `formatAnchorAlignmentReport` when the host app should show whether
prepared anchors are aligned, near, missing, or misaligned against expected
host geometry.
React Flow handle diagnostics can return `fallback` warnings when the requested
handle has not been measured and the adapter will use the node-side midpoint.

For rendered SVG integrations such as Mermaid or D2, keep the annotation layer's
viewBox and `preserveAspectRatio` aligned with the generated SVG. This matters
for diagrams that use `xMinYMin meet` or other non-default aspect alignment.

See `docs/integration-recipes.md` for first-use recipes covering SVG figures,
DOM/report regions, React layers, Vega/Vega-Lite, Mermaid, D2, and React Flow,
including automatic placement, manual placement, validation, obstacles, and
layout-quality checks.
Use `docs/context-quickstart.md` when you only need to choose the right public
subpath and adapter helper for a host surface.
