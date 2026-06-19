# ADR 0001: Standalone Annotations Product

Status: accepted and implemented for the current package surface

## Context

`@ponchia/ui` already ships a static annotation surface for explanatory
figures and reports. That surface fits the design-system contract: visual
grammar, token-backed styling, simple SVG helpers, and report-friendly classes.

The intended next direction is larger than a design-system leaf. The annotation
work should support better placement, collision avoidance, React integration,
and adapters for rendered chart, diagram, and flow systems. That kind of work
would introduce its own model, algorithms, adapter contracts, optional peers,
and examples.

Keeping that inside `@ponchia/ui` would blur the current package boundary.
`@ponchia/ui` is CSS-first, zero-runtime by default, and deliberately refuses
application logic, chart scales, renderer ownership, and framework component
APIs.

## Decision

Create a sibling incubation project for a focused annotations package. The
intended public package is:

```text
@ponchia/annotations
```

The package should be headless at its core, with optional renderer and framework
adapters exposed as explicit subpaths.

## Boundary

`@ponchia/annotations` should own:

- annotation data model and schema
- anchors and coordinate normalization
- label placement and collision handling
- connector geometry and path planning
- SVG/DOM output helpers
- React hooks/components over the headless core
- optional adapters for Vega/Vega-Lite-generated geometry, Mermaid-rendered SVG,
  D2 compiled/rendered geometry, and React Flow public state

`@ponchia/annotations` should not own:

- chart scales or data binding
- diagram layout
- graph layout
- host application state
- persistence
- routing
- workflow execution
- global command/action registries
- a full design system

`@ponchia/ui` should remain the visual language. It can keep its current
lightweight static annotation primitive, and this package can emit
Bronto-compatible classes or ship a Bronto styling bridge.

## Consequences

- The annotation engine can grow independently without pulling `@ponchia/ui`
  toward a runtime-heavy integration package.
- Consumers can use the engine without adopting Bronto as their UI framework.
- Bronto consumers still get a first-class path through compatible classes,
  tokens, examples, and docs.
- Adapter dependencies can remain optional and scoped to the subpaths that need
  them.
- The existing `@ponchia/ui/annotations` surface does not need to be removed or
  migrated immediately.

## Implementation Status

The original milestone was to build the smallest proof that validates the
boundary:

1. Headless model and placement API.
2. SVG annotation output.
3. React API over the same core.
4. Bronto-styled example.

That milestone has been expanded into the public package surface described by
`README.md` and `docs/e2e-plan.md`: a DOM-free core, SVG and React renderers,
DOM/SVG utilities, optional adapters for Vega/Vega-Lite, Mermaid, D2, and React
Flow, a Bronto CSS bridge, public examples, packed-consumer smokes, and browser
verification. The expansion keeps the same boundary: host apps still own chart
rendering, diagram parsing/layout, graph layout, application state, persistence,
and design-system decisions.
