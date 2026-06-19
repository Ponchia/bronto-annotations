import type { Point } from './model.js';

export type AnnotationOffset = {
  dx: number;
  dy: number;
};

export type AnnotationConnectorShape = 'straight' | 'elbow' | 'curve';
export type AnnotationAlign = 'start' | 'middle' | 'end';
export type AnnotationValign = 'top' | 'middle' | 'bottom';
export type AxisOrientation = 'horizontal' | 'vertical';
export type TimelineDirection = 'up' | 'down' | 'left' | 'right';

export type CircleSubjectGeometry = {
  type: 'circle';
  radius: number;
  radiusPadding?: number;
};

export type RectSubjectGeometry = {
  type: 'rect';
  width: number;
  height: number;
  x?: number;
  y?: number;
  padding?: number;
};

export type ConnectorSubjectGeometry = CircleSubjectGeometry | RectSubjectGeometry;

export type ConnectorOffsetOptions = Partial<AnnotationOffset> & {
  subject?: ConnectorSubjectGeometry;
  mid?: number;
};

export type CircleSubjectPathOptions = {
  radius: number;
};

export type RectSubjectPathOptions = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  padding?: number;
};

export type ThresholdPathOptions = {
  x1?: number;
  y1?: number;
  x2: number;
  y2: number;
};

export type AxisThresholdPathOptions = {
  orientation?: AxisOrientation;
  value?: number;
  start?: number;
  end: number;
};

export type BracketSubjectPathOptions = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth?: number;
};

export type BandSubjectPathOptions = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  padding?: number;
};

export type SlopeSubjectPathOptions = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type ComparisonBracePathOptions = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth?: number;
};

export type OutlierClusterPathOptions = {
  points: Point[];
  radius?: number;
};

export type EncircleSubjectPathOptions = {
  points: Point[];
  radius?: number;
  padding?: number;
};

export type EnclosingCircle = Point & {
  radius: number;
};

export type TimelineEventPathOptions = {
  size?: number;
  direction?: TimelineDirection;
};

export type EvidenceMarkerPathOptions = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  padding?: number;
};

export type ConnectorEndDotOptions = Point & {
  radius?: number;
};

export type ConnectorEndArrowOptions = {
  x1?: number;
  y1?: number;
  x2: number;
  y2: number;
  size?: number;
  spread?: number;
};

export type NoteTransformOptions = {
  dx?: number;
  dy?: number;
  x?: number;
  y?: number;
  align?: AnnotationAlign;
  valign?: AnnotationValign;
  width?: number;
  height?: number;
};

export type AnnotationBounds = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

export type NotePlacementOptions = {
  x?: number;
  y?: number;
  width: number;
  height: number;
  bounds: AnnotationBounds;
  padding?: number;
  gap?: number;
  preferred?: 'right' | 'left' | 'top' | 'bottom';
  inset?: number;
};

export type NotePlacement = {
  dx: number;
  dy: number;
  align: AnnotationAlign;
  valign: AnnotationValign;
  transform: string;
};

export type AnnotationPartsSubject =
  | CircleSubjectGeometry
  | RectSubjectGeometry
  | ({ type: 'threshold' } & ThresholdPathOptions)
  | ({ type: 'bracket' } & BracketSubjectPathOptions)
  | ({ type: 'band' } & BandSubjectPathOptions)
  | ({ type: 'slope' } & SlopeSubjectPathOptions)
  | ({ type: 'compare' } & ComparisonBracePathOptions)
  | ({ type: 'cluster' } & OutlierClusterPathOptions)
  | ({ type: 'encircle' } & EncircleSubjectPathOptions)
  | ({ type: 'axis' } & AxisThresholdPathOptions)
  | ({ type: 'timeline' } & TimelineEventPathOptions)
  | ({ type: 'evidence' } & EvidenceMarkerPathOptions);

export type AnnotationPartsOptions = {
  type?: 'callout' | 'elbow' | 'curve';
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  subject?: AnnotationPartsSubject;
};

export type AnnotationParts = {
  transform: string;
  subject: string;
  connector: string;
  note: string;
};

