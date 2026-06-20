# Contributing

`@ponchia/annotations` is a public-package-shaped annotation engine. Keep
changes focused on annotation models, anchors, placement, collision handling,
connector geometry, render helpers, and adapter contracts.

## Product Boundaries

This package must not become:

- a chart engine
- a diagram or graph layout engine
- an app-state, routing, persistence, or workflow layer
- a design system
- a hard dependency on React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui`

Root imports must stay DOM-free and free of optional peer runtime imports.
Adapter packages are optional peers and should use public host geometry APIs or
rendered SVG/DOM geometry.

## Development

```bash
npm ci
npm run check
```

`npm run check` is the required gate. It builds the package, runs whole-repo
type checks, unit tests, dead-code/dependency checks, validates public exports
and docs, runs parity checks, builds examples, performs packed-consumer smokes,
verifies examples in a browser, checks screenshots, and enforces
readiness/completion/repository hygiene.

## Pull Requests

Before opening a PR:

- Run `npm run check`.
- Add or update focused tests for changed behavior.
- Update README, `docs/api-reference.md`, and examples when public APIs change.
- Update `docs/readiness-matrix.json` or `docs/completion-audit.json` when a
  capability or verification claim changes.
- Keep public hygiene intact: no private project names, personal data, local
  absolute paths, internal URLs, credentials, or consumer-specific details.

## Adapter Changes

Adapters should expose lower-level anchor/annotation/obstacle/validation
helpers plus a `prepare*Annotations` helper where useful. Generated-surface
adapters should support:

- validation diagnostics
- obstacles from the same host geometry used for anchors
- manual placement preservation
- target-alignment diagnostics when a host can provide expected geometry
- provenance in `annotation.data`

## Releases

See `docs/release.md`.
