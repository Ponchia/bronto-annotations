/**
 * DOM/SVG utility API stability.
 *
 * @public Stable for `0.1.x`: DOMRect, selector, SVG element, coordinate
 * conversion, validation, and prepared DOM annotation helpers.
 * @experimental No DOM subpath exports are experimental in the current `0.1.x`
 * contract; keep this note so new exports must be classified intentionally.
 */
import {
  boxCenter,
  expandBox,
  isFiniteBox,
  normalizeBox
} from '../core/anchors.js';
import {
  assertAnchorValidationReportIfRequested,
  anchorDiagnostic,
  type AdapterAnnotationLayerInput,
  type AnchorValidationAssertInput,
  type AnchorSpecValidationReport,
  validationReport
} from '../adapters/diagnostics.js';

export {
  assertAnchorAlignmentReport,
  assertAnchorAlignmentReportIfRequested,
  assertAnchorValidationReport,
  evaluateAnchorAlignment,
  formatAnchorAlignmentDiagnostic,
  formatAnchorAlignmentReport,
  formatAnchorDiagnostic,
  formatAnchorValidationReport
} from '../adapters/diagnostics.js';
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
} from '../adapters/diagnostics.js';
import type {
  Anchor,
  Annotation,
  Box,
  PaddingInput,
  PlacementSide,
  Point
} from '../core/model.js';

export type AnchorKind = 'box' | 'point' | 'path';

export type ElementAnchorOptions = {
  id?: string;
  side?: PlacementSide;
  kind?: AnchorKind;
  coordinateSpace?: Element | SVGSVGElement;
  inflate?: number;
  source?: string;
};

export type SelectorAnchorSpec = ElementAnchorOptions & {
  id?: string;
  selector: string;
};

export type SelectorObstacleSpec = ElementAnchorOptions & {
  selector: string;
};

export type DomAnnotationSpec = SelectorAnchorSpec & {
  note: Annotation['note'];
} & Partial<Omit<Annotation, 'anchor' | 'id' | 'note'>>;

export type DomAnchorValidationReport = AnchorSpecValidationReport;

export type DomAnnotationLayerInput = AdapterAnnotationLayerInput<DomAnchorValidationReport>;

export type DomAnnotationLayerOptions = {
  obstacles?: SelectorObstacleSpec[] | false;
  assert?: AnchorValidationAssertInput;
};

export type ExtractedAnchor = {
  id: string;
  anchor: Anchor;
  box: Box;
  point: Point;
  element?: Element;
  source: string;
};

export type RectLike = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SvgAnnotationFrameOptions = {
  padding?: PaddingInput;
  preserveAspectRatio?: string;
};

export type SvgAnnotationFrame = {
  bounds: Box;
  viewBox: string;
  preserveAspectRatio: string;
};

export function boxFromDOMRect(rect: RectLike): Box {
  if (rect.x !== undefined && rect.y !== undefined && rect.width !== undefined && rect.height !== undefined) {
    return normalizeBox({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });
  }

  return normalizeBox({
    x: rect.left,
    y: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top
  });
}

export function anchorFromDOMRect(
  rect: RectLike,
  options: ElementAnchorOptions = {}
): Anchor {
  return anchorFromBox(boxFromDOMRect(rect), options);
}

export function boxFromElement(element: Element, options: ElementAnchorOptions = {}): Box {
  const svg = svgCoordinateSpace(options.coordinateSpace ?? element);
  const bbox = svg ? boxFromSvgElement(element, svg) : undefined;
  const rawBox = bbox ?? boxFromClientElement(element, options.coordinateSpace);

  return inflateBox(rawBox, options.inflate ?? 0);
}

export function anchorFromElement(element: Element, options: ElementAnchorOptions = {}): Anchor {
  if (options.kind === 'path') {
    const points = pointsFromSvgPathElement(element, svgCoordinateSpace(options.coordinateSpace ?? element));

    if (points.length > 0) {
      return {
        type: 'path',
        points
      };
    }
  }

  return anchorFromBox(boxFromElement(element, options), options);
}

