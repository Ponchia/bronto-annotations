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

**Experimental host-resolved React layouts.** If the host uses
`createIncrementalAnnotationLayoutSession` for committed edits, pass the
resulting authoritative `session.layout` to the React adapter through its
`resolvedLayout` prop. This bypasses the component's redundant full layout
calculation while preserving its existing note rendering, pointer editing,
quality reports and target-alignment callbacks. The host still supplies the
matching `annotations` and `bounds` and updates both the source annotations and
`resolvedLayout` on edit commit. For example, inside a host-controlled React
component:

```tsx
<AnnotationLayer
  annotations={annotations}
  bounds={bounds}
  noteSizes={noteSizes}
  resolvedLayout={resolvedLayout}
  previewEdits
  editable={{ includeAnchor: true }}
  onEditEnd={(edit) => {
    const next = applyAnnotationEdits(annotations, edit);
    setAnnotations(next);
    setResolvedLayout(layoutSession.update({
      annotations: next,
      bounds,
      noteSizes,
      refinement: false
    }));
  }}
/>
```

In this snippet, `layoutSession` is created once and the initial
`resolvedLayout` state comes from `layoutSession.layout`; the host owns that
state and maintains stable callback identities.
When `resolvedLayout` is provided, the React layer also skips its internal
note-size estimates and size-map merging: the host's session already owns
that geometry. This avoids repeating size work on large committed updates.
Switching back to the normal uncontrolled mode restores the component's
standard note-size estimation automatically. The supplied layout must
correspond to the current annotations and bounds. `measure="dom"` cannot be
combined with `resolvedLayout` because component-owned note measurements
would bypass the host's layout session; pass explicit `noteSizes` and use the
default `measure="estimate"` instead. Without `resolvedLayout`, the React layer
continues to perform its usual full layout.

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
candidates. It examines candidates beyond those retained by `maxCandidates`.
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