export type DeclutterLabelItem = {
  pos: number;
  size: number;
};

export type DeclutterLabelsOptions = {
  gap?: number;
  min?: number;
  max?: number;
};

export type DirectLabelItem<TKey extends string | number = string | number> = {
  anchor: Point;
  size: number;
  key?: TKey;
};

export type DirectLabelsOptions = {
  axis?: 'x' | 'y';
  cross?: number;
  gap?: number;
  min?: number;
  max?: number;
  shape?: AnnotationConnectorShape;
};

export type DirectLabel<TKey extends string | number = string | number> = {
  x: number;
  y: number;
  anchor: Point;
  key?: TKey;
  d: string;
};

export function annotationTransform({ x = 0, y = 0 }: Partial<Point> = {}): string {
  return `translate(${fmt(finite('x', x))}, ${fmt(finite('y', y))})`;
}

export function noteTransform({
  dx,
  dy,
  x,
  y,
  align = 'start',
  valign = 'top',
  width = 0,
  height = 0
}: NoteTransformOptions = {}): string {
  let noteX = finite('dx', dx, x ?? 0);
  let noteY = finite('dy', dy, y ?? 0);
  const noteWidth = dimension('width', width);
  const noteHeight = dimension('height', height);

  if (align === 'middle') {
    noteX -= noteWidth / 2;
  } else if (align === 'end') {
    noteX -= noteWidth;
  } else if (align !== 'start') {
    throw new TypeError('align must be "start", "middle" or "end"');
  }

  if (valign === 'middle') {
    noteY -= noteHeight / 2;
  } else if (valign === 'bottom') {
    noteY -= noteHeight;
  } else if (valign !== 'top') {
    throw new TypeError('valign must be "top", "middle" or "bottom"');
  }

  return `translate(${fmt(noteX)}, ${fmt(noteY)})`;
}

export function notePlacement({
  x = 0,
  y = 0,
  width,
  height,
  bounds,
  padding = 8,
  gap = 32,
  preferred = 'right',
  inset = 0
}: NotePlacementOptions): NotePlacement {
  const anchorX = finite('x', x);
  const anchorY = finite('y', y);
  const noteWidth = dimension('width', width);
  const noteHeight = dimension('height', height);
  const paddingValue = dimension('padding', padding);
  const gapValue = dimension('gap', gap);
  const insetValue = dimension('inset', inset, 0);
  const boundsX = finite('bounds.x', bounds.x, 0);
  const boundsY = finite('bounds.y', bounds.y, 0);
  const boundsWidth = dimension('bounds.width', bounds.width);
  const boundsHeight = dimension('bounds.height', bounds.height);
  const minX = boundsX + paddingValue + insetValue;
  const minY = boundsY + paddingValue + insetValue;
  const maxX = boundsX + boundsWidth - paddingValue - insetValue;
  const maxY = boundsY + boundsHeight - paddingValue - insetValue;

  for (const side of placementOrder(preferred)) {
    const placement = candidatePlacement(side, gapValue);
    const rect = noteRect(anchorX, anchorY, noteWidth, noteHeight, placement);

    if (rect.left >= minX && rect.top >= minY && rect.right <= maxX && rect.bottom <= maxY) {
      return {
        dx: roundNumber(placement.dx),
        dy: roundNumber(placement.dy),
        align: placement.align,
        valign: placement.valign,
        transform: noteTransform({ ...placement, width: noteWidth, height: noteHeight })
      };
    }
  }

  const fallback = candidatePlacement(preferred, gapValue);
  const rect = noteRect(anchorX, anchorY, noteWidth, noteHeight, fallback);
  const left = clamp(rect.left, minX, maxX - noteWidth);
  const top = clamp(rect.top, minY, maxY - noteHeight);
  const dx = roundNumber(left - anchorX);
  const dy = roundNumber(top - anchorY);

  return {
    dx,
    dy,
    align: 'start',
    valign: 'top',
    transform: noteTransform({ dx, dy })
  };
}

export function circleSubjectPath({ radius }: CircleSubjectPathOptions): string {
  return circlePathAt(0, 0, radius);
}

