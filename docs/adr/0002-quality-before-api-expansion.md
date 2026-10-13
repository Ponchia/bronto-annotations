# ADR 0002: Improve consumer outcomes before expanding the API

Status: accepted, October 2026

## Decision

Prioritize understandable integrations and measured layout quality over new
adapters, more public exports, or a package-owned editor. The package remains a
headless annotation engine with optional renderers and host adapters. There is
no repository consolidation, new runtime dependency, or new public subpath.

The immediate workload is an existing chart, diagram, or report with roughly
5–20 explanatory annotations. Dense layouts remain supported, but a faster
200-note synthetic benchmark does not establish interactive usability.

Preserve exact placement ordering and public diagnostics when optimizing bounded
candidate retention. A shortlist that silently changes the winning placement is
not an equivalent implementation. Timing improvements require same-input,
same-machine comparisons; quality must be checked independently of latency.

## Internal boundaries

`core/layout.ts` remains the public compatibility facade. Ordinary resolution
and refinement live in `layout-resolver.ts`; experimental incremental sessions
live in `incremental-layout.ts`; deterministic priority ordering is shared.
React's ordinary renderer imports the resolver directly, without importing the
incremental session as part of its internal dependency graph.

`presets/index.ts` remains the public preset facade. Simple callouts live in
`basic.ts`, shared construction in `model.ts`, migration types in `d3-types.ts`,
and the D3-style conversion/authoring bridge in `d3-style.ts`. These internal
modules are not additional package entry points. Existing export and declaration
checks continue enforcing the same consumer contract.

React interaction and layout orchestration remain in `AnnotationLayer.tsx`.
Memoized note/edit-handle rendering and the measured copy share
`annotation-presentation.tsx`; diagnostic SVG overlays live in
`quality-overlay.tsx`. This separation does not change gesture, measurement,
focus, or memoization semantics.

## Diagnostics and transport

Retained placement candidates are useful diagnostics, not persisted application
state. Applications should deliberately bound retention where they do not need
the entire search graph. Keep the existing complete diagnostic default for
compatibility. Do not add a second public Worker protocol or strip fields from
resolved layouts without a separately reviewed API decision.

Hosts continue owning note state, validation of imported data, undo/redo,
Worker scheduling, revision acceptance, and persistence. Examples demonstrate
those responsibilities rather than expanding this package's contract.

## Evidence and release criteria

A feasible fixture must retain every expected note, valid finite geometry,
readable text, and reviewed bounds/collision budgets. An impossible fixture must
report its collisions rather than hide notes or be described as a successful
layout. Negative-control tests must demonstrate that regressions fail the gate.

Pinned, attributed upstream chart/diagram inputs complement authored geometry
fixtures. Rendering another project's example is integration evidence, not
independent adoption or endorsement. A production-adoption claim requires an
independent maintainer actually choosing and using the package.

Cross-browser interaction results are scoped to the tested scenarios, engines,
viewports and versions. Automated accessibility checks do not establish manual
screen-reader or physical-device usability.

New APIs should follow documented consumer friction in more than one use case,
not completion of an internal feature checklist. Historical readiness manifests
remain evidence; they are not the product roadmap.
