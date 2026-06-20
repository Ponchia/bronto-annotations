/**
 * Vega adapter API stability.
 *
 * @public Stable for `0.1.x`: view, scale, scenegraph, rendered SVG anchor
 * extraction, prepared annotation helpers, obstacle helpers, validation, and
 * target-alignment diagnostics.
 * @experimental During `0.x`: low-level datum-to-anchor conversion and rendered
 * SVG finder helpers.
 */
import {
  anchorFromBox,
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

export type VegaAnchorDiagnostic = AnchorSpecDiagnostic;
export type VegaAnchorValidationReport = AnchorSpecValidationReport;
export type VegaAnnotationLayerInput = AdapterAnnotationLayerInput<VegaAnchorValidationReport>;

export type VegaAnnotationAuthoring = {
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

type FieldAccessor<T> = keyof T | string | number | ((datum: T, index: number) => unknown);

type VegaSvgElementMatcher = {
  markName?: string;
  markType?: string;
  role?: string;
};

type VegaViewGeometrySpec<TDatum = Record<string, unknown>> = {
  data?: string;
  datum?: (datum: TDatum, index: number) => boolean;
  point?: (datum: TDatum, index: number) => Point;
  box?: (datum: TDatum, index: number) => Box;
  x?: FieldAccessor<TDatum>;
  y?: FieldAccessor<TDatum>;
  x2?: FieldAccessor<TDatum>;
  y2?: FieldAccessor<TDatum>;
  width?: FieldAccessor<TDatum>;
  height?: FieldAccessor<TDatum>;
  offset?: Point;
};

type VegaScaleGeometrySpec<TDatum = Record<string, unknown>> = {
  data?: string;
  datum?: (datum: TDatum, index: number) => boolean;
  xScale: string;
  yScale: string;
  x: FieldAccessor<TDatum>;
  y: FieldAccessor<TDatum>;
  x2?: FieldAccessor<TDatum>;
  y2?: FieldAccessor<TDatum>;
  width?: FieldAccessor<TDatum>;
  height?: FieldAccessor<TDatum>;
  offset?: Point;
};

type VegaViewPadding = number | Partial<{ top: number; left: number; right: number; bottom: number }>;

type VegaViewPaddingAccessor =
  | (() => VegaViewPadding)
  | {
    (): VegaViewPadding;
    (padding: VegaViewPadding): unknown;
  };

type VegaViewOriginAccessor = () => [number, number] | Partial<Point>;

export type VegaViewLike<TDatum = Record<string, unknown>> = {
  data(name?: string): TDatum[];
  padding?: VegaViewPaddingAccessor;
  origin?: VegaViewOriginAccessor;
};

export type VegaScaleFunction = {
  (value: unknown): number;
  bandwidth?: () => number;
};

export type VegaScaleViewLike<TDatum = Record<string, unknown>> = VegaViewLike<TDatum> & {
  scale(name: string): VegaScaleFunction;
};

export type VegaScenegraphBounds = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type VegaScenegraphItem<TDatum = unknown> = {
  name?: string;
  role?: string;
  marktype?: string;
  mark?: {
    name?: string;
    role?: string;
    marktype?: string;
  };
  datum?: TDatum;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  bounds?: VegaScenegraphBounds;
  items?: Array<VegaScenegraphItem<TDatum>>;
};

export type VegaScenegraphViewLike<TDatum = unknown> = {
  scenegraph(): { root?: VegaScenegraphItem<TDatum> } | VegaScenegraphItem<TDatum>;
  padding?: VegaViewPaddingAccessor;
  origin?: VegaViewOriginAccessor;
};

export type VegaViewAnchorSpec<TDatum = Record<string, unknown>> = VegaAnnotationAuthoring & VegaViewGeometrySpec<TDatum> & {
  id: string;
};

export type VegaViewObstacleOptions<TDatum = Record<string, unknown>> = VegaViewGeometrySpec<TDatum> & {
  padding?: number;
};

export type VegaScaleAnchorSpec<TDatum = Record<string, unknown>> = VegaAnnotationAuthoring & VegaScaleGeometrySpec<TDatum> & {
  id: string;
};

export type VegaScaleObstacleOptions<TDatum = Record<string, unknown>> = VegaScaleGeometrySpec<TDatum> & {
  padding?: number;
};

export type VegaScenegraphAnchorSpec<TDatum = unknown> = VegaAnnotationAuthoring & {
  id: string;
  markName?: string;
  markType?: string;
  role?: string;
  datum?: (datum: TDatum | undefined, item: VegaScenegraphItem<TDatum>, index: number) => boolean;
  offset?: Point;
};

export type VegaSvgAnchorSpec = ElementAnchorOptions & {
  id: string;
  selector?: string;
  markName?: string;
  markType?: string;
  role?: string;
};

export type VegaSvgAnnotationSpec = VegaSvgAnchorSpec & VegaAnnotationAuthoring;

export type VegaScenegraphObstacleOptions<TDatum = unknown> = {
  markName?: string;
  markType?: string;
  role?: string;
  datum?: (datum: TDatum | undefined, item: VegaScenegraphItem<TDatum>, index: number) => boolean;
  padding?: number;
};

export type VegaSvgObstacleOptions = ElementAnchorOptions & {
  selector?: string;
  markName?: string;
  markType?: string;
  role?: string;
  padding?: number;
};

export type VegaAnnotationLayerOptions<TObstacleOptions> = {
  obstacles?: TObstacleOptions | false;
  assert?: AnchorValidationAssertInput;
};

export type VegaAnchorResult<TDatum = unknown> = ExtractedAnchor & {
  datum?: TDatum;
  index?: number;
  data?: string;
  markName?: string;
  markType?: string;
  role?: string;
  selector?: string;
  elementId?: string;
};

export function anchorsFromVegaView<TDatum>(
  view: VegaViewLike<TDatum>,
  specs: Array<VegaViewAnchorSpec<TDatum>>
): Array<VegaAnchorResult<TDatum>> {
  return specs.flatMap((spec) => {
    const data = view.data(spec.data);
    const index = data.findIndex((datum, datumIndex) => spec.datum ? spec.datum(datum, datumIndex) : datumIndex === 0);
    const datum = data[index];

    if (!datum) {
      return [];
    }

    const anchor = translateAnchor(anchorFromVegaDatum(datum, spec, index), spec.offset ?? { x: 0, y: 0 });
    const box = boxFromAnchor(anchor);
    const point = pointFromAnchor(anchor, box);

    const result: VegaAnchorResult<TDatum> = {
      id: spec.id,
      anchor,
      box,
      point,
      source: 'vega-view',
      datum,
      index,
      ...(spec.data ? { data: spec.data } : {})
    };

    return [result];
  });
}

export function validateVegaViewAnchors<TDatum>(
  view: VegaViewLike<TDatum>,
  specs: Array<VegaViewAnchorSpec<TDatum>>
): VegaAnchorValidationReport {
  return validationReport(specs.map((spec) => validateVegaSpec(
    spec.id,
    'vega-view',
    vegaViewSpecExpectation(spec),
    () => anchorsFromVegaView(view, [spec]).length > 0
  )));
}

export function annotationsFromVegaView<TDatum>(
  view: VegaViewLike<TDatum>,
  specs: Array<VegaViewAnchorSpec<TDatum>>
): Annotation[] {
  const anchors = anchorsFromVegaView(view, specs);

  return anchors.map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromAnchorResult(result, spec);
  });
}

