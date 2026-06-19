import type { ReactNode } from 'react';
import type {
  LayoutOptions,
  ResolvedAnnotation,
  ResolvedLayout
} from '../core/model.js';
import type {
  AnnotationEditEvent,
  AnnotationEditHandle,
  AnnotationEditHandleOptions
} from '../core/edit.js';
import type {
  LayoutQualityAssertOptions,
  LayoutQualityFormatOptions,
  LayoutQualityReport
} from '../core/quality.js';
import type {
  AnchorAlignmentAssertInput,
  AnchorAlignmentFormatOptions,
  AnchorAlignmentOptions,
  AnchorAlignmentReport,
  AnchorAlignmentTarget
} from '../adapters/diagnostics.js';

export type UseAnnotationsOptions = LayoutOptions;

export type AnnotationLayerEditOptions = AnnotationEditHandleOptions & {
  keyboardLargeStep?: number;
  keyboardStep?: number;
};

export type AnnotationLayerEditEvent = AnnotationEditEvent;

export type AnnotationLayerQualityEvent = {
  layout: ResolvedLayout;
  quality: LayoutQualityReport;
  summary: string;
};

export type AnnotationLayerTargetAlignmentEvent = {
  layout: ResolvedLayout;
  targetAlignment: AnchorAlignmentReport;
  summary: string;
};

export type AnnotationLayerProps = LayoutOptions & {
  assertQuality?: boolean | LayoutQualityAssertOptions;
  assertTargetAlignment?: AnchorAlignmentAssertInput;
  className?: string;
  classPrefix?: string;
  debug?: boolean;
  editable?: boolean | AnnotationLayerEditOptions;
  label?: string;
  measure?: 'estimate' | 'dom';
  markerIdPrefix?: string;
  editHandleTabIndex?: number;
  noteTabIndex?: number;
  preserveAspectRatio?: string;
  qualityDebug?: boolean;
  qualityFormat?: LayoutQualityFormatOptions;
  renderNote?: (annotation: ResolvedAnnotation) => ReactNode;
  targetAlignmentFormat?: AnchorAlignmentFormatOptions;
  targetAlignmentOptions?: AnchorAlignmentOptions;
  targetAlignmentTargets?: AnchorAlignmentTarget[];
  onEdit?: (event: AnnotationLayerEditEvent) => void;
  onEditEnd?: (event: AnnotationLayerEditEvent) => void;
  onEditStart?: (event: AnnotationLayerEditEvent) => void;
  onLayout?: (layout: ResolvedLayout) => void;
  onQuality?: (event: AnnotationLayerQualityEvent) => void;
  onTargetAlignment?: (event: AnnotationLayerTargetAlignmentEvent) => void;
  style?: React.CSSProperties;
};
