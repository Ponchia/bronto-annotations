import {
  overlapArea
} from './anchors.js';
import { overflowArea, connectorIntersections, finiteQualityBox } from './quality-geometry.js';
import { connectorReadability, type ConnectorReadabilityReport } from './connector-readability.js';

/** @experimental Polyline readability evidence; separate from layout validity. */
export type LayoutReadabilityReport = ConnectorReadabilityReport;
import type {
  Box,
  ResolvedLayout
} from './model.js';

export type LayoutQualitySeverity = 'info' | 'warning' | 'error';

export type LayoutQualityIssueType =
  | 'invalid-box'
  | 'bounds-overflow'
  | 'note-overlap'
  | 'obstacle-overlap'
  | 'connector-obstacle'
  | 'connector-note'
  | 'connector-crossing';

export type LayoutQualityIssue = {
  type: LayoutQualityIssueType;
  severity: LayoutQualitySeverity;
  message: string;
  annotationId?: string;
  annotationIds?: [string, string];
  obstacleIndex?: number;
  segmentIndex?: number;
  area?: number;
  amount?: number;
};

export type LayoutQualityMetrics = {
  annotationCount: number;
  issueCount: number;
  /** Invalid note boxes, effective bounds and inspected obstacles. */
  invalidBoxCount: number;
  boundsOverflowArea: number;
  noteOverlapArea: number;
  obstacleOverlapArea: number;
  connectorObstacleHits: number;
  connectorNoteHits: number;
};

export type LayoutQualityReport = {
  /** Structural validity of inspected bounds, obstacles and note boxes, plus placement. */
  geometryValid: boolean;
  /** Inspected host obstacles are valid and are not covered by annotation notes.
   * Connectors may legitimately contact their own subjects.
   */
  hostContentClear: boolean;
  /** Basic geometry usability; not a typography or accessibility guarantee. */
  ok: boolean;
  score: number;
  metrics: LayoutQualityMetrics;
  issues: LayoutQualityIssue[];
  /** @experimental Present only when readability is explicitly requested. */
  readability?: LayoutReadabilityReport;
  /** Present only for nonfinite numeric report fields. Native JSON encodes
   * those numbers as null; these paths and tags preserve their computed meaning.
   * This evidence does not change geometry validity or restore parsed numbers.
   */
  numericDiagnostics?: Array<{ path: string; value: 'Infinity' | '-Infinity' | 'NaN' }>;
};

export type LayoutQualityOptions = {
  bounds?: Box;
  obstacles?: Box[];
  ignoreConnectorNoteIds?: boolean;
  /** @experimental Inspect polyline crossings, route length and bends. */
  readability?: boolean;
};

export type LayoutQualityFormatOptions = {
  label?: string;
  includeInfo?: boolean;
  includeWarnings?: boolean;
  maxIssues?: number;
};

export type LayoutQualityAssertOptions = LayoutQualityFormatOptions & {
  failOnInfo?: boolean;
  failOnWarnings?: boolean;
  minScore?: number;
};