export function prepareVegaViewAnnotations<TDatum>(
  view: VegaViewLike<TDatum>,
  specs: Array<VegaViewAnchorSpec<TDatum>>,
  options: VegaAnnotationLayerOptions<VegaViewObstacleOptions<TDatum>> = {}
): VegaAnnotationLayerInput {
  const validation = validateVegaViewAnchors(view, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'Vega view anchors' });

  return {
    annotations: annotationsFromVegaView(view, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromVegaView(view, options.obstacles ?? specs),
    validation
  };
}

export function obstaclesFromVegaView<TDatum>(
  view: VegaViewLike<TDatum>,
  options: VegaViewObstacleOptions<TDatum> | Array<VegaViewObstacleOptions<TDatum>> = {}
): Box[] {
  return asArray(options).flatMap((option) => {
    if (!hasVegaViewGeometry(option)) {
      return [];
    }

    return view.data(option.data)
      .flatMap((datum, index) => {
        if (option.datum && !option.datum(datum, index)) {
          return [];
        }

        const anchor = translateAnchor(anchorFromVegaDatum(datum, { id: 'obstacle', ...option }, index), option.offset ?? { x: 0, y: 0 });

        return [inflateBox(boxFromAnchor(anchor), option.padding ?? 0)];
      });
  });
}

