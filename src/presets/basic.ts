import { annotation } from './model.js';
import type { AnnotationPresetBase } from './model.js';
import type { Annotation, AnnotationBadgeOptions, AnnotationConnectorOptions, AnnotationSubjectOptions, Box, Point } from '../core/model.js';

export type PointCalloutOptions = AnnotationPresetBase & {
  point: Point;
  radius?: number;
  connector?: AnnotationConnectorOptions;
};

export type RegionCalloutOptions = AnnotationPresetBase & {
  box: Box;
  subject?: AnnotationSubjectOptions;
  connector?: AnnotationConnectorOptions;
};

export type PathCalloutOptions = AnnotationPresetBase & {
  points: Point[];
  connector?: AnnotationConnectorOptions;
};

export type EncircleCalloutOptions = AnnotationPresetBase & {
  points: Point[];
  pointRadius?: number;
  padding?: number;
  subject?: Omit<AnnotationSubjectOptions, 'geometry' | 'geometrySpace'>;
  connector?: AnnotationConnectorOptions;
};

export type ThresholdAnnotationOptions = AnnotationPresetBase & {
  orientation: 'horizontal' | 'vertical';
  value: number;
  range: [number, number];
  subjectPadding?: number;
  connector?: AnnotationConnectorOptions;
};

export type BadgeAnnotationOptions = AnnotationPresetBase & {
  point: Point;
  radius?: number;
  label?: string;
  badge?: AnnotationBadgeOptions;
  showNote?: boolean;
};

export function pointCallout(options: PointCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'point', point: options.point },
    variant: options.variant ?? 'circle',
    subject: {
      shape: 'circle',
      radius: options.radius ?? 6
    },
    connector: {
      type: 'elbow',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function regionCallout(options: RegionCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'box', box: options.box },
    variant: options.variant ?? 'rect',
    subject: {
      shape: 'rect',
      padding: 4,
      ...options.subject
    },
    connector: {
      type: 'elbow',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function pathCallout(options: PathCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'path', points: options.points },
    variant: options.variant ?? 'curve',
    subject: {
      shape: 'path'
    },
    connector: {
      type: 'curve',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function encircleCallout(options: EncircleCalloutOptions): Annotation {
  return annotation({
    ...options,
    anchor: { type: 'path', points: options.points },
    variant: options.variant ?? 'cluster',
    subject: {
      shape: 'path',
      ...(options.subject ?? {}),
      geometry: {
        type: 'encircle',
        points: options.points,
        ...(options.pointRadius !== undefined ? { radius: options.pointRadius } : {}),
        ...(options.padding !== undefined ? { padding: options.padding } : {})
      },
      geometrySpace: 'absolute'
    },
    connector: {
      type: 'elbow',
      end: 'arrow',
      ...options.connector
    }
  });
}

export function thresholdAnnotation(options: ThresholdAnnotationOptions): Annotation {
  const [start, end] = options.range;
  const points = options.orientation === 'horizontal'
    ? [
      { x: start, y: options.value },
      { x: end, y: options.value }
    ]
    : [
      { x: options.value, y: start },
      { x: options.value, y: end }
    ];

  return annotation({
    ...options,
    anchor: { type: 'path', points },
    variant: options.variant ?? 'threshold',
    subject: {
      shape: 'path',
      padding: options.subjectPadding ?? 0
    },
    connector: {
      type: 'elbow',
      end: 'none',
      ...options.connector
    }
  });
}

export function badgeAnnotation(options: BadgeAnnotationOptions): Annotation {
  const radius = options.badge?.radius ?? options.radius ?? 12;

  return annotation({
    ...options,
    note: options.showNote ? options.note : { ...options.note, visible: false },
    anchor: { type: 'point', point: options.point },
    variant: options.variant ?? 'badge',
    subject: {
      shape: 'circle',
      radius,
      badge: {
        label: options.badge?.label ?? options.label ?? options.note.title ?? options.id,
        radius,
        ...options.badge
      }
    },
    connector: {
      type: 'none',
      end: 'none'
    },
    placement: {
      side: ['top', 'right', 'bottom', 'left'],
      offset: options.placement?.offset ?? 4,
      ...(options.placement ?? {})
    }
  });
}
