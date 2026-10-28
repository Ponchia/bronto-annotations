import { overlapArea } from './anchors.js';
import { compareAnnotationIds } from './layout-order.js';
import type { Box, Point, Size } from './model.js';

/** @experimental Screen-space controls or direct labels; the host supplies dimensions. */
export type AnnotationPinInput = {
  id: string;
  anchor: Point;
  size: Size;
  priority?: number;
};
/** @experimental Pin placement does not own selection, clipping policy or a reader. */
export type AnnotationPinLayoutOptions = {
  pins: readonly AnnotationPinInput[];
  bounds: Box;
  obstacles?: readonly Box[];
  gap?: number;
  /** Maximum movement along either axis. Zero only admits the anchored position. */
  maxDisplacement?: number;
  maxVisible?: number;
};
/** @experimental Points are centres, matching the React AnnotationPin contract. */
export type AnnotationPinLayout = {
  pins: Array<{ id: string; point: Point; anchor: Point; box: Box }>;
  omitted: Array<{ id: string; reason: 'outside' | 'collision' | 'limit' }>;
};

/** @experimental Bounded deterministic 2D placement. A rejected anchor is never
 * clamped to a viewport edge: it stays omitted and discoverable in the host's
 * reader. Input order is preserved in the output, priority then id owns space.
 * The host can use returned anchor/point pairs to draw displacement leaders. */
export function layoutAnnotationPins(options: AnnotationPinLayoutOptions): AnnotationPinLayout {
  const { pins, bounds, obstacles = [] } = options;
  const gap = nonnegative(options.gap ?? 4, 'gap');
  const displacement = nonnegative(options.maxDisplacement ?? 48, 'maxDisplacement');
  const max = options.maxVisible ?? pins.length;
  if (!Number.isSafeInteger(max) || max < 0) throw new TypeError('maxVisible must be a nonnegative safe integer');
  validBox(bounds, 'bounds');
  obstacles.forEach((box) => validBox(box, 'obstacle'));
  const ids = new Set<string>();
  for (const pin of pins) {
    if (typeof pin.id !== 'string' || ids.has(pin.id)) throw new TypeError('Pin ids must be unique strings');
    ids.add(pin.id);
    if (![pin.anchor.x, pin.anchor.y, pin.priority ?? 0].every(Number.isFinite)) {
      throw new TypeError('Pin anchors and priorities must be finite');
    }
    nonnegative(pin.size.width, 'pin width');
    nonnegative(pin.size.height, 'pin height');
  }
  const placed = new Map<string, AnnotationPinLayout['pins'][number]>();
  const omitted = new Map<string, AnnotationPinLayout['omitted'][number]>();
  const occupied: Box[] = [...obstacles];
  const ordered = [...pins].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || compareAnnotationIds(a.id, b.id));
  for (const pin of ordered) {
    const reject = (reason: AnnotationPinLayout['omitted'][number]['reason']) => omitted.set(pin.id, { id: pin.id, reason });
    if (pin.anchor.x < bounds.x || pin.anchor.x > bounds.x + bounds.width
      || pin.anchor.y < bounds.y || pin.anchor.y > bounds.y + bounds.height
      || pin.size.width > bounds.width || pin.size.height > bounds.height) {
      reject('outside');
      continue;
    }
    if (placed.size >= max) { reject('limit'); continue; }
    // At most 17 probes. Nearby candidates precede the outer ring; fixed order
    // resolves distance ties. No animation, observer or async manager is owned here.
    const offsets: Point[] = [{ x: 0, y: 0 }];
    for (const distance of displacement > 0 ? [displacement / 2, displacement] : []) {
      offsets.push({ x: 0, y: -distance }, { x: distance, y: 0 },
        { x: 0, y: distance }, { x: -distance, y: 0 },
        { x: distance, y: -distance }, { x: distance, y: distance },
        { x: -distance, y: distance }, { x: -distance, y: -distance });
    }
    let fitsBounds = false;
    for (const offset of offsets) {
      const point = { x: pin.anchor.x + offset.x, y: pin.anchor.y + offset.y };
      const box = { x: point.x - pin.size.width / 2, y: point.y - pin.size.height / 2, ...pin.size };
      if (![box.x, box.y, box.x + box.width, box.y + box.height].every(Number.isFinite)) continue;
      if (box.x < bounds.x || box.y < bounds.y || box.x + box.width > bounds.x + bounds.width
        || box.y + box.height > bounds.y + bounds.height) continue;
      fitsBounds = true;
      const clearance = { x: box.x - gap, y: box.y - gap, width: box.width + gap * 2, height: box.height + gap * 2 };
      if (occupied.some((other) => overlapArea(clearance, other) > 0)) continue;
      placed.set(pin.id, { id: pin.id, point, anchor: { ...pin.anchor }, box });
      occupied.push(box);
      break;
    }
    if (!placed.has(pin.id)) reject(fitsBounds ? 'collision' : 'outside');
  }
  return {
    pins: pins.flatMap((pin) => { const result = placed.get(pin.id); return result ? [result] : []; }),
    omitted: pins.flatMap((pin) => { const result = omitted.get(pin.id); return result ? [result] : []; })
  };
}

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be finite and nonnegative`);
  return value;
}
function validBox(box: Box, name: string): void {
  nonnegative(box.width, `${name} width`);
  nonnegative(box.height, `${name} height`);
  if (![box.x, box.y, box.x + box.width, box.y + box.height].every(Number.isFinite)) {
    throw new TypeError(`${name} endpoints must be finite`);
  }
}
