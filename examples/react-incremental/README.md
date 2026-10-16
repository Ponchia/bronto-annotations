# Interactive annotation editor

[All examples](../README.md) ·
[Live demo][demo] ·
[Source](main.tsx)

[demo]: https://ponchia.github.io/bronto-annotations/examples/react-incremental/

Read every note in a synchronized list, edit text or geometry, inspect JSON,
and undo committed changes with host-owned history.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/react-incremental
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Select a title in **All notes**. Arrow keys, Home, and End move between titles;
Tab follows the normal document order. The list shows each full body, including
notes hidden in the diagram. Use **Edit selected note**, apply a change, then
**Return to selected note** to restore list focus. Selection also follows the
diagram and the editor menu. If an import or removal deletes the selection,
the host selects the first remaining note.

At narrow container widths, or when layout quality reports overlaps or invalid
geometry, the host starts with the full diagram collapsed. The list remains
complete: no note is deleted, ranked out, or silently replaced. Open **Show full
diagram** for sideways scrolling and geometry handles. Your disclosure choice
persists while editing and resizing. Fixed diagram boxes may clip long text;
the list is the reading surface for the complete authored text.

Drag a note handle, use Move final anchor, edit a note title and apply it, then
Undo and Redo. Copy the current JSON and load it back. Invalid JSON must leave
the current state untouched. Presentation and selection changes do not create
history entries or rewrite authored geometry.

## Host and package boundary

The layer receives only `layout={view.layout}` plus presentation and edit
callbacks. Source annotations, bounds, and final note geometry come from that
layout; the layer does not solve or measure it again. Request
`diagnostics: { candidates: 8 }` from the host solver when inspecting alternatives
with `debug`. Normal Worker and incremental results omit diagnostics.

History, selection, the full-text list, the responsive disclosure policy, forms,
JSON validation, and persistence decisions are application code. The small
importer accepts point/box annotations and at most ten notes; it is not a
general package import/export API. The fallback checks the host container width
and the resolved layout quality. It does not change package placement policy.

The scoped browser check is [responsive-authoring.browser.js](../../test/examples/responsive-authoring.browser.js).
With the library built and Vite serving this checkout, create the output directory
with `mkdir -p /tmp/annotations-responsive-evidence`. Open the example through
`playwright-cli`, then run it with `playwright-cli run-code --filename=<absolute-file-path>`.
Screenshots go to that directory. An `?evidence=<absolute-directory>` query on the
initial example URL selects another existing directory.
It checks desktop and 390px viewport behavior. Automated keyboard and DOM checks
are not screen-reader or physical-device acceptance.

The source lives in [main.tsx](main.tsx), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/react-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).


The responsive scenario runs automatically within `npm run test:browser`
(and therefore `npm run check`) through the existing Playwright harness. It
retains normal, full-detail and crowded screenshots in
`browser-evidence/responsive-authoring/`, which survives subsequent package
builds. Existing Firefox/WebKit and Chromium touch checks explicitly open the
full diagram before testing geometry; they do not remove text-first coverage.
