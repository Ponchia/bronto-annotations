# React annotation layer

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/react-basic/) · [Source](main.tsx)

A React-rendered workflow with a separate annotation SVG layer.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/react-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the workflow and notes together, then change a note in main.tsx and observe the rendered update.

## Host and package boundary

React state, the underlying workflow SVG, and overlay mounting belong to this host.

This example uses input mode: `annotations` and `bounds` let the layer solve locally. In input mode, `debug` requests eight candidate diagnostics unless `diagnostics` supplies a different count. For a host-resolved result, pass only `layout` plus presentation props; alternatives come from its existing diagnostics.

The source lives in [main.tsx](main.tsx), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/react-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
