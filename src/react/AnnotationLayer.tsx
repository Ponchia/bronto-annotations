import { PaintedAnnotation, PaintedEditHandle, MeasuredAnnotation } from './annotation-presentation.js';
import { renderQualityIssues } from './quality-overlay.js';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  memo,
  useMemo,
  useRef,
  useState
} from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import {
  annotationEditHandles,
  createAnnotationEditDelta,
  createAnnotationEditEvent,
  previewAnnotationEdit
} from '../core/edit.js';
import { estimateNoteSize, resolveAnnotationLayout } from '../core/layout-resolver.js';
import { annotationsForPaint } from '../core/order.js';
import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport
} from '../core/quality.js';
import {
  assertAnchorAlignmentReportIfRequested,
  evaluateAnchorAlignment,
  formatAnchorAlignmentReport
} from '../adapters/diagnostics.js';
import { useMeasurementNodeRegistration, useDomNoteMeasurementObserver } from './dom-measurements.js';
import { useEditableSvgTouchBoundary } from './touch-gestures.js';
import {
  useAnnotationPreviewScheduler,
  usePreviewLayoutInvalidation
} from './preview-scheduler.js';
import { MemoMarkerDefs } from './marker-defs.js';
import {
  groupEditHandles,
  normalizeEditOptions,
  keyboardDelta,
  clientToSvgPoint
} from './edit-geometry.js';
import type { AnnotationEditHandle } from '../core/edit.js';
import type {
  ResolvedAnnotation,
  ResolvedLayout,
  Size
} from '../core/model.js';
import type {
  AnnotationLayerEditEvent,
  AnnotationLayerEditOptions,
  AnnotationLayerProps
} from './types.js';

const PREFIX = 'pa-annotation';
const EMPTY_NOTE_SIZES: Record<string, Size> = Object.freeze({});
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type ActiveEdit = {
  annotation: ResolvedAnnotation;
  // Capture the committed layout that authorized this gesture. A later host
  // replacement must not allow pointerup to persist placement on stale data.
  layoutAtStart: ResolvedLayout;
  handle: AnnotationEditHandle;
  origin: { x: number; y: number };
  pointerId: number;
};

/** Public React adapter. The memo boundary is deliberately internal: it does
 * not alter this component's callable type or the existing default renderer.
 */
export function AnnotationLayer(props: AnnotationLayerProps) {
  assertLayerMode(props);
  return <MemoizedAnnotationLayer {...props} />;
}

// Geometry and presentation come from one source, so normal React identity
// comparison is sufficient. Per-note and edit-handle memoization below retains
// unchanged winners across incremental commits and inline presentation props.
const MemoizedAnnotationLayer = memo(AnnotationLayerRenderer);

function assertLayerMode(props: AnnotationLayerProps): void {
  if ('resolvedLayout' in props) {
    throw new Error('AnnotationLayer.resolvedLayout was removed; use layout without annotations, bounds or other solver inputs.');
  }
  if ('layout' in props) {
    if (!props.layout) throw new Error('AnnotationLayer.layout must be a resolved layout.');
    for (const key of [
      'annotations', 'bounds', 'padding', 'obstacles', 'placement',
      'defaultNoteSize', 'noteSizes', 'refinement', 'diagnostics', 'measure'
    ]) {
      if (key in props) {
        throw new Error(`AnnotationLayer.layout cannot be combined with ${key}; pass solver inputs to resolveAnnotationLayout instead.`);
      }
    }
  } else if (!props.annotations || !props.bounds) {
    throw new Error('AnnotationLayer requires either layout, or annotations and bounds.');
  }
}

