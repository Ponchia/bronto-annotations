import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const packedScreenshotsDir = new URL('../.tmp-packed-screenshots/', import.meta.url).pathname;
const workdirs = [];

try {
  const { stdout } = await exec('npm', ['pack', '--json'], { cwd: root });
  const packResult = JSON.parse(stdout)[0];
  const tarball = new URL(`../${packResult.filename}`, import.meta.url).pathname;

  await rm(packedScreenshotsDir, { recursive: true, force: true });
  assertPackContents(packResult);
  await smokeRootAndAdapters(tarball);
  await smokeReact(tarball);
  await smokeBrowserBundle(tarball);
  await smokeBrowserAdapters(tarball);

  await rm(tarball, { force: true });
} finally {
  await Promise.all(workdirs.map((workdir) => rm(workdir, { recursive: true, force: true })));
}

async function smokeRootAndAdapters(tarball) {
  const workdir = await consumerWorkdir();

  await install(workdir, [tarball]);
  await assertOptionalPeersAbsent(workdir);

  const smoke = `
    import { access, readFile } from 'node:fs/promises';
    import {
      annotationEditHandles,
      annotationParts,
      circleSubjectPath,
      connectorPathD,
      declutterLabels,
      directLabels,
      encircleCallout,
      encircleSubjectPath,
      enclosingCircle,
      notePlacement,
      resolveAnnotationLayout,
      refineAnnotationLayout,
      renderAnnotationsSvg,
      subjectPath,
      evaluateAnnotationLayout,
      assertAnnotationLayoutQuality,
      formatLayoutQualityIssue,
      formatLayoutQualityReport,
      generatedSurfaceLayoutDefaults,
      resolvePreparedAnnotationLayout,
      pointCallout,
      allPlacementCandidates,
      translateAnchor,
      annotationFromD3Style,
      annotationsFromD3Style,
      annotationsFromD3StyleCollection,
      prepareD3StyleAnnotationCollection,
      createD3StyleAnnotationBuilder,
      defineD3StyleAnnotationType,
      annotationsFromD3StyleType,
      applyD3StyleAnnotationCollectionEdit,
      d3StyleAnnotationCollectionEditPatch,
      applyD3StyleAnnotationEdit,
      d3StyleAnnotationEditPatch,
      assertAnchorAlignmentReport,
      assertAnchorAlignmentReportIfRequested,
      assertAnchorValidationReport,
      assertAnchorValidationReportIfRequested,
      evaluateAnchorAlignment,
      formatAnchorAlignmentReport,
      formatAnchorValidationReport,
      annotationClassName,
      annotationStyleVariables,
      brontoAnnotationClassName,
      annotationEditPatch,
      applyAnnotationEdit,
      applyAnnotationEdits
    } from '@ponchia/annotations';
    import { anchorFromDOMRect, anchorFromSelector, annotationFrameFromSvg, annotationsFromDomSelectors, boxFromDOMRect, obstaclesFromSelector, prepareDomAnnotations, validateDomAnchors } from '@ponchia/annotations/dom';
    import { anchorsFromVegaView, anchorsFromVegaScales, anchorsFromVegaScenegraph, annotationsFromVegaScenegraph, obstaclesFromVegaView, obstaclesFromVegaScales, obstaclesFromVegaScenegraph, anchorsFromVegaSvg, annotationsFromVegaSvg, obstaclesFromVegaSvg, findVegaSvgElement, prepareVegaViewAnnotations, prepareVegaScaleAnnotations, prepareVegaScenegraphAnnotations, prepareVegaSvgAnnotations, validateVegaViewAnchors, validateVegaSvgAnchors } from '@ponchia/annotations/vega';
    import { anchorsFromD2Diagram, anchorsFromD2Svg, annotationsFromD2Diagram, annotationsFromD2Svg, obstaclesFromD2Diagram, obstaclesFromD2Svg, findD2SvgElement, prepareD2DiagramAnnotations, prepareD2SvgAnnotations, validateD2DiagramAnchors, validateD2SvgAnchors } from '@ponchia/annotations/d2';
    import { anchorsFromReactFlow, annotationsFromReactFlow, obstaclesFromReactFlow, handleBox, prepareReactFlowAnnotations, validateReactFlowAnchors } from '@ponchia/annotations/react-flow';
    import { anchorsFromMermaidSvg, annotationsFromMermaidSvg, obstaclesFromMermaidSvg, findMermaidElement, prepareMermaidAnnotations, validateMermaidSvgAnchors } from '@ponchia/annotations/mermaid';

    const layout = resolveAnnotationLayout({
      annotations: [{
        id: 'smoke',
        anchor: { type: 'point', point: { x: 24, y: 32 } },
        note: { title: 'Smoke' },
        placement: { manual: { x: 48, y: 40, side: 'right' } },
        connector: { end: 'arrow' },
        variant: 'badge',
        tone: 'warning',
        motion: 'pulse'
      }],
      bounds: { x: 0, y: 0, width: 240, height: 180 }
    });
    if (layout.annotations.length !== 1) throw new Error('layout failed');
    if (layout.annotations[0].noteBox.x !== 48 || layout.annotations[0].placement.manual !== true) throw new Error('manual placement failed');
    if (refineAnnotationLayout(layout, { passes: 1 }).annotations.length !== 1) throw new Error('layout refinement export failed');
    const svg = renderAnnotationsSvg(layout, { markerIdPrefix: 'smoke-layer', noteTabIndex: 0, preserveAspectRatio: 'xMinYMin meet' });
    if (!svg.includes('pa-annotation__connector')) throw new Error('svg failed');
    if (!svg.includes('preserveAspectRatio="xMinYMin meet"')) throw new Error('svg preserveAspectRatio failed');
    if (!svg.includes('role="note"') || !svg.includes('tabindex="0"')) throw new Error('svg note navigation failed');
    if (!svg.includes('id="smoke-layer-marker-arrow"') || !svg.includes('marker-end="url(#smoke-layer-marker-arrow)"')) throw new Error('svg marker id prefix failed');
    if (!svg.includes('pa-annotation--badge') || !svg.includes('pa-annotation--warning') || !svg.includes('pa-annotation--pulse')) throw new Error('svg variant classes failed');
    const pathSubjectLayout = resolveAnnotationLayout({
      annotations: [{
        id: 'path-subject',
        anchor: { type: 'box', box: { x: 30, y: 30, width: 40, height: 20 } },
        note: { title: 'Path subject' },
        subject: { path: circleSubjectPath({ radius: 8 }), data: { subjectKind: 'custom-path' } },
        variant: 'evidence'
      }, {
        id: 'structured-subject',
        anchor: { type: 'point', point: { x: 100, y: 72 } },
        note: { title: 'Structured subject' },
        subject: {
          geometry: { type: 'bracket', x1: -24, y1: 0, x2: 24, y2: 0, depth: 8 },
          data: { subjectKind: 'structured-bracket' }
        },
        variant: 'bracket'
      }],
      bounds: { x: 0, y: 0, width: 240, height: 180 }
    });
    const pathSubjectSvg = renderAnnotationsSvg(pathSubjectLayout);
    if (!pathSubjectSvg.includes('pa-annotation__subject--path') || !pathSubjectSvg.includes('data-subject-kind="custom-path"')) throw new Error('svg path subject failed');
    if (subjectPath({ type: 'bracket', x1: -24, y1: 0, x2: 24, y2: 0, depth: 8 }) !== 'M-24,0V8H24V0') throw new Error('subject path helper failed');
    if (encircleSubjectPath({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], radius: 2, padding: 3 }) !== 'M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z') throw new Error('encircle subject path helper failed');
    if (enclosingCircle([{ x: 0, y: 0 }, { x: 10, y: 0 }]).radius !== 5) throw new Error('enclosing circle helper failed');
    if (!pathSubjectSvg.includes('pa-annotation__subject--geometry') || !pathSubjectSvg.includes('transform="translate(100 72)"') || !pathSubjectSvg.includes('data-subject-kind="structured-bracket"')) throw new Error('svg structured subject failed');
    const editableSvg = renderAnnotationsSvg(layout, { includeEditHandles: true, editHandleTabIndex: 0 });
    if (!editableSvg.includes('pa-annotation__edit-handle') || !editableSvg.includes('pa-annotation--manual')) throw new Error('svg edit handles failed');
    if (!editableSvg.includes('role="button"') || !editableSvg.includes('tabindex="0"')) throw new Error('svg edit handle navigation failed');
    if (annotationEditHandles(layout)[0]?.kind !== 'note') throw new Error('edit handles failed');
    if (annotationClassName({ variant: 'badge', tone: 'warning', motion: 'pulse' }) !== 'pa-annotation pa-annotation--badge pa-annotation--warning pa-annotation--pulse') throw new Error('annotation class recipe failed');
    if (brontoAnnotationClassName({ variant: 'bracket', tone: 'info', motion: 'draw' }) !== 'ui-annotation ui-annotation--bracket ui-annotation--info ui-annotation--draw') throw new Error('legacy bronto class recipe failed');
    if (annotationStyleVariables({ color: '#d12f6a' })['--pa-annotation-accent'] !== '#d12f6a') throw new Error('annotation style variables failed');
    const editPatch = annotationEditPatch({ annotationId: 'smoke', suggestedPlacement: { manual: { x: 72, y: 64 } } });
    if (editPatch.placement?.manual?.x !== 72) throw new Error('edit patch failed');
    if (applyAnnotationEdit(layout.annotations[0].annotation, { annotationId: 'smoke', suggestedAnchor: { type: 'point', point: { x: 30, y: 40 } } }).anchor.point.y !== 40) throw new Error('single edit apply failed');
    if (applyAnnotationEdits([layout.annotations[0].annotation], editPatch)[0]?.placement?.manual?.y !== 64) throw new Error('array edit apply failed');
    if (translateAnchor({ type: 'box', box: { x: 1, y: 2, width: 3, height: 4 } }, { x: 5, y: 6 }).box.x !== 6) throw new Error('translate anchor failed');
    const layoutQuality = evaluateAnnotationLayout(layout);
    if (!layoutQuality.ok) throw new Error('layout quality failed');
    assertAnnotationLayoutQuality(layoutQuality, { label: 'packed layout', minScore: 90 });
    if (!formatLayoutQualityReport(layoutQuality, { label: 'packed layout' }).includes('packed layout: ok')) throw new Error('layout quality report failed');
    if (!formatLayoutQualityIssue({
      type: 'bounds-overflow',
      severity: 'error',
      annotationId: 'packed',
      message: 'Packed annotation overflows bounds.'
    }).includes('error bounds-overflow target=packed')) throw new Error('layout quality issue format failed');
    const preparedDefaults = generatedSurfaceLayoutDefaults({
      anchorLabel: 'packed prepared anchors',
      failOnWarnings: true,
      includeInfo: true,
      layoutLabel: 'packed prepared layout'
    });
    const preparedLayout = resolvePreparedAnnotationLayout({
      annotations: [layout.annotations[0].annotation],
      obstacles: [],
      validation: { ok: true, found: ['smoke'], warnings: [], missing: [], diagnostics: [] }
    }, {
      ...preparedDefaults,
      bounds: { x: 0, y: 0, width: 120, height: 100 },
      assertQuality: true,
      assertTargetAlignment: { label: 'packed target alignment', failOnWarnings: true },
      noteSizes: { smoke: { width: 48, height: 32 } },
      targetAlignmentTargets: [{ id: 'smoke', expected: 'packed smoke target point', point: { x: 24, y: 32 } }],
      targetAlignmentOptions: { tolerance: 0.5 },
      targetAlignmentFormat: { label: 'packed target alignment', includeAligned: true },
      validationFormat: { ...preparedDefaults.validationFormat, includeFound: true }
    });
    if (!preparedLayout.validationSummary.includes('packed prepared anchors: ok') || !preparedLayout.targetAlignment?.ok || !preparedLayout.targetAlignmentSummary.includes('packed target alignment: ok') || !preparedLayout.quality.ok || !preparedLayout.qualitySummary.includes('packed prepared layout: ok')) throw new Error('prepared layout helper failed');
    if (circleSubjectPath({ radius: 6 }) !== 'M0,-6A6,6 0 1 1 0,6A6,6 0 1 1 0,-6Z') throw new Error('circle helper failed');
    const placedNote = notePlacement({
      x: 40,
      y: 40,
      width: 60,
      height: 30,
      bounds: { x: 0, y: 0, width: 200, height: 120 }
    });
    if (placedNote.transform !== 'translate(32, -15)') throw new Error('note placement helper failed');
    const parts = annotationParts({
      dx: 48,
      dy: 20,
      type: 'elbow',
      subject: { type: 'circle', radius: 8 }
    });
    if (!parts.subject || !parts.connector || !parts.note) throw new Error('annotation parts helper failed');
    if (connectorPathD({ x: 0, y: 0 }, { x: 100, y: -10, width: 40, height: 20 }, { type: 'straight', startOffset: 10, endOffset: 20 }) !== 'M 10 0 L 80 0') throw new Error('connector offset helper failed');
    if (connectorPathD({ x: 0, y: 0 }, { x: 100, y: -10, width: 20, height: 20 }, { type: 'straight', points: [{ x: 0, y: -30 }, { x: 100, y: -30 }] }) !== 'M 0 0 L 0 -30 L 100 -30 L 100 0') throw new Error('connector waypoint helper failed');
    if (connectorPathD(
      { x: 0, y: 50 },
      { x: 100, y: 40, width: 40, height: 20 },
      { type: 'straight' },
      {
        bounds: { x: -20, y: 0, width: 180, height: 120 },
        obstacles: [{ x: 40, y: 40, width: 20, height: 20 }]
      }
    ) !== 'M 0 50 L 0 33 L 67 33 L 67 50 L 100 50') throw new Error('connector obstacle routing failed');
    if (declutterLabels([{ pos: 10, size: 10 }, { pos: 12, size: 10 }], { gap: 4 }).join(',') !== '10,24') throw new Error('declutter helper failed');
    if (directLabels([{ anchor: { x: 10, y: 10 }, size: 10, key: 'a' }], { cross: 80 })[0]?.d !== 'M10,10L80,10') throw new Error('direct label helper failed');
    const preset = pointCallout({
      id: 'preset',
      point: { x: 20, y: 30 },
      note: { title: 'Preset' },
      style: { color: '#d12f6a' }
    });
    if (preset.connector?.end !== 'arrow') throw new Error('preset failed');
    if (preset.style?.color !== '#d12f6a') throw new Error('preset style failed');
    const encirclePreset = encircleCallout({
      id: 'encircle-preset',
      points: [{ x: 20, y: 30 }, { x: 48, y: 30 }, { x: 34, y: 52 }],
      pointRadius: 3,
      padding: 6,
      note: { title: 'Encircle preset' }
    });
    const encircleLayout = resolveAnnotationLayout({
      annotations: [encirclePreset],
      bounds: { x: 0, y: 0, width: 240, height: 180 },
      noteSizes: { 'encircle-preset': { width: 96, height: 40 } }
    });
    if (!renderAnnotationsSvg(encircleLayout).includes('pa-annotation__subject--geometry-encircle')) throw new Error('encircle preset render failed');
    const d3Style = annotationFromD3Style({
      id: 'd3-style',
      type: 'annotationCalloutCircle',
      x: 40,
      y: 50,
      dx: 60,
      dy: -20,
      color: '#d12f6a',
      note: { label: 'D3-style', align: 'middle', orientation: 'leftRight', wrapSplitter: /[,;]/, bgPadding: 12 },
      subject: { radius: 8, radiusPadding: 2 },
      connector: { end: 'arrow' }
    });
    if (d3Style.placement?.manual?.x !== 100 || d3Style.connector?.startOffset !== 10) throw new Error('d3-style bridge failed');
    if (d3Style.style?.color !== '#d12f6a' || d3Style.style?.lineColor !== '#d12f6a') throw new Error('d3-style color bridge failed');
    if (d3Style.note.line?.orientation !== 'vertical' || d3Style.note.align !== 'center' || d3Style.note.padding !== 12) throw new Error('d3-style note line bridge failed');
    if (!(d3Style.note.wrapSplitter instanceof RegExp)) throw new Error('d3-style wrap splitter bridge failed');
    if (annotationFromD3Style({ id: 'd3-default-line', type: 'annotationCallout', x: 1, y: 2, note: { label: 'Default' } }).note.line?.orientation !== 'horizontal') throw new Error('d3-style default note line failed');
    const d3AbsoluteNote = annotationFromD3Style({
      id: 'd3-absolute-note',
      type: 'annotationCallout',
      x: 40,
      y: 50,
      nx: 120,
      ny: 32,
      note: { label: 'Absolute note' }
    });
    if (d3AbsoluteNote.placement?.manual?.x !== 120 || d3AbsoluteNote.placement?.manual?.y !== 32 || d3AbsoluteNote.placement?.manual?.side !== 'right') throw new Error('d3-style nx/ny bridge failed');
    const d3Badge = annotationFromD3Style({
      id: 'd3-badge',
      type: 'annotationBadge',
      x: 80,
      y: 40,
      subject: { text: 'B', radius: 9, x: 'right', y: 'top' }
    });
    if (d3Badge.subject?.badge?.x !== 'right' || d3Badge.subject?.badge?.y !== 'top') throw new Error('d3-style badge side bridge failed');
    const d3NegativeRect = annotationFromD3Style({
      id: 'd3-negative-rect',
      type: 'annotationCalloutRect',
      x: 120,
      y: 80,
      note: { label: 'Negative rect' },
      subject: { x: 0, y: 0, width: -54, height: -28 }
    });
    if (d3NegativeRect.anchor.box.x !== 66 || d3NegativeRect.anchor.box.y !== 52 || d3NegativeRect.anchor.box.width !== 54 || d3NegativeRect.anchor.box.height !== 28) throw new Error('d3-style negative rect bridge failed');
    if (annotationsFromD3Style([{ data: { x: 4, y: 6 }, note: { label: 'Accessor' } }], { x: 'x', y: (datum) => datum.y })[0]?.anchor.point.x !== 4) throw new Error('d3-style accessor bridge failed');
    const d3DataHook = annotationsFromD3Style([
      { data: { x: 4, y: 6 }, annotationData: { hook: 'packed-d3' }, note: { label: 'Accessor data hook' } }
    ], { x: 'x', y: (datum) => datum.y })[0];
    if (d3DataHook.data?.hook !== 'packed-d3' || d3DataHook.metadata?.datum?.x !== 4) throw new Error('d3-style annotation data hook failed');
    if (!renderAnnotationsSvg(resolveAnnotationLayout({
      annotations: [d3DataHook],
      bounds: { x: 0, y: 0, width: 180, height: 120 },
      noteSizes: { [d3DataHook.id]: { width: 72, height: 32 } }
    })).includes('data-hook="packed-d3"')) throw new Error('d3-style annotation data render failed');
    const d3Collection = {
      type: 'annotationCalloutCircle',
      accessors: { x: 'period', y: 'score' },
      accessorsInverse: { x: 'period', y: 'score' },
      ids: ['d3-collection'],
      editMode: true,
      notePadding: 5,
      textWrap: 16,
      annotations: [{
        data: { period: 2, score: 9 },
        dx: 24,
        dy: -12,
        note: { label: 'D3 collection' },
        subject: { radius: 6 }
      }]
    };
    const d3PreparedCollection = prepareD3StyleAnnotationCollection(d3Collection);
    if (!d3PreparedCollection.editMode || d3PreparedCollection.annotations[0]?.id !== 'd3-collection' || d3PreparedCollection.annotations[0]?.note.padding !== 5 || d3PreparedCollection.annotations[0]?.note.wrap !== 16) throw new Error('d3-style collection bridge failed');
    if (annotationsFromD3StyleCollection(d3Collection)[0]?.anchor.point.y !== 9) throw new Error('d3-style collection accessor bridge failed');
    const d3CollectionPatch = d3StyleAnnotationCollectionEditPatch(d3Collection, {
      annotationId: 'd3-collection',
      suggestedAnchor: { type: 'point', point: { x: 4, y: 12 } },
      suggestedPlacement: { manual: { x: 44, y: 20 } }
    });
    if (d3CollectionPatch.annotation.data.period !== 4 || d3CollectionPatch.annotation.data.score !== 12) throw new Error('d3-style collection edit patch failed');
    const d3EditedCollection = applyD3StyleAnnotationCollectionEdit(d3Collection, {
      annotationId: 'd3-collection',
      suggestedAnchor: { type: 'point', point: { x: 4, y: 12 } },
      suggestedPlacement: { manual: { x: 44, y: 20 } }
    });
    if (d3EditedCollection.annotations[0]?.data.period !== 4 || d3EditedCollection.annotations[0]?.dx !== 40) throw new Error('d3-style collection edit apply failed');
    const d3Builder = createD3StyleAnnotationBuilder()
      .type('annotationCalloutCircle')
      .accessors({ x: 'period', y: 'score' })
      .accessorsInverse({ x: 'period', y: 'score' })
      .ids(['d3-builder'])
      .editMode(true)
      .notePadding(5)
      .textWrap(16)
      .annotations(d3Collection.annotations);
    if (!d3Builder.editMode() || d3Builder.toAnnotations()[0]?.id !== 'd3-builder' || d3Builder.prepare().annotations[0]?.note.wrap !== 16) throw new Error('d3-style builder failed');
    d3Builder.applyEdit({
      annotationId: 'd3-builder',
      suggestedAnchor: { type: 'point', point: { x: 7, y: 14 } },
      suggestedPlacement: { manual: { x: 48, y: 22 } }
    });
    if (d3Builder.config().annotations[0]?.data.period !== 7 || d3Builder.toAnnotations()[0]?.placement?.manual?.x !== 48) throw new Error('d3-style builder edit failed');
    const d3CustomType = defineD3StyleAnnotationType({
      baseType: 'annotationCalloutRect',
      defaults: {
        dx: 24,
        dy: -12,
        subject: { width: 40, height: 18, x: -20, y: -9 },
        connector: { type: 'elbow', end: 'arrow' },
        note: { lineType: 'vertical', bgPadding: 5 }
      },
      transform: (annotation, context) => ({
        ...annotation,
        variant: 'band',
        metadata: { ...annotation.metadata, customIndex: context.index }
      })
    });
    const d3Custom = annotationsFromD3StyleType(d3CustomType, [{
      id: 'd3-custom',
      x: 100,
      y: 70,
      note: { label: 'Custom' }
    }])[0];
    if (d3Custom.variant !== 'band' || d3Custom.anchor.box.width !== 40 || d3Custom.note.line?.orientation !== 'vertical' || d3Custom.metadata.customIndex !== 0) throw new Error('d3-style custom type bridge failed');
    const d3EditPatch = d3StyleAnnotationEditPatch({
      id: 'd3-edit',
      x: 40,
      y: 50,
      note: { label: 'D3 edit' }
    }, {
      annotationId: 'd3-edit',
      suggestedPlacement: { manual: { x: 90, y: 35 } }
    });
    if (d3EditPatch.dx !== 50 || d3EditPatch.dy !== -15) throw new Error('d3-style edit patch failed');
    const d3Edited = applyD3StyleAnnotationEdit({
      id: 'd3-edit-data',
      data: { x: 4, y: 6 },
      note: { label: 'D3 edit data' }
    }, {
      annotationId: 'd3-edit-data',
      suggestedAnchor: { type: 'point', point: { x: 14, y: 18 } }
    }, {
      x: 'x',
      y: 'y'
    });
    if (d3Edited.data.x !== 14 || d3Edited.data.y !== 18) throw new Error('d3-style edit apply failed');
    const validationReport = {
      ok: false,
      found: [],
      warnings: [],
      missing: [{
        id: 'missing-packed',
        source: 'packed-smoke',
        status: 'missing',
        expected: 'selector ".missing"',
        found: false
      }],
      diagnostics: []
    };
    if (!formatAnchorValidationReport(validationReport, { label: 'Packed anchors' }).includes('missing-packed')) throw new Error('anchor validation formatting failed');
    assertAnchorValidationReportIfRequested(validationReport, false);
    try {
      assertAnchorValidationReport(validationReport, { label: 'Packed anchors' });
      throw new Error('anchor validation assert did not throw');
    } catch (error) {
      if (!String(error.message).includes('missing-packed')) throw error;
    }
    const alignmentReport = evaluateAnchorAlignment([layout.annotations[0].annotation], [{
      id: 'smoke',
      point: { x: 24, y: 32 }
    }]);
    if (!formatAnchorAlignmentReport(alignmentReport, { label: 'Packed target alignment' }).includes('1 aligned')) throw new Error('anchor alignment formatting failed');
    assertAnchorAlignmentReportIfRequested(alignmentReport, true, { label: 'Packed target alignment' });
    assertAnchorAlignmentReport(alignmentReport, { label: 'Packed target alignment' });
    if (allPlacementCandidates({
      annotation: preset,
      bounds: { x: 0, y: 0, width: 240, height: 180 },
      noteSize: { width: 80, height: 40 },
      obstacles: [],
      placedNotes: [],
      placement: { maxCandidates: 3 }
    }).length !== 3) throw new Error('candidate search failed');
    if (boxFromDOMRect({ x: 1, y: 2, width: 3, height: 4, left: 1, top: 2, right: 4, bottom: 6 }).width !== 3) throw new Error('dom box failed');
    if (anchorFromDOMRect({ x: 1, y: 2, width: 3, height: 4, left: 1, top: 2, right: 4, bottom: 6 }).type !== 'box') throw new Error('dom anchor failed');
    if (typeof annotationFrameFromSvg !== 'function') throw new Error('dom svg annotation frame export failed');
    const domSurface = fakeElement('section', { id: 'surface' }, [
      fakeElement('div', { id: 'target' }, [], { x: 14, y: 20, width: 30, height: 10 }),
      fakeElement('div', { class: 'obstacle' }, [], { x: 60, y: 40, width: 20, height: 12 })
    ], { x: 10, y: 10, width: 200, height: 120 });
    if (anchorFromSelector(domSurface, '#target', { coordinateSpace: domSurface })?.box.x !== 4) throw new Error('dom selector anchor failed');
    if (obstaclesFromSelector(domSurface, '.obstacle', { coordinateSpace: domSurface, inflate: 2 })[0]?.width !== 24) throw new Error('dom selector obstacles failed');
    if (annotationsFromDomSelectors(domSurface, [{ selector: '#target', coordinateSpace: domSurface, note: { title: 'DOM' } }])[0]?.data?.domSelector !== '#target') throw new Error('dom selector annotations failed');
    const preparedDom = prepareDomAnnotations(domSurface, [{ selector: '#target', coordinateSpace: domSurface, note: { title: 'DOM' } }], { obstacles: [{ selector: '.obstacle', coordinateSpace: domSurface, inflate: 2 }], assert: true });
    if (!preparedDom.validation.ok || preparedDom.annotations.length !== 1 || preparedDom.obstacles[0]?.width !== 24) throw new Error('dom prepare failed');
    if (validateDomAnchors(domSurface, [{ id: 'missing', selector: '.missing' }]).missing[0]?.status !== 'missing') throw new Error('dom diagnostics failed');

    const viewAnchors = anchorsFromVegaView({ data: () => [{ id: 'peak', x: 12, y: 18 }] }, [
      { id: 'peak', datum: (datum) => datum.id === 'peak', x: 'x', y: 'y' }
    ]);
    if (viewAnchors[0]?.anchor.type !== 'point') throw new Error('vega adapter failed');
    if (obstaclesFromVegaView({ data: () => [{ id: 'peak', x: 12, y: 18, width: 4, height: 6 }] }, { x: 'x', y: 'y', width: 'width', height: 'height', padding: 2 })[0]?.width !== 8) throw new Error('vega view obstacles failed');
    const preparedVegaView = prepareVegaViewAnnotations({ data: () => [{ id: 'peak', x: 12, y: 18, width: 4, height: 6 }] }, [{ id: 'peak', x: 'x', y: 'y', width: 'width', height: 'height' }], { assert: true });
    if (!preparedVegaView.validation.ok || preparedVegaView.annotations.length !== 1 || preparedVegaView.obstacles[0]?.width !== 4) throw new Error('vega view prepare failed');
    if (validateVegaViewAnchors({ data: () => [{ id: 'peak', x: 12, y: 18 }] }, [{ id: 'missing', datum: (datum) => datum.id === 'missing', x: 'x', y: 'y' }]).missing[0]?.status !== 'missing') throw new Error('vega view diagnostics failed');
    const scaleAnchors = anchorsFromVegaScales({
      data: () => [{ id: 'scaled', x: 2, y: 3 }],
      scale: () => (value) => Number(value) * 10
    }, [{ id: 'scaled', xScale: 'x', yScale: 'y', x: 'x', y: 'y' }]);
    if (scaleAnchors[0]?.source !== 'vega-scale') throw new Error('vega scale adapter failed');
    if (obstaclesFromVegaScales({
      data: () => [{ id: 'scaled', x: 2, y: 3, width: 4, height: 6 }],
      scale: () => (value) => Number(value) * 10
    }, { xScale: 'x', yScale: 'y', x: 'x', y: 'y', width: 'width', height: 'height', padding: 2 })[0]?.width !== 8) throw new Error('vega scale obstacles failed');
    const preparedVegaScale = prepareVegaScaleAnnotations({
      data: () => [{ id: 'scaled', x: 2, y: 3, width: 4, height: 6 }],
      scale: () => (value) => Number(value) * 10
    }, [{ id: 'scaled', xScale: 'x', yScale: 'y', x: 'x', y: 'y', width: 'width', height: 'height' }], { assert: true });
    if (!preparedVegaScale.validation.ok || preparedVegaScale.annotations.length !== 1 || preparedVegaScale.obstacles[0]?.width !== 4) throw new Error('vega scale prepare failed');
    const sceneAnchors = anchorsFromVegaScenegraph({
      scenegraph: () => ({ root: { items: [{ mark: { name: 'points' }, bounds: { x1: 1, y1: 2, x2: 3, y2: 4 } }] } })
    }, [{ id: 'scene', markName: 'points' }]);
    if (sceneAnchors[0]?.source !== 'vega-scenegraph') throw new Error('vega scenegraph adapter failed');
    const sceneAnnotations = annotationsFromVegaScenegraph({
      scenegraph: () => ({ root: { items: [{ mark: { name: 'points', marktype: 'symbol' }, bounds: { x1: 1, y1: 2, x2: 3, y2: 4 } }] } })
    }, [{
      id: 'scene-note',
      markName: 'points',
      note: { title: 'Scene' },
      tone: 'info',
      annotationClassName: 'packed-vega-note',
      annotationData: { consumer: 'packed-chart' },
      metadata: { packed: true }
    }]);
    if (sceneAnnotations[0]?.data?.vegaMarkName !== 'points') throw new Error('vega annotation provenance failed');
    if (sceneAnnotations[0]?.tone !== 'info' || sceneAnnotations[0]?.className !== 'packed-vega-note' || sceneAnnotations[0]?.data?.consumer !== 'packed-chart' || sceneAnnotations[0]?.metadata?.packed !== true) throw new Error('vega annotation authoring failed');
    if (obstaclesFromVegaScenegraph({
      scenegraph: () => ({ root: { items: [{ mark: { name: 'axis' }, role: 'axis', bounds: { x1: 0, y1: 20, x2: 100, y2: 24 } }] } })
    }, { role: 'axis', padding: 2 })[0]?.height !== 8) throw new Error('vega scenegraph obstacles failed');
    const preparedVegaScene = prepareVegaScenegraphAnnotations({
      scenegraph: () => ({ root: { items: [
        { mark: { name: 'points' }, bounds: { x1: 1, y1: 2, x2: 3, y2: 4 } },
        { mark: { name: 'axis' }, role: 'axis', bounds: { x1: 0, y1: 20, x2: 100, y2: 24 } }
      ] } })
    }, [{ id: 'scene', markName: 'points' }], { obstacles: { role: 'axis', padding: 2 }, assert: true });
    if (!preparedVegaScene.validation.ok || preparedVegaScene.annotations.length !== 1 || preparedVegaScene.obstacles[0]?.height !== 8) throw new Error('vega scenegraph prepare failed');

    const vegaSvg = fakeElement('svg', {}, [
      fakeElement('g', { id: 'points-layer', class: 'mark-symbol role-mark points', 'data-mark-name': 'points', 'data-mark-type': 'symbol' }, [
        fakeElement('path', { id: 'point-peak' }, [], { x: 10, y: 20, width: 8, height: 8 })
      ])
    ]);
    const vegaSvgAnchors = anchorsFromVegaSvg(vegaSvg, [{ id: 'peak', selector: '#point-peak', coordinateSpace: vegaSvg }]);
    if (vegaSvgAnchors[0]?.anchor.type !== 'box') throw new Error('vega svg anchors failed');
    if (annotationsFromVegaSvg(vegaSvg, [{ id: 'peak-note', selector: '#point-peak', coordinateSpace: vegaSvg }])[0]?.data?.anchorSource !== 'vega-svg') throw new Error('vega svg annotations failed');
    if (obstaclesFromVegaSvg(vegaSvg, { markName: 'points', coordinateSpace: vegaSvg, padding: 2 })[0]?.width !== 12) throw new Error('vega svg obstacles failed');
    if (findVegaSvgElement(vegaSvg, { id: 'peak', markName: 'points' })?.id !== 'points-layer') throw new Error('vega svg finder failed');
    if (validateVegaSvgAnchors(vegaSvg, [{ id: 'missing', selector: '.missing-mark' }]).missing[0]?.expected !== 'selector ".missing-mark"') throw new Error('vega svg diagnostics failed');
    const preparedVegaSvg = prepareVegaSvgAnnotations(vegaSvg, [{ id: 'peak', selector: '#point-peak', coordinateSpace: vegaSvg }], { obstacles: { markName: 'points', coordinateSpace: vegaSvg, padding: 2 }, assert: true });
    if (!preparedVegaSvg.validation.ok || preparedVegaSvg.annotations.length !== 1 || preparedVegaSvg.obstacles[0]?.width !== 12) throw new Error('vega svg prepare failed');

    const d2Anchors = anchorsFromD2Diagram({ shapes: [{ id: 'node', pos: { x: 4, y: 8 }, width: 40, height: 24 }] }, [
      { id: 'node-note', shapeId: 'node' }
    ]);
    if (d2Anchors[0]?.anchor.type !== 'box') throw new Error('d2 adapter failed');
    if (validateD2DiagramAnchors({ connections: [{ id: 'edge', src: 'a', dst: 'b' }] }, [{ id: 'edge-note', connectionId: 'edge' }]).missing[0]?.reason?.includes('no route points') !== true) throw new Error('d2 diagram diagnostics failed');
    const d2Annotations = annotationsFromD2Diagram({ shapes: [{ id: 'node', pos: { x: 4, y: 8 }, width: 40, height: 24 }] }, [
      { id: 'node-note', shapeId: 'node', tone: 'warning', annotationClassName: 'packed-d2-note', annotationData: { consumer: 'packed-diagram' }, metadata: { packed: true } }
    ]);
    if (d2Annotations[0]?.data?.d2ShapeId !== 'node') throw new Error('d2 annotation provenance failed');
    if (d2Annotations[0]?.tone !== 'warning' || d2Annotations[0]?.className !== 'packed-d2-note' || d2Annotations[0]?.data?.consumer !== 'packed-diagram' || d2Annotations[0]?.metadata?.packed !== true) throw new Error('d2 annotation authoring failed');
    if (obstaclesFromD2Diagram({ shapes: [{ id: 'node', pos: { x: 4, y: 8 }, width: 40, height: 24 }] }).length !== 1) throw new Error('d2 obstacles failed');
    const preparedD2Diagram = prepareD2DiagramAnnotations({
      shapes: [{ id: 'node', pos: { x: 4, y: 8 }, width: 40, height: 24 }],
      connections: [{ id: 'edge', src: 'a', dst: 'b', route: [{ x: 44, y: 20 }, { x: 80, y: 20 }] }]
    }, [{ id: 'node-note', shapeId: 'node' }], { obstacles: { padding: 2 }, assert: true });
    if (!preparedD2Diagram.validation.ok || preparedD2Diagram.annotations.length !== 1 || preparedD2Diagram.obstacles.length !== 2) throw new Error('d2 diagram prepare failed');
    const d2Svg = fakeElement('svg', {}, [
      fakeElement('g', { id: 'shape-node', 'data-d2-shape-id': 'node' }, [], { x: 4, y: 8, width: 40, height: 24 }),
      fakeElement('path', { id: 'edge-node', 'data-d2-connection-id': 'edge', class: 'd2-connection' }, [], { x: 44, y: 20, width: 36, height: 2 })
    ]);
    if (anchorsFromD2Svg(d2Svg, [{ id: 'node-svg', shapeId: 'node', coordinateSpace: d2Svg }])[0]?.source !== 'd2-svg') throw new Error('d2 svg anchors failed');
    if (annotationsFromD2Svg(d2Svg, [{ id: 'node-svg', shapeId: 'node', coordinateSpace: d2Svg }])[0]?.data?.d2ShapeId !== 'node') throw new Error('d2 svg annotations failed');
    if (obstaclesFromD2Svg(d2Svg, { selector: '#shape-node', coordinateSpace: d2Svg, padding: 2 })[0]?.width !== 44) throw new Error('d2 svg obstacles failed');
    if (findD2SvgElement(d2Svg, { id: 'node-svg', shapeId: 'node' })?.id !== 'shape-node') throw new Error('d2 svg finder failed');
    if (validateD2SvgAnchors(d2Svg, [{ id: 'missing', selector: '.missing-shape' }]).missing[0]?.status !== 'missing') throw new Error('d2 svg diagnostics failed');
    const preparedD2Svg = prepareD2SvgAnnotations(d2Svg, [{ id: 'node-svg', shapeId: 'node', coordinateSpace: d2Svg }], { obstacles: { coordinateSpace: d2Svg, padding: 2 }, assert: true });
    if (!preparedD2Svg.validation.ok || preparedD2Svg.annotations.length !== 1 || preparedD2Svg.obstacles.length !== 2) throw new Error('d2 svg prepare failed');

    const flowAnchors = anchorsFromReactFlow({ nodes: [{ id: 'n1', position: { x: 10, y: 20 }, width: 80, height: 40 }] }, [
      { id: 'n1-note', nodeId: 'n1' }
    ]);
    if (flowAnchors[0]?.anchor.type !== 'box') throw new Error('react-flow adapter failed');
    if (flowAnchors[0]?.nodeId !== 'n1') throw new Error('react-flow provenance failed');
    if (validateReactFlowAnchors({ nodes: [{ id: 'n1', position: { x: 10, y: 20 }, width: 80, height: 40 }] }, [{ id: 'missing-handle', handle: { nodeId: 'n1', id: 'missing', side: 'right' } }]).warnings[0]?.status !== 'fallback') throw new Error('react-flow diagnostics failed');
    const flowAnnotations = annotationsFromReactFlow({ nodes: [{ id: 'n1', position: { x: 10, y: 20 }, width: 80, height: 40 }] }, [
      { id: 'n1-note', nodeId: 'n1', tone: 'success', annotationClassName: 'packed-flow-note', annotationData: { consumer: 'packed-graph' }, metadata: { packed: true } }
    ]);
    if (flowAnnotations[0]?.data?.reactFlowNodeId !== 'n1') throw new Error('react-flow annotation provenance failed');
    if (flowAnnotations[0]?.tone !== 'success' || flowAnnotations[0]?.className !== 'packed-flow-note' || flowAnnotations[0]?.data?.consumer !== 'packed-graph' || flowAnnotations[0]?.metadata?.packed !== true) throw new Error('react-flow annotation authoring failed');
    const measuredHandle = { id: 'out', type: 'source', position: 'right', x: 74, y: 16, width: 12, height: 12 };
    const handleAnchors = anchorsFromReactFlow({ nodes: [{ id: 'n2', position: { x: 10, y: 20 }, width: 80, height: 40, handles: [measuredHandle] }] }, [
      { id: 'n2-handle', handle: { nodeId: 'n2', id: 'out', type: 'source' } }
    ]);
    if (handleBox({ id: 'n2', position: { x: 10, y: 20 }, width: 80, height: 40 }, measuredHandle).x !== 84) throw new Error('react-flow handle box failed');
    if (handleAnchors[0]?.point?.x !== 96 || handleAnchors[0]?.handleType !== 'source') throw new Error('react-flow handle anchor failed');
    const flowObstacles = obstaclesFromReactFlow({
      nodes: [
        { id: 'n1', position: { x: 10, y: 20 }, width: 80, height: 40, handles: [measuredHandle] },
        { id: 'n2', position: { x: 150, y: 20 }, width: 80, height: 40 }
      ],
      edges: [{ id: 'n1-n2', source: 'n1', target: 'n2' }]
    }, { includeHandles: true, includeEdges: true, padding: 2 });
    if (flowObstacles.length !== 4 || flowObstacles[0]?.width !== 84 || flowObstacles[2]?.width !== 16 || flowObstacles[3]?.height !== 4) throw new Error('react-flow obstacles failed');
    const preparedFlow = prepareReactFlowAnnotations({
      nodes: [
        { id: 'n1', position: { x: 10, y: 20 }, width: 80, height: 40, handles: [measuredHandle] },
        { id: 'n2', position: { x: 150, y: 20 }, width: 80, height: 40 }
      ],
      edges: [{ id: 'n1-n2', source: 'n1', target: 'n2' }]
    }, [{ id: 'n1-note', nodeId: 'n1' }, { id: 'edge-note', edgeId: 'n1-n2' }], { obstacles: { padding: 2 }, assert: true });
    if (!preparedFlow.validation.ok || preparedFlow.annotations.length !== 2 || preparedFlow.obstacles.length !== 4) throw new Error('react-flow prepare failed');
    const mermaidSvg = fakeElement('svg', {}, [
      fakeElement('g', { id: 'flowchart-api-1', class: 'node' }, [
        fakeElement('text', {}, [], { x: 10, y: 20, width: 24, height: 12 }, 'API')
      ], { x: 4, y: 8, width: 48, height: 24 }),
      fakeElement('path', { id: 'edge-api-report', class: 'flowchart-link' }, [], { x: 52, y: 20, width: 48, height: 4 })
    ]);
    if (anchorsFromMermaidSvg(mermaidSvg, [{ id: 'api', label: 'API', coordinateSpace: mermaidSvg }])[0]?.mermaidKind !== 'label') throw new Error('mermaid svg anchors failed');
    if (annotationsFromMermaidSvg(mermaidSvg, [{ id: 'api', label: 'API', coordinateSpace: mermaidSvg }])[0]?.data?.mermaidLabel !== 'API') throw new Error('mermaid svg annotations failed');
    if (obstaclesFromMermaidSvg(mermaidSvg, { coordinateSpace: mermaidSvg }).length < 2) throw new Error('mermaid svg obstacles failed');
    if (findMermaidElement(mermaidSvg, { id: 'api', label: 'API' })?.id !== 'flowchart-api-1') throw new Error('mermaid svg finder failed');
    if (validateMermaidSvgAnchors(mermaidSvg, [{ id: 'missing', label: 'Worker' }]).missing[0]?.expected !== 'exact label "Worker"') throw new Error('mermaid diagnostics failed');
    const preparedMermaid = prepareMermaidAnnotations(mermaidSvg, [{
      id: 'api',
      label: 'API',
      coordinateSpace: mermaidSvg,
      tone: 'accent',
      annotationClassName: 'packed-mermaid-note',
      annotationData: { consumer: 'packed-diagram' },
      metadata: { packed: true }
    }], { obstacles: { coordinateSpace: mermaidSvg }, assert: true });
    if (!preparedMermaid.validation.ok || preparedMermaid.annotations.length !== 1 || preparedMermaid.obstacles.length < 2) throw new Error('mermaid prepare failed');
    if (preparedMermaid.annotations[0]?.tone !== 'accent' || preparedMermaid.annotations[0]?.className !== 'packed-mermaid-note' || preparedMermaid.annotations[0]?.data?.consumer !== 'packed-diagram' || preparedMermaid.annotations[0]?.metadata?.packed !== true) throw new Error('mermaid annotation authoring failed');

    const cssUrl = new URL(await import.meta.resolve('@ponchia/annotations/bronto.css'));
    await access(cssUrl);
    const css = await readFile(cssUrl, 'utf8');
    if (!css.includes('.pa-annotation-layer') || !css.includes('var(--accent') || !css.includes('var(--panel')) throw new Error('css bridge failed');
    if (!css.includes('.pa-annotation--warning') || !css.includes('paAnnotationPulse')) throw new Error('css variant bridge failed');
    if (!css.includes('.pa-annotation--callout .pa-annotation__note-line') || !css.includes('.pa-annotation--threshold .pa-annotation__subject') || !css.includes('.pa-annotation--evidence .pa-annotation__subject') || !css.includes('color-mix(in srgb, var(--pa-annotation-accent) 14%, transparent)')) throw new Error('css package variant grammar failed');
    if (!css.includes('.pa-annotation__edit-handle')) throw new Error('css edit bridge failed');
    if (!css.includes('.ui-annotation') || !css.includes('.ui-annotation__title') || !css.includes('uiAnnotationPulse')) throw new Error('legacy bronto annotation bridge failed');

    function fakeElement(tagName, attributes = {}, children = [], bbox = { x: 0, y: 0, width: 0, height: 0 }, textContent = '') {
      const element = {
        tagName,
        id: attributes.id ?? '',
        textContent,
        children,
        parentElement: undefined,
        ownerSVGElement: undefined,
        classList: {
          contains(value) {
            return String(attributes.class ?? '').split(/\\s+/).includes(value);
          }
        },
        getAttribute(name) {
          return attributes[name] ?? null;
        },
        getBBox() {
          return bbox;
        },
        getBoundingClientRect() {
          return {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
            left: bbox.x,
            top: bbox.y,
            right: bbox.x + bbox.width,
            bottom: bbox.y + bbox.height
          };
        },
        querySelector(selector) {
          return this.querySelectorAll(selector)[0] ?? null;
        },
        querySelectorAll(selector) {
          return descendants(this).filter((candidate) => matchesAnySelector(candidate, selector));
        },
        closest(selector) {
          let current = this;

          while (current) {
            if (matchesAnySelector(current, selector)) {
              return current;
            }

            current = current.parentElement;
          }

          return null;
        }
      };

      for (const child of children) {
        child.parentElement = element;
        child.ownerSVGElement = tagName.toLowerCase() === 'svg'
          ? element
          : element.ownerSVGElement;
      }

      return element;
    }

    function descendants(element) {
      return element.children.flatMap((child) => [child, ...descendants(child)]);
    }

    function matchesAnySelector(element, selector) {
      return selector.split(',').some((part) => matchesCompoundSelector(element, part.trim()));
    }

    function matchesCompoundSelector(element, selector) {
      if (!selector) return false;
      return selector.split(/(?=\\.|#|\\[)/).every((part) => matchesSimpleSelector(element, part));
    }

    function matchesSimpleSelector(element, selector) {
      if (selector === '*') return true;
      if (/^[a-z]+$/i.test(selector)) return element.tagName.toLowerCase() === selector.toLowerCase();
      if (selector.startsWith('#')) return element.id === selector.slice(1);
      if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));

      const contains = selector.match(/^\\[([^\\]=*]+)\\*="([^"]*)"\\]$/);
      if (contains) return String(element.getAttribute(contains[1]) ?? '').includes(contains[2]);

      const includesWord = selector.match(/^\\[([^\\]~=]+)~="([^"]*)"\\]$/);
      if (includesWord) return String(element.getAttribute(includesWord[1]) ?? '').split(/\\s+/).includes(includesWord[2]);

      const exists = selector.match(/^\\[([^\\]=~*]+)\\]$/);
      if (exists) return element.getAttribute(exists[1]) !== null;

      const exact = selector.match(/^\\[([^\\]=]+)="([^"]*)"\\]$/);
      if (exact) return element.getAttribute(exact[1]) === exact[2];

      return false;
    }
  `;

  await exec('node', ['--input-type=module', '-e', smoke], { cwd: workdir, maxBuffer: 1024 * 1024 });
}

