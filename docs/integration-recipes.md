# Integration Recipes

This guide is for first-use integration in a host app. The package expects the
host to render the chart, diagram, graph, report, or SVG first, then pass
measurable geometry into the annotation layer.

If you are still choosing the right subpath, start with
`docs/context-quickstart.md`.

## Common Flow

Use the same flow for generated surfaces and static reports:

1. Render or measure the host surface.
2. Extract annotation anchors and obstacles with the matching adapter.
3. Resolve prepared annotations with validation and layout-quality assertions.
4. Render the annotation SVG or React layer over the same coordinate space.

```ts
import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const resolved = resolvePreparedAnnotationLayout(prepared, {
  ...generatedSurfaceLayoutDefaults({
    anchorLabel: 'Generated anchors',
    includeInfo: true,
    layoutLabel: 'Surface annotations'
  }),
  bounds: { x: 0, y: 0, width: 640, height: 360 },
  padding: 16,
  targetAlignmentTargets: [{
    id: 'api-note',
    expected: 'rendered API node',
    box: { x: 96, y: 48, width: 86, height: 44 }
  }],
  assertTargetAlignment: {
    label: 'Generated target alignment',
    failOnWarnings: true
  }
});

if (!resolved.validation.ok || !resolved.targetAlignment?.ok || !resolved.quality.ok) {
  console.info(resolved.validationSummary);
  console.info(resolved.targetAlignmentSummary);
  console.info(resolved.qualitySummary);
}

hostOverlay.innerHTML = renderAnnotationsSvg(resolved.layout, {
  title: 'Annotations',
  includeEditHandles: true,
  editHandleTabIndex: 0,
  markerIdPrefix: 'host-annotations',
  noteTabIndex: 0,
  preserveAspectRatio: 'xMidYMid meet'
});
```

Use `editHandleTabIndex` only when the host app wires static SVG edit behavior
with pointer or keyboard event delegation. React edit handles include their own
pointer and keyboard callbacks through `AnnotationLayer`.

For first integrations, prefer `resolvePreparedAnnotationLayout` with
`generatedSurfaceLayoutDefaults`, `assertValidation`, `assertTargetAlignment`,
and `assertQuality` so missing anchors, anchors that no longer match generated
targets, and poor note placement fail in the same place. Add
`failOnWarnings: true` to `generatedSurfaceLayoutDefaults` when fallback
anchors, such as unmeasured React Flow handles, should fail the run instead of
using a node-side midpoint. The lower-level `prepare*Annotations` helpers can
still accept `assert` when a host wants to validate anchors before choosing
layout bounds.

When the host can provide expected generated geometry, pass
`targetAlignmentTargets` and `assertTargetAlignment` to the prepared-layout
helper, or call the lower-level target-alignment diagnostics directly in tests.
This proves prepared anchors still land on the generated mark, node, handle,
edge, or route the host meant to annotate:

```ts
import {
  assertAnchorAlignmentReport,
  evaluateAnchorAlignment
} from '@ponchia/annotations';

const alignment = evaluateAnchorAlignment(prepared.annotations, [{
  id: 'api-note',
  expected: 'rendered API node',
  box: { x: 96, y: 48, width: 86, height: 44 }
}]);

assertAnchorAlignmentReport(alignment, { label: 'Generated target alignment' });
```

Automatic placement comes from `placement.side`, `placement.align`, `offset`,
`crossOffset`, priorities, note sizes, bounds, existing placed notes, and
obstacles. Manual placement is explicit viewBox geometry and works through the
same renderer and connector path:

```ts
const manualPlacement = {
  placement: {
    manual: { x: 420, y: 48, side: 'left' }
  }
};
```

Store manual coordinates in the same coordinate system as the overlay viewBox.
When the host surface resizes, remeasure the host geometry and rerun layout.

## SVG Figures

For a plain SVG figure, put the annotation layer in the same `viewBox` and use
the same `preserveAspectRatio` as the host SVG. Host apps can supply anchors
directly, or use the DOM/SVG utilities when targets already exist in the SVG.