export function anchorsFromVegaScales<TDatum>(
  view: VegaScaleViewLike<TDatum>,
  specs: Array<VegaScaleAnchorSpec<TDatum>>
): Array<VegaAnchorResult<TDatum>> {
  return specs.flatMap((spec) => {
    const data = view.data(spec.data);
    const index = data.findIndex((datum, datumIndex) => spec.datum ? spec.datum(datum, datumIndex) : datumIndex === 0);
    const datum = data[index];

    if (!datum) {
      return [];
    }

    const anchor = anchorFromVegaScaleDatum(view, datum, spec, index, spec.id);
    const box = boxFromAnchor(anchor);
    const point = pointFromAnchor(anchor, box);

    return [{
      id: spec.id,
      anchor,
      box,
      point,
      source: 'vega-scale',
      datum,
      index,
      ...(spec.data ? { data: spec.data } : {})
    }];
  });
}

export function validateVegaScaleAnchors<TDatum>(
  view: VegaScaleViewLike<TDatum>,
  specs: Array<VegaScaleAnchorSpec<TDatum>>
): VegaAnchorValidationReport {
  return validationReport(specs.map((spec) => validateVegaSpec(
    spec.id,
    'vega-scale',
    vegaScaleSpecExpectation(spec),
    () => anchorsFromVegaScales(view, [spec]).length > 0
  )));
}

export function annotationsFromVegaScales<TDatum>(
  view: VegaScaleViewLike<TDatum>,
  specs: Array<VegaScaleAnchorSpec<TDatum>>
): Annotation[] {
  return anchorsFromVegaScales(view, specs).map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromAnchorResult(result, spec);
  });
}

export function prepareVegaScaleAnnotations<TDatum>(
  view: VegaScaleViewLike<TDatum>,
  specs: Array<VegaScaleAnchorSpec<TDatum>>,
  options: VegaAnnotationLayerOptions<VegaScaleObstacleOptions<TDatum>> = {}
): VegaAnnotationLayerInput {
  const validation = validateVegaScaleAnchors(view, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'Vega scale anchors' });

  return {
    annotations: annotationsFromVegaScales(view, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromVegaScales(view, options.obstacles ?? specs),
    validation
  };
}

export function obstaclesFromVegaScales<TDatum>(
  view: VegaScaleViewLike<TDatum>,
  options: VegaScaleObstacleOptions<TDatum> | Array<VegaScaleObstacleOptions<TDatum>>
): Box[] {
  return asArray(options).flatMap((option) => view.data(option.data)
    .flatMap((datum, index) => {
      if (option.datum && !option.datum(datum, index)) {
        return [];
      }

      const anchor = anchorFromVegaScaleDatum(view, datum, option, index, 'obstacle');

      return [inflateBox(boxFromAnchor(anchor), option.padding ?? 0)];
    }));
}

export function anchorsFromVegaScenegraph<TDatum>(
  view: VegaScenegraphViewLike<TDatum>,
  specs: Array<VegaScenegraphAnchorSpec<TDatum>>
): Array<VegaAnchorResult<TDatum>> {
  const items = flattenVegaScenegraph(view);

  return specs.flatMap((spec) => {
    const index = items.findIndex((item, itemIndex) => matchesScenegraphSpec(item, spec, itemIndex));
    const item = items[index];

    if (!item) {
      return [];
    }

    const box = translateBox(boxFromVegaScenegraphItem(item), spec.offset ?? viewOrigin(view));
    const anchor = anchorFromBox(box);
    const markName = scenegraphName(item);
    const markType = scenegraphMarkType(item);
    const role = scenegraphRole(item);

    return [{
      id: spec.id,
      anchor,
      box,
      point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      source: 'vega-scenegraph',
      ...(item.datum !== undefined ? { datum: item.datum } : {}),
      index,
      ...(markName ? { markName } : {}),
      ...(markType ? { markType } : {}),
      ...(role ? { role } : {})
    }];
  });
}

