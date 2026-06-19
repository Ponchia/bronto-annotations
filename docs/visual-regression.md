# Visual Regression Plan

The package already captures browser screenshots and checks that they are
non-empty, styled, and varied. The next step is baseline comparison.

## Current Evidence

- `scripts/verify-examples-browser.mjs` renders every example at desktop and
  mobile viewports and captures screenshots.
- `scripts/check-browser-screenshots.mjs` verifies dimensions, non-background
  content, color variety, and contrast-like luminance spread.
- Packed browser consumers also produce screenshots.

## Baseline Goal

Add approved visual baselines for:

- `svg-basic`
- `react-basic`
- `bronto-report`
- `dom-basic`
- `vega-basic`
- `mermaid-basic`
- `d2-basic`
- `react-flow-basic`
- `style-gallery`
- packed root/browser consumer
- packed generated-adapter consumer

## Acceptance Policy

- Baselines are updated intentionally in a dedicated commit.
- CI compares new screenshots with approved baselines.
- Diffs fail when annotation notes, connectors, subjects, or host-target
  alignment visibly regress.
- The current non-empty screenshot evidence remains as a smoke layer even after
  pixel baselines exist.
