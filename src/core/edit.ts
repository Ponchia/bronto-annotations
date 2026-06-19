import type {
  Anchor,
  Annotation,
  Box,
  DataAttributes,
  ManualPlacement,
  PlacementPreference,
  Point,
  ResolvedAnnotation,
  ResolvedLayout
} from './model.js';
import { annotationsForPaint } from './order.js';

export type AnnotationEditHandleKind = 'note' | 'anchor';

export type AnnotationEditHandlePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export type AnnotationEditHandleOptions = {
  includeNote?: boolean;
  includeAnchor?: boolean;
  noteHandlePosition?: AnnotationEditHandlePosition;
  radius?: number;
  hitRadius?: number;
};

export type AnnotationEditHandle = {
  id: string;
  annotationId: string;
  kind: AnnotationEditHandleKind;
  point: Point;
  box: Box;
  radius: number;
  hitRadius: number;
  cursor: string;
  ariaLabel: string;
  data: DataAttributes;
};

export type AnnotationEditPhase = 'start' | 'move' | 'end';

export type AnnotationEditSuggestion = {
  annotationId: string;
  suggestedAnchor?: Anchor;
  suggestedAnnotation?: Annotation;
  suggestedPlacement?: PlacementPreference & { manual: ManualPlacement };
};

export type AnnotationEditEvent = AnnotationEditSuggestion & {
  handle: AnnotationEditHandle;
  phase: AnnotationEditPhase;
  origin: Point;
  point: Point;
  delta: Point;
};

export type AnnotationEditPatch = {
  annotationId: string;
  anchor?: Anchor;
  placement?: PlacementPreference;
};

export type ApplyAnnotationEditOptions = {
  missing?: 'ignore' | 'throw';
};

export type CreateAnnotationEditEventOptions = {
  annotation: ResolvedAnnotation;
  handle: AnnotationEditHandle;
  origin: Point;
  point: Point;
  phase?: AnnotationEditPhase;
};

export type CreateAnnotationEditDeltaOptions = {
  annotation: ResolvedAnnotation;
  handle: AnnotationEditHandle;
  delta: Point;
  origin?: Point;
  phase?: AnnotationEditPhase;
};

export type CreateAnnotationEditSessionOptions = {
  layout: ResolvedLayout;
  handle: AnnotationEditHandle;
  origin?: Point;
};

export type AnnotationEditSession = {
  annotationId: string;
  handle: AnnotationEditHandle;
  origin: Point;
  annotation: ResolvedAnnotation;
  start(point?: Point): AnnotationEditEvent;
  move(point: Point): AnnotationEditEvent;
  end(point?: Point): AnnotationEditEvent;
  delta(delta: Point, phase?: AnnotationEditPhase): AnnotationEditEvent;
};

const DEFAULT_HANDLE_RADIUS = 5;
const DEFAULT_HIT_RADIUS = 10;

export function annotationEditHandles(
  layout: ResolvedLayout,
  options: AnnotationEditHandleOptions = {}
): AnnotationEditHandle[] {
  const includeNote = options.includeNote ?? true;
  const includeAnchor = options.includeAnchor ?? false;
  const noteHandlePosition = options.noteHandlePosition ?? 'top-right';
  const radius = dimension(options.radius ?? DEFAULT_HANDLE_RADIUS, 'radius');
  const hitRadius = dimension(options.hitRadius ?? Math.max(radius, DEFAULT_HIT_RADIUS), 'hitRadius');
  const handles: AnnotationEditHandle[] = [];

  for (const annotation of annotationsForPaint(layout.annotations)) {
    if (includeNote) {
      handles.push(noteHandle(annotation, radius, hitRadius, noteHandlePosition));
    }

    if (includeAnchor) {
      handles.push(anchorHandle(annotation, radius, hitRadius));
    }
  }

  return handles;
}

export function translateAnchor(anchor: Anchor, delta: Point): Anchor {
  const x = finite(delta.x, 'delta.x');
  const y = finite(delta.y, 'delta.y');

  switch (anchor.type) {
    case 'point':
      return {
        type: 'point',
        point: translatePoint(anchor.point, x, y)
      };
    case 'box':
      return {
        type: 'box',
        box: {
          ...anchor.box,
          x: round(anchor.box.x + x),
          y: round(anchor.box.y + y)
        },
        ...(anchor.side ? { side: anchor.side } : {})
      };
    case 'path':
      return {
        type: 'path',
        points: anchor.points.map((point) => translatePoint(point, x, y))
      };
  }
}