```ts
import { resolveAnnotationLayout, renderAnnotationsSvg } from '@ponchia/annotations';
import { annotationFrameFromSvg } from '@ponchia/annotations/dom';

const frame = annotationFrameFromSvg(hostSvg, { padding: 24 });
const layout = resolveAnnotationLayout({
  annotations: [{
    id: 'threshold-note',
    anchor: { type: 'box', box: { x: 140, y: 120, width: 180, height: 64 } },
    note: { title: 'Threshold band' },
    subject: { geometry: { type: 'band', width: 180, height: 64 } }
  }],
  bounds: frame.bounds
});

overlay.innerHTML = renderAnnotationsSvg(layout, {
  preserveAspectRatio: frame.preserveAspectRatio
});
```

## DOM And Reports

Use `prepareDomAnnotations` when annotations target rendered DOM boxes or report
regions. The adapter measures `getBoundingClientRect()` relative to a
coordinate-space element.

```ts
import { prepareDomAnnotations } from '@ponchia/annotations/dom';

const surface = document.querySelector('[data-report-surface]')!;
const prepared = prepareDomAnnotations(surface, [
  {
    id: 'risk-note',
    selector: '[data-region="risk"]',
    coordinateSpace: surface,
    note: { title: 'Risk region' }
  },
  {
    id: 'manual-report-note',
    selector: '[data-region="evidence"]',
    coordinateSpace: surface,
    note: { title: 'Evidence' },
    placement: { manual: { x: 460, y: 72, side: 'left' } }
  }
], {
  obstacles: [{ selector: '[data-region]', coordinateSpace: surface, inflate: 4 }]
});
```

## React

`AnnotationLayer` runs the same layout engine and adds DOM note measurement,
custom note rendering, edit handles, and SSR-safe effects. Keep annotation data
in host state; the package emits edit suggestions but does not persist them.

```tsx
import { useState } from 'react';
import { applyAnnotationEdits, type Annotation } from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';

export function AnnotatedSurface({ initial }: { initial: Annotation[] }) {
  const [annotations, setAnnotations] = useState(initial);

  return (
    <AnnotationLayer
      annotations={annotations}
      bounds={{ x: 0, y: 0, width: 640, height: 360 }}
      obstacles={[{ x: 260, y: 80, width: 120, height: 80 }]}
      measure="dom"
      noteTabIndex={0}
      editable={{ includeAnchor: true }}
      onEditEnd={(event) => {
        setAnnotations((current) => applyAnnotationEdits(current, event));
      }}
    />
  );
}
```

## Vega And Vega-Lite

For Vega, prefer scenegraph anchors after the view has run, because they reflect
generated marks, scales, padding, and layout. Vega-Lite consumers compile or
render through public Vega-Lite/Vega APIs first, then pass the resulting Vega
View or rendered SVG to this adapter.

```ts
import { assertAnchorValidationReport } from '@ponchia/annotations';
import { prepareVegaScenegraphAnnotations } from '@ponchia/annotations/vega';

const prepared = prepareVegaScenegraphAnnotations(view, [
  {
    id: 'peak-note',
    markName: 'points',
    datum: (datum) => datum?.id === 'peak',
    note: { title: 'Generated Vega mark' },
    placement: { side: ['right', 'top'] }
  },
  {
    id: 'manual-bar-note',
    markName: 'bars',
    datum: (datum) => datum?.id === 'target-bar',
    note: { title: 'Manual callout' },
    placement: { manual: { x: 420, y: 52, side: 'left' } }
  }
], {
  obstacles: { padding: 4 }
});

assertAnchorValidationReport(prepared.validation, { label: 'Vega anchors' });
```

Use `prepareVegaSvgAnnotations` when the host only has exported/rendered SVG.
Match marks through selectors or public Vega SVG metadata such as mark name,
mark type, and role. Metadata-matched anchors measure the concrete child mark
when the wrapper contains exactly one mark element; use a selector or scenegraph
datum predicate for multi-mark layers.

## Mermaid

