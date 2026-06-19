import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
  resolvePadding
} from '../core/anchors.js';
import {
  annotationEditHandles,
  createAnnotationEditDelta,
  createAnnotationEditEvent
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

export function AnnotationLayer({
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
  style
}: AnnotationLayerProps) {
  const prefix = classPrefix;
  const markerPrefix = markerIdPrefix ?? prefix;
  const svgRef = useRef<SVGSVGElement>(null);
  const measureNodes = useRef(new Map<string, HTMLDivElement>());
  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, Size>>({});
  const estimatedSizes = useMemo(
    () => Object.fromEntries(annotations.map((annotation) => [
      annotation.id,
      estimateNoteSize(annotation, defaultNoteSize)
    ])),
    [annotations, defaultNoteSize]
  );
  const resolvedNoteSizes = useMemo(
    () => ({
      ...estimatedSizes,
      ...(noteSizes ?? {}),
      ...(measure === 'dom' ? measuredSizes : {})
    }),
    [estimatedSizes, noteSizes, measure, measuredSizes]
  );
  const layout = useMemo(
    () => resolveAnnotationLayout({
      annotations,
      bounds,
      noteSizes: resolvedNoteSizes,
      ...(padding !== undefined ? { padding } : {}),
      ...(obstacles ? { obstacles } : {}),
      ...(placement ? { placement } : {}),
      ...(defaultNoteSize ? { defaultNoteSize } : {}),
      ...(refinement !== undefined ? { refinement } : {})
    }),
    [annotations, bounds, padding, obstacles, placement, defaultNoteSize, refinement, resolvedNoteSizes]
  );
  const quality = useMemo(
    () => evaluateAnnotationLayout(layout),
    [layout]
  );
  const qualitySummary = useMemo(
    () => formatLayoutQualityReport(quality, qualityFormat),
    [quality, qualityFormat]
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

  useIsomorphicLayoutEffect(() => {
    if (assertQuality) {
      assertAnnotationLayoutQuality(
        quality,
        assertQuality === true ? {} : assertQuality
      );
    }

    if (assertTargetAlignment && !targetAlignment) {
      throw new Error('targetAlignmentTargets are required when assertTargetAlignment is set.');
    }

    if (targetAlignment) {
      assertAnchorAlignmentReportIfRequested(
        targetAlignment,
        assertTargetAlignment
      );
      onTargetAlignment?.({
        layout,
        targetAlignment,
        summary: targetAlignmentSummary!
      });
    }

    onQuality?.({
      layout,
      quality,
      summary: qualitySummary
    });
    onLayout?.(layout);
  }, [
    assertQuality,
    assertTargetAlignment,
    layout,
    onLayout,
    onQuality,
    onTargetAlignment,
    quality,
    qualitySummary,
    targetAlignment,
    targetAlignmentSummary
  ]);

  const editOptions = useMemo(() => normalizeEditOptions(editable), [editable]);
  const editHandles = useMemo(
    () => editOptions ? annotationEditHandles(layout, editOptions) : [],
    [layout, editOptions]
  );
  const paintAnnotations = useMemo(
    () => annotationsForPaint(layout.annotations),
    [layout.annotations]
  );

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

  const handleEditPointerDown = useCallback((
    handle: AnnotationEditHandle,
    event: ReactPointerEvent<SVGCircleElement>
  ) => {
    const annotation = layout.annotations.find((item) => item.id === handle.annotationId);

    if (!annotation) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const point = clientPoint(event);
    const active = {
      annotation,
      handle,
      origin: point,
      pointerId: event.pointerId
    };

    setActiveEdit(active);

    const editEvent = makeEditEvent(active, 'start', point);
    onEditStart?.(editEvent);
    onEdit?.(editEvent);
  }, [clientPoint, layout.annotations, makeEditEvent, onEdit, onEditStart]);

  const handleEditPointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeEdit) {
      return;
    }

    event.preventDefault();
    const editEvent = makeEditEvent(activeEdit, 'move', clientPoint(event));
    onEdit?.(editEvent);
  }, [activeEdit, clientPoint, makeEditEvent, onEdit]);

  const finishEdit = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeEdit) {
      return;
    }

    event.preventDefault();
    const editEvent = makeEditEvent(activeEdit, 'end', clientPoint(event));
    onEditEnd?.(editEvent);
    onEdit?.(editEvent);
    setActiveEdit(null);
  }, [activeEdit, clientPoint, makeEditEvent, onEdit, onEditEnd]);

  const handleEditKeyDown = useCallback((
    handle: AnnotationEditHandle,
    event: ReactKeyboardEvent<SVGCircleElement>
  ) => {
    const delta = keyboardDelta(event, editOptions);

    if (!delta) {
      return;
    }

    const annotation = layout.annotations.find((item) => item.id === handle.annotationId);

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

    onEditStart?.(startEvent);
    onEdit?.(startEvent);
    onEditEnd?.(endEvent);
    onEdit?.(endEvent);
  }, [editOptions, layout.annotations, makeEditEvent, onEdit, onEditEnd, onEditStart]);

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

    const update = () => {
      const next: Record<string, Size> = {};

      for (const [id, node] of measureNodes.current.entries()) {
        const rect = node.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          next[id] = {
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height)
          };
        }
      }

      setMeasuredSizes((current) => shallowSizesEqual(current, next) ? current : next);
    };

    update();

    if (typeof globalThis.ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new globalThis.ResizeObserver(update);
    for (const node of measureNodes.current.values()) {
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
        role="img"
        aria-label={label}
        width={bounds.width}
        height={bounds.height}
        preserveAspectRatio={preserveAspectRatio}
        onPointerMove={handleEditPointerMove}
        onPointerUp={finishEdit}
        onPointerCancel={finishEdit}
      >
        <MarkerDefs annotations={layout.annotations} prefix={prefix} markerPrefix={markerPrefix} />
        {paintAnnotations.map((item) => (
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
            key={item.id}
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
        ))}
        {qualityDebug ? renderQualityIssues(layout, quality, prefix) : null}
        {editHandles.length > 0 ? (
          <g className={`${prefix}__edit-handles`}>
            {editHandles.map((handle) => (
              <g
                className={`${prefix}__edit-handle-group ${prefix}__edit-handle-group--${handle.kind}`}
                data-annotation-id={handle.annotationId}
                data-edit-handle={handle.kind}
                data-edit-handle-position={editHandlePosition(handle)}
                key={handle.id}
              >
                <circle
                  aria-hidden="true"
                  className={`${prefix}__edit-hit ${prefix}__edit-hit--${handle.kind}`}
                  cx={handle.point.x}
                  cy={handle.point.y}
                  r={handle.hitRadius}
                  data-edit-handle-position={editHandlePosition(handle)}
                  style={{ cursor: handle.cursor }}
                  onPointerDown={(event) => handleEditPointerDown(handle, event)}
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
                  tabIndex={editHandleTabIndex}
                  aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Shift+ArrowUp Shift+ArrowRight Shift+ArrowDown Shift+ArrowLeft"
                  onKeyDown={(event) => handleEditKeyDown(handle, event)}
                  onPointerDown={(event) => handleEditPointerDown(handle, event)}
                />
              </g>
            ))}
          </g>
        ) : null}
      </svg>
      {measure === 'dom' ? (
        <div className={`${prefix}-layer__measurer`} aria-hidden="true">
          {layout.annotations
            .filter((item) => item.annotation.note.visible !== false)
            .map((item) => (
              <div
                className={noteBoxClass(prefix, item.annotation)}
                key={item.id}
                ref={(node) => setMeasureNode(item.id, node)}
                data-note-align={item.annotation.note.align ?? 'start'}
                {...dataAttributes(item.annotation.note.data)}
              >
                {renderNote ? renderNote(item) : <DefaultNote annotation={item.annotation} classPrefix={prefix} />}
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
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
