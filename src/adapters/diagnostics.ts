import {
  anchorSubject,
  boxCenter,
  boxForPoint,
  boxFromPoints,
  expandBox,
  overlapArea
} from '../core/anchors.js';
import type { Annotation, Box, Point } from '../core/model.js';

export type AnchorSpecDiagnosticStatus = 'found' | 'fallback' | 'missing' | 'invalid';

export type AnchorSpecDiagnostic = {
  id: string;
  source: string;
  status: AnchorSpecDiagnosticStatus;
  expected: string;
  found: boolean;
  reason?: string;
};

export type AnchorSpecValidationReport = {
  ok: boolean;
  found: string[];
  warnings: AnchorSpecDiagnostic[];
  missing: AnchorSpecDiagnostic[];
  diagnostics: AnchorSpecDiagnostic[];
};

export type AnchorValidationFormatOptions = {
  label?: string;
  includeFound?: boolean;
  maxDiagnostics?: number;
};

export type AnchorValidationAssertOptions = AnchorValidationFormatOptions & {
  failOnWarnings?: boolean;
};

export type AnchorValidationAssertInput = boolean | AnchorValidationAssertOptions;

export type AdapterAnnotationLayerInput<TValidation extends AnchorSpecValidationReport = AnchorSpecValidationReport> = {
  annotations: Annotation[];
  obstacles: Box[];
  validation: TValidation;
};

export type AnchorAlignmentDiagnosticStatus = 'aligned' | 'near' | 'missing' | 'misaligned';

export type AnchorAlignmentTarget = {
  id: string;
  expected?: string;
  box?: Box;
  point?: Point;
  points?: Point[];
  tolerance?: number;
  nearTolerance?: number;
  minOverlapRatio?: number;
};

export type AnchorAlignmentDiagnostic = {
  id: string;
  status: AnchorAlignmentDiagnosticStatus;
  expected: string;
  found: boolean;
  distance?: number;
  overlapRatio?: number;
  anchorBox?: Box;
  targetBox?: Box;
  reason?: string;
};

export type AnchorAlignmentReport = {
  ok: boolean;
  aligned: string[];
  warnings: AnchorAlignmentDiagnostic[];
  missing: AnchorAlignmentDiagnostic[];
  diagnostics: AnchorAlignmentDiagnostic[];
};

export type AnchorAlignmentOptions = {
  tolerance?: number;
  nearTolerance?: number;
  minOverlapRatio?: number;
};

export type AnchorAlignmentFormatOptions = AnchorAlignmentOptions & {
  label?: string;
  includeAligned?: boolean;
  maxDiagnostics?: number;
};

export type AnchorAlignmentAssertOptions = AnchorAlignmentFormatOptions & {
  failOnWarnings?: boolean;
};

export type AnchorAlignmentAssertInput = boolean | AnchorAlignmentAssertOptions;

export function anchorDiagnostic(input: {
  id: string;
  source: string;
  status: AnchorSpecDiagnosticStatus;
  expected: string;
  reason?: string;
}): AnchorSpecDiagnostic {
  return {
    ...input,
    found: input.status === 'found' || input.status === 'fallback'
  };
}

export function validationReport(diagnostics: AnchorSpecDiagnostic[]): AnchorSpecValidationReport {
  const warnings = diagnostics.filter((item) => item.status === 'fallback');
  const missing = diagnostics.filter((item) => item.status === 'missing' || item.status === 'invalid');

  return {
    ok: missing.length === 0,
    found: diagnostics.filter((item) => item.found).map((item) => item.id),
    warnings,
    missing,
    diagnostics
  };
}

export function formatAnchorValidationReport(
  report: AnchorSpecValidationReport,
  options: AnchorValidationFormatOptions = {}
): string {
  const label = options.label ?? 'Annotation anchors';
  const foundText = `${report.found.length} found`;
  const warningText = `${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`;
  const missingText = `${report.missing.length} missing`;
  const diagnostics = [
    ...(options.includeFound ? report.diagnostics.filter((item) => item.found) : []),
    ...report.warnings,
    ...report.missing
  ];
  const lines = [
    `${label}: ${report.ok ? 'ok' : 'failed'} (${foundText}, ${warningText}, ${missingText}).`
  ];
  const limit = Math.max(0, Math.floor(options.maxDiagnostics ?? diagnostics.length));

  for (const diagnostic of diagnostics.slice(0, limit)) {
    lines.push(`- ${formatAnchorDiagnostic(diagnostic)}`);
  }

  const remaining = diagnostics.length - limit;

  if (remaining > 0) {
    lines.push(`- ${remaining} more diagnostic${remaining === 1 ? '' : 's'} omitted.`);
  }

  return lines.join('\n');
}

