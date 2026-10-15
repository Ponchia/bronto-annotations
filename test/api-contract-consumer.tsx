import {
  resolveAnnotationLayout,
  renderAnnotationsSvg,
  allPlacementCandidates,
  type Annotation,
  type LayoutDiagnostics,
  type AnnotationPlacementDiagnostics
} from '@ponchia/annotations';
import { annotationFromD3Style, type D3StyleAnnotationInput } from '@ponchia/annotations/d3';
import { AnnotationLayer } from '@ponchia/annotations/react';
// @ts-expect-error D3 migration is no longer part of the normal root import.
import { annotationFromD3Style as oldD3 } from '@ponchia/annotations';
// @ts-expect-error Render snapshots no longer act as post-hoc solver workspaces.
import { refineAnnotationLayout } from '@ponchia/annotations';

const annotations: Annotation[] = [{
  id: 'peak', anchor: { type: 'point', point: { x: 100, y: 100 } },
  note: { title: 'Peak' }
}];
const bounds = { x: 0, y: 0, width: 600, height: 400 };
const layout = resolveAnnotationLayout({ annotations, bounds });
const inspected = resolveAnnotationLayout({
  annotations, bounds, diagnostics: { candidates: 8 },
  refinement: { passes: 2, maxCandidatesPerAnnotation: 32 }
});
const diagnostics: LayoutDiagnostics | undefined = inspected.diagnostics;
const entry: AnnotationPlacementDiagnostics | undefined = diagnostics?.annotations[0];
const svg: string = renderAnnotationsSvg(layout);
const source: D3StyleAnnotationInput = { id: 'legacy', x: 100, y: 100, note: { label: 'Migrated' } };
const migrated: Annotation = annotationFromD3Style(source);
const candidates = allPlacementCandidates({
  annotation: annotations[0]!, bounds, noteSize: { width: 80, height: 40 },
  obstacles: [], placedNotes: []
}, { limit: 8 });
// @ts-expect-error Render results have no per-placement diagnostic graph.
layout.annotations[0]!.placement.candidates;
// @ts-expect-error Diagnostic retention is not a placement preference.
resolveAnnotationLayout({ annotations, bounds, placement: { maxCandidates: 8 } });
// @ts-expect-error Diagnostics require an explicit retention request.
resolveAnnotationLayout({ annotations, bounds, diagnostics: true });
// @ts-expect-error Search retention does not belong in the placement preference.
allPlacementCandidates({ annotation: annotations[0]!, bounds, noteSize: { width: 80, height: 40 }, obstacles: [], placedNotes: [], placement: { maxCandidates: 8 } });

const inputView = <AnnotationLayer annotations={annotations} bounds={bounds} measure="dom" />;
const layoutView = <AnnotationLayer layout={layout} editable previewEdits />;
// @ts-expect-error A render-only layer has exactly one geometry source.
const mixed = <AnnotationLayer layout={layout} annotations={annotations} bounds={bounds} />;
// @ts-expect-error Removed prop must not silently invoke the input-mode solver.
const obsolete = <AnnotationLayer annotations={annotations} bounds={bounds} resolvedLayout={layout} />;
void [entry, svg, migrated, candidates, inputView, layoutView, mixed, obsolete, oldD3, refineAnnotationLayout];
