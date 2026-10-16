# Development and verification

[Documentation index](README.md) · [First annotation](getting-started.md)

This guide is for maintainers. To use the package, start with the consumer
guides instead. Repository-relative paths in commands are run from the root.

## Choose the check for the work

`npm run check:fast` covers compilation, unit tests, dead-code checks, declarations,
package exports and the existing API contract. Use it while iterating; it is not
a replacement for the full CI suite. It compiles once, then reuses the existing
byte-verified build for declaration/export checks. Changed source or compiled
output still refuses reuse; standalone `npm run build` remains a fresh build.

`npm run test:quality` checks authored wide/narrow host geometry, exact retained
placement parity, measured collision budgets, and expected impossible layouts.
Its JSON and SVG gallery default to `.tmp/placement-quality`; pass
`-- --output-dir <directory>` to preserve evidence outside build scratch.
Run `node scripts/verify-placement-quality.mjs --output-dir <directory>` to
independently re-check a saved report against the checked-in fixtures.

`npm run test:upstream` packs the library and verifies pinned, licensed upstream
Vega/Mermaid inputs in a real browser without network requests. See the
[upstream proof](upstream-consumers.md) for browser selection and evidence.

`npm run check` remains the complete existing regression/release check. The
historical readiness and release manifests remain available; passing them does
not establish independent adoption or visual quality.

## Examples And Checks

```bash
npm install
npm run check
npm run typecheck
npm run check:dead
npm run test:docs-snippets
npm run test:pack
npm run test:browser
npm run test:screenshots
npm run test:readiness
npm run test:completion-audit
npm run test:api-stability
npm run test:canary
npm run test:d3-parity
npm run test:bronto-parity
npm run test:bronto-upstream
npm run test:dogfood
npm run test:dogfood:bronto-report
npm run test:dogfood:self-report
npm run test:dogfood:external
```

Examples:

- `examples/index`
- `examples/svg-basic`
- `examples/react-basic`
- `examples/react-incremental`
- `examples/bronto-report`
- `examples/dom-basic`
- `examples/vega-basic`
- `examples/mermaid-basic`
- `examples/d2-basic`
- `examples/react-flow-basic`
- `examples/style-gallery`

`examples/vega-basic` uses Vega scenegraph geometry. Vega-Lite consumers use
the same adapter after compiling or rendering their Vega-Lite spec through
public Vega/Vega-Lite APIs.
`examples/index` is the browsable entry point that links every verified example
context from a small annotated overview.
`examples/react-incremental` is a runnable host-owned React editor: commit a
late-note anchor change, append/remove a low-priority annotation, reset, or
drag a note handle. It shows how many previously resolved winners survive each
change, uses `previewEdits` for pointer feedback and passes the authoritative
incremental result as `layout` to React instead of invoking a second full solve.

`examples/style-gallery` renders every public annotation variant, all tones,
all motion hints, package-prefixed classes, and Bronto-compatible CSS styling in
one inspectable SVG layer.

Browser verification opens every example through Vite, checks visible notes and
connectors, rejects note overlap/overflow, verifies adapter examples use
rendered host geometry, checks annotation subjects are aligned to actual
generated Vega marks, Mermaid nodes/edges, D2 shapes/routes, and React Flow nodes,
handles, or edges, verifies the style gallery covers every variant/tone/motion class, and
captures screenshots in `.tmp/screenshots`. Packed-consumer browser
smoke also captures clean-installed package screenshots in
`.tmp-packed-screenshots`.

After `npm run test:pack` and `npm run test:browser`, screenshot verification
checks every expected desktop/mobile PNG for all examples plus the packed
consumers, validates the PNG dimensions, rejects tiny placeholder files, and
requires visible varied content. The approved metrics live in
`test/visual-baselines/browser-screenshots.json`, and `npm run
test:screenshots` compares new browser output against those visual baselines.

Packed-consumer verification also installs the generated tarball into temporary
clean projects. One browser smoke proves root SVG rendering and
`@ponchia/annotations/bronto.css` styling from the packed package; another
clean Vite/Chromium consumer installs the optional peers and renders real
DOM/report, Vega, Mermaid, D2, and React Flow surfaces through public package
imports, verifies each annotation subject aligns with the generated host target,
and checks legacy `ui-annotation*` report snippets are styled by the packed CSS
bridge.