function assertPackContents(packResult) {
  const files = new Set(packResult.files.map((file) => file.path));
  const required = [
    'LICENSE',
    'README.md',
    'package.json',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/react/index.js',
    'dist/react/index.d.ts',
    'dist/dom/index.js',
    'dist/dom/index.d.ts',
    'dist/adapters/vega.js',
    'dist/adapters/vega.d.ts',
    'dist/adapters/mermaid.js',
    'dist/adapters/mermaid.d.ts',
    'dist/adapters/d2.js',
    'dist/adapters/d2.d.ts',
    'dist/adapters/react-flow.js',
    'dist/adapters/react-flow.d.ts',
    'dist/bronto.css',
    'dist/bronto.css.d.ts',
    'docs/e2e-plan.md',
    'docs/adr/0001-standalone-annotations-product.md'
  ];
  const missing = required.filter((file) => !files.has(file));

  if (missing.length > 0) {
    throw new Error(`packed tarball is missing required files: ${missing.join(', ')}`);
  }

  const forbidden = packResult.files
    .map((file) => file.path)
    .filter((path) => /^(src|test|examples|scripts|node_modules|\.tmp|\.playwright-cli)\//.test(path)
      || path.endsWith('.tgz')
      || path === '.env'
      || path.includes('/.env')
      || path.includes('/__screenshots__/'));

  if (forbidden.length > 0) {
    throw new Error(`packed tarball includes non-public files: ${forbidden.join(', ')}`);
  }
}

