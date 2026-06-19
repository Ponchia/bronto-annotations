import {
  extractedAnchorFromElement,
  obstaclesFromElements,
  type ElementAnchorOptions,
  type ExtractedAnchor
} from '../dom/index.js';
import type {
  Anchor,
  Annotation,
  AnnotationConnectorOptions,
  DataAttributes,
  AnnotationNote,
  AnnotationSubjectOptions,
  Box,
  PlacementPreference,
  Point
} from '../core/model.js';
import { findElementByText } from './mermaid.js';
import {
  assertAnchorValidationReportIfRequested,
  anchorDiagnostic,
  validationReport,
  type AnchorSpecDiagnostic,
  type AdapterAnnotationLayerInput,
  type AnchorValidationAssertInput,
  type AnchorSpecValidationReport
} from './diagnostics.js';

export {
  assertAnchorAlignmentReport,
  assertAnchorAlignmentReportIfRequested,
  assertAnchorValidationReport,
  evaluateAnchorAlignment,
  formatAnchorAlignmentDiagnostic,
  formatAnchorAlignmentReport,
  formatAnchorDiagnostic,
  formatAnchorValidationReport
} from './diagnostics.js';
export type {
  AnchorAlignmentAssertInput,
  AnchorAlignmentAssertOptions,
  AnchorAlignmentDiagnostic,
  AnchorAlignmentDiagnosticStatus,
  AnchorAlignmentFormatOptions,
  AnchorAlignmentOptions,
  AnchorAlignmentReport,
  AnchorAlignmentTarget,
  AnchorValidationAssertInput,
  AnchorValidationAssertOptions,
  AnchorValidationFormatOptions
} from './diagnostics.js';

export type D2AnchorDiagnostic = AnchorSpecDiagnostic;
export type D2AnchorValidationReport = AnchorSpecValidationReport;
export type D2AnnotationLayerInput = AdapterAnnotationLayerInput<D2AnchorValidationReport>;

export type D2AnnotationAuthoring = {
  note?: AnnotationNote;
  placement?: PlacementPreference;
  subject?: AnnotationSubjectOptions;
  connector?: AnnotationConnectorOptions;
  variant?: Annotation['variant'];
  tone?: Annotation['tone'];
  motion?: Annotation['motion'];
  style?: Annotation['style'];
  priority?: number;
  annotationClassName?: string;
  annotationData?: DataAttributes;
  metadata?: Annotation['metadata'];
};

export type D2ShapeLike = {
  id: string;
  pos: Point;
  width: number;
  height: number;
  label?: string;
  classes?: string[];
  shapes?: D2ShapeLike[];
  children?: D2ShapeLike[];
};

export type D2ConnectionLike = {
  id: string;
  src: string;
  dst: string;
  label?: string;
  classes?: string[];
  route?: Point[];
};

export type D2DiagramLike = {
  shapes?: D2ShapeLike[];
  connections?: D2ConnectionLike[];
  layers?: Array<D2DiagramLike | undefined>;
  scenarios?: Array<D2DiagramLike | undefined>;
  steps?: Array<D2DiagramLike | undefined>;
};

export type D2LabelMatch = 'exact' | 'contains';

export type D2DiagramAnchorSpec = D2AnnotationAuthoring & {
  id: string;
  shapeId?: string;
  connectionId?: string;
  label?: string;
  labelMatch?: D2LabelMatch;
  className?: string;
};

export type D2ObstacleOptions = {
  includeShapes?: boolean;
  includeConnections?: boolean;
  padding?: number;
};

export type D2DiagramAnnotationLayerOptions = {
  obstacles?: D2ObstacleOptions | false;
  assert?: AnchorValidationAssertInput;
};

export type D2SvgAnchorSpec = ElementAnchorOptions & D2AnnotationAuthoring & {
  id: string;
  selector?: string;
  d2Id?: string;
  shapeId?: string;
  connectionId?: string;
  label?: string;
  labelMatch?: D2LabelMatch;
  className?: string;
  data?: Record<string, string>;
};

export type D2SvgObstacleOptions = ElementAnchorOptions & {
  selector?: string;
  includeShapes?: boolean;
  includeConnections?: boolean;
  padding?: number;
};

export type D2SvgAnnotationLayerOptions = {
  obstacles?: D2SvgObstacleOptions | false;
  assert?: AnchorValidationAssertInput;
};

