import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const core = await import('@ponchia/annotations');
const react = await import('@ponchia/annotations/react');
const dom = await import('@ponchia/annotations/dom');
const vega = await import('@ponchia/annotations/vega');
const mermaid = await import('@ponchia/annotations/mermaid');
const d2 = await import('@ponchia/annotations/d2');
const reactFlow = await import('@ponchia/annotations/react-flow');

assert.deepEqual(pkg.exports?.['./bronto.css'], {
  types: './dist/bronto.css.d.ts',
  default: './dist/bronto.css'
});

assert.equal(typeof core.resolveAnnotationLayout, 'function');
assert.equal(typeof core.refineAnnotationLayout, 'function');
assert.equal(typeof core.renderAnnotationsSvg, 'function');
assert.equal(typeof core.evaluateAnnotationLayout, 'function');
assert.equal(typeof core.assertAnnotationLayoutQuality, 'function');
assert.equal(typeof core.formatLayoutQualityReport, 'function');
assert.equal(typeof core.formatLayoutQualityIssue, 'function');
assert.equal(typeof core.evaluateAnchorAlignment, 'function');
assert.equal(typeof core.assertAnchorAlignmentReport, 'function');
assert.equal(typeof core.formatAnchorAlignmentReport, 'function');
assert.equal(typeof core.formatAnchorAlignmentDiagnostic, 'function');
assert.equal(typeof core.assertAnchorValidationReport, 'function');
assert.equal(typeof core.formatAnchorValidationReport, 'function');
assert.equal(typeof core.formatAnchorDiagnostic, 'function');
assert.equal(typeof core.generatedSurfaceLayoutDefaults, 'function');
assert.equal(typeof core.resolvePreparedAnnotationLayout, 'function');
assert.equal(typeof core.allPlacementCandidates, 'function');
assert.equal(typeof core.annotationEditHandles, 'function');
assert.equal(typeof core.annotationEditPatch, 'function');
assert.equal(typeof core.annotationClassName, 'function');
assert.equal(typeof core.brontoAnnotationClassName, 'function');
assert.equal(typeof core.annotationStyleVariables, 'function');
assert.equal(typeof core.applyAnnotationEdit, 'function');
assert.equal(typeof core.applyAnnotationEdits, 'function');
assert.equal(typeof core.annotationParts, 'function');
assert.equal(typeof core.annotationTransform, 'function');
assert.equal(typeof core.circleSubjectPath, 'function');
assert.equal(typeof core.encircleSubjectPath, 'function');
assert.equal(typeof core.enclosingCircle, 'function');
assert.equal(typeof core.connectorLine, 'function');
assert.equal(typeof core.declutterLabels, 'function');
assert.equal(typeof core.directLabels, 'function');
assert.equal(typeof core.notePlacement, 'function');
assert.equal(typeof core.translateAnchor, 'function');
assert.equal(typeof core.pointCallout, 'function');
assert.equal(typeof core.regionCallout, 'function');
assert.equal(typeof core.pathCallout, 'function');
assert.equal(typeof core.encircleCallout, 'function');
assert.equal(typeof core.thresholdAnnotation, 'function');
assert.equal(typeof core.badgeAnnotation, 'function');
assert.equal(typeof core.annotationFromD3Style, 'function');
assert.equal(typeof core.annotationsFromD3Style, 'function');
assert.equal(typeof core.prepareD3StyleAnnotationCollection, 'function');
assert.equal(typeof core.annotationsFromD3StyleCollection, 'function');
assert.equal(typeof core.createD3StyleAnnotationBuilder, 'function');
assert.equal(typeof core.defineD3StyleAnnotationType, 'function');
assert.equal(typeof core.annotationsFromD3StyleType, 'function');
assert.equal(typeof core.d3StyleAnnotationCollectionEditPatch, 'function');
assert.equal(typeof core.applyD3StyleAnnotationCollectionEdit, 'function');
assert.equal(typeof core.d3StyleAnnotationEditPatch, 'function');
assert.equal(typeof core.applyD3StyleAnnotationEdit, 'function');
assert.equal(typeof react.AnnotationLayer, 'function');
assert.equal(typeof react.useAnnotations, 'function');
assert.equal(typeof dom.anchorFromDOMRect, 'function');
assert.equal(typeof dom.anchorFromElement, 'function');
assert.equal(typeof dom.anchorFromSelector, 'function');
assert.equal(typeof dom.anchorFromId, 'function');
assert.equal(typeof dom.anchorsFromSelectors, 'function');
assert.equal(typeof dom.annotationsFromDomSelectors, 'function');
assert.equal(typeof dom.annotationFrameFromSvg, 'function');
assert.equal(typeof dom.boxFromDOMRect, 'function');
assert.equal(typeof dom.boxFromElement, 'function');
assert.equal(typeof dom.boxFromSvgElement, 'function');
assert.equal(typeof dom.clientBoxToSvgBox, 'function');
assert.equal(typeof dom.obstaclesFromElements, 'function');
assert.equal(typeof dom.obstaclesFromSelector, 'function');
assert.equal(typeof dom.obstaclesFromSelectors, 'function');
assert.equal(typeof dom.prepareDomAnnotations, 'function');
assert.equal(typeof dom.svgPointFromClient, 'function');
assert.equal(typeof dom.validateDomAnchors, 'function');
assert.equal(typeof dom.evaluateAnchorAlignment, 'function');
assert.equal(typeof dom.assertAnchorAlignmentReport, 'function');
assert.equal(typeof dom.formatAnchorAlignmentReport, 'function');
assert.equal(typeof dom.assertAnchorValidationReport, 'function');
assert.equal(typeof dom.formatAnchorValidationReport, 'function');
assert.equal(typeof vega.anchorsFromVegaView, 'function');
assert.equal(typeof vega.annotationsFromVegaView, 'function');
assert.equal(typeof vega.validateVegaViewAnchors, 'function');
assert.equal(typeof vega.obstaclesFromVegaView, 'function');
assert.equal(typeof vega.prepareVegaViewAnnotations, 'function');
assert.equal(typeof vega.anchorsFromVegaScales, 'function');
assert.equal(typeof vega.annotationsFromVegaScales, 'function');
assert.equal(typeof vega.validateVegaScaleAnchors, 'function');
assert.equal(typeof vega.obstaclesFromVegaScales, 'function');
assert.equal(typeof vega.prepareVegaScaleAnnotations, 'function');
assert.equal(typeof vega.anchorsFromVegaScenegraph, 'function');
assert.equal(typeof vega.annotationsFromVegaScenegraph, 'function');
assert.equal(typeof vega.validateVegaScenegraphAnchors, 'function');
assert.equal(typeof vega.obstaclesFromVegaScenegraph, 'function');
assert.equal(typeof vega.prepareVegaScenegraphAnnotations, 'function');
assert.equal(typeof vega.anchorsFromVegaSvg, 'function');
assert.equal(typeof vega.annotationsFromVegaSvg, 'function');
assert.equal(typeof vega.validateVegaSvgAnchors, 'function');
assert.equal(typeof vega.obstaclesFromVegaSvg, 'function');
assert.equal(typeof vega.findVegaSvgElement, 'function');
assert.equal(typeof vega.prepareVegaSvgAnnotations, 'function');
assert.equal(typeof vega.evaluateAnchorAlignment, 'function');
assert.equal(typeof vega.assertAnchorAlignmentReport, 'function');
assert.equal(typeof vega.formatAnchorAlignmentReport, 'function');
assert.equal(typeof vega.assertAnchorValidationReport, 'function');
assert.equal(typeof vega.formatAnchorValidationReport, 'function');
assert.equal(typeof mermaid.anchorsFromMermaidSvg, 'function');
assert.equal(typeof mermaid.annotationsFromMermaidSvg, 'function');
assert.equal(typeof mermaid.validateMermaidSvgAnchors, 'function');
assert.equal(typeof mermaid.findMermaidElement, 'function');
assert.equal(typeof mermaid.obstaclesFromMermaidSvg, 'function');
assert.equal(typeof mermaid.prepareMermaidAnnotations, 'function');
assert.equal(typeof mermaid.evaluateAnchorAlignment, 'function');
assert.equal(typeof mermaid.assertAnchorAlignmentReport, 'function');
assert.equal(typeof mermaid.formatAnchorAlignmentReport, 'function');
assert.equal(typeof mermaid.assertAnchorValidationReport, 'function');
assert.equal(typeof mermaid.formatAnchorValidationReport, 'function');
assert.equal(typeof d2.anchorsFromD2Diagram, 'function');
assert.equal(typeof d2.annotationsFromD2Diagram, 'function');
assert.equal(typeof d2.validateD2DiagramAnchors, 'function');
assert.equal(typeof d2.prepareD2DiagramAnnotations, 'function');
assert.equal(typeof d2.anchorsFromD2Svg, 'function');
assert.equal(typeof d2.annotationsFromD2Svg, 'function');
assert.equal(typeof d2.validateD2SvgAnchors, 'function');
assert.equal(typeof d2.prepareD2SvgAnnotations, 'function');
assert.equal(typeof d2.obstaclesFromD2Diagram, 'function');
assert.equal(typeof d2.obstaclesFromD2Svg, 'function');
assert.equal(typeof d2.findD2SvgElement, 'function');
assert.equal(typeof d2.allD2Shapes, 'function');
assert.equal(typeof d2.allD2Connections, 'function');
assert.equal(typeof d2.evaluateAnchorAlignment, 'function');
assert.equal(typeof d2.assertAnchorAlignmentReport, 'function');
assert.equal(typeof d2.formatAnchorAlignmentReport, 'function');
assert.equal(typeof d2.assertAnchorValidationReport, 'function');
assert.equal(typeof d2.formatAnchorValidationReport, 'function');
assert.equal(typeof reactFlow.anchorsFromReactFlow, 'function');
assert.equal(typeof reactFlow.annotationsFromReactFlow, 'function');
assert.equal(typeof reactFlow.validateReactFlowAnchors, 'function');
assert.equal(typeof reactFlow.obstaclesFromReactFlow, 'function');
assert.equal(typeof reactFlow.prepareReactFlowAnnotations, 'function');
assert.equal(typeof reactFlow.nodeBox, 'function');
assert.equal(typeof reactFlow.handleBox, 'function');
assert.equal(typeof reactFlow.handlePoint, 'function');
assert.equal(typeof reactFlow.evaluateAnchorAlignment, 'function');
assert.equal(typeof reactFlow.assertAnchorAlignmentReport, 'function');
assert.equal(typeof reactFlow.formatAnchorAlignmentReport, 'function');
assert.equal(typeof reactFlow.assertAnchorValidationReport, 'function');
assert.equal(typeof reactFlow.formatAnchorValidationReport, 'function');