async function smokeReact(tarball) {
  const workdir = await consumerWorkdir();

  await install(workdir, [tarball, 'react@^19.1.0', 'react-dom@^19.1.0', 'jsdom@^26.1.0']);

  const smoke = `
    import React from 'react';
    import { flushSync } from 'react-dom';
    import { createRoot } from 'react-dom/client';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { JSDOM } from 'jsdom';
    import { AnnotationLayer } from '@ponchia/annotations/react';

    const markup = renderToStaticMarkup(React.createElement(AnnotationLayer, {
      annotations: [{ id: 'react-smoke', anchor: { type: 'point', point: { x: 40, y: 40 } }, note: { title: 'React smoke' }, placement: { manual: { x: 80, y: 40 } } }],
      bounds: { x: 0, y: 0, width: 240, height: 180 }
    }));

    if (!markup.includes('React smoke')) throw new Error('react adapter failed');
    if (!markup.includes('pa-annotation__connector')) throw new Error('react connector failed');
    if (!markup.includes('pa-annotation--manual')) throw new Error('react manual placement failed');

    const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.SVGElement = dom.window.SVGElement;
    globalThis.Node = dom.window.Node;

    let targetAlignmentEvent;
    let qualityEvent;
    const root = createRoot(document.querySelector('#root'));

    flushSync(() => root.render(React.createElement(AnnotationLayer, {
      annotations: [{ id: 'react-smoke', anchor: { type: 'point', point: { x: 40, y: 40 } }, note: { title: 'React smoke' } }],
      bounds: { x: 0, y: 0, width: 240, height: 180 },
      assertTargetAlignment: { label: 'Packed React target alignment', failOnWarnings: true },
      targetAlignmentTargets: [{ id: 'react-smoke', expected: 'packed React target point', point: { x: 40, y: 40 } }],
      targetAlignmentOptions: { tolerance: 0.5 },
      targetAlignmentFormat: { label: 'Packed React target alignment', includeAligned: true },
      onTargetAlignment: (event) => {
        targetAlignmentEvent = event;
      },
      onQuality: (event) => {
        qualityEvent = event;
      }
    })));

    if (!targetAlignmentEvent?.targetAlignment?.ok || !targetAlignmentEvent.summary.includes('Packed React target alignment: ok')) throw new Error('react target alignment event failed');
    if (!qualityEvent?.quality?.ok) throw new Error('react quality event failed');
  `;

  await exec('node', ['--input-type=module', '-e', smoke], { cwd: workdir, maxBuffer: 1024 * 1024 });
}

