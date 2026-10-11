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
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import {
  boxCenter,
  boxUnion,
  expandBox,
  normalizeBox,
  resolvePadding
} from '../core/anchors.js';
import {
  annotationEditHandles,
  createAnnotationEditDelta,
  createAnnotationEditEvent,
  previewAnnotationEdit
} from '../core/edit.js';
import { subjectPath } from '../core/annotation-geometry.js';
import { estimateNoteSize, resolveAnnotationLayout } from '../core/layout.js';
import { annotationsForPaint } from '../core/order.js';
import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  type LayoutQualityIssue,
  type LayoutQualityReport
} from '../core/quality.js';
import {
  assertAnchorAlignmentReportIfRequested,
  evaluateAnchorAlignment,
  formatAnchorAlignmentReport
} from '../adapters/diagnostics.js';
import { annotationStyleVariables } from '../core/style.js';
import { svgPointFromClient } from '../dom/index.js';
import type { AnnotationPartsSubject } from '../core/annotation-geometry.js';
import type { AnnotationEditHandle } from '../core/edit.js';
import type {
  Annotation,
  AnnotationBadgeOptions,
  AnnotationNoteLineOptions,
  AnnotationSubjectOptions,
  Box,
  Point,
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
  handle: AnnotationEditHandle;
  origin: { x: number; y: number };
  pointerId: number;
};

type BadgeGeometry = {
  center: Point;
  pointerD?: string;
};

/** Public React adapter. The memo boundary is deliberately internal: it does
 * not alter this component's callable type or the existing default renderer.
 */
export function AnnotationLayer(props: AnnotationLayerProps) {
  // Read *values* on controlled parent renders. A host may mutate a supported
  // edit option or style object in place; React's memo comparator otherwise
  // sees the same old/new reference and incorrectly skips the update. Avoid
  // snapshot overhead entirely for normal internally resolved React layers.
  const controlled = props.resolvedLayout !== undefined;
  return <MemoizedAnnotationLayer
    {...props}
    __editableSnapshot={controlled ? inlinePropsSnapshot(props.editable) : ''}
    __styleSnapshot={controlled ? inlinePropsSnapshot(props.style) : ''}
    __boundsSnapshot={controlled ? JSON.stringify([
      props.bounds.x, props.bounds.y, props.bounds.width, props.bounds.height
    ]) : ''}
    __idsSnapshot={controlled ? JSON.stringify(props.annotations.map((item) => item.id)) : ''}
  />;
}

type InternalRendererProps = AnnotationLayerProps & {
  readonly __editableSnapshot: string;
  readonly __styleSnapshot: string;
  readonly __boundsSnapshot: string;
  readonly __idsSnapshot: string;
};

const MemoizedAnnotationLayer = memo(AnnotationLayerRenderer, equalControlledLayerProps);

// A controlled host may rebuild its raw annotation array and inline edit
// options while its authoritative resolvedLayout object remains *identical*.
// Do not reconcile hundreds of SVG notes and edit controls for this no-op.
// Compare every other presentation/interaction prop by identity so callbacks,
// accessibility and debug settings are never hidden by this optimization.
const CONTROLLED_GEOMETRY_INPUTS = new Set<string>([
  'annotations', 'bounds', 'padding', 'obstacles', 'placement',
  'defaultNoteSize', 'noteSizes', 'refinement', 'editable', 'style'
]);

function equalControlledLayerProps(previous: InternalRendererProps, next: InternalRendererProps): boolean {
  if (!previous.resolvedLayout || previous.resolvedLayout !== next.resolvedLayout) return false;
  // Raw source diagnostics consume annotations directly rather than just the
  // authoritative resolved geometry. Conservatively keep them reactive.
  if (previous.targetAlignmentTargets || next.targetAlignmentTargets
    || previous.onTargetAlignment || next.onTargetAlignment
    || previous.assertTargetAlignment || next.assertTargetAlignment) return false;

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (CONTROLLED_GEOMETRY_INPUTS.has(key)) continue;
    if (previous[key as keyof InternalRendererProps] !== next[key as keyof InternalRendererProps]) return false;
  }
  return true;
}

function inlinePropsSnapshot(value: AnnotationLayerProps['editable'] | AnnotationLayerProps['style']): string {
  if (!value || typeof value !== 'object') return String(value);
  const record: Record<string, unknown> = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(record).sort().map((key) => [key, record[key]]));
}