const layout = core.resolveAnnotationLayout({
  annotations: [
    {
      id: 'export-check',
      anchor: { type: 'point', point: { x: 12, y: 24 } },
      note: { title: 'Export check' }
    }
  ],
  bounds: { x: 0, y: 0, width: 200, height: 160 }
});

assert.equal(layout.annotations.length, 1);
assert.ok(core.renderAnnotationsSvg(layout).includes('pa-annotation__note'));
const exportValidationReport = {
  ok: false,
  found: [],
  warnings: [],
  missing: [{
    id: 'missing-export',
    source: 'export-check',
    status: 'missing',
    expected: 'selector ".missing"',
    found: false
  }],
  diagnostics: []
};
assert.ok(core.formatAnchorValidationReport(exportValidationReport).includes('missing-export'));
assert.throws(() => core.assertAnchorValidationReport(exportValidationReport), /missing-export/);
const exportAlignmentReport = core.evaluateAnchorAlignment(layout.annotations.map((item) => item.annotation), [{
  id: 'export-check',
  point: { x: 12, y: 24 }
}]);
assert.ok(core.formatAnchorAlignmentReport(exportAlignmentReport).includes('1 aligned'));
core.assertAnchorAlignmentReport(exportAlignmentReport);
assert.equal(core.encircleSubjectPath({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], radius: 2, padding: 3 }), 'M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z');
assert.deepEqual(core.enclosingCircle([{ x: 0, y: 0 }, { x: 10, y: 0 }]), { x: 5, y: 0, radius: 5 });
assert.equal(core.encircleCallout({
  id: 'encircle-export-check',
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
  note: { title: 'Encircle' }
}).subject.geometry.type, 'encircle');
assert.equal(core.annotationEditHandles(layout).length, 1);
assert.equal(core.annotationClassName({ variant: 'badge', tone: 'warning', motion: 'pulse' }), 'pa-annotation pa-annotation--badge pa-annotation--warning pa-annotation--pulse');
assert.equal(core.brontoAnnotationClassName({ variant: 'bracket', tone: 'info', motion: 'draw' }), 'ui-annotation ui-annotation--bracket ui-annotation--info ui-annotation--draw');
assert.deepEqual(core.annotationStyleVariables({ color: '#d12f6a', vars: { '--custom-annotation-token': 'demo', 'bad-token': 'ignored' } }), {
  '--pa-annotation-accent': '#d12f6a',
  '--annotation-color': '#d12f6a',
  '--custom-annotation-token': 'demo'
});
assert.deepEqual(core.annotationEditPatch({
  annotationId: 'export-check',
  suggestedPlacement: { manual: { x: 40, y: 44 } }
}), {
  annotationId: 'export-check',
  placement: { manual: { x: 40, y: 44 } }
});
assert.equal(core.applyAnnotationEdit(layout.annotations[0].annotation, {
  annotationId: 'export-check',
  suggestedAnchor: { type: 'point', point: { x: 18, y: 30 } }
}).anchor.point.x, 18);
assert.equal(core.applyAnnotationEdits([layout.annotations[0].annotation], {
  annotationId: 'export-check',
  suggestedPlacement: { manual: { x: 40, y: 44 } }
})[0].placement.manual.x, 40);
assert.deepEqual(core.translateAnchor({ type: 'point', point: { x: 1, y: 2 } }, { x: 3, y: 4 }), {
  type: 'point',
  point: { x: 4, y: 6 }
});
assert.equal(core.circleSubjectPath({ radius: 4 }), 'M0,-4A4,4 0 1 1 0,4A4,4 0 1 1 0,-4Z');
assert.equal(core.connectorPathD(
  { x: 0, y: 50 },
  { x: 100, y: 40, width: 40, height: 20 },
  { type: 'straight' },
  {
    bounds: { x: -20, y: 0, width: 180, height: 120 },
    obstacles: [{ x: 40, y: 40, width: 20, height: 20 }]
  }
), 'M 0 50 L 0 33 L 67 33 L 67 50 L 100 50');
assert.deepEqual(core.declutterLabels([
  { pos: 10, size: 10 },
  { pos: 12, size: 10 }
], { gap: 4 }), [10, 24]);
assert.equal(core.annotationsFromD3Style([
  { id: 'd3-style', type: 'annotationCalloutCircle', x: 24, y: 32, dx: 40, dy: -16, note: { label: 'D3-style' }, subject: { radius: 6 } }
])[0].connector.startOffset, 6);
const exportD3DataHooks = core.annotationsFromD3Style([
  { data: { period: 2, score: 9 }, annotationData: { hook: 'd3-style' }, note: { label: 'D3 data hooks' } }
], { x: 'period', y: 'score' })[0];
assert.deepEqual(exportD3DataHooks.data, { hook: 'd3-style' });
assert.deepEqual(exportD3DataHooks.metadata.datum, { period: 2, score: 9 });
assert.equal(core.prepareD3StyleAnnotationCollection({
  annotations: [{
    data: { period: 2, score: 9 },
    dx: 24,
    dy: -12,
    note: { label: 'D3 collection' },
    subject: { radius: 6 }
  }],
  type: 'annotationCalloutCircle',
  accessors: { x: 'period', y: 'score' },
  ids: ['d3-collection'],
  editMode: true,
  notePadding: 5
}).annotations[0].id, 'd3-collection');
assert.equal(core.annotationsFromD3StyleCollection({
  annotations: [{ data: { period: 2, score: 9 }, note: { label: 'D3 collection' } }],
  accessors: { x: 'period', y: 'score' }
})[0].anchor.point.y, 9);
const exportD3Builder = core.createD3StyleAnnotationBuilder()
  .type('annotationCalloutCircle')
  .accessors({ x: 'period', y: 'score' })
  .ids(['d3-builder'])
  .editMode(true)
  .notePadding(5)
  .annotations([{
    data: { period: 2, score: 9 },
    note: { label: 'D3 builder' },
    subject: { radius: 6 }
  }]);
