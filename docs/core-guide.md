# Core layout and geometry

[Documentation index](README.md) · [First annotation](getting-started.md)

Resolve note placement from host geometry, preserve editorial positions,
and inspect collision and bounds diagnostics.

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

Use `evaluateAnnotationLayout` in tests, report generation, or CI to measure
geometric problems such as overlap and bounds overflow. A good score is not
proof of readability, accessibility, or usability; inspect representative output
as well. Use `assertAnnotationLayoutQuality` for a
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

## Keep ordinary integrations small

Start with a few explanatory notes, measured text sizes, and the default
synchronous resolver. When the host does not need every debugging candidate,
set `placement: { maxCandidates: 8 }`. The resolver can avoid expensive routing
for candidates provably outside that exact retained ranking. It does not turn
this setting into an approximate search or a guaranteed time budget.

Full diagnostic retention remains the default. Iterative refinement works with
the retained candidate frontier, so changing that frontier can change a refined
layout. See [performance](performance.md) and the reproducible
[quality corpus](placement-quality.md) before tuning a dense authoring surface.

Measure note text and verify `evaluateAnnotationLayout` before introducing a
Worker. When content cannot fit, let the host choose fewer simultaneously
visible explanations, a separate note list, or a larger surface; do not mistake
a completed solve for a readable layout.
