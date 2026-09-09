import type { Box } from '../core/model.js';

export type RangeAnchorOptions = {
  /** Omit for viewport pixels; an HTML element requests its local padding space. */
  coordinateSpace?: HTMLElement;
  maxRects?: number;
};
export type RangeAnchorMeasurement = {
  status: 'resolved' | 'empty' | 'unsupported';
  rects: Box[];
  box?: Box;
  truncated: boolean;
  reason?: string;
};

/** Ephemeral geometry only. The host owns the quotation and durable target. */
export function measureRangeAnchor(range: Range, options: RangeAnchorOptions = {}): RangeAnchorMeasurement {
  if (range.collapsed) return { status: 'empty', rects: [], truncated: false };
  const max = options.maxRects ?? 512;
  if (!Number.isSafeInteger(max) || max < 1 || max > 4096) throw new RangeError('maxRects must be an integer from 1 to 4096');
  const space = options.coordinateSpace;
  if (space && (!space.contains(range.startContainer) || !space.contains(range.endContainer))) {
    return { status: 'unsupported', rects: [], truncated: false, reason: 'The selection is outside the requested coordinate space' };
  }
  const transform = space ? localTransform(space) : { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  if (!transform) return { status: 'unsupported', rects: [], truncated: false, reason: 'Local range geometry requires visible, axis-aligned translation and scale' };
  const rects: Box[] = [];
  let truncated = false;
  const clientRects = range.getClientRects();
  for (let index = 0; index < clientRects.length; index++) {
    const rect = clientRects[index];
    if (!rect) continue;
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) continue;
    const box = {
      x: (rect.left - transform.x) / transform.scaleX,
      y: (rect.top - transform.y) / transform.scaleY,
      width: rect.width / transform.scaleX,
      height: rect.height / transform.scaleY
    };
    // DOM Range can repeat an element box and its sole text box. Do not draw
    // the same highlight twice, but retain distinct wrapping/formatting runs.
    if (rects.some((prior) => sameBox(prior, box))) continue;
    if (rects.length === max) { truncated = true; break; }
    rects.push(box);
  }
  if (!rects.length) return { status: 'empty', rects: [], truncated };
  const x = Math.min(...rects.map((rect) => rect.x));
  const y = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { status: 'resolved', rects, box: { x, y, width: right - x, height: bottom - y }, truncated };
}

function sameBox(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.width - b.width) < 0.01 && Math.abs(a.height - b.height) < 0.01;
}
function localTransform(space: HTMLElement) {
  const win = space.ownerDocument.defaultView;
  if (!win) return undefined;
  for (let ancestor: Element | null = space; ancestor; ancestor = ancestor.parentElement) {
    const value = win.getComputedStyle(ancestor).transform;
    if (value === 'none' || !value) continue;
    if (!win.DOMMatrixReadOnly) return undefined;
    const matrix = new win.DOMMatrixReadOnly(value);
    if (!matrix.is2D || Math.abs(matrix.b) > 0.0001 || Math.abs(matrix.c) > 0.0001 || matrix.a <= 0 || matrix.d <= 0) return undefined;
  }
  const bounds = space.getBoundingClientRect();
  if (!space.offsetWidth || !space.offsetHeight || !bounds.width || !bounds.height) return undefined;
  const scaleX = bounds.width / space.offsetWidth, scaleY = bounds.height / space.offsetHeight;
  return {
    x: bounds.left + (space.clientLeft - space.scrollLeft) * scaleX,
    y: bounds.top + (space.clientTop - space.scrollTop) * scaleY,
    scaleX, scaleY
  };
}