assert.equal(exportD3Builder.editMode(), true);
assert.equal(exportD3Builder.toAnnotations()[0].id, 'd3-builder');
assert.equal(exportD3Builder.prepare().annotations[0].note.padding, 5);
const exportCustomType = core.defineD3StyleAnnotationType({
  baseType: 'annotationCalloutRect',
  defaults: {
    dx: 12,
    dy: -8,
    subject: { width: 20, height: 10, x: -10, y: -5 },
    note: { lineType: 'vertical' }
  },
  transform: (annotation) => ({ ...annotation, variant: 'band' })
});
assert.equal(core.annotationsFromD3StyleType(exportCustomType, [
  { id: 'd3-custom', x: 50, y: 60, note: { label: 'Custom' } }
])[0].variant, 'band');
assert.deepEqual(core.d3StyleAnnotationEditPatch({
  id: 'd3-edit',
  x: 24,
  y: 32,
  dx: 40,
  dy: -16,
  note: { label: 'D3 edit' }
}, {
  annotationId: 'd3-edit',
  suggestedPlacement: { manual: { x: 80, y: 44 } }
}), {
  dx: 56,
  dy: 12,
  placement: { manual: { x: 80, y: 44 } }
});
assert.deepEqual(core.d3StyleAnnotationCollectionEditPatch({
  idPrefix: 'd3-collection-edit',
  accessors: { x: 'x', y: 'y' },
  annotations: [{ data: { x: 2, y: 3 }, note: { label: 'Collection edit' } }]
}, {
  annotationId: 'd3-collection-edit-1',
  suggestedAnchor: { type: 'point', point: { x: 8, y: 9 } }
}).annotation.data, { x: 8, y: 9 });
assert.deepEqual(core.applyD3StyleAnnotationCollectionEdit({
  idPrefix: 'd3-collection-edit',
  accessors: { x: 'x', y: 'y' },
  annotations: [{ data: { x: 2, y: 3 }, note: { label: 'Collection edit' } }]
}, {
  annotationId: 'd3-collection-edit-1',
  suggestedAnchor: { type: 'point', point: { x: 8, y: 9 } }
}).annotations[0].data, { x: 8, y: 9 });
assert.deepEqual(core.applyD3StyleAnnotationEdit({
  id: 'd3-edit-data',
  data: { x: 2, y: 4 },
  note: { label: 'D3 edit data' }
}, {
  annotationId: 'd3-edit-data',
  suggestedAnchor: { type: 'point', point: { x: 30, y: 50 } }
}, {
  x: 'x',
  y: 'y'
}).data, { x: 30, y: 50 });
await Promise.all([
  access(new URL('../dist/index.d.ts', import.meta.url)),
  access(new URL('../dist/react/index.d.ts', import.meta.url)),
  access(new URL('../dist/dom/index.d.ts', import.meta.url)),
  access(new URL('../dist/adapters/vega.d.ts', import.meta.url)),
  access(new URL('../dist/adapters/mermaid.d.ts', import.meta.url)),
  access(new URL('../dist/adapters/d2.d.ts', import.meta.url)),
  access(new URL('../dist/adapters/react-flow.d.ts', import.meta.url)),
  access(new URL('../dist/bronto.css', import.meta.url)),
  access(new URL('../dist/bronto.css.d.ts', import.meta.url))
]);
