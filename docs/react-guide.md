# React rendering and editing

[Documentation index](README.md) · [First annotation](getting-started.md)

Render annotation layers in React and integrate optional measurements and
editing while your application owns state.

<a id="react"></a>

## Start with an editable figure

Copy this component into an existing React app. Its chart and annotation layer
share one coordinate system. Move the note with its handle or focus the handle
and use the arrow keys; **Undo last move** restores the last accepted position.
Try Shift+Up from the initial position: it would cover the protected chart
card, so the host rejects the move and announces why.

The same `resolve` function supplies geometry for both rendering and edit
validation. No persistence API or additional editor package is required.

```tsx
import { useMemo, useState } from 'react';
import {
  applyAnnotationEdits,
  evaluateAnnotationLayout,
  resolveAnnotationLayout,
  type Annotation
} from '@ponchia/annotations';
import { AnnotationLayer } from '@ponchia/annotations/react';
import '@ponchia/annotations/bronto.css';

const bounds = { x: 0, y: 0, width: 560, height: 320 };
const protectedContent = { x: 120, y: 60, width: 125, height: 98 };
const initialAnnotations: Annotation[] = [{
  id: 'peak',
  anchor: { type: 'point', point: { x: 90, y: 135 } },
  note: { title: 'Peak response', body: 'Drag the handle.' },
  placement: { manual: { x: 40, y: 200 } }
}];
function resolve(annotations: Annotation[]) {
  return resolveAnnotationLayout({
    annotations, bounds, padding: 12,
    obstacles: [protectedContent],
    noteSizes: { peak: { width: 150, height: 60 } }
  });
}

export function FigureAnnotations() {
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [previous, setPrevious] = useState<Annotation[] | null>(null);
  const [notice, setNotice] = useState('Drag the note handle or use its arrow keys.');
  const layout = useMemo(() => resolve(annotations), [annotations]);

  return (
    <section aria-label="Editable figure" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div role="region" aria-label="Figure surface" tabIndex={0} style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: 560, height: 320 }}>
          <svg viewBox="0 0 560 320" role="img" aria-label="Chart with protected content">
            <rect {...protectedContent} fill="#e7edeb" />
            <text x="132" y="88" fontSize="16">Chart data</text>
            <circle cx="90" cy="135" r="4" fill="#287c71" />
          </svg>
          <AnnotationLayer
            layout={layout}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            label="Figure callouts"
            markerIdPrefix="editable-figure"
            editable={{ keyboardStep: 10, keyboardLargeStep: 130 }}
            editHandleTabIndex={0}
            previewEdits
            onEditEnd={(event) => {
              const proposed = applyAnnotationEdits(annotations, event, { missing: 'throw' });
              const candidate = resolve(proposed);
              if (!evaluateAnnotationLayout(candidate).ok) {
                setNotice('Move rejected: keep the note inside the figure and clear of chart content.');
                return;
              }
              setPrevious(annotations);
              setAnnotations(proposed);
              setNotice('Move saved. Undo is available.');
            }}
          />
        </div>
      </div>
      <button type="button" style={{ minHeight: 44, padding: '8px 12px' }} disabled={!previous} onClick={() => {
        if (!previous) return;
        setAnnotations(previous);
        setPrevious(null);
        setNotice('Previous move restored.');
      }}>Undo last move</button>
      <p role="status">{notice}</p>
    </section>
  );
}
```

This example keeps the figure at its native width in a horizontal scroller so
its text remains readable on a narrow screen. The fixed note size suits these
short strings. For different text, fonts, or host geometry, update the sizing
inputs or use the measured-note guidance below. The one-step undo stores only
accepted annotation inputs; previews and rejected moves never replace it.
Your application can extend that policy to its existing history and storage.

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
the host surface. Set `previewEdits` to show the selected note/anchor moving during
pointer gestures without recomputing the full annotation layout. It is opt-in,
keeps other notes and layout-quality diagnostics stable, and uses a direct
connector preview until the host commits with `onEditEnd`. In browsers,
rapid pointer movements are coalesced into the latest visual preview per
animation frame, while every `onEdit` movement suggestion is delivered
immediately. Pointer release, cancellation, or unmount drops any pending
visual frame so a stale preview cannot reappear after the gesture ends.
The host remains responsible for persisting the final `onEditEnd` suggestion.

## DOM-measured note identities

Annotation IDs are unique, opaque strings. DOM measurement uses the same IDs as
layout and editing, including reserved-looking names such as `__proto__` and
`constructor`, or an empty string. Resize notifications update only the changed
notes; removing or hiding a measured note discards its old measurement.

Use stable IDs for the lifetime of a note. Replacing the annotation collection
reconciles the full visible measurement set, while disconnected observers cannot
write measurements back into a newer collection. This does not change the
host-controlled `layout` mode, where the host supplies final note dimensions.

## Validate edits before committing

The first example checks the proposed layout before changing authored state.
A drag preview can temporarily cover protected chart/diagram content;
`previewEdits` does not certify layout quality. `assertQuality` is a throwing
development assertion, **not** an interactive edit admission policy. Use it
for diagnostics after defining how the host handles rejected edits, rather
than applying every patch and throwing on the next render.

Before changing authored state, resolve the *proposed* annotations with the
same geometry inputs as the renderer, check `evaluateAnnotationLayout`, and
either accept the patch or keep the previous state. For example, inside a
host-owned edit handler:

```tsx
const proposed = applyAnnotationEdits(annotations, event, { missing: 'throw' });
const candidate = resolveAnnotationLayout({
  annotations: proposed,
  bounds,
  obstacles,
  noteSizes: effectiveNoteSizes
});
const quality = evaluateAnnotationLayout(candidate);
if (!quality.ok) {
  setEditNotice('Move rejected: the note would obscure protected content.');
  return;
}
setEditNotice(null);
setAnnotations(proposed);
```

