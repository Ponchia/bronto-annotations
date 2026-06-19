# @ponchia/annotations

`@ponchia/annotations` is a DOM-independent annotation engine with rendering
helpers and adapters for geometry supplied by host applications.

The package places explanatory notes, subjects, and connectors around things a
host already renders: SVG figures, DOM regions, Vega/Vega-Lite charts, Mermaid
diagrams, D2 diagrams, React Flow graphs, and report surfaces. It does not
render charts, parse diagram languages, lay out graphs, own app state, persist
annotations, or provide a design system.

## Install

```bash
npm install @ponchia/annotations
```

Import only the subpaths you need:

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

The root package has no React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui`
runtime dependency. Adapter peer packages are optional; the adapters use public
geometry, rendered SVG, or duck-typed state supplied by the host.

## Core Usage

```ts
import {
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const annotations: Annotation[] = [
  {
    id: 'peak',
    anchor: { type: 'point', point: { x: 240, y: 96 } },
    note: {
      title: 'Peak response',
      body: 'The host supplies geometry; the engine places the note.'
    },
    placement: { side: 'right' },
    priority: 2
  }
];

const layout = resolveAnnotationLayout({
  annotations,
  bounds: { x: 0, y: 0, width: 640, height: 360 },
  padding: 16,
  placement: {
    align: ['center', 'start', 'end'],
    offset: [16, 28],
    crossOffset: [0, -32, 32]
  },
  obstacles: [{ x: 260, y: 80, width: 120, height: 80 }]
});

document.body.innerHTML = renderAnnotationsSvg(layout, {
  title: 'Chart annotations',
  includeDebugBoxes: true,
  markerIdPrefix: 'chart-annotations',
  noteTabIndex: 0,
  preserveAspectRatio: 'xMidYMid meet'
});
```

The core exports `Point`, `Box`, `Anchor`, `Annotation`, note metadata, placement
preferences, resolved layouts, deterministic candidate scoring, overlap helpers,
connector path helpers, note-size estimation, bounds padding, multi-candidate
placement search, opt-in bounded layout refinement for crowded layers,
connector-obstacle scoring, subject options, connector styles,
connector endpoint offsets, obstacle-aware orthogonal connector routing,
connector waypoints for manually routed callouts,
note wrap/max-line/padding/text-alignment controls, Bronto-compatible note rule
lines and label classes, priority-aware paint ordering, typed annotation
variants/tones/motion hints, and debug candidates.

When overlaying an existing SVG, pass the same `preserveAspectRatio` value used
by the host SVG so viewBox coordinates map the same way in both layers.
When multiple independent annotation layers share one document, pass a stable
`markerIdPrefix` per layer so SVG connector marker IDs cannot collide.

For manual placement, store explicit viewBox coordinates on the annotation:

```ts
const manuallyPlaced: Annotation = {
  id: 'callout',
  anchor: { type: 'point', point: { x: 240, y: 96 } },
  note: { title: 'Manually placed' },
  placement: {
    manual: { x: 320, y: 52, side: 'right' }
  }
};
```

Manual placement still produces a normal resolved layout, connector, quality
report, SVG output, and React output. Coordinates are clamped to placement
bounds by default; pass `clamp: false` when an authoring surface intentionally
allows notes outside the padded bounds.

When layout receives `obstacles`, straight and elbow connectors automatically
try a lightweight orthogonal detour before the candidate is scored. Disable
that per annotation with `connector: { routing: 'none' }`, or configure it with
`connector: { routing: { mode: 'orthogonal', padding: 8 } }`.

For dense report or dashboard layers, enable the bounded refinement pass after
candidate search:

```ts
const layout = resolveAnnotationLayout({
  annotations,
  bounds,
  obstacles,
  refinement: { passes: 2, maxCandidatesPerAnnotation: 32 }
});
```

Refinement is deterministic and only chooses among the candidates already
generated for each annotation. It is useful when the first greedy pass leaves a
lower-priority note overlapping a better candidate, while still preserving the
package boundary: no force simulation, chart layout, or host state ownership.

For generated charts or diagrams where an editorial route matters more than the
automatic detour, route the connector through explicit waypoints in the same
coordinate space:

```ts
const routed: Annotation = {
  id: 'routed-callout',
  anchor: { type: 'point', point: { x: 240, y: 96 } },
  note: { title: 'Routed connector' },
  connector: {
    type: 'straight',
    end: 'arrow',
    points: [
      { x: 240, y: 52 },
      { x: 340, y: 52 }
    ]
  }
};
```

Use `pointMode: 'relative'` when the waypoints should be offsets from the
anchor point instead of absolute viewBox coordinates.

## Geometry Helpers

The root export also includes DOM-free helpers for consumers that need to draw
annotation pieces themselves or migrate existing report annotations:

```ts
import {
  annotationParts,
  bracketSubjectPath,
  circleSubjectPath,
  declutterLabels,
  directLabels,
  notePlacement,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  translateAnchor
} from '@ponchia/annotations';

const parts = annotationParts({
  x: 240,
  y: 96,
  dx: 80,
  dy: 32,
  type: 'elbow',
  subject: { type: 'circle', radius: 10 }
});

const labels = directLabels([
  { key: 'north', anchor: { x: 560, y: 88 }, size: 18 },
  { key: 'south', anchor: { x: 560, y: 112 }, size: 18 }
], {
  axis: 'y',
  cross: 620,
  gap: 6,
  min: 16,
  max: 320
});

const movedAnchor = translateAnchor(
  { type: 'point', point: { x: 240, y: 96 } },
  { x: 12, y: -8 }
);

const bracketLayout = resolveAnnotationLayout({
  annotations: [{
    id: 'span',
    anchor: { type: 'point', point: { x: 200, y: 80 } },
    note: { title: 'Watched span' },
    variant: 'bracket',
    subject: {
      geometry: { type: 'bracket', x1: -80, y1: 0, x2: 80, y2: 0, depth: 12 }
    }
  }],
  bounds: { x: 0, y: 0, width: 640, height: 360 }
});

renderAnnotationsSvg(bracketLayout);
```

Helpers cover annotation/note transforms, note placement inside bounds, circle,
rect, threshold, bracket, band, slope, comparison, cluster, encircle, timeline,
and evidence subject paths, connector line/elbow/curve paths, connector
dot/arrow ends, connector start/end offsets, connector waypoints, direct labels,
and simple label decluttering. They output deterministic
SVG path/transform strings and do not parse chart or diagram source. Prefer
`annotation.subject.geometry` when you want the package SVG or React renderer to
draw a Bronto-style bracket, band, slope, comparison, cluster, encircle,
timeline, or evidence subject. Geometry is anchor-relative by default; set
`geometrySpace: 'absolute'` for chart-wide rules or bands already expressed in
viewBox coordinates. Use `annotation.subject.path` only as the raw SVG escape
hatch for custom subject shapes.

## Layout Diagnostics

Use `evaluateAnnotationLayout` in tests, report generation, or CI to prove a
layout is not just rendered but usable. Use `assertAnnotationLayoutQuality` for a
fail-fast guard and `formatLayoutQualityReport` when you want a readable summary
for logs or host-app diagnostics.

```ts
import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport
} from '@ponchia/annotations';