export function rectSubjectPath({ width, height, x, y, padding = 0 }: RectSubjectPathOptions): string {
  const rectWidth = dimension('width', width);
  const rectHeight = dimension('height', height);
  const paddingValue = dimension('padding', padding);

  if (rectWidth === 0 || rectHeight === 0) {
    return '';
  }

  const left = finite('x', x, -rectWidth / 2) - paddingValue;
  const top = finite('y', y, -rectHeight / 2) - paddingValue;
  const right = left + rectWidth + paddingValue * 2;
  const bottom = top + rectHeight + paddingValue * 2;

  return rectPath(left, top, right, bottom);
}

export function thresholdPath({ x1 = 0, y1 = 0, x2, y2 }: ThresholdPathOptions): string {
  return linePath(
    { x: finite('x1', x1), y: finite('y1', y1) },
    { x: finite('x2', x2), y: finite('y2', y2) }
  );
}

export function axisThresholdPath({ orientation = 'horizontal', value = 0, start = 0, end }: AxisThresholdPathOptions): string {
  const thresholdValue = finite('value', value);
  const startValue = finite('start', start);
  const endValue = finite('end', end);

  if (orientation === 'horizontal') {
    return thresholdPath({ x1: startValue, y1: thresholdValue, x2: endValue, y2: thresholdValue });
  }

  if (orientation === 'vertical') {
    return thresholdPath({ x1: thresholdValue, y1: startValue, x2: thresholdValue, y2: endValue });
  }

  throw new TypeError('orientation must be "horizontal" or "vertical"');
}

export function bracketSubjectPath({ x1, y1, x2, y2, depth = 12 }: BracketSubjectPathOptions): string {
  const start = { x: finite('x1', x1), y: finite('y1', y1) };
  const end = { x: finite('x2', x2), y: finite('y2', y2) };
  const depthValue = finite('depth', depth);

  if (samePoint(start, end) || depthValue === 0) {
    return linePath(start, end);
  }

  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    return `M${point(start.x, start.y)}V${fmt(start.y + depthValue)}H${fmt(end.x)}V${fmt(end.y)}`;
  }

  return `M${point(start.x, start.y)}H${fmt(start.x + depthValue)}V${fmt(end.y)}H${fmt(end.x)}`;
}

export function bandSubjectPath({ x = 0, y = 0, width, height, padding = 0 }: BandSubjectPathOptions): string {
  return rectSubjectPath({ x, y, width, height, padding });
}

export function slopeSubjectPath({ x1, y1, x2, y2 }: SlopeSubjectPathOptions): string {
  return thresholdPath({ x1, y1, x2, y2 });
}

export function comparisonBracePath({ x1, y1, x2, y2, depth = 14 }: ComparisonBracePathOptions): string {
  const start = { x: finite('x1', x1), y: finite('y1', y1) };
  const end = { x: finite('x2', x2), y: finite('y2', y2) };
  const depthValue = finite('depth', depth);

  if (samePoint(start, end) || depthValue === 0) {
    return linePath(start, end);
  }

  if (Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)) {
    const y = start.y;
    const mid = (start.x + end.x) / 2;
    const quarter = (end.x - start.x) / 4;

    return `M${point(start.x, y)}C${point(start.x + quarter, y)} ${point(start.x + quarter, y + depthValue)} ${point(mid, y + depthValue)}C${point(mid, y + depthValue)} ${point(mid, y + depthValue * 2)} ${point(mid, y + depthValue * 2)}C${point(mid, y + depthValue)} ${point(end.x - quarter, y + depthValue)} ${point(end.x - quarter, y)}C${point(end.x - quarter, y)} ${point(end.x - quarter, y)} ${point(end.x, y)}`;
  }

  const x = start.x;
  const mid = (start.y + end.y) / 2;
  const quarter = (end.y - start.y) / 4;

  return `M${point(x, start.y)}C${point(x, start.y + quarter)} ${point(x + depthValue, start.y + quarter)} ${point(x + depthValue, mid)}C${point(x + depthValue, mid)} ${point(x + depthValue * 2, mid)} ${point(x + depthValue * 2, mid)}C${point(x + depthValue, mid)} ${point(x + depthValue, end.y - quarter)} ${point(x, end.y - quarter)}C${point(x, end.y - quarter)} ${point(x, end.y - quarter)} ${point(x, end.y)}`;
}

