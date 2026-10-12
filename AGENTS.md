# Agent Notes

This repository publishes the public `@ponchia/annotations` package.

## Public Boundary

Keep code, docs, examples, and commit messages free of credentials, private
project names, internal URLs, and consumer-specific information. Name a
downstream integration only when it is explicitly public.

## Product Boundary

This package owns annotation models, anchors, placement, collision handling,
geometry, and optional renderer/integration adapters. It does not own chart or
graph rendering, diagram parsing/layout, app state, persistence, Worker lifetime,
or a design system. Root imports must remain DOM-free and have no optional peer
runtime imports. Bronto-compatible CSS remains an optional bridge.

## Sources of truth

- `README.md`: product entry point; keep it focused on first use.
- `docs/README.md`: current guide router and historical/proposal lifecycle.
- `src/`, `package.json` exports, and `test/`: implementation and public contract.
- `examples/README.md` and `examples/catalog.json`: runnable hosts and ownership.
- `CONTRIBUTING.md` and `docs/verification.md`: development and test workflow.
- `docs/release.md`: publication safeguards. A tag is not a registry release.
- `docs/adr/0001-standalone-annotations-product.md`: standalone product decision.

## Checks and hazards

Run `npm run check` before a PR is ready to merge. For documentation work also
keep executable snippets in `test/docs/` synchronized, route guides in
`docs/README.md`, and run `npm run test:site` for published navigation changes.
Do not remove evidence or weaken checks to make a documentation move pass.

Examples track the checked-out source and published demos track `main`; both
can be ahead of npm. Do not silently turn example-only editing or Worker code
into a promised package API. Do not publish or bypass release approvals as part
of a documentation-only change.

Run `repo-instruction-audit --repo .` after changing agent instructions or
documentation routing. Do not add repository `CLAUDE.md` files.