const report = evaluateAnnotationLayout(layout);

assertAnnotationLayoutQuality(report, {
  failOnWarnings: true,
  label: 'Report annotations',
  minScore: 95
});

formatLayoutQualityReport(report, { includeInfo: true });
```

The report covers invalid note boxes, bounds overflow, note overlap, obstacle
overlap, connector-obstacle crossings, connector-note crossings, aggregate
metrics, and a simple quality score.

## Presets

Presets are plain-data factories for common annotations. They do not add runtime
dependencies or bypass the layout engine.

```ts
import {
  encircleCallout,
  pointCallout,
  regionCallout,
  thresholdAnnotation
} from '@ponchia/annotations';

const annotations = [
  pointCallout({
    id: 'peak',
    point: { x: 240, y: 96 },
    note: { title: 'Peak' }
  }),
  regionCallout({
    id: 'band',
    box: { x: 140, y: 120, width: 180, height: 64 },
    note: { title: 'Stable band' }
  }),
  encircleCallout({
    id: 'outliers',
    points: [{ x: 420, y: 84 }, { x: 448, y: 102 }, { x: 436, y: 122 }],
    pointRadius: 4,
    padding: 8,
    note: { title: 'Outlier cluster' }
  }),
  thresholdAnnotation({
    id: 'limit',
    orientation: 'horizontal',
    value: 180,
    range: [40, 600],
    note: { title: 'Limit' }
  })
];
```

Available presets: `pointCallout`, `regionCallout`, `pathCallout`,
`encircleCallout`, `thresholdAnnotation`, and `badgeAnnotation`.
`encircleCallout` computes an enclosing circle from host-supplied points and
renders it as structured subject geometry without importing D3. `badgeAnnotation`
renders a compact Bronto-style `__badge` marker by default and keeps the note
available for labels/ARIA without drawing a note card; pass `showNote: true`
when the badge should also carry a visible callout note. Presets accept the same
`variant`, `tone`, `motion`, `style`, `className`, `data`, `metadata`, and
`placement` fields as raw annotations.

## D3-Style Migration

For teams used to d3-annotation's `x`/`y` plus `dx`/`dy` authoring model, the
root package includes a DOM-free conversion helper. It does not import D3,
mutate selections, or own chart scales; it only maps familiar annotation data
into this package's `Annotation` model.

```ts
import {
  annotationsFromD3Style,
  renderAnnotationsSvg,
  resolveAnnotationLayout
} from '@ponchia/annotations';

