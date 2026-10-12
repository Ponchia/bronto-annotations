# Compatibility Matrix

This matrix records the supported pre-1.0 integration surface.
`npm run test:compatibility` checks the package metadata, optional-peer
metadata, CI Node lanes, this document, and the packed-smoke evidence so the
declared support policy cannot drift silently. `npm run
test:compatibility:lanes` installs focused clean consumers for older declared
peer lanes.

| Surface | Supported Range | Verification |
| --- | --- | --- |
| Node.js | `>=20.19.0`, CI on Node 20 and Node 22 | `npm run test:compatibility`, GitHub CI, `npm run check` |
| TypeScript | `>=5.8` | TypeScript 6.0 build/types gate; TypeScript 5.8 clean consumer and TypeScript 7.0 isolated declaration consumer, `npm run test:compatibility` |
| React | `>=18.2.0 || >=19.0.0` | React 18 clean consumer, React 19 packed smoke, React unit tests, browser examples |
| React DOM | `>=18.2.0 || >=19.0.0` | React SSR/client smoke |
| Vega | `>=5.0.0 || >=6.0.0` | Vega 5 clean consumer, Vega 6 packed smoke, Vega unit tests, Vega-Lite compile test, browser example |
| Mermaid | `>=11.0.0` | Mermaid 11 SVG extraction/browser example on Node 20 and 22; isolated Mermaid 12.1 browser consumer on Node 22 only |
| D2 | `>=0.1.0` | D2 diagram/SVG tests and browser example |
| React Flow | `>=12.0.0` | Public-state tests and browser example |
| Browsers | Modern Chromium-class SVG/DOM APIs | Mandatory Chromium Playwright verification; experimental opt-in Firefox/WebKit real editing/Worker smoke |

optional peers are marked optional in `package.json`. Root imports must work
without React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui` installed.

### Experimental browser-portability check

`npm run test:browser:cross` exercises the published React incremental-editor
and native module Worker demos in **Firefox and WebKit** at 1200px and 390px.
It verifies a visible pointer-move preview before commit, stable unchanged
placements, note editing focus, quality checks, obsolete/cancelled Worker
responses, fresh-layout parity and mobile horizontal navigation. This is
separate from mandatory Chromium CI until repeated runs on supported hosts
establish a stable cross-browser support policy. Install missing browsers with
`npx playwright install --with-deps firefox webkit`. Neither this check nor
the existing Chromium timing metrics promise a frame rate.

## Checked Lanes

- Node 20 and Node 22 run the full GitHub CI `npm run check` job.
- TypeScript 6.0 is the declaration and export-check lane.
- TypeScript 5.8 is covered by `npm run test:compatibility:lanes`, which
  installs `typescript@5.8.3` in a clean consumer and compiles the packed root,
  DOM, Mermaid, and Vega declarations.
- TypeScript 7.0.2 is covered by the isolated
  `npm run test:compatibility:typescript7` command, run in protected Node 20
  and Node 22 CI. It installs a **packed** copy of `@ponchia/annotations`
  beside TypeScript 7, React 19 and public React declarations, then typechecks
  strict consumers of the headless incremental APIs, DOM, Mermaid and Vega
  adapter types, and the controlled React component. This verifies new
  consumers **without** replacing TypeScript 6.0 in the repository build or
  dropping TypeScript 5.8 verification. The major-version Dependabot deferral
  remains until a deliberate decision to adopt TypeScript 7 as the build
  compiler and to reverify lower compiler versions after that change.
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
- The **next test-runner** lane is `npm run test:compatibility:test-runners-next`:
  on Node >=22.22.2 (or >=24.15), a disposable copy of the complete tracked
  repository is installed with **Vitest 5.0.3 and jsdom 30.1.2**, then runs
  the real TypeScript build/typecheck and entire unit test suite. This uses
  fresh isolated dependencies, not the primary lockfile, and does **not**
  change the publicly supported Node `>=20.19.0` runtime. Vitest 5 requires
  Node >=22.12 and jsdom 30 requires >=22.22.2; they therefore run only in
  the Node 22 protected CI lane. The normal `npm run check` continues to use
  Vitest 4 and jsdom 29 on both Node 20 and 22. Keep their Dependabot major
  deferrals until any default-runner change is deliberately considered.
- Mermaid 12.1 declares **Node >=22.12.0** and cannot replace the Mermaid 11
  test peer while this annotations package supports Node 20. The Node 22-only
  `npm run test:compatibility:mermaid12` lane installs the **packed** library
  and Mermaid 12.1 into an isolated Vite consumer, then validates rendered
  flowchart and sequence SVG anchors, edge/translated-label hooks, seven
  actual annotations, target alignment and geometry on desktop/mobile in
  Chromium. CI executes this only on the Node 22 lane, keeping Mermaid 11
  covered in the Node 20 lane. This is verification of one supported newer
  host version, **not** a declaration that Mermaid 12 runs on Node 20.
  Do not remove the conservative Dependabot Mermaid-major deferral until
  the Node 20/22 peer-strategy is reviewed separately.

## Policy

- Any peer range change must update this matrix, package metadata, docs, and
  packed-consumer smoke coverage.
- New generated-surface adapters must document their host public API boundary
  and must not add runtime dependencies to the root import.
