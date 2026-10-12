# D2 diagram

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/d2-basic/) · [Source](main.ts)

Callouts on D2 compiled or rendered shape and connection geometry.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/d2-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the rendered D2 shapes and annotation targets. Change a target specification and compare the validation report.

## Host and package boundary

D2 compiles and renders the diagram. The adapter consumes shape/route geometry without taking over D2 layout.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/adapter-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