export type D2AnchorResult = ExtractedAnchor & {
  d2Kind: 'shape' | 'connection' | 'svg';
  shapeId?: string;
  connectionId?: string;
  label?: string;
  className?: string;
  src?: string;
  dst?: string;
  elementId?: string;
  selector?: string;
};

export function anchorsFromD2Diagram(diagram: D2DiagramLike, specs: D2DiagramAnchorSpec[]): D2AnchorResult[] {
  const results: D2AnchorResult[] = [];
  const shapes = allD2Shapes(diagram);
  const connections = allD2Connections(diagram);

  for (const spec of specs) {
    const shape = findD2Shape(shapes, spec);

    if (shape) {
      const box: Box = {
        x: shape.pos.x,
        y: shape.pos.y,
        width: shape.width,
        height: shape.height
      };

      results.push({
        id: spec.id,
        anchor: { type: 'box', box },
        box,
        point: {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2
        },
        source: 'd2-diagram',
        d2Kind: 'shape',
        shapeId: shape.id,
        ...(shape.label ? { label: shape.label } : {}),
        ...(shape.classes?.length ? { className: shape.classes.join(' ') } : {})
      });
      continue;
    }

    const connection = findD2Connection(connections, spec);

    if (connection?.route?.length) {
      const points = connection.route;
      const box = boxFromPoints(points);

      results.push({
        id: spec.id,
        anchor: { type: 'path', points },
        box,
        point: points[Math.floor(points.length / 2)] ?? { x: box.x, y: box.y },
        source: 'd2-diagram',
        d2Kind: 'connection',
        connectionId: connection.id,
        src: connection.src,
        dst: connection.dst,
        ...(connection.label ? { label: connection.label } : {}),
        ...(connection.classes?.length ? { className: connection.classes.join(' ') } : {})
      });
    }
  }

  return results;
}

export function validateD2DiagramAnchors(diagram: D2DiagramLike, specs: D2DiagramAnchorSpec[]): D2AnchorValidationReport {
  const shapes = allD2Shapes(diagram);
  const connections = allD2Connections(diagram);

  return validationReport(specs.map((spec) => {
    const shape = findD2Shape(shapes, spec);
    const connection = findD2Connection(connections, spec);
    const expected = d2DiagramSpecExpectation(spec);
    const status = shape || connection?.route?.length ? 'found' : 'missing';
    const reason = connection && !connection.route?.length
      ? `D2 connection matched ${expected}, but it has no route points.`
      : `No compiled D2 shape or connection matched ${expected}.`;

    return anchorDiagnostic({
      id: spec.id,
      source: 'd2-diagram',
      status,
      expected,
      ...(status === 'found' ? {} : { reason })
    });
  }));
}

export function annotationsFromD2Diagram(diagram: D2DiagramLike, specs: D2DiagramAnchorSpec[]): Annotation[] {
  return anchorsFromD2Diagram(diagram, specs).map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromD2AnchorResult(result, spec);
  });
}

export function prepareD2DiagramAnnotations(
  diagram: D2DiagramLike,
  specs: D2DiagramAnchorSpec[],
  options: D2DiagramAnnotationLayerOptions = {}
): D2AnnotationLayerInput {
  const validation = validateD2DiagramAnchors(diagram, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'D2 diagram anchors' });

  return {
    annotations: annotationsFromD2Diagram(diagram, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromD2Diagram(diagram, { includeConnections: true, ...(options.obstacles ?? {}) }),
    validation
  };
}

export function anchorsFromD2Svg(root: ParentNode, specs: D2SvgAnchorSpec[]): D2AnchorResult[] {
  return specs.flatMap((spec) => {
    const element = findD2SvgElement(root, spec);

    if (!element) {
      return [];
    }

    const result = extractedAnchorFromElement(element, {
      ...spec,
      source: spec.source ?? 'd2-svg'
    });
    const elementId = element.getAttribute('id') ?? undefined;

    return [{
      ...result,
      d2Kind: spec.connectionId ? 'connection' : spec.shapeId || spec.d2Id ? 'shape' : 'svg',
      ...(spec.shapeId || spec.d2Id ? { shapeId: spec.shapeId ?? spec.d2Id } : {}),
      ...(spec.connectionId ? { connectionId: spec.connectionId } : {}),
      ...(spec.label ? { label: spec.label } : {}),
      ...(spec.className ? { className: spec.className } : {}),
      ...(spec.selector ? { selector: spec.selector } : {}),
      ...(elementId ? { elementId } : {})
    }];
  });
}

