# Vega and Vega-Lite

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/vega-basic/) · [Source](main.ts)

Notes attached to rendered chart marks and geometry supplied by Vega.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/vega-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the real chart marks and callouts, then change a target specification in main.ts. Check adapter diagnostics rather than assuming a mark matched.

## Host and package boundary

Vega renders the chart. The adapter uses its produced geometry; the annotations core does not manage scales or chart data.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/adapter-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
