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

type AnnotationLayerPresentationProps = {
  assertQuality?: boolean | LayoutQualityAssertOptions;
  assertTargetAlignment?: AnchorAlignmentAssertInput;
  className?: string;
  classPrefix?: string;
  /** Draw supplied diagnostics. Input mode requests 8 candidates by default when debug is enabled. */
  debug?: boolean;
  editable?: boolean | AnnotationLayerEditOptions;
  previewEdits?: boolean;
  /** Removed: pass the authoritative layout as `layout`, without solver inputs. */
  resolvedLayout?: never;
  label?: string;
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

/** Resolve from inputs, or render a host-owned layout as the sole source of geometry. */
export type AnnotationLayerProps = AnnotationLayerPresentationProps & (
  | (LayoutOptions & { layout?: never; measure?: 'estimate' | 'dom' })
  | ({
    /** Render only: no solver or DOM measurement runs in this mode. */
    layout: ResolvedLayout;
    measure?: never;
  } & { [Key in keyof LayoutOptions]?: never })
);
