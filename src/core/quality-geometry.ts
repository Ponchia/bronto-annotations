import { segmentIntersectsBox } from './segment-intersection.js';
import type { Box, ConnectorPath } from './model.js';

export function overflowArea(box: Box, bounds: Box): number {
  const outsideLeft = Math.max(0, bounds.x - box.x);
  const outsideTop = Math.max(0, bounds.y - box.y);
  const outsideRight = Math.max(0, box.x + box.width - (bounds.x + bounds.width));
  const outsideBottom = Math.max(0, box.y + box.height - (bounds.y + bounds.height));

  return (outsideLeft + outsideRight) * box.height + (outsideTop + outsideBottom) * box.width;
}

export function connectorIntersections(connector: ConnectorPath, box: Box): number[] {
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