export function evaluateAnnotationLayout(
  layout: ResolvedLayout,
  options: LayoutQualityOptions = {}
): LayoutQualityReport {
  const bounds = options.bounds ?? layout.placementBounds ?? layout.bounds;
  const obstacles = options.obstacles ?? layout.obstacles;
  const issues: LayoutQualityIssue[] = [];
  const metrics: LayoutQualityMetrics = {
    annotationCount: layout.annotations.length,
    issueCount: 0,
    invalidBoxCount: 0,
    boundsOverflowArea: 0,
    noteOverlapArea: 0,
    obstacleOverlapArea: 0,
    connectorObstacleHits: 0,
    connectorNoteHits: 0
  };

  const validBounds = finiteQualityBox(bounds);
  if (!validBounds) {
    metrics.invalidBoxCount += 1;
    issues.push({ type: 'invalid-box', severity: 'error',
      message: 'The effective placement bounds are invalid.' });
  }

  // Inspect every supplied obstacle, even in an empty scene. Keep source indices
  // when excluding invalid geometry from numerical intersection calculations.
  const validObstacles: Array<{ obstacle: Box; obstacleIndex: number }> = [];
  for (const [obstacleIndex, obstacle] of obstacles.entries()) {
    if (finiteQualityBox(obstacle)) {
      validObstacles.push({ obstacle, obstacleIndex });
    } else {
      metrics.invalidBoxCount += 1;
      issues.push({ type: 'invalid-box', severity: 'error', obstacleIndex,
        message: `Host obstacle ${obstacleIndex} has an invalid box.` });
    }
  }

  const validAnnotations = layout.annotations.filter((item) => {
    if (!finiteQualityBox(item.noteBox)) {
      metrics.invalidBoxCount += 1;
      issues.push({
        type: 'invalid-box',
        severity: 'error',
        annotationId: item.id,
        message: `Annotation "${item.id}" has an invalid note box.`
      });
      return false;
    }
    return true;
  });

  for (const item of validAnnotations) {
    const overflow = validBounds ? overflowArea(item.noteBox, bounds) : 0;

    if (overflow > 0) {
      metrics.boundsOverflowArea += overflow;
      issues.push({
        type: 'bounds-overflow',
        severity: 'error',
        annotationId: item.id,
        area: overflow,
        message: `Annotation "${item.id}" overflows the placement bounds.`
      });
    }

    for (const { obstacleIndex, obstacle } of validObstacles) {
      const area = overlapArea(item.noteBox, obstacle);

      if (area > 0) {
        metrics.obstacleOverlapArea += area;
        issues.push({
          type: 'obstacle-overlap',
          severity: 'warning',
          annotationId: item.id,
          obstacleIndex,
          area,
          message: `Annotation "${item.id}" overlaps obstacle ${obstacleIndex}.`
        });
      }
    }

    for (const { obstacleIndex, obstacle } of validObstacles) {
      for (const segmentIndex of connectorIntersections(item.connector, obstacle)) {
        metrics.connectorObstacleHits += 1;
        issues.push({
          type: 'connector-obstacle',
          severity: 'info',
          annotationId: item.id,
          obstacleIndex,
          segmentIndex,
          message: `Annotation "${item.id}" connector crosses obstacle ${obstacleIndex}.`
        });
      }
    }
  }

  for (let firstIndex = 0; firstIndex < validAnnotations.length; firstIndex += 1) {
    const first = validAnnotations[firstIndex]!;

    for (let secondIndex = firstIndex + 1; secondIndex < validAnnotations.length; secondIndex += 1) {
      const second = validAnnotations[secondIndex]!;
      const area = overlapArea(first.noteBox, second.noteBox);

      if (area > 0) {
        metrics.noteOverlapArea += area;
        issues.push({
          type: 'note-overlap',
          severity: 'error',
          annotationIds: [first.id, second.id],
          area,
          message: `Annotations "${first.id}" and "${second.id}" overlap.`
        });
      }
    }
  }

  for (const connectorOwner of validAnnotations) {
    for (const noteOwner of validAnnotations) {
      if (connectorOwner.id === noteOwner.id && options.ignoreConnectorNoteIds !== false) {
        continue;
      }

      for (const segmentIndex of connectorIntersections(connectorOwner.connector, noteOwner.noteBox)) {
        metrics.connectorNoteHits += 1;
        issues.push({
          type: 'connector-note',
          severity: 'info',
          annotationIds: [connectorOwner.id, noteOwner.id],
          segmentIndex,
          message: `Annotation "${connectorOwner.id}" connector crosses annotation "${noteOwner.id}".`
        });
      }
    }
  }

  const readability = options.readability ? connectorReadability(layout.annotations, (first, second) => {
    issues.push({ type: 'connector-crossing', severity: 'info', annotationIds: [first, second],
      message: `Annotation connectors "${first}" and "${second}" intersect away from their endpoints.` });
  }) : undefined;
  metrics.issueCount = issues.length;

  const geometryValid = !issues.some((issue) => issue.severity === 'error');
  const hostContentClear = validObstacles.length === obstacles.length && metrics.obstacleOverlapArea === 0;
  const report: LayoutQualityReport = {
    geometryValid,
    hostContentClear,
    ok: geometryValid && hostContentClear,
    score: qualityScore(metrics),
    metrics,
    issues,
    ...(readability ? { readability } : {})
  };
  recordNumericDiagnostics(report);
  return report;
}

// Inspect only fields constructed by this evaluator, never host objects or
// arbitrary nested layout data. Keep finite reports structurally unchanged.
const numericMetricFields = ['annotationCount', 'issueCount', 'invalidBoxCount',
  'boundsOverflowArea', 'noteOverlapArea', 'obstacleOverlapArea',
  'connectorObstacleHits', 'connectorNoteHits'] as const;
const numericReadabilityFields = ['connectorCrossingPairs', 'totalConnectorLength',
  'connectorBendCount', 'evaluatedConnectorCount', 'skippedCurveCount', 'invalidConnectorCount'] as const;

function recordNumericDiagnostics(report: LayoutQualityReport): void {
  function record(path: string, value: number | undefined): void {
    if (value === undefined || Number.isFinite(value)) return;
    (report.numericDiagnostics ??= []).push({ path,
      value: Number.isNaN(value) ? 'NaN' : value === Infinity ? 'Infinity' : '-Infinity' });
  }
  record('score', report.score);
  for (const field of numericMetricFields) record(`metrics.${field}`, report.metrics[field]);
  for (const [index, issue] of report.issues.entries()) {
    // Most issues have finite areas or no amount. Build per-issue paths only
    // for diagnostics, avoiding these string allocations in ordinary scenes.
    if (issue.area !== undefined && !Number.isFinite(issue.area)) record(`issues[${index}].area`, issue.area);
    if (issue.amount !== undefined && !Number.isFinite(issue.amount)) record(`issues[${index}].amount`, issue.amount);
  }
  if (report.readability) {
    for (const field of numericReadabilityFields) record(`readability.${field}`, report.readability[field]);
  }
}

