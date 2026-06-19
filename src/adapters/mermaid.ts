/**
 * Mermaid adapter API stability.
 *
 * @public Stable for `0.1.x`: rendered SVG anchor extraction, prepared
 * annotation helpers, obstacle helpers, validation, and target-alignment
 * diagnostics.
 * @experimental During `0.x`: low-level rendered element finder helpers.
 */
import {
  extractedAnchorFromElement,
  obstaclesFromElements,
  type ElementAnchorOptions,
  type ExtractedAnchor
} from '../dom/index.js';
import type { Box, DataAttributes } from '../core/model.js';
import type {
  Annotation,
  AnnotationConnectorOptions,
  AnnotationNote,
  AnnotationSubjectOptions,
  PlacementPreference
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

export type MermaidAnchorDiagnostic = AnchorSpecDiagnostic;
export type MermaidAnchorValidationReport = AnchorSpecValidationReport;
export type MermaidAnnotationLayerInput = AdapterAnnotationLayerInput<MermaidAnchorValidationReport>;

export type MermaidAnnotationAuthoring = {
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

export type MermaidAnchorSpec = ElementAnchorOptions & MermaidAnnotationAuthoring & {
  id: string;
  selector?: string;
  nodeId?: string;
  edgeId?: string;
  edgeSourceId?: string;
  edgeTargetId?: string;
  clusterId?: string;
  mermaidId?: string;
  label?: string;
  labelMatch?: MermaidLabelMatch;
  className?: string;
  data?: Record<string, string>;
};

export type MermaidLabelMatch = 'exact' | 'contains';

export type MermaidObstacleOptions = ElementAnchorOptions & {
  selector?: string;
};

export type MermaidAnnotationLayerOptions = {
  obstacles?: MermaidObstacleOptions | false;
  assert?: AnchorValidationAssertInput;
};

export type MermaidAnchorResult = ExtractedAnchor & {
  mermaidKind: 'selector' | 'node' | 'edge' | 'cluster' | 'id' | 'label' | 'class' | 'data';
  mermaidId?: string;
  edgeSourceId?: string;
  edgeTargetId?: string;
  label?: string;
  className?: string;
  selector?: string;
  dataSelector?: string;
  elementId?: string;
};

export function anchorsFromMermaidSvg(root: ParentNode, specs: MermaidAnchorSpec[]): MermaidAnchorResult[] {
  return specs.flatMap((spec) => {
    const element = findMermaidElement(root, spec);

    if (!element) {
      return [];
    }

    const result = extractedAnchorFromElement(element, {
      ...spec,
      source: spec.source ?? 'mermaid-svg'
    });

    return [{
      ...result,
      ...mermaidEvidenceFromSpec(spec, element)
    }];
  });
}

export function validateMermaidSvgAnchors(root: ParentNode, specs: MermaidAnchorSpec[]): MermaidAnchorValidationReport {
  return validationReport(specs.map((spec) => {
    const element = findMermaidElement(root, spec);
    const expected = mermaidSpecExpectation(spec);

    return anchorDiagnostic({
      id: spec.id,
      source: 'mermaid-svg',
      status: element ? 'found' : 'missing',
      expected,
      ...(element ? {} : { reason: `No rendered Mermaid SVG element matched ${expected}.` })
    });
  }));
}

export function annotationsFromMermaidSvg(root: ParentNode, specs: MermaidAnchorSpec[]): Annotation[] {
  return anchorsFromMermaidSvg(root, specs).map((result) => {
    const spec = specs.find((item) => item.id === result.id);

    return annotationFromMermaidAnchorResult(result, spec);
  });
}

export function prepareMermaidAnnotations(
  root: ParentNode,
  specs: MermaidAnchorSpec[],
  options: MermaidAnnotationLayerOptions = {}
): MermaidAnnotationLayerInput {
  const validation = validateMermaidSvgAnchors(root, specs);

  assertAnchorValidationReportIfRequested(validation, options.assert, { label: 'Mermaid anchors' });

  return {
    annotations: annotationsFromMermaidSvg(root, specs),
    obstacles: options.obstacles === false
      ? []
      : obstaclesFromMermaidSvg(root, options.obstacles ?? {}),
    validation
  };
}

export function findMermaidElement(root: ParentNode, spec: MermaidAnchorSpec): Element | undefined {
  if (spec.selector) {
    return root.querySelector(spec.selector) ?? undefined;
  }

  if (spec.edgeId && spec.kind === 'path') {
    const edgePath = findMermaidEdgePath(root, spec.edgeId);

    if (edgePath) {
      return edgePath;
    }
  }

  if (spec.edgeSourceId || spec.edgeTargetId) {
    const edgeMatch = findMermaidEdgeElementByEndpoints(root, spec, spec.kind === 'path');

    if (edgeMatch) {
      return edgeMatch;
    }
  }

  const id = spec.nodeId ?? spec.edgeId ?? spec.clusterId ?? spec.mermaidId;

  if (id) {
    const idMatch = findMermaidElementById(root, id, mermaidLookupKind(spec));

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
    const dataMatch = root.querySelector(dataSelector(spec.data));

    if (dataMatch) {
      return dataMatch;
    }
  }

  if (spec.label) {
    return findElementByText(
      root,
      spec.label,
      ['g.node', 'g.edgeLabel', 'g.cluster', 'g', 'text'],
      spec.labelMatch ?? 'exact'
    );
  }

  return undefined;
}

export function obstaclesFromMermaidSvg(root: ParentNode, options: MermaidObstacleOptions = {}): Box[] {
  const selector = options.selector ?? 'g.node, g.cluster, g.edgeLabel, .edgePath path, path.flowchart-link';

  return obstaclesFromElements(root.querySelectorAll(selector), {
    ...options,
    source: options.source ?? 'mermaid-svg-obstacle'
  });
}

export function findElementByText(
  root: ParentNode,
  label: string,
  selectors: string[] = ['g', 'text'],
  match: MermaidLabelMatch = 'exact'
): Element | undefined {
  const normalized = normalizeText(label);

  for (const selector of selectors) {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      const candidate = normalizeText(element.textContent ?? '');

      if (match === 'contains' ? candidate.includes(normalized) : candidate === normalized) {
        return element.closest('g') ?? element;
      }
    }
  }

  return undefined;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

function dataSelector(data: Record<string, string>): string {
  return Object.entries(data)
    .map(([key, value]) => `[data-${dataKey(key)}="${attributeEscape(value)}"]`)
    .join('');
}

function mermaidSpecExpectation(spec: MermaidAnchorSpec): string {
  if (spec.selector) {
    return `selector "${spec.selector}"`;
  }

  if (spec.nodeId) {
    return `node id "${spec.nodeId}"`;
  }

  if (spec.edgeId) {
    return `edge id "${spec.edgeId}"`;
  }

  if (spec.edgeSourceId || spec.edgeTargetId) {
    return `edge endpoints "${spec.edgeSourceId ?? '*'}" -> "${spec.edgeTargetId ?? '*'}"`;
  }

  if (spec.clusterId) {
    return `cluster id "${spec.clusterId}"`;
  }

  if (spec.mermaidId) {
    return `Mermaid id "${spec.mermaidId}"`;
  }

  if (spec.className) {
    return `class "${spec.className}"`;
  }

  if (spec.data) {
    return `data selector "${dataSelector(spec.data)}"`;
  }

  if (spec.label) {
    return `${spec.labelMatch ?? 'exact'} label "${spec.label}"`;
  }

  return 'any rendered Mermaid SVG element';
}

function mermaidLookupKind(spec: MermaidAnchorSpec): 'node' | 'edge' | 'cluster' | 'id' {
  if (spec.nodeId) {
    return 'node';
  }

  if (spec.edgeId) {
    return 'edge';
  }

  if (spec.clusterId) {
    return 'cluster';
  }

  return 'id';
}

function findMermaidElementById(
  root: ParentNode,
  id: string,
  kind: 'node' | 'edge' | 'cluster' | 'id'
): Element | undefined {
  const exact = root.querySelector(`#${cssEscape(id)}`);

  if (exact) {
    return exact;
  }

  const attr = attributeEscape(id);
  const selectors = [
    `[data-id="${attr}"]`,
    `[data-mermaid-id="${attr}"]`,
    kind === 'node' ? `[data-node-id="${attr}"], [data-mermaid-node-id="${attr}"]` : '',
    kind === 'edge' ? `[data-edge-id="${attr}"], [data-mermaid-edge-id="${attr}"]` : '',
    kind === 'cluster' ? `[data-cluster-id="${attr}"], [data-mermaid-cluster-id="${attr}"]` : ''
  ].filter(Boolean);

  const dataMatch = root.querySelector(selectors.join(', '));

  if (dataMatch) {
    return dataMatch;
  }

  if (kind === 'edge') {
    const edgePath = findMermaidEdgePath(root, id);

    if (edgePath) {
      return edgePath;
    }
  }

  return root.querySelector(partialMermaidIdSelector(id, kind)) ?? undefined;
}

function findMermaidEdgePath(root: ParentNode, edgeId: string): Element | undefined {
  const id = attributeEscape(edgeId);

  return root.querySelector([
    `path[id*="${id}"]`,
    `path[data-id="${id}"]`,
    `path[data-edge-id="${id}"]`,
    `path[data-mermaid-edge-id="${id}"]`,
    `.edgePath[id*="${id}"] path`,
    `g.edgePath[id*="${id}"] path`,
    `.edgePath[data-id="${id}"] path`,
    `g.edgePath[data-id="${id}"] path`,
    `.edgePath[data-edge-id="${id}"] path`,
    `g.edgePath[data-edge-id="${id}"] path`,
    `.edgePath[data-mermaid-edge-id="${id}"] path`,
    `g.edgePath[data-mermaid-edge-id="${id}"] path`
  ].join(', ')) ?? undefined;
}

function findMermaidEdgeElementByEndpoints(
  root: ParentNode,
  spec: Pick<MermaidAnchorSpec, 'edgeSourceId' | 'edgeTargetId'>,
  preferPath: boolean
): Element | undefined {
  const candidates = Array.from(root.querySelectorAll([
    'path.flowchart-link',
    'path[id]',
    'path[data-id]',
    'path[data-edge-id]',
    'path[data-mermaid-edge-id]',
    '.edgePath',
    'g.edgePath',
    '[data-edge-id]',
    '[data-mermaid-edge-id]',
    '[data-source-id]',
    '[data-target-id]',
    '[data-edge-source-id]',
    '[data-edge-target-id]'
  ].join(', ')));
  const match = candidates.find((element) => mermaidEdgeElementMatchesEndpoints(element, spec));

  if (!match) {
    return undefined;
  }

  if (preferPath && match.tagName.toLowerCase() !== 'path') {
    return match.querySelector('path.flowchart-link, path') ?? match;
  }

  return match;
}

function mermaidEdgeElementMatchesEndpoints(
  element: Element,
  spec: Pick<MermaidAnchorSpec, 'edgeSourceId' | 'edgeTargetId'>
): boolean {
  const source = spec.edgeSourceId;
  const target = spec.edgeTargetId;

  if (!source && !target) {
    return false;
  }

  if (source && target && (
    attributePairMatches(element, source, target, ['data-source-id', 'data-edge-source-id', 'data-mermaid-source-id', 'data-source', 'data-from'], ['data-target-id', 'data-edge-target-id', 'data-mermaid-target-id', 'data-target', 'data-to'])
    || attributePairMatches(element, target, source, ['data-source-id', 'data-edge-source-id', 'data-mermaid-source-id', 'data-source', 'data-from'], ['data-target-id', 'data-edge-target-id', 'data-mermaid-target-id', 'data-target', 'data-to'])
  )) {
    return true;
  }

  const values = [
    element.id,
    element.getAttribute('data-id'),
    element.getAttribute('data-edge-id'),
    element.getAttribute('data-mermaid-edge-id')
  ].filter((value): value is string => Boolean(value));

  return values.some((value) => edgeEndpointTokensMatch(value, spec));
}

function attributePairMatches(
  element: Element,
  source: string,
  target: string,
  sourceAttributes: string[],
  targetAttributes: string[]
): boolean {
  return sourceAttributes.some((sourceAttribute) => endpointMatches(element.getAttribute(sourceAttribute), source))
    && targetAttributes.some((targetAttribute) => endpointMatches(element.getAttribute(targetAttribute), target));
}

function edgeEndpointTokensMatch(value: string, spec: Pick<MermaidAnchorSpec, 'edgeSourceId' | 'edgeTargetId'>): boolean {
  return [
    spec.edgeSourceId,
    spec.edgeTargetId
  ]
    .filter((endpoint): endpoint is string => Boolean(endpoint))
    .every((endpoint) => endpointMatches(value, endpoint));
}

function endpointMatches(value: string | null, endpoint: string): boolean {
  if (!value) {
    return false;
  }

  return normalizeMermaidId(value).includes(normalizeMermaidId(endpoint));
}

function normalizeMermaidId(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function partialMermaidIdSelector(id: string, kind: 'node' | 'edge' | 'cluster' | 'id'): string {
  const attr = attributeEscape(id);

  if (kind === 'node') {
    return `g.node[id*="${attr}"], .node[id*="${attr}"]`;
  }

  if (kind === 'edge') {
    return `.edgePath[id*="${attr}"], g.edgePath[id*="${attr}"], path[id*="${attr}"]`;
  }

  if (kind === 'cluster') {
    return `g.cluster[id*="${attr}"], .cluster[id*="${attr}"]`;
  }

  return `[id*="${attr}"]`;
}

function mermaidEvidenceFromSpec(spec: MermaidAnchorSpec, element: Element): Omit<MermaidAnchorResult, keyof ExtractedAnchor> {
  const elementId = element.getAttribute('id') ?? undefined;

  if (spec.selector) {
    return {
      mermaidKind: 'selector',
      selector: spec.selector,
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.nodeId) {
    return {
      mermaidKind: 'node',
      mermaidId: spec.nodeId,
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.edgeId) {
    return {
      mermaidKind: 'edge',
      mermaidId: spec.edgeId,
      ...(spec.edgeSourceId ? { edgeSourceId: spec.edgeSourceId } : {}),
      ...(spec.edgeTargetId ? { edgeTargetId: spec.edgeTargetId } : {}),
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.edgeSourceId || spec.edgeTargetId) {
    return {
      mermaidKind: 'edge',
      ...(spec.edgeSourceId ? { edgeSourceId: spec.edgeSourceId } : {}),
      ...(spec.edgeTargetId ? { edgeTargetId: spec.edgeTargetId } : {}),
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.clusterId) {
    return {
      mermaidKind: 'cluster',
      mermaidId: spec.clusterId,
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.mermaidId) {
    return {
      mermaidKind: 'id',
      mermaidId: spec.mermaidId,
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.className) {
    return {
      mermaidKind: 'class',
      className: spec.className,
      ...(elementId ? { elementId } : {})
    };
  }

  if (spec.data) {
    return {
      mermaidKind: 'data',
      dataSelector: dataSelector(spec.data),
      ...(elementId ? { elementId } : {})
    };
  }

  return {
    mermaidKind: 'label',
    ...(spec.label ? { label: spec.label } : {}),
    ...(elementId ? { elementId } : {})
  };
}

function annotationFromMermaidAnchorResult(
  result: MermaidAnchorResult,
  spec: MermaidAnnotationAuthoring | undefined
): Annotation {
  const data: DataAttributes = {
    anchorSource: result.source,
    mermaidKind: result.mermaidKind,
    ...(result.mermaidId ? { mermaidId: result.mermaidId } : {}),
    ...(result.edgeSourceId ? { mermaidEdgeSourceId: result.edgeSourceId } : {}),
    ...(result.edgeTargetId ? { mermaidEdgeTargetId: result.edgeTargetId } : {}),
    ...(result.label ? { mermaidLabel: result.label } : {}),
    ...(result.className ? { mermaidClassName: result.className } : {}),
    ...(result.selector ? { mermaidSelector: result.selector } : {}),
    ...(result.dataSelector ? { mermaidDataSelector: result.dataSelector } : {}),
    ...(result.elementId ? { mermaidElementId: result.elementId } : {})
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
