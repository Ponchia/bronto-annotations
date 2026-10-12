# Styling annotations

[Documentation index](README.md) · [First annotation](getting-started.md)

Use the optional CSS bridge or your own styles to control how annotations
look without adopting a design system.

## Styling

`@ponchia/annotations/bronto.css` styles the emitted `pa-annotation*` classes and
the legacy `ui-annotation*` static-SVG classes from `@ponchia/ui/annotations`.
It is safe to import with or without `@ponchia/ui`. When `@ponchia/ui` tokens are
present it follows `--bronto-*` annotation tokens and the legacy `--accent`,
`--panel`, `--line`, `--line-strong`, `--text`, `--text-dim`, `--mono`, motion,
radius, and focus-ring tokens; otherwise it uses standalone fallbacks. It is a
CSS bridge only; there is no hard `@ponchia/ui`
dependency.

Annotations can carry Bronto-compatible visual hints without importing
`@ponchia/ui`:

```ts
const annotation: Annotation = {
  id: 'risk-band',
  anchor: { type: 'box', box: { x: 40, y: 80, width: 180, height: 64 } },
  note: { title: 'Risk band' },
  variant: 'band',
  tone: 'warning',
  motion: 'draw'
};
```

Annotations can also carry per-item CSS variable overrides. The SVG and React
renderers attach them to the annotation group, so host apps can accent a single
callout without global CSS:

```ts
const annotation: Annotation = {
  id: 'peak',
  anchor: { type: 'point', point: { x: 240, y: 96 } },
  note: { title: 'Peak' },
  style: {
    color: '#d12f6a',
    lineColor: '#d12f6a',
    noteBackground: '#fff7fb',
    subjectFill: 'rgba(209, 47, 106, 0.14)',
    vars: { '--custom-annotation-token': 'demo' }
  }
};
```

`annotationStyleVariables(style)` exposes the same mapping for custom renderers.
The built-in keys map to stable `--pa-annotation-*` variables and compatibility
`--annotation-*` variables where useful; extra `vars` must be valid custom
property names beginning with `--`.

For custom renderers or migrated static SVG snippets, use the class recipe
helpers instead of rebuilding class strings by hand:

```ts
import {
  annotationClassName,
  brontoAnnotationClassName
} from '@ponchia/annotations';

annotationClassName({ variant: 'badge', tone: 'warning', motion: 'pulse' });
// "pa-annotation pa-annotation--badge pa-annotation--warning pa-annotation--pulse"

brontoAnnotationClassName({ variant: 'bracket', tone: 'info', motion: 'draw' });
// "ui-annotation ui-annotation--bracket ui-annotation--info ui-annotation--draw"
```

Variants include `label`, `callout`, `elbow`, `curve`, `circle`, `rect`,
`threshold`, `badge`, `bracket`, `band`, `slope`, `compare`, `cluster`, `axis`,
`timeline`, and `evidence`. Tones are `accent`, `muted`, `success`, `warning`,
`danger`, and `info`; motion hints are `draw`, `reveal`, `pulse`, and `focus`.
The CSS bridge styles notes, debug boxes, layout-quality issue boxes, edit
handles, and subject/connector parts, including compact badge markers and
Bronto-compatible note rule lines.
Annotation overlays are pointer-transparent by default so host charts and
diagrams keep receiving clicks; edit handles opt back into pointer events for
authoring. Static SVG output can expose tabbable notes via `noteTabIndex` and
tabbable edit handles via `editHandleTabIndex` for host-wired navigation or
authoring. The bridge also keeps migrated `ui-annotation*` report snippets
legible with the old paint-order text halo, evidence/badge styles, and motion
names, and respects print, forced-colors, and reduced-motion preferences.
