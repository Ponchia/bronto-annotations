import type { Box, Point } from './model.js';

/**
 * Internal segment/rectangle collision primitive shared by the layout scorer,
 * connector routing and quality report. The bounding-box check is essential:
 * orientation tests alone treat disjoint *collinear* segments as collisions.
 * Boundary contact deliberately counts as an intersection.
 */
export function segmentIntersectsBox(start: Point, end: Point, box: Box): boolean {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  if (maxX < box.x || minX > right || maxY < box.y || minY > bottom) {
    return false;
  }

  // Axis-aligned segments need only overlap on both axes once their extents
  // are bounded, including zero-length segments that touch the rectangle.
  if (start.x === end.x || start.y === end.y) {
    return true;
  }

  if (pointInsideBox(start, box) || pointInsideBox(end, box)) {
    return true;
  }

  const topLeft = { x: box.x, y: box.y };
  const topRight = { x: right, y: box.y };
  const bottomRight = { x: right, y: bottom };
  const bottomLeft = { x: box.x, y: bottom };
  return segmentsIntersect(start, end, topLeft, topRight)
    || segmentsIntersect(start, end, topRight, bottomRight)
    || segmentsIntersect(start, end, bottomRight, bottomLeft)
    || segmentsIntersect(start, end, bottomLeft, topLeft);
}

function pointInsideBox(point: Point, box: Box): boolean {
  return point.x >= box.x && point.x <= box.x + box.width
    && point.y >= box.y && point.y <= box.y + box.height;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD <= 0 && cdA * cdB <= 0;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}
