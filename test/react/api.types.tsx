import { AnnotationLayer, useAnnotations } from '../../src/react/index.js';
import type { Annotation, LayoutOptions, ResolvedLayout } from '../../src/core/model.js';

// Compile-only contract assertions. No execution or runtime fixture is needed.
declare const annotations: Annotation[];
declare const options: LayoutOptions;
declare const layout: ResolvedLayout;
const bounds = { x: 0, y: 0, width: 400, height: 300 };

<AnnotationLayer layout={layout} editable previewEdits debug noteTabIndex={0} />;
<AnnotationLayer annotations={annotations} bounds={bounds} measure="dom" diagnostics={{ candidates: 4 }} />;
<AnnotationLayer {...options} />;
useAnnotations({ ...options, diagnostics: { candidates: 'all' } });

// @ts-expect-error Removed controlled prop.
<AnnotationLayer {...options} resolvedLayout={layout} />;
// @ts-expect-error A layout cannot accompany solver inputs, including spread inputs.
<AnnotationLayer {...options} layout={layout} />;
// @ts-expect-error Source annotations derive from the layout.
<AnnotationLayer layout={layout} annotations={annotations} />;
// @ts-expect-error Bounds derive from the layout.
<AnnotationLayer layout={layout} bounds={bounds} />;
// @ts-expect-error Placement is a solver input.
<AnnotationLayer layout={layout} placement={{ side: 'top' }} />;
// @ts-expect-error Refinement is a solver input.
<AnnotationLayer layout={layout} refinement={false} />;
// @ts-expect-error Note sizes derive from the layout.
<AnnotationLayer layout={layout} noteSizes={{}} />;
// @ts-expect-error Default note size is a solver input.
<AnnotationLayer layout={layout} defaultNoteSize={{ width: 80, height: 40 }} />;
// @ts-expect-error Obstacles derive from the layout.
<AnnotationLayer layout={layout} obstacles={[]} />;
// @ts-expect-error Padding derives from the layout.
<AnnotationLayer layout={layout} padding={8} />;
// @ts-expect-error Diagnostics must be requested from the host solver.
<AnnotationLayer layout={layout} diagnostics={{ candidates: 8 }} />;
// @ts-expect-error Render-only mode cannot self-measure.
<AnnotationLayer layout={layout} measure="dom" />;
// @ts-expect-error Render-only mode excludes even estimate measurement.
<AnnotationLayer layout={layout} measure="estimate" />;
// @ts-expect-error Either layout or both required solver inputs must be present.
<AnnotationLayer />;
// @ts-expect-error The removed retention field cannot be used in input mode.
<AnnotationLayer {...options} placement={{ maxCandidates: 8 }} />;
