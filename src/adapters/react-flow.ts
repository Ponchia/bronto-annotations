import type {
  Anchor,
  Annotation,
  AnnotationConnectorOptions,
  AnnotationNote,
  AnnotationSubjectOptions,
  Box,
  DataAttributes,
  PlacementPreference,
  PlacementSide,
  Point
} from '../core/model.js';
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

export type ReactFlowAnchorDiagnostic = AnchorSpecDiagnostic;
export type ReactFlowAnchorValidationReport = AnchorSpecValidationReport;
export type ReactFlowAnnotationLayerInput = AdapterAnnotationLayerInput<ReactFlowAnchorValidationReport>;

export type ReactFlowAnnotationAuthoring = {
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

export type ReactFlowViewportLike = {
  x: number;
  y: number;
  zoom: number;
};

export type ReactFlowHandleType = 'source' | 'target';

export type ReactFlowHandleLike = {
  id?: string | null;
  nodeId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  position?: PlacementSide;
  type?: ReactFlowHandleType;
};

export type ReactFlowHandleBoundsLike = {
  source?: ReactFlowHandleLike[] | null;
  target?: ReactFlowHandleLike[] | null;
};

export type ReactFlowNodeLike = {
  id: string;
  position?: Point;
  positionAbsolute?: Point;
  width?: number;
  height?: number;
  measured?: Partial<{ width: number; height: number }>;
  handles?: ReactFlowHandleLike[];
  internals?: {
    positionAbsolute?: Point;
    handleBounds?: ReactFlowHandleBoundsLike;
  };
  data?: Record<string, unknown>;
};

export type ReactFlowEdgeLike = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: Record<string, unknown>;
};

export type ReactFlowHandleAnchorSpec = {
  nodeId: string;
  side?: PlacementSide;
  id?: string;
  type?: ReactFlowHandleType;
  center?: boolean;
};

export type ReactFlowAnchorSpec = ReactFlowAnnotationAuthoring & {
  id: string;
  nodeId?: string;
  edgeId?: string;
  handle?: ReactFlowHandleAnchorSpec;
};

export type ReactFlowAnchorInput<TNode extends ReactFlowNodeLike = ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike = ReactFlowEdgeLike> = {
  nodes: TNode[];
  edges?: TEdge[];
  viewport?: ReactFlowViewportLike;
  nodeOrigin?: [number, number];
  edgePoints?: (edge: TEdge, nodes: TNode[]) => Point[] | undefined;
};

export type ReactFlowObstacleOptions<TNode extends ReactFlowNodeLike = ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike = ReactFlowEdgeLike> = {
  includeNodes?: boolean;
  includeHandles?: boolean;
  includeEdges?: boolean;
  padding?: number;
  node?: (node: TNode) => boolean;
  handle?: (handle: ReactFlowHandleLike, node: TNode) => boolean;
  edge?: (edge: TEdge) => boolean;
};

export type ReactFlowAnnotationLayerOptions<TNode extends ReactFlowNodeLike = ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike = ReactFlowEdgeLike> = {
  obstacles?: ReactFlowObstacleOptions<TNode, TEdge> | false;
  assert?: AnchorValidationAssertInput;
};

export type ReactFlowAnchorResult = {
  id: string;
  anchor: Anchor;
  box: Box;
  point: Point;
  source: 'react-flow-node' | 'react-flow-handle' | 'react-flow-edge';
  nodeId?: string;
  edgeId?: string;
  handleId?: string;
  handleType?: ReactFlowHandleType;
  handleSide?: PlacementSide;
  sourceNodeId?: string;
  targetNodeId?: string;
  sourceHandleId?: string;
  targetHandleId?: string;
};