export function anchorFromSelector(
  root: ParentNode,
  selector: string,
  options: ElementAnchorOptions = {}
): ExtractedAnchor | undefined {
  const element = root.querySelector(selector);

  if (!element) {
    return undefined;
  }

  return extractedAnchorFromElement(element, {
    ...options,
    id: options.id ?? elementId(element) ?? selector
  });
}

export function anchorFromId(
  root: ParentNode,
  id: string,
  options: ElementAnchorOptions = {}
): ExtractedAnchor | undefined {
  return anchorFromSelector(root, `#${cssEscape(id)}`, {
    ...options,
    id
  });
}

export function anchorsFromSelectors(root: ParentNode, specs: SelectorAnchorSpec[]): ExtractedAnchor[] {
  return specs.flatMap((spec) => {
    const anchor = anchorFromSelector(root, spec.selector, spec);
    return anchor ? [anchor] : [];
  });
}

export function annotationsFromDomSelectors(root: ParentNode, specs: DomAnnotationSpec[]): Annotation[] {
  return specs.flatMap((spec) => {
    const anchor = anchorFromSelector(root, spec.selector, spec);

    if (!anchor) {
      return [];
    }

    return [annotationFromExtractedAnchor(anchor, spec)];
  });
}

export function validateDomAnchors(root: ParentNode, specs: SelectorAnchorSpec[]): DomAnchorValidationReport {
  return validationReport(specs.map((spec) => {
    const element = root.querySelector(spec.selector);
    const id = spec.id ?? spec.selector;

    if (!element) {
      return anchorDiagnostic({
        id,
        source: spec.source ?? 'dom',
        status: 'missing',
        expected: `selector "${spec.selector}"`,
        reason: 'No element matched the selector.'
      });
    }

    const box = boxFromElement(element, spec);

    if (!isFiniteBox(box)) {
      return anchorDiagnostic({
        id,
        source: spec.source ?? 'dom',
        status: 'invalid',
        expected: `finite geometry for selector "${spec.selector}"`,
        reason: 'The matched element did not produce finite geometry.'
      });
    }

    return anchorDiagnostic({
      id: spec.id ?? elementId(element) ?? spec.selector,
      source: spec.source ?? 'dom',
      status: 'found',
      expected: `selector "${spec.selector}"`
    });
  }));
}

export function prepareDomAnnotations(
  root: ParentNode,
  specs: DomAnnotationSpec[],
  options: DomAnnotationLayerOptions = {}
): DomAnnotationLayerInput {
  const validation = validateDomAnchors(root, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'DOM anchors' });

  return {
    annotations: annotationsFromDomSelectors(root, specs),
    obstacles: options.obstacles === false
      ? []
      : options.obstacles
        ? obstaclesFromSelectors(root, options.obstacles)
        : [],
    validation
  };
}

export function extractedAnchorFromElement(
  element: Element,
  options: ElementAnchorOptions = {}
): ExtractedAnchor {
  const box = boxFromElement(element, options);
  const anchor = anchorFromElement(element, options);
  const point = anchor.type === 'path'
    ? anchor.points[Math.floor(anchor.points.length / 2)] ?? boxCenter(box)
    : boxCenter(box);
  const id = options.id ?? elementId(element) ?? options.source ?? 'anchor';

  return {
    id,
    anchor,
    box,
    point,
    element,
    source: options.source ?? 'dom'
  };
}

export function anchorFromBox(box: Box, options: ElementAnchorOptions = {}): Anchor {
  if (options.kind === 'path') {
    return {
      type: 'path',
      points: [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y + box.height }
      ]
    };
  }

  if (options.kind === 'point') {
    return {
      type: 'point',
      point: boxCenter(box)
    };
  }

  return {
    type: 'box',
    box,
    ...(options.side ? { side: options.side } : {})
  };
}

export function obstaclesFromElements(
  elements: Iterable<Element>,
  options: ElementAnchorOptions = {}
): Box[] {
  return Array.from(elements, (element) => boxFromElement(element, options));
}

