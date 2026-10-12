# Mermaid diagrams

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/mermaid-basic/) · [Source](main.ts)

Annotations on actual rendered Mermaid diagram geometry.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/mermaid-basic
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Inspect the rendered diagram targets and notes. Change a label or target specification, then check missing-target diagnostics.

## Host and package boundary

Mermaid parses and lays out the diagram. The adapter runs after rendering and uses SVG geometry, not a second diagram parser.

The source lives in [main.ts](main.ts), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/adapter-guide.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
