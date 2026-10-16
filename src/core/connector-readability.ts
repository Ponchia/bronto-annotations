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
      const ax = b.x - a.x, ay = b.y - a.y, bx = point.x - b.x, by = point.y - b.y;
      const scale = Math.max(Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by));
      // Normalization avoids overflowing the cross/dot products of finite routes.
      if ((ax / scale) * (by / scale) !== (ay / scale) * (bx / scale)
        || (ax / scale) * (bx / scale) + (ay / scale) * (by / scale) < 0) bends++;
    }
  }
  return Number.isFinite(length) ? { points, length, bends, bounds: { left, top, right, bottom } } : undefined;
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
      const rx = end.x - start.x, ry = end.y - start.y;
      const sx = otherEnd.x - otherStart.x, sy = otherEnd.y - otherStart.y;
      const qx = otherStart.x - start.x, qy = otherStart.y - start.y;
      const scale = Math.max(Math.abs(rx), Math.abs(ry), Math.abs(sx), Math.abs(sy), Math.abs(qx), Math.abs(qy));
      const rX = rx / scale, rY = ry / scale, sX = sx / scale, sY = sy / scale;
      const qX = qx / scale, qY = qy / scale;
      const denominator = rX * sY - rY * sX;
      if (denominator === 0 || !Number.isFinite(denominator)) continue;
      const t = (qX * sY - qY * sX) / denominator;
      const u = (qX * rY - qY * rX) / denominator;
      if (!(t >= 0 && t <= 1 && u >= 0 && u <= 1)) continue;
      // Source/target contacts are not crossings. Internal elbow vertices are:
      // several segment hits still count as one unordered connector pair.
      if ((i === 1 && t === 0) || (i === first.points.length - 1 && t === 1)
        || (j === 1 && u === 0) || (j === second.points.length - 1 && u === 1)) continue;
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

/** Private O(n) retained workspace. Trials compare only one changed route; no
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
