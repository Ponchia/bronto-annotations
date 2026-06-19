# Migration Guide

This guide is for consumers moving existing annotation work into
`@ponchia/annotations`. It covers two common starting points:

- d3-annotation-style authoring data.
- Bronto UI annotation CSS/helper usage.

The package keeps migration helpers DOM-free. It does not import D3, mutate D3
selections, own chart scales, parse diagram source, or depend on `@ponchia/ui`.

## From d3-annotation

Use the d3-style helpers when existing annotations already use `x`, `y`, `dx`,
`dy`, `note`, `subject`, `connector`, and d3-annotation type names.

```ts
import {
  annotationsFromD3Style,
  renderAnnotationsSvg,
  resolveAnnotationLayout
} from '@ponchia/annotations';
import '@ponchia/annotations/bronto.css';

const annotations = annotationsFromD3Style([
  {
    id: 'peak',
    type: 'annotationCalloutCircle',
    x: 240,
    y: 96,
    dx: 84,
    dy: -44,
    color: '#d12f6a',
    note: { title: 'Peak', label: 'Migrated d3-style callout' },
    subject: { radius: 12, radiusPadding: 4 },
    connector: { end: 'arrow' }
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

overlay.innerHTML = renderAnnotationsSvg(layout, {
  title: 'Migrated annotations'
});
```

For existing code organized around the d3-annotation generator, keep the same
collection-level generator-style configs and convert them without D3:

```ts
import { prepareD3StyleAnnotationCollection } from '@ponchia/annotations';

const prepared = prepareD3StyleAnnotationCollection({
  type: 'annotationCalloutCircle',
  accessors: {
    x: 'period',
    y: (datum) => datum.score
  },
  ids: ['peak'],
  editMode: true,
  notePadding: 6,
  annotations: [
    {
      data: { period: 2, score: 9 },
      dx: 72,
      dy: -28,
      note: { label: 'Generator-style callout' },
      subject: { radius: 10 }
    }
  ]
});

const annotations = prepared.annotations;
```

Use `createD3StyleAnnotationBuilder` when the old code was organized around
chainable generator calls:

```ts
import { createD3StyleAnnotationBuilder } from '@ponchia/annotations';

const builder = createD3StyleAnnotationBuilder()
  .type('annotationCalloutCircle')
  .accessors({ x: 'period', y: (datum) => datum.score })
  .ids(['peak'])
  .editMode(true)
  .notePadding(6)
  .annotations([
    {
      data: { period: 2, score: 9 },
      dx: 72,
      dy: -28,
      note: { label: 'Generator-style callout' },
      subject: { radius: 10 }
    }
  ]);

const annotations = builder.toAnnotations();
```

### d3 Mapping

| d3-annotation concept | Migration path |
| --- | --- |
| `annotationLabel`, `annotationCallout`, `annotationCalloutElbow`, `annotationCalloutCurve`, `annotationCalloutCircle`, `annotationCalloutRect`, `annotationXYThreshold`, `annotationBadge` | Keep the type name and call `annotationFromD3Style` or `annotationsFromD3Style`. |
| Generator `annotations`, `type`, `accessors`, `accessorsInverse`, `ids`, `editMode`, `notePadding`, `textWrap` | Use `prepareD3StyleAnnotationCollection`, `annotationsFromD3StyleCollection`, `createD3StyleAnnotationBuilder`, and `applyD3StyleAnnotationCollectionEdit`. |
| `x`, `y` | Core anchor coordinates. Accessor options can read them from `data`. |
| `dx`, `dy` | Relative note offset semantics in the d3-style helper. |
| `nx`, `ny` | Absolute manual note coordinates. |
| `note.title`, `note.label`, `note.wrap`, `note.align`, `note.orientation`, `note.lineType`, `note.bgPadding`, `note.wrapSplitter` | Mapped into the core `note` model, including note rule lines and wrapping. |
| `subject.radius`, `radiusPadding`, `width`, `height`, `x1`, `x2`, `y1`, `y2`, `points`, `pointRadius`, `padding`, `text` | Mapped into subject shape or structured subject geometry. Negative rect dimensions are normalized. |
| `connector.type`, `connector.end`, `connector.points`, `connector.startOffset`, `connector.endOffset` | Mapped into connector options, including relative waypoints. |
| `disable: ['subject', 'connector', 'note']` | Mapped into hidden subject, disabled connector, or hidden note behavior. |
| `data`, `annotationData` | `data` remains the d3-style datum for accessors and edit round-trips; use `annotationData` for rendered annotation-layer `data-*` attributes. |
| `color`, `style` | `color` maps into per-annotation style variables; `style` carries the richer package style object and overrides color-derived fields. |
| Reusable custom annotation types | Use `defineD3StyleAnnotationType` for DOM-free defaults, base-type conversion, and post-conversion transforms. |
| Drag/edit output | Use React edit events plus `d3StyleAnnotationEditPatch`, `applyD3StyleAnnotationEdit`, or the collection edit helpers. |