export function createAnnotationEditEvent(options: CreateAnnotationEditEventOptions): AnnotationEditEvent {
  if (options.handle.annotationId !== options.annotation.id) {
    throw new Error(`Edit handle for annotation "${options.handle.annotationId}" cannot edit "${options.annotation.id}".`);
  }

  const origin = finitePoint(options.origin, 'origin');
  const point = finitePoint(options.point, 'point');
  const delta = {
    x: round(point.x - origin.x),
    y: round(point.y - origin.y)
  };
  const event: AnnotationEditEvent = {
    annotationId: options.annotation.id,
    handle: options.handle,
    phase: options.phase ?? 'move',
    origin,
    point,
    delta
  };

  if (options.handle.kind === 'note') {
    const suggestedPlacement = notePlacementEdit(options.annotation, delta);

    event.suggestedPlacement = suggestedPlacement;
    event.suggestedAnnotation = {
      ...options.annotation.annotation,
      placement: suggestedPlacement
    };
  }

  if (options.handle.kind === 'anchor') {
    const suggestedAnchor = translateAnchor(options.annotation.annotation.anchor, delta);

    event.suggestedAnchor = suggestedAnchor;
    event.suggestedAnnotation = {
      ...options.annotation.annotation,
      anchor: suggestedAnchor
    };
  }

  return event;
}

export function createAnnotationEditDelta(options: CreateAnnotationEditDeltaOptions): AnnotationEditEvent {
  const delta = finitePoint(options.delta, 'delta');
  const origin = options.origin ? finitePoint(options.origin, 'origin') : finitePoint(options.handle.point, 'handle.point');

  return createAnnotationEditEvent({
    annotation: options.annotation,
    handle: options.handle,
    origin,
    point: {
      x: round(origin.x + delta.x),
      y: round(origin.y + delta.y)
    },
    ...(options.phase ? { phase: options.phase } : {})
  });
}

export function createAnnotationEditSession(options: CreateAnnotationEditSessionOptions): AnnotationEditSession {
  const annotation = options.layout.annotations.find((item) => item.id === options.handle.annotationId);

  if (!annotation) {
    throw new Error(`Edit handle target not found in layout: ${options.handle.annotationId}.`);
  }

  const origin = options.origin ? finitePoint(options.origin, 'origin') : finitePoint(options.handle.point, 'handle.point');
  const event = (point: Point, phase: AnnotationEditPhase) => createAnnotationEditEvent({
    annotation,
    handle: options.handle,
    origin,
    point,
    phase
  });

  return {
    annotationId: annotation.id,
    handle: options.handle,
    origin,
    annotation,
    start: (point = origin) => event(point, 'start'),
    move: (point) => event(point, 'move'),
    end: (point = origin) => event(point, 'end'),
    delta: (delta, phase = 'move') => createAnnotationEditDelta({
      annotation,
      handle: options.handle,
      origin,
      delta,
      phase
    })
  };
}

export function annotationEditPatch(edit: AnnotationEditSuggestion | AnnotationEditPatch): AnnotationEditPatch {
  if (isAnnotationEditPatch(edit)) {
    return edit;
  }

  const anchor = edit.suggestedAnchor
    ?? (edit.suggestedPlacement ? undefined : edit.suggestedAnnotation?.anchor);
  const placement = edit.suggestedPlacement
    ?? (edit.suggestedAnchor ? undefined : edit.suggestedAnnotation?.placement);

  return {
    annotationId: edit.annotationId,
    ...(anchor ? { anchor } : {}),
    ...(placement ? { placement } : {})
  };
}

export function applyAnnotationEdit(
  annotation: Annotation,
  edit: AnnotationEditSuggestion | AnnotationEditPatch
): Annotation {
  const patch = annotationEditPatch(edit);

  if (annotation.id !== patch.annotationId) {
    throw new Error(`Edit for annotation "${patch.annotationId}" cannot be applied to "${annotation.id}".`);
  }

  return {
    ...annotation,
    ...(patch.anchor ? { anchor: patch.anchor } : {}),
    ...(patch.placement ? { placement: patch.placement } : {})
  };
}