async function smokeBrowserBundle(tarball) {
  const workdir = await consumerWorkdir();
  await install(workdir, [tarball]);
  await mkdir(join(workdir, 'src'), { recursive: true });
  await writeFile(join(workdir, 'index.html'), `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Packed browser smoke</title>
      </head>
      <body>
        <main id="app"></main>
        <script type="module" src="/src/main.js"></script>
      </body>
    </html>
  `);
  await writeFile(join(workdir, 'src/main.js'), `
    import {
      annotationFromD3Style,
      renderAnnotationsSvg,
      resolveAnnotationLayout
    } from '@ponchia/annotations';
    import '@ponchia/annotations/bronto.css';

    const annotation = annotationFromD3Style({
      id: 'packed-browser',
      type: 'annotationCalloutCircle',
      x: 80,
      y: 80,
      dx: 72,
      dy: -28,
      note: {
        title: 'Packed browser',
        label: 'Styled tarball import',
        lineType: 'horizontal'
      },
      subject: { radius: 8, radiusPadding: 2 },
      connector: { end: 'arrow' },
      color: '#d12f6a'
    });
    const layout = resolveAnnotationLayout({
      annotations: [annotation],
      bounds: { x: 0, y: 0, width: 260, height: 180 },
      noteSizes: { 'packed-browser': { width: 112, height: 64 } }
    });

    document.querySelector('#app').innerHTML = renderAnnotationsSvg(layout, {
      markerIdPrefix: 'packed-browser'
    });
    window.__packedBrowserSmoke = {
      annotations: layout.annotations.length,
      quality: layout.annotations[0]?.placement.score ?? Number.POSITIVE_INFINITY
    };
  `);

  const server = await createServer({
    root: workdir,
    configFile: false,
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false
    }
  });

  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    await server.close();
    throw new Error('packed browser smoke could not determine Vite port');
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 420 } });
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.pa-annotation__note-box', { timeout: 30000 });

    const evidence = await page.evaluate(() => {
      const note = document.querySelector('.pa-annotation__note-box');
      const connector = document.querySelector('.pa-annotation__connector');
      const subject = document.querySelector('.pa-annotation__subject');
      const title = document.querySelector('.pa-annotation__title');
      const noteStyle = note ? getComputedStyle(note) : undefined;
      const connectorStyle = connector ? getComputedStyle(connector) : undefined;
      const subjectStyle = subject ? getComputedStyle(subject) : undefined;
      const titleStyle = title ? getComputedStyle(title) : undefined;

      return {
        text: document.body.textContent ?? '',
        smoke: window.__packedBrowserSmoke,
        noteBox: note?.getBoundingClientRect().toJSON(),
        connectorBox: connector?.getBoundingClientRect().toJSON(),
        noteBackground: noteStyle?.fill ?? noteStyle?.backgroundColor ?? '',
        noteStroke: noteStyle?.stroke ?? noteStyle?.borderColor ?? '',
        connectorStroke: connectorStyle?.stroke ?? '',
        connectorStrokeWidth: connectorStyle?.strokeWidth ?? '',
        subjectStroke: subjectStyle?.stroke ?? '',
        titleFill: titleStyle?.fill ?? titleStyle?.color ?? '',
        titleFontSize: titleStyle?.fontSize ?? ''
      };
    });

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      throw new Error(`packed browser smoke emitted errors: ${[...consoleErrors, ...pageErrors].join('\\n')}`);
    }

    if (evidence.smoke?.annotations !== 1 || !evidence.text.includes('Packed browser')) {
      throw new Error(`packed browser smoke did not render package output: ${JSON.stringify(evidence)}`);
    }

    if (!evidence.noteBox?.width || !evidence.noteBox?.height || !evidence.connectorBox?.width) {
      throw new Error(`packed browser smoke rendered empty geometry: ${JSON.stringify(evidence)}`);
    }

    if (!visibleColor(evidence.noteBackground)
      || !visibleColor(evidence.noteStroke)
      || !visibleColor(evidence.connectorStroke)
      || !visibleColor(evidence.subjectStroke)
      || !visibleColor(evidence.titleFill)
      || Number.parseFloat(evidence.connectorStrokeWidth || '0') <= 0
      || Number.parseFloat(evidence.titleFontSize || '0') <= 0) {
      throw new Error(`packed browser smoke did not apply package CSS: ${JSON.stringify(evidence)}`);
    }

    await mkdir(packedScreenshotsDir, { recursive: true });
    await page.screenshot({
      path: join(packedScreenshotsDir, 'packed-browser.png'),
      fullPage: true
    });
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
}