Editable React layers can round-trip back to d3-style data:

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

Reusable d3-style custom types can migrate to a pure data converter:

```ts
import { defineD3StyleAnnotationType } from '@ponchia/annotations';

const statusBand = defineD3StyleAnnotationType({
  baseType: 'annotationCalloutRect',
  defaults: {
    dx: 56,
    dy: -32,
    note: { lineType: 'vertical' },
    subject: { width: 88, height: 28, x: -44, y: -14 },
    connector: { type: 'elbow', end: 'arrow' }
  },
  transform: (annotation) => ({
    ...annotation,
    variant: 'band'
  })
});

const annotation = statusBand({
  id: 'status',
  x: 160,
  y: 92,
  note: { label: 'Deployment gate' }
});
```

### d3 Runtime Differences

There is no replacement export for d3-annotation's selection runtime:

- No `annotation()` component.
- No `annotationTypeBase`.
- No D3 runtime `annotationCustomType` component. Use
  `defineD3StyleAnnotationType` for DOM-free custom data conversion.
- No D3 selection mutation, D3 drag behavior, or transition ownership.
- No D3 collection selection joins. Collection helpers only convert and update
  annotation data.

Use the host chart to render marks and scales, convert d3-style annotation data
into core annotations, then render an SVG or React annotation layer over the
same coordinate system.

## From Bronto UI Annotations

Existing static SVG snippets that use legacy `ui-annotation*` classes can keep
those classes and import the CSS bridge:

```ts
import '@ponchia/annotations/bronto.css';
```

The bridge styles legacy selectors such as:

- `.ui-annotation`
- `.ui-annotation__subject`
- `.ui-annotation__connector`
- `.ui-annotation__connector-end`
- `.ui-annotation__note`
- `.ui-annotation__note-line`
- `.ui-annotation__title`
- `.ui-annotation__label`
- `.ui-annotation__badge`

It also carries the legacy tone, variant, and motion modifiers such as
`ui-annotation--warning`, `ui-annotation--bracket`,
`ui-annotation--evidence`, `ui-annotation--draw`, and
`ui-annotation--pulse`.

### Bronto Helper Mapping

| Existing helper or class use | Migration path |
| --- | --- |
| Static `ui-annotation*` SVG | Keep the SVG, import `@ponchia/annotations/bronto.css`, and verify with browser output. |
| New generated annotation SVG | Use `renderAnnotationsSvg`; it emits `pa-annotation*` classes styled by the same CSS bridge. |
| Legacy class string construction | Use `brontoAnnotationClassName` for `ui-annotation*` class recipes or `annotationClassName` for `pa-annotation*`. |
| `annotationParts`, `annotationTransform`, `noteTransform`, `notePlacement` | Import the DOM-free helpers from the root package. |
| Subject path helpers such as circle, rect, threshold, bracket, band, slope, comparison, cluster, timeline, evidence | Import the matching root helpers or use `annotation.subject.geometry` so the SVG/React renderer draws the subject. |
| Connector line, elbow, curve, dot, arrow helpers | Import the matching root helpers or use annotation connector options. |
| Report-specific colors | Use package CSS variables, Bronto token fallbacks, or per-annotation `style` variables. |

```ts
import {
  annotationClassName,
  brontoAnnotationClassName,
  renderAnnotationsSvg,
  resolveAnnotationLayout
} from '@ponchia/annotations';

annotationClassName({ variant: 'badge', tone: 'warning', motion: 'pulse' });
brontoAnnotationClassName({ variant: 'bracket', tone: 'info', motion: 'draw' });

const layout = resolveAnnotationLayout({
  annotations,
  bounds: { x: 0, y: 0, width: 640, height: 360 }
});

renderAnnotationsSvg(layout);
```

### Bronto Runtime Differences

The bridge is styling only. It does not import `@ponchia/ui`, provide a design
system, own report layout, or persist annotation state. New functionality lives
in the annotation package itself: anchors, placement, collision scoring,
connectors, renderers, edit suggestions, generated-surface adapters, diagnostics,
and examples.

## Recommended Migration Order

1. Import `@ponchia/annotations/bronto.css` and verify existing static
   `ui-annotation*` snippets still render correctly.
2. Move helper imports to the root package for deterministic SVG geometry
   helpers.
3. Convert d3-style data with `annotationsFromD3Style` when annotations are
   already described as `x`/`y` plus `dx`/`dy`.
4. Use host adapters for generated surfaces: Vega/Vega-Lite, Mermaid, D2,
   React Flow, or DOM/report regions.
5. Run `evaluateAnnotationLayout` in tests or report builds before shipping
   important annotated output.
6. Keep persistence, app state, chart scales, graph layout, routing, and
   workflow behavior in the host app.
