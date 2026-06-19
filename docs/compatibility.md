# Compatibility Matrix

This matrix records the supported integration surface for `0.1.x`.
`npm run test:compatibility` checks the package metadata, optional-peer
metadata, CI Node lanes, this document, and the packed-smoke evidence so the
declared support policy cannot drift silently.

| Surface | Supported Range | Verification |
| --- | --- | --- |
| Node.js | `>=20.19.0`, CI on Node 20 and Node 22 | `npm run test:compatibility`, GitHub CI, `npm run check` |
| TypeScript | `>=5.8` | `npm run test:compatibility`, `npm run test:types` |
| React | `>=18.2.0 || >=19.0.0` | React 18/React 19 peer range, React unit tests, packed React smoke, browser examples |
| React DOM | `>=18.2.0 || >=19.0.0` | React SSR/client smoke |
| Vega | `>=5.0.0 || >=6.0.0` | Vega 5/Vega 6 peer range, Vega unit tests, Vega-Lite compile test, browser example |
| Mermaid | `>=11.0.0` | Mermaid SVG extraction tests and browser example |
| D2 | `>=0.1.0` | D2 diagram/SVG tests and browser example |
| React Flow | `>=12.0.0` | Public-state tests and browser example |
| Browsers | Modern Chromium-class SVG/DOM APIs | Playwright browser verification |

optional peers are marked optional in `package.json`. Root imports must work
without React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui` installed.

## Checked Lanes

- Node 20 and Node 22 run the full GitHub CI `npm run check` job.
- TypeScript 5.8 is the declaration and export-check lane.
- React 19 is the current packed-consumer/runtime lane. React 18 remains in the
  supported peer range for `0.1.x`; before widening beyond `0.1.x`, run a clean
  React 18 consumer smoke and record it here.
- Vega 6 is the current generated-surface runtime lane. Vega 5 remains in the
  supported peer range for `0.1.x`; before widening beyond `0.1.x`, run a clean
  Vega 5 consumer smoke and record it here.
- Mermaid 11, D2 0.1, and React Flow 12 are covered by unit tests, packed
  adapter smoke, and browser examples.

## Policy

- Any peer range change must update this matrix, package metadata, docs, and
  packed-consumer smoke coverage.
- New generated-surface adapters must document their host public API boundary
  and must not add runtime dependencies to the root import.