export function anchorsFromReactFlow<TNode extends ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike>(
  input: ReactFlowAnchorInput<TNode, TEdge>,
  specs: ReactFlowAnchorSpec[]
): ReactFlowAnchorResult[] {
  return specs.flatMap((spec): ReactFlowAnchorResult[] => {
    if (spec.nodeId) {
      const node = input.nodes.find((item) => item.id === spec.nodeId);

      if (!node) {
        return [];
      }

      const box = nodeBox(node, input.viewport, input.nodeOrigin);

      return [{
        ...resultFromBox(spec.id, box, 'react-flow-node'),
        nodeId: node.id
      }];
    }

    if (spec.handle) {
      const node = input.nodes.find((item) => item.id === spec.handle?.nodeId);

      if (!node) {
        return [];
      }

      const side = spec.handle.side ?? 'right';
      const resolved = resolveHandleAnchor(node, spec.handle, input.viewport, input.nodeOrigin);
      const point = resolved?.point ?? handlePoint(nodeBox(node, input.viewport, input.nodeOrigin), side);

      return [{
        id: spec.id,
        anchor: { type: 'point', point },
        box: resolved?.box ?? { x: point.x, y: point.y, width: 0, height: 0 },
        point,
        source: 'react-flow-handle',
        nodeId: node.id,
        ...(spec.handle.id ? { handleId: spec.handle.id } : {}),
        ...(resolved?.type ? { handleType: resolved.type } : spec.handle.type ? { handleType: spec.handle.type } : {}),
        handleSide: resolved?.side ?? side
      }];
    }

    if (spec.edgeId) {
      const edge = input.edges?.find((item) => item.id === spec.edgeId);

      if (!edge) {
        return [];
      }

      const points = input.edgePoints?.(edge, input.nodes) ?? edgePoints(edge, input.nodes, input.viewport, input.nodeOrigin);

      if (points.length === 0) {
        return [];
      }

      const box = boxFromPoints(points);

      return [{
        id: spec.id,
        anchor: { type: 'path', points },
        box,
        point: points[Math.floor(points.length / 2)] ?? { x: box.x, y: box.y },
        source: 'react-flow-edge',
        edgeId: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        ...(edge.sourceHandle ? { handleId: edge.sourceHandle, sourceHandleId: edge.sourceHandle } : {}),
        ...(edge.targetHandle ? { targetHandleId: edge.targetHandle } : {})
      }];
    }

    return [];
  });
}

export function validateReactFlowAnchors<TNode extends ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike>(
  input: ReactFlowAnchorInput<TNode, TEdge>,
  specs: ReactFlowAnchorSpec[]
): ReactFlowAnchorValidationReport {
  return validationReport(specs.map((spec) => {
    const expected = reactFlowSpecExpectation(spec);

    if (spec.nodeId) {
      const node = input.nodes.find((item) => item.id === spec.nodeId);
      const box = node ? nodeBox(node, input.viewport, input.nodeOrigin) : undefined;
      const validSize = box ? box.width > 0 && box.height > 0 : false;

      return anchorDiagnostic({
        id: spec.id,
        source: 'react-flow-node',
        status: !node ? 'missing' : validSize ? 'found' : 'invalid',
        expected,
        ...(!node ? { reason: `No React Flow node matched ${expected}.` } : {}),
        ...(node && !validSize ? { reason: `React Flow node matched ${expected}, but it has no measured width/height.` } : {})
      });
    }

    if (spec.handle) {
      const node = input.nodes.find((item) => item.id === spec.handle?.nodeId);

      if (!node) {
        return anchorDiagnostic({
          id: spec.id,
          source: 'react-flow-handle',
          status: 'missing',
          expected,
          reason: `No React Flow node matched handle parent "${spec.handle.nodeId}".`
        });
      }

      const resolved = resolveHandleAnchor(node, spec.handle, input.viewport, input.nodeOrigin);

      return anchorDiagnostic({
        id: spec.id,
        source: 'react-flow-handle',
        status: resolved ? 'found' : 'fallback',
        expected,
        ...(resolved ? {} : { reason: `React Flow handle matched ${expected} was not measured; the adapter will fall back to the node side midpoint.` })
      });
    }

    if (spec.edgeId) {
      const edge = input.edges?.find((item) => item.id === spec.edgeId);
      const points = edge
        ? input.edgePoints?.(edge, input.nodes) ?? edgePoints(edge, input.nodes, input.viewport, input.nodeOrigin)
        : [];

      return anchorDiagnostic({
        id: spec.id,
        source: 'react-flow-edge',
        status: !edge ? 'missing' : points.length > 0 ? 'found' : 'invalid',
        expected,
        ...(!edge ? { reason: `No React Flow edge matched ${expected}.` } : {}),
        ...(edge && points.length === 0 ? { reason: `React Flow edge matched ${expected}, but its endpoint nodes or route points were unavailable.` } : {})
      });
    }

    return anchorDiagnostic({
      id: spec.id,
      source: 'react-flow',
      status: 'invalid',
      expected,
      reason: 'React Flow anchor spec needs nodeId, handle, or edgeId.'
    });
  }));
}

export function annotationsFromReactFlow<TNode extends ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike>(
  input: ReactFlowAnchorInput<TNode, TEdge>,
  specs: ReactFlowAnchorSpec[]
): Annotation[] {
  return anchorsFromReactFlow(input, specs).map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromReactFlowAnchorResult(result, spec);
  });
}