export function outlierClusterPath({ points, radius = 6 }: OutlierClusterPathOptions): string {
  if (!Array.isArray(points)) {
    throw new TypeError('points must be an array');
  }

  return points
    .map((clusterPoint, index) => circlePathAt(
      finite(`points[${index}].x`, clusterPoint?.x),
      finite(`points[${index}].y`, clusterPoint?.y),
      radius
    ))
    .filter(Boolean)
    .join('');
}

export function enclosingCircle(points: Point[]): EnclosingCircle {
  if (!Array.isArray(points)) {
    throw new TypeError('points must be an array');
  }

  const centers = points.map((clusterPoint, index) => ({
    x: finite(`points[${index}].x`, clusterPoint?.x),
    y: finite(`points[${index}].y`, clusterPoint?.y)
  }));

  if (centers.length === 0) {
    return { x: 0, y: 0, radius: 0 };
  }

  const circle = minimumEnclosingCircle(centers);

  return {
    x: circle.x,
    y: circle.y,
    radius: circle.r
  };
}

export function encircleSubjectPath({ points, radius = 0, padding = 6 }: EncircleSubjectPathOptions): string {
  const pointRadius = dimension('radius', radius);
  const paddingValue = dimension('padding', padding);
  const circle = enclosingCircle(points);

  if (circle.radius === 0 && points.length === 0) {
    return '';
  }

  return circlePathAt(circle.x, circle.y, circle.radius + pointRadius + paddingValue);
}

export function timelineEventPath({ size = 10, direction = 'down' }: TimelineEventPathOptions = {}): string {
  const sizeValue = dimension('size', size);

  if (sizeValue === 0) {
    return '';
  }

  switch (direction) {
    case 'down':
      return `M0,0L${point(sizeValue / 2, sizeValue)}H${fmt(-sizeValue / 2)}Z`;
    case 'up':
      return `M0,0L${point(sizeValue / 2, -sizeValue)}H${fmt(-sizeValue / 2)}Z`;
    case 'right':
      return `M0,0L${point(sizeValue, sizeValue / 2)}V${fmt(-sizeValue / 2)}Z`;
    case 'left':
      return `M0,0L${point(-sizeValue, sizeValue / 2)}V${fmt(-sizeValue / 2)}Z`;
  }
}

export function evidenceMarkerPath({ x = 0, y = 0, width = 36, height = 36, padding = 0 }: EvidenceMarkerPathOptions = {}): string {
  const markerWidth = dimension('width', width);
  const markerHeight = dimension('height', height);
  const paddingValue = dimension('padding', padding);

  if (markerWidth === 0 || markerHeight === 0) {
    return '';
  }

  const centerX = finite('x', x);
  const centerY = finite('y', y);
  const left = centerX - markerWidth / 2 - paddingValue;
  const top = centerY - markerHeight / 2 - paddingValue;
  const right = left + markerWidth + paddingValue * 2;
  const bottom = top + markerHeight + paddingValue * 2;

  return rectPath(left, top, right, bottom);
}

export function connectorEndDot({ x, y, radius = 3 }: ConnectorEndDotOptions): string {
  return circlePathAt(finite('x', x), finite('y', y), radius);
}

export function connectorEndArrow({ x1 = 0, y1 = 0, x2, y2, size = 8, spread = 0.32 }: ConnectorEndArrowOptions): string {
  const start = { x: finite('x1', x1), y: finite('y1', y1) };
  const end = { x: finite('x2', x2), y: finite('y2', y2) };
  const sizeValue = dimension('size', size);

  if (sizeValue === 0 || samePoint(start, end)) {
    return '';
  }

  return arrowHead(end, Math.atan2(end.y - start.y, end.x - start.x), sizeValue, spread);
}

