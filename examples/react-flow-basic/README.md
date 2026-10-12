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

Inspect the generated graph and annotated targets. Change a node or viewport input in main.tsx and compare target alignment.

## Host and package boundary

React Flow owns graph rendering and state. The annotations adapter consumes its public geometry instead of owning graph layout.

The source lives in [main.tsx](main.tsx), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/adapter-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
