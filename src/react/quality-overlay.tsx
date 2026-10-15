import { boxUnion, expandBox } from '../core/anchors.js';
import type { Box, ResolvedLayout } from '../core/model.js';
import type { LayoutQualityIssue, LayoutQualityReport } from '../core/quality.js';

export function renderQualityIssues(
  layout: ResolvedLayout,
  quality: LayoutQualityReport,
  prefix: string
) {
  const issues = quality.issues
    .map((issue, index) => renderQualityIssue(layout, issue, index, prefix))
    .filter(Boolean);

  return issues.length > 0 ? <g className={`${prefix}__quality-issues`}>{issues}</g> : null;
}

function renderQualityIssue(
  layout: ResolvedLayout,
  issue: LayoutQualityIssue,
  index: number,
  prefix: string
) {
  const box = qualityIssueBox(layout, issue);

  if (!box) {
    return null;
  }

  const expanded = expandBox(box, 4);

  return (
    <g
      aria-hidden="true"
      className={[
        `${prefix}__quality-issue`,
        `${prefix}__quality-issue--${issue.severity}`,
        `${prefix}__quality-issue--${issue.type}`
      ].join(' ')}
      data-quality-issue={issue.type}
      data-quality-severity={issue.severity}
      data-quality-index={index}
      data-annotation-id={issue.annotationId}
      data-annotation-ids={issue.annotationIds?.join(' ')}
      data-obstacle-index={issue.obstacleIndex}
      data-segment-index={issue.segmentIndex}
      data-area={issue.area}
      data-amount={issue.amount}
      key={`quality-${index}`}
    >
      <title>{issue.message}</title>
      <rect
        x={expanded.x}
        y={expanded.y}
        width={expanded.width}
        height={expanded.height}
      />
    </g>
  );
}

function qualityIssueBox(layout: ResolvedLayout, issue: LayoutQualityIssue): Box | undefined {
  if (issue.annotationId) {
    return layout.annotations.find((item) => item.id === issue.annotationId)?.noteBox;
  }

  if (issue.annotationIds) {
    const boxes = issue.annotationIds
      .map((id) => layout.annotations.find((item) => item.id === id)?.noteBox)
      .filter((box): box is Box => Boolean(box));

    return boxes.length > 0 ? boxUnion(boxes) : undefined;
  }

  return undefined;
}