export function connectorLine(options: ConnectorOffsetOptions = {}): string {
  const { dx, dy } = validateOffset(options);

  if (dx === 0 && dy === 0) {
    return '';
  }

  const start = connectorStart(dx, dy, options.subject);

  if (!start) {
    return '';
  }

  const end = { x: dx, y: dy };

  return samePoint(start, end) ? '' : linePath(start, end);
}

export function connectorElbow(options: ConnectorOffsetOptions = {}): string {
  const { dx, dy } = validateOffset(options);

  if (dx === 0 && dy === 0) {
    return '';
  }

  const start = connectorStart(dx, dy, options.subject);

  if (!start) {
    return '';
  }

  const end = { x: dx, y: dy };

  if (samePoint(start, end)) {
    return '';
  }

  return elbowPath(start, end, options.mid);
}

export function connectorCurve(options: ConnectorOffsetOptions = {}): string {
  const { dx, dy } = validateOffset(options);

  if (dx === 0 && dy === 0) {
    return '';
  }

  const start = connectorStart(dx, dy, options.subject);

  if (!start) {
    return '';
  }

  const end = { x: dx, y: dy };

  if (samePoint(start, end)) {
    return '';
  }

  return curveBetween(start, end, 0.35);
}

export function annotationParts(options: AnnotationPartsOptions = {}): AnnotationParts {
  const type = annotationConnectorType(options.type);
  const transform = annotationTransform({ x: options.x ?? 0, y: options.y ?? 0 });
  const dx = finite('dx', options.dx, 0);
  const dy = finite('dy', options.dy, 0);
  const connectorSubject = options.subject?.type === 'circle' || options.subject?.type === 'rect'
    ? options.subject
    : undefined;
  const connectorOptions: ConnectorOffsetOptions = connectorSubject
    ? { dx, dy, subject: connectorSubject }
    : { dx, dy };
  const connector = type === 'curve'
    ? connectorCurve(connectorOptions)
    : type === 'elbow'
      ? connectorElbow(connectorOptions)
      : connectorLine(connectorOptions);
  const note = noteTransform({ dx, dy });
  const subject = options.subject ? subjectPath(options.subject) : '';

  return { transform, subject, connector, note };
}

export function declutterLabels(items: DeclutterLabelItem[], options: DeclutterLabelsOptions = {}): number[] {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }

  const gap = dimension('gap', options.gap, 0);
  const min = options.min === undefined ? Number.NEGATIVE_INFINITY : finite('min', options.min);
  const max = options.max === undefined ? Number.POSITIVE_INFINITY : finite('max', options.max);

  if (max < min) {
    throw new RangeError('max must be greater than or equal to min');
  }

  const nodes = items.map((item, index) => ({
    index,
    half: dimension('size', item?.size) / 2,
    pos: finite('pos', item?.pos)
  }));
  const ordered = [...nodes].sort((a, b) => a.pos - b.pos);
  let floor = min;

  for (const node of ordered) {
    const center = Math.max(node.pos, floor + node.half);
    node.pos = center;
    floor = center + node.half + gap;
  }

  if (max !== Number.POSITIVE_INFINITY && ordered.length > 0) {
    const last = ordered[ordered.length - 1]!;
    const overflow = last.pos + last.half - max;

    if (overflow > 0) {
      for (const node of ordered) {
        node.pos -= overflow;
      }
    }
  }

  const result = new Array<number>(nodes.length);

  for (const node of nodes) {
    result[node.index] = roundNumber(node.pos);
  }

  return result;
}

