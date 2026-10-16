import type { ConnectorPath, Point, ResolvedAnnotation } from './model.js';

/** @internal Polyline-only evidence, separate from geometric validity. */
export type ConnectorReadabilityReport = {
  /** Unordered connector pairs with a non-collinear interior intersection. */
  connectorCrossingPairs: number;
  /** Solver-coordinate length, not browser pixels or curved-path arc length. */
  totalConnectorLength: number;
  connectorBendCount: number;
  evaluatedConnectorCount: number;
  skippedCurveCount: number;
  invalidConnectorCount: number;
  /** False when curved or invalid routes were not measured. */
  complete: boolean;
};

type Route = {
  points: Point[];
  length: number;
  bends: number;
  bounds: { left: number; top: number; right: number; bottom: number };
};

function prepareRoute(connector: ConnectorPath): Route | undefined {
  if (connector.type === 'none' || connector.type === 'curve' || connector.points.length === 0) return undefined;
  if (!connector.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) return undefined;
  // Consecutive duplicate points do not create a bend or an intersection.
  const points = connector.points.filter((point, index, source) => index === 0
    || point.x !== source[index - 1]!.x || point.y !== source[index - 1]!.y);
  if (points.length === 0) return undefined;
  let length = 0;
  let bends = 0;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [index, point] of points.entries()) {
    left = Math.min(left, point.x); top = Math.min(top, point.y);
    right = Math.max(right, point.x); bottom = Math.max(bottom, point.y);
    if (index > 0) length += Math.hypot(point.x - points[index - 1]!.x, point.y - points[index - 1]!.y);
    if (index > 1) {
      const a = points[index - 2]!, b = points[index - 1]!;
      if (orientation(a, b, point) !== 0 || !withinSegment(b, a, point)) bends++;
    }
  }
  return Number.isFinite(length) ? { points, length, bends, bounds: { left, top, right, bottom } } : undefined;
}

// Every finite double is an exact integer multiple of 2^-1074. Use a
// fixed dyadic lattice only for uncertain determinants: normal scenes take the
// cheap floating-point/axis-aligned path. A common vector scale can erase a
// short perpendicular segment next to a long one and falsely report no crossing.
const doubleBits = new DataView(new ArrayBuffer(8));
function latticeInteger(value: number): bigint {
  doubleBits.setFloat64(0, value);
  const bits = doubleBits.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & 0xfffffffffffffn;
  const magnitude = exponent === 0 ? fraction : (fraction | (1n << 52n)) << BigInt(exponent - 1);
  return bits >> 63n ? -magnitude : magnitude;
}
function sign(value: number): number { return value > 0 ? 1 : value < 0 ? -1 : 0; }
function compare(a: number, b: number): number { return a > b ? 1 : a < b ? -1 : 0; }
function withinSegment(point: Point, a: Point, b: Point): boolean {
  return point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
    && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y);
}
function orientation(a: Point, b: Point, c: Point): number {
  if (a.x === b.x) return -compare(b.y, a.y) * compare(c.x, a.x);
  if (a.y === b.y) return compare(b.x, a.x) * compare(c.y, a.y);
  const left = (b.x - a.x) * (c.y - a.y);
  const right = (b.y - a.y) * (c.x - a.x);
  const determinant = left - right;
  const magnitude = Math.abs(left) + Math.abs(right);
  // Exclude subnormal/overflow arithmetic from the error-bound shortcut.
  if (Number.isFinite(magnitude) && magnitude >= 2 ** -1022
    && Math.abs(determinant) > magnitude * (4 * Number.EPSILON)) return sign(determinant);
  const ax = latticeInteger(a.x), ay = latticeInteger(a.y);
  const bx = latticeInteger(b.x), by = latticeInteger(b.y);
  const cx = latticeInteger(c.x), cy = latticeInteger(c.y);
  const exact = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  return exact > 0n ? 1 : exact < 0n ? -1 : 0;
}

function routesCross(first: Route | undefined, second: Route | undefined): boolean {
  if (!first || !second) return false;
  const a = first.bounds, b = second.bounds;
  if (a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom) return false;
  for (let i = 1; i < first.points.length; i++) {
    for (let j = 1; j < second.points.length; j++) {
      const start = first.points[i - 1]!, end = first.points[i]!;
      const otherStart = second.points[j - 1]!, otherEnd = second.points[j]!;
      if (Math.max(start.x, end.x) < Math.min(otherStart.x, otherEnd.x)
        || Math.min(start.x, end.x) > Math.max(otherStart.x, otherEnd.x)
        || Math.max(start.y, end.y) < Math.min(otherStart.y, otherEnd.y)
        || Math.min(start.y, end.y) > Math.max(otherStart.y, otherEnd.y)) continue;
      const a = orientation(start, end, otherStart);
      const b = orientation(start, end, otherEnd);
      const c = orientation(otherStart, otherEnd, start);
      const d = orientation(otherStart, otherEnd, end);
      // Fully collinear contact is deliberately outside the crossing metric.
      if ((a === 0 && b === 0 && c === 0 && d === 0) || a * b > 0 || c * d > 0) continue;
      // No division/interpolated intersection is needed. Global source/target
      // contacts are excluded; a shared internal elbow still counts once.
      const endpoints = [first.points[0]!, first.points.at(-1)!, second.points[0]!, second.points.at(-1)!];
      if (endpoints.some((point) => withinSegment(point, start, end)
        && withinSegment(point, otherStart, otherEnd)
        && orientation(start, end, point) === 0
        && orientation(otherStart, otherEnd, point) === 0)) continue;
      return true;
    }
  }
  return false;
}