The host determines `effectiveNoteSizes`. In `measure="dom"` mode, use the
latest `onLayout` result's note-box dimensions instead of relying on estimated
character widths. In render-only mode, validate from the same source options
used by the host-owned solver. Expose rejection feedback in a live region
(e.g. `role="status"`), so keyboard and touch users know the drop was not
committed. A rejected edit is not an application error and should not corrupt
undo/redo history.

Both runnable [React](../examples/react-basic/README.md) and
[React Flow](../examples/react-flow-basic/README.md) examples demonstrate this
host boundary through a private shared edit validator, without expanding the
published package API.

## Render a host-owned layout

When the host resolves its own layout, pass exactly that result:

```tsx
<AnnotationLayer
  layout={layout}
  markerIdPrefix="host-owned-annotations"
/>
```

The first example uses this mode for editing too: enable `editable` and
`previewEdits`, then validate and commit through `onEditEnd`. The host owns
persistence and undo. The renderer derives annotations, note sizes and bounds
from this result. It
never solves or self-measures in this mode. Do not also pass `annotations`,
`bounds`, `placement`, `noteSizes`, `refinement`, `diagnostics`, or `measure`.
TypeScript and runtime validation reject such mixed modes, and the removed
`resolvedLayout` prop reports a migration error.

Treat resolved layouts and React presentation props as immutable; replace
objects when changing them. This removes the old dual-source snapshot and
comparison machinery rather than promising detection of mutated React props.

The other mode accepts `annotations` and `bounds`, including optional
`measure="dom"`, and owns its own resolution. See the
[0.7 migration guide](migration-0.7.md) for both forms. Externally resolved debug
rendering uses only diagnostics already requested by the host; it never triggers
an extra solve. Layout winners do not contain alternative candidate graphs.

Custom SVG or canvas-overlay authoring tools can use the same DOM-free edit
math without React:

```ts
import {
  annotationEditHandles,
  applyAnnotationEdits,
  createAnnotationEditSession,
  previewAnnotationEdit,
  resolveAnnotationLayout
} from '@ponchia/annotations';

const layout = resolveAnnotationLayout({ annotations, bounds, noteSizes });
const handle = annotationEditHandles(layout, { includeAnchor: true })[0]!;
const edit = createAnnotationEditSession({
  layout,
  handle,
});
const moving = edit.move({ x: edit.origin.x + 8, y: edit.origin.y + 6 });
const provisional = previewAnnotationEdit(edit.annotation, moving, layout.placementBounds);
// Draw provisional.noteBox / provisional.connector while dragging;
// only commit persisted annotation state at the end of the gesture.
const event = edit.end({ x: edit.origin.x + 12, y: edit.origin.y + 8 });
const nextAnnotations = applyAnnotationEdits(annotations, event);
```

`createAnnotationEditSession` wraps start/move/end drag events and delta-based
keyboard nudges for one handle. `createAnnotationEditEvent` accepts
start/current coordinates directly, and `createAnnotationEditDelta` is the
lower-level keyboard or nudge variant when the host already has a delta. All
helpers emit the same commit-ready suggestion shape as the React adapter and
still leave persistence to the host app. `previewAnnotationEdit` is an
experimental, constant-sized visual projection of one edited note/anchor; its
existing candidate scores/quality evidence are intentionally *not* revalidated.
Commit via the host's normal edit patch and recompute the authoritative layout
at the end of a gesture, rather than persisting a provisional resolved item.

### Experimental incremental committed layouts

A custom headless/React host resolving many annotations can reuse unchanged
priority-ordered placements when later annotations change, or when annotations
are appended/removed after an unchanged higher-priority prefix. This is an
opt-in optimization for *committed* edits, complementary to the immediate
`previewAnnotationEdit` drag preview:

```ts
import {
  applyAnnotationEdits,
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout
} from '@ponchia/annotations';

const options = { annotations, bounds, noteSizes, obstacles, refinement: false };
const session = createIncrementalAnnotationLayoutSession(options);

// On an edit commit, the host owns the changed annotation collection.
const changed = applyAnnotationEdits(annotations, event);
const authoritative = session.update({ ...options, annotations: changed });
const quality = evaluateAnnotationLayout(authoritative);
```

The experimental resolver returns identical geometry and quality to a fresh
`resolveAnnotationLayout` call: candidate scoring and connector routing are
recomputed from the first changed annotation forward. Stable earlier winners
retain their object identities for efficient React reconciliation. No-op updates
return the previous layout object.

It recomputes from the first changed priority-ordered note for insertions,
deletions and changed anchors, preserving the prior prefix. Changed obstacles
also allow conservative prefix reuse **only** where an annotation has an
explicitly unrouted connector (or an intrinsic `curve`/`none` connector) and
the changed boxes cannot touch any of its possible placement or connector
candidates. It examines candidates beyond those retained by diagnostic collection.
Routing-aware connectors, changed bounds/global placement, and iterative
refinement continue to trigger full recalculation when the change could affect
previous winners. Iterative refinement uses the full resolver because later
candidates may change earlier winners. Inputs are snapshotted by value so an in-place change to a
note, anchor or effective size is detected; avoid mutating resolved layout
objects returned by the session. Neither API schedules background work or
manages host state, pointer updates, persistence or worker threads. For a live
drag, use the lightweight visual preview and update the session at commit. For
dense changes that still require a full solver pass, see the
[host-owned Web Worker integration recipe](worker-layout.md): a real
Chromium/React test demonstrates off-main-thread resolution, stale-response
handling and cancellation without adding a Worker dependency to the package.