export function applyAnnotationEdits(
  annotations: Annotation[],
  edits: AnnotationEditSuggestion | AnnotationEditPatch | Array<AnnotationEditSuggestion | AnnotationEditPatch>,
  options: ApplyAnnotationEditOptions = {}
): Annotation[] {
  const patches = (Array.isArray(edits) ? edits : [edits]).map(annotationEditPatch);
  const byId = new Map<string, AnnotationEditPatch>();

  for (const patch of patches) {
    byId.set(patch.annotationId, {
      ...(byId.get(patch.annotationId) ?? { annotationId: patch.annotationId }),
      ...patch
    });
  }

  const seen = new Set<string>();
  const next = annotations.map((annotation) => {
    const patch = byId.get(annotation.id);

    if (!patch) {
      return annotation;
    }

    seen.add(annotation.id);
    return applyAnnotationEdit(annotation, patch);
  });

  if (options.missing === 'throw') {
    const missing = [...byId.keys()].filter((id) => !seen.has(id));

    if (missing.length > 0) {
      throw new Error(`Annotation edit target not found: ${missing.join(', ')}`);
    }
  }

  return next;
}

function noteHandle(
  annotation: ResolvedAnnotation,
  radius: number,
  hitRadius: number,
  position: AnnotationEditHandlePosition
): AnnotationEditHandle {
  const point = noteHandlePoint(annotation.noteBox, position);

  return {
    id: `${annotation.id}:note`,
    annotationId: annotation.id,
    kind: 'note',
    point,
    box: handleBox(point, hitRadius),
    radius,
    hitRadius,
    cursor: 'move',
    ariaLabel: `Move note for ${annotationLabel(annotation)}`,
    data: {
      annotationId: annotation.id,
      editHandle: 'note',
      editHandlePosition: position
    }
  };
}

function anchorHandle(annotation: ResolvedAnnotation, radius: number, hitRadius: number): AnnotationEditHandle {
  const point = annotation.anchorPoint;

  return {
    id: `${annotation.id}:anchor`,
    annotationId: annotation.id,
    kind: 'anchor',
    point,
    box: handleBox(point, hitRadius),
    radius,
    hitRadius,
    cursor: 'crosshair',
    ariaLabel: `Move anchor for ${annotationLabel(annotation)}`,
    data: {
      annotationId: annotation.id,
      editHandle: 'anchor'
    }
  };
}

function annotationLabel(annotation: ResolvedAnnotation): string {
  return annotation.annotation.note.ariaLabel ?? annotation.annotation.note.title ?? annotation.id;
}

function isAnnotationEditPatch(edit: AnnotationEditSuggestion | AnnotationEditPatch): edit is AnnotationEditPatch {
  return 'anchor' in edit || 'placement' in edit;
}

function notePlacementEdit(
  annotation: ResolvedAnnotation,
  delta: Point
): PlacementPreference & { manual: ManualPlacement } {
  const existingPlacement = annotation.annotation.placement ?? {};
  const existingManual = existingPlacement.manual ?? {};

  return {
    ...existingPlacement,
    manual: {
      ...existingManual,
      x: round(annotation.noteBox.x + delta.x),
      y: round(annotation.noteBox.y + delta.y),
      side: annotation.placement.side,
      align: annotation.placement.align
    }
  };
}

function noteHandlePoint(box: Box, position: AnnotationEditHandlePosition): Point {
  switch (position) {
    case 'top-left':
      return { x: box.x, y: box.y };
    case 'bottom-left':
      return { x: box.x, y: box.y + box.height };
    case 'bottom-right':
      return { x: box.x + box.width, y: box.y + box.height };
    case 'center':
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    case 'top-right':
      return { x: box.x + box.width, y: box.y };
  }
}

function handleBox(point: Point, radius: number): Box {
  return {
    x: point.x - radius,
    y: point.y - radius,
    width: radius * 2,
    height: radius * 2
  };
}

function dimension(value: number, name: string): number {
  const resolved = finite(value, name);

  if (resolved < 0) {
    throw new RangeError(`${name} must be greater than or equal to 0`);
  }

  return resolved;
}

function translatePoint(point: Point, dx: number, dy: number): Point {
  return {
    x: round(point.x + dx),
    y: round(point.y + dy)
  };
}

function finitePoint(point: Point, name: string): Point {
  return {
    x: finite(point.x, `${name}.x`),
    y: finite(point.y, `${name}.y`)
  };
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }

  return value;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