const annotations = annotationsFromD3Style([
  {
    id: 'peak',
    type: 'annotationCalloutCircle',
    x: 240,
    y: 96,
    dx: 88,
    dy: -42,
    color: '#d12f6a',
    note: { title: 'Peak', label: 'D3-style offset', wrap: 24 },
    subject: { radius: 12, radiusPadding: 4 },
    connector: { end: 'arrow' }
  },
  {
    id: 'encircled',
    type: 'annotationCalloutCircle',
    dx: 72,
    dy: 24,
    note: { label: 'Encircled points' },
    subject: {
      points: [{ x: 420, y: 84 }, { x: 448, y: 102 }, { x: 436, y: 122 }],
      pointRadius: 4,
      padding: 8
    }
  },
  {
    id: 'limit',
    type: 'annotationXYThreshold',
    x: 0,
    y: 180,
    dx: 32,
    dy: -60,
    note: { label: 'Threshold' },
    subject: { x1: 40, x2: 600 }
  }
]);

const layout = resolveAnnotationLayout({
  annotations,
  bounds: { x: 0, y: 0, width: 640, height: 360 }
});

renderAnnotationsSvg(layout);
```

Editable layers can round-trip React edit events back into d3-style objects:

```ts
import { applyD3StyleAnnotationEdit } from '@ponchia/annotations';

const updated = applyD3StyleAnnotationEdit(annotation, editEvent, {
  x: 'period',
  y: (datum) => datum.score,
  accessorsInverse: {
    x: 'period',
    y: (value) => ({ score: value })
  }
});
```

Existing d3-annotation generator configuration can also move over as
collection-level generator-style configs. The bridge accepts familiar
`annotations`, default `type`, `accessors`, `accessorsInverse`, `ids`,
`editMode`, `notePadding`, and `textWrap` fields, but returns plain package
annotations instead of mutating a D3 selection:

```ts
import {
  applyD3StyleAnnotationCollectionEdit,
  createD3StyleAnnotationBuilder,
  prepareD3StyleAnnotationCollection
} from '@ponchia/annotations';

const collection = {
  type: 'annotationCalloutCircle',
  accessors: {
    x: 'period',
    y: (datum) => datum.score
  },
  accessorsInverse: {
    x: 'period',
    y: (value) => ({ score: value })
  },
  ids: ['peak'],
  editMode: true,
  notePadding: 6,
  annotations: [
    {
      data: { period: 2, score: 9 },
      dx: 72,
      dy: -28,
      note: { label: 'Generator-style config' },
      subject: { radius: 10 }
    }
  ]
};

const prepared = prepareD3StyleAnnotationCollection(collection);
const annotations = prepared.annotations;

const updatedCollection = applyD3StyleAnnotationCollectionEdit(collection, editEvent);

const builder = createD3StyleAnnotationBuilder()
  .type('annotationCalloutCircle')
  .accessors({ x: 'period', y: (datum) => datum.score })
  .ids(['peak'])
  .editMode(true)
  .notePadding(6)
  .annotations(collection.annotations);

