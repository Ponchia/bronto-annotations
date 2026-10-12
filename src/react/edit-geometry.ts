/**
 * Private, hook-free authoring utilities shared by the annotation renderer.
 * Keep gesture state in AnnotationLayer; these helpers only interpret input
 * and transform coordinates.
 */
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react';
import type { AnnotationEditHandle } from '../core/edit.js';
import type { Box } from '../core/model.js';
import { svgPointFromClient } from '../dom/index.js';
import type { AnnotationLayerEditOptions, AnnotationLayerProps } from './types.js';

export function groupEditHandles(handles: AnnotationEditHandle[]): Map<string, AnnotationEditHandle[]> {
  const groups = new Map<string, AnnotationEditHandle[]>();
  for (const handle of handles) {
    const group = groups.get(handle.annotationId);
    if (group) group.push(handle);
    else groups.set(handle.annotationId, [handle]);
  }
  return groups;
}

export function normalizeEditOptions(editable: AnnotationLayerProps['editable']): AnnotationLayerEditOptions | undefined {
  if (!editable) {
    return undefined;
  }

  return editable === true ? {} : editable;
}

export function keyboardDelta(
  event: ReactKeyboardEvent<SVGCircleElement>,
  options: AnnotationLayerEditOptions | undefined
): { x: number; y: number } | undefined {
  const step = event.shiftKey
    ? options?.keyboardLargeStep ?? 10
    : options?.keyboardStep ?? 1;

  switch (event.key) {
    case 'ArrowUp':
      return { x: 0, y: -step };
    case 'ArrowRight':
      return { x: step, y: 0 };
    case 'ArrowDown':
      return { x: 0, y: step };
    case 'ArrowLeft':
      return { x: -step, y: 0 };
    default:
      return undefined;
  }
}

export function editHandlePosition(handle: AnnotationEditHandle): string | undefined {
  return handle.data.editHandlePosition === undefined
    ? undefined
    : String(handle.data.editHandlePosition);
}

export function clientToSvgPoint(
  event: ReactPointerEvent<SVGElement>,
  svg: SVGSVGElement | null,
  bounds: Box
): { x: number; y: number } {
  if (!svg) {
    return { x: bounds.x, y: bounds.y };
  }

  const matrix = svg.getScreenCTM?.();
  const createPoint = svg.createSVGPoint?.bind(svg);

  if (matrix && createPoint) {
    const point = createPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const transformed = point.matrixTransform(matrix.inverse());

    if (Number.isFinite(transformed.x) && Number.isFinite(transformed.y)) {
      return {
        x: round(transformed.x),
        y: round(transformed.y)
      };
    }
  }

  const point = svgPointFromClient(svg, {
    x: event.clientX,
    y: event.clientY
  });

  return {
    x: round(point.x),
    y: round(point.y)
  };
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
