# Troubleshooting

[First annotation](getting-started.md) · [Help and feedback](../SUPPORT.md)

## Nothing is visible

Check that the mount element exists and that the SVG container has nonzero
width and height. Render one point annotation with explicit bounds first, as in
the [first-annotation guide](getting-started.md). Import `@ponchia/annotations/bronto.css`
or supply equivalent styles. For a rendered-host adapter, wait until the host
has produced measurable nodes or marks, then inspect its validation report.

Do not install every optional peer to fix a core example. Match the missing
module to the subpath you actually import and the [compatibility matrix](compatibility.md).

## The React layer is wider than the page

`AnnotationLayer` defaults its wrapper to the layout bounds in pixels. Override
its `style` with a responsive width, an automatic height, and the matching
aspect ratio, as shown in [the React quickstart](getting-started.md#use-it-in-react).
Do not shrink only the wrapper width while leaving its height fixed. For a dense
editor, a host-owned scroll container may be more readable than scaling every
note down. Changing CSS size alone does not change the underlying coordinate space.

## Notes do not line up with the host

Check coordinate systems before adjusting offsets. `getBoundingClientRect()`
returns viewport pixels; an SVG viewBox, a scrolled document, and a zoomed graph
can all use different coordinates. Use the adapter's coordinate-space options,
keep `preserveAspectRatio` consistent, and remeasure after the host settles.
For React Flow, provide the current public viewport and geometry rather than
mixing pre-zoom node coordinates with post-zoom screen rectangles.

See [adapter examples](adapter-guide.md) and the
[layout diagnostics](core-guide.md#layout-diagnostics).

## Text is clipped or wrapping is unexpected

The DOM-free core estimates text size; it cannot measure a loaded browser font.
Provide accurate `noteSizes` or use the React layer's documented DOM measurement
mode after fonts and styles are ready. Keep note size units in the layout's
coordinate space. Use the note wrapping and padding options in the
[styling guide](styling-guide.md).

The controlled `resolvedLayout` React path requires host-owned note sizes and
cannot be combined with component-owned `measure="dom"` resolution. Follow
[the React guide](react-guide.md) rather than computing two competing layouts.

## Notes overlap even though layout succeeds

A resolved result does not guarantee a collision-free picture. Evaluate the
layout quality, look at candidate diagnostics, and try more suitable sides,
offsets, or bounded refinement. Dense surfaces may need fewer visible notes,
shorter text, a larger area, or editorial manual placement. The engine does
not automatically hide low-priority notes or implement progressive disclosure.

The public [placement comparison](https://ponchia.github.io/bronto-annotations/#playground)
lets you compare automatic placement with a fixed-offset baseline.

## Dragging is slow or an edit is lost

Avoid a full layout solve on every pointer movement. Use `previewEdits` for
provisional feedback and commit through `onEditEnd`. A cancelled gesture does
not produce a completed edit. Keep IDs stable and ensure the host applies the
patch to its own annotation inputs.

Incremental sessions can reuse an unchanged priority prefix; edits earlier in
the order and global geometry changes may need a full solve. A Worker moves
solver work off the UI thread, but cloning and rendering can still be costly.
The [performance guide](performance.md) and [Worker recipe](worker-layout.md)
explain the limits without promising a frame rate.

## An imported JSON example is rejected

The interactive demo deliberately accepts a small point/box schema with a
maximum of ten notes. It is not a general serializer for every `Annotation`
option. Invalid input should leave the existing state untouched. Real
applications must validate their own supported schema and own persistence.
Read the [editor example](../examples/react-incremental/README.md).

## A published example uses an API my package does not have

Check `npm ls @ponchia/annotations` and compare its release notes with the
repository revision used by the guide. `main`, the public demo, a Git tag, and
an npm release are distinct states. Do not assume a tag has already reached
the registry, or install directly from an arbitrary development branch.

## Report what remains

Provide the smallest runnable input, your package and browser versions, and the
expected result. Include a screenshot for visual issues and remove private data.
Use [SUPPORT.md](../SUPPORT.md); security reports follow [SECURITY.md](../SECURITY.md).
