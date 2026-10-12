# Annotated report

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/bronto-report/) · [Source](main.ts)

Annotations over report geometry with an optional Bronto styling bridge.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/bronto-report
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect note placement over the report and compare the migrated static annotation with the resolved layer.

## Host and package boundary

The report content and layout belong to the host. Bronto-compatible CSS is optional; the engine does not require a design system.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/styling-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