function AnnotationLayerRenderer(props: AnnotationLayerProps) {
  const {
    annotations: inputAnnotations,
    assertQuality,
    assertTargetAlignment,
    bounds: inputBounds,
    padding,
    obstacles,
    placement,
    defaultNoteSize,
    noteSizes,
    className,
    classPrefix = PREFIX,
    debug = false,
    editable,
    previewEdits = false,
    layout: hostLayout,
    label = 'Annotation layer',
    measure = 'estimate',
    markerIdPrefix,
    editHandleTabIndex = 0,
    noteTabIndex,
    preserveAspectRatio,
    qualityDebug = false,
    refinement,
    diagnostics,
    renderNote,
    onEdit,
    onEditEnd,
    onEditStart,
    onLayout,
    onQuality,
    onTargetAlignment,
    qualityFormat,
    targetAlignmentFormat,
    targetAlignmentOptions,
    targetAlignmentTargets,
    style
  } = props;
  const annotations = useMemo(
    () => hostLayout ? hostLayout.annotations.map((item) => item.annotation) : inputAnnotations!,
    [hostLayout, inputAnnotations]
  );
  const bounds = hostLayout ? hostLayout.bounds : inputBounds!;
  const prefix = classPrefix;
  const markerPrefix = markerIdPrefix ?? prefix;
  const svgRef = useRef<SVGSVGElement>(null);
  const measureNodes = useRef(new Map<string, HTMLDivElement>());
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  // A stable SVG edit-handle callback must see the current pointer even
  // before React commits the pointerdown state update. Reading this ref also
  // avoids forcing every memoized handle to rerender on each gesture change.
  const activeGestureRef = useRef<ActiveEdit | null>(null);
  const {
    activePreview, setActivePreview, cancelQueuedPreview, schedulePreview
  } = useAnnotationPreviewScheduler();
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, Size>>({});
  // A host-controlled resolved layout already owns the final note sizes.
  // Estimating every note again is wasted O(n) work on each incremental
  // commit, and merging an unused size map can invalidate other memoization.
  // Keep both hooks unconditional so switching back to local layout resolution
  // still computes the correct sizes without changing React hook order.
  const hasHostLayout = hostLayout !== undefined;
  const estimatedSizes = useMemo(
    () => hasHostLayout ? EMPTY_NOTE_SIZES : Object.fromEntries(annotations.map((annotation) => [
      annotation.id,
      estimateNoteSize(annotation, defaultNoteSize)
    ])),
    [annotations, defaultNoteSize, hasHostLayout]
  );
  const resolvedNoteSizes = useMemo(
    () => hasHostLayout ? EMPTY_NOTE_SIZES : ({
      ...estimatedSizes,
      ...(noteSizes ?? {}),
      ...(measure === 'dom' ? measuredSizes : {})
    }),
    [estimatedSizes, noteSizes, measure, measuredSizes, hasHostLayout]
  );
  const layout = useMemo(() => {
    // A host with an incremental session can supply its committed result.
    // Computing it again here would undo the optimization. All subsequent
    // quality, editing and SVG rendering use this same authoritative object.
    if (hostLayout !== undefined) return hostLayout;

    return resolveAnnotationLayout({
      annotations,
      bounds,
      noteSizes: resolvedNoteSizes,
      ...(padding !== undefined ? { padding } : {}),
      ...(obstacles ? { obstacles } : {}),
      ...(placement ? { placement } : {}),
      ...(defaultNoteSize ? { defaultNoteSize } : {}),
      ...(refinement !== undefined ? { refinement } : {}),
      ...(diagnostics !== undefined ? { diagnostics } : debug ? { diagnostics: { candidates: 8 } } : {})
    });
  }, [
    annotations, bounds, padding, obstacles, placement, defaultNoteSize,
    refinement, diagnostics, debug, resolvedNoteSizes, hostLayout
  ]);
  // Full quality diagnostics compare every note with every other note. Most
  // passive and host-controlled renderers do not request them. Avoid quadratic
  // work on each committed edit unless a consumer needs a report, a quality
  // assertion, or the visual debug overlay.
  const needsQuality = Boolean(assertQuality || onQuality || qualityDebug);
  const quality = useMemo(
    () => needsQuality ? evaluateAnnotationLayout(layout) : undefined,
    [layout, needsQuality]
  );
  const qualitySummary = useMemo(
    () => onQuality && quality ? formatLayoutQualityReport(quality, qualityFormat) : undefined,
    [quality, qualityFormat, onQuality]
  );
  const targetAlignment = useMemo(
    () => targetAlignmentTargets?.length
      ? evaluateAnchorAlignment(annotations, targetAlignmentTargets, targetAlignmentOptions)
      : undefined,
    [annotations, targetAlignmentOptions, targetAlignmentTargets]
  );
  const targetAlignmentSummary = useMemo(
    () => targetAlignment
      ? formatAnchorAlignmentReport(targetAlignment, targetAlignmentFormat)
      : undefined,
    [targetAlignment, targetAlignmentFormat]
  );

  // Independent host notifications: enabling debug overlays or reformatting
  // the same quality evidence should never signal a changed layout. Likewise,
  // host-only onLayout consumers do not subscribe to unrelated diagnostic
  // toggles. Keep assertion and callback order consistent with prior behavior.
  useIsomorphicLayoutEffect(() => {
    if (assertQuality && quality) {
      assertAnnotationLayoutQuality(
        quality,
        assertQuality === true ? {} : assertQuality
      );
    }
  }, [assertQuality, quality]);

  useIsomorphicLayoutEffect(() => {
    if (assertTargetAlignment && !targetAlignment) {
      throw new Error('targetAlignmentTargets are required when assertTargetAlignment is set.');
    }

    if (targetAlignment) {
      assertAnchorAlignmentReportIfRequested(targetAlignment, assertTargetAlignment);
      onTargetAlignment?.({
        layout,
        targetAlignment,
        summary: targetAlignmentSummary!
      });
    }
  }, [assertTargetAlignment, layout, onTargetAlignment, targetAlignment, targetAlignmentSummary]);

  useIsomorphicLayoutEffect(() => {
    if (onQuality && quality && qualitySummary !== undefined) {
      onQuality({ layout, quality, summary: qualitySummary });
    }
  }, [layout, onQuality, quality, qualitySummary]);

  useIsomorphicLayoutEffect(() => {
    onLayout?.(layout);
  }, [layout, onLayout]);

  // A host commonly supplies editable={{ includeAnchor: true }} inline.
  // Comparing the wrapper object's identity would regenerate every edit
  // handle (and rerender its SVG controls) on otherwise identical commits.
  // Depend on the actual supported scalar options instead, preserving the
  // previous handle objects when both geometry and edit semantics are stable.
  const editOptions = useMemo(() => {
    const normalized = normalizeEditOptions(editable);
    // Snapshot value-based options instead of holding on to a host object
    // that may be mutated between committed React renders.
    return normalized ? { ...normalized } : undefined;
  }, [
    Boolean(editable),
    typeof editable === 'object' ? editable.includeNote : undefined,
    typeof editable === 'object' ? editable.includeAnchor : undefined,
    typeof editable === 'object' ? editable.noteHandlePosition : undefined,
    typeof editable === 'object' ? editable.radius : undefined,
    typeof editable === 'object' ? editable.hitRadius : undefined,
    typeof editable === 'object' ? editable.keyboardStep : undefined,
    typeof editable === 'object' ? editable.keyboardLargeStep : undefined
  ]);
  // Incremental committed layouts retain exact ResolvedAnnotation identities
  // for unaffected winners. Preserve their previously committed handle objects
  // as well, so the memoized SVG controls do not rebuild 2×N elements for a
  // change that affects only the last note. The cache is updated after commit,
  // never during a speculative/concurrent React render.
  const handleCache = useRef<{
    annotations: ResolvedAnnotation[];
    options: AnnotationLayerEditOptions;
    grouped: Map<string, AnnotationEditHandle[]>;
  } | null>(null);
  const editHandles = useMemo(() => {
    if (!editOptions) return [];
    const previous = handleCache.current;
    if (!previous || previous.options !== editOptions) {
      return annotationEditHandles(layout, editOptions);
    }

    // A committed incremental layout often changes just one of hundreds of
    // annotations. Recreating 2×N handle objects for every edit and throwing
    // almost all of them away wastes scripting work, despite React memoization
    // correctly preserving their DOM. Generate geometry *only* for changed
    // annotations, then interleave retained and newly computed handles in
    // priority paint order. Keep all cache writes in the commit effect below.
    const previouslyResolved = new Map(previous.annotations.map((item) => [item.id, item]));
    const changed = layout.annotations.filter((item) => previouslyResolved.get(item.id) !== item);
    const changedHandles = changed.length > 0
      ? annotationEditHandles({ ...layout, annotations: changed }, editOptions)
      : [];
    const refreshed = groupEditHandles(changedHandles);
    return annotationsForPaint(layout.annotations).flatMap((item) =>
      (previouslyResolved.get(item.id) === item ? previous.grouped : refreshed).get(item.id) ?? []
    );
  }, [layout, editOptions]);
  useIsomorphicLayoutEffect(() => {
    handleCache.current = editOptions
      ? { annotations: layout.annotations, options: editOptions, grouped: groupEditHandles(editHandles) }
      : null;
  }, [layout.annotations, editOptions, editHandles]);
  const paintAnnotations = useMemo(
    () => annotationsForPaint(layout.annotations),
    [layout.annotations]
  );
  const debugCandidates = useMemo(
    () => debug ? new Map(layout.diagnostics?.annotations.map((item) => [item.id, item.candidates])) : undefined,
    [debug, layout.diagnostics]
  );
  const qualityIssues = useMemo(
    () => qualityDebug && quality ? renderQualityIssues(layout, quality, prefix) : null,
    [layout, quality, prefix, qualityDebug]
  );
  const displayedAnnotations = useMemo(() => activePreview
    ? paintAnnotations.map((item) => item.id === activePreview.id ? activePreview : item)
    : paintAnnotations, [activePreview, paintAnnotations]);
  const displayedEditHandles = useMemo(() => {
    if (!activePreview || !editOptions) {
      return editHandles;
    }
    // Compute only the edited annotation's handle geometry, not the layout or
    // handles for its untouched neighbors.
    const updated = annotationEditHandles({ ...layout, annotations: [activePreview] }, editOptions);
    const byId = new Map(updated.map((handle) => [handle.id, handle]));
    return editHandles.map((handle) => byId.get(handle.id) ?? handle);
  }, [activePreview, editHandles, editOptions, layout]);
  // Static SVG may behave as one image. Expose focusable notes, edit handles,
  // and custom rendered note content as a labeled accessibility group.
  const layerRole = Number.isFinite(noteTabIndex) || editHandles.length > 0 || renderNote
    ? 'group'
    : 'img';
  // Native mobile scroll fallback only while editing is enabled; it never
  // suppresses touches on the surrounding stage or ordinary note content.
  useEditableSvgTouchBoundary(svgRef, Boolean(editOptions));

  const makeEditEvent = useCallback((
    active: ActiveEdit,
    phase: AnnotationLayerEditEvent['phase'],
    point: { x: number; y: number }
  ): AnnotationLayerEditEvent => createAnnotationEditEvent({
    annotation: active.annotation,
    handle: active.handle,
    phase,
    origin: active.origin,
    point
  }), []);

  const clientPoint = useCallback((event: ReactPointerEvent<SVGElement>) => {
    return clientToSvgPoint(event, svgRef.current, bounds);
  }, [bounds]);

  // Edit-handle callbacks are stable across committed layout updates.
  // Read the latest *committed* host values through a layout-effect-updated ref,
  // so retained SVG controls never act on a stale annotation or handler.
  const editDispatch = useRef({
    layout, clientPoint, editOptions, onEdit, onEditStart, onEditEnd
  });
  useIsomorphicLayoutEffect(() => {
    editDispatch.current = { layout, clientPoint, editOptions, onEdit, onEditStart, onEditEnd };
  }, [layout, clientPoint, editOptions, onEdit, onEditStart, onEditEnd]);

  usePreviewLayoutInvalidation({
    layout, previewEdits, setActivePreview, cancelQueuedPreview
  });

  // The preview scheduler does not own authoritative host geometry or gesture
  // state. Cancel the in-flight gesture and any pending preview when these
  // inputs or the edit controls change. Disabling authoring must not let an
  // old animation frame paint, nor let a captured pointer commit on release.
  useIsomorphicLayoutEffect(() => {
    activeGestureRef.current = null;
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
  }, [layout, previewEdits, editOptions, cancelQueuedPreview, setActivePreview]);
  useIsomorphicLayoutEffect(() => {
    activeGestureRef.current = activeEdit;
  }, [activeEdit]);

  // Also validate at event-dispatch time: a pointer event racing a committed
  // host layout update must fail closed even before effects flush.
  const rejectStaleGesture = useCallback((active: ActiveEdit): boolean => {
    if (editDispatch.current.layout === active.layoutAtStart) return false;
    activeGestureRef.current = null;
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
    return true;
  }, [cancelQueuedPreview]);

  const handleEditPointerDown = useCallback((
    handle: AnnotationEditHandle,
    event: ReactPointerEvent<SVGCircleElement>
  ) => {
    const { layout: currentLayout, clientPoint: currentPoint, onEditStart: currentStart,
      onEdit: currentEdit } = editDispatch.current;
    const annotation = currentLayout.annotations.find((item) => item.id === handle.annotationId);

    if (!annotation) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const point = currentPoint(event);
    const active: ActiveEdit = {
      annotation,
      layoutAtStart: currentLayout,
      handle,
      origin: point,
      pointerId: event.pointerId
    };

    cancelQueuedPreview();
    activeGestureRef.current = active;
    setActiveEdit(active);
    setActivePreview(null);

    const editEvent = makeEditEvent(active, 'start', point);
    currentStart?.(editEvent);
    currentEdit?.(editEvent);
  }, [cancelQueuedPreview, makeEditEvent]);

  const handleEditPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    // Capture may be lost just before React commits the cancellation state.
    // The gesture ref is invalidated synchronously by the handle itself, so
    // subsequent move/up events cannot resurrect a queued preview or commit.
    if (!activeEdit || activeGestureRef.current !== activeEdit
      || event.pointerId !== activeEdit.pointerId || rejectStaleGesture(activeEdit)) {
      return;
    }

    event.preventDefault();
    const editEvent = makeEditEvent(activeEdit, 'move', clientPoint(event));
    if (previewEdits) {
      // Avoid capturing the pooled/synthetic pointer event in asynchronous
      // work: the edit suggestion is a plain data object made synchronously.
      schedulePreview(() => previewAnnotationEdit(activeEdit.annotation, editEvent, layout.placementBounds));
    }
    onEdit?.(editEvent);
  }, [activeEdit, clientPoint, layout.placementBounds, makeEditEvent, onEdit, previewEdits, schedulePreview, rejectStaleGesture]);

  const finishEdit = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    // Capture may be lost just before React commits the cancellation state.
    // The gesture ref is invalidated synchronously by the handle itself, so
    // subsequent move/up events cannot resurrect a queued preview or commit.
    if (!activeEdit || activeGestureRef.current !== activeEdit
      || event.pointerId !== activeEdit.pointerId || rejectStaleGesture(activeEdit)) {
      return;
    }

    event.preventDefault();
    const editEvent = makeEditEvent(activeEdit, 'end', clientPoint(event));
    activeGestureRef.current = null;
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
    onEditEnd?.(editEvent);
    onEdit?.(editEvent);
  }, [activeEdit, cancelQueuedPreview, clientPoint, makeEditEvent, onEdit, onEditEnd, rejectStaleGesture]);

  const cancelEdit = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeEdit || event.pointerId !== activeEdit.pointerId) {
      return;
    }
    // Cancellation must not persist an incomplete gesture in the host app.
    activeGestureRef.current = null;
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
  }, [activeEdit, cancelQueuedPreview]);

  // lostpointercapture originates on the captured circle. Do not rely on
  // bubbling to the outer SVG: attach a stable handler to each actual capture
  // target and read the most recently started pointer through a ref.
  const handleLostCapture = useCallback((event: ReactPointerEvent<SVGCircleElement>) => {
    const active = activeGestureRef.current;
    if (!active || event.pointerId !== active.pointerId) return;
    activeGestureRef.current = null;
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
  }, [cancelQueuedPreview]);

  const handleEditKeyDown = useCallback((
    handle: AnnotationEditHandle,
    event: ReactKeyboardEvent<SVGCircleElement>
  ) => {
    const { layout: currentLayout, editOptions: currentOptions,
      onEdit: currentEdit, onEditStart: currentStart, onEditEnd: currentEnd } = editDispatch.current;
    const delta = keyboardDelta(event, currentOptions);

    if (!delta) {
      return;
    }

    const annotation = currentLayout.annotations.find((item) => item.id === handle.annotationId);

    if (!annotation) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const active: ActiveEdit = {
      annotation,
      layoutAtStart: currentLayout,
      handle,
      origin: handle.point,
      pointerId: -1
    };
    const startEvent = makeEditEvent(active, 'start', handle.point);
    const endEvent = createAnnotationEditDelta({
      annotation,
      handle,
      delta,
      phase: 'end'
    });

    currentStart?.(startEvent);
    currentEdit?.(startEvent);
    currentEnd?.(endEvent);
    currentEdit?.(endEvent);
  }, [makeEditEvent]);

  const setMeasureNode = useMeasurementNodeRegistration(measureNodes);
  useDomNoteMeasurementObserver({
    annotations, measure, renderNote, measureNodes, setMeasuredSizes
  });

  return (
    <div
      className={[`${prefix}-layer-wrap`, className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        width: bounds.width,
        height: bounds.height,
        ...style
      }}
    >
      <svg
        ref={svgRef}
        className={`${prefix}-layer`}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        role={layerRole}
        aria-label={label}
        width={bounds.width}
        height={bounds.height}
        preserveAspectRatio={preserveAspectRatio}
        onPointerMove={handleEditPointerMove}
        onPointerUp={finishEdit}
        onPointerCancel={cancelEdit}
      >
        <MemoMarkerDefs annotations={layout.annotations} prefix={prefix} markerPrefix={markerPrefix} />
        {displayedAnnotations.map((item) => (
          <PaintedAnnotation
            key={item.id}
            item={item}
            prefix={prefix}
            markerPrefix={markerPrefix}
            debug={debug}
            candidates={debugCandidates?.get(item.id)}
            noteTabIndex={noteTabIndex}
            renderNote={renderNote}
          />
        ))}
        {qualityIssues}
        {displayedEditHandles.length > 0 ? (
          <g className={`${prefix}__edit-handles`}>
            {displayedEditHandles.map((handle) => (
              <PaintedEditHandle
                key={handle.id}
                handle={handle}
                prefix={prefix}
                tabIndex={editHandleTabIndex}
                onPointerDown={handleEditPointerDown}
                onKeyDown={handleEditKeyDown}
                onLostPointerCapture={handleLostCapture}
              />
            ))}
          </g>
        ) : null}
      </svg>
      {measure === 'dom' ? (
        <div className={`${prefix}-layer__measurer`} aria-hidden="true">
          {layout.annotations
            .filter((item) => item.annotation.note.visible !== false)
            .map((item) => (
              <MeasuredAnnotation
                key={item.id}
                item={item}
                prefix={prefix}
                renderNote={renderNote}
                setMeasureNode={setMeasureNode}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}