export function validateVegaScenegraphAnchors<TDatum>(
  view: VegaScenegraphViewLike<TDatum>,
  specs: Array<VegaScenegraphAnchorSpec<TDatum>>
): VegaAnchorValidationReport {
  return validationReport(specs.map((spec) => validateVegaSpec(
    spec.id,
    'vega-scenegraph',
    vegaScenegraphSpecExpectation(spec),
    () => anchorsFromVegaScenegraph(view, [spec]).length > 0
  )));
}

export function annotationsFromVegaScenegraph<TDatum>(
  view: VegaScenegraphViewLike<TDatum>,
  specs: Array<VegaScenegraphAnchorSpec<TDatum>>
): Annotation[] {
  return anchorsFromVegaScenegraph(view, specs).map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromAnchorResult(result, spec);
  });
}

export function prepareVegaScenegraphAnnotations<TDatum>(
  view: VegaScenegraphViewLike<TDatum>,
  specs: Array<VegaScenegraphAnchorSpec<TDatum>>,
  options: VegaAnnotationLayerOptions<VegaScenegraphObstacleOptions<TDatum>> = {}
): VegaAnnotationLayerInput {
  const validation = validateVegaScenegraphAnchors(view, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'Vega scenegraph anchors' });

  return {
    annotations: annotationsFromVegaScenegraph(view, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromVegaScenegraph(view, options.obstacles ?? {}),
    validation
  };
}

export function obstaclesFromVegaScenegraph<TDatum>(
  view: VegaScenegraphViewLike<TDatum>,
  options: VegaScenegraphObstacleOptions<TDatum> = {}
): Box[] {
  return flattenVegaScenegraph(view)
    .filter((item, index) => hasScenegraphFilter(options)
      ? matchesScenegraphSpec(item, { id: 'obstacle', ...options }, index)
      : hasGeometry(item))
    .map((item) => inflateBox(translateBox(boxFromVegaScenegraphItem(item), viewOrigin(view)), options.padding ?? 0));
}

export function anchorsFromVegaSvg(root: ParentNode, specs: VegaSvgAnchorSpec[]): Array<VegaAnchorResult<unknown>> {
  return specs.flatMap((spec) => {
    const element = findVegaSvgElement(root, spec);

    if (!element) {
      return [];
    }

    const anchorElement = vegaSvgAnchorGeometryElement(element);
    const result = extractedAnchorFromElement(anchorElement, {
      ...spec,
      source: spec.source ?? 'vega-svg'
    });
    const elementId = element.getAttribute('id') ?? undefined;
    const selector = spec.selector ?? selectorForMark(spec);

    return [{
      ...result,
      ...(spec.markName ? { markName: spec.markName } : {}),
      ...(spec.markType ? { markType: spec.markType } : {}),
      ...(spec.role ? { role: spec.role } : {}),
      ...(selector ? { selector } : {}),
      ...(elementId ? { elementId } : {})
    }];
  });
}

export function validateVegaSvgAnchors(root: ParentNode, specs: VegaSvgAnchorSpec[]): VegaAnchorValidationReport {
  return validationReport(specs.map((spec) => {
    const element = findVegaSvgElement(root, spec);
    const expected = vegaSvgSpecExpectation(spec);

    return anchorDiagnostic({
      id: spec.id,
      source: 'vega-svg',
      status: element ? 'found' : 'missing',
      expected,
      ...(element ? {} : { reason: `No rendered Vega SVG element matched ${expected}.` })
    });
  }));
}

export function annotationsFromVegaSvg(root: ParentNode, specs: VegaSvgAnnotationSpec[]): Annotation[] {
  const anchors = anchorsFromVegaSvg(root, specs);

  return anchors.map((result) => {
    const spec = specs.find((item) => (item.id ?? item.selector) === result.id);

    return annotationFromAnchorResult(result, spec);
  });
}

export function prepareVegaSvgAnnotations(
  root: ParentNode,
  specs: VegaSvgAnnotationSpec[],
  options: VegaAnnotationLayerOptions<VegaSvgObstacleOptions> = {}
): VegaAnnotationLayerInput {
  const validation = validateVegaSvgAnchors(root, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'Vega SVG anchors' });

  return {
    annotations: annotationsFromVegaSvg(root, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromVegaSvg(root, options.obstacles ?? {}),
    validation
  };
}

