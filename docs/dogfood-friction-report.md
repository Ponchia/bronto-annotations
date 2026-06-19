# Dogfood Friction Report Template

Use this template when integrating `@ponchia/annotations` into a real consumer.
The goal is to expose API friction before the package makes stronger public
stability promises.

## Consumer

- Host app or report:
- Surface type: SVG, DOM/report, React, Vega/Vega-Lite, Mermaid, D2, React Flow
- Package source: local tarball, registry canary, or workspace link
- Commit/version:

## Integration Path

- Public imports used:
- Adapter/helper used:
- Bounds source:
- Anchor source:
- Obstacles source:
- Manual placement needed: yes/no
- Target-alignment checks used: yes/no
- Layout-quality checks used: yes/no

## Friction

| Area | Observation | Severity | Proposed Fix |
| --- | --- | --- | --- |
| API naming |  | low/medium/high |  |
| Coordinate space |  | low/medium/high |  |
| Generated geometry timing |  | low/medium/high |  |
| Styling |  | low/medium/high |  |
| Accessibility |  | low/medium/high |  |
| Performance |  | low/medium/high |  |
| Docs/examples |  | low/medium/high |  |

## Outcome

- Would ship with this API today: yes/no
- Required package changes before public release:
- Changes that can wait:
- Screenshots or browser evidence:
