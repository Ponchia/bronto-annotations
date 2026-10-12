/**
 * Private, hook-free SVG geometry for a resolved annotation: subjects,
 * connectors, badges and per-note placement debug boxes. The main React
 * component still owns paint order, accessibility labels, note composition
 * and all host editing state. Preserve exact SVG subtree order.
 */
import { boxCenter, expandBox, resolvePadding } from '../core/anchors.js';
import { subjectPath } from '../core/annotation-geometry.js';
import type { AnnotationPartsSubject } from '../core/annotation-geometry.js';
import type {
  AnnotationBadgeOptions,
  AnnotationSubjectOptions,
  Box,
  Point,
  ResolvedAnnotation
} from '../core/model.js';
import { dataAttributes } from './render-data.js';
import { markerId } from './marker-defs.js';
import { round } from './edit-geometry.js';

type BadgeGeometry = {
  center: Point;
  pointerD?: string;
};

function normalizeBadge(badge: AnnotationSubjectOptions['badge']): AnnotationBadgeOptions | undefined {
  if (badge === undefined || badge === false) {
    return undefined;
  }

  return badge === true ? {} : badge;
}

export function renderSubject(item: ResolvedAnnotation, prefix: string) {
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

export function renderConnector(item: ResolvedAnnotation, prefix: string, markerPrefix: string) {
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

export function renderDebugBoxes(item: ResolvedAnnotation, prefix: string) {
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

function maxPadding(padding: AnnotationSubjectOptions['padding']): number {
  const resolved = resolvePadding(padding ?? 0);

  return Math.max(resolved.top, resolved.right, resolved.bottom, resolved.left);
}
