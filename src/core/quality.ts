import {
  isFiniteBox,
  overlapArea
} from './anchors.js';
import type {
  Box,
  ConnectorPath,
  Point,
  ResolvedAnnotation,
  ResolvedLayout
} from './model.js';

export type LayoutQualitySeverity = 'info' | 'warning' | 'error';

export type LayoutQualityIssueType =
  | 'invalid-box'
  | 'bounds-overflow'
  | 'note-overlap'
  | 'obstacle-overlap'
  | 'connector-obstacle'
  | 'connector-note';

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
  invalidBoxCount: number;
  boundsOverflowArea: number;
  noteOverlapArea: number;
  obstacleOverlapArea: number;
  connectorObstacleHits: number;
  connectorNoteHits: number;
};

export type LayoutQualityReport = {
  ok: boolean;
  score: number;
  metrics: LayoutQualityMetrics;
  issues: LayoutQualityIssue[];
};

export type LayoutQualityOptions = {
  bounds?: Box;
  obstacles?: Box[];
  ignoreConnectorNoteIds?: boolean;
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

  for (const item of layout.annotations) {
    if (!isFiniteBox(item.noteBox)) {
      metrics.invalidBoxCount += 1;
      issues.push({
        type: 'invalid-box',
        severity: 'error',
        annotationId: item.id,
        message: `Annotation "${item.id}" has an invalid note box.`
      });
    }

    const overflow = overflowArea(item.noteBox, bounds);

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

    for (const [obstacleIndex, obstacle] of obstacles.entries()) {
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

    for (const [obstacleIndex, obstacle] of obstacles.entries()) {
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

  for (let firstIndex = 0; firstIndex < layout.annotations.length; firstIndex += 1) {
    const first = layout.annotations[firstIndex]!;

    for (let secondIndex = firstIndex + 1; secondIndex < layout.annotations.length; secondIndex += 1) {
      const second = layout.annotations[secondIndex]!;
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

  for (const connectorOwner of layout.annotations) {
    for (const noteOwner of layout.annotations) {
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

  metrics.issueCount = issues.length;

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    score: qualityScore(metrics),
    metrics,
    issues
  };
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
    !report.ok ? 'blocking layout quality errors' : undefined,
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
  return Math.round(value * 100) / 100;
}

function overflowArea(box: Box, bounds: Box): number {
  const outsideLeft = Math.max(0, bounds.x - box.x);
  const outsideTop = Math.max(0, bounds.y - box.y);
  const outsideRight = Math.max(0, box.x + box.width - (bounds.x + bounds.width));
  const outsideBottom = Math.max(0, box.y + box.height - (bounds.y + bounds.height));

  return (outsideLeft + outsideRight) * box.height + (outsideTop + outsideBottom) * box.width;
}

function connectorIntersections(connector: ConnectorPath, box: Box): number[] {
  const segmentIndexes: number[] = [];

  if (connector.points.length < 2 || box.width <= 0 || box.height <= 0) {
    return segmentIndexes;
  }

  for (let index = 1; index < connector.points.length; index += 1) {
    const start = connector.points[index - 1]!;
    const end = connector.points[index]!;

    if (segmentIntersectsBox(start, end, box)) {
      segmentIndexes.push(index - 1);
    }
  }

  return segmentIndexes;
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

function pointInsideBox(point: Point, box: Box): boolean {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height;
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
