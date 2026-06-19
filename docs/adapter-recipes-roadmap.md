# Adapter Recipes Roadmap

The existing examples prove the adapter paths. These deeper recipes should be
added before a broad public release.

Current proof lives in `docs/adapter-recipes-proof.md`. Keep this roadmap for
the remaining browser/live coverage gaps rather than treating every bullet as
unstarted work.

## Vega/Vega-Lite

- Vega-Lite compile-to-Vega recipe with scenegraph anchors.
- Rendered SVG mark metadata recipe for exported charts.
- Axis/legend obstacle recipe for dense analytical charts.

## Mermaid

- Flowchart node and edge recipe.
- Sequence diagram participant/message recipe.
- Class/data-selector recipe for diagrams with translated labels.

## D2

- Nested diagram shape recipe.
- Connection route and edge-label recipe.
- Rendered SVG-only recipe for consumers that do not keep compile output.

## React Flow

- Zoom/pan coordinate recipe using public viewport state.
- Measured handle recipe with fallback diagnostics.
- Edit-patch recipe for moving notes and anchors.

## Acceptance Criteria

Each recipe should include public imports, host geometry timing, anchor specs,
obstacles, target-alignment assertions, layout-quality assertions, and browser
verification evidence.