function AnnotationLayerRenderer({
  annotations,
  assertQuality,
  assertTargetAlignment,
  bounds,
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
  resolvedLayout,
  label = 'Annotation layer',
  measure = 'estimate',
  markerIdPrefix,
  editHandleTabIndex = 0,
  noteTabIndex,
  preserveAspectRatio,
  qualityDebug = false,
  refinement,
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
  style,
  __boundsSnapshot,
  __idsSnapshot
}: InternalRendererProps) {
  const prefix = classPrefix;
  const markerPrefix = markerIdPrefix ?? prefix;
  const svgRef = useRef<SVGSVGElement>(null);
  const measureNodes = useRef(new Map<string, HTMLDivElement>());
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  // Local paint-only preview. The resolved layout, quality report, and host
  // annotation array remain unchanged until an edit is committed.
  const [activePreview, setActivePreview] = useState<ResolvedAnnotation | null>(null);
  // High-frequency pointer streams can produce several moves per animation
  // frame. Keep only the latest visual preview request and avoid reconciling
  // the entire SVG layer on every individual pointer event. Host onEdit
  // callbacks still receive every movement synchronously.
  const pendingPreview = useRef<(() => ResolvedAnnotation) | null>(null);
  const previewFrame = useRef<number | null>(null);
  const previewGeneration = useRef(0);
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, Size>>({});
  // A host-controlled resolved layout already owns the final note sizes.
  // Estimating every note again is wasted O(n) work on each incremental
  // commit, and merging an unused size map can invalidate other memoization.
  // Keep both hooks unconditional so switching back to local layout resolution
  // still computes the correct sizes without changing React hook order.
  const hasHostLayout = resolvedLayout !== undefined;
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
    if (resolvedLayout !== undefined) {
      if (measure === 'dom') {
        throw new Error('AnnotationLayer.resolvedLayout requires measure="estimate"; pass measured noteSizes through the host layout options instead.');
      }
      assertControlledLayout(resolvedLayout, annotations, bounds);
      return resolvedLayout;
    }

    return resolveAnnotationLayout({
      annotations,
      bounds,
      noteSizes: resolvedNoteSizes,
      ...(padding !== undefined ? { padding } : {}),
      ...(obstacles ? { obstacles } : {}),
      ...(placement ? { placement } : {}),
      ...(defaultNoteSize ? { defaultNoteSize } : {}),
      ...(refinement !== undefined ? { refinement } : {})
    });
  }, [
    annotations, bounds, padding, obstacles, placement, defaultNoteSize,
    refinement, resolvedNoteSizes, resolvedLayout, measure,
    // These primitive snapshots change even when a host mutates the same
    // bounds object or annotation IDs array in place. Revalidate controlled
    // layouts rather than trusting stale useMemo source references.
    __boundsSnapshot, __idsSnapshot
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

  const cancelQueuedPreview = useCallback(() => {
    previewGeneration.current += 1;
    if (previewFrame.current !== null) {
      globalThis.cancelAnimationFrame?.(previewFrame.current);
      previewFrame.current = null;
    }
    pendingPreview.current = null;
  }, []);

  // A host can update authoritative geometry mid-gesture. Discard visual
  // projections based on the old layout, and clean up on component unmount.
  useIsomorphicLayoutEffect(() => {
    // If the host replaces authoritative geometry or disables previewEdits
    // mid-gesture, also remove any already painted projection of the old state.
    setActivePreview(null);
    return cancelQueuedPreview;
  }, [cancelQueuedPreview, layout, previewEdits]);

  const schedulePreview = useCallback((build: () => ResolvedAnnotation) => {
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      // Nonvisual test environments lack rAF; preserve synchronous behavior.
      setActivePreview(build());
      return;
    }
    pendingPreview.current = build;
    if (previewFrame.current !== null) return;
    const generation = previewGeneration.current;
    previewFrame.current = globalThis.requestAnimationFrame(() => {
      if (previewGeneration.current !== generation) return;
      previewFrame.current = null;
      const latest = pendingPreview.current;
      pendingPreview.current = null;
      if (latest) setActivePreview(latest());
    });
  }, []);

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
    const active = {
      annotation,
      handle,
      origin: point,
      pointerId: event.pointerId
    };

    cancelQueuedPreview();
    setActiveEdit(active);
    setActivePreview(null);

    const editEvent = makeEditEvent(active, 'start', point);
    currentStart?.(editEvent);
    currentEdit?.(editEvent);
  }, [cancelQueuedPreview, makeEditEvent]);

  const handleEditPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeEdit || event.pointerId !== activeEdit.pointerId) {
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
  }, [activeEdit, clientPoint, layout.placementBounds, makeEditEvent, onEdit, previewEdits, schedulePreview]);

  const finishEdit = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeEdit || event.pointerId !== activeEdit.pointerId) {
      return;
    }

    event.preventDefault();
    const editEvent = makeEditEvent(activeEdit, 'end', clientPoint(event));
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
    onEditEnd?.(editEvent);
    onEdit?.(editEvent);
  }, [activeEdit, cancelQueuedPreview, clientPoint, makeEditEvent, onEdit, onEditEnd]);

  const cancelEdit = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeEdit || event.pointerId !== activeEdit.pointerId) {
      return;
    }
    // Cancellation must not persist an incomplete gesture in the host app.
    cancelQueuedPreview();
    setActivePreview(null);
    setActiveEdit(null);
  }, [activeEdit, cancelQueuedPreview]);

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

    const active = {
      annotation,
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

  const setMeasureNode = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) {
      measureNodes.current.set(id, node);
    } else {
      measureNodes.current.delete(id);
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (measure !== 'dom') {
      return undefined;
    }

    // Initial mount or a changed annotation collection must measure all
    // visible notes, including added/removed ones. ResizeObserver callbacks
    // have a much narrower meaning: only their listed elements changed.
    // Scanning every note on a one-note resize creates O(n) forced geometry
    // reads and computed-style lookups in dense DOM-measured editors.
    const measureNode = (node: HTMLDivElement): Size | undefined => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return undefined;

      // getBoundingClientRect reports post-transform pixels: under a scaled
      // ancestor, use computed local border-box dimensions for layout units.
      // Keep the client rect fallback for headless/test DOMs returning "auto".
      const style = typeof globalThis.getComputedStyle === 'function'
        ? globalThis.getComputedStyle(node)
        : undefined;
      const localWidth = style ? Number.parseFloat(style.width) : Number.NaN;
      const localHeight = style ? Number.parseFloat(style.height) : Number.NaN;
      return {
        width: Math.ceil(Number.isFinite(localWidth) && localWidth > 0 ? localWidth : rect.width),
        height: Math.ceil(Number.isFinite(localHeight) && localHeight > 0 ? localHeight : rect.height)
      };
    };

    const updateAll = () => {
      const next: Record<string, Size> = {};
      for (const [id, node] of measureNodes.current.entries()) {
        const size = measureNode(node);
        if (size) next[id] = size;
      }
      setMeasuredSizes((current) => shallowSizesEqual(current, next) ? current : next);
    };

    updateAll();
    if (typeof globalThis.ResizeObserver === 'undefined') return undefined;

    // The observer owns the actual node->ID mapping. Do not rely on DOM IDs
    // or class names, which custom note renderers are free to override.
    const idsByNode = new Map<Element, string>();
    const observer = new globalThis.ResizeObserver((entries) => {
      const changed = new Set<string>();
      for (const entry of entries) {
        const id = idsByNode.get(entry.target);
        if (id) changed.add(id);
      }
      if (changed.size === 0) return;

      const updates = new Map<string, Size | undefined>();
      for (const id of changed) {
        const node = measureNodes.current.get(id);
        if (node && idsByNode.get(node) === id) updates.set(id, measureNode(node));
      }
      if (updates.size === 0) return;
      setMeasuredSizes((current) => {
        let next: Record<string, Size> | undefined;
        for (const [id, size] of updates) {
          const previous = current[id];
          if (size) {
            if (previous?.width === size.width && previous.height === size.height) continue;
            next ??= { ...current };
            next[id] = size;
          } else if (previous) {
            next ??= { ...current };
            delete next[id];
          }
        }
        return next ?? current;
      });
    });
    for (const [id, node] of measureNodes.current.entries()) {
      idsByNode.set(node, id);
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, [annotations, measure, renderNote]);

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

