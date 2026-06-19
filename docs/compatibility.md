# Compatibility Matrix

This matrix records the supported integration surface for `0.1.x`.
`npm run test:compatibility` checks the package metadata, optional-peer
metadata, CI Node lanes, this document, and the packed-smoke evidence so the
declared support policy cannot drift silently. `npm run
test:compatibility:lanes` installs focused clean consumers for older declared
peer lanes.

| Surface | Supported Range | Verification |
| --- | --- | --- |
| Node.js | `>=20.19.0`, CI on Node 20 and Node 22 | `npm run test:compatibility`, GitHub CI, `npm run check` |
| TypeScript | `>=5.8` | TypeScript 6.0 build/types gate, TypeScript 5.8 clean consumer, `npm run test:compatibility` |
| React | `>=18.2.0 || >=19.0.0` | React 18 clean consumer, React 19 packed smoke, React unit tests, browser examples |
| React DOM | `>=18.2.0 || >=19.0.0` | React SSR/client smoke |
| Vega | `>=5.0.0 || >=6.0.0` | Vega 5 clean consumer, Vega 6 packed smoke, Vega unit tests, Vega-Lite compile test, browser example |
| Mermaid | `>=11.0.0` | Mermaid SVG extraction tests and browser example |
| D2 | `>=0.1.0` | D2 diagram/SVG tests and browser example |
| React Flow | `>=12.0.0` | Public-state tests and browser example |
| Browsers | Modern Chromium-class SVG/DOM APIs | Playwright browser verification |

optional peers are marked optional in `package.json`. Root imports must work
without React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui` installed.

## Checked Lanes

- Node 20 and Node 22 run the full GitHub CI `npm run check` job.
- TypeScript 6.0 is the declaration and export-check lane.
- TypeScript 5.8 is covered by `npm run test:compatibility:lanes`, which
  installs `typescript@5.8.3` in a clean consumer and compiles the packed root,
  DOM, Mermaid, and Vega declarations.
- React 18 is covered by `npm run test:compatibility:lanes`, which installs
  `react@18.2.0` and `react-dom@18.2.0` in a clean consumer and verifies SSR,
  client rendering, layout events, and quality events.
- React 19 is covered by the packed React smoke, browser examples, and adapter
  browser smoke.
- Vega 5 is covered by `npm run test:compatibility:lanes`, which installs
  `vega@5` in a clean consumer, creates a real `vega.View`, and verifies view
  data anchors, scenegraph anchors, target alignment, layout quality, and SVG
  rendering.
- Vega 6 is covered by the packed adapter browser smoke and Vega/Vega-Lite unit
  tests.
- Mermaid 11, D2 0.1, and React Flow 12 are covered by unit tests, packed
  adapter smoke, and browser examples.

## Policy

- Any peer range change must update this matrix, package metadata, docs, and
  packed-consumer smoke coverage.
- New generated-surface adapters must document their host public API boundary
  and must not add runtime dependencies to the root import.
