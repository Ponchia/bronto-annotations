import type {
  Anchor,
  Box,
  Padding,
  PaddingInput,
  PlacementSide,
  Point,
  ResolvedSubject
} from './model.js';

export function normalizeBox(box: Box): Box {
  const x = box.width < 0 ? box.x + box.width : box.x;
  const y = box.height < 0 ? box.y + box.height : box.y;

  return {
    x,
    y,
    width: Math.abs(box.width),
    height: Math.abs(box.height)
  };
}

export function resolvePadding(padding: PaddingInput = 0): Padding {
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding
    };
  }

  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0
  };
}

export function insetBox(box: Box, padding: PaddingInput = 0): Box {
  const resolved = resolvePadding(padding);
  const width = Math.max(0, box.width - resolved.left - resolved.right);
  const height = Math.max(0, box.height - resolved.top - resolved.bottom);

  return {
    x: box.x + resolved.left,
    y: box.y + resolved.top,
    width,
    height
  };
}

export function expandBox(box: Box, padding: PaddingInput = 0): Box {
  const resolved = resolvePadding(padding);

  return {
    x: box.x - resolved.left,
    y: box.y - resolved.top,
    width: box.width + resolved.left + resolved.right,
    height: box.height + resolved.top + resolved.bottom
  };
}

export function isFiniteBox(box: Box): boolean {
  return Number.isFinite(box.x)
    && Number.isFinite(box.y)
    && Number.isFinite(box.width)
    && Number.isFinite(box.height)
    && box.width >= 0
    && box.height >= 0;
}

export function boxForPoint(point: Point): Box {
  return { x: point.x, y: point.y, width: 0, height: 0 };
}

export function boxCenter(box: Box): Point {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
}

export function boxSidePoint(box: Box, side: PlacementSide): Point {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y };
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height / 2 };
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 };
  }
}

export function boxFromPoints(points: Point[]): Box {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0]?.x ?? 0;
  let maxX = minX;
  let minY = points[0]?.y ?? 0;
  let maxY = minY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function boxUnion(boxes: Box[]): Box {
  if (boxes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const points = boxes.flatMap((box) => [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y + box.height }
  ]);

  return boxFromPoints(points);
}

export function anchorSubject(anchor: Anchor, preferredSide?: PlacementSide): ResolvedSubject {
  switch (anchor.type) {
    case 'point':
      return {
        type: 'point',
        point: anchor.point,
        box: boxForPoint(anchor.point)
      };
    case 'box': {
      const box = normalizeBox(anchor.box);
      const side = anchor.side ?? preferredSide;

      return {
        type: 'box',
        point: side ? boxSidePoint(box, side) : boxCenter(box),
        box,
        ...(side ? { side } : {})
      };
    }
    case 'path': {
      const box = boxFromPoints(anchor.points);

      return {
        type: 'path',
        point: midpointOnPath(anchor.points) ?? boxCenter(box),
        box,
        points: anchor.points
      };
    }
  }
}

export function anchorPoint(anchor: Anchor, preferredSide?: PlacementSide): Point {
  return anchorSubject(anchor, preferredSide).point;
}

export function overlapArea(a: Box, b: Box): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const width = right - left;
  const height = bottom - top;

  return width > 0 && height > 0 ? width * height : 0;
}

function midpointOnPath(points: Point[]): Point | undefined {
  if (points.length === 0) {
    return undefined;
  }

  if (points.length === 1) {
    return points[0];
  }

  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalLength += distance(points[index - 1]!, points[index]!);
  }

  const target = totalLength / 2;
  let walked = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;
    const segmentLength = distance(start, end);

    if (walked + segmentLength >= target) {
      const ratio = segmentLength === 0 ? 0 : (target - walked) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      };
    }

    walked += segmentLength;
  }

  return points.at(-1);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