export function obstaclesFromVegaSvg(root: ParentNode, options: VegaSvgObstacleOptions = {}): Box[] {
  const elements = vegaSvgObstacleElements(root, options);

  return obstaclesFromElements(elements, {
    ...options,
    inflate: (options.inflate ?? 0) + (options.padding ?? 0),
    source: options.source ?? 'vega-svg-obstacle'
  });
}

export function findVegaSvgElement(root: ParentNode, spec: VegaSvgAnchorSpec): Element | undefined {
  if (spec.selector) {
    return root.querySelector(spec.selector) ?? undefined;
  }

  return Array.from(root.querySelectorAll('*')).find((element) => matchesVegaSvgElement(element, spec));
}

function vegaSvgObstacleElements(root: ParentNode, options: VegaSvgObstacleOptions): Element[] {
  if (options.selector) {
    return Array.from(root.querySelectorAll(options.selector));
  }

  const hasFilter = Boolean(options.markName || options.markType || options.role);
  const candidates = hasFilter
    ? Array.from(root.querySelectorAll('*'))
      .filter((element) => matchesVegaSvgElement(element, options))
    : Array.from(root.querySelectorAll([
      '[class*="mark-"]',
      '[data-mark-name]',
      '[data-mark-type]',
      '[data-role="mark"]',
      '[role="mark"]'
    ].join(', ')));

  return uniqueElements(candidates.flatMap((element) => vegaSvgObstacleGeometryElements(element)));
}

function vegaSvgAnchorGeometryElement(element: Element): Element {
  const descendants = vegaSvgGeometryDescendants(element);

  return descendants.length === 1 ? descendants[0] ?? element : element;
}

function vegaSvgObstacleGeometryElements(element: Element): Element[] {
  const descendants = vegaSvgGeometryDescendants(element);

  return descendants.length > 0 ? descendants : [element];
}

function vegaSvgGeometryDescendants(element: Element): Element[] {
  return Array.from(element.querySelectorAll('path, rect, circle, ellipse, line, polygon, polyline, text, image'))
    .filter((candidate) => !candidate.closest('defs'));
}

function uniqueElements(elements: Element[]): Element[] {
  return Array.from(new Set(elements));
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function anchorFromVegaDatum<TDatum>(
  datum: TDatum,
  spec: VegaViewAnchorSpec<TDatum>,
  index = 0
): Anchor {
  if (spec.box) {
    return anchorFromBox(spec.box(datum, index));
  }

  if (spec.point) {
    return {
      type: 'point',
      point: spec.point(datum, index)
    };
  }

  const x = readNumber(datum, spec.x, index);
  const y = readNumber(datum, spec.y, index);
  const width = readNumber(datum, spec.width, index);
  const height = readNumber(datum, spec.height, index);
  const x2 = readNumber(datum, spec.x2, index);
  const y2 = readNumber(datum, spec.y2, index);

  if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
    return anchorFromBox({ x, y, width, height });
  }

  if (x !== undefined && y !== undefined && x2 !== undefined && y2 !== undefined) {
    return anchorFromBox({
      x: Math.min(x, x2),
      y: Math.min(y, y2),
      width: Math.abs(x2 - x),
      height: Math.abs(y2 - y)
    });
  }

  if (x !== undefined && y !== undefined) {
    return {
      type: 'point',
      point: { x, y }
    };
  }

  throw new Error(`Vega anchor "${spec.id}" needs point, box, x/y, or x/y/width/height accessors.`);
}

function hasVegaViewGeometry<TDatum>(options: VegaViewObstacleOptions<TDatum>): boolean {
  return Boolean(options.point || options.box || (options.x !== undefined && options.y !== undefined));
}

function readNumber<TDatum>(
  datum: TDatum,
  accessor: FieldAccessor<TDatum> | undefined,
  index: number
): number | undefined {
  if (accessor === undefined) {
    return undefined;
  }

  const value = typeof accessor === 'function'
    ? accessor(datum, index)
    : (datum as Record<string | number | symbol, unknown>)[accessor as string | number | symbol];
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : undefined;
}

