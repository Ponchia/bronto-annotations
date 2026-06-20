import type {
  AnnotationBadgeOptions,
  AnnotationNote,
  AnnotationNoteLineOptions,
  AnnotationStyle,
  AnnotationSubjectOptions,
  Box,
  DataAttributes,
  Padding,
  PaddingInput,
  PlacementCandidate,
  Point,
  ResolvedAnnotation,
  ResolvedLayout
} from '../core/model.js';
import { DEFAULT_NOTE_PADDING } from '../core/model.js';
import { annotationStyleVariables } from '../core/style.js';
import { subjectPath } from '../core/annotation-geometry.js';
import type { AnnotationPartsSubject } from '../core/annotation-geometry.js';
import type {
  AnnotationEditHandle,
  AnnotationEditHandleOptions
} from '../core/edit.js';
import {
  boxCenter,
  boxUnion,
  expandBox,
  resolvePadding
} from '../core/anchors.js';
import { annotationEditHandles } from '../core/edit.js';
import { annotationsForPaint } from '../core/order.js';
import { wrapNoteText } from '../core/text.js';
import {
  evaluateAnnotationLayout,
  type LayoutQualityIssue,
  type LayoutQualityReport
} from '../core/quality.js';

export type SvgRenderOptions = {
  classPrefix?: string;
  includeSubjects?: boolean;
  includeDebugBoxes?: boolean;
  includeQualityIssues?: boolean | LayoutQualityReport;
  qualityIssuePadding?: PaddingInput;
  includeEditHandles?: boolean | AnnotationEditHandleOptions;
  editHandleTabIndex?: number;
  markerIdPrefix?: string;
  noteTabIndex?: number;
  preserveAspectRatio?: string;
  title?: string;
  ariaLabel?: string;
};

const DEFAULT_CLASS_PREFIX = 'pa-annotation';
const TEXT_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
};
const ATTRIBUTE_ESCAPES: Record<string, string> = {
  ...TEXT_ESCAPES,
  '"': '&quot;'
};

/**
 * Render a complete SVG annotation layer as a string.
 *
 * Text content, attribute values, class names, data attributes, IDs, and inline
 * style text are escaped before insertion. This helper still returns markup:
 * consumers must treat untrusted host chart, diagram, report, path, style, and
 * annotation text data according to their own sanitization boundary before
 * assigning the result to `innerHTML`.
 */
export function renderAnnotationsSvg(layout: ResolvedLayout, options: SvgRenderOptions = {}): string {
  const prefix = options.classPrefix ?? DEFAULT_CLASS_PREFIX;
  const markerPrefix = options.markerIdPrefix ?? prefix;
  const title = options.title ? `<title>${escapeText(options.title)}</title>` : '';
  const label = options.ariaLabel ?? options.title ?? 'Annotation layer';
  const includeSubjects = options.includeSubjects !== false;
  const markerDefs = renderMarkerDefs(layout, prefix, markerPrefix);
  const paintAnnotations = annotationsForPaint(layout.annotations);
  const debugBoxes = options.includeDebugBoxes
    ? paintAnnotations.flatMap((item) => renderDebugBoxes(item, prefix)).join('')
    : '';
  const qualityIssues = options.includeQualityIssues
    ? renderQualityIssues(layout, qualityReportForLayout(layout, options.includeQualityIssues), prefix, options.qualityIssuePadding)
    : '';
  const editHandles = options.includeEditHandles
    ? renderEditHandles(layout, prefix, options.includeEditHandles === true ? {} : options.includeEditHandles, options.editHandleTabIndex)
    : '';
  const preserveAspectRatio = options.preserveAspectRatio
    ? ` preserveAspectRatio="${escapeAttribute(options.preserveAspectRatio)}"`
    : '';

  return [
    `<svg class="${escapeAttribute(`${prefix}-layer`)}" xmlns="http://www.w3.org/2000/svg" viewBox="${layout.bounds.x} ${layout.bounds.y} ${layout.bounds.width} ${layout.bounds.height}"${preserveAspectRatio} role="img" aria-label="${escapeAttribute(label)}">`,
    title,
    markerDefs,
    paintAnnotations.map((item) => renderResolvedAnnotationSvg(item, prefix, includeSubjects, markerPrefix, options.noteTabIndex)).join(''),
    debugBoxes,
    qualityIssues,
    editHandles,
    '</svg>'
  ].join('');
}