export function directLabels<TKey extends string | number = string | number>(
  items: Array<DirectLabelItem<TKey>>,
  options: DirectLabelsOptions = {}
): Array<DirectLabel<TKey>> {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }

  const axis = directLabelAxis(options.axis);
  const cross = finite('cross', options.cross, 0);
  const shape = directLabelShape(options.shape);
  const anchors = items.map((item) => ({
    anchor: {
      x: finite('anchor.x', item?.anchor?.x),
      y: finite('anchor.y', item?.anchor?.y)
    },
    size: dimension('size', item?.size),
    key: item?.key
  }));
  const declutterOptions: DeclutterLabelsOptions = {};

  if (options.gap !== undefined) {
    declutterOptions.gap = options.gap;
  }

  if (options.min !== undefined) {
    declutterOptions.min = options.min;
  }

  if (options.max !== undefined) {
    declutterOptions.max = options.max;
  }

  const placed = declutterLabels(
    anchors.map((item) => ({ pos: item.anchor[axis], size: item.size })),
    declutterOptions
  );

  return anchors.map((item, index) => {
    const placedValue = placed[index] ?? 0;
    const labelPoint = axis === 'y'
      ? { x: cross, y: placedValue }
      : { x: placedValue, y: cross };
    const result = {
      x: roundNumber(labelPoint.x),
      y: roundNumber(labelPoint.y),
      anchor: {
        x: roundNumber(item.anchor.x),
        y: roundNumber(item.anchor.y)
      },
      d: samePoint(item.anchor, labelPoint) ? '' : connectorBetween(item.anchor, labelPoint, shape)
    };

    return item.key === undefined
      ? result
      : { ...result, key: item.key };
  });
}

export function subjectPath(subject: AnnotationPartsSubject): string {
  switch (subject.type) {
    case 'circle':
      return circleSubjectPath(subject);
    case 'rect':
      return rectSubjectPath(subject);
    case 'threshold':
      return thresholdPath(subject);
    case 'bracket':
      return bracketSubjectPath(subject);
    case 'band':
      return bandSubjectPath(subject);
    case 'slope':
      return slopeSubjectPath(subject);
    case 'compare':
      return comparisonBracePath(subject);
    case 'cluster':
      return outlierClusterPath(subject);
    case 'encircle':
      return encircleSubjectPath(subject);
    case 'axis':
      return axisThresholdPath(subject);
    case 'timeline':
      return timelineEventPath(subject);
    case 'evidence':
      return evidenceMarkerPath(subject);
  }
}

function validateOffset(options: ConnectorOffsetOptions): AnnotationOffset {
  return {
    dx: finite('dx', options.dx),
    dy: finite('dy', options.dy)
  };
}

function annotationConnectorType(value: AnnotationPartsOptions['type']): NonNullable<AnnotationPartsOptions['type']> {
  const type = value ?? 'callout';

  if (type === 'callout' || type === 'elbow' || type === 'curve') {
    return type;
  }

  throw new TypeError('type must be "callout", "elbow" or "curve"');
}

function directLabelAxis(value: DirectLabelsOptions['axis']): 'x' | 'y' {
  const axis = value ?? 'y';

  if (axis === 'x' || axis === 'y') {
    return axis;
  }

  throw new TypeError('axis must be "x" or "y"');
}

function directLabelShape(value: DirectLabelsOptions['shape']): AnnotationConnectorShape {
  const shape = value ?? 'straight';

  if (shape === 'straight' || shape === 'elbow' || shape === 'curve') {
    return shape;
  }

  throw new TypeError('shape must be "straight", "elbow" or "curve"');
}

function connectorStart(dx: number, dy: number, subject: ConnectorSubjectGeometry | undefined): Point | undefined {
  if (!subject) {
    return { x: 0, y: 0 };
  }

  if (subject.type === 'circle') {
    return trimForCircle(dx, dy, subject);
  }

  return trimForRect(dx, dy, subject);
}

function trimForCircle(dx: number, dy: number, subject: CircleSubjectGeometry): Point | undefined {
  const length = Math.hypot(dx, dy);
  const radius = dimension('subject.radius', subject.radius);
  const padding = dimension('subject.radiusPadding', subject.radiusPadding, 0);
  const trim = radius + padding;

  if (trim <= 0) {
    return { x: 0, y: 0 };
  }

  if (trim >= length) {
    return undefined;
  }

  return {
    x: (dx / length) * trim,
    y: (dy / length) * trim
  };
}

