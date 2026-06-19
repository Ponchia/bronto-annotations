# Pre-Release Roadmap

This roadmap tracks the work that turns a complete package into a package that
has been proven in real consumer use before a public `1.0.0` commitment.

## Gates Before Public 1.0

1. Dogfood in a real consumer and write a friction report.
2. Freeze the `0.1.x` public API contract and mark experimental surfaces.
3. Publish a private/canary package and install it from a separate clean
   project.
4. Add visual regression baselines on top of the existing screenshot evidence.
5. Expand adapter recipes for deeper generated-surface scenarios.
6. Harden optional authoring UX around edit patches, note dragging, and anchor
   movement.
7. Keep performance and stress testing in CI.
8. Document accessibility recipes for keyboard and screen-reader workflows.
9. Maintain a compatibility matrix for Node, TypeScript, React, Vega, Mermaid,
   D2, and React Flow.
10. Decide final public package/repository naming and release ownership.

## Current Status

- Package implementation: complete for `0.1.0`.
- Repository operations: CI, release workflow, package metadata, templates, and
  repo-readiness checks are in place.
- Dogfood: `npm run test:dogfood` installs the packed package into a clean Vite
  report consumer, renders DOM, Vega-Lite, and Mermaid surfaces, and records
  friction in `docs/dogfood-clean-consumer-report.md`.
- Real report dogfood: `npm run test:dogfood:bronto-report` installs the packed
  package beside public `@ponchia/ui` report CSS in a clean Vite consumer,
  annotates rendered report stat cards and a mixed DOM/SVG report figure, and
  records friction in `docs/dogfood-bronto-report.md`.
- Self dogfood: `npm run test:dogfood:self-report` installs the packed package
  into a clean Vite consumer, renders a release-evidence report from
  `docs/readiness-matrix.json`, `docs/completion-audit.json`, and
  `package.json`, annotates DOM report regions plus generated SVG chart and
  diagram geometry, and records friction in `docs/dogfood-self-report.md`.
- External consumer dogfood: `npm run test:dogfood:external` is an env-gated
  local harness that builds a real Astro/React consumer, measures rendered DOM
  stack-page geometry or rendered React Flow diagram geometry in Chromium,
  injects a package-generated SVG layer, and records friction in
  `docs/dogfood-external-consumer-report.md`.
- API freeze: `docs/api-stability.manifest.json` labels every public export as
  stable or experimental for `0.1.x`, source entrypoints carry `@public` and
  `@experimental` notes, and `npm run test:api-stability` enforces coverage.
- Canary publishing: `.github/workflows/canary.yml` published
  `0.1.0-canary.1.e754177` to GitHub Packages and installed it from a clean
  registry consumer; `docs/canary-publish-report.md` records the evidence and
  `npm run test:canary` keeps the lane wired.
- Visual regression: `test/visual-baselines/browser-screenshots.json` stores
  approved browser metrics for every example viewport and packed browser
  consumer, and `npm run test:screenshots` compares new output against it.
- Performance: `npm run test:performance` exercises deterministic 10, 50, and
  200 annotation layouts.
- Compatibility: `npm run test:compatibility` checks package peer ranges,
  optional-peer metadata, CI Node lanes, and docs against
  `docs/compatibility.md`; `npm run test:compatibility:lanes` installs clean
  consumers for the declared React 18 and Vega 5 lanes.
- Accessibility: `npm run test:dogfood` verifies an external note list with
  roving focus, note focus sync, keyboard activation, and a screen-reader
  summary derived from validation and layout-quality results.
- Adapter recipes: `docs/adapter-recipes-proof.md` records which deeper
  generated-surface recipes are already test-proven or browser-proven.
- Authoring UX: `createAnnotationEditSession`, `createAnnotationEditEvent`,
  and `createAnnotationEditDelta` provide DOM-free note-drag, keyboard nudge,
  and anchor-move suggestions for React and custom authoring surfaces;
  `includeQualityIssues` and `qualityDebug` provide opt-in visual issue boxes
  for manual-placement review; hosts still own state and persistence.
- Public release decisions: `docs/public-release-decisions.md` fixes the
  `@ponchia/annotations` package name, `Ponchia/bronto-annotations` repository
  policy, public npm access, README positioning, and examples hosting decisions
  for the `0.1.x` lane.
- Remaining high-value proof: keep widening dogfood beyond the first external
  consumer into additional production host apps or reports before widening
  public API stability promises.

## Tracking Documents

- API stability: `docs/api-stability.md`
- API stability manifest: `docs/api-stability.manifest.json`
- Compatibility matrix: `docs/compatibility.md`
- Compatibility gate: `npm run test:compatibility`
- Compatibility lane smoke: `npm run test:compatibility:lanes`
- Dogfood report template: `docs/dogfood-friction-report.md`
- Clean-consumer dogfood report: `docs/dogfood-clean-consumer-report.md`
- Bronto report dogfood report: `docs/dogfood-bronto-report.md`
- Self-dogfood report: `docs/dogfood-self-report.md`
- External consumer dogfood report:
  `docs/dogfood-external-consumer-report.md`
- Canary release runbook: `docs/canary-release.md`
- Canary publish evidence: `docs/canary-publish-report.md`
- Public release decisions: `docs/public-release-decisions.md`
- Visual regression baselines: `docs/visual-regression.md`
- Performance expectations: `docs/performance.md`
- Accessibility recipes: `docs/accessibility.md`
- Adapter recipe roadmap: `docs/adapter-recipes-roadmap.md`
- Adapter recipe proof: `docs/adapter-recipes-proof.md`