function readOptional<TDatum>(
  datum: TDatum,
  accessor: FieldAccessor<TDatum> | undefined,
  index: number
): unknown {
  if (accessor === undefined) {
    return undefined;
  }

  return typeof accessor === 'function'
    ? accessor(datum, index)
    : (datum as Record<string | number | symbol, unknown>)[accessor as string | number | symbol];
}

function readRequired<TDatum>(
  datum: TDatum,
  accessor: FieldAccessor<TDatum>,
  index: number,
  id: string,
  field: string
): unknown {
  const value = readOptional(datum, accessor, index);

  if (value === undefined || value === null) {
    throw new Error(`Vega scale anchor "${id}" needs a ${field} value.`);
  }

  return value;
}

function anchorFromVegaScaleDatum<TDatum>(
  view: VegaScaleViewLike<TDatum>,
  datum: TDatum,
  spec: VegaScaleGeometrySpec<TDatum>,
  index: number,
  id: string
): Anchor {
  const xScale = view.scale(spec.xScale);
  const yScale = view.scale(spec.yScale);
  const xValue = readRequired(datum, spec.x, index, id, 'x');
  const yValue = readRequired(datum, spec.y, index, id, 'y');
  const x = xScale(xValue);
  const y = yScale(yValue);
  const width = readNumber(datum, spec.width, index) ?? xScale.bandwidth?.();
  const height = readNumber(datum, spec.height, index) ?? yScale.bandwidth?.();
  const x2Value = readOptional(datum, spec.x2, index);
  const y2Value = readOptional(datum, spec.y2, index);
  const scaledGeometry = {
    x,
    y,
    ...(x2Value === undefined ? {} : { x2: xScale(x2Value) }),
    ...(y2Value === undefined ? {} : { y2: yScale(y2Value) }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height })
  };

  return translateAnchor(anchorFromScaledGeometry(scaledGeometry), spec.offset ?? viewOrigin(view));
}

function anchorFromScaledGeometry(input: {
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
}): Anchor {
  if (input.width !== undefined && input.height !== undefined) {
    return anchorFromBox({
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height
    });
  }

  if (input.x2 !== undefined && input.y2 !== undefined) {
    return anchorFromBox({
      x: Math.min(input.x, input.x2),
      y: Math.min(input.y, input.y2),
      width: Math.abs(input.x2 - input.x),
      height: Math.abs(input.y2 - input.y)
    });
  }

  return {
    type: 'point',
    point: {
      x: input.x,
      y: input.y
    }
  };
}

function selectorForMark(spec: VegaSvgAnchorSpec): string | undefined {
  if (spec.selector) {
    return spec.selector;
  }

  const selectors: string[] = [];

  if (spec.markType) {
    selectors.push(`.mark-${cssEscape(spec.markType)}`);
  }

  if (spec.markName) {
    selectors.push(`.${cssEscape(spec.markName)}`, `[data-mark-name="${attributeEscape(spec.markName)}"]`);
  }

  if (spec.role) {
    selectors.push(`.role-${cssEscape(spec.role)}`, `[data-role="${attributeEscape(spec.role)}"]`);
  }

  return selectors.length > 0 ? selectors.join(', ') : undefined;
}

