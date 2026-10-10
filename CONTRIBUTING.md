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

### Verified build reuse

The full `npm run check` pipeline performs an initial full TypeScript build,
then reuses the **same byte-verified** `dist` artifact across its remaining
checks instead of recompiling it for every fixture. This preserves packed
consumer installations, screenshot coverage, compatibility lanes, and all
existing verification stages. It only changes redundant build work.

Every standalone command, including `npm run build`, `npm run test:pack`,
`npm run test:browser`, and `npm run test:performance`, still builds freshly.
Inside `npm run check`, `PONCHIA_ANNOTATIONS_REUSE_BUILD=1` enables a no-op
build **only** when both source inputs and compiled outputs match the fingerprints
recorded after a successful compile. The fingerprint lives in ignored `.tmp`
and is never published with the package. Changed/missing artifacts stop the
check rather than silently publishing or testing stale JavaScript.

Run `npm run test:build-reuse` to verify that fresh output is reused unchanged,
while an added source or dist file is correctly rejected. To repair a failed
reuse check, run `npm run build` without the reuse environment variable.

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
