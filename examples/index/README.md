# Visual example index

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/index/) · [Source](main.ts)

An annotated overview with links to the individual demonstration surfaces.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/index
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Use the published index to navigate between examples. For local cross-example navigation, build and serve the full site as described in the catalog.

## Host and package boundary

The index illustrates the annotation grammar. Each linked page is a separate host fixture.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/getting-started.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