export function formatLayoutQualityIssue(issue: LayoutQualityIssue): string {
  const target = issue.annotationId
    ? issue.annotationId
    : issue.annotationIds?.join(' -> ');
  const details = [
    target ? `target=${target}` : undefined,
    issue.obstacleIndex !== undefined ? `obstacle=${issue.obstacleIndex}` : undefined,
    issue.segmentIndex !== undefined ? `segment=${issue.segmentIndex}` : undefined,
    issue.area !== undefined ? `area=${roundMetric(issue.area)}` : undefined,
    issue.amount !== undefined ? `amount=${roundMetric(issue.amount)}` : undefined
  ].filter(Boolean).join(' ');

  return `${issue.severity} ${issue.type}${details ? ` ${details}` : ''}: ${issue.message}`;
}

export function formatLayoutQualityReport(
  report: LayoutQualityReport,
  options: LayoutQualityFormatOptions = {}
): string {
  const label = options.label ?? 'Annotation layout quality';
  const counts = severityCounts(report.issues);
  const header = `${label}: ${report.ok ? 'ok' : 'failed'} (score ${roundMetric(report.score)}, ${counts.error} error${counts.error === 1 ? '' : 's'}, ${counts.warning} warning${counts.warning === 1 ? '' : 's'}, ${counts.info} info, ${report.metrics.issueCount} issue${report.metrics.issueCount === 1 ? '' : 's'}).`;
  const issueLines = report.issues
    .filter((issue) => issue.severity === 'error'
      || (options.includeWarnings !== false && issue.severity === 'warning')
      || (options.includeInfo && issue.severity === 'info'));
  const limit = Math.max(0, Math.floor(options.maxIssues ?? issueLines.length));
  const lines = [header];

  for (const issue of issueLines.slice(0, limit)) {
    lines.push(`- ${formatLayoutQualityIssue(issue)}`);
  }

  const omitted = issueLines.length - limit;

  if (omitted > 0) {
    lines.push(`- ${omitted} more layout issue${omitted === 1 ? '' : 's'} omitted.`);
  }

  for (const diagnostic of report.numericDiagnostics ?? []) {
    lines.push(`- numeric range ${diagnostic.path}=${diagnostic.value}: computed value is not finite.`);
  }

  return lines.join('\n');
}

export function assertAnnotationLayoutQuality(
  report: LayoutQualityReport,
  options: LayoutQualityAssertOptions = {}
): void {
  const counts = severityCounts(report.issues);
  const belowMinimumScore = options.minScore !== undefined && report.score < options.minScore;
  const failed = !report.ok
    || belowMinimumScore
    || Boolean(options.failOnWarnings && counts.warning > 0)
    || Boolean(options.failOnInfo && counts.info > 0);

  if (!failed) {
    return;
  }

  const reasons = [
    !report.geometryValid ? 'blocking layout quality errors' : undefined,
    !report.hostContentClear
      ? report.issues.some(issue => issue.type === 'invalid-box' && issue.obstacleIndex !== undefined)
        ? 'protected host obstacle geometry is invalid'
        : 'annotation notes obscure protected host content'
      : undefined,
    belowMinimumScore ? `score ${roundMetric(report.score)} is below required minimum ${roundMetric(options.minScore!)}` : undefined,
    options.failOnWarnings && counts.warning > 0 ? `${counts.warning} warning${counts.warning === 1 ? '' : 's'}` : undefined,
    options.failOnInfo && counts.info > 0 ? `${counts.info} info issue${counts.info === 1 ? '' : 's'}` : undefined
  ].filter(Boolean);
  const formatOptions: LayoutQualityFormatOptions = {
    ...options,
    includeWarnings: options.includeWarnings ?? true
  };

  if (options.includeInfo !== undefined || options.failOnInfo !== undefined) {
    formatOptions.includeInfo = options.includeInfo !== undefined
      ? options.includeInfo
      : options.failOnInfo === true;
  }

  const message = formatLayoutQualityReport(report, formatOptions);

  throw new Error(`${options.label ?? 'Annotation layout quality'} assertion failed: ${reasons.join('; ')}.\n${message}`);
}

function qualityScore(metrics: LayoutQualityMetrics): number {
  const penalty =
    metrics.invalidBoxCount * 35
    + metrics.boundsOverflowArea * 0.02
    + metrics.noteOverlapArea * 0.03
    + metrics.obstacleOverlapArea * 0.01
    + metrics.connectorObstacleHits * 2
    + metrics.connectorNoteHits;

  return Math.max(0, Math.round((100 - penalty) * 100) / 100);
}

function severityCounts(issues: LayoutQualityIssue[]): Record<LayoutQualitySeverity, number> {
  return issues.reduce<Record<LayoutQualitySeverity, number>>((counts, issue) => ({
    ...counts,
    [issue.severity]: counts[issue.severity] + 1
  }), { error: 0, warning: 0, info: 0 });
}

function roundMetric(value: number): number {
  const scaled = value * 100;
  return Number.isFinite(scaled) ? Math.round(scaled) / 100 : value;
}
