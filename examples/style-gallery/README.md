# Annotation styles

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/style-gallery/) · [Source](main.ts)

A visual reference for callout variants and the optional annotation CSS.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/style-gallery
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the visual variants, then change a style token or annotation option and compare the result.

## Host and package boundary

This is a styling fixture, not an application editor or a chart engine.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/styling-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