Dogfood verification runs a separate clean Vite report consumer from the packed
tarball. It renders DOM report regions, a Vega-Lite chart compiled through
Vega, and a Mermaid diagram, then verifies visible notes/connectors, generated
target alignment, and no console errors. The friction report lives in
`docs/dogfood-clean-consumer-report.md`.
`npm run test:dogfood:bronto-report` adds a real public-report grammar pass:
it installs the packed annotations tarball with public `@ponchia/ui` report
CSS in a clean Vite consumer, annotates report stat cards, an SVG chart, and a
table row, and records friction in `docs/dogfood-bronto-report.md`.
`npm run test:dogfood:self-report` adds a self-dogfood pass from real project
evidence: it renders `docs/readiness-matrix.json`,
`docs/completion-audit.json`, and `package.json` into a clean report consumer,
then annotates DOM metric cards, a generated SVG chart, and a generated SVG
flow diagram. The friction report lives in `docs/dogfood-self-report.md`.
`npm run test:dogfood:external` is an optional env-gated local harness for a
real external Astro/React consumer: it builds the host, measures actual rendered
DOM geometry in Chromium, can also run in `react-flow` mode to measure rendered
React Flow nodes, handles, and generated SVG edge routes through
`prepareReactFlowAnnotations`, injects a package-generated SVG layer, and
records the sanitized friction report in
`docs/dogfood-external-consumer-report.md`.

`docs/readiness-matrix.json` is a checked map from the promised public surface
to concrete source files, examples, tests, packed-consumer smoke, browser
evidence, and documented limits. `npm run test:readiness` validates that matrix
against the current package exports and verification scripts so compatibility
claims do not drift from the evidence.

`test/docs-public-snippets.ts` type-checks the documented recipe shapes through
the public package subpaths, including React, DOM, Vega, Mermaid, D2, React
Flow, and `bronto.css` imports.

`npm run typecheck` builds declarations and then type-checks source, tests, and
examples as one strict TypeScript program. `npm run check:dead` runs Knip with
the package public subpaths, example entrypoints, scripts, and type-consumer
harnesses configured as intentional entrypoints.

`docs/completion-audit.json` maps the original requested product scope and
success criteria to direct evidence across source, tests, examples, packed
consumers, browser verification, docs, styling parity, d3-style ergonomics, and
product boundaries. `npm run test:completion-audit` verifies every audit entry
against the current files and is included in `npm run check`.

`docs/integration-recipes.md` is the practical first-use guide for automatic and
manual placement across SVG, DOM/report, React, Vega/Vega-Lite, Mermaid, D2, and
React Flow contexts.
`docs/context-quickstart.md` is the shorter chooser for host contexts, imports,
anchor sources, first helpers, manual placement, generated-surface timing, and
common integration mistakes.
`docs/api-reference.md` lists the primary exports for every public subpath and
the boundary each adapter keeps.

`docs/bronto-ui-annotation-parity.json` tracks the public
`@ponchia/ui/css/annotations.css` and `@ponchia/ui/annotations` surface carried
into this package. `npm run test:bronto-parity` proves the legacy
`ui-annotation*` classes, package-prefixed renderer classes, motion/print/forced
color rules, and Bronto geometry helper exports remain available without adding
a hard `@ponchia/ui` dependency.
`npm run test:bronto-upstream` uses a **frozen published
`@ponchia/ui@0.16.3` annotation contract** with the original tag, commit and
source SHA-256 values recorded in the manifest. The test validates legacy
selectors, CSS declaration properties, variables, keyframes and helper exports
even when the UI source is absent. If a local `@ponchia/ui` checkout still
ships the legacy files, it also refuses undocumented new legacy APIs. A local
checkout is optional because Bronto UI is deprecating the annotation APIs
before removing them in a later minor. `--require` retains strict checkout
mode for targeted development diagnostics.
`docs/migration-guide.md` also covers moving existing Bronto static SVG snippets
and helper usage onto this package.

## Repository Quality

These are the maintained repository checks. Green checks describe the tested
commit; they do not imply that it has been published to npm.

- CI runs `npm run check` on Node 20 and Node 22 for pushes and pull requests.
- Release publishing is tag-driven: pushed `v*` tags run the Release workflow,
  require the protected `npm-publish` GitHub Environment approval, and publish
  to npm with provenance.
- Dependabot tracks npm and GitHub Actions updates, with optional peers grouped
  separately from tooling.
- CodeQL, Dependency Review, and OpenSSF Scorecard run as public-repo security
  automation; see `docs/security-automation.md` for workflow and GitHub setting
  details.