export function validateD2SvgAnchors(root: ParentNode, specs: D2SvgAnchorSpec[]): D2AnchorValidationReport {
  return validationReport(specs.map((spec) => {
    const element = findD2SvgElement(root, spec);
    const expected = d2SvgSpecExpectation(spec);

    return anchorDiagnostic({
      id: spec.id,
      source: 'd2-svg',
      status: element ? 'found' : 'missing',
      expected,
      ...(element ? {} : { reason: `No rendered D2 SVG element matched ${expected}.` })
    });
  }));
}

export function annotationsFromD2Svg(root: ParentNode, specs: D2SvgAnchorSpec[]): Annotation[] {
  return anchorsFromD2Svg(root, specs).map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromD2AnchorResult(result, spec);
  });
}

export function prepareD2SvgAnnotations(
  root: ParentNode,
  specs: D2SvgAnchorSpec[],
  options: D2SvgAnnotationLayerOptions = {}
): D2AnnotationLayerInput {
  const validation = validateD2SvgAnchors(root, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'D2 SVG anchors' });

  return {
    annotations: annotationsFromD2Svg(root, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromD2Svg(root, { includeConnections: true, ...(options.obstacles ?? {}) }),
    validation
  };
}

export function obstaclesFromD2Svg(root: ParentNode, options: D2SvgObstacleOptions = {}): Box[] {
  const elements = d2SvgObstacleElements(root, options);

  return obstaclesFromElements(elements, {
    ...options,
    inflate: (options.inflate ?? 0) + (options.padding ?? 0),
    source: options.source ?? 'd2-svg-obstacle'
  });
}

export function findD2SvgElement(root: ParentNode, spec: D2SvgAnchorSpec): Element | undefined {
  if (spec.selector) {
    return root.querySelector(spec.selector) ?? undefined;
  }

  if (spec.connectionId && spec.kind === 'path') {
    const path = findD2ConnectionPath(root, spec.connectionId);

    if (path) {
      return path;
    }
  }

  const id = spec.shapeId ?? spec.connectionId ?? spec.d2Id;

  if (id) {
    const idMatch = findD2ElementById(root, id, spec.connectionId ? 'connection' : 'shape');

    if (idMatch) {
      return idMatch;
    }
  }

  if (spec.className) {
    const classMatch = root.querySelector(`.${cssEscape(spec.className)}`);

    if (classMatch) {
      return classMatch;
    }
  }

  if (spec.data) {
    const selector = Object.entries(spec.data)
      .map(([key, value]) => `[data-${dataKey(key)}="${attributeEscape(value)}"]`)
      .join('');
    const dataMatch = root.querySelector(selector);

    if (dataMatch) {
      return dataMatch;
    }
  }

  if (spec.label) {
    return findElementByText(root, spec.label, ['g', 'text'], spec.labelMatch ?? 'exact');
  }

  return undefined;
}

function findD2ConnectionPath(root: ParentNode, connectionId: string): Element | undefined {
  const id = attributeEscape(connectionId);

  return root.querySelector([
    `path[data-d2-connection-id="${id}"]`,
    `path[data-connection-id="${id}"]`,
    `path[data-id="${id}"]`,
    `path[id*="${id}"]`,
    `[data-d2-connection-id="${id}"] path`,
    `[data-connection-id="${id}"] path`,
    `[data-id="${id}"] path`,
    `[id*="${id}"] path`,
    `.connection[id*="${id}"] path`,
    `.d2-connection[id*="${id}"] path`,
    `.edge[id*="${id}"] path`,
    `.d2-edge[id*="${id}"] path`
  ].join(', ')) ?? undefined;
}

function findD2ElementById(root: ParentNode, id: string, kind: 'shape' | 'connection'): Element | undefined {
  const exact = root.querySelector(`#${cssEscape(id)}`);

  if (exact) {
    return exact;
  }

  const selectors = [
    `[id*="${attributeEscape(id)}"]`,
    `[data-d2-id="${attributeEscape(id)}"]`,
    `[data-id="${attributeEscape(id)}"]`,
    kind === 'shape'
      ? `[data-d2-shape-id="${attributeEscape(id)}"], [data-shape-id="${attributeEscape(id)}"]`
      : `[data-d2-connection-id="${attributeEscape(id)}"], [data-connection-id="${attributeEscape(id)}"]`
  ];

  return root.querySelector(selectors.join(', ')) ?? undefined;
}