async function smokeBrowserAdapters(tarball) {
  const workdir = await consumerWorkdir();
  await install(workdir, [
    tarball,
    'vega@^6.2.0',
    'mermaid@^11.15.0',
    '@terrastruct/d2@^0.1.33',
    'react@^19.1.0',
    'react-dom@^19.1.0',
    '@xyflow/react@^12.11.0'
  ]);
  await mkdir(join(workdir, 'src'), { recursive: true });
  await writeFile(join(workdir, 'index.html'), `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Packed adapter browser smoke</title>
      </head>
      <body>
        <main id="app">
          <section id="packed-vega" class="consumer-surface" aria-label="Packed Vega adapter smoke">
            <div class="host"></div>
            <div class="annotation-host"></div>
          </section>
          <section id="packed-mermaid" class="consumer-surface" aria-label="Packed Mermaid adapter smoke">
            <div class="host"></div>
            <div class="annotation-host"></div>
          </section>
          <section id="packed-d2" class="consumer-surface" aria-label="Packed D2 adapter smoke">
            <div class="host"></div>
            <div class="annotation-host"></div>
          </section>
          <section id="packed-dom-report" class="consumer-surface" aria-label="Packed DOM report smoke">
            <div class="host">
              <article class="report-panel">
                <h2>Consumer report</h2>
                <p class="report-copy">A packed clean-consumer report surface with DOM-measured annotation anchors.</p>
                <div class="target-card">Primary signal</div>
                <svg class="legacy-report" viewBox="0 0 180 100" aria-hidden="true" focusable="false">
                  <g class="ui-annotation ui-annotation--badge ui-annotation--info ui-annotation--draw" transform="translate(32 36)">
                    <path class="ui-annotation__badge-pointer" d="M0,0L14,0L0,-14Z" />
                    <circle class="ui-annotation__badge" cx="14" cy="-14" r="11" />
                    <text class="ui-annotation__title" x="14" y="-14" text-anchor="middle" dominant-baseline="central">R</text>
                  </g>
                  <g class="ui-annotation ui-annotation--callout ui-annotation--accent" transform="translate(42 72)">
                    <path class="ui-annotation__subject" d="M-10,-6H10V6H-10Z" />
                    <path class="ui-annotation__connector" d="M10,-2L72,-30" />
                    <path class="ui-annotation__connector-end" d="M72,-30L62,-34L65,-23Z" />
                    <g class="ui-annotation__note" transform="translate(78 -34)">
                      <rect width="82" height="34" rx="4" />
                      <text class="ui-annotation__title" x="10" y="15">Legacy</text>
                      <text class="ui-annotation__label" x="10" y="30">static SVG</text>
                    </g>
                  </g>
                </svg>
              </article>
            </div>
            <div class="annotation-host"></div>
          </section>
          <section id="packed-react-flow" class="consumer-surface" aria-label="Packed React Flow adapter smoke">
            <div id="flow-root"></div>
          </section>
        </main>
        <script type="module" src="/src/main.jsx"></script>
      </body>
    </html>
  `);
  await writeFile(join(workdir, 'src/styles.css'), `
    body {
      background: #f6f8fb;
      color: #111827;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      margin: 0;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    #app {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(280px, 1fr));
      padding: 16px;
    }

    .consumer-surface {
      background: #ffffff;
      border: 1px solid #d5deea;
      border-radius: 8px;
      height: 280px;
      overflow: hidden;
      position: relative;
    }

    .host,
    .annotation-host,
    .host > svg,
    .pa-annotation-layer,
    #flow-root,
    .flow-frame,
    .react-flow {
      height: 100%;
      inset: 0;
      position: absolute;
      width: 100%;
    }

    .host > svg {
      max-width: none;
    }

    .react-flow {
      background: #f8fafc;
    }

    .react-flow__node-default {
      align-items: center;
      background: #ffffff;
      border: 1px solid #94a3b8;
      border-radius: 8px;
      color: #334155;
      display: flex;
      font: 700 14px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
      height: 58px;
      justify-content: center;
      width: 142px;
    }

    .report-panel {
      inset: 18px;
      position: absolute;
    }

    .report-panel h2 {
      font-size: 16px;
      margin: 0 0 6px;
    }

    .report-copy {
      color: #64748b;
      font-size: 12px;
      margin: 0;
      max-width: 220px;
    }

    .target-card {
      align-items: center;
      background: #f8fafc;
      border: 1px solid #94a3b8;
      border-radius: 8px;
      color: #0f172a;
      display: flex;
      font-size: 13px;
      font-weight: 700;
      height: 58px;
      justify-content: center;
      left: 42px;
      position: absolute;
      top: 96px;
      width: 132px;
    }

    .legacy-report {
      height: 104px;
      overflow: visible;
      position: absolute;
      right: 18px;
      top: 42px;
      width: 188px;
    }

    @media (max-width: 720px) {
      #app {
        grid-template-columns: 1fr;
      }
    }
  `);
  await writeFile(join(workdir, 'src/main.jsx'), `
    import {
      generatedSurfaceLayoutDefaults,
      renderAnnotationsSvg,
      resolveAnnotationLayout
    } from '@ponchia/annotations';
    import { AnnotationLayer } from '@ponchia/annotations/react';
    import { prepareVegaScenegraphAnnotations } from '@ponchia/annotations/vega';
    import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';
    import { prepareD2DiagramAnnotations } from '@ponchia/annotations/d2';
    import { prepareDomAnnotations } from '@ponchia/annotations/dom';
    import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';
    import '@ponchia/annotations/bronto.css';
    import * as vega from 'vega';
    import mermaid from 'mermaid';
    import { D2 } from '@terrastruct/d2';
    import React, { useEffect, useMemo, useRef, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import {
      Background,
      ReactFlow,
      useEdges,
      useNodes,
      useViewport
    } from '@xyflow/react';
    import '@xyflow/react/dist/style.css';
    import './styles.css';

    window.__packedAdapterSmoke = {
      vega: false,
      mermaid: false,
      d2: false,
      domReport: false,
      reactFlow: false
    };

    function setReady(name, value = true) {
      window.__packedAdapterSmoke[name] = value;
    }

    async function renderVega() {
      const surface = document.querySelector('#packed-vega');
      const host = surface.querySelector('.host');
      const layer = surface.querySelector('.annotation-host');
      const spec = {
        $schema: 'https://vega.github.io/schema/vega/v6.json',
        width: 300,
        height: 150,
        padding: 36,
        data: [
          {
            name: 'table',
            values: [
              { id: 'start', x: 1, y: 2 },
              { id: 'peak', x: 2, y: 8 },
              { id: 'done', x: 3, y: 5 }
            ]
          }
        ],
        scales: [
          { name: 'x', type: 'point', domain: { data: 'table', field: 'x' }, range: 'width' },
          { name: 'y', type: 'linear', domain: { data: 'table', field: 'y' }, nice: true, range: 'height' }
        ],
        axes: [
          { orient: 'bottom', scale: 'x' },
          { orient: 'left', scale: 'y' }
        ],
        marks: [
          {
            name: 'points',
            type: 'symbol',
            from: { data: 'table' },
            encode: {
              enter: {
                x: { scale: 'x', field: 'x' },
                y: { scale: 'y', field: 'y' },
                size: { value: 160 },
                fill: { value: '#0f766e' },
                aria: { value: true },
                description: { signal: '"point-" + datum.id' }
              }
            }
          }
        ]
      };
      const view = new vega.View(vega.parse(spec), { renderer: 'none' });
      await view.runAsync();
      host.innerHTML = await view.toSVG();

      const svg = host.querySelector('svg');
      const viewBox = svg.viewBox.baseVal;
      const prepared = prepareVegaScenegraphAnnotations(view, [{
        id: 'vega-peak',
        markName: 'points',
        markType: 'symbol',
        datum: (datum) => datum?.id === 'peak',
        note: { title: 'Packed Vega mark' },
        placement: { side: 'right' },
        subject: { shape: 'circle', padding: 3 }
      }], {
        obstacles: false
      });
      const layout = resolveAnnotationLayout({
        annotations: prepared.annotations,
        bounds: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
        padding: 10,
        noteSizes: { 'vega-peak': { width: 150, height: 54 } }
      });
      layer.innerHTML = renderAnnotationsSvg(layout, {
        title: 'Packed Vega adapter annotations',
        preserveAspectRatio: svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet'
      });
      setReady('vega', {
        ok: prepared.validation.ok,
        source: prepared.annotations[0]?.data?.anchorSource,
        markName: prepared.annotations[0]?.data?.vegaMarkName
      });
    }

    async function renderMermaid() {
      const surface = document.querySelector('#packed-mermaid');
      const host = surface.querySelector('.host');
      const layer = surface.querySelector('.annotation-host');
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' });
      const result = await mermaid.render('packed-mermaid-diagram', 'flowchart LR\\n  Intake[Intake] --> API[API]\\n  API --> Report[Report]');
      host.innerHTML = result.svg;

      const svg = host.querySelector('svg');
      const viewBox = svg.viewBox.baseVal;
      const bounds = {
        x: viewBox.x - 80,
        y: viewBox.y - 48,
        width: viewBox.width + 160,
        height: viewBox.height + 96
      };
      const prepared = prepareMermaidAnnotations(svg, [{
        id: 'mermaid-api',
        label: 'API',
        coordinateSpace: svg,
        note: { title: 'Packed Mermaid node' },
        placement: { side: 'top' },
        subject: { shape: 'rect', padding: 4 }
      }], {
        obstacles: false
      });
      svg.setAttribute('viewBox', \`\${bounds.x} \${bounds.y} \${bounds.width} \${bounds.height}\`);
      const layout = resolveAnnotationLayout({
        annotations: prepared.annotations,
        bounds,
        padding: 10,
        noteSizes: { 'mermaid-api': { width: 156, height: 54 } }
      });
      layer.innerHTML = renderAnnotationsSvg(layout, {
        title: 'Packed Mermaid adapter annotations',
        preserveAspectRatio: svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet'
      });
      setReady('mermaid', {
        ok: prepared.validation.ok,
        source: prepared.annotations[0]?.data?.anchorSource,
        label: prepared.annotations[0]?.data?.mermaidLabel
      });
    }

    async function renderD2() {
      const surface = document.querySelector('#packed-d2');
      const host = surface.querySelector('.host');
      const layer = surface.querySelector('.annotation-host');
      const d2 = new D2();
      const result = await d2.compile('input: Input\\nprocess: Process\\noutput: Output\\ninput -> process -> output', { layout: 'dagre' });
      host.innerHTML = await d2.render(result.diagram, {
        ...result.renderOptions,
        noXMLTag: true,
        pad: 0,
        scale: 1
      });

      const svg = host.querySelector('svg');
      const viewBox = svg.viewBox.baseVal;
      const bounds = {
        x: viewBox.x - 56,
        y: viewBox.y - 24,
        width: viewBox.width + 240,
        height: viewBox.height + 48
      };
      const prepared = prepareD2DiagramAnnotations(result.diagram, [{
        id: 'd2-process',
        shapeId: 'process',
        note: { title: 'Packed D2 shape' },
        placement: { side: 'right' },
        subject: { shape: 'rect', padding: 3 }
      }], {
        obstacles: false
      });
      svg.setAttribute('viewBox', \`\${bounds.x} \${bounds.y} \${bounds.width} \${bounds.height}\`);
      const layout = resolveAnnotationLayout({
        annotations: prepared.annotations,
        bounds,
        padding: 10,
        noteSizes: { 'd2-process': { width: 148, height: 54 } }
      });
      layer.innerHTML = renderAnnotationsSvg(layout, {
        title: 'Packed D2 adapter annotations',
        preserveAspectRatio: svg.getAttribute('preserveAspectRatio') ?? 'xMinYMin meet'
      });
      setReady('d2', {
        ok: prepared.validation.ok,
        source: prepared.annotations[0]?.data?.anchorSource,
        shapeId: prepared.annotations[0]?.data?.d2ShapeId
      });
    }

    function renderDomReport() {
      const surface = document.querySelector('#packed-dom-report');
      const layer = surface.querySelector('.annotation-host');
      const rect = surface.getBoundingClientRect();
      const prepared = prepareDomAnnotations(surface, [{
        id: 'dom-target',
        selector: '.target-card',
        coordinateSpace: surface,
        note: { title: 'Packed DOM report' },
        placement: { side: 'right' },
        subject: { shape: 'rect', padding: 4 }
      }], {
        obstacles: [{
          selector: '.legacy-report',
          coordinateSpace: surface,
          inflate: 2
        }]
      });
      const layout = resolveAnnotationLayout({
        annotations: prepared.annotations,
        bounds: { x: 0, y: 0, width: rect.width, height: rect.height },
        obstacles: prepared.obstacles,
        padding: 10,
        noteSizes: { 'dom-target': { width: 156, height: 54 } }
      });
      layer.innerHTML = renderAnnotationsSvg(layout, {
        title: 'Packed DOM report annotations',
        preserveAspectRatio: 'none'
      });
      setReady('domReport', {
        ok: prepared.validation.ok,
        source: prepared.annotations[0]?.data?.anchorSource,
        selector: prepared.annotations[0]?.data?.domSelector,
        obstacles: prepared.obstacles.length
      });
    }

    const flowNodes = [
      { id: 'ingest', position: { x: 80, y: 120 }, width: 142, height: 58, data: { label: 'Ingest' } },
      { id: 'review', position: { x: 292, y: 120 }, width: 142, height: 58, data: { label: 'Review' } },
      { id: 'publish', position: { x: 504, y: 120 }, width: 142, height: 58, data: { label: 'Publish' } }
    ];
    const flowEdges = [
      { id: 'ingest-review', source: 'ingest', target: 'review' },
      { id: 'review-publish', source: 'review', target: 'publish' }
    ];
    const packedFlowDefaults = generatedSurfaceLayoutDefaults({
      anchorLabel: 'Packed React Flow anchors',
      failOnWarnings: true,
      layoutLabel: 'Packed React Flow annotations'
    });

    function FlowAnnotations({ bounds }) {
      const nodes = useNodes();
      const edges = useEdges();
      const viewport = useViewport();
      const hasMeasuredNodes = nodes.some((node) => node.id === 'review'
        && ((node.measured?.width ?? node.width ?? 0) > 0)
        && ((node.measured?.height ?? node.height ?? 0) > 0));
      const prepared = useMemo(() => hasMeasuredNodes
        ? prepareReactFlowAnnotations({
          nodes,
          edges,
          viewport
        }, [{
          id: 'flow-review',
          nodeId: 'review',
          note: { title: 'Packed React Flow node' },
          placement: { side: 'top' },
          subject: { shape: 'rect', padding: 4 }
        }], {
          assert: packedFlowDefaults.assertValidation,
          obstacles: false
        })
        : undefined, [edges, hasMeasuredNodes, nodes, viewport]);
      const annotations = prepared?.annotations ?? [];

      if (!bounds.measured || annotations.length === 0) {
        return null;
      }

      return (
        <AnnotationLayer
          annotations={annotations}
          assertQuality={packedFlowDefaults.assertQuality}
          bounds={bounds.box}
          padding={10}
          noteSizes={{ 'flow-review': { width: 180, height: 54 } }}
          qualityFormat={packedFlowDefaults.qualityFormat}
          onQuality={({ quality, summary }) => {
            window.requestAnimationFrame(() => {
              setReady('reactFlow', {
                ok: prepared?.validation.ok,
                quality: quality.ok,
                summary,
                source: annotations[0]?.data?.anchorSource,
                nodeId: annotations[0]?.data?.reactFlowNodeId
              });
            });
          }}
          style={{ inset: 0, position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}
        />
      );
    }

    function FlowApp() {
      const frameRef = useRef(null);
      const bounds = useElementBounds(frameRef);

      return (
        <div ref={frameRef} className="flow-frame">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            nodesDraggable={false}
            nodesConnectable={false}
            panOnDrag={false}
            zoomOnDoubleClick={false}
            zoomOnPinch={false}
            zoomOnScroll={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <FlowAnnotations bounds={bounds} />
          </ReactFlow>
        </div>
      );
    }

    function useElementBounds(ref) {
      const [bounds, setBounds] = useState({
        box: { x: 0, y: 0, width: 0, height: 0 },
        measured: false
      });

      useEffect(() => {
        const element = ref.current;

        if (!element) {
          return undefined;
        }

        const update = () => {
          const rect = element.getBoundingClientRect();

          setBounds({
            box: { x: 0, y: 0, width: rect.width, height: rect.height },
            measured: rect.width > 0 && rect.height > 0
          });
        };

        update();

        if (typeof ResizeObserver === 'undefined') {
          window.addEventListener('resize', update);
          return () => window.removeEventListener('resize', update);
        }

        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
      }, [ref]);

      return bounds;
    }

    await Promise.all([renderVega(), renderMermaid(), renderD2()]);
    renderDomReport();
    createRoot(document.querySelector('#flow-root')).render(<FlowApp />);
  `);

  const server = await createServer({
    root: workdir,
    configFile: false,
    logLevel: 'error',
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false
    }
  });

  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') {
    await server.close();
    throw new Error('packed adapter browser smoke could not determine Vite port');
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 920, height: 760 } });
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const smoke = window.__packedAdapterSmoke;

      return smoke?.vega?.ok
        && smoke?.mermaid?.ok
        && smoke?.d2?.ok
        && smoke?.domReport?.ok
        && smoke?.reactFlow?.ok
        && smoke?.reactFlow?.quality
        && document.querySelectorAll('.pa-annotation').length >= 5;
    }, null, { timeout: 45000 });

    const evidence = await page.evaluate(() => {
      const checks = [
        {
          name: 'vega',
          annotationId: 'vega-peak',
          targetSelector: '#packed-vega .host svg path[aria-label="point-peak"]',
          maxCenterDistance: 12
        },
        {
          name: 'mermaid',
          annotationId: 'mermaid-api',
          targetSelector: '#packed-mermaid .host svg g.node',
          text: 'API',
          maxCenterDistance: 12
        },
        {
          name: 'd2',
          annotationId: 'd2-process',
          targetSelector: '#packed-d2 .host svg g',
          text: 'Process',
          maxCenterDistance: 12
        },
        {
          name: 'domReport',
          annotationId: 'dom-target',
          targetSelector: '#packed-dom-report .target-card',
          maxCenterDistance: 12
        },
        {
          name: 'reactFlow',
          annotationId: 'flow-review',
          targetSelector: '#packed-react-flow .react-flow__node[data-id="review"]',
          maxCenterDistance: 12
        }
      ].map((check) => {
        const annotation = document.querySelector(`.pa-annotation[data-annotation-id="${cssStringEscape(check.annotationId)}"]`);
        const subject = annotation?.querySelector('.pa-annotation__subject');
        const target = findTarget(check.targetSelector, check.text);
        const subjectBox = subject ? clientBox(subject) : undefined;
        const targetBox = target ? clientBox(target) : undefined;
        const centerDistance = subjectBox && targetBox
          ? distance(center(subjectBox), center(targetBox))
          : Number.POSITIVE_INFINITY;

        return {
          ...check,
          subjectFound: Boolean(subject),
          targetFound: Boolean(target),
          subjectBox,
          targetBox,
          centerDistance
        };
      });
      const noteBoxes = Array.from(document.querySelectorAll('.pa-annotation__note-box'))
        .map((note) => clientBox(note));
      const connectors = Array.from(document.querySelectorAll('.pa-annotation__connector'))
        .map((connector) => ({ ...clientBox(connector), d: connector.getAttribute('d') ?? '' }));
      const styledNote = document.querySelector('.pa-annotation__note-box');
      const styledConnector = document.querySelector('.pa-annotation__connector');
      const styledTitle = document.querySelector('.pa-annotation__title');
      const legacyTitle = document.querySelector('#packed-dom-report .legacy-report .ui-annotation__title');
      const legacyConnector = document.querySelector('#packed-dom-report .legacy-report .ui-annotation__connector');
      const legacyBadge = document.querySelector('#packed-dom-report .legacy-report .ui-annotation__badge');
      const legacyBadgePointer = document.querySelector('#packed-dom-report .legacy-report .ui-annotation__badge-pointer');
      const noteStyle = styledNote ? getComputedStyle(styledNote) : undefined;
      const connectorStyle = styledConnector ? getComputedStyle(styledConnector) : undefined;
      const titleStyle = styledTitle ? getComputedStyle(styledTitle) : undefined;
      const legacyTitleStyle = legacyTitle ? getComputedStyle(legacyTitle) : undefined;
      const legacyConnectorStyle = legacyConnector ? getComputedStyle(legacyConnector) : undefined;
      const legacyBadgeStyle = legacyBadge ? getComputedStyle(legacyBadge) : undefined;
      const legacyBadgePointerStyle = legacyBadgePointer ? getComputedStyle(legacyBadgePointer) : undefined;

      return {
        smoke: window.__packedAdapterSmoke,
        annotations: document.querySelectorAll('.pa-annotation').length,
        notes: noteBoxes,
        connectors,
        checks,
        style: {
          noteFill: noteStyle?.fill ?? noteStyle?.backgroundColor ?? '',
          noteStroke: noteStyle?.stroke ?? noteStyle?.borderColor ?? '',
          connectorStroke: connectorStyle?.stroke ?? '',
          connectorStrokeWidth: connectorStyle?.strokeWidth ?? '',
          titleFill: titleStyle?.fill ?? titleStyle?.color ?? '',
          titleFontSize: titleStyle?.fontSize ?? ''
        },
        legacy: {
          titleText: legacyTitle?.textContent ?? '',
          titleFill: legacyTitleStyle?.fill ?? '',
          titlePaintOrder: legacyTitleStyle?.paintOrder ?? '',
          connectorStroke: legacyConnectorStyle?.stroke ?? '',
          badgeFill: legacyBadgeStyle?.fill ?? '',
          badgePointerFill: legacyBadgePointerStyle?.fill ?? '',
          badgePointerStroke: legacyBadgePointerStyle?.stroke ?? ''
        }
      };

      function findTarget(selector, text) {
        const elements = Array.from(document.querySelectorAll(selector));

        if (!text) {
          return elements[0];
        }

        return elements.find((element) => normalizeText(element.textContent ?? '') === normalizeText(text));
      }

      function clientBox(element) {
        const rect = element.getBoundingClientRect();

        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      }

      function center(box) {
        return {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2
        };
      }

      function distance(point, other) {
        return Math.hypot(point.x - other.x, point.y - other.y);
      }

      function normalizeText(value) {
        return value.replace(/\\s+/g, ' ').trim();
      }

      function cssStringEscape(value) {
        return String(value).replace(/["\\\\]/g, '\\\\$&');
      }
    });

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      throw new Error(`packed adapter browser smoke emitted errors: ${[...consoleErrors, ...pageErrors].join('\\n')}`);
    }

    if (evidence.annotations < 5
      || evidence.notes.some((box) => box.width <= 0 || box.height <= 0)
      || evidence.connectors.some((box) => !box.d || (box.width <= 0 && box.height <= 0))) {
      throw new Error(`packed adapter browser smoke rendered empty annotation geometry: ${JSON.stringify(evidence)}`);
    }

    const misaligned = evidence.checks.filter((check) => !check.subjectFound
      || !check.targetFound
      || check.centerDistance > check.maxCenterDistance);
    if (misaligned.length > 0) {
      throw new Error(`packed adapter browser smoke did not align annotations to generated targets: ${JSON.stringify({
        misaligned,
        smoke: evidence.smoke
      })}`);
    }

    if (!visibleColor(evidence.style.noteFill)
      || !visibleColor(evidence.style.noteStroke)
      || !visibleColor(evidence.style.connectorStroke)
      || !visibleColor(evidence.style.titleFill)
      || Number.parseFloat(evidence.style.connectorStrokeWidth || '0') <= 0
      || Number.parseFloat(evidence.style.titleFontSize || '0') <= 0) {
      throw new Error(`packed adapter browser smoke did not apply package CSS: ${JSON.stringify(evidence.style)}`);
    }

    if (evidence.smoke?.domReport?.source !== 'dom'
      || evidence.smoke?.domReport?.selector !== '.target-card'
      || evidence.smoke?.domReport?.obstacles < 1
      || evidence.legacy.titleText !== 'R'
      || !evidence.legacy.titlePaintOrder.includes('stroke')
      || !visibleColor(evidence.legacy.connectorStroke)
      || !visibleColor(evidence.legacy.badgeFill)
      || !visibleColor(evidence.legacy.badgePointerFill)
      || !visibleColor(evidence.legacy.badgePointerStroke)) {
      throw new Error(`packed adapter browser smoke did not prove DOM/report or legacy Bronto styling: ${JSON.stringify({
        smoke: evidence.smoke,
        legacy: evidence.legacy
      })}`);
    }

    await mkdir(packedScreenshotsDir, { recursive: true });
    await page.screenshot({
      path: join(packedScreenshotsDir, 'packed-adapters.png'),
      fullPage: true
    });
    await page.close();
  } finally {
    await browser.close();
    await server.close();
  }
}

async function consumerWorkdir() {
  const parent = new URL('../.tmp/packed-consumers/', import.meta.url).pathname;

  await mkdir(parent, { recursive: true });

  const workdir = await mkdtemp(join(parent, 'consumer-'));
  workdirs.push(workdir);
  await writeFile(join(workdir, 'package.json'), JSON.stringify({
    type: 'module',
    private: true
  }, null, 2));
  return workdir;
}

function visibleColor(value) {
  if (!value || value === 'none' || value === 'transparent') {
    return false;
  }

  return !/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(value);
}

async function install(workdir, packages) {
  await exec('npm', ['install', ...packages, '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: workdir,
    maxBuffer: 1024 * 1024
  });
}

async function assertOptionalPeersAbsent(workdir) {
  const optionalPeerPackages = [
    '@terrastruct/d2',
    '@xyflow/react',
    'mermaid',
    'react',
    'react-dom',
    'vega'
  ];
  const installed = [];

  for (const packageName of optionalPeerPackages) {
    try {
      await access(join(workdir, 'node_modules', packageName));
      installed.push(packageName);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }

      throw error;
    }
  }

  if (installed.length > 0) {
    throw new Error(`clean root consumer unexpectedly installed optional peers: ${installed.join(', ')}`);
  }
}