Mermaid annotations run after Mermaid renders SVG. Target stable rendered
labels, generated node or edge ids, clusters, classes, data attributes, or
explicit selectors. For rendered edge callouts, use `edgeId` when Mermaid's
generated edge id is stable; otherwise use `edgeSourceId` and `edgeTargetId` to
match the rendered edge by connected node ids. The adapter does not parse
Mermaid source.

```ts
import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';

const svg = document.querySelector('#diagram svg')!;
const prepared = prepareMermaidAnnotations(svg, [
  {
    id: 'api-note',
    label: 'API',
    coordinateSpace: svg,
    note: { title: 'Mermaid node' },
    placement: { side: ['right', 'bottom'] }
  },
  {
    id: 'manual-edge-note',
    edgeSourceId: 'api',
    edgeTargetId: 'report',
    kind: 'path',
    coordinateSpace: svg,
    note: { title: 'Important edge' },
    placement: { manual: { x: 360, y: 120, side: 'left' } }
  }
], {
  obstacles: { coordinateSpace: svg, inflate: 4 }
});
```

If labels are translated or user-authored, prefer node ids, edge ids, classes,
or data attributes over label text.

## D2

D2 has two good integration paths. Use compiled diagram geometry when the host
has access to the D2 compile result; use rendered SVG extraction when only the
SVG is available. The adapter does not parse D2 source or execute D2.

```ts
import { prepareD2DiagramAnnotations } from '@ponchia/annotations/d2';

const prepared = prepareD2DiagramAnnotations(compiledDiagram, [
  {
    id: 'process-note',
    shapeId: 'process',
    note: { title: 'Compiled D2 shape' },
    placement: { side: ['right', 'top'] }
  },
  {
    id: 'manual-route-note',
    connectionId: 'api-report',
    note: { title: 'Routed connection' },
    placement: { manual: { x: 420, y: 148, side: 'left' } }
  }
], {
  obstacles: { includeConnections: true, padding: 4 }
});
```

For SVG-only D2 output, use `prepareD2SvgAnnotations` with selectors,
`shapeId`, `connectionId`, classes, labels, or `data-*` hooks. Include
connection obstacles when route labels or edge paths should affect placement.
For route callouts, set `kind: 'path'` on a `connectionId` spec; when D2 wraps a
route in a group, the adapter uses the child route `<path>` for the anchor.

## React Flow

React Flow annotations should read public node, handle, edge, and viewport
state from the host. The adapter maps graph coordinates through the viewport and
uses measured handles when the host exposes them. Default edge anchors use
measured `sourceHandle` and `targetHandle` centers when they are available;
provide `edgePoints` when the host wants annotations to follow a custom routed
edge path.

```ts
import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';

const prepared = prepareReactFlowAnnotations({
  nodes,
  edges,
  viewport
}, [
  {
    id: 'review-node-note',
    nodeId: 'review',
    note: { title: 'React Flow node' },
    placement: { side: ['right', 'bottom'] }
  },
  {
    id: 'manual-handle-note',
    handle: { nodeId: 'review', id: 'approved', type: 'source', side: 'bottom' },
    note: { title: 'Approved path' },
    placement: { manual: { x: 380, y: 184, side: 'left' } }
  }
], {
  obstacles: { includeEdges: true, padding: 4 }
});
```

Handle specs can fall back to the requested node side before React Flow has
measured handle bounds. Treat fallback diagnostics as warnings during initial
render and rerun after the graph has measured.

## First-Use Checklist

- Use public package imports only.
- Align overlay `viewBox` and `preserveAspectRatio` with the host SVG or graph
  coordinate space.
- Validate generated targets before layout.
- Use `assertAnchorValidationReport` or `formatAnchorValidationReport` to turn
  adapter diagnostics into host-app errors or user-visible messages.
- Pass host marks, nodes, regions, axes, shapes, and edges as obstacles when
  notes should avoid them.
- Use automatic placement first; add `placement.manual` only for editorial
  callouts that must stay in a specific position.
- Persist annotations and manual coordinates in host state, not in this package.
- Run `resolvePreparedAnnotationLayout` with `assertValidation`,
  `assertTargetAlignment`, and `assertQuality`, or run
  `evaluateAnnotationLayout` directly, in tests or report builds for important
  output.