export function obstaclesFromD2Diagram(diagram: D2DiagramLike, options: D2ObstacleOptions = {}): Box[] {
  const includeShapes = options.includeShapes ?? true;
  const includeConnections = options.includeConnections ?? false;
  const boxes: Box[] = [];

  if (includeShapes) {
    boxes.push(...allD2Shapes(diagram).map((shape) => inflateBox({
      x: shape.pos.x,
      y: shape.pos.y,
      width: shape.width,
      height: shape.height
    }, options.padding ?? 0)));
  }

  if (includeConnections) {
    boxes.push(...allD2Connections(diagram)
      .filter((connection) => connection.route?.length)
      .map((connection) => inflateBox(boxFromPoints(connection.route ?? []), options.padding ?? 0)));
  }

  return boxes;
}

function d2SvgObstacleElements(root: ParentNode, options: D2SvgObstacleOptions): Element[] {
  if (options.selector) {
    return Array.from(root.querySelectorAll(options.selector));
  }

  const includeShapes = options.includeShapes ?? true;
  const includeConnections = options.includeConnections ?? false;
  const selectors = [
    ...(includeShapes ? D2_SVG_SHAPE_SELECTORS : []),
    ...(includeConnections ? D2_SVG_CONNECTION_SELECTORS : [])
  ];

  if (selectors.length === 0) {
    return [];
  }

  return uniqueElements(Array.from(root.querySelectorAll(selectors.join(', '))));
}

const D2_SVG_SHAPE_SELECTORS = [
  '[data-d2-shape-id]',
  '[data-shape-id]',
  '[data-d2-kind="shape"]',
  '[data-kind="shape"]',
  '[class~="shape"]',
  '[class~="d2-shape"]',
  '[class~="d2-node"]',
  'g.shape',
  'g.d2-shape',
  'g.d2-node'
];

const D2_SVG_CONNECTION_SELECTORS = [
  '[data-d2-connection-id]',
  '[data-connection-id]',
  '[data-d2-kind="connection"]',
  '[data-kind="connection"]',
  '[class~="connection"]',
  '[class~="d2-connection"]',
  '[class~="edge"]',
  '[class~="d2-edge"]',
  'g.connection',
  'g.d2-connection',
  'g.edge',
  'g.d2-edge',
  'path.connection',
  'path.d2-connection',
  'path.edge',
  'path.d2-edge'
];

function uniqueElements(elements: Element[]): Element[] {
  return Array.from(new Set(elements));
}

export function allD2Shapes(diagram: D2DiagramLike): D2ShapeLike[] {
  const shapes: D2ShapeLike[] = [];
  const stack: Array<D2DiagramLike | D2ShapeLike | undefined> = [diagram];

  while (stack.length > 0) {
    const item = stack.pop();

    if (!item) {
      continue;
    }

    if ('pos' in item && 'width' in item && 'height' in item) {
      shapes.push(item);
      stack.push(...(item.shapes ?? []), ...(item.children ?? []));
      continue;
    }

    stack.push(
      ...(item.shapes ?? []),
      ...(item.layers ?? []),
      ...(item.scenarios ?? []),
      ...(item.steps ?? [])
    );
  }

  return shapes;
}

export function allD2Connections(diagram: D2DiagramLike): D2ConnectionLike[] {
  const connections: D2ConnectionLike[] = [];
  const stack: Array<D2DiagramLike | undefined> = [diagram];

  while (stack.length > 0) {
    const item = stack.pop();

    if (!item) {
      continue;
    }

    connections.push(...(item.connections ?? []));
    stack.push(...(item.layers ?? []), ...(item.scenarios ?? []), ...(item.steps ?? []));
  }

  return connections;
}

function findD2Shape(shapes: D2ShapeLike[], spec: D2DiagramAnchorSpec): D2ShapeLike | undefined {
  return shapes.find((shape) => {
    if (spec.shapeId && shape.id === spec.shapeId) {
      return true;
    }

    if (spec.label && labelMatches(shape.label, spec.label, spec.labelMatch ?? 'exact')) {
      return true;
    }

    return Boolean(spec.className && shape.classes?.includes(spec.className));
  });
}

