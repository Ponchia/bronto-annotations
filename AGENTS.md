# Agent Notes

This project is an incubation home for the future public
`@ponchia/annotations` package.

## Public Boundary

- Assume the repository will become public. Keep docs, examples, comments, and
  commit messages free of private project names, personal data, credentials,
  internal URLs, or consumer-specific details.
- Refer to downstream use as "a consumer", "a host app", "a report", "a chart",
  or "a diagram" unless a public integration is named explicitly.

## Product Boundary

- This package owns annotation models, anchors, placement, collision handling,
  geometry, and renderer/integration adapters.
- It does not own a chart engine, graph renderer, diagram renderer, application
  state, persistence, routing, workflow execution, or command/action registry.
- `@ponchia/ui` remains the visual language and CSS-first design system. This
  package may emit Bronto-compatible classes or ship an optional Bronto styling
  bridge, but the headless core should remain useful without Bronto.

## Starting Points

- `README.md` describes the product intent and tentative package shape.
- `docs/e2e-plan.md` is the implementation guide for scaffolding, APIs,
  milestones, examples, and validation.
- `docs/adr/0001-standalone-annotations-product.md` records why this is a
  sibling project instead of more surface inside `@ponchia/ui`.
