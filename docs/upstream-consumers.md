# Validate pinned upstream consumers

This harness renders **upstream-authored inputs** with the installed Vega and
Mermaid development dependencies, then overlays the public annotation package.
It proves compatibility with these particular inputs and renderer versions.
It does not claim that Vega, Mermaid, or their websites adopted this library.

## Reproduce the offline proof

From a clean checkout, install dependencies and the requested Playwright browser,
then run the packed-consumer proof:

```sh
npm ci
npx playwright install chromium
npm run test:upstream -- --browser chromium --output-dir browser-evidence/upstream
```

The verifier uses the repository's Playwright dependency directly. No global
browser CLI, private checkout, or upstream build script is required. It creates
isolated browser contexts and closes them after each viewport check. Install
`firefox` or `webkit` through the same Playwright command to test those engines.

`--browser` accepts `chromium` (default), `firefox`, or `webkit`. Both desktop
(1360 × 1000) and narrow (390 × 844) run sequentially. Chromium and WebKit
use touch-emulated mobile contexts and verify real touch pointer delivery.
Firefox uses a narrow desktop context: the installed engine does not expose
touch emulation, and its result is labeled `narrow-desktop`, not mobile-touch
coverage. The recorded `navigator.maxTouchPoints` is observational: WebKit 27.2
on the CI host reported zero while delivering a native touch pointer to each
fixture. Touch lanes therefore require real per-host `pointerType="touch"`
events, not an advertised capability alone. Missing touch events fail even when
the browser advertises a positive count. Browser calls have deadlines; fixture readiness has a
45-second limit. The source gate alone is inexpensive and needs no browser:

```sh
node scripts/verify-upstream-consumers.mjs --provenance-only
```

The default lane reads only checked-in snapshots. It packs the already-built
package with lifecycle scripts disabled, extracts that tarball in the output
directory, and resolves the fixture's `@ponchia/annotations` imports against
its public export targets. Vite bundles both host renderers and the fixture.
Browser requests outside the local preview server are blocked and fail the
proof. A missing browser, missing input, failed render, failed request, console
error, or assertion failure produces a nonzero exit; none becomes a green skip.

The default output is `.tmp/upstream-consumers`. Choose a fresh `--output-dir`
outside `.tmp` when retaining independent runs; a package build can clean `.tmp`. `results.json` records the package tarball checksum,
annotation Git revision, exact installed host versions, pinned source metadata,
viewport profile, interactions, and measured geometry. A failed run writes
`passed: false` and its error; a run that fails before provenance validation
does not create browser evidence.

## Inputs and attribution

The snapshots live in `test/fixtures/upstream-consumers/inputs`. The manifest
records immutable source URLs, source-file SHA256, retained-input SHA256,
extracted line ranges, expected mark/note counts, and adaptations.