function findD2Connection(connections: D2ConnectionLike[], spec: D2DiagramAnchorSpec): D2ConnectionLike | undefined {
  return connections.find((connection) => {
    if (spec.connectionId && connection.id === spec.connectionId) {
      return true;
    }

    if (spec.label && labelMatches(connection.label, spec.label, spec.labelMatch ?? 'exact')) {
      return true;
    }

    return Boolean(spec.className && connection.classes?.includes(spec.className));
  });
}

function d2DiagramSpecExpectation(spec: D2DiagramAnchorSpec): string {
  if (spec.shapeId) {
    return `shape id "${spec.shapeId}"`;
  }

  if (spec.connectionId) {
    return `connection id "${spec.connectionId}"`;
  }

  if (spec.label) {
    return `${spec.labelMatch ?? 'exact'} label "${spec.label}"`;
  }

  if (spec.className) {
    return `class "${spec.className}"`;
  }

  return 'any compiled D2 shape or routed connection';
}

function d2SvgSpecExpectation(spec: D2SvgAnchorSpec): string {
  if (spec.selector) {
    return `selector "${spec.selector}"`;
  }

  if (spec.shapeId) {
    return `shape id "${spec.shapeId}"`;
  }

  if (spec.connectionId) {
    return `connection id "${spec.connectionId}"`;
  }

  if (spec.d2Id) {
    return `D2 id "${spec.d2Id}"`;
  }

  if (spec.className) {
    return `class "${spec.className}"`;
  }

  if (spec.data) {
    return `data selector "${Object.entries(spec.data).map(([key, value]) => `[data-${dataKey(key)}="${attributeEscape(value)}"]`).join('')}"`;
  }

  if (spec.label) {
    return `${spec.labelMatch ?? 'exact'} label "${spec.label}"`;
  }

  return 'any rendered D2 SVG element';
}

function annotationFromD2AnchorResult(
  result: D2AnchorResult,
  spec: D2AnnotationAuthoring | undefined
): Annotation {
  const data: DataAttributes = {
    anchorSource: result.source,
    d2Kind: result.d2Kind,
    ...(result.shapeId ? { d2ShapeId: result.shapeId } : {}),
    ...(result.connectionId ? { d2ConnectionId: result.connectionId } : {}),
    ...(result.label ? { d2Label: result.label } : {}),
    ...(result.className ? { d2ClassName: result.className } : {}),
    ...(result.src ? { d2Source: result.src } : {}),
    ...(result.dst ? { d2Destination: result.dst } : {}),
    ...(result.elementId ? { d2ElementId: result.elementId } : {}),
    ...(result.selector ? { d2Selector: result.selector } : {})
  };

  return {
    id: result.id,
    anchor: result.anchor,
    note: spec?.note ?? { title: result.id },
    ...(spec?.placement ? { placement: spec.placement } : {}),
    ...(spec?.subject ? { subject: spec.subject } : {}),
    ...(spec?.connector ? { connector: spec.connector } : {}),
    ...(spec?.variant !== undefined ? { variant: spec.variant } : {}),
    ...(spec?.tone !== undefined ? { tone: spec.tone } : {}),
    ...(spec?.motion !== undefined ? { motion: spec.motion } : {}),
    ...(spec?.style ? { style: spec.style } : {}),
    ...(spec?.priority !== undefined ? { priority: spec.priority } : {}),
    ...(spec?.annotationClassName ? { className: spec.annotationClassName } : {}),
    data: {
      ...data,
      ...(spec?.annotationData ?? {})
    },
    ...(spec?.metadata ? { metadata: spec.metadata } : {})
  };
}

function boxFromPoints(points: Point[]): Box {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["#.:,[\]>+~*^$|=\\]/g, '\\$&');
}

function attributeEscape(value: string): string {
  return value.replaceAll('"', '\\"');
}

function dataKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .toLowerCase();
}

function labelMatches(value: string | undefined, expected: string, match: D2LabelMatch): boolean {
  if (!value) {
    return false;
  }

  const candidate = normalizeText(value);
  const normalized = normalizeText(expected);

  return match === 'contains'
    ? candidate.includes(normalized)
    : candidate === normalized;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function inflateBox(box: Box, padding: number): Box {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}
