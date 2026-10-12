# Contributing

`@ponchia/annotations` is a public, headless annotation engine. Keep
changes focused on annotation models, anchors, placement, collision handling,
connector geometry, render helpers, and adapter contracts.

Small documentation fixes, reproducible bug reports, and examples from real
integrations are welcome. For usage questions, start with [SUPPORT.md](SUPPORT.md).
Financial support is optional and separate from contribution in [FUNDING.md](FUNDING.md).

## Find your way around

| Area | Start here |
| --- | --- |
| Consumer guides and troubleshooting | [Documentation index](docs/README.md) |
| Runnable hosts and expected behavior | [Example catalog](examples/README.md) |
| Models, placement, connectors, and layout quality | `src/core/` |
| Renderers and integrations | `src/svg/`, `src/react/`, `src/dom/`, `src/adapters/` |
| Behavior, package consumers, and documentation regressions | `test/` |
| Build, browser, release, and compatibility checks | [Verification guide](docs/verification.md) |

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
npx playwright install chromium
npm run check
```

On Linux, Playwright may also need system libraries; CI installs them with
`npx playwright install --with-deps chromium`. The ordinary examples do not
require a Playwright browser download.

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

## Documentation and examples

Keep the root README focused on adoption. Put detailed options in the relevant
current guide and link it from `docs/README.md`. Preserve useful historical
records, but label their scope instead of presenting them as current setup.

The first-use code blocks are synchronized with executable, typechecked fixtures
in `test/docs/`. Update the fixture and guide together. Each runnable example
has a README with setup, expected behavior, and the host/package ownership
boundary; its catalog entry lives in `examples/catalog.json`. The public site
uses that catalog, and documentation tests check it against the source tree.

For an initial focused check use `npm run test:docs-snippets`; changes to the
published site also need `npm run test:site`. These do not replace the full
`npm run check` gate before a PR is ready to merge.

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
