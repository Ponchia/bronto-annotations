# React Flow diagram

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/react-flow-basic/) · [Source](main.tsx)

Callouts attached to public node, handle, edge, and viewport geometry.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/react-flow-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the generated graph and annotated targets. Try dragging the Review note handle: a clear drop commits to host-owned patch state, while a drop that obscures a graph node is rejected and announced without crashing the diagram. Change a node or viewport input in main.tsx and compare target alignment.

## Host and package boundary

React Flow owns graph rendering and state. The annotations adapter consumes its public geometry instead of owning graph layout.

The host uses `validateHostAnnotationEdit` to resolve a proposed drop from authored inputs and inspect `evaluateAnnotationLayout` before committing it. The annotation layer emits suggestions; it does not validate, persist, or reverse host edits. Rejected drops return to the last committed layout and are announced with a live status message. This is an example integration policy, not a package-owned state manager.

The source lives in [main.tsx](main.tsx), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/adapter-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
