# Migrating to the 0.7 API

The source branch is a **0.7.0 development preview**, not a published release.
Do not expect an existing 0.6.x installation to implement this guide. Build and
pack this revision to test it in a separate consumer before upgrading a live
application. No runtime dependencies or persistence service are added.

## Why change the contract?

A renderable layout should not require retaining every discarded placement.
Diagnostic retention should not change the chosen layout. A React renderer
should have one source of geometry, not both a resolved layout and a second
copy of its input. D3 migration helpers should be opt-in rather than occupying
the main import surface.

## Normal layouts are lean

The ordinary call keeps its name and basic input shape:

```ts
import { resolveAnnotationLayout, renderAnnotationsSvg } from '@ponchia/annotations';

const layout = resolveAnnotationLayout({ annotations, bounds, noteSizes });
const svg = renderAnnotationsSvg(layout);
```

`layout.annotations` contains the chosen placements. `placement.candidates` is
removed. `layout.diagnostics` is absent unless requested. This changes both
the default output and the work performed: unrefined solves need the winning
candidate, not a fully routed graph of all alternatives.

To inspect alternatives explicitly:

```ts
const inspected = resolveAnnotationLayout({
  annotations,
  bounds,
  noteSizes,
  diagnostics: { candidates: 8 }
});

for (const diagnostic of inspected.diagnostics!.annotations) {
  console.log(diagnostic.id, diagnostic.candidates);
}
```

Use `diagnostics: { candidates: 'all' }` only when exhaustive alternative
inspection is needed. Numeric limits must be positive safe integers. Diagnostic
entries are an ordered array of IDs and candidates, not an object keyed by
untrusted IDs. IDs such as `__proto__` remain valid.

## Separate diagnostics from refinement

Remove `placement.maxCandidates` from global and per-note preferences. It mixed
output retention with the refinement search space. The runtime rejects it with
migration guidance rather than silently ignoring an old JavaScript option.

Choose the solver's refinement frontier independently:

```ts
const layout = resolveAnnotationLayout({
  annotations,
  bounds,
  refinement: { passes: 2, maxCandidatesPerAnnotation: 32 },
  diagnostics: { candidates: 8 }
});
```

Omitting diagnostics or requesting 1, 8, or all diagnostic candidates must not
change these winners. The internal refinement frontier is still 32. Diagnostics
record the ranked alternatives from the greedy pass; a refined final placement
is authoritative in `layout.annotations`, and may not appear in a short
retained diagnostic list.

`refineAnnotationLayout(layout)` is no longer a root export. Keep the host's
annotation inputs and request `refinement` during resolution. A render snapshot
is not a reusable solver workspace. Persist authored annotations, not diagnostics.

Low-level candidate inspection remains explicit:

```ts
allPlacementCandidates(candidateInput, { limit: 8 });
```

Its separate `limit` parameter replaces `candidateInput.placement.maxCandidates`.
It is an exact ranked-result limit, not a hard latency budget. With no limit,
this low-level diagnostic operation deliberately returns all alternatives.

## React: inputs or a layout, never both

The convenience path continues to own resolution and optional measurement:

```tsx
<AnnotationLayer annotations={annotations} bounds={bounds} measure="dom" />
```

For externally resolved or incremental layouts, replace `resolvedLayout` with
`layout` and remove duplicated solver inputs:

```tsx
<AnnotationLayer
  layout={session.layout}
  editable={{ includeAnchor: true }}
  previewEdits
  onEditEnd={handleCommittedEdit}
/>
```

The renderer derives bounds, annotation sources and note sizes from that layout.
Do not also pass `annotations`, `bounds`, `placement`, `noteSizes`, `refinement`,
`obstacles`, `padding`, `diagnostics`, or `measure`. The public TypeScript union
and runtime checks reject mixed modes. The render-only mode does not solve or
measure; the host updates its session when it accepts an edit.

SVG and externally resolved React debug rendering can display only diagnostics
already present. It never secretly resolves another layout to obtain them.

The example-only Worker protocols use full snapshots when diagnostic graphs
are present, preserving aliases between candidates and winning geometry. Lean
responses still use the existing safe structural-sharing/patch path. This is a
consumer recipe, not a new public Worker API.

## D3 migration has its own import

Change migration-specific imports:

```ts
import { annotationFromD3Style, createD3StyleAnnotationBuilder }
  from '@ponchia/annotations/d3';
import type { D3StyleAnnotationInput } from '@ponchia/annotations/d3';
```

The helper behavior is unchanged. Normal `pointCallout`, `regionCallout`,
`encircleCallout`, `thresholdAnnotation`, and `badgeAnnotation` presets remain
at `@ponchia/annotations`. Importing the root no longer loads the migration
implementation through a presets barrel.

## Upgrade verification

Run your typecheck against the packed preview, then exercise ordinary layout,
measured React content and committed edits. Search host code for
`placement.candidates`, `maxCandidates`, `resolvedLayout`, and D3-specific root
imports. `maxCandidatesPerAnnotation` is still a valid refinement option.

Compare chosen geometry and quality at the same refinement settings. The old
0.6.x retention option could limit refinement, so an old eight-candidate setup
should set `refinement.maxCandidatesPerAnnotation: 8` explicitly when retaining
that search policy. Do not compare only serialized sizes and assume quality is
the same. The repository includes parity, negative API/type, browser and
packed-consumer tests for this migration.