| Input | Pinned upstream source | Retained range | License |
| --- | --- | --- | --- |
| Vega bar chart | [vega/vega, `fdd9ab9d4faf`](https://github.com/vega/vega/blob/fdd9ab9d4faf48553c8dfdbcaf7284f485504aaf/docs/examples/bar-chart.vg.json) | Complete file, lines 1–96 | BSD-3-Clause |
| Vega grouped bar chart | [vega/vega, `fdd9ab9d4faf`](https://github.com/vega/vega/blob/fdd9ab9d4faf48553c8dfdbcaf7284f485504aaf/docs/examples/grouped-bar-chart.vg.json) | Complete file, lines 1–124 | BSD-3-Clause |
| Mermaid client/services/storage flowchart | [mermaid-js/mermaid, `4e3a85e6d46a`](https://github.com/mermaid-js/mermaid/blob/4e3a85e6d46a0326379e04db3463bb3b53a3ca94/packages/mermaid/src/docs/syntax/flowchart.md#L116-L134) | First “With the defaults” fence, content lines 116–134 | MIT |

The full relevant notices are retained in
`test/fixtures/upstream-consumers/licenses/vega-LICENSE` (University of Washington
Interactive Data Lab) and `mermaid-LICENSE` (Knut Sveidqvist). The source inputs
were read through GitHub's contents API at these commits; no external repository
code or build scripts were executed. Both Vega files are byte-for-byte copies.
The Mermaid snapshot is the byte-for-byte fence content, without its Markdown
fence delimiters. Its full source-document hash is recorded for future online
review; the full document is not vendored, so offline checks validate the
retained fence checksum rather than reconstructing the document hash.

When updating a snapshot, fetch the pinned file through `gh api`, inspect its
authorship, content and license, then deliberately update the reviewed commit,
URL, source-file hash, extracted range and retained-input hash together. The
negative provenance tests reject a changed input or license until its expected
checksum is updated; a floating `main`/`develop` URL also fails. Checksums detect
unreviewed drift, not independent cryptographic proof of authorship.

## Rendering adaptations and assertions

The host data, graph, encodings, dimensions, links and node text remain upstream
authored. Vega uses its SVG renderer and a font-only configuration making axis
and mark text 14px. Its original bar hover signal, red hover fill and value label
are exercised in the browser. Mermaid uses the supported installed 11.x
renderer defaults (Dagre, classic look and default theme), strict security,
16px fonts and `startOnLoad: false`. The develop document describes newer 12.x
defaults; this proof does not test those defaults.

The fixture adds accessible SVG labels, nonsemantic target data attributes and
an external overlay frame. All three hosts have three meaningful callouts:
the bar chart's starting/highest/lowest amounts, the grouped chart's position-2
values across A/B/C, and the flowchart's Web app/API gateway/Orders DB nodes.
`prepareVegaSvgAnnotations` and `prepareMermaidAnnotations` extract rendered
targets and graphic/text obstacles. An additional obstacle protects the entire
host graphic from note boxes. Solver obstacles include 4px clearance for note
strokes. Independently retained, unexpanded protected-content rectangles are
used for painted collision checks, while the package quality report checks the
expanded solver obstacles. No actual painted overlap is permitted. Placement is automatic with explicit
`maxCandidates: 8`, two refinement passes and eight retained candidates per
annotation. Candidate offsets include exact clearance distances derived from each target
and the measured host boundary with a 12px gap. Coarse offsets alone initially
left a 1px overlap with the protected chart frame; the proof rejected it.
No manual note positions or approximate placement behavior are required.

Each viewport checks the complete host mark count, exactly three notes and
connectors, successful anchor validation/alignment, and finite geometry.
Independent client rectangles must agree with adapter targets within 0.25 CSS
pixels. Note fill geometry is independently transformed from SVG `getBBox` and
compared with resolved layout within the same tolerance. The browser client
rectangle must match either the fill or its measured stroke envelope: Firefox
includes stroke where Chromium excludes it. Collision and bounds checks use
the conservative stroke envelope in every engine, rather than loosening the
geometry tolerance or allowing painted overlap. Painted notes remain inside their frame,
avoid each other, and avoid every protected host obstacle. Actual SVG text
rectangles must fit inside note boxes, and effective host/note text must remain
at least 13.5 CSS pixels. The verifier also checks zero package-reported invalid
boxes, note overflow area, note overlap area and obstacle overlap area.

Connector obstacle/note crossings are recorded quantitatively in the quality
metrics; they are not acceptance failures. Straight connectors to interior
marks necessarily traverse some host space. This lane protects host content
from **notes**, and does not promise collision-free connector routing.

## Inspect the gallery and screenshots

`gallery/` contains the complete bundled gallery, original-input disclosures,
source attribution, adaptation lists and all overlays. Serve that directory
with any local static HTTP server to inspect it; do not open it as a `file:` URL.
Each host has a complete native-size PNG for each viewport. Mobile also has a
viewport PNG showing the centered, horizontally scrolled host. The mobile lane
verifies keyboard scrolling in all engines and emulated touch pointer delivery
in Chromium/WebKit. It keeps document
overflow contained in focusable graphic scrollers rather than shrinking
desktop text. A complete graphic can require horizontal navigation on a phone;
these screenshots do not claim a reflowed diagram or physical-device testing.

The fixture and its helpers remain verification code, outside the public
package API. Node 22 CI runs the Chromium packed-consumer proof, and the
experimental cross-browser lane runs Firefox and WebKit. Browser JSON and
screenshots are retained as CI artifacts. No package version, publication
policy, or supported public export changes are required.

The optional live public-website smoke is not implemented here. This evidence
is a pinned offline upstream-input proof, not a live website annotation test.

## Production consumer trial

A maintainer evaluating an actual application should record the installed
package version, host library versions, annotation count, integration code and
coordinate/measurement setup. Test changing data, viewport size, fonts and note
text, then record any manual placement or custom glue required. Preserve a
small reproducible example of each failure rather than adding an adapter API
for a single host.

The trial is complete when another maintainer can reproduce it, verify readable
notes and keyboard access in their real application, and explain whether the
library reduced their integration work. Automated upstream examples are useful
preparation, but do not replace that independent feedback or manual assistive-
technology and physical-device checks.