// Drag previews update one resolved annotation. Memoized paint boundaries keep
// React from reconstructing note content, host renderNote callbacks, and edit
// controls for every untouched neighbor on each pointer event.
const PaintedAnnotation = memo(function PaintedAnnotation({
  item,
  prefix,
  markerPrefix,
  debug,
  noteTabIndex,
  renderNote
}: {
  item: ResolvedAnnotation;
  prefix: string;
  markerPrefix: string;
  debug: boolean;
  noteTabIndex: AnnotationLayerProps['noteTabIndex'];
  renderNote: AnnotationLayerProps['renderNote'];
}) {
  return (
    <g
      className={[
        prefix,
        `${prefix}--${item.placement.side}`,
        item.placement.manual ? `${prefix}--manual` : undefined,
        item.annotation.variant ? `${prefix}--${item.annotation.variant}` : undefined,
        item.annotation.tone ? `${prefix}--${item.annotation.tone}` : undefined,
        item.annotation.motion ? `${prefix}--${item.annotation.motion}` : undefined,
        item.annotation.className
      ].filter(Boolean).join(' ')}
      data-annotation-id={item.id}
      data-annotation-side={item.placement.side}
      role="group"
      aria-label={item.annotation.note.ariaLabel ?? item.annotation.note.title ?? item.id}
      style={annotationStyle(item.annotation.style)}
      {...dataAttributes(item.annotation.data)}
    >
      {renderSubject(item, prefix)}
      {renderConnector(item, prefix, markerPrefix)}
      {item.annotation.note.visible === false ? null : (
        <foreignObject
          className={noteShellClass(prefix, item.annotation)}
          x={item.noteBox.x}
          y={item.noteBox.y}
          width={item.noteBox.width}
          height={item.noteBox.height}
          data-note-align={item.annotation.note.align ?? 'start'}
        >
          <div
            className={noteBoxClass(prefix, item.annotation)}
            role="note"
            aria-label={item.annotation.note.ariaLabel ?? item.annotation.note.title ?? item.id}
            tabIndex={noteTabIndex}
            {...dataAttributes(item.annotation.note.data)}
            data-annotation-id={item.id}
            data-note-align={item.annotation.note.align ?? 'start'}
          >
            {renderNote ? renderNote(item) : <DefaultNote annotation={item.annotation} classPrefix={prefix} />}
          </div>
        </foreignObject>
      )}
      {debug ? renderDebugBoxes(item, prefix) : null}
    </g>
  );
});