export function renderAnnotationSubjectsSvg(layout: ResolvedLayout, options: SvgRenderOptions = {}): string {
  const prefix = options.classPrefix ?? DEFAULT_CLASS_PREFIX;

  return annotationsForPaint(layout.annotations)
    .map((item) => renderSubjectSvg(item, prefix))
    .join('');
}

function renderResolvedAnnotationSvg(
  item: ResolvedAnnotation,
  prefix: string,
  includeSubject: boolean,
  markerPrefix: string,
  noteTabIndex: number | undefined
): string {
  const annotationClass = classNames(
    prefix,
    `${prefix}--${item.placement.side}`,
    item.placement.manual ? `${prefix}--manual` : undefined,
    item.annotation.variant ? `${prefix}--${item.annotation.variant}` : undefined,
    item.annotation.tone ? `${prefix}--${item.annotation.tone}` : undefined,
    item.annotation.motion ? `${prefix}--${item.annotation.motion}` : undefined,
    item.annotation.className
  );
  const padding = notePadding(item.annotation.note);
  const align = noteTextAlign(item.annotation.note.align ?? 'start', item.noteBox.width, padding);
  const wrap = item.annotation.note.wrap ?? Math.max(18, Math.floor((item.noteBox.width - padding.left - padding.right) / 7.2));
  const noteClass = classNames(
    `${prefix}__note`,
    `${prefix}__note--align-${item.annotation.note.align ?? 'start'}`,
    item.annotation.note.className
  );
  const noteLine = renderNoteLineSvg(item, prefix, padding);
  const hasNoteLine = noteLine !== '';
  const titleY = padding.top + (hasNoteLine ? 24 : 14);
  const splitter = item.annotation.note.wrapSplitter;
  const titleLines = item.annotation.note.title
    ? wrapNoteText(item.annotation.note.title, { maxChars: Math.max(18, Math.min(30, wrap)), maxLines: 2, splitter })
    : [];
  const title = titleLines
    .map((line, index) => `<text class="${escapeAttribute(`${prefix}__title`)}" x="${align.x}" y="${titleY + index * 18}" text-anchor="${align.anchor}">${escapeText(line)}</text>`)
    .join('');
  const bodyLines = wrapNoteText(item.annotation.note.body ?? '', {
    maxChars: wrap,
    maxLines: item.annotation.note.maxLines ?? 4,
    splitter
  });
  const startY = titleLines.length > 0
    ? titleY + 5 + titleLines.length * 18
    : padding.top + (hasNoteLine ? 26 : 16);
  const body = bodyLines
    .map((line, index) => `<text class="${escapeAttribute(`${prefix}__body ${prefix}__label`)}" x="${align.x}" y="${startY + index * 17}" text-anchor="${align.anchor}">${escapeText(line)}</text>`)
    .join('');
  const connector = renderConnectorSvg(item, prefix, markerPrefix);
  const subject = includeSubject ? renderSubjectSvg(item, prefix) : '';
  const note = item.annotation.note.visible === false
    ? ''
    : [
      `<g class="${escapeAttribute(noteClass)}" transform="translate(${item.noteBox.x} ${item.noteBox.y})" role="note" aria-label="${escapeAttribute(item.annotation.note.ariaLabel ?? item.annotation.note.title ?? item.id)}"${dataAttributes(item.annotation.note.data)} data-annotation-id="${escapeAttribute(item.id)}" data-note-align="${item.annotation.note.align ?? 'start'}"${tabIndexAttribute(noteTabIndex)}>`,
      `<rect class="${escapeAttribute(`${prefix}__note-box`)}" width="${item.noteBox.width}" height="${item.noteBox.height}" rx="8" aria-hidden="true" />`,
      noteLine,
      title,
      body,
      '</g>'
    ].join('');

  return [
    `<g class="${escapeAttribute(annotationClass)}" data-annotation-id="${escapeAttribute(item.id)}" data-annotation-side="${item.placement.side}" role="group" aria-label="${escapeAttribute(item.annotation.note.ariaLabel ?? item.annotation.note.title ?? item.id)}"${styleAttribute(item.annotation.style)}${dataAttributes(item.annotation.data)}>`,
    subject,
    connector,
    note,
    '</g>'
  ].join('');
}