function trimForRect(dx: number, dy: number, subject: RectSubjectGeometry): Point | undefined {
  const width = dimension('subject.width', subject.width);
  const height = dimension('subject.height', subject.height);
  const padding = dimension('subject.padding', subject.padding, 0);
  const x = finite('subject.x', subject.x, -width / 2);
  const y = finite('subject.y', subject.y, -height / 2);
  const minX = x - padding;
  const minY = y - padding;
  const maxX = x + width + padding;
  const maxY = y + height + padding;
  const candidates: number[] = [];

  if (dx > 0) {
    candidates.push(maxX / dx);
  }

  if (dx < 0) {
    candidates.push(minX / dx);
  }

  if (dy > 0) {
    candidates.push(maxY / dy);
  }

  if (dy < 0) {
    candidates.push(minY / dy);
  }

  const ratio = Math.min(...candidates.filter((candidate) => Number.isFinite(candidate) && candidate > 0));

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { x: 0, y: 0 };
  }

  if (ratio >= 1) {
    return undefined;
  }

  return { x: dx * ratio, y: dy * ratio };
}

function candidatePlacement(side: 'right' | 'left' | 'top' | 'bottom', gap: number): Omit<NotePlacement, 'transform'> {
  switch (side) {
    case 'right':
      return { dx: gap, dy: 0, align: 'start', valign: 'middle' };
    case 'left':
      return { dx: -gap, dy: 0, align: 'end', valign: 'middle' };
    case 'top':
      return { dx: 0, dy: -gap, align: 'middle', valign: 'bottom' };
    case 'bottom':
      return { dx: 0, dy: gap, align: 'middle', valign: 'top' };
  }
}

function placementOrder(preferred: 'right' | 'left' | 'top' | 'bottom'): Array<'right' | 'left' | 'top' | 'bottom'> {
  switch (preferred) {
    case 'right':
      return ['right', 'top', 'bottom', 'left'];
    case 'left':
      return ['left', 'top', 'bottom', 'right'];
    case 'top':
      return ['top', 'right', 'left', 'bottom'];
    case 'bottom':
      return ['bottom', 'right', 'left', 'top'];
  }
}

function noteRect(
  x: number,
  y: number,
  width: number,
  height: number,
  placement: Omit<NotePlacement, 'transform'>
): { left: number; top: number; right: number; bottom: number } {
  const anchorX = x + placement.dx;
  const anchorY = y + placement.dy;
  let left = anchorX;
  let top = anchorY;

  if (placement.align === 'middle') {
    left -= width / 2;
  } else if (placement.align === 'end') {
    left -= width;
  }

  if (placement.valign === 'middle') {
    top -= height / 2;
  } else if (placement.valign === 'bottom') {
    top -= height;
  }

  return {
    left,
    top,
    right: left + width,
    bottom: top + height
  };
}

function connectorBetween(start: Point, end: Point, shape: AnnotationConnectorShape): string {
  switch (shape) {
    case 'straight':
      return linePath(start, end);
    case 'elbow':
      return elbowPath(start, end);
    case 'curve':
      return curveBetween(start, end, 0.5);
  }
}

function linePath(start: Point, end: Point): string {
  return samePoint(start, end) ? '' : `M${point(start.x, start.y)}L${point(end.x, end.y)}`;
}

function elbowPath(start: Point, end: Point, mid = 0.5): string {
  const midpoint = clamp(finite('mid', mid, 0.5), 0, 1);
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  if (dx >= dy) {
    const x = start.x + (end.x - start.x) * midpoint;

    return `M${point(start.x, start.y)}H${fmt(x)}V${fmt(end.y)}H${fmt(end.x)}`;
  }

  const y = start.y + (end.y - start.y) * midpoint;

  return `M${point(start.x, start.y)}V${fmt(y)}H${fmt(end.x)}V${fmt(end.y)}`;
}

function curveBetween(start: Point, end: Point, curvature: number): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const controlA = { x: start.x + dx * curvature, y: start.y };
  const controlB = { x: end.x - dx * curvature, y: end.y };

  return `M${point(start.x, start.y)}C${point(controlA.x, controlA.y)} ${point(controlB.x, controlB.y)} ${point(end.x, end.y)}`;
}