const PaintedEditHandle = memo(function PaintedEditHandle({
  handle,
  prefix,
  tabIndex,
  onPointerDown,
  onKeyDown
}: {
  handle: AnnotationEditHandle;
  prefix: string;
  tabIndex: number;
  onPointerDown: (handle: AnnotationEditHandle, event: ReactPointerEvent<SVGCircleElement>) => void;
  onKeyDown: (handle: AnnotationEditHandle, event: ReactKeyboardEvent<SVGCircleElement>) => void;
}) {
  return (
    <g
      className={`${prefix}__edit-handle-group ${prefix}__edit-handle-group--${handle.kind}`}
      data-annotation-id={handle.annotationId}
      data-edit-handle={handle.kind}
      data-edit-handle-position={editHandlePosition(handle)}
    >
      <circle
        aria-hidden="true"
        className={`${prefix}__edit-hit ${prefix}__edit-hit--${handle.kind}`}
        cx={handle.point.x}
        cy={handle.point.y}
        r={handle.hitRadius}
        data-edit-handle-position={editHandlePosition(handle)}
        style={{ cursor: handle.cursor }}
        onPointerDown={(event) => onPointerDown(handle, event)}
      />
      <circle
        aria-label={handle.ariaLabel}
        className={`${prefix}__edit-handle ${prefix}__edit-handle--${handle.kind}`}
        cx={handle.point.x}
        cy={handle.point.y}
        data-annotation-id={handle.annotationId}
        data-edit-handle={handle.kind}
        data-edit-handle-position={editHandlePosition(handle)}
        r={handle.radius}
        role="button"
        style={{ cursor: handle.cursor }}
        tabIndex={tabIndex}
        aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Shift+ArrowUp Shift+ArrowRight Shift+ArrowDown Shift+ArrowLeft"
        onKeyDown={(event) => onKeyDown(handle, event)}
        onPointerDown={(event) => onPointerDown(handle, event)}
      />
    </g>
  );
});

