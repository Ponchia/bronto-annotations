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
- Visual regression: `test/visual-baselines/browser-screenshots.json` stores
  approved browser metrics for every example viewport and packed browser
  consumer, and `npm run test:screenshots` compares new output against it.
- Performance: `npm run test:performance` exercises deterministic 10, 50, and
  200 annotation layouts.
- Remaining high-value proof: install a private/canary registry package in a
  downstream consumer before widening public API stability promises.

## Tracking Documents

- API stability: `docs/api-stability.md`
- Compatibility matrix: `docs/compatibility.md`
- Dogfood report template: `docs/dogfood-friction-report.md`
- Clean-consumer dogfood report: `docs/dogfood-clean-consumer-report.md`
- Visual regression baselines: `docs/visual-regression.md`
- Performance expectations: `docs/performance.md`
- Accessibility recipes: `docs/accessibility.md`
- Adapter recipe roadmap: `docs/adapter-recipes-roadmap.md`