export function obstaclesFromSelector(
  root: ParentNode,
  selector: string,
  options: ElementAnchorOptions = {}
): Box[] {
  return obstaclesFromElements(root.querySelectorAll(selector), options);
}

export function obstaclesFromSelectors(root: ParentNode, specs: SelectorObstacleSpec[]): Box[] {
  return specs.flatMap((spec) => obstaclesFromSelector(root, spec.selector, spec));
}

function annotationFromExtractedAnchor(anchor: ExtractedAnchor, spec: DomAnnotationSpec): Annotation {
  return {
    id: anchor.id,
    anchor: anchor.anchor,
    note: spec.note,
    ...(spec.placement ? { placement: spec.placement } : {}),
    ...(spec.subject ? { subject: spec.subject } : {}),
    ...(spec.connector ? { connector: spec.connector } : {}),
    ...(spec.variant ? { variant: spec.variant } : {}),
    ...(spec.tone ? { tone: spec.tone } : {}),
    ...(spec.motion ? { motion: spec.motion } : {}),
    ...(spec.style ? { style: spec.style } : {}),
    ...(spec.priority !== undefined ? { priority: spec.priority } : {}),
    ...(spec.className ? { className: spec.className } : {}),
    data: {
      anchorSource: anchor.source,
      domSelector: spec.selector,
      ...(anchor.element ? { domElementId: elementId(anchor.element) ?? anchor.id } : {}),
      ...(spec.data ?? {})
    },
    ...(spec.metadata ? { metadata: spec.metadata } : {})
  };
}

export function svgPointFromClient(svg: SVGSVGElement, point: Point): Point {
  if (typeof svg.createSVGPoint === 'function') {
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = point.x;
    svgPoint.y = point.y;
    const matrix = svg.getScreenCTM?.();

    if (matrix) {
      const transformed = svgPoint.matrixTransform(matrix.inverse());
      return {
        x: transformed.x,
        y: transformed.y
      };
    }
  }

  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;

  if (viewBox && rect.width > 0 && rect.height > 0) {
    const transform = svgClientTransform(svg, rect, viewBox);

    return {
      x: viewBox.x + (point.x - transform.x) / transform.scaleX,
      y: viewBox.y + (point.y - transform.y) / transform.scaleY
    };
  }

  return point;
}

export function clientBoxToSvgBox(svg: SVGSVGElement, box: Box): Box {
  const topLeft = svgPointFromClient(svg, { x: box.x, y: box.y });
  const bottomRight = svgPointFromClient(svg, {
    x: box.x + box.width,
    y: box.y + box.height
  });

  return normalizeBox({
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  });
}

export function annotationFrameFromSvg(
  svg: SVGSVGElement,
  options: SvgAnnotationFrameOptions = {}
): SvgAnnotationFrame {
  const bounds = expandBox(svgViewBoxBox(svg), options.padding ?? 0);
  const preserveAspectRatio = options.preserveAspectRatio
    ?? svg.getAttribute('preserveAspectRatio')
    ?? 'xMidYMid meet';

  return {
    bounds,
    viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
    preserveAspectRatio
  };
}

export function boxFromSvgElement(element: Element, coordinateSpace?: SVGSVGElement): Box | undefined {
  const svg = coordinateSpace ?? svgCoordinateSpace(element);

  if (!svg) {
    return undefined;
  }

  const bbox = transformedElementBBox(element, svg);

  if (bbox) {
    return bbox;
  }

  const clientBox = elementClientBox(element);

  if (clientBox && clientBox.width > 0 && clientBox.height > 0) {
    return clientBoxToSvgBox(svg, clientBox);
  }

  return undefined;
}