const MeasuredAnnotation = memo(function MeasuredAnnotation({
  item,
  prefix,
  renderNote,
  setMeasureNode
}: {
  item: ResolvedAnnotation;
  prefix: string;
  renderNote: AnnotationLayerProps['renderNote'];
  setMeasureNode: (id: string, node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      className={noteBoxClass(prefix, item.annotation)}
      ref={(node) => setMeasureNode(item.id, node)}
      data-note-align={item.annotation.note.align ?? 'start'}
      // The drawn note inherits the annotation's style variables from
      // its <g>; the measured copy has no such parent, so without
      // these its `border: 1px solid var(--pa-annotation-border)`
      // computed to no border at all and every note measured 2px
      // narrower than the box it was then drawn in — which is how a
      // title that fit the measurer wrapped at the drawn box's edge.
      style={annotationStyle(item.annotation.style)}
      {...dataAttributes(item.annotation.note.data)}
    >
      {renderNote ? renderNote(item) : <DefaultNote annotation={item.annotation} classPrefix={prefix} />}
    </div>
  );
});

function assertControlledLayout(layout: ResolvedLayout, annotations: Annotation[], bounds: Box): void {
  const normalizedBounds = normalizeBox(bounds);
  if (layout.bounds.x !== normalizedBounds.x
    || layout.bounds.y !== normalizedBounds.y
    || layout.bounds.width !== normalizedBounds.width
    || layout.bounds.height !== normalizedBounds.height) {
    throw new Error('AnnotationLayer.resolvedLayout bounds do not match the current host bounds.');
  }

  const ids = new Set(annotations.map((annotation) => annotation.id));
  if (ids.size !== annotations.length || layout.annotations.length !== ids.size
    || layout.annotations.some((item) => !ids.delete(item.id)) || ids.size !== 0) {
    throw new Error('AnnotationLayer.resolvedLayout must contain exactly the current host annotation IDs.');
  }
}

function groupEditHandles(handles: AnnotationEditHandle[]): Map<string, AnnotationEditHandle[]> {
  const groups = new Map<string, AnnotationEditHandle[]>();
  for (const handle of handles) {
    const group = groups.get(handle.annotationId);
    if (group) group.push(handle);
    else groups.set(handle.annotationId, [handle]);
  }
  return groups;
}

function normalizeEditOptions(editable: AnnotationLayerProps['editable']): AnnotationLayerEditOptions | undefined {
  if (!editable) {
    return undefined;
  }

  return editable === true ? {} : editable;
}

function keyboardDelta(
  event: ReactKeyboardEvent<SVGCircleElement>,
  options: AnnotationLayerEditOptions | undefined
): { x: number; y: number } | undefined {
  const step = event.shiftKey
    ? options?.keyboardLargeStep ?? 10
    : options?.keyboardStep ?? 1;

  switch (event.key) {
    case 'ArrowUp':
      return { x: 0, y: -step };
    case 'ArrowRight':
      return { x: step, y: 0 };
    case 'ArrowDown':
      return { x: 0, y: step };
    case 'ArrowLeft':
      return { x: -step, y: 0 };
    default:
      return undefined;
  }
}

function editHandlePosition(handle: AnnotationEditHandle): string | undefined {
  return handle.data.editHandlePosition === undefined
    ? undefined
    : String(handle.data.editHandlePosition);
}

function DefaultNote({ annotation, classPrefix }: { annotation: Annotation; classPrefix: string }) {
  const line = normalizeNoteLine(annotation.note.line);
  const lineOrientation = line?.orientation ?? 'horizontal';

  return (
    <>
      {line ? (
        <span
          aria-hidden="true"
          className={[
            `${classPrefix}__note-line`,
            `${classPrefix}__note-line--${lineOrientation}`,
            line.className
          ].filter(Boolean).join(' ')}
          data-note-line="true"
          data-note-line-orientation={lineOrientation}
          style={noteLineStyle(line)}
          {...dataAttributes(line.data)}
        />
      ) : null}
      {annotation.note.title ? <strong className={`${classPrefix}__title`}>{annotation.note.title}</strong> : null}
      {annotation.note.body ? <span className={`${classPrefix}__body ${classPrefix}__label`}>{annotation.note.body}</span> : null}
    </>
  );
}

function noteLineStyle(line: AnnotationNoteLineOptions): CSSProperties | undefined {
  if (line.length === undefined) {
    return undefined;
  }

  return line.orientation === 'vertical'
    ? { blockSize: line.length }
    : { inlineSize: line.length };
}

function normalizeNoteLine(line: Annotation['note']['line']): AnnotationNoteLineOptions | undefined {
  if (line === undefined || line === false) {
    return undefined;
  }

  if (line === true) {
    return {};
  }

  return line.visible === false ? undefined : line;
}

function normalizeBadge(badge: AnnotationSubjectOptions['badge']): AnnotationBadgeOptions | undefined {
  if (badge === undefined || badge === false) {
    return undefined;
  }

  return badge === true ? {} : badge;
}

function noteShellClass(prefix: string, annotation: Annotation): string {
  return [
    `${prefix}__note`,
    `${prefix}__note--align-${annotation.note.align ?? 'start'}`
  ].join(' ');
}

function noteBoxClass(prefix: string, annotation: Annotation): string {
  return [
    `${prefix}__note-box`,
    `${prefix}__note-box--align-${annotation.note.align ?? 'start'}`,
    annotation.note.className
  ].filter(Boolean).join(' ');
}

function renderSubject(item: ResolvedAnnotation, prefix: string) {
  const options = item.annotation.subject;
  const shape = options?.shape ?? 'auto';

  if (shape === 'none') {
    return null;
  }

  const badge = normalizeBadge(options?.badge);

  if (badge) {
    const radius = badge.radius ?? options?.radius ?? 12;
    const label = badge.label ?? item.annotation.note.title ?? item.id;
    const geometry = badgeGeometry(item.subject.point, radius, badge.x, badge.y);
    const badgeData = {
      ...(options?.data ?? {}),
      ...(badge.data ?? {}),
      ...(badge.x ? { badgeX: badge.x } : {}),
      ...(badge.y ? { badgeY: badge.y } : {})
    };

    return (
      <g className={`${prefix}__badge-wrap`} aria-hidden="true">
        {geometry.pointerD ? (
          <path
            className={`${prefix}__badge-pointer`}
            d={geometry.pointerD}
            {...dataAttributes(badgeData)}
          />
        ) : null}
        <circle
          className={[`${prefix}__badge`, badge.className].filter(Boolean).join(' ')}
          cx={geometry.center.x}
          cy={geometry.center.y}
          r={radius}
          {...dataAttributes(badgeData)}
        />
        <text
          className={`${prefix}__badge-label ${prefix}__title`}
          x={geometry.center.x}
          y={geometry.center.y}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      </g>
    );
  }

  const className = [
    `${prefix}__subject`,
    `${prefix}__subject--${item.subject.type}`,
    options?.path ? `${prefix}__subject--path` : undefined,
    options?.geometry ? `${prefix}__subject--geometry` : undefined,
    options?.geometry ? `${prefix}__subject--geometry-${options.geometry.type}` : undefined,
    options?.className
  ]
    .filter(Boolean)
    .join(' ');

  if (options?.geometry) {
    return (
      <path
        aria-hidden="true"
        className={className}
        d={subjectPath(options.geometry as AnnotationPartsSubject)}
        transform={options.geometrySpace === 'absolute' ? undefined : `translate(${item.subject.point.x} ${item.subject.point.y})`}
        {...dataAttributes(options.data)}
      />
    );
  }

  if (options?.path) {
    return (
      <path
        aria-hidden="true"
        className={className}
        d={options.path}
        {...dataAttributes(options.data)}
      />
    );
  }

  if (shape === 'circle') {
    return <CircleSubject box={item.subject.box} point={item.subject.point} options={options} className={className} />;
  }

  if (shape === 'rect') {
    return <RectSubject box={item.subject.box} options={options} className={className} />;
  }

  if (shape === 'point') {
    return (
      <circle
        aria-hidden="true"
        className={className}
        cx={item.subject.point.x}
        cy={item.subject.point.y}
        r={options?.radius ?? 4}
        {...dataAttributes(options?.data)}
      />
    );
  }

  if (shape === 'path' && item.subject.type === 'path') {
    return (
      <polyline
        aria-hidden="true"
        className={className}
        points={item.subject.points.map((point) => `${point.x},${point.y}`).join(' ')}
        {...dataAttributes(options?.data)}
      />
    );
  }

  switch (item.subject.type) {
    case 'point':
      return (
        <circle
          aria-hidden="true"
          className={className}
          cx={item.subject.point.x}
          cy={item.subject.point.y}
          r={options?.radius ?? 4}
          {...dataAttributes(options?.data)}
        />
      );
    case 'box':
      return <RectSubject box={item.subject.box} options={options} className={className} />;
    case 'path':
      return (
      <polyline
        aria-hidden="true"
        className={className}
        points={item.subject.points.map((point) => `${point.x},${point.y}`).join(' ')}
        {...dataAttributes(options?.data)}
        />
      );
  }
}

function renderConnector(item: ResolvedAnnotation, prefix: string, markerPrefix: string) {
  if (!item.connector.d || item.annotation.connector?.type === 'none') {
    return null;
  }

  const end = item.annotation.connector?.end ?? 'none';

  return (
    <path
      aria-hidden="true"
      className={[`${prefix}__connector`, item.annotation.connector?.className].filter(Boolean).join(' ')}
      d={item.connector.d}
      data-annotation-id={item.id}
      data-connector-type={item.connector.type}
      markerEnd={end === 'none' ? undefined : `url(#${markerId(markerPrefix, end)})`}
      {...dataAttributes(item.annotation.connector?.data)}
    />
  );
}

function renderDebugBoxes(item: ResolvedAnnotation, prefix: string) {
  return [
    <rect
      aria-hidden="true"
      className={`${prefix}__debug-box ${prefix}__debug-box--winner`}
      data-annotation-id={item.id}
      data-debug-kind="winner"
      height={item.noteBox.height}
      key="winner"
      width={item.noteBox.width}
      x={item.noteBox.x}
      y={item.noteBox.y}
    />,
    ...item.placement.candidates.map((candidate, index) => (
      <rect
        aria-hidden="true"
        className={`${prefix}__debug-box ${prefix}__debug-box--candidate`}
        data-annotation-id={item.id}
        data-candidate-index={index}
        data-candidate-score={round(candidate.score)}
        data-candidate-side={candidate.side}
        data-debug-kind="candidate"
        height={candidate.noteBox.height}
        key={`candidate-${index}`}
        width={candidate.noteBox.width}
        x={candidate.noteBox.x}
        y={candidate.noteBox.y}
      />
    ))
  ];
}

function renderQualityIssues(
  layout: ResolvedLayout,
  quality: LayoutQualityReport,
  prefix: string
) {
  const issues = quality.issues
    .map((issue, index) => renderQualityIssue(layout, issue, index, prefix))
    .filter(Boolean);

  return issues.length > 0 ? <g className={`${prefix}__quality-issues`}>{issues}</g> : null;
}

function renderQualityIssue(
  layout: ResolvedLayout,
  issue: LayoutQualityIssue,
  index: number,
  prefix: string
) {
  const box = qualityIssueBox(layout, issue);

  if (!box) {
    return null;
  }

  const expanded = expandBox(box, 4);

  return (
    <g
      aria-hidden="true"
      className={[
        `${prefix}__quality-issue`,
        `${prefix}__quality-issue--${issue.severity}`,
        `${prefix}__quality-issue--${issue.type}`
      ].join(' ')}
      data-quality-issue={issue.type}
      data-quality-severity={issue.severity}
      data-quality-index={index}
      data-annotation-id={issue.annotationId}
      data-annotation-ids={issue.annotationIds?.join(' ')}
      data-obstacle-index={issue.obstacleIndex}
      data-segment-index={issue.segmentIndex}
      data-area={issue.area}
      data-amount={issue.amount}
      key={`quality-${index}`}
    >
      <title>{issue.message}</title>
      <rect
        x={expanded.x}
        y={expanded.y}
        width={expanded.width}
        height={expanded.height}
      />
    </g>
  );
}

function qualityIssueBox(layout: ResolvedLayout, issue: LayoutQualityIssue): Box | undefined {
  if (issue.annotationId) {
    return layout.annotations.find((item) => item.id === issue.annotationId)?.noteBox;
  }

  if (issue.annotationIds) {
    const boxes = issue.annotationIds
      .map((id) => layout.annotations.find((item) => item.id === id)?.noteBox)
      .filter((box): box is Box => Boolean(box));

    return boxes.length > 0 ? boxUnion(boxes) : undefined;
  }

  return undefined;
}

function RectSubject({
  box,
  options,
  className
}: {
  box: Box;
  options: AnnotationSubjectOptions | undefined;
  className: string;
}) {
  const expanded = expandBox(box, options?.padding ?? 0);

  return (
    <rect
      aria-hidden="true"
      className={className}
      x={expanded.x}
      y={expanded.y}
      width={expanded.width}
      height={expanded.height}
      rx={options?.cornerRadius ?? 4}
      {...dataAttributes(options?.data)}
    />
  );
}

function CircleSubject({
  box,
  point,
  options,
  className
}: {
  box: Box;
  point: { x: number; y: number };
  options: AnnotationSubjectOptions | undefined;
  className: string;
}) {
  const center = box.width === 0 && box.height === 0 ? point : boxCenter(box);
  const radius = options?.radius ?? Math.max(4, Math.max(box.width, box.height) / 2 + maxPadding(options?.padding));

  return (
    <circle
      aria-hidden="true"
      className={className}
      cx={center.x}
      cy={center.y}
      r={radius}
      {...dataAttributes(options?.data)}
    />
  );
}

function badgeGeometry(
  anchor: Point,
  radius: number,
  x: AnnotationBadgeOptions['x'] | undefined,
  y: AnnotationBadgeOptions['y'] | undefined
): BadgeGeometry {
  const sideX = x === 'center' ? undefined : x;
  const sideY = y === 'center' ? undefined : y;
  const offsetX = sideX === 'left'
    ? (sideY ? -radius : -Math.SQRT2 * radius)
    : sideX === 'right'
      ? (sideY ? radius : Math.SQRT2 * radius)
      : 0;
  const offsetY = sideY === 'top'
    ? (sideX ? -radius : -Math.SQRT2 * radius)
    : sideY === 'bottom'
      ? (sideX ? radius : Math.SQRT2 * radius)
      : 0;
  const center = {
    x: round(anchor.x + offsetX),
    y: round(anchor.y + offsetY)
  };

  if (!sideX && !sideY) {
    return { center };
  }

  if (sideX && sideY) {
    return {
      center,
      pointerD: badgePath(anchor, {
        x: anchor.x + offsetX,
        y: anchor.y
      }, {
        x: anchor.x,
        y: anchor.y + offsetY
      })
    };
  }

  const pointerOffset = (value: number, sign = 1) => value === 0
    ? sign * radius / Math.SQRT2
    : value / Math.SQRT2 / Math.SQRT2;

  return {
    center,
    pointerD: badgePath(anchor, {
      x: anchor.x + pointerOffset(offsetX),
      y: anchor.y + pointerOffset(offsetY)
    }, {
      x: anchor.x + pointerOffset(offsetX, -1),
      y: anchor.y + pointerOffset(offsetY, -1)
    })
  };
}

function badgePath(anchor: Point, first: Point, second: Point): string {
  return `M${round(anchor.x)},${round(anchor.y)}L${round(first.x)},${round(first.y)}L${round(second.x)},${round(second.y)}Z`;
}

const MemoMarkerDefs = memo(MarkerDefs);

function MarkerDefs({
  annotations,
  markerPrefix,
  prefix
}: {
  annotations: ResolvedAnnotation[];
  markerPrefix: string;
  prefix: string;
}) {
  const ends = new Set(annotations.map((item) => item.annotation.connector?.end ?? 'none'));

  if (!ends.has('arrow') && !ends.has('dot')) {
    return null;
  }

  return (
    <defs>
      {ends.has('arrow') ? (
        <marker
          id={markerId(markerPrefix, 'arrow')}
          className={`${prefix}__marker ${prefix}__marker--arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      ) : null}
      {ends.has('dot') ? (
        <marker
          id={markerId(markerPrefix, 'dot')}
          className={`${prefix}__marker ${prefix}__marker--dot`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
        >
          <circle cx="5" cy="5" r="3" />
        </marker>
      ) : null}
    </defs>
  );
}

function shallowSizesEqual(a: Record<string, Size>, b: Record<string, Size>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => a[key]?.width === b[key]?.width && a[key]?.height === b[key]?.height);
}

function dataAttributes(data: Record<string, string | number | boolean | null | undefined> | undefined) {
  if (!data) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [`data-${dataKey(key)}`, String(value)])
  );
}

function annotationStyle(style: Annotation['style']): CSSProperties | undefined {
  const variables = annotationStyleVariables(style);

  return Object.keys(variables).length > 0
    ? variables as CSSProperties
    : undefined;
}

function dataKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .toLowerCase();
}

function maxPadding(padding: AnnotationSubjectOptions['padding']): number {
  const resolved = resolvePadding(padding ?? 0);

  return Math.max(resolved.top, resolved.right, resolved.bottom, resolved.left);
}

function markerId(prefix: string, end: string): string {
  return `${prefix.replace(/[^a-zA-Z0-9_-]+/g, '-')}-marker-${end}`;
}

function clientToSvgPoint(
  event: ReactPointerEvent<SVGElement>,
  svg: SVGSVGElement | null,
  bounds: Box
): { x: number; y: number } {
  if (!svg) {
    return { x: bounds.x, y: bounds.y };
  }

  const matrix = svg.getScreenCTM?.();
  const createPoint = svg.createSVGPoint?.bind(svg);

  if (matrix && createPoint) {
    const point = createPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const transformed = point.matrixTransform(matrix.inverse());

    if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
      return {
        x: round(transformed.x),
        y: round(transformed.y)
      };
    }
  }

  const point = svgPointFromClient(svg, {
    x: event.clientX,
    y: event.clientY
  });

  return {
    x: round(point.x),
    y: round(point.y)
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