const builderAnnotations = builder.toAnnotations();
builder.applyEdit(editEvent);
```

The edit helper updates anchor coordinates, `dx`/`dy` note offsets, threshold
subject ranges, and shallow datum fields when string accessors or
`accessorsInverse` are supplied. This mirrors the practical editable workflow
from d3-annotation while keeping this package DOM-free.

Supported type aliases include `annotationLabel`, `annotationCallout`,
`annotationCalloutElbow`, `annotationCalloutCurve`,
`annotationCalloutCircle`, `annotationCalloutRect`, `annotationXYThreshold`,
and `annotationBadge`, plus kebab-case equivalents. `disable: ['subject',
'connector', 'note']` maps to hidden parts, connector waypoints map to relative
connector points, `note.lineType` maps to horizontal/vertical note rule lines,
`note.orientation` can derive the rule direction, d3-style `note.align` values
map to `start`/`center`/`end`, callout types get the same default horizontal
note rule line as d3-annotation unless `lineType: 'none'` is set,
`note.bgPadding` maps to note padding when explicit padding is absent,
`note.wrapSplitter` customizes deterministic text wrapping, `nx`/`ny` map to
absolute manual note coordinates while `dx`/`dy` keep offset semantics,
`color` maps to per-annotation CSS variables for renderers and can be combined
with the richer package `style` object,
`annotationCalloutRect` accepts negative `subject.width`/`subject.height` and
normalizes them into a positive core box, `annotationCalloutCircle` can compute
an encircling subject from `subject.points`, `annotationBadge` preserves
`subject.x`/`subject.y` side hints such as `right`/`top`, and accessor options
can read `x`/`y` from a supplied datum. `data` stays the accessor datum and is
stored in annotation metadata as `datum`; use `annotationData` for rendered
annotation-layer `data-*` attributes. Migrated `note`, `subject`,
`subject.badge`, and `connector` class/data hooks are preserved for rendered SVG
styling and selector-based tests. `defineD3StyleAnnotationType` provides a
DOM-free custom-type bridge for defaults, base-type conversion, and
post-conversion transforms when migrating reusable d3-annotation-style types.
`prepareD3StyleAnnotationCollection` covers the common generator-level data
shape without D3 collection selection joins, and
`createD3StyleAnnotationBuilder` provides a chainable DOM-free builder for
teams migrating from `annotation().annotations(...).type(...).accessors(...)`.
This is a
migration/ergonomics bridge, not a D3 component replacement.

`docs/d3-annotation-parity.json` tracks the supported surface from
`d3-svg-annotation@2.5.1`: type aliases, familiar note/subject/connector fields,
custom d3-style conversion helpers, datum accessors, inverse edit mapping, and
explicit non-goals. `npm run
test:d3-parity` proves those helpers still work and that the root package does
not export the D3 selection adapter, D3 type base, or D3 runtime custom type
component.
Use `docs/migration-guide.md` for a practical d3-annotation mapping table,
editable round-trip notes, and runtime differences.

## React

```tsx
import { useState } from 'react';
import {
  applyAnnotationEdits,
  generatedSurfaceLayoutDefaults
} from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';
import type { Annotation } from '@ponchia/annotations';

const initialAnnotations: Annotation[] = [
  {
    id: 'step',
    anchor: { type: 'box', box: { x: 120, y: 80, width: 160, height: 72 } },
    note: { title: 'Step', body: 'Rendered by the React adapter.' }
  }
];
const qualityDefaults = generatedSurfaceLayoutDefaults({
  layoutLabel: 'Figure annotations'
});

