# React rendering and editing

[Documentation index](README.md) · [First annotation](getting-started.md)

Render annotation layers in React and integrate optional measurements and
editing while your application owns state.

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
      previewEdits
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
the host surface. Set `previewEdits` to show the selected note/anchor moving during
pointer gestures without recomputing the full annotation layout. It is opt-in,
keeps other notes and layout-quality diagnostics stable, and uses a direct
connector preview until the host commits with `onEditEnd`. In browsers,
rapid pointer movements are coalesced into the latest visual preview per
animation frame, while every `onEdit` movement suggestion is delivered
immediately. Pointer release, cancellation, or unmount drops any pending
visual frame so a stale preview cannot reappear after the gesture ends.
The host remains responsible for persisting the final `onEditEnd` suggestion.

## Validate edits before committing

The first example above shows the minimal *single-note* edit path. When a host
has protected chart/diagram content, an edit can be visually previewed over
that content. `previewEdits` does not certify layout quality, and
`assertQuality` is a throwing development assertion, **not** an interactive
edit admission policy. Applying every patch blindly can therefore crash a
host's next render.

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
  previewEdits
  editable={{ includeAnchor: true }}
  onEditEnd={(edit) => {
    const next = applyAnnotationEdits(annotations, edit);
    setAnnotations(next);
    setLayout(layoutSession.update({ annotations: next, bounds, noteSizes }));
  }}
/>
```

`layoutSession` is a host-owned incremental session; `layout` state starts from
its layout and updates on accepted commits. The host owns persistence and undo.
The renderer derives annotations, note sizes and bounds from this result. It
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