export function assertAnchorValidationReport(
  report: AnchorSpecValidationReport,
  options: AnchorValidationAssertOptions = {}
): void {
  const failed = !report.ok || Boolean(options.failOnWarnings && report.warnings.length > 0);

  if (failed) {
    throw new Error(formatAnchorValidationReport(report, {
      ...options,
      includeFound: options.includeFound ?? false
    }));
  }
}

export function assertAnchorValidationReportIfRequested(
  report: AnchorSpecValidationReport,
  request: AnchorValidationAssertInput | undefined,
  defaults: AnchorValidationAssertOptions = {}
): void {
  if (!request) {
    return;
  }

  assertAnchorValidationReport(report, request === true ? defaults : {
    ...defaults,
    ...request
  });
}

export function formatAnchorDiagnostic(diagnostic: AnchorSpecDiagnostic): string {
  const reason = diagnostic.reason ? ` ${diagnostic.reason}` : '';

  return `${diagnostic.id}: ${diagnostic.status} ${diagnostic.source} ${diagnostic.expected}.${reason}`;
}

export function evaluateAnchorAlignment(
  annotations: Annotation[],
  targets: AnchorAlignmentTarget[],
  options: AnchorAlignmentOptions = {}
): AnchorAlignmentReport {
  const byId = new Map(annotations.map((annotation) => [annotation.id, annotation]));
  const diagnostics = targets.map((target) => {
    const annotation = byId.get(target.id);
    const expected = target.expected ?? anchorAlignmentExpectation(target);

    if (!annotation) {
      return anchorAlignmentDiagnostic({
        id: target.id,
        status: 'missing',
        expected,
        reason: `No annotation with id "${target.id}" was prepared for ${expected}.`
      });
    }

    const targetGeometry = targetAlignmentGeometry(target);

    if (!targetGeometry) {
      return anchorAlignmentDiagnostic({
        id: target.id,
        status: 'misaligned',
        expected,
        reason: `No target geometry was supplied for ${expected}.`
      });
    }

    const subject = anchorSubject(annotation.anchor);
    const distance = pointDistance(subject.point, targetGeometry.point);
    const overlapRatio = alignmentOverlapRatio(subject.box, targetGeometry.box);
    const tolerance = target.tolerance ?? options.tolerance ?? 1;
    const nearTolerance = target.nearTolerance ?? options.nearTolerance ?? tolerance * 4;
    const minOverlapRatio = target.minOverlapRatio ?? options.minOverlapRatio ?? 0.75;
    const targetWithTolerance = expandBox(targetGeometry.box, tolerance);
    const aligned = distance <= tolerance
      || pointInBox(subject.point, targetWithTolerance)
      || overlapRatio >= minOverlapRatio;
    const near = !aligned && (distance <= nearTolerance || overlapRatio > 0);

    if (aligned) {
      return anchorAlignmentDiagnostic({
        id: target.id,
        status: 'aligned',
        expected,
        distance,
        overlapRatio,
        anchorBox: subject.box,
        targetBox: targetGeometry.box
      });
    }

    return anchorAlignmentDiagnostic({
      id: target.id,
      status: near ? 'near' : 'misaligned',
      expected,
      distance,
      overlapRatio,
      anchorBox: subject.box,
      targetBox: targetGeometry.box,
      reason: `Anchor is ${formatNumber(distance)}px from ${expected} with ${formatPercent(overlapRatio)} overlap.`
    });
  });
  const warnings = diagnostics.filter((item) => item.status === 'near');
  const missing = diagnostics.filter((item) => item.status === 'missing' || item.status === 'misaligned');

  return {
    ok: missing.length === 0,
    aligned: diagnostics.filter((item) => item.status === 'aligned').map((item) => item.id),
    warnings,
    missing,
    diagnostics
  };
}

