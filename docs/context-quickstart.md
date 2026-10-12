# Context Quickstart

Use this page when choosing the first integration path. Every example below
uses public package imports and keeps host rendering, state, persistence, and
layout ownership outside this package.

## Choose The Adapter

| Context | Import | Anchor source | Best first helper |
| --- | --- | --- | --- |
| Static SVG figure | `@ponchia/annotations` | Host-supplied viewBox points, boxes, or paths | `resolveAnnotationLayout` |
| React SVG or report layer | `@ponchia/annotations/react` | Annotation data in React state | `AnnotationLayer` |
| DOM or report regions | `@ponchia/annotations/dom` | Measured DOM/SVG elements or selectors | `prepareDomAnnotations` |
| Vega chart | `@ponchia/annotations/vega` | Vega View data, scales, scenegraph, or rendered SVG marks | `prepareVegaScenegraphAnnotations` |
| Vega-Lite chart | `@ponchia/annotations/vega` | Compiled/rendered Vega View or exported SVG | `prepareVegaScenegraphAnnotations` |
| Mermaid diagram | `@ponchia/annotations/mermaid` | Rendered Mermaid SVG labels, ids, classes, edges, clusters, or selectors | `prepareMermaidAnnotations` |
| D2 diagram | `@ponchia/annotations/d2` | Compiled D2 shape/connection geometry or rendered SVG | `prepareD2DiagramAnnotations` |
| React Flow graph | `@ponchia/annotations/react-flow` | Public node, handle, edge, and viewport state | `prepareReactFlowAnnotations` |
| Bronto-styled output | `@ponchia/annotations/bronto.css` | CSS classes emitted by SVG/React renderers or legacy `ui-annotation*` SVG | CSS import only |

## Shared Layout Shape

Most integrations end with the same layout call:

```ts
import {
  generatedSurfaceLayoutDefaults,
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const expectedTargets = [{ id: 'peak', box: { x: 120, y: 48, width: 40, height: 32 } }];
const resolved = resolvePreparedAnnotationLayout(prepared, {
  ...generatedSurfaceLayoutDefaults({
    anchorLabel: 'Generated anchors',
    includeInfo: true,
    layoutLabel: 'Surface annotations'
  }),
  bounds,
  padding: 16,
  targetAlignmentTargets: expectedTargets,
  assertTargetAlignment: {
    label: 'Generated target alignment',
    failOnWarnings: true
  },
  targetAlignmentFormat: {
    label: 'Generated target alignment',
    includeAligned: true
  }
});

// assertAnchorValidationReport(prepared.validation, { label: 'Generated anchors' });
// Or pass { assert: { label: 'Generated anchors' } } to prepare*Annotations.
const layout = resolved.layout;
const validationSummary = resolved.validationSummary;
const targetAlignmentSummary = resolved.targetAlignmentSummary;
const quality = resolved.quality;

overlay.innerHTML = renderAnnotationsSvg(layout, {
  title: 'Annotations',
  markerIdPrefix: 'surface-annotations',
  preserveAspectRatio: 'xMidYMid meet'
});
```

`prepared` comes from a DOM or generated-surface adapter. For static SVG data,
pass `annotations` and `obstacles` directly.

## Manual Placement

Use automatic placement first. Add manual placement only when the note position
is editorially important:

```ts
const annotation = {
  id: 'manual-note',
  anchor,
  note: { title: 'Manual note' },
  placement: {
    manual: { x: 420, y: 72, side: 'left' }
  }
};
```

Manual coordinates are in the same coordinate system as `bounds` and the
annotation overlay. They still get normal connector geometry, quality checks,
SVG output, React output, Bronto classes, and edit events.

## Editing Annotations In React

For ordinary React output, begin with `AnnotationLayer`. If notes should be
edited interactively, enable `previewEdits` so pointer movements display a
provisional note and connector without resolving the entire layout each time.
The host still receives edit callbacks and chooses when to persist a patch.
Use `onEditEnd` for persistence; `onEdit` also fires for transient pointer
movement. A canceled drag (including pointer-capture loss, a host layout
replacement, or disabling editing) does **not** produce an edit-completion
callback, so a host should not persist an incomplete gesture.

For committed edits on denser surfaces, an experimental
`createIncrementalAnnotationLayoutSession` can reuse unchanged placements.
Pass its result to `AnnotationLayer.resolvedLayout` to avoid a second solve.
This controlled path needs **host-owned note sizes**; it cannot use the
component's `measure="dom"` mode. See the
[interactive incremental React example](../examples/react-incremental/) for
working source and browser behavior.

If global geometry changes are too expensive on the main thread, try the
[React + module Worker example](../examples/react-worker/). The host is
responsible for request revisions, cancellation, Worker lifetime and accepted
commits. Ignoring a stale result does not interrupt the Worker calculation.
See [off-main-thread guidance](worker-layout.md) before copying this pattern.

## Generated Surfaces

Generated chart and diagram adapters should run after the host has produced
measurable output.

```ts
import { prepareVegaScenegraphAnnotations } from '@ponchia/annotations/vega';

const prepared = prepareVegaScenegraphAnnotations(view, [{
  id: 'peak',
  markName: 'points',
  datum: (datum) => datum?.id === 'peak',
  note: { title: 'Generated mark' }
}], {
  obstacles: { padding: 4 }
});
```

```ts
import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';

const prepared = prepareMermaidAnnotations(svg, [{
  id: 'api',
  label: 'API',
  coordinateSpace: svg,
  note: { title: 'Rendered Mermaid node' }
}], {
  obstacles: { coordinateSpace: svg, inflate: 4 }
});
```

```ts
import { prepareD2DiagramAnnotations } from '@ponchia/annotations/d2';

const prepared = prepareD2DiagramAnnotations(compiledDiagram, [{
  id: 'process',
  shapeId: 'process',
  note: { title: 'Compiled D2 shape' }
}], {
  obstacles: { includeConnections: true, padding: 4 }
});
```

```ts
import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';

const prepared = prepareReactFlowAnnotations({ nodes, edges, viewport }, [{
  id: 'review',
  nodeId: 'review',
  note: { title: 'React Flow node' }
}], {
  obstacles: { includeEdges: true, padding: 4 }
});
```

## Common Mistakes

- Do not annotate Mermaid or D2 source text directly; annotate rendered SVG or
  compiled geometry.
- Do not use chart pixel coordinates unless they match the annotation overlay
  coordinate system.
- Do not ignore adapter validation reports for user-authored diagrams.
- Do not let annotations own chart scales, graph layout, app state, or
  persistence.
- Do not rely on manual placement for every note; it prevents automatic
  collision handling from doing useful work.
