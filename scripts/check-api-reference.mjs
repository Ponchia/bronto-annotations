import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writeLine } from './log.mjs';

const api = await readFile(new URL('../docs/api-reference.md', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const required = [
  {
    subpath: '.',
    heading: '## `@ponchia/annotations`',
    source: 'src/index.ts',
    terms: [
      'resolveAnnotationLayout',
      'renderAnnotationsSvg',
      'Annotation',
      'AnnotationVariant',
      'annotationFromD3Style',
      'prepareD3StyleAnnotationCollection',
      'createD3StyleAnnotationBuilder',
      'defineD3StyleAnnotationType',
      'assertAnchorAlignmentReport',
      'assertAnchorAlignmentReportIfRequested',
      'evaluateAnchorAlignment',
      'formatAnchorAlignmentReport',
      'assertAnchorValidationReport',
      'assertAnchorValidationReportIfRequested',
      'formatAnchorValidationReport',
      'AnchorAlignmentTarget',
      'AnchorValidationAssertInput',
      'applyD3StyleAnnotationCollectionEdit',
      'applyD3StyleAnnotationEdit',
      'pointCallout',
      'evaluateAnnotationLayout',
      'assertAnnotationLayoutQuality',
      'formatLayoutQualityReport',
      'generatedSurfaceLayoutDefaults',
      'resolvePreparedAnnotationLayout',
      'annotationClassName',
      'createAnnotationEditEvent',
      'createAnnotationEditDelta',
      'createAnnotationEditSession'
    ]
  },
  {
    subpath: './react',
    heading: '## `@ponchia/annotations/react`',
    source: 'src/react/index.ts',
    terms: [
      'AnnotationLayer',
      'useAnnotations',
      'AnnotationLayerProps',
      'AnnotationLayerEditEvent',
      'AnnotationLayerQualityEvent',
      'AnnotationLayerTargetAlignmentEvent',
      'onQuality',
      'assertQuality',
      'qualityDebug',
      'onTargetAlignment',
      'assertTargetAlignment',
      'editHandleTabIndex'
    ],
    sourceTerms: [
      'AnnotationLayer',
      'useAnnotations',
      'AnnotationLayerProps',
      'AnnotationLayerEditEvent',
      'AnnotationLayerQualityEvent',
      'AnnotationLayerTargetAlignmentEvent'
    ]
  },
  {
    subpath: './dom',
    heading: '## `@ponchia/annotations/dom`',
    source: 'src/dom/index.ts',
    terms: [
      'prepareDomAnnotations',
      'anchorFromSelector',
      'annotationFrameFromSvg',
      'extractedAnchorFromElement',
      'boxFromSvgElement',
      'validateDomAnchors',
      'evaluateAnchorAlignment',
      'formatAnchorAlignmentReport',
      'assertAnchorValidationReport'
    ]
  },
  {
    subpath: './vega',
    heading: '## `@ponchia/annotations/vega`',
    source: 'src/adapters/vega.ts',
    terms: [
      'prepareVegaScenegraphAnnotations',
      'prepareVegaSvgAnnotations',
      'obstaclesFromVegaView',
      'obstaclesFromVegaScales',
      'anchorsFromVegaScales',
      'validateVegaScenegraphAnchors',
      'VegaScenegraphAnchorSpec',
      'evaluateAnchorAlignment',
      'formatAnchorAlignmentReport',
      'formatAnchorValidationReport'
    ]
  },
  {
    subpath: './mermaid',
    heading: '## `@ponchia/annotations/mermaid`',
    source: 'src/adapters/mermaid.ts',
    terms: [
      'prepareMermaidAnnotations',
      'anchorsFromMermaidSvg',
      'obstaclesFromMermaidSvg',
      'validateMermaidSvgAnchors',
      'MermaidAnchorSpec',
      'evaluateAnchorAlignment',
      'formatAnchorAlignmentReport',
      'formatAnchorValidationReport'
    ]
  },
  {
    subpath: './d2',
    heading: '## `@ponchia/annotations/d2`',
    source: 'src/adapters/d2.ts',
    terms: [
      'prepareD2DiagramAnnotations',
      'prepareD2SvgAnnotations',
      'allD2Shapes',
      'validateD2DiagramAnchors',
      'D2DiagramAnchorSpec',
      'D2LabelMatch',
      'evaluateAnchorAlignment',
      'formatAnchorAlignmentReport',
      'formatAnchorValidationReport'
    ]
  },
  {
    subpath: './react-flow',
    heading: '## `@ponchia/annotations/react-flow`',
    source: 'src/adapters/react-flow.ts',
    terms: [
      'prepareReactFlowAnnotations',
      'anchorsFromReactFlow',
      'obstaclesFromReactFlow',
      'includeHandles',
      'handlePoint',
      'ReactFlowAnchorSpec',
      'evaluateAnchorAlignment',
      'formatAnchorAlignmentReport',
      'formatAnchorValidationReport'
    ]
  },
  {
    subpath: './bronto.css',
    heading: '## `@ponchia/annotations/bronto.css`',
    source: 'src/styles/bronto.css',
    terms: [
      '.pa-annotation-layer',
      '.pa-annotation__edit-handle',
      '.pa-annotation__quality-issue',
      '.ui-annotation',
      '.ui-annotation__connector-end'
    ]
  }
];

for (const item of required) {
  assert.ok(pkg.exports?.[item.subpath], `package export ${item.subpath} must exist`);
  assert.ok(api.includes(item.heading), `API reference must include heading ${item.heading}`);
  assert.ok(api.includes(item.subpath === '.' ? '@ponchia/annotations' : `@ponchia/annotations/${item.subpath.slice(2)}`), `API reference must mention ${item.subpath}`);

  const source = await readFile(new URL(`../${item.source}`, import.meta.url), 'utf8');

  for (const term of item.sourceTerms ?? item.terms) {
    assert.ok(source.includes(term), `${item.source} must include ${term}`);
  }

  for (const term of item.terms) {
    assert.ok(api.includes(term), `API reference must include ${term}`);
  }
}

for (const boundary of [
  'does not render charts',
  'does not parse Mermaid',
  'does not parse D2',
  'does not own graph layout',
  'does not import `@ponchia/ui`'
]) {
  assert.ok(api.includes(boundary), `API reference must include boundary ${boundary}`);
}
assert.ok(api.includes('annotationData'), 'API reference must include annotationData');
assert.ok(api.includes('includeQualityIssues'), 'API reference must include includeQualityIssues');

writeLine(`API reference verified: ${required.length} public subpaths.`);
