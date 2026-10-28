import { isFiniteBox, overlapArea } from './anchors.js';
import { compareAnnotationIds } from './layout-order.js';
import type { Box, Point, Size } from './model.js';

/** @experimental A screen- or host-space hit target. All inputs share one space. */
export type AnnotationPinInput = {
  id: string;
  point: Point;
  size: Size;
  priority?: number;
};
/** @experimental The host supplies measured sizes, visible bounds and protected UI. */
export type AnnotationPinLayoutOptions = {
  bounds: Box;
  obstacles?: readonly Box[];
  gap?: number;
  limit?: number;
  /** Default zero: never displace a precise pin without an explicit host choice. */
  maxDisplacement?: number;
};
/** @experimental A displaced target includes a leader; render it or use zero displacement. */
export type AnnotationPinPlacement = {
  id: string;
  point: Point;
  box: Box;
  anchor: Point;
  leader?: { from: Point; to: Point };
};
/** @experimental Every input is accounted for, including impossible and capacity-limited targets. */
export type AnnotationPinLayout = {
  placements: AnnotationPinPlacement[];
  omitted: Array<{ id: string; reason: 'bounds' | 'collision' | 'limit' }>;
};

/** @experimental Deterministic bounded placement of small two-dimensional targets.
 * Selection priority and visibility belong to the host. This utility neither
 * changes source anchors nor owns threads, observers, clustering or persistence.
 */
export function layoutAnnotationPins(
  items: readonly AnnotationPinInput[],
  options: AnnotationPinLayoutOptions
): AnnotationPinLayout {
  validBox(options.bounds, 'bounds');
  const gap = dimension(options.gap ?? 4, 'gap');
  const distance = dimension(options.maxDisplacement ?? 0, 'maxDisplacement');
  const limit = options.limit ?? items.length;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('limit must be a nonnegative safe integer');
  const obstacles = options.obstacles ?? [];
  for (const obstacle of obstacles) validBox(obstacle, 'obstacle');
  const ids = new Set<string>();
  for (const item of items) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw new TypeError('Pin IDs must be nonempty and unique');
    ids.add(item.id);
    if (![item.point.x, item.point.y, item.priority ?? 0].every(Number.isFinite)) throw new TypeError('Pin points and priorities must be finite');
    if (dimension(item.size.width, 'width') === 0 || dimension(item.size.height, 'height') === 0)
      throw new RangeError('Pin sizes must be positive');
  }
  const ordered = items.map((item, index) => ({ item, index })).sort((a, b) =>
    (b.item.priority ?? 0) - (a.item.priority ?? 0) || compareAnnotationIds(a.item.id, b.item.id));
  const accepted: Array<{ index: number; value: AnnotationPinPlacement }> = [];
  const omitted: Array<{ index: number; value: AnnotationPinLayout['omitted'][number] }> = [];
  const bounds = options.bounds;
  for (const { item, index } of ordered) {
    const omit = (reason: AnnotationPinLayout['omitted'][number]['reason']) => omitted.push({ index, value: { id: item.id, reason } });
    // A target outside the visible surface is not a pin at its nearest edge.
    if (item.point.x < bounds.x || item.point.x > bounds.x + bounds.width
      || item.point.y < bounds.y || item.point.y > bounds.y + bounds.height
      || item.size.width > bounds.width || item.size.height > bounds.height) { omit('bounds'); continue; }
    if (accepted.length >= limit) { omit('limit'); continue; }
    let inBounds = false;
    let winner: { point: Point; box: Box } | undefined;
    for (const point of candidates(item, bounds, distance)) {
      const box = { x: point.x - item.size.width / 2, y: point.y - item.size.height / 2, ...item.size };
      if (box.x < bounds.x || box.y < bounds.y || box.x + box.width > bounds.x + bounds.width
        || box.y + box.height > bounds.y + bounds.height) continue;
      inBounds = true;
      if (obstacles.some((other) => overlaps(box, other, gap))
        || accepted.some((other) => overlaps(box, other.value.box, gap))) continue;
      winner = { point, box }; break;
    }
    if (!winner) { omit(inBounds ? 'collision' : 'bounds'); continue; }
    const anchor = { ...item.point };
    accepted.push({ index, value: {
      id: item.id, ...winner, anchor,
      ...(winner.point.x !== anchor.x || winner.point.y !== anchor.y
        ? { leader: { from: { ...anchor }, to: { ...winner.point } } } : {})
    } });
  }
  // Stable DOM order follows authored order; priority only decides admission.
  return {
    placements: accepted.sort((a, b) => a.index - b.index).map((entry) => entry.value),
    omitted: omitted.sort((a, b) => a.index - b.index).map((entry) => entry.value)
  };
}

function candidates(item: AnnotationPinInput, bounds: Box, distance: number): Point[] {
  const points: Point[] = [{ ...item.point }];
  if (distance > 0) {
    points.push({
      x: Math.min(Math.max(item.point.x, bounds.x + item.size.width / 2), bounds.x + bounds.width - item.size.width / 2),
      y: Math.min(Math.max(item.point.y, bounds.y + item.size.height / 2), bounds.y + bounds.height - item.size.height / 2)
    });
    for (const radius of [distance / 2, distance]) {
      for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]) {
        const scale = radius / Math.hypot(x!, y!);
        points.push({ x: item.point.x + x! * scale, y: item.point.y + y! * scale });
      }
    }
  }
  return points.filter((point) => Math.hypot(point.x - item.point.x, point.y - item.point.y) <= distance)
    .sort((a, b) => Math.hypot(a.x - item.point.x, a.y - item.point.y) - Math.hypot(b.x - item.point.x, b.y - item.point.y));
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return overlapArea(a, { x: b.x - gap, y: b.y - gap, width: b.width + gap * 2, height: b.height + gap * 2 }) > 0;
}
function dimension(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
  return value;
}
function validBox(box: Box, name: string): void {
  if (!isFiniteBox(box) || !Number.isFinite(box.x + box.width) || !Number.isFinite(box.y + box.height))
    throw new TypeError(`${name} must be a finite nonnegative box`);
}