function svgViewBoxBox(svg: SVGSVGElement): Box {
  const viewBox = svg.viewBox?.baseVal;

  if (viewBox && isFiniteSvgBox(viewBox)) {
    return normalizeBox({
      x: viewBox.x,
      y: viewBox.y,
      width: viewBox.width,
      height: viewBox.height
    });
  }

  const parsed = parseViewBox(svg.getAttribute('viewBox'));

  if (parsed) {
    return parsed;
  }

  const width = finiteSvgLength(svg.getAttribute('width'));
  const height = finiteSvgLength(svg.getAttribute('height'));

  if (width !== undefined && height !== undefined) {
    return { x: 0, y: 0, width, height };
  }

  const clientBox = elementClientBox(svg);

  return clientBox && clientBox.width > 0 && clientBox.height > 0
    ? { x: 0, y: 0, width: clientBox.width, height: clientBox.height }
    : { x: 0, y: 0, width: 0, height: 0 };
}

function isFiniteSvgBox(box: { x: number; y: number; width: number; height: number }): boolean {
  return Number.isFinite(box.x)
    && Number.isFinite(box.y)
    && Number.isFinite(box.width)
    && Number.isFinite(box.height)
    && box.width > 0
    && box.height > 0;
}

function parseViewBox(value: string | null): Box | undefined {
  const parts = value?.trim().split(/[\s,]+/).map(Number);

  if (!parts || parts.length !== 4 || !parts.every(Number.isFinite)) {
    return undefined;
  }

  return normalizeBox({
    x: parts[0]!,
    y: parts[1]!,
    width: parts[2]!,
    height: parts[3]!
  });
}

function finiteSvgLength(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^-?\d+(?:\.\d+)?/.exec(value.trim());
  const numeric = match ? Number(match[0]) : Number.NaN;

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function boxFromClientElement(element: Element, coordinateSpace?: Element | SVGSVGElement): Box {
  const box = elementClientBox(element) ?? { x: 0, y: 0, width: 0, height: 0 };

  if (!coordinateSpace || coordinateSpace === element) {
    return box;
  }

  const parentBox = elementClientBox(coordinateSpace);

  if (!parentBox) {
    return box;
  }

  return {
    x: box.x - parentBox.x,
    y: box.y - parentBox.y,
    width: box.width,
    height: box.height
  };
}

function elementClientBox(element: Element): Box | undefined {
  if (typeof element.getBoundingClientRect !== 'function') {
    return undefined;
  }

  const rect = element.getBoundingClientRect();

  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) {
    return undefined;
  }

  return boxFromDOMRect(rect);
}

function elementBBox(element: Element): Box | undefined {
  const getBBox = (element as SVGGraphicsElement).getBBox;

  if (typeof getBBox !== 'function') {
    return undefined;
  }

  const box = getBBox.call(element);

  if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) {
    return undefined;
  }

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height
  };
}

function transformedElementBBox(element: Element, svg: SVGSVGElement): Box | undefined {
  const box = elementBBox(element);

  if (!box || box.width <= 0 || box.height <= 0) {
    return box;
  }

  const elementMatrix = (element as SVGGraphicsElement).getScreenCTM?.();
  const svgMatrix = svg.getScreenCTM?.();

  if (elementMatrix && svgMatrix && typeof DOMPoint !== 'undefined') {
    const inverse = svgMatrix.inverse();
    return boxFromTransformedCorners(box, (point) => {
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(elementMatrix);
      const svgPoint = screenPoint.matrixTransform(inverse);

      return {
        x: svgPoint.x,
        y: svgPoint.y
      };
    });
  }

  const localMatrix = (element as SVGGraphicsElement).getCTM?.();

  if (localMatrix && typeof DOMPoint !== 'undefined') {
    return boxFromTransformedCorners(box, (point) => {
      const svgPoint = new DOMPoint(point.x, point.y).matrixTransform(localMatrix);

      return {
        x: svgPoint.x,
        y: svgPoint.y
      };
    });
  }

  return normalizeBox(box);
}

