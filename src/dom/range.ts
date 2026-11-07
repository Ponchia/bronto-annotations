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
    if (![box.x, box.y, box.width, box.height, box.x + box.width, box.y + box.height].every(Number.isFinite)) {
      return { status: 'unsupported', rects: [], truncated: false, reason: 'Range geometry exceeded finite coordinate limits' };
    }
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
  if (!Number.isFinite(right - x) || !Number.isFinite(bottom - y)) {
    return { status: 'unsupported', rects: [], truncated: false, reason: 'Range geometry exceeded finite coordinate limits' };
  }
  return { status: 'resolved', rects, box: { x, y, width: right - x, height: bottom - y }, truncated };
}

function sameBox(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.width - b.width) < 0.01 && Math.abs(a.height - b.height) < 0.01;
}
// Computed `transform` does not include the independent translate/rotate/scale
// properties or motion paths. Reject unsupported composed geometry rather than
// pretending that its axis-aligned viewport bounds are an invertible transform.
function localTransform(space: HTMLElement) {
  const win = space.ownerDocument.defaultView;
  if (!win) return undefined;
  for (let ancestor: Element | null = space; ancestor; ancestor = composedParent(ancestor)) {
    const style = win.getComputedStyle(ancestor);
    if (!identityRotation(style.rotate) || !positiveScale2d(style.scale)
      || !translation2d(style.translate) || !none(style.offsetPath)) return undefined;
    const value = style.transform;
    if (none(value)) continue;
    if (!win.DOMMatrixReadOnly) return undefined;
    try {
      const matrix = new win.DOMMatrixReadOnly(value);
      if (!matrix.is2D || ![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)
        || Math.abs(matrix.b) > 0.0001 || Math.abs(matrix.c) > 0.0001 || matrix.a <= 0 || matrix.d <= 0) return undefined;
    } catch {
      return undefined;
    }
  }
  const bounds = space.getBoundingClientRect();
  if (![bounds.left, bounds.top, bounds.width, bounds.height, space.offsetWidth, space.offsetHeight].every(Number.isFinite)
    || space.offsetWidth <= 0 || space.offsetHeight <= 0 || bounds.width <= 0 || bounds.height <= 0) return undefined;
  const scaleX = bounds.width / space.offsetWidth, scaleY = bounds.height / space.offsetHeight;
  const x = bounds.left + (space.clientLeft - space.scrollLeft) * scaleX;
  const y = bounds.top + (space.clientTop - space.scrollTop) * scaleY;
  if (![x, y, scaleX, scaleY].every(Number.isFinite) || scaleX <= 0 || scaleY <= 0) return undefined;
  return { x, y, scaleX, scaleY };
}

function composedParent(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root.nodeType === 11 && 'host' in root ? (root as ShadowRoot).host : null;
}

function none(value: string): boolean { return !value || value === 'none'; }

// Keep whitespace inside computed calc()/min()/max() expressions together.
function components(value: string): string[] {
  const result: string[] = [];
  let depth = 0, start = 0;
  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (character === '(') depth++;
    else if (character === ')') depth--;
    if (depth < 0) return [];
    if (depth === 0 && /\s/.test(character!)) {
      if (index > start) result.push(value.slice(start, index));
      start = index + 1;
    }
  }
  if (depth !== 0) return [];
  if (start < value.length) result.push(value.slice(start));
  return result;
}

function identityRotation(value: string): boolean {
  if (none(value)) return true;
  const tokens = components(value);
  const angle = tokens[tokens.length - 1]?.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i);
  if (!angle) return false;
  const scale = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }[angle[2]!.toLowerCase()];
  const degrees = Number(angle[1]) * (scale ?? NaN);
  return Number.isFinite(degrees) && degrees % 360 === 0;
}

function positiveScale2d(value: string): boolean {
  if (none(value)) return true;
  const values = components(value).map(part => part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part));
  return values.length >= 1 && values.length <= 3 && values.every(Number.isFinite)
    && values[0]! > 0 && (values[1] ?? values[0]!) > 0 && (values[2] ?? 1) === 1;
}

function translation2d(value: string): boolean {
  if (none(value)) return true;
  const values = components(value);
  if (values.length === 1 || values.length === 2) return true;
  // Computed third-axis translations are absolute lengths; zero is 2D.
  return values.length === 3 && /^[+-]?(?:0+(?:\.0*)?|\.0+)(?:px)?$/i.test(values[2]!);
}