export function FigureAnnotations() {
  const [annotations, setAnnotations] = useState(initialAnnotations);

  return (
    <AnnotationLayer
      annotations={annotations}
      assertQuality={qualityDefaults.assertQuality}
      bounds={{ x: 0, y: 0, width: 640, height: 360 }}
      measure="dom"
      markerIdPrefix="figure-annotations"
      editHandleTabIndex={0}
      noteTabIndex={0}
      preserveAspectRatio="xMidYMid meet"
      editable={{
        includeAnchor: true,
        noteHandlePosition: 'bottom-right',
        keyboardStep: 2,
        keyboardLargeStep: 12
      }}
      onEditEnd={(event) => {
        setAnnotations((current) => applyAnnotationEdits(current, event));
      }}
      onQuality={(event) => console.log(event.summary)}
      qualityFormat={qualityDefaults.qualityFormat}
      onLayout={(layout) => console.log(layout.annotations.length)}
    />
  );
}
```

`AnnotationLayer` and `useAnnotations` use the same headless layout path as the
SVG renderer. The component supports `ResizeObserver` note measurement,
`renderNote`, `onLayout`, `onQuality`, `assertQuality`, `onTargetAlignment`,
`assertTargetAlignment`, debug boxes, custom labels, host SVG
`preserveAspectRatio` matching, scoped connector marker IDs via
`markerIdPrefix`, optional tabbable notes through `noteTabIndex`, optional edit handles with `onEdit`,
`onEditStart`, and `onEditEnd` callbacks, and server rendering. Edit callbacks
map pointer events through the layer's SVG `preserveAspectRatio`, then return
suggested `placement.manual` data for note moves and `suggestedAnchor` data for
anchor moves; `applyAnnotationEdit` and `applyAnnotationEdits` apply those
suggestions immutably when the host app wants to persist them. Focused
edit handles can also be nudged with arrow keys. `editHandleTabIndex` controls
whether React edit handles participate in normal tab navigation. `keyboardStep`
controls normal arrow-key movement, `keyboardLargeStep` controls Shift+arrow movement, and
`noteHandlePosition` moves the note drag handle to a corner or center that fits
the host surface.

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
  ids, and source/target handle ids.

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

## Styling

`@ponchia/annotations/bronto.css` styles the emitted `pa-annotation*` classes and
the legacy `ui-annotation*` static-SVG classes from `@ponchia/ui/annotations`.
It is safe to import with or without `@ponchia/ui`. When `@ponchia/ui` tokens are
present it follows `--bronto-*` annotation tokens and the legacy `--accent`,
`--panel`, `--line`, `--line-strong`, `--text`, `--text-dim`, `--mono`, motion,
radius, and focus-ring tokens; otherwise it uses standalone fallbacks. It is a
CSS bridge only; there is no hard `@ponchia/ui`
dependency.

Annotations can carry Bronto-compatible visual hints without importing
`@ponchia/ui`:

```ts
const annotation: Annotation = {
  id: 'risk-band',
  anchor: { type: 'box', box: { x: 40, y: 80, width: 180, height: 64 } },
  note: { title: 'Risk band' },
  variant: 'band',
  tone: 'warning',
  motion: 'draw'
};
```

Annotations can also carry per-item CSS variable overrides. The SVG and React
renderers attach them to the annotation group, so host apps can accent a single
callout without global CSS:

```ts
const annotation: Annotation = {
  id: 'peak',
  anchor: { type: 'point', point: { x: 240, y: 96 } },
  note: { title: 'Peak' },
  style: {
    color: '#d12f6a',
    lineColor: '#d12f6a',
    noteBackground: '#fff7fb',
    subjectFill: 'rgba(209, 47, 106, 0.14)',
    vars: { '--custom-annotation-token': 'demo' }
  }
};
```

`annotationStyleVariables(style)` exposes the same mapping for custom renderers.
The built-in keys map to stable `--pa-annotation-*` variables and compatibility
`--annotation-*` variables where useful; extra `vars` must be valid custom
property names beginning with `--`.

For custom renderers or migrated static SVG snippets, use the class recipe
helpers instead of rebuilding class strings by hand:

```ts
import {
  annotationClassName,
  brontoAnnotationClassName
} from '@ponchia/annotations';

annotationClassName({ variant: 'badge', tone: 'warning', motion: 'pulse' });
// "pa-annotation pa-annotation--badge pa-annotation--warning pa-annotation--pulse"

