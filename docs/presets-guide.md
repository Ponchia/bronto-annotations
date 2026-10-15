# Presets and d3-style migration

[Documentation index](README.md) · [First annotation](getting-started.md)

Choose callout types and migrate d3-style input without importing a D3
runtime into the headless core.

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

For teams used to Susie Lu's d3-annotation `x`/`y` plus `dx`/`dy` authoring
model, the root package includes a DOM-free conversion helper. It does not import D3,
mutate selections, or own chart scales; it only maps familiar annotation data
into this package's `Annotation` model.

```ts
import {
  renderAnnotationsSvg,
  resolveAnnotationLayout
} from '@ponchia/annotations';
import {
  annotationsFromD3Style
} from '@ponchia/annotations/d3';

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
import {
  applyD3StyleAnnotationEdit
} from '@ponchia/annotations/d3';

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
} from '@ponchia/annotations/d3';

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

`docs/d3-annotation-parity.json` tracks the supported surface inspired by Susie
Lu's `d3-svg-annotation@2.5.1`: type aliases, familiar
note/subject/connector fields, custom d3-style conversion helpers, datum
accessors, inverse edit mapping, and explicit non-goals. `npm run
test:d3-parity` proves those helpers still work and that the root package does
not export the D3 selection adapter, D3 type base, or D3 runtime custom type
component.
Use `docs/migration-guide.md` for a practical d3-annotation mapping table,
editable round-trip notes, and runtime differences.
