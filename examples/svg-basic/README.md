# SVG figure

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/svg-basic/) · [Source](main.ts)

Host-rendered SVG with notes, subjects, connectors, and layout diagnostics.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/svg-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Open the figure, inspect its callouts, then change one note or anchor in main.ts. Compare the resulting geometry.

## Host and package boundary

The fixture draws the underlying figure. The package resolves and renders only the annotations.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/core-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