function arrowHead(end: Point, angle: number, size: number, spread: number): string {
  const left = {
    x: end.x + Math.cos(angle + Math.PI - spread) * size,
    y: end.y + Math.sin(angle + Math.PI - spread) * size
  };
  const right = {
    x: end.x + Math.cos(angle + Math.PI + spread) * size,
    y: end.y + Math.sin(angle + Math.PI + spread) * size
  };

  return `M${point(end.x, end.y)}L${point(left.x, left.y)}L${point(right.x, right.y)}Z`;
}

type EnclosingCircleCandidate = Point & {
  r: number;
};

function minimumEnclosingCircle(points: Point[]): EnclosingCircleCandidate {
  let best: EnclosingCircleCandidate | undefined;

  for (const candidate of points.map((item) => ({ x: item.x, y: item.y, r: 0 }))) {
    best = smallerContainingCircle(best, candidate, points);
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      best = smallerContainingCircle(best, circleFromPair(points[i] as Point, points[j] as Point), points);
    }
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      for (let k = j + 1; k < points.length; k += 1) {
        const candidate = circleFromThree(points[i] as Point, points[j] as Point, points[k] as Point);

        if (candidate) {
          best = smallerContainingCircle(best, candidate, points);
        }
      }
    }
  }

  return best ?? { x: 0, y: 0, r: 0 };
}

function smallerContainingCircle(
  best: EnclosingCircleCandidate | undefined,
  candidate: EnclosingCircleCandidate,
  points: Point[]
): EnclosingCircleCandidate | undefined {
  if (best && candidate.r >= best.r) {
    return best;
  }

  return containsAllPoints(candidate, points) ? candidate : best;
}

function containsAllPoints(circle: EnclosingCircleCandidate, points: Point[]): boolean {
  return points.every((item) => distance(circle, item) <= circle.r + 1e-7);
}

function circleFromPair(a: Point, b: Point): EnclosingCircleCandidate {
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;

  return {
    x,
    y,
    r: distance({ x, y }, a)
  };
}

function circleFromThree(a: Point, b: Point, c: Point): EnclosingCircleCandidate | undefined {
  const denominator = 2 * (
    a.x * (b.y - c.y)
    + b.x * (c.y - a.y)
    + c.x * (a.y - b.y)
  );

  if (Math.abs(denominator) < 1e-9) {
    return undefined;
  }

  const aSquared = a.x * a.x + a.y * a.y;
  const bSquared = b.x * b.x + b.y * b.y;
  const cSquared = c.x * c.x + c.y * c.y;
  const x = (
    aSquared * (b.y - c.y)
    + bSquared * (c.y - a.y)
    + cSquared * (a.y - b.y)
  ) / denominator;
  const y = (
    aSquared * (c.x - b.x)
    + bSquared * (a.x - c.x)
    + cSquared * (b.x - a.x)
  ) / denominator;

  return {
    x,
    y,
    r: distance({ x, y }, a)
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function circlePathAt(x: number, y: number, radius: number): string {
  const radiusValue = dimension('radius', radius);

  if (radiusValue === 0) {
    return '';
  }

  return `M${point(x, y - radiusValue)}A${fmt(radiusValue)},${fmt(radiusValue)} 0 1 1 ${point(x, y + radiusValue)}A${fmt(radiusValue)},${fmt(radiusValue)} 0 1 1 ${point(x, y - radiusValue)}Z`;
}

function rectPath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${point(x1, y1)}H${fmt(x2)}V${fmt(y2)}H${fmt(x1)}Z`;
}

function samePoint(a: Point, b: Point): boolean {
  return fmt(a.x) === fmt(b.x) && fmt(a.y) === fmt(b.y);
}

function finite(name: string, value: number | undefined | null, fallback?: number): number {
  if (value === undefined || value === null) {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new TypeError(`${name} must be finite`);
  }

  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }

  return value;
}

function dimension(name: string, value: number | undefined | null, fallback?: number): number {
  const resolved = finite(name, value, fallback);

  if (resolved < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0`);
  }

  return resolved;
}

function point(x: number, y: number): string {
  return `${fmt(x)},${fmt(y)}`;
}

function fmt(value: number): string {
  const rounded = roundNumber(value);

  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
