# Dogfood Bronto Report

This report records a real report-grammar dogfood pass for
`@ponchia/annotations`. It uses a clean Vite consumer that installs the packed
annotations tarball plus the public `@ponchia/ui` package, then annotates a
static report surface built with `@ponchia/ui` report classes.

## Consumer

- Host app or report: clean Vite report using public `@ponchia/ui` report CSS
- Surface type: report stat cards, SVG report chart, and report table row
- Package source: local packed tarball installed into
  `.tmp/dogfood-bronto-report`
- Styling source: `@ponchia/ui@0.6.8` plus `@ponchia/annotations/bronto.css`
- Commit/version: current checkout via `npm pack`

## Integration Path

- Public imports used:
  - `@ponchia/annotations`
  - `@ponchia/annotations/dom`
  - `@ponchia/annotations/bronto.css`
  - `@ponchia/ui`
  - `@ponchia/ui/css/report.css`
  - `@ponchia/ui/css/dataviz.css`
  - `@ponchia/ui/css/legend.css`
- Adapter/helper used:
  - `prepareDomAnnotations`
  - `annotationFrameFromSvg`
  - `resolvePreparedAnnotationLayout`
  - `renderAnnotationsSvg`
- Bounds source:
  - Report stat section: `getBoundingClientRect()`
  - Report chart: SVG `viewBox` expanded with `annotationFrameFromSvg()`
- Anchor source:
  - Rendered report stat cards via `data-report-region`
  - Rendered SVG chart bars via `data-series`
  - Rendered report table row via `data-import-row`
- Obstacles source:
  - Report stat cards
  - SVG chart bars
- Manual placement needed: yes, for editorial report stat and table-row notes
- Target-alignment checks used: yes
- Layout-quality checks used: yes

## Evidence

`npm run test:dogfood:bronto-report` proves the integration by:

- Packing the annotations package with `npm pack`
- Installing the tarball plus public `@ponchia/ui@0.6.8` into a clean Vite
  consumer
- Rendering an `@ponchia/ui` static report surface in Chromium
- Verifying no console errors
- Verifying four rendered annotation notes and connectors
- Verifying report DOM and SVG chart anchor validation
- Verifying generated-target alignment for report stat cards, SVG bars, and a
  report table row
- Capturing `.tmp-dogfood/dogfood-bronto-report.png`

## Friction

| Area | Observation | Severity | Proposed Fix |
| --- | --- | --- | --- |
| Manual placement | Manual coordinates are top-left note coordinates, which is precise but easy to place over the target on the first attempt. | medium | Add an authoring/debug affordance that shows the note box while dragging and reports overlap warnings inline. |
| Mixed DOM/SVG roots | A single `prepareDomAnnotations` call can mix DOM and SVG anchors, but the root must contain every selector while each spec still carries the right coordinate space. | medium | Add a combined report recipe that explicitly shows mixed roots and per-anchor coordinate spaces. |
| Report styling | `@ponchia/annotations/bronto.css` coexists with public `@ponchia/ui` report, dataviz, and legend CSS without a hard UI dependency. | low | No package change required. |
| API stability | The prepared-layout API remains the right path for report builds because it centralizes validation, target alignment, and quality assertions. | low | Keep this as the recommended report integration path. |

## Outcome

- Would ship with this API today: yes for `0.1.x` report dogfood and canary use
- Required package changes before public release: none blocking from this pass
- Changes that should happen before a broader public release: combined report
  recipe and optional authoring/debug layer for manual note placement
- Screenshots or browser evidence: `.tmp-dogfood/dogfood-bronto-report.png`
  from `npm run test:dogfood:bronto-report`