export function prepareReactFlowAnnotations<TNode extends ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike>(
  input: ReactFlowAnchorInput<TNode, TEdge>,
  specs: ReactFlowAnchorSpec[],
  options: ReactFlowAnnotationLayerOptions<TNode, TEdge> = {}
): ReactFlowAnnotationLayerInput {
  const validation = validateReactFlowAnchors(input, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'React Flow anchors' });

  return {
    annotations: annotationsFromReactFlow(input, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromReactFlow(input, { includeHandles: true, includeEdges: true, ...(options.obstacles ?? {}) }),
    validation
  };
}

export function obstaclesFromReactFlow<TNode extends ReactFlowNodeLike, TEdge extends ReactFlowEdgeLike>(
  input: ReactFlowAnchorInput<TNode, TEdge>,
  options: ReactFlowObstacleOptions<TNode, TEdge> = {}
): Box[] {
  const includeNodes = options.includeNodes ?? true;
  const includeHandles = options.includeHandles ?? false;
  const includeEdges = options.includeEdges ?? false;
  const padding = options.padding ?? 0;
  const boxes: Box[] = [];

  if (includeNodes) {
    boxes.push(...input.nodes
      .filter((node) => options.node ? options.node(node) : true)
      .map((node) => nodeBox(node, input.viewport, input.nodeOrigin))
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => inflateBox(box, padding)));
  }

  if (includeHandles) {
    boxes.push(...input.nodes
      .flatMap((node) => handlesForNode(node)
        .filter((handle) => options.handle ? options.handle(handle, node) : true)
        .map((handle) => handleBox(node, handle, input.viewport, input.nodeOrigin)))
      .filter((box) => box.width > 0 && box.height > 0)
      .map((box) => inflateBox(box, padding)));
  }

  if (includeEdges) {
    boxes.push(...(input.edges ?? [])
      .filter((edge) => options.edge ? options.edge(edge) : true)
      .map((edge) => input.edgePoints?.(edge, input.nodes) ?? edgePoints(edge, input.nodes, input.viewport, input.nodeOrigin))
      .filter((points) => points.length > 0)
      .map((points) => inflateBox(boxFromPoints(points), padding)));
  }

  return boxes;
}

export function nodeBox(
  node: ReactFlowNodeLike,
  viewport: ReactFlowViewportLike = { x: 0, y: 0, zoom: 1 },
  nodeOrigin: [number, number] = [0, 0]
): Box {
  const width = node.measured?.width ?? node.width ?? 0;
  const height = node.measured?.height ?? node.height ?? 0;
  const position = node.internals?.positionAbsolute ?? node.positionAbsolute ?? node.position ?? { x: 0, y: 0 };
  const x = (position.x - width * nodeOrigin[0]) * viewport.zoom + viewport.x;
  const y = (position.y - height * nodeOrigin[1]) * viewport.zoom + viewport.y;

  return {
    x,
    y,
    width: width * viewport.zoom,
    height: height * viewport.zoom
  };
}