- Public pull-request validation intentionally stays on standard GitHub-hosted
  runners; `docs/security-automation.md` documents the self-hosted runner
  boundary for this public repository.
- `CONTRIBUTING.md` documents product boundaries, verification expectations,
  adapter requirements, and release handoff.
- Security policy: `SECURITY.md` defines the vulnerability reporting path and
  security boundary.
- Pull request and issue templates require reproduction details, verification,
  and product-boundary checks.
- `scripts/check-repo-readiness.mjs` keeps package metadata, workflows,
  security automation, templates, lifecycle docs, and release guardrails wired
  into `npm run check`.

## Pre-Release Hardening

The original pre-release program is retained as verification evidence. It is
not the current release roadmap. Historical `0.1.x` reports below do not
establish broader API or browser guarantees for a newer release.

- `docs/pre-release-roadmap.md` tracks dogfood, API freeze, canary publishing,
  visual baselines, adapter recipes, authoring UX, performance, accessibility,
  compatibility, and naming/release decisions.
- `docs/api-stability.md` defines which APIs are stable for `0.1.x` and which
  remain experimental during `0.x`; `docs/api-stability.manifest.json` labels
  every public export and `npm run test:api-stability` enforces it.
- `docs/compatibility.md` records supported Node, TypeScript, React, Vega,
  Mermaid, D2, and React Flow ranges; `npm run test:compatibility` enforces the
  metadata/docs/CI contract, and `npm run test:compatibility:lanes` clean-smokes
  TypeScript 5.8, React 18, and Vega 5.
- `docs/dogfood-friction-report.md` is the required template for the first real
  consumer integration report.
- `docs/dogfood-clean-consumer-report.md` records the clean-consumer dogfood
  pass, including the external note-list accessibility recipe, and friction
  found by `npm run test:dogfood`.
- `docs/dogfood-bronto-report.md` records the public `@ponchia/ui` report
  dogfood pass and friction found by `npm run test:dogfood:bronto-report`.
- `docs/dogfood-self-report.md` records the self-dogfood release-evidence
  report built from current readiness/audit data and friction found by
  `npm run test:dogfood:self-report`.
- `docs/dogfood-external-consumer-report.md` records the env-gated external
  Astro/React consumer passes over rendered DOM stack geometry and rendered
  React Flow diagram geometry, plus friction found by `npm run
  test:dogfood:external`.
- Static SVG `includeQualityIssues` and React `qualityDebug` render
  layout-quality issue boxes for manual-placement and overlap debugging.
- `docs/canary-release.md` documents the GitHub Packages canary lane, and
  `docs/canary-publish-report.md` records the verified
  `0.1.0-canary.1.e754177` registry install; `npm run test:canary` verifies the
  canary workflow, version prep, and registry-consumer smoke wiring.
- `docs/public-release-decisions.md` records the `@ponchia/annotations`
  package name, `Ponchia/bronto-annotations` repository policy, public npm
  access, README positioning, and examples hosting decisions for `0.1.x`.
- `docs/adapter-recipes-proof.md` records which deeper Vega-Lite, Mermaid, D2,
  and React Flow recipes are already proven and which still need richer
  browser/live coverage.
- `docs/visual-regression.md` documents the screenshot baseline update workflow.
- `npm run test:performance` runs deterministic 10, 50, and 200 annotation
  stress layouts against the real engine.
- `scripts/check-pre-release-goals.mjs` keeps these hardening docs and gates
  wired into `npm run check`.


## Exact CI candidate for application acceptance

The Node 22 CI artifact includes `package/pack.json`, `package/source.json`
and the npm-packed `.tgz` after the complete gate passes. The verified compiled
output, Git source/tree identity and npm archive integrity allow an isolated
application to install those exact bytes without publishing an npm prerelease.
Do not substitute a Git dependency that lacks compiled exports, label this as
registry provenance, or update a live consuming application merely to inspect it.
Keep the application's source, lockfile and real browser acceptance results
beside the exact package identity. A passing isolated module fixture is not a
substitute for the consuming application's full browser and persistence paths.

The historical Bronto parity check proves selector/property coverage and exported
helper availability. It does not compare computed styles, complete CSS values,
function signatures or every generated SVG path. Those require a consumer's
rendering, typing and interaction checks. Negative tests cover absent source,
strict mode, partial removal and unexpected additions to the old UI contract;
optional local source is inspected as text, never executed.