export function connectorReadability(
  annotations: readonly ResolvedAnnotation[],
  onCrossing?: (first: string, second: string) => void
): ConnectorReadabilityReport {
  const routes = annotations.map((item) => prepareRoute(item.connector));
  let connectorCrossingPairs = 0;
  let totalConnectorLength = 0;
  let connectorBendCount = 0;
  let evaluatedConnectorCount = 0;
  let skippedCurveCount = 0;
  let invalidConnectorCount = 0;
  for (const [index, item] of annotations.entries()) {
    const route = routes[index];
    if (item.connector.type === 'none') continue;
    if (item.connector.type === 'curve') { skippedCurveCount++; continue; }
    if (!route) { invalidConnectorCount++; continue; }
    evaluatedConnectorCount++;
    totalConnectorLength += route.length;
    connectorBendCount += route.bends;
    for (let other = index + 1; other < routes.length; other++) {
      if (!routesCross(route, routes[other])) continue;
      connectorCrossingPairs++;
      onCrossing?.(item.id, annotations[other]!.id);
    }
  }
  return { connectorCrossingPairs, totalConnectorLength, connectorBendCount,
    evaluatedConnectorCount, skippedCurveCount, invalidConnectorCount,
    complete: skippedCurveCount === 0 && invalidConnectorCount === 0 && Number.isFinite(totalConnectorLength) };
}

export type ReadabilityScore = Pick<ConnectorReadabilityReport,
  'connectorCrossingPairs' | 'totalConnectorLength' | 'connectorBendCount'>;

/** Private workspace linear in routes and polyline points. Trials compare only one changed route; no
 * candidate graph or pair matrix is retained in a returned layout/session.
 */
export function createReadabilityWorkspace(annotations: readonly ResolvedAnnotation[]) {
  const routes = annotations.map((item) => prepareRoute(item.connector));
  const hits = new Array<number>(routes.length).fill(0);
  let totalPairs = 0;
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    if (routesCross(routes[i], routes[j])) { hits[i]!++; hits[j]!++; totalPairs++; }
  }
  const summarize = (index = -1, replacement?: Route, pairs = totalPairs): ReadabilityScore => {
    let totalConnectorLength = 0, connectorBendCount = 0;
    for (let i = 0; i < routes.length; i++) {
      const route = i === index ? replacement : routes[i];
      if (route) { totalConnectorLength += route.length; connectorBendCount += route.bends; }
    }
    return { connectorCrossingPairs: pairs, totalConnectorLength, connectorBendCount };
  };
  return {
    score: () => summarize(),
    canRefine: (index: number) => Boolean(routes[index]),
    replacement(index: number, connector: ConnectorPath): ReadabilityScore | undefined {
      const route = prepareRoute(connector);
      if (!route || !routes[index]) return undefined;
      let pairs = totalPairs - hits[index]!;
      for (let i = 0; i < routes.length; i++) if (i !== index && routesCross(route, routes[i])) pairs++;
      return summarize(index, route, pairs);
    },
    commit(index: number, connector: ConnectorPath): void {
      const route = prepareRoute(connector);
      let changedHits = 0;
      for (let i = 0; i < routes.length; i++) {
        if (i === index) continue;
        const before = Number(routesCross(routes[index], routes[i]));
        const after = Number(routesCross(route, routes[i]));
        hits[i]! += after - before;
        totalPairs += after - before;
        changedHits += after;
      }
      hits[index] = changedHits;
      routes[index] = route;
    }
  };
}

/** Crossings first, then proximity, then unnecessary bends. A small length
 * tolerance avoids treating floating-point roundoff as an editorial improvement.
 */
export function betterReadability(next: ReadabilityScore, current: ReadabilityScore): boolean {
  if (next.connectorCrossingPairs !== current.connectorCrossingPairs)
    return next.connectorCrossingPairs < current.connectorCrossingPairs;
  if (Math.abs(next.totalConnectorLength - current.totalConnectorLength) > 1e-6)
    return next.totalConnectorLength < current.totalConnectorLength;
  return next.connectorBendCount < current.connectorBendCount;
}
