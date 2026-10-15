# Worker layout experiment

[All examples](../README.md) · [Live demo](https://ponchia.github.io/bronto-annotations/examples/react-worker/) · [Source](main.tsx)

Host-owned module Worker with revision-safe results and responsive UI controls.

## Run

From the repository root, after `npm ci`:

```bash
npm run example -- examples/react-worker
```

Open the local URL printed by Vite. See the [catalog](../README.md) for setup,
rebuilding library code, and running the complete published site locally.

## What to try

Move the final anchor or host obstacle, supersede a request, and start a cancellable job. Use Ignore pending result and the UI response control to observe the distinction between result admission and background solver work.

## Host and package boundary

The layer receives only `layout={view.layout}` plus presentation and edit callbacks. Source annotations, bounds and final note geometry come from that layout; the layer does not solve or measure it again. Request `diagnostics: { candidates: 8 }` from the host solver when inspecting alternatives with `debug`. Normal Worker and incremental results omit diagnostics.

The host creates the Worker, tracks revisions, and decides which result to accept. Ignoring a result does not interrupt solver CPU work. This is an experimental recipe, not a public Worker API.

The source lives in [main.tsx](main.tsx), with its host styles in
[styles.css](styles.css). Read the [integration guide](../../docs/worker-layout.md)
before copying an advanced pattern into an application.

## Version note

This fixture follows the checked-out repository revision. The public demo tracks
`main` and can be ahead of the npm release. Match installed package versions to
[release notes](https://github.com/Ponchia/bronto-annotations/releases).
