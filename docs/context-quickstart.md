# Context Quickstart

New to the package? Start with [your first annotation](getting-started.md) for
a complete runnable example. This page helps choose the host-specific path.

Pick a path for [SVG](#first-note-on-a-figure), [DOM report](#first-note-on-a-report),
or [React Flow](#first-note-on-a-graph). Get one note on screen before adding
diagnostics, editing, or a Worker. All snippets use public package imports.
These guides track `main`; use the [version and install choices](getting-started.md#choose-your-version)
to match the package you are testing.
Run demo commands from the repository root after the
[example setup](getting-started.md#try-the-existing-examples).

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

## First note on a figure

For an **existing SVG chart**, measure a real rendered mark rather than copying
pixel coordinates into the annotation model. Give a chart mark the ID
`peak-mark`, and place an empty overlay beside the chart SVG inside the same
positioned container:

```html
<div class="chart-with-notes">
  <svg id="sales-chart" viewBox="0 0 600 320" aria-label="Sales chart">
    <!-- Your chart's existing marks; for example: -->
    <rect id="peak-mark" x="350" y="100" width="20" height="80" />
  </svg>
  <div id="chart-notes"></div>
</div>
```

```css
.chart-with-notes { position: relative; aspect-ratio: 600 / 320; }
.chart-with-notes > svg,
.chart-with-notes > #chart-notes { position: absolute; inset: 0; width: 100%; height: 100%; }
#chart-notes { pointer-events: none; }
```

Call this browser module **after the chart has rendered**:

```ts
import { renderAnnotationsSvg, resolveAnnotationLayout } from '@ponchia/annotations';
import { annotationFrameFromSvg, boxFromSvgElement } from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';

export function annotateExistingSvg(svg: SVGSVGElement, overlay: HTMLElement) {
  const mark = svg.querySelector<SVGGraphicsElement>('#peak-mark');
  if (!mark) throw new Error('SVG target #peak-mark not found');

  const box = boxFromSvgElement(mark, svg);
  if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite)) {
    throw new Error('SVG target #peak-mark has no valid geometry');
  }

  const frame = annotationFrameFromSvg(svg);
  const layout = resolveAnnotationLayout({
    annotations: [{
      id: 'peak',
      anchor: { type: 'box', box },
      note: { title: 'Peak response' }
    }],
    bounds: frame.bounds,
    padding: 16
  });

  overlay.innerHTML = renderAnnotationsSvg(layout, {
    title: 'Chart annotations',
    preserveAspectRatio: frame.preserveAspectRatio,
    markerIdPrefix: 'existing-chart-notes'
  });
  return layout;
}
```

```ts
annotateExistingSvg(
  document.querySelector<SVGSVGElement>('#sales-chart')!,
  document.querySelector<HTMLElement>('#chart-notes')!
);
```

The SVG and overlay now use the same `viewBox`, aspect-ratio policy and
geometry from `getBBox()`. The library does not need the chart's data or
rendering framework. Re-run the function after the chart changes its marks or
`viewBox`; a CSS-only resize preserving the same `viewBox` needs no re-solve.
For real charts, keep the overlay outside any transformed SVG group and ensure
the target is rendered and measurable; missing targets or invalid measurements
are explicit errors instead of silently placing at the origin.

Try the full [SVG example](../examples/svg-basic/) with
`npm run example -- examples/svg-basic` for several notes and diagnostics.
If you already have trusted host-supplied coordinates, the smaller
[point-only example](getting-started.md#use-it-in-a-browser-application)
does not require the DOM adapter.

## First note on a report

Run `npm run example -- examples/dom-basic` for a complete measured report.
For your own report, give a positioned surface a target and an overlay. This
small fixture reserves room for one note:

```html
<section id="report" style="position:relative;width:420px;height:260px">
  <article id="metric-card"
    style="position:absolute;left:64px;top:96px;width:90px;height:44px">
    42 requests
  </article>
  <div id="report-notes"
    style="position:absolute;inset:0;pointer-events:none"></div>
</section>
```

In your browser module:

```ts
import {
  renderAnnotationsSvg,
  resolvePreparedAnnotationLayout
} from '@ponchia/annotations';
import { prepareDomAnnotations } from '@ponchia/annotations/dom';
import '@ponchia/annotations/bronto.css';

export function annotateReport(surface: HTMLElement, overlay: HTMLElement) {
  const prepared = prepareDomAnnotations(surface, [{
    id: 'report-metric',
    selector: '#metric-card',
    coordinateSpace: surface,
    note: { title: 'Measured metric' }
  }], { assert: { label: 'Report targets' } });

  const resolved = resolvePreparedAnnotationLayout(prepared, {
    bounds: {
      x: 0, y: 0, width: surface.clientWidth, height: surface.clientHeight
    },
    padding: 16
  });
  overlay.innerHTML = renderAnnotationsSvg(resolved.layout, {
    title: 'Report annotations',
    markerIdPrefix: 'report-notes'
  });
  return resolved;
}
```

After the report is rendered and its fonts are ready, call
`annotateReport(document.querySelector<HTMLElement>('#report')!,
document.querySelector<HTMLElement>('#report-notes')!)`.
You should see **Measured metric** connected to the card. Inspect the returned
`validationSummary` and `qualitySummary` if a target is missing or a note does
not fit. Missing selectors throw instead of silently placing at the origin.

The target, bounds, and overlay use coordinates relative to the same surface.
Rerun the function after the report changes size or content; observe the surface
with a host-owned `ResizeObserver` when needed. Use the
[DOM adapter guide](adapter-guide.md#dom-and-svg-utilities) for transformed SVG
and other coordinate spaces. This 420 × 260 fixture is a coordinate example;
your report owns responsive sizing and enough room for its notes.

## First note on a graph

Run `npm run example -- examples/react-flow-basic` to see the complete host.
In an existing React Flow app, start by annotating one node:

```tsx
import { AnnotationLayer } from '@ponchia/annotations/react';
import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';
import { useNodes, useViewport } from '@xyflow/react';
import '@ponchia/annotations/bronto.css';

export function FlowNotes({ width, height }: {
  width: number;
  height: number;
}) {
  const nodes = useNodes();
  const viewport = useViewport();
  const review = nodes.find((node) => node.id === 'review');
  if (!(review?.measured?.width && review.measured.height)) return null;

  const prepared = prepareReactFlowAnnotations({ nodes, viewport }, [{
    id: 'review-note',
    nodeId: 'review',
    note: { title: 'Review this step' }
  }], { assert: { label: 'Flow targets' } });

  return (
    <AnnotationLayer
      annotations={prepared.annotations}
      obstacles={prepared.obstacles}
      bounds={{ x: 0, y: 0, width, height }}
      label="Graph annotations"
      markerIdPrefix="flow-notes"
    />
  );
}
```

Mount `<FlowNotes width={640} height={420} />` as a child of your existing
`<ReactFlow>` component, in a positioned overlay at the top-left of the graph
container. Give that overlay
`position: absolute; inset: 0; pointer-events: none`.
Use the actual container dimensions for `width` and `height`. Its provider
supplies the hooks; React Flow still owns node rendering, graph layout, and
pan/zoom state.

You should see **Review this step** beside the node whose ID is `review`.
The component waits for that node's measured dimensions. The adapter applies
the viewport transform, so keep this overlay outside React Flow's transformed
node group; applying the transform again shifts the notes. Add edge or handle
anchors and editing only after this works. The
[full React Flow example](../examples/react-flow-basic/) includes container
measurement, edge geometry, handle geometry, and host-owned edits.

## Add diagnostics when the first note works

DOM and generated-surface adapters return
`{ annotations, obstacles, validation }`.
`resolvePreparedAnnotationLayout` combines that geometry with your bounds and
returns the layout plus validation and quality summaries. React apps
can pass prepared annotations and obstacles directly to `AnnotationLayer`.

For a larger generated surface, add shared placement defaults and assertions.
Target-alignment checks need independently expected geometry from your host;
they are optional verification, not a requirement for displaying the first note.
The following extends an existing `prepared`, `bounds`, and `overlay`:

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
Pass its result to `AnnotationLayer.layout` to avoid a second solve.
This render-only path takes no duplicate solver or measurement props. The
host resolves note sizes before passing its layout. See the
[interactive incremental React example](../examples/react-incremental/) for
working source and browser behavior. Its live JSON inspector shows the exact
host-authored annotation inputs after committed edits. The example now also
lets you paste those inputs back into the editor, with guarded parsing and a
new authoritative host layout session. Invalid JSON leaves the current layout
untouched. Its deliberately small importer accepts point/box anchors, note
text and basic placement options for at most ten notes. A small **Edit annotation
text** form lets visitors modify a selected note without hand-editing JSON.
Click or keyboard-focus a visible note in the example to select it in that
form, or choose a note from the selector. Selecting does not enter layout
history, change placement, or require any new package API.
The form keeps draft text separate from the committed layout; Apply creates a
single undoable transaction and preserves the same JSON import limits. It is
**not** a general package serialization or form API: validate the complete
schema your application supports and own any actual persistence.

The demo also keeps a bounded, host-owned **undo/redo history of committed
annotation inputs** from drags, button actions, resets and valid JSON imports.
The resolved layout, pointer-move previews and candidate diagnostics are not
stored as history entries. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work outside form
fields; editing the JSON textarea preserves the browser's native text undo.
This is an application-level example, not a package history or persistence API.

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
