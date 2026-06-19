# Compatibility Matrix

This matrix records the supported integration surface for `0.1.x`.

| Surface | Supported Range | Verification |
| --- | --- | --- |
| Node.js | `>=20.19.0`, CI on Node 20 and Node 22 | GitHub CI, `npm run check` |
| TypeScript | `>=5.8` | `npm run test:types` |
| React | `>=18.2.0 || >=19.0.0` | React unit tests, packed React smoke, browser examples |
| React DOM | `>=18.2.0 || >=19.0.0` | React SSR/client smoke |
| Vega | `>=5.0.0 || >=6.0.0` | Vega unit tests, Vega-Lite compile test, browser example |
| Mermaid | `>=11.0.0` | Mermaid SVG extraction tests and browser example |
| D2 | `>=0.1.0` | D2 diagram/SVG tests and browser example |
| React Flow | `>=12.0.0` | Public-state tests and browser example |
| Browsers | Modern Chromium-class SVG/DOM APIs | Playwright browser verification |

optional peers are marked optional in `package.json`. Root imports must work
without React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui` installed.

## Policy

- Any peer range change must update this matrix, package metadata, docs, and
  packed-consumer smoke coverage.
- New generated-surface adapters must document their host public API boundary
  and must not add runtime dependencies to the root import.