export function formatAnchorAlignmentReport(
  report: AnchorAlignmentReport,
  options: AnchorAlignmentFormatOptions = {}
): string {
  const label = options.label ?? 'Annotation anchor alignment';
  const alignedText = `${report.aligned.length} aligned`;
  const warningText = `${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`;
  const missingText = `${report.missing.length} missing`;
  const diagnostics = [
    ...(options.includeAligned ? report.diagnostics.filter((item) => item.found) : []),
    ...report.warnings,
    ...report.missing
  ];
  const lines = [
    `${label}: ${report.ok ? 'ok' : 'failed'} (${alignedText}, ${warningText}, ${missingText}).`
  ];
  const limit = Math.max(0, Math.floor(options.maxDiagnostics ?? diagnostics.length));

  for (const diagnostic of diagnostics.slice(0, limit)) {
    lines.push(`- ${formatAnchorAlignmentDiagnostic(diagnostic)}`);
  }

  const remaining = diagnostics.length - limit;

  if (remaining > 0) {
    lines.push(`- ${remaining} more diagnostic${remaining === 1 ? '' : 's'} omitted.`);
  }

  return lines.join('\n');
}

export function assertAnchorAlignmentReport(
  report: AnchorAlignmentReport,
  options: AnchorAlignmentAssertOptions = {}
): void {
  const failed = !report.ok || Boolean(options.failOnWarnings && report.warnings.length > 0);

  if (failed) {
    throw new Error(formatAnchorAlignmentReport(report, {
      ...options,
      includeAligned: options.includeAligned ?? false
    }));
  }
}

export function assertAnchorAlignmentReportIfRequested(
  report: AnchorAlignmentReport,
  request: AnchorAlignmentAssertInput | undefined,
  defaults: AnchorAlignmentAssertOptions = {}
): void {
  if (!request) {
    return;
  }

  assertAnchorAlignmentReport(report, request === true ? defaults : {
    ...defaults,
    ...request
  });
}

export function formatAnchorAlignmentDiagnostic(diagnostic: AnchorAlignmentDiagnostic): string {
  const metrics = [
    diagnostic.distance === undefined ? undefined : `distance ${formatNumber(diagnostic.distance)}px`,
    diagnostic.overlapRatio === undefined ? undefined : `overlap ${formatPercent(diagnostic.overlapRatio)}`
  ].filter(Boolean).join(', ');
  const metricText = metrics ? ` (${metrics})` : '';
  const reason = diagnostic.reason ? ` ${diagnostic.reason}` : '';

  return `${diagnostic.id}: ${diagnostic.status} ${diagnostic.expected}${metricText}.${reason}`;
}

function anchorAlignmentDiagnostic(input: {
  id: string;
  status: AnchorAlignmentDiagnosticStatus;
  expected: string;
  distance?: number;
  overlapRatio?: number;
  anchorBox?: Box;
  targetBox?: Box;
  reason?: string;
}): AnchorAlignmentDiagnostic {
  return {
    ...input,
    found: input.status === 'aligned' || input.status === 'near'
  };
}

function anchorAlignmentExpectation(target: AnchorAlignmentTarget): string {
  if (target.box) {
    return `target box for "${target.id}"`;
  }

  if (target.points) {
    return `target path for "${target.id}"`;
  }

  if (target.point) {
    return `target point for "${target.id}"`;
  }

  return `target geometry for "${target.id}"`;
}

function targetAlignmentGeometry(target: AnchorAlignmentTarget): { box: Box; point: Point } | undefined {
  if (target.box) {
    return {
      box: target.box,
      point: boxCenter(target.box)
    };
  }

  if (target.points) {
    const box = boxFromPoints(target.points);

    return {
      box,
      point: boxCenter(box)
    };
  }

  if (target.point) {
    return {
      box: boxForPoint(target.point),
      point: target.point
    };
  }

  return undefined;
}

function alignmentOverlapRatio(anchorBox: Box, targetBox: Box): number {
  const anchorArea = boxArea(anchorBox);
  const targetArea = boxArea(targetBox);

  if (anchorArea === 0 || targetArea === 0) {
    return 0;
  }

  return overlapArea(anchorBox, targetBox) / Math.min(anchorArea, targetArea);
}

function boxArea(box: Box): number {
  return Math.max(0, box.width) * Math.max(0, box.height);
}

function pointDistance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function pointInBox(point: Point, box: Box): boolean {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