function renderNoteLineSvg(item: ResolvedAnnotation, prefix: string, padding: Padding): string {
  const options = normalizeNoteLine(item.annotation.note.line);

  if (!options) {
    return '';
  }

  const orientation = options.orientation ?? 'horizontal';
  const className = classNames(`${prefix}__note-line`, options.className);
  const data = dataAttributes({
    noteLineOrientation: orientation,
    ...(options.data ?? {})
  });

  if (orientation === 'vertical') {
    const x = options.offset ?? padding.left;
    const y1 = padding.top;
    const y2 = y1 + (options.length ?? Math.max(0, item.noteBox.height - padding.top - padding.bottom));

    return `<path class="${escapeAttribute(className)}" d="M${x},${y1}V${y2}" aria-hidden="true"${data} />`;
  }

  const x1 = padding.left;
  const x2 = x1 + (options.length ?? Math.max(0, item.noteBox.width - padding.left - padding.right));
  const y = options.offset ?? padding.top;

  return `<path class="${escapeAttribute(className)}" d="M${x1},${y}H${x2}" aria-hidden="true"${data} />`;
}

function renderDebugBoxes(item: ResolvedAnnotation, prefix: string): string[] {
  const winner = `<rect class="${escapeAttribute(`${prefix}__debug-box ${prefix}__debug-box--winner`)}" x="${item.noteBox.x}" y="${item.noteBox.y}" width="${item.noteBox.width}" height="${item.noteBox.height}" aria-hidden="true" data-annotation-id="${escapeAttribute(item.id)}" data-debug-kind="winner" />`;
  const candidates = item.placement.candidates.map((candidate, index) => renderCandidateDebugBox(item, candidate, index, prefix));

  return [winner, ...candidates];
}

function renderQualityIssues(
  layout: ResolvedLayout,
  report: LayoutQualityReport,
  prefix: string,
  padding: PaddingInput | undefined
): string {
  const boxes = report.issues
    .map((issue, index) => renderQualityIssue(layout, issue, index, prefix, padding))
    .filter(Boolean);

  return boxes.length > 0
    ? `<g class="${escapeAttribute(`${prefix}__quality-issues`)}">${boxes.join('')}</g>`
    : '';
}