function validateVegaSpec(
  id: string,
  source: string,
  expected: string,
  resolve: () => boolean
): VegaAnchorDiagnostic {
  try {
    const found = resolve();

    return anchorDiagnostic({
      id,
      source,
      status: found ? 'found' : 'missing',
      expected,
      ...(found ? {} : { reason: `No ${source} anchor matched ${expected}.` })
    });
  } catch (error) {
    return anchorDiagnostic({
      id,
      source,
      status: 'invalid',
      expected,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

function vegaViewSpecExpectation<TDatum>(spec: VegaViewAnchorSpec<TDatum>): string {
  const data = spec.data ? `data "${spec.data}"` : 'default data';
  const geometry = spec.point ? 'point callback' : spec.box ? 'box callback' : `fields ${fieldList(spec.x, spec.y, spec.width, spec.height, spec.x2, spec.y2)}`;

  return `${data} with ${geometry}`;
}

function vegaScaleSpecExpectation<TDatum>(spec: VegaScaleAnchorSpec<TDatum>): string {
  const data = spec.data ? `data "${spec.data}"` : 'default data';

  return `${data} with scales "${spec.xScale}" and "${spec.yScale}" using fields ${fieldList(spec.x, spec.y, spec.width, spec.height, spec.x2, spec.y2)}`;
}

function vegaScenegraphSpecExpectation<TDatum>(spec: VegaScenegraphAnchorSpec<TDatum>): string {
  const parts = [
    spec.markName ? `mark name "${spec.markName}"` : '',
    spec.markType ? `mark type "${spec.markType}"` : '',
    spec.role ? `role "${spec.role}"` : '',
    spec.datum ? 'datum predicate' : ''
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'any scenegraph item with geometry';
}

function vegaSvgSpecExpectation(spec: VegaSvgAnchorSpec): string {
  if (spec.selector) {
    return `selector "${spec.selector}"`;
  }

  return selectorForMark(spec) ?? 'any rendered Vega SVG mark element';
}

function fieldList<TDatum>(...fields: Array<FieldAccessor<TDatum> | undefined>): string {
  const names = fields
    .filter((field): field is FieldAccessor<TDatum> => field !== undefined)
    .map((field) => typeof field === 'function' ? 'callback' : String(field));

  return names.length > 0 ? names.join(', ') : 'none';
}

function boxFromAnchor(anchor: Anchor): Box {
  switch (anchor.type) {
    case 'box':
      return anchor.box;
    case 'point':
      return { x: anchor.point.x, y: anchor.point.y, width: 0, height: 0 };
    case 'path': {
      const minX = Math.min(...anchor.points.map((point) => point.x));
      const minY = Math.min(...anchor.points.map((point) => point.y));
      const maxX = Math.max(...anchor.points.map((point) => point.x));
      const maxY = Math.max(...anchor.points.map((point) => point.y));

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }
  }
}

function pointFromAnchor(anchor: Anchor, box: Box): Point {
  switch (anchor.type) {
    case 'point':
      return anchor.point;
    case 'path':
      return anchor.points[Math.floor(anchor.points.length / 2)] ?? { x: box.x, y: box.y };
    case 'box':
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2
      };
  }
}

function annotationFromAnchorResult(
  result: Pick<VegaAnchorResult, 'id' | 'anchor' | 'source' | 'data' | 'index' | 'markName' | 'markType' | 'role' | 'selector' | 'elementId'>,
  spec: VegaAnnotationAuthoring | undefined
): Annotation {
  const data: DataAttributes = {
    anchorSource: result.source,
    ...(result.data ? { vegaData: result.data } : {}),
    ...(result.index !== undefined ? { datumIndex: result.index } : {}),
    ...(result.markName ? { vegaMarkName: result.markName } : {}),
    ...(result.markType ? { vegaMarkType: result.markType } : {}),
    ...(result.role ? { vegaRole: result.role } : {}),
    ...(result.selector ? { vegaSelector: result.selector } : {}),
    ...(result.elementId ? { vegaElementId: result.elementId } : {})
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

function flattenVegaScenegraph<TDatum>(
  view: VegaScenegraphViewLike<TDatum>
): Array<VegaScenegraphItem<TDatum>> {
  const scenegraph = view.scenegraph();
  const root = 'root' in scenegraph && scenegraph.root ? scenegraph.root : scenegraph as VegaScenegraphItem<TDatum>;
  const items: Array<VegaScenegraphItem<TDatum>> = [];
  const stack: Array<VegaScenegraphItem<TDatum>> = [root];

  while (stack.length > 0) {
    const item = stack.pop();

    if (!item) {
      continue;
    }

    items.push(item);
    stack.push(...(item.items ?? []));
  }

  return items;
}

function matchesScenegraphSpec<TDatum>(
  item: VegaScenegraphItem<TDatum>,
  spec: VegaScenegraphAnchorSpec<TDatum>,
  index: number
): boolean {
  if (spec.markName && scenegraphName(item) !== spec.markName) {
    return false;
  }

  if (spec.markType && scenegraphMarkType(item) !== spec.markType) {
    return false;
  }

  if (spec.role && scenegraphRole(item) !== spec.role) {
    return false;
  }

  if (spec.datum && !spec.datum(item.datum, item, index)) {
    return false;
  }

  return Boolean(spec.markName || spec.markType || spec.role || spec.datum);
}

function hasScenegraphFilter<TDatum>(
  spec: Partial<VegaScenegraphAnchorSpec<TDatum>>
): boolean {
  return Boolean(spec.markName || spec.markType || spec.role || spec.datum);
}

function matchesVegaSvgElement(element: Element, spec: VegaSvgElementMatcher): boolean {
  const hasFilter = Boolean(spec.markName || spec.markType || spec.role);

  if (!hasFilter) {
    return false;
  }

  if (spec.markName && !elementMatchesToken(element, spec.markName, 'mark-name')) {
    return false;
  }

  if (spec.markType && !elementMatchesToken(element, `mark-${spec.markType}`, 'mark-type', spec.markType)) {
    return false;
  }

  if (spec.role && !elementMatchesToken(element, `role-${spec.role}`, 'role', spec.role)) {
    return false;
  }

  return true;
}

function elementMatchesToken(
  element: Element,
  className: string,
  dataName: string,
  dataValue = className
): boolean {
  return element.classList.contains(className)
    || element.getAttribute(`data-${dataName}`) === dataValue
    || element.getAttribute(dataName) === dataValue;
}

function hasGeometry(item: VegaScenegraphItem): boolean {
  return Boolean(item.bounds)
    || (finite(item.x) !== undefined && finite(item.y) !== undefined)
    || (finite(item.width) !== undefined && finite(item.height) !== undefined);
}

function boxFromVegaScenegraphItem(item: VegaScenegraphItem): Box {
  if (item.bounds) {
    return {
      x: item.bounds.x1,
      y: item.bounds.y1,
      width: item.bounds.x2 - item.bounds.x1,
      height: item.bounds.y2 - item.bounds.y1
    };
  }

  const x = finite(item.x) ?? 0;
  const y = finite(item.y) ?? 0;
  const x2 = finite(item.x2);
  const y2 = finite(item.y2);
  const width = finite(item.width);
  const height = finite(item.height);

  if (width !== undefined && height !== undefined) {
    return { x, y, width, height };
  }

  if (x2 !== undefined && y2 !== undefined) {
    return {
      x: Math.min(x, x2),
      y: Math.min(y, y2),
      width: Math.abs(x2 - x),
      height: Math.abs(y2 - y)
    };
  }

  return { x, y, width: 0, height: 0 };
}

function scenegraphName(item: VegaScenegraphItem): string | undefined {
  return item.name ?? item.mark?.name;
}

function scenegraphMarkType(item: VegaScenegraphItem): string | undefined {
  return item.marktype ?? item.mark?.marktype;
}

function scenegraphRole(item: VegaScenegraphItem): string | undefined {
  return item.role ?? item.mark?.role;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function inflateBox(box: Box, padding: number): Box {
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2
  };
}

function translateAnchor(anchor: Anchor, offset: Point): Anchor {
  if (offset.x === 0 && offset.y === 0) {
    return anchor;
  }

  switch (anchor.type) {
    case 'point':
      return {
        type: 'point',
        point: translatePoint(anchor.point, offset)
      };
    case 'box':
      return {
        type: 'box',
        box: translateBox(anchor.box, offset),
        ...(anchor.side ? { side: anchor.side } : {})
      };
    case 'path':
      return {
        type: 'path',
        points: anchor.points.map((point) => translatePoint(point, offset))
      };
  }
}

function translateBox(box: Box, offset: Point): Box {
  return {
    ...box,
    x: box.x + offset.x,
    y: box.y + offset.y
  };
}

function translatePoint(point: Point, offset: Point): Point {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y
  };
}

function viewOrigin(view: {
  padding?: VegaViewPaddingAccessor;
  origin?: VegaViewOriginAccessor;
}): Point {
  const padding = normalizeViewPadding(view.padding?.());
  const origin = view.origin?.();
  const originPoint = Array.isArray(origin)
    ? { x: origin[0], y: origin[1] }
    : { x: origin?.x ?? 0, y: origin?.y ?? 0 };

  return {
    x: (padding?.left ?? 0) + (originPoint.x ?? 0),
    y: (padding?.top ?? 0) + (originPoint.y ?? 0)
  };
}

function normalizeViewPadding(padding: VegaViewPadding | undefined): Partial<{ top: number; left: number }> {
  return typeof padding === 'number'
    ? { top: padding, left: padding }
    : padding ?? {};
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
