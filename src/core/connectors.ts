import type {
  AnnotationConnectorOptions,
  Box,
  ConnectorPath,
  ConnectorRoutingOptions,
  ConnectorRoutingPreference,
  ConnectorType,
  Point
} from './model.js';

export type ConnectorRoutingContext = {
  obstacles?: Box[];
  bounds?: Box;
};

export function nearestPointOnBox(point: Point, box: Box): Point {
  const x = clamp(point.x, box.x, box.x + box.width);
  const y = clamp(point.y, box.y, box.y + box.height);

  const candidates: Point[] = [
    { x, y: box.y },
    { x: box.x + box.width, y },
    { x, y: box.y + box.height },
    { x: box.x, y }
  ];

  return candidates
    .map((candidate) => ({
      point: candidate,
      distance: Math.hypot(point.x - candidate.x, point.y - candidate.y)
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.point ?? { x, y };
}

export function connectorPath(
  anchorPoint: Point,
  noteBox: Box,
  options: AnnotationConnectorOptions = {},
  context: ConnectorRoutingContext = {}
): ConnectorPath {
  const type = options.type ?? 'elbow';

  if (type === 'none') {
    return {
      type,
      points: [],
      d: ''
    };
  }

  const notePoint = nearestPointOnBox(anchorPoint, noteBox);
  const endpoints = offsetConnectorEndpoints(anchorPoint, notePoint, options);
  const waypoints = connectorWaypoints(options, anchorPoint);
  const points = routedConnectorPoints(endpoints.start, endpoints.end, type, waypoints, options, context);

  return {
    type,
    points,
    d: type === 'curve' ? curvePathD(points) : polylinePathD(points)
  };
}

export function connectorPathD(
  anchorPoint: Point,
  noteBox: Box,
  options: AnnotationConnectorOptions = {},
  context: ConnectorRoutingContext = {}
): string {
  return connectorPath(anchorPoint, noteBox, options, context).d;
}

export function polylinePathD(points: Point[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${round(point.x)} ${round(point.y)}`)
    .join(' ');
}

function elbowPoints(start: Point, end: Point): Point[] {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  if (dx < 1 || dy < 1) {
    return [start, end];
  }

  const mid: Point = dx >= dy
    ? { x: start.x + (end.x - start.x) / 2, y: start.y }
    : { x: start.x, y: start.y + (end.y - start.y) / 2 };

  const turn: Point = dx >= dy
    ? { x: mid.x, y: end.y }
    : { x: end.x, y: mid.y };

  return [start, mid, turn, end];
}

function connectorPoints(start: Point, end: Point, type: ConnectorType, waypoints: Point[] = []): Point[] {
  if (waypoints.length > 0) {
    const routed = [start, ...waypoints, end];

    return type === 'elbow' ? elbowPointsThrough(routed) : routed;
  }

  switch (type) {
    case 'straight':
    case 'curve':
      return [start, end];
    case 'none':
      return [];
    case 'elbow':
      return elbowPoints(start, end);
  }
}

function routedConnectorPoints(
  start: Point,
  end: Point,
  type: ConnectorType,
  waypoints: Point[],
  options: AnnotationConnectorOptions,
  context: ConnectorRoutingContext
): Point[] {
  const base = connectorPoints(start, end, type, waypoints);
  const routing = resolveRoutingOptions(options.routing, context);

  if (
    routing.mode === 'none'
    || type === 'none'
    || type === 'curve'
    || waypoints.length > 0
    || !context.obstacles?.length
  ) {
    return base;
  }

  const obstacles = routingObstacles(start, end, context.obstacles, routing);

  if (obstacles.length === 0 || connectorObstacleHits(base, obstacles) === 0) {
    return base;
  }

  const routed = orthogonalRoute(start, end, obstacles, {
    ...(context.bounds ? { bounds: context.bounds } : {}),
    preference: routing.preference ?? 'shortest'
  });

  if (!routed) {
    return base;
  }

  const routedHits = connectorObstacleHits(routed, obstacles);
  const baseHits = connectorObstacleHits(base, obstacles);

  if (routedHits > baseHits) {
    return base;
  }

  if (routedHits === baseHits && routeScore(routed) >= routeScore(base)) {
    return base;
  }

  return routed;
}

function resolveRoutingOptions(
  value: AnnotationConnectorOptions['routing'],
  context: ConnectorRoutingContext
): Required<ConnectorRoutingOptions> {
  const fallbackMode = context.obstacles?.length ? 'orthogonal' : 'none';

  if (value === undefined) {
    return {
      mode: fallbackMode,
      padding: 6,
      maxObstacles: 32,
      preference: 'shortest'
    };
  }

  if (typeof value === 'string') {
    return {
      mode: value,
      padding: 6,
      maxObstacles: 32,
      preference: 'shortest'
    };
  }

  return {
    mode: value.mode ?? fallbackMode,
    padding: nonNegativeFinite(value.padding) || 6,
    maxObstacles: Math.max(0, Math.floor(nonNegativeFinite(value.maxObstacles) || 32)),
    preference: value.preference ?? 'shortest'
  };
}

function routingObstacles(
  start: Point,
  end: Point,
  obstacles: Box[],
  options: Required<ConnectorRoutingOptions>
): Box[] {
  return obstacles
    .filter((box) => isFiniteBox(box) && box.width > 0 && box.height > 0)
    .filter((box) => !pointInsideBox(start, box) && !pointInsideBox(end, box))
    .sort((a, b) => distanceToSegment(a, start, end) - distanceToSegment(b, start, end))
    .slice(0, options.maxObstacles)
    .map((box) => expandBox(box, options.padding));
}

function orthogonalRoute(
  start: Point,
  end: Point,
  obstacles: Box[],
  options: {
    bounds?: Box;
    preference: ConnectorRoutingPreference;
  }
): Point[] | undefined {
  const xValues = uniqueSorted([
    start.x,
    end.x,
    ...obstacles.flatMap((box) => [box.x - 1, box.x + box.width + 1])
  ]);
  const yValues = uniqueSorted([
    start.y,
    end.y,
    ...obstacles.flatMap((box) => [box.y - 1, box.y + box.height + 1])
  ]);
  const nodes: Point[] = [];

  for (const x of xValues) {
    for (const y of yValues) {
      const point = { x, y };

      if (!pointInsideAnyBox(point, obstacles) && pointWithinBounds(point, options.bounds)) {
        nodes.push(point);
      }
    }
  }

  if (!nodes.some((node) => samePoint(node, start))) {
    nodes.push(start);
  }

  if (!nodes.some((node) => samePoint(node, end))) {
    nodes.push(end);
  }

  const keyFor = (point: Point) => `${point.x},${point.y}`;
  const byKey = new Map(nodes.map((node) => [keyFor(node), node]));
  const adjacency = new Map<string, Array<{ key: string; weight: number }>>();
  const rows = groupByCoordinate(nodes, 'y');
  const columns = groupByCoordinate(nodes, 'x');

  for (const row of rows.values()) {
    connectVisibleNeighbors(row.sort((a, b) => a.x - b.x), obstacles, adjacency, keyFor, options.preference);
  }

  for (const column of columns.values()) {
    connectVisibleNeighbors(column.sort((a, b) => a.y - b.y), obstacles, adjacency, keyFor, options.preference);
  }

  const routeKeys = shortestPath(keyFor(start), keyFor(end), adjacency);

  if (!routeKeys) {
    return undefined;
  }

  return compactRoute(routeKeys.map((key) => byKey.get(key)).filter((point): point is Point => point !== undefined));
}

function connectVisibleNeighbors(
  points: Point[],
  obstacles: Box[],
  adjacency: Map<string, Array<{ key: string; weight: number }>>,
  keyFor: (point: Point) => string,
  preference: ConnectorRoutingPreference
): void {
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;

    if (segmentIntersectsAnyBox(start, end, obstacles)) {
      continue;
    }

    const horizontal = start.y === end.y;
    const preferencePenalty = preference === 'shortest'
      ? 0
      : (preference === 'horizontal') === horizontal ? 0 : 4;
    const weight = Math.abs(end.x - start.x) + Math.abs(end.y - start.y) + preferencePenalty;
    const startKey = keyFor(start);
    const endKey = keyFor(end);

    addEdge(adjacency, startKey, endKey, weight);
    addEdge(adjacency, endKey, startKey, weight);
  }
}

function shortestPath(
  startKey: string,
  endKey: string,
  adjacency: Map<string, Array<{ key: string; weight: number }>>
): string[] | undefined {
  const distances = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const queue = new Set<string>([startKey]);

  while (queue.size > 0) {
    const current = [...queue].sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity) || a.localeCompare(b))[0]!;
    queue.delete(current);

    if (current === endKey) {
      break;
    }

    for (const edge of adjacency.get(current) ?? []) {
      const nextDistance = (distances.get(current) ?? Infinity) + edge.weight;

      if (nextDistance < (distances.get(edge.key) ?? Infinity)) {
        distances.set(edge.key, nextDistance);
        previous.set(edge.key, current);
        queue.add(edge.key);
      }
    }
  }

  if (!distances.has(endKey)) {
    return undefined;
  }

  const path = [endKey];
  let current = endKey;

  while (current !== startKey) {
    const prev = previous.get(current);

    if (!prev) {
      return undefined;
    }

    path.push(prev);
    current = prev;
  }

  return path.reverse();
}

function compactRoute(points: Point[]): Point[] {
  if (points.length <= 2) {
    return points;
  }

  const result: Point[] = [points[0]!];

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = result.at(-1)!;
    const point = points[index]!;
    const next = points[index + 1]!;
    const collinear = (previous.x === point.x && point.x === next.x)
      || (previous.y === point.y && point.y === next.y);

    if (!collinear) {
      result.push(point);
    }
  }

  result.push(points.at(-1)!);

  return result;
}

function elbowPointsThrough(points: Point[]): Point[] {
  const routed: Point[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const segment = elbowPoints(points[index - 1]!, points[index]!);

    for (const point of index === 1 ? segment : segment.slice(1)) {
      if (!samePoint(routed.at(-1), point)) {
        routed.push(point);
      }
    }
  }

  return routed;
}

function connectorWaypoints(options: AnnotationConnectorOptions, anchorPoint: Point): Point[] {
  const mode = options.pointMode ?? 'absolute';

  return (options.points ?? [])
    .filter(isFinitePoint)
    .map((point) => mode === 'relative'
      ? { x: anchorPoint.x + point.x, y: anchorPoint.y + point.y }
      : point);
}

function connectorObstacleHits(points: Point[], obstacles: Box[]): number {
  if (points.length < 2 || obstacles.length === 0) {
    return 0;
  }

  let hits = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]!;
    const end = points[index]!;

    for (const obstacle of obstacles) {
      if (segmentIntersectsBox(start, end, obstacle)) {
        hits += 1;
      }
    }
  }

  return hits;
}

function routeScore(points: Point[]): number {
  let distance = 0;
  let turns = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const point = points[index]!;
    distance += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);

    if (index > 1) {
      const before = points[index - 2]!;
      const horizontalBefore = before.y === previous.y;
      const horizontalAfter = previous.y === point.y;

      if (horizontalBefore !== horizontalAfter) {
        turns += 1;
      }
    }
  }

  return distance + turns * 8;
}

function groupByCoordinate(points: Point[], coordinate: 'x' | 'y'): Map<number, Point[]> {
  const groups = new Map<number, Point[]>();

  for (const point of points) {
    const key = point[coordinate];
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  return groups;
}

function addEdge(
  adjacency: Map<string, Array<{ key: string; weight: number }>>,
  from: string,
  to: string,
  weight: number
): void {
  adjacency.set(from, [...(adjacency.get(from) ?? []), { key: to, weight }]);
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))]
    .sort((a, b) => a - b);
}

function isFiniteBox(box: Box): boolean {
  return Number.isFinite(box.x)
    && Number.isFinite(box.y)
    && Number.isFinite(box.width)
    && Number.isFinite(box.height);
}

function expandBox(box: Box, padding: number): Box {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}

function pointWithinBounds(point: Point, bounds: Box | undefined): boolean {
  if (!bounds) {
    return true;
  }

  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function pointInsideAnyBox(point: Point, boxes: Box[]): boolean {
  return boxes.some((box) => pointInsideBox(point, box));
}

function pointInsideBox(point: Point, box: Box): boolean {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height;
}

function segmentIntersectsAnyBox(start: Point, end: Point, boxes: Box[]): boolean {
  return boxes.some((box) => segmentIntersectsBox(start, end, box));
}

function segmentIntersectsBox(start: Point, end: Point, box: Box): boolean {
  if (pointInsideBox(start, box) || pointInsideBox(end, box)) {
    return true;
  }

  const topLeft = { x: box.x, y: box.y };
  const topRight = { x: box.x + box.width, y: box.y };
  const bottomRight = { x: box.x + box.width, y: box.y + box.height };
  const bottomLeft = { x: box.x, y: box.y + box.height };

  return segmentsIntersect(start, end, topLeft, topRight)
    || segmentsIntersect(start, end, topRight, bottomRight)
    || segmentsIntersect(start, end, bottomRight, bottomLeft)
    || segmentsIntersect(start, end, bottomLeft, topLeft);
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

function distanceToSegment(box: Box, start: Point, end: Point): number {
  const center = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(center.x - start.x, center.y - start.y);
  }

  const ratio = clamp(((center.x - start.x) * dx + (center.y - start.y) * dy) / lengthSquared, 0, 1);
  const projection = {
    x: start.x + dx * ratio,
    y: start.y + dy * ratio
  };

  return Math.hypot(center.x - projection.x, center.y - projection.y);
}

function offsetConnectorEndpoints(
  start: Point,
  end: Point,
  options: AnnotationConnectorOptions
): { start: Point; end: Point } {
  const startOffset = nonNegativeFinite(options.startOffset);
  const endOffset = nonNegativeFinite(options.endOffset);

  if (startOffset === 0 && endOffset === 0) {
    return { start, end };
  }

  const distance = Math.hypot(end.x - start.x, end.y - start.y);

  if (distance === 0) {
    return { start, end };
  }

  const totalOffset = startOffset + endOffset;
  const scale = totalOffset > distance ? distance / totalOffset : 1;
  const resolvedStartOffset = startOffset * scale;
  const resolvedEndOffset = endOffset * scale;

  return {
    start: pointAlongLine(start, end, resolvedStartOffset / distance),
    end: pointAlongLine(end, start, resolvedEndOffset / distance)
  };
}

function pointAlongLine(start: Point, end: Point, ratio: number): Point {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  };
}

function curvePathD(points: Point[]): string {
  if (points.length < 2) {
    return '';
  }

  const start = points[0]!;
  const end = points.at(-1)!;

  if (points.length === 2) {
    return automaticCurvePathD(start, end);
  }

  if (points.length === 3) {
    const control = points[1]!;

    return [
      `M ${round(start.x)} ${round(start.y)}`,
      `Q ${round(control.x)} ${round(control.y)}`,
      `${round(end.x)} ${round(end.y)}`
    ].join(' ');
  }

  if (points.length === 4) {
    const controlA = points[1]!;
    const controlB = points[2]!;

    return [
      `M ${round(start.x)} ${round(start.y)}`,
      `C ${round(controlA.x)} ${round(controlA.y)}`,
      `${round(controlB.x)} ${round(controlB.y)}`,
      `${round(end.x)} ${round(end.y)}`
    ].join(' ');
  }

  const commands = [`M ${round(start.x)} ${round(start.y)}`];

  for (let index = 1; index < points.length - 2; index += 1) {
    const control = points[index]!;
    const next = points[index + 1]!;
    const midpoint = {
      x: (control.x + next.x) / 2,
      y: (control.y + next.y) / 2
    };

    commands.push(`Q ${round(control.x)} ${round(control.y)} ${round(midpoint.x)} ${round(midpoint.y)}`);
  }

  const finalControl = points[points.length - 2]!;
  commands.push(`Q ${round(finalControl.x)} ${round(finalControl.y)} ${round(end.x)} ${round(end.y)}`);

  return commands.join(' ');
}

function automaticCurvePathD(start: Point, end: Point): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const controlA = horizontal
    ? { x: start.x + dx * 0.5, y: start.y }
    : { x: start.x, y: start.y + dy * 0.5 };
  const controlB = horizontal
    ? { x: end.x - dx * 0.5, y: end.y }
    : { x: end.x, y: end.y - dy * 0.5 };

  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `C ${round(controlA.x)} ${round(controlA.y)}`,
    `${round(controlB.x)} ${round(controlB.y)}`,
    `${round(end.x)} ${round(end.y)}`
  ].join(' ');
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function samePoint(a: Point | undefined, b: Point): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function nonNegativeFinite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : 0;
}
