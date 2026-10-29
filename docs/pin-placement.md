# Small-target placement

This experimental geometry helper handles two-dimensional comment pins and
small direct labels. It does not replace explanatory-note placement or an
engine's axis/relationship labels. It is available from source main; use a
published release that explicitly includes the export before adopting it.

```ts
import { layoutAnnotationPins } from '@ponchia/annotations';

const result = layoutAnnotationPins([
  { id: 'review-1', point: { x: 120, y: 80 }, size: { width: 44, height: 44 } },
  { id: 'selected', point: { x: 124, y: 82 }, size: { width: 44, height: 44 }, priority: 1 }
], {
  bounds: { x: 0, y: 0, width: 360, height: 240 },
  gap: 4,
  limit: 20
});
```

The selected pin wins this collision. Render every `placements` entry and retain
`omitted` entries in an accessible list with their reasons. Default displacement
is zero: nearby targets are not moved into misleading precise positions. When
opting into `maxDisplacement`, draw the returned leader from `anchor` to `point`.
The search tries a bounded set of alternatives and can report collision even
when an untested location would fit. It never shrinks hit targets to create space.

The host owns visibility, coordinate transforms, current semantic identity,
selection, DOM measurements, observers, keyboard focus and stored discussions.
Project to screen space before layout for constant-sized controls on a zoomed
canvas, and clip to the actual visible surface rather than the whole document.
Pass protected toolbar rectangles as obstacles. Do not report suppressed visual
pins as deleted discussions, and do not label every admitted layout accessible
merely because its rectangles are disjoint.

Tests exercise impossible/narrow scenes, duplicate and unusual IDs, selected
priority, bounds, explicit leaders and exact accounting. Physical touch, stylus
and screen-reader review remain separate human acceptance work.
