import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writeLine } from './log.mjs';

const parity = JSON.parse(await readFile(new URL('../docs/d3-annotation-parity.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const plan = await readFile(new URL('../docs/e2e-plan.md', import.meta.url), 'utf8');
const core = await import('@ponchia/annotations');

assert.equal(parity.schemaVersion, 1, 'd3 annotation parity schemaVersion must be 1');
assert.equal(parity.sourcePackage, 'd3-svg-annotation@2.5.1');

for (const helper of parity.supportedRuntimeHelpers) {
  assert.equal(typeof core[helper], 'function', `root export ${helper} must be a function`);
}

for (const type of parity.supportedTypeAliases) {
  const annotation = core.annotationFromD3Style(inputForType(type));
  assert.equal(annotation.id, `d3-${type}`);
}

const [defaultTyped] = core.annotationsFromD3Style([{
  id: 'default-type',
  x: 20,
  y: 30,
  dx: 14,
  dy: -8,
  note: { label: 'Default type' }
}], {
  defaultType: 'annotationCalloutCircle'
});
assert.equal(defaultTyped.variant, 'circle', 'defaultType should apply d3-style type aliases');

const [accessorMapped] = core.annotationsFromD3Style([{
  id: 'accessor',
  data: { period: 12, value: 34 },
  dx: 16,
  dy: -10,
  note: { label: 'Accessor' }
}], {
  x: 'period',
  y: (datum) => datum.value
});
assert.deepEqual(accessorMapped.anchor.point, { x: 12, y: 34 }, 'd3-style accessors should map datum coordinates');

const preparedCollection = core.prepareD3StyleAnnotationCollection({
  annotations: [{
    data: { period: 3, value: 8 },
    dx: 20,
    dy: -12,
    note: { label: 'Collection' },
    subject: { radius: 6 }
  }],
  type: 'annotationCalloutCircle',
  accessors: {
    x: 'period',
    y: (datum) => datum.value
  },
  ids: ['collection-peak'],
  editMode: true,
  notePadding: 7,
  textWrap: 16
});
assert.equal(preparedCollection.editMode, true, 'd3-style collection editMode should be preserved');
assert.equal(preparedCollection.annotations[0].id, 'collection-peak', 'd3-style collection ids should provide fallback ids');
assert.deepEqual(preparedCollection.annotations[0].anchor.point, { x: 3, y: 8 }, 'd3-style collection accessors should map datum coordinates');
assert.equal(preparedCollection.annotations[0].variant, 'circle', 'd3-style collection type should provide the default type');
assert.equal(preparedCollection.annotations[0].note.padding, 7, 'd3-style collection notePadding should map to note padding');
assert.equal(preparedCollection.annotations[0].note.wrap, 16, 'd3-style collection textWrap should map to note wrapping');

const editedCollection = core.applyD3StyleAnnotationCollectionEdit({
  idPrefix: 'collection',
  accessors: { x: 'period', y: 'value' },
  accessorsInverse: { x: 'period', y: 'value' },
  annotations: [{
    data: { period: 3, value: 8 },
    dx: 20,
    dy: -12,
    note: { label: 'Editable collection' }
  }]
}, {
  annotationId: 'collection-1',
  suggestedAnchor: { type: 'point', point: { x: 5, y: 9 } },
  suggestedPlacement: { manual: { x: 30, y: 18, side: 'right' } }
});
assert.deepEqual(
  editedCollection.annotations[0].data,
  { period: 5, value: 9 },
  'd3-style collection edits should round-trip through inverse accessors'
);
assert.equal(editedCollection.annotations[0].dx, 25);
assert.equal(editedCollection.annotations[0].dy, 9);

const builder = core.createD3StyleAnnotationBuilder()
  .type('annotationCalloutCircle')
  .accessors({ x: 'period', y: 'value' })
  .accessorsInverse({ x: 'period', y: 'value' })
  .ids(['builder-peak'])
  .editMode(true)
  .notePadding(6)
  .textWrap(18)
  .annotations([{
    data: { period: 4, value: 10 },
    dx: 20,
    dy: -12,
    note: { label: 'Builder' },
    subject: { radius: 6 }
  }]);
assert.equal(builder.editMode(), true, 'd3-style builder editMode getter should reflect builder state');
assert.equal(builder.type(), 'annotationCalloutCircle', 'd3-style builder type getter should reflect builder state');
assert.equal(builder.prepare().annotations[0].id, 'builder-peak', 'd3-style builder should prepare collection annotations');
assert.deepEqual(builder.toAnnotations()[0].anchor.point, { x: 4, y: 10 }, 'd3-style builder should convert through accessors');
builder.applyEdit({
  annotationId: 'builder-peak',
  suggestedAnchor: { type: 'point', point: { x: 6, y: 12 } },
  suggestedPlacement: { manual: { x: 32, y: 24, side: 'right' } }
});
assert.deepEqual(
  builder.config().annotations[0].data,
  { period: 6, value: 12 },
  'd3-style builder edits should update collection data'
);
assert.equal(builder.toAnnotations()[0].placement.manual.x, 32);

const rich = core.annotationFromD3Style({
  id: 'rich',
  type: 'annotationCalloutCircle',
  x: 40,
  y: 50,
  nx: 120,
  ny: 32,
  color: '#d12f6a',
  note: {
    title: 'Rich',
    label: 'D3-style',
    body: 'Body',
    wrap: 20,
    wrapSplitter: /[,;]/,
    align: 'middle',
    orientation: 'leftRight',
    lineType: 'vertical',
    bgPadding: 8
  },
  subject: { outerRadius: 10, radiusPadding: 2 },
  connector: { type: 'curve', end: 'arrow', points: [[12, -8]], startOffset: 3, endOffset: 4 },
  className: 'd3-rich',
  style: {
    lineColor: '#7c2d12',
    noteBackground: 'white'
  },
  data: { source: 'd3-style' },
  annotationData: { hook: 'd3-rich', color: 'override' },
  metadata: { source: 'd3-style' }
});
assert.equal(rich.placement.manual.x, 120);
assert.equal(rich.placement.manual.y, 32);
assert.equal(rich.style.color, '#d12f6a');
assert.equal(rich.style.lineColor, '#7c2d12');
assert.equal(rich.style.noteBackground, 'white');
assert.equal(rich.note.align, 'center');
assert.equal(rich.note.line.orientation, 'vertical');
assert.equal(rich.note.padding, 8);
assert.equal(rich.connector.type, 'curve');
assert.equal(rich.connector.end, 'arrow');
assert.equal(rich.connector.pointMode, 'relative');
assert.equal(rich.className, 'd3-rich');
assert.deepEqual(rich.data, { color: 'override', hook: 'd3-rich' });
assert.equal(rich.metadata.datum.source, 'd3-style');
assert.equal(rich.metadata.source, 'd3-style');

const customType = core.defineD3StyleAnnotationType({
  baseType: 'annotationCalloutRect',
  defaults: {
    dx: 48,
    dy: -24,
    tone: 'info',
    note: { lineType: 'vertical', bgPadding: 6 },
    subject: { width: 80, height: 24, x: -40, y: -12 },
    connector: { type: 'elbow', end: 'arrow' },
    metadata: { family: 'custom' }
  },
  transform: (annotation, context) => ({
    ...annotation,
    variant: 'band',
    metadata: {
      ...annotation.metadata,
      customType: 'status-band',
      customIndex: context.index,
      mergedTone: context.mergedInput.tone
    }
  })
});
const [custom] = core.annotationsFromD3StyleType(customType, [{
  id: 'custom-band',
  x: 160,
  y: 90,
  note: { label: 'Custom type' },
  metadata: { source: 'parity' }
}]);
assert.equal(custom.variant, 'band', 'custom d3-style type transform should update the core annotation');
assert.equal(custom.tone, 'info', 'custom d3-style type defaults should apply');
assert.deepEqual(custom.anchor.box, { x: 120, y: 78, width: 80, height: 24 }, 'custom d3-style type should inherit the base type conversion');
assert.equal(custom.note.body, 'Custom type');
assert.equal(custom.note.padding, 6);
assert.equal(custom.note.line.orientation, 'vertical');
assert.equal(custom.connector.end, 'arrow');
assert.equal(custom.metadata.family, 'custom');
assert.equal(custom.metadata.source, 'parity');
assert.equal(custom.metadata.customType, 'status-band');
assert.equal(custom.metadata.customIndex, 0);
assert.equal(custom.metadata.mergedTone, 'info');

const disabled = core.annotationFromD3Style({
  id: 'disabled',
  x: 10,
  y: 20,
  note: { label: 'Disabled' },
  disable: ['subject', 'connector', 'note']
});
assert.equal(disabled.subject.shape, 'none');
assert.equal(disabled.connector.type, 'none');
assert.equal(disabled.note.visible, false);

const styledBadge = core.annotationFromD3Style({
  id: 'styled-badge',
  type: 'annotationBadge',
  x: 24,
  y: 32,
  subject: {
    text: '!',
    x: 'right',
    y: 'top',
    className: 'legacy-badge-hook',
    data: { severity: 'high' }
  }
});
assert.equal(styledBadge.subject.badge.className, 'legacy-badge-hook', 'd3-style badge subject class should style the rendered badge');
assert.deepEqual(styledBadge.subject.badge.data, { severity: 'high' }, 'd3-style badge subject data should reach the rendered badge');
assert.ok(
  core.renderAnnotationsSvg(core.resolveAnnotationLayout({
    annotations: [styledBadge],
    bounds: { x: 0, y: 0, width: 120, height: 100 },
    noteSizes: { 'styled-badge': { width: 0, height: 0 } }
  })).includes('pa-annotation__badge legacy-badge-hook'),
  'd3-style badge class should render on the badge element'
);

const editPatch = core.d3StyleAnnotationEditPatch({
  id: 'edit',
  x: 40,
  y: 50,
  dx: 20,
  dy: -10,
  note: { label: 'Edit' }
}, {
  annotationId: 'edit',
  suggestedPlacement: { manual: { x: 90, y: 35 } }
});
assert.deepEqual(editPatch, {
  dx: 50,
  dy: -15,
  placement: { manual: { x: 90, y: 35 } }
});

const edited = core.applyD3StyleAnnotationEdit({
  id: 'edit-data',
  data: { period: 1, score: 2 },
  note: { label: 'Edit data' }
}, {
  annotationId: 'edit-data',
  suggestedAnchor: { type: 'point', point: { x: 14, y: 18 } }
}, {
  x: 'period',
  y: 'score',
  accessorsInverse: {
    y: (value) => ({ score: value * 2 })
  }
});
assert.deepEqual(edited.data, { period: 14, score: 36 });

for (const unsupported of parity.intentionallyUnsupportedExports) {
  assert.equal(core[unsupported], undefined, `${unsupported} must not be exported from the DOM-free root`);
}

for (const dependency of ['d3-dispatch', 'd3-drag', 'd3-selection', 'd3-shape', 'd3-transition', 'd3-svg-annotation']) {
  assert.equal(pkg.dependencies?.[dependency], undefined, `${dependency} must not be a runtime dependency`);
  assert.equal(pkg.peerDependencies?.[dependency], undefined, `${dependency} must not be a peer dependency`);
}

for (const term of parity.requiredDocsTerms) {
  assert.ok(readme.includes(term) || plan.includes(term), `README/docs must include ${JSON.stringify(term)}`);
}

writeLine(`d3-annotation parity verified: ${parity.supportedTypeAliases.length} type aliases, ${parity.supportedRuntimeHelpers.length} helpers, ${parity.intentionallyUnsupportedExports.length} explicit non-exported D3 runtime APIs.`);

function inputForType(type) {
  const base = {
    id: `d3-${type}`,
    type,
    x: 40,
    y: 50,
    dx: 24,
    dy: -12,
    note: { label: `Type ${type}` }
  };

  if (type.includes('Rect') || type.includes('rect')) {
    return { ...base, subject: { width: 40, height: 20 } };
  }

  if (type.includes('Circle') || type.includes('circle')) {
    return { ...base, subject: { radius: 10, radiusPadding: 2 } };
  }

  if (type.includes('Threshold') || type.includes('threshold')) {
    return { ...base, subject: { x1: 0, x2: 120 } };
  }

  if (type.includes('Badge') || type === 'badge') {
    return { ...base, subject: { text: '1', radius: 9, x: 'right', y: 'top' } };
  }

  if (type.includes('Curve') || type.includes('curve')) {
    return { ...base, connector: { type: 'curve', points: [[12, -8]], end: 'dot' } };
  }

  if (type.includes('Elbow') || type.includes('elbow')) {
    return { ...base, connector: { type: 'elbow' } };
  }

  return base;
}