function boxFromTransformedCorners(box: Box, transform: (point: Point) => Point): Box {
  const points = [
    transform({ x: box.x, y: box.y }),
    transform({ x: box.x + box.width, y: box.y }),
    transform({ x: box.x + box.width, y: box.y + box.height }),
    transform({ x: box.x, y: box.y + box.height })
  ];
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

function pointsFromSvgPathElement(element: Element, coordinateSpace?: SVGSVGElement): Point[] {
  const path = element as SVGGeometryElement;

  if (typeof path.getTotalLength !== 'function' || typeof path.getPointAtLength !== 'function') {
    return [];
  }

  const length = path.getTotalLength();

  if (!Number.isFinite(length) || length <= 0) {
    return [];
  }

  const samples = Math.max(2, Math.min(24, Math.ceil(length / 32)));
  const points: Point[] = [];

  for (let index = 0; index < samples; index += 1) {
    const ratio = samples === 1 ? 0 : index / (samples - 1);
    const point = path.getPointAtLength(length * ratio);
    points.push(transformSvgElementPoint(element, coordinateSpace, { x: point.x, y: point.y }));
  }

  return points;
}

function transformSvgElementPoint(element: Element, svg: SVGSVGElement | undefined, point: Point): Point {
  if (!svg || typeof DOMPoint === 'undefined') {
    return point;
  }

  const elementMatrix = (element as SVGGraphicsElement).getScreenCTM?.();
  const svgMatrix = svg.getScreenCTM?.();

  if (elementMatrix && svgMatrix) {
    const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(elementMatrix);
    const svgPoint = screenPoint.matrixTransform(svgMatrix.inverse());

    return {
      x: svgPoint.x,
      y: svgPoint.y
    };
  }

  const localMatrix = (element as SVGGraphicsElement).getCTM?.();

  if (localMatrix) {
    const svgPoint = new DOMPoint(point.x, point.y).matrixTransform(localMatrix);

    return {
      x: svgPoint.x,
      y: svgPoint.y
    };
  }

  return point;
}

function svgCoordinateSpace(element: Element | SVGSVGElement): SVGSVGElement | undefined {
  if (isSvgSvgElement(element)) {
    return element;
  }

  return (element as SVGGraphicsElement).ownerSVGElement ?? undefined;
}

function isSvgSvgElement(element: Element): element is SVGSVGElement {
  return element.tagName.toLowerCase() === 'svg';
}

function svgClientTransform(
  svg: SVGSVGElement,
  rect: { left: number; top: number; width: number; height: number },
  viewBox: { x: number; y: number; width: number; height: number }
): { x: number; y: number; scaleX: number; scaleY: number } {
  const preserveAspectRatio = svg.getAttribute('preserveAspectRatio') ?? 'xMidYMid meet';
  const scaleX = rect.width / viewBox.width;
  const scaleY = rect.height / viewBox.height;

  if (preserveAspectRatio.includes('none')) {
    return {
      x: rect.left,
      y: rect.top,
      scaleX,
      scaleY
    };
  }

  const scale = preserveAspectRatio.includes('slice')
    ? Math.max(scaleX, scaleY)
    : Math.min(scaleX, scaleY);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;

  return {
    x: rect.left + alignedOffset(rect.width - renderedWidth, preserveAspectRatio, 'x'),
    y: rect.top + alignedOffset(rect.height - renderedHeight, preserveAspectRatio, 'y'),
    scaleX: scale,
    scaleY: scale
  };
}

function alignedOffset(extra: number, preserveAspectRatio: string, axis: 'x' | 'y'): number {
  if (axis === 'x') {
    if (preserveAspectRatio.includes('xMin')) {
      return 0;
    }

    if (preserveAspectRatio.includes('xMax')) {
      return extra;
    }
  }

  if (axis === 'y') {
    if (preserveAspectRatio.includes('YMin')) {
      return 0;
    }

    if (preserveAspectRatio.includes('YMax')) {
      return extra;
    }
  }

  return extra / 2;
}

function inflateBox(box: Box, amount: number): Box {
  if (amount === 0) {
    return box;
  }

  return {
    x: box.x - amount,
    y: box.y - amount,
    width: box.width + amount * 2,
    height: box.height + amount * 2
  };
}

function elementId(element: Element): string | undefined {
  return element.id || element.getAttribute('data-id') || element.getAttribute('data-anchor-id') || undefined;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["#.:,[\]>+~*^$|=\\]/g, '\\$&');
}
