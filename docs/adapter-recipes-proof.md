# Deep Adapter Recipes Proof

This report records the generated-surface adapter recipes that are already
covered by tests, browser examples, and package-consumer smoke. It complements
`docs/adapter-recipes-roadmap.md`, which remains the forward-looking checklist
for broader public-release hardening.

## Vega-Lite Compile-To-Vega

Status: proven in adapter tests and browser example coverage.

- `test/adapters/vega.test.ts` compiles a Vega-Lite spec through public
  `vega-lite` and `vega` APIs, runs a Vega `View`, and anchors to the generated
  scenegraph mark by `markName`, `markType`, and datum predicate.
- `examples/vega-basic` and `scripts/verify-examples-browser.mjs` verify
  rendered Vega marks, target alignment, generated obstacles, visible notes,
  visible connectors, and screenshot evidence.

## Mermaid Flowchart And Sequence SVG

Status: flowchart browser-proven; sequence SVG fixture proven in adapter tests.

- `examples/mermaid-basic` renders a real Mermaid flowchart, annotates rendered
  node labels and a rendered edge route, and browser verification checks target
  alignment against actual Mermaid SVG nodes and paths.
- `test/adapters/mermaid.test.ts` covers a Mermaid sequence-style SVG fixture
  with participant, message label, and message route anchors using labels,
  `data-message-id`, and `data-edge-id`.
- `src/adapters/mermaid.ts` treats common sequence classes such as `actor`,
  `messageText`, `messageLine0`, and `messageLine1` as default obstacles.

## D2 Nested Diagrams And Routes

Status: nested compiled geometry is test-proven; rendered D2 SVG and route
anchors are browser-proven in the basic example.

- `test/adapters/d2.test.ts` walks nested diagram shapes, layer shapes, and
  generated connection routes from compiled D2 geometry.
- `examples/d2-basic` and browser verification check rendered D2 shapes and
  connection routes through target-alignment assertions.
- SVG-only consumers are covered by rendered SVG selectors, classes, labels,
  data attributes, shape ids, and connection ids in the D2 adapter tests.

## React Flow Viewport, Handles, And Editing

Status: public state, transformed viewport coordinates, measured handles, edge
anchors, and host-owned edit patches are browser-proven and test-proven.

- `test/adapters/react-flow.test.ts` normalizes node boxes through viewport
  `x`, `y`, and `zoom`, uses measured handle geometry before fallback side
  anchors, and extracts node, handle, and edge obstacles.
- `examples/react-flow-basic` runs with a non-identity React Flow viewport,
  verifies rendered nodes, edges, and handles against public adapter output in
  the browser, and persists a dragged note edit as a host-owned annotation patch.
- `test/adapters/authoring-contract.test.ts`, `test/core/edit.test.ts`, and
  `examples/react-basic` cover edit-patch preservation and note/anchor movement
  contracts.

## Remaining Limits

- Mermaid sequence diagrams are not yet represented as a browser example; they
  are currently verified through a rendered SVG fixture.
- The current clean dogfood consumer is synthetic. A real host report or app
  integration should still be used to collect final API-friction feedback
  before widening `0.1.x` stability promises.