export function handlePoint(box: Box, side: PlacementSide): Point {
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

export function handleBox(
  node: ReactFlowNodeLike,
  handle: ReactFlowHandleLike,
  viewport: ReactFlowViewportLike = { x: 0, y: 0, zoom: 1 },
  nodeOrigin: [number, number] = [0, 0]
): Box {
  const parent = nodeBox(node, viewport, nodeOrigin);

  return {
    x: parent.x + handle.x * viewport.zoom,
    y: parent.y + handle.y * viewport.zoom,
    width: (handle.width ?? 0) * viewport.zoom,
    height: (handle.height ?? 0) * viewport.zoom
  };
}

function resolveHandleAnchor(
  node: ReactFlowNodeLike,
  spec: ReactFlowHandleAnchorSpec,
  viewport: ReactFlowViewportLike | undefined,
  nodeOrigin: [number, number] | undefined
): {
  box: Box;
  point: Point;
  side: PlacementSide;
  type?: ReactFlowHandleType;
} | undefined {
  const handle = findHandle(node, spec);

  if (!handle) {
    return undefined;
  }

  const side = handle.position ?? spec.side ?? 'right';
  const box = handleBox(node, handle, viewport, nodeOrigin);

  return {
    box,
    point: spec.center ? {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    } : handlePoint(box, side),
    side,
    ...(handle.type ? { type: handle.type } : spec.type ? { type: spec.type } : {})
  };
}

function findHandle(node: ReactFlowNodeLike, spec: ReactFlowHandleAnchorSpec): ReactFlowHandleLike | undefined {
  const candidates = handlesForNode(node, spec.type);

  return candidates.find((handle) => {
    if (spec.id !== undefined && handle.id !== spec.id) {
      return false;
    }

    if (spec.type && handle.type !== spec.type) {
      return false;
    }

    if (spec.side && handle.position !== spec.side) {
      return false;
    }

    return true;
  });
}

function handlesForNode(node: ReactFlowNodeLike, type?: ReactFlowHandleType): ReactFlowHandleLike[] {
  const bounds = node.internals?.handleBounds;
  const bounded = bounds
    ? [
      ...(type === 'target' ? [] : bounds.source ?? []),
      ...(type === 'source' ? [] : bounds.target ?? [])
    ]
    : [];
  const publicHandles = node.handles ?? [];

  return [...bounded, ...publicHandles];
}

function resultFromBox(id: string, box: Box, source: ReactFlowAnchorResult['source']): ReactFlowAnchorResult {
  return {
    id,
    anchor: { type: 'box', box },
    box,
    point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    source
  };
}

function annotationFromReactFlowAnchorResult(
  result: ReactFlowAnchorResult,
  spec: ReactFlowAnnotationAuthoring | undefined
): Annotation {
  const data: DataAttributes = {
    anchorSource: result.source,
    reactFlowKind: result.source.replace('react-flow-', ''),
    ...(result.nodeId ? { reactFlowNodeId: result.nodeId } : {}),
    ...(result.edgeId ? { reactFlowEdgeId: result.edgeId } : {}),
    ...(result.handleId ? { reactFlowHandleId: result.handleId } : {}),
    ...(result.handleType ? { reactFlowHandleType: result.handleType } : {}),
    ...(result.handleSide ? { reactFlowHandleSide: result.handleSide } : {}),
    ...(result.sourceNodeId ? { reactFlowSourceNodeId: result.sourceNodeId } : {}),
    ...(result.targetNodeId ? { reactFlowTargetNodeId: result.targetNodeId } : {}),
    ...(result.sourceHandleId ? { reactFlowSourceHandleId: result.sourceHandleId } : {}),
    ...(result.targetHandleId ? { reactFlowTargetHandleId: result.targetHandleId } : {})
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

function edgePoints<TEdge extends ReactFlowEdgeLike, TNode extends ReactFlowNodeLike>(
  edge: TEdge,
  nodes: TNode[],
  viewport?: ReactFlowViewportLike,
  nodeOrigin?: [number, number]
): Point[] {
  const source = nodes.find((node) => node.id === edge.source);
  const target = nodes.find((node) => node.id === edge.target);

  if (!source || !target) {
    return [];
  }

  const sourceBox = nodeBox(source, viewport, nodeOrigin);
  const targetBox = nodeBox(target, viewport, nodeOrigin);
  const sourceHandle = edge.sourceHandle
    ? resolveEdgeHandleAnchor(source, edge.sourceHandle, 'source', viewport, nodeOrigin)
    : undefined;
  const targetHandle = edge.targetHandle
    ? resolveEdgeHandleAnchor(target, edge.targetHandle, 'target', viewport, nodeOrigin)
    : undefined;

  return [
    sourceHandle?.point ?? { x: sourceBox.x + sourceBox.width, y: sourceBox.y + sourceBox.height / 2 },
    targetHandle?.point ?? { x: targetBox.x, y: targetBox.y + targetBox.height / 2 }
  ];
}

function resolveEdgeHandleAnchor(
  node: ReactFlowNodeLike,
  handleId: string,
  type: ReactFlowHandleType,
  viewport: ReactFlowViewportLike | undefined,
  nodeOrigin: [number, number] | undefined
): { point: Point } | undefined {
  const handle = handlesForNode(node, type).find((item) => item.id === handleId && (!item.type || item.type === type));

  if (!handle) {
    return undefined;
  }

  const box = handleBox(node, handle, viewport, nodeOrigin);

  return {
    point: {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2
    }
  };
}

function reactFlowSpecExpectation(spec: ReactFlowAnchorSpec): string {
  if (spec.nodeId) {
    return `node id "${spec.nodeId}"`;
  }

  if (spec.handle) {
    const parts = [
      `node id "${spec.handle.nodeId}"`,
      spec.handle.id ? `handle id "${spec.handle.id}"` : '',
      spec.handle.type ? `handle type "${spec.handle.type}"` : '',
      spec.handle.side ? `side "${spec.handle.side}"` : ''
    ].filter(Boolean);

    return `handle on ${parts.join(', ')}`;
  }

  if (spec.edgeId) {
    return `edge id "${spec.edgeId}"`;
  }

  return 'nodeId, handle, or edgeId';
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

function inflateBox(box: Box, padding: number): Box {
  if (padding === 0) {
    return box;
  }

  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}
