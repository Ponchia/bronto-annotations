# Visual Regression Baselines

The package captures browser screenshots, checks that they are non-empty,
styled, and varied, and compares decoded screenshot metrics against approved
visual baselines.

## Current Evidence

- `scripts/verify-examples-browser.mjs` renders every example at desktop and
  mobile viewports and captures screenshots.
- `scripts/check-browser-screenshots.mjs` verifies dimensions, non-background
  content, color variety, and contrast-like luminance spread.
- Packed browser consumers also produce screenshots.
- `test/visual-baselines/browser-screenshots.json` stores approved screenshot
  metrics for every example viewport and packed browser consumer.

## Baseline Coverage

Approved visual baselines cover:

- `index`
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

## Update Workflow

Regenerate and approve baselines only when a visual change is intentional:

```bash
npm run test:pack
npm run test:browser
node scripts/check-browser-screenshots.mjs --write-baseline
npm run test:screenshots
```

The manifest records expected dimensions, PNG byte size, color variety,
non-background content, and luminance spread. CI compares new screenshots
against those approved baseline metrics with conservative tolerances, while
the existing smoke checks continue to reject blank or placeholder screenshots.

## Acceptance Policy

- Baselines are updated intentionally in a dedicated commit.
- CI compares new screenshots with approved baselines.
- Diffs fail when annotation notes, connectors, subjects, or host-target
  alignment materially regress.
- The current non-empty screenshot evidence remains as a smoke layer around the
  visual baselines.