brontoAnnotationClassName({ variant: 'bracket', tone: 'info', motion: 'draw' });
// "ui-annotation ui-annotation--bracket ui-annotation--info ui-annotation--draw"
```

Variants include `label`, `callout`, `elbow`, `curve`, `circle`, `rect`,
`threshold`, `badge`, `bracket`, `band`, `slope`, `compare`, `cluster`, `axis`,
`timeline`, and `evidence`. Tones are `accent`, `muted`, `success`, `warning`,
`danger`, and `info`; motion hints are `draw`, `reveal`, `pulse`, and `focus`.
The CSS bridge styles notes, debug boxes, edit handles, and subject/connector
parts, including compact badge markers and Bronto-compatible note rule lines.
Annotation overlays are pointer-transparent by default so host charts and
diagrams keep receiving clicks; edit handles opt back into pointer events for
authoring. Static SVG output can expose tabbable notes via `noteTabIndex` and
tabbable edit handles via `editHandleTabIndex` for host-wired navigation or
authoring. The bridge also keeps migrated `ui-annotation*` report snippets
legible with the old paint-order text halo, evidence/badge styles, and motion
names, and respects print, forced-colors, and reduced-motion preferences.

## Examples And Checks

```bash
npm install
npm run check
npm run test:docs-snippets
npm run test:pack
npm run test:browser
npm run test:screenshots
npm run test:readiness
npm run test:completion-audit
npm run test:api-stability
npm run test:canary
npm run test:d3-parity
npm run test:bronto-parity
npm run test:bronto-upstream
npm run test:dogfood
```

Examples:

- `examples/index`
- `examples/svg-basic`
- `examples/react-basic`
- `examples/bronto-report`
- `examples/dom-basic`
- `examples/vega-basic`
- `examples/mermaid-basic`
- `examples/d2-basic`
- `examples/react-flow-basic`
- `examples/style-gallery`

`examples/vega-basic` uses Vega scenegraph geometry. Vega-Lite consumers use
the same adapter after compiling or rendering their Vega-Lite spec through
public Vega/Vega-Lite APIs.
`examples/index` is the browsable entry point that links every verified example
context from a small annotated overview.
`examples/style-gallery` renders every public annotation variant, all tones,
all motion hints, package-prefixed classes, and Bronto-compatible CSS styling in
one inspectable SVG layer.

Browser verification opens every example through Vite, checks visible notes and
connectors, rejects note overlap/overflow, verifies adapter examples use
rendered host geometry, checks annotation subjects are aligned to actual
generated Vega marks, Mermaid nodes/edges, D2 shapes/routes, and React Flow nodes,
handles, or edges, verifies the style gallery covers every variant/tone/motion class, and
captures screenshots in `.tmp/screenshots`. Packed-consumer browser
smoke also captures clean-installed package screenshots in
`.tmp-packed-screenshots`.

After `npm run test:pack` and `npm run test:browser`, screenshot verification
checks every expected desktop/mobile PNG for all examples plus the packed
consumers, validates the PNG dimensions, rejects tiny placeholder files, and
requires visible varied content. The approved metrics live in
`test/visual-baselines/browser-screenshots.json`, and `npm run
test:screenshots` compares new browser output against those visual baselines.

Packed-consumer verification also installs the generated tarball into temporary
clean projects. One browser smoke proves root SVG rendering and
`@ponchia/annotations/bronto.css` styling from the packed package; another
clean Vite/Chromium consumer installs the optional peers and renders real
DOM/report, Vega, Mermaid, D2, and React Flow surfaces through public package
imports, verifies each annotation subject aligns with the generated host target,
and checks legacy `ui-annotation*` report snippets are styled by the packed CSS
bridge.

Dogfood verification runs a separate clean Vite report consumer from the packed
tarball. It renders DOM report regions, a Vega-Lite chart compiled through
Vega, and a Mermaid diagram, then verifies visible notes/connectors, generated
target alignment, and no console errors. The friction report lives in
`docs/dogfood-clean-consumer-report.md`.

`docs/readiness-matrix.json` is a checked map from the promised public surface
to concrete source files, examples, tests, packed-consumer smoke, browser
evidence, and documented limits. `npm run test:readiness` validates that matrix
against the current package exports and verification scripts so compatibility
claims do not drift from the evidence.

`test/docs-public-snippets.ts` type-checks the documented recipe shapes through
the public package subpaths, including React, DOM, Vega, Mermaid, D2, React
Flow, and `bronto.css` imports.

`docs/completion-audit.json` maps the original requested product scope and
success criteria to direct evidence across source, tests, examples, packed
consumers, browser verification, docs, styling parity, d3-style ergonomics, and
product boundaries. `npm run test:completion-audit` verifies every audit entry
against the current files and is included in `npm run check`.

`docs/integration-recipes.md` is the practical first-use guide for automatic and
manual placement across SVG, DOM/report, React, Vega/Vega-Lite, Mermaid, D2, and
React Flow contexts.
`docs/context-quickstart.md` is the shorter chooser for host contexts, imports,
anchor sources, first helpers, manual placement, generated-surface timing, and
common integration mistakes.
`docs/api-reference.md` lists the primary exports for every public subpath and
the boundary each adapter keeps.

`docs/bronto-ui-annotation-parity.json` tracks the public
`@ponchia/ui/css/annotations.css` and `@ponchia/ui/annotations` surface carried
into this package. `npm run test:bronto-parity` proves the legacy
`ui-annotation*` classes, package-prefixed renderer classes, motion/print/forced
color rules, and Bronto geometry helper exports remain available without adding
a hard `@ponchia/ui` dependency.
When a local `@ponchia/ui` checkout is available, `npm run test:bronto-upstream`
also compares the parity manifest and CSS bridge against the upstream annotation
CSS selectors, legacy declaration properties, custom properties, keyframes, and
helper exports.
`docs/migration-guide.md` also covers moving existing Bronto static SVG snippets
and helper usage onto this package.

## Repository Quality

This repository is set up as a release-ready package, not only a local scaffold.

- CI runs `npm run check` on Node 20 and Node 22 for pushes and pull requests.
- Release publishing uses npm provenance through the GitHub Release workflow.
- Dependabot tracks npm and GitHub Actions updates, with optional peers grouped
  separately from tooling.
- `CONTRIBUTING.md` documents product boundaries, verification expectations,
  adapter requirements, and release handoff.
- Security policy: `SECURITY.md` defines the vulnerability reporting path and
  security boundary.
- Pull request and issue templates require reproduction details, verification,
  and product-boundary checks.
- `scripts/check-repo-readiness.mjs` keeps package metadata, workflows,
  templates, lifecycle docs, and release guardrails wired into `npm run check`.

## Pre-Release Hardening

The package is ready to dogfood, but the next public-release step is proving
the API in real consumers before wider stability promises.

- `docs/pre-release-roadmap.md` tracks dogfood, API freeze, canary publishing,
  visual baselines, adapter recipes, authoring UX, performance, accessibility,
  compatibility, and naming/release decisions.
- `docs/api-stability.md` defines which APIs are stable for `0.1.x` and which
  remain experimental during `0.x`; `docs/api-stability.manifest.json` labels
  every public export and `npm run test:api-stability` enforces it.
- `docs/compatibility.md` records supported Node, TypeScript, React, Vega,
  Mermaid, D2, and React Flow ranges.
- `docs/dogfood-friction-report.md` is the required template for the first real
  consumer integration report.
- `docs/dogfood-clean-consumer-report.md` records the clean-consumer dogfood
  pass and friction found by `npm run test:dogfood`.
- `docs/canary-release.md` documents the GitHub Packages canary lane, and
  `docs/canary-publish-report.md` records the verified
  `0.1.0-canary.1.e754177` registry install; `npm run test:canary` verifies the
  canary workflow, version prep, and registry-consumer smoke wiring.
- `docs/adapter-recipes-proof.md` records which deeper Vega-Lite, Mermaid, D2,
  and React Flow recipes are already proven and which still need richer
  browser/live coverage.
- `docs/visual-regression.md` documents the screenshot baseline update workflow.
- `npm run test:performance` runs deterministic 10, 50, and 200 annotation
  stress layouts against the real engine.
- `scripts/check-pre-release-goals.mjs` keeps these hardening docs and gates
  wired into `npm run check`.

## Known Limits

- Placement is deterministic multi-candidate scoring with optional bounded
  refinement; it is not a force solver, constraint solver, or annealing engine.
- Connector paths support straight, elbow, curve, disabled modes, endpoint
  offsets, dot/arrow ends, explicit waypoints, and lightweight orthogonal
  obstacle detours.
- Adapters trust geometry supplied by public host APIs or rendered SVG.
- The package does not infer chart semantics, parse Mermaid or D2 source, or
  manage graph/application state.

## Future Work

- Additional connector routing strategies beyond orthogonal obstacle detours.
- More host-specific recipes for common chart and diagram outputs.
- Optional renderer bridges for non-SVG canvases.
- Additional dense-layout recipes for very heavily annotated reports.
