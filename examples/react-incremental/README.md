# Interactive annotation editor

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/react-incremental/) · [Source](main.tsx)

Drag and edit notes, inspect JSON, and undo committed changes with host-owned history.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/react-incremental
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Click or Tab to a note in the diagram to select it for text editing. Drag a note handle, use Move final anchor, edit a note title and apply it, then Undo and Redo. Copy the current JSON and load it back. Invalid JSON must leave the current state untouched.

## Host and package boundary

History, selection, forms, JSON validation, and persistence decisions are application code. The small importer accepts point/box annotations and at most ten notes; it is not a general package serializer.

The source lives in [main.tsx](main.tsx), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/react-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