function renderQualityIssue(
  layout: ResolvedLayout,
  issue: LayoutQualityIssue,
  index: number,
  prefix: string,
  padding: PaddingInput | undefined
): string {
  const box = qualityIssueBox(layout, issue);

  if (!box) {
    return '';
  }

  const expanded = expandBox(box, padding ?? 4);
  const className = classNames(
    `${prefix}__quality-issue`,
    `${prefix}__quality-issue--${issue.severity}`,
    `${prefix}__quality-issue--${issue.type}`
  );

  return [
    `<g class="${escapeAttribute(className)}" aria-hidden="true" data-quality-issue="${escapeAttribute(issue.type)}" data-quality-severity="${escapeAttribute(issue.severity)}" data-quality-index="${index}"${qualityIssueData(issue)}>`,
    `<title>${escapeText(issue.message)}</title>`,
    `<rect x="${expanded.x}" y="${expanded.y}" width="${expanded.width}" height="${expanded.height}" />`,
    '</g>'
  ].join('');
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

function qualityReportForLayout(
  layout: ResolvedLayout,
  input: true | LayoutQualityReport
): LayoutQualityReport {
  return input === true ? evaluateAnnotationLayout(layout) : input;
}

function qualityIssueData(issue: LayoutQualityIssue): string {
  return dataAttributes({
    annotationId: issue.annotationId,
    annotationIds: issue.annotationIds?.join(' '),
    obstacleIndex: issue.obstacleIndex,
    segmentIndex: issue.segmentIndex,
    area: issue.area,
    amount: issue.amount
  });
}

function renderEditHandles(
  layout: ResolvedLayout,
  prefix: string,
  options: AnnotationEditHandleOptions,
  tabIndex: number | undefined
): string {
  const handles = annotationEditHandles(layout, options);

  if (handles.length === 0) {
    return '';
  }

  return `<g class="${escapeAttribute(`${prefix}__edit-handles`)}">${handles.map((handle) => renderEditHandle(handle, prefix, tabIndex)).join('')}</g>`;
}

function renderEditHandle(handle: AnnotationEditHandle, prefix: string, tabIndex: number | undefined): string {
  return [
    `<circle class="${escapeAttribute(`${prefix}__edit-hit ${prefix}__edit-hit--${handle.kind}`)}" cx="${handle.point.x}" cy="${handle.point.y}" r="${handle.hitRadius}" aria-hidden="true"${dataAttributes(handle.data)} />`,
    `<circle class="${escapeAttribute(`${prefix}__edit-handle ${prefix}__edit-handle--${handle.kind}`)}" cx="${handle.point.x}" cy="${handle.point.y}" r="${handle.radius}" role="button" aria-label="${escapeAttribute(handle.ariaLabel)}"${tabIndexAttribute(tabIndex)}${dataAttributes(handle.data)} />`
  ].join('');
}

function renderCandidateDebugBox(
  item: ResolvedAnnotation,
  candidate: PlacementCandidate,
  index: number,
  prefix: string
): string {
  return `<rect class="${escapeAttribute(`${prefix}__debug-box ${prefix}__debug-box--candidate`)}" x="${candidate.noteBox.x}" y="${candidate.noteBox.y}" width="${candidate.noteBox.width}" height="${candidate.noteBox.height}" aria-hidden="true" data-annotation-id="${escapeAttribute(item.id)}" data-debug-kind="candidate" data-candidate-index="${index}" data-candidate-side="${candidate.side}" data-candidate-score="${round(candidate.score)}" />`;
}

function renderConnectorSvg(item: ResolvedAnnotation, prefix: string, markerPrefix: string): string {
  if (!item.connector.d || item.annotation.connector?.type === 'none') {
    return '';
  }

  const end = item.annotation.connector?.end ?? 'none';
  const marker = end === 'none' ? '' : ` marker-end="url(#${escapeAttribute(markerId(markerPrefix, end))})"`;
  const className = classNames(`${prefix}__connector`, item.annotation.connector?.className);

  return `<path class="${escapeAttribute(className)}" d="${escapeAttribute(item.connector.d)}" data-annotation-id="${escapeAttribute(item.id)}" data-connector-type="${item.connector.type}"${marker}${dataAttributes(item.annotation.connector?.data)} aria-hidden="true" />`;
}

function renderSubjectSvg(item: ResolvedAnnotation, prefix: string): string {
  const subject = item.subject;
  const options = item.annotation.subject;
  const shape = options?.shape ?? 'auto';

  if (shape === 'none') {
    return '';
  }

  const badge = renderBadgeSubjectSvg(item, prefix);

  if (badge) {
    return badge;
  }

  const className = classNames(
    `${prefix}__subject`,
    `${prefix}__subject--${subject.type}`,
    options?.path ? `${prefix}__subject--path` : undefined,
    options?.className
  );

  if (options?.geometry) {
    return renderGeometrySubject(
      subject.point,
      options,
      prefix,
      classNames(className, `${prefix}__subject--geometry-${options.geometry.type}`)
    );
  }

  if (options?.path) {
    return `<path class="${escapeAttribute(className)}" d="${escapeAttribute(options.path)}"${dataAttributes(options.data)} aria-hidden="true" />`;
  }

  if (shape === 'circle') {
    return renderCircleSubject(subject.box, subject.point, options, className);
  }

  if (shape === 'rect') {
    return renderRectSubject(subject.box, options, className);
  }

  if (shape === 'point') {
    return `<circle class="${escapeAttribute(className)}" cx="${subject.point.x}" cy="${subject.point.y}" r="${options?.radius ?? 4}"${dataAttributes(options?.data)} aria-hidden="true" />`;
  }

  if (shape === 'path' && subject.type === 'path') {
    return `<polyline class="${escapeAttribute(className)}" points="${subject.points.map((point) => `${point.x},${point.y}`).join(' ')}"${dataAttributes(options?.data)} aria-hidden="true" />`;
  }

  switch (subject.type) {
    case 'point':
      return `<circle class="${escapeAttribute(className)}" cx="${subject.point.x}" cy="${subject.point.y}" r="${options?.radius ?? 4}"${dataAttributes(options?.data)} aria-hidden="true" />`;
    case 'box':
      return renderRectSubject(subject.box, options, className);
    case 'path':
      return `<polyline class="${escapeAttribute(className)}" points="${subject.points.map((point) => `${point.x},${point.y}`).join(' ')}"${dataAttributes(options?.data)} aria-hidden="true" />`;
  }
}

function renderGeometrySubject(
  point: { x: number; y: number },
  options: AnnotationSubjectOptions,
  prefix: string,
  className: string
): string {
  const d = subjectPath(options.geometry as AnnotationPartsSubject);
  const transform = options.geometrySpace === 'absolute'
    ? ''
    : ` transform="translate(${point.x} ${point.y})"`;

  return `<path class="${escapeAttribute(`${className} ${prefix}__subject--geometry`)}" d="${escapeAttribute(d)}"${transform}${dataAttributes(options.data)} aria-hidden="true" />`;
}

function renderBadgeSubjectSvg(item: ResolvedAnnotation, prefix: string): string {
  const badge = normalizeBadge(item.annotation.subject?.badge);

  if (!badge) {
    return '';
  }

  const radius = badge.radius ?? item.annotation.subject?.radius ?? 12;
  const label = badge.label ?? item.annotation.note.title ?? item.id;
  const className = classNames(`${prefix}__badge`, badge.className);
  const geometry = badgeGeometry(item.subject.point, radius, badge.x, badge.y);
  const data = {
    ...(item.annotation.subject?.data ?? {}),
    ...(badge.data ?? {}),
    ...(badge.x ? { badgeX: badge.x } : {}),
    ...(badge.y ? { badgeY: badge.y } : {})
  };
  const pointer = geometry.pointerD
    ? `<path class="${escapeAttribute(`${prefix}__badge-pointer`)}" d="${escapeAttribute(geometry.pointerD)}"${dataAttributes(data)} />`
    : '';

  return [
    `<g class="${escapeAttribute(`${prefix}__badge-wrap`)}" aria-hidden="true">`,
    pointer,
    `<circle class="${escapeAttribute(className)}" cx="${geometry.center.x}" cy="${geometry.center.y}" r="${radius}"${dataAttributes(data)} />`,
    `<text class="${escapeAttribute(`${prefix}__badge-label ${prefix}__title`)}" x="${geometry.center.x}" y="${geometry.center.y}" text-anchor="middle" dominant-baseline="central">${escapeText(label)}</text>`,
    '</g>'
  ].join('');
}

function badgeGeometry(
  anchor: Point,
  radius: number,
  x: AnnotationBadgeOptions['x'] | undefined,
  y: AnnotationBadgeOptions['y'] | undefined
): { center: Point; pointerD?: string } {
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

function renderCircleSubject(
  box: Box,
  point: { x: number; y: number },
  options: AnnotationSubjectOptions | undefined,
  className: string
): string {
  const center = box.width === 0 && box.height === 0 ? point : boxCenter(box);
  const padding = maxPadding(options?.padding);
  const radius = options?.radius ?? Math.max(4, Math.max(box.width, box.height) / 2 + padding);

  return `<circle class="${escapeAttribute(className)}" cx="${center.x}" cy="${center.y}" r="${radius}"${dataAttributes(options?.data)} aria-hidden="true" />`;
}

function renderRectSubject(
  box: Box,
  options: AnnotationSubjectOptions | undefined,
  className: string
): string {
  const expanded = expandBox(box, options?.padding ?? 0);

  return `<rect class="${escapeAttribute(className)}" x="${expanded.x}" y="${expanded.y}" width="${expanded.width}" height="${expanded.height}" rx="${options?.cornerRadius ?? 4}"${dataAttributes(options?.data)} aria-hidden="true" />`;
}

function renderMarkerDefs(layout: ResolvedLayout, prefix: string, markerPrefix: string): string {
  const ends = new Set(layout.annotations.map((item) => item.annotation.connector?.end ?? 'none'));
  const defs: string[] = [];

  if (ends.has('arrow')) {
    defs.push(`<marker id="${escapeAttribute(markerId(markerPrefix, 'arrow'))}" class="${escapeAttribute(`${prefix}__marker ${prefix}__marker--arrow`)}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>`);
  }

  if (ends.has('dot')) {
    defs.push(`<marker id="${escapeAttribute(markerId(markerPrefix, 'dot'))}" class="${escapeAttribute(`${prefix}__marker ${prefix}__marker--dot`)}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6"><circle cx="5" cy="5" r="3" /></marker>`);
  }

  return defs.length > 0 ? `<defs>${defs.join('')}</defs>` : '';
}

function escapeText(value: string): string {
  return escapeCharacters(value, /[&<>]/g, TEXT_ESCAPES);
}

function escapeAttribute(value: string): string {
  return escapeCharacters(value, /[&<>"]/g, ATTRIBUTE_ESCAPES);
}

function escapeCharacters(value: string, pattern: RegExp, escapes: Record<string, string>): string {
  return value.replace(pattern, (character) => escapes[character] ?? character);
}

function dataAttributes(data: DataAttributes | undefined): string {
  if (!data) {
    return '';
  }

  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => ` data-${dataKey(key)}="${escapeAttribute(String(value))}"`)
    .join('');
}

function styleAttribute(style: AnnotationStyle | undefined): string {
  const variables = annotationStyleVariables(style);
  const text = Object.entries(variables)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('; ');

  return text ? ` style="${escapeAttribute(text)}"` : '';
}

function tabIndexAttribute(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '' : ` tabindex="${Math.trunc(value)}"`;
}

function dataKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .toLowerCase();
}

function notePadding(note: AnnotationNote): Padding {
  if (note.padding === undefined) {
    return DEFAULT_NOTE_PADDING;
  }

  const padding = resolvePadding(note.padding);

  return {
    top: padding.top,
    right: padding.right,
    bottom: padding.bottom,
    left: padding.left
  };
}

function noteTextAlign(
  align: NonNullable<AnnotationNote['align']>,
  width: number,
  padding: Padding
): { x: number; anchor: 'start' | 'middle' | 'end' } {
  if (align === 'center') {
    return { x: width / 2, anchor: 'middle' };
  }

  if (align === 'end') {
    return { x: width - padding.right, anchor: 'end' };
  }

  return { x: padding.left, anchor: 'start' };
}

function normalizeNoteLine(line: AnnotationNote['line']): AnnotationNoteLineOptions | undefined {
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

function maxPadding(padding: AnnotationSubjectOptions['padding']): number {
  const resolved = resolvePadding(padding ?? 0);

  return Math.max(resolved.top, resolved.right, resolved.bottom, resolved.left);
}

function markerId(prefix: string, end: string): string {
  return `${prefix.replace(/[^a-zA-Z0-9_-]+/g, '-')}-marker-${end}`;
}

function classNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
