# DOM regions

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/dom-basic/) · [Source](main.ts)

Annotations attached to measured regions of an ordinary HTML surface.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/dom-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the two host regions and their notes. Change a region size or position and observe the measured overlay.

## Host and package boundary

The host owns DOM content, measurement timing, and mounting. All measured rectangles must be converted into the overlay coordinate space.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/adapter-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
