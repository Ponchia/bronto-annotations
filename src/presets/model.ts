import type { Anchor, Annotation, AnnotationConnectorOptions, AnnotationMetadata, AnnotationNote, AnnotationSubjectOptions, AnnotationStyle, AnnotationMotion, AnnotationTone, AnnotationVariant, DataAttributes, PlacementPreference } from '../core/model.js';

export type AnnotationPresetBase = {
  id: string;
  note: AnnotationNote;
  placement?: PlacementPreference;
  priority?: number;
  variant?: AnnotationVariant;
  tone?: AnnotationTone;
  motion?: AnnotationMotion;
  style?: AnnotationStyle;
  className?: string;
  data?: DataAttributes;
  metadata?: AnnotationMetadata;
};

export function annotation(input: AnnotationPresetBase & {
  anchor: Anchor;
  subject?: AnnotationSubjectOptions;
  connector?: AnnotationConnectorOptions;
}): Annotation {
  return {
    id: input.id,
    anchor: input.anchor,
    note: input.note,
    ...(input.placement ? { placement: input.placement } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.connector ? { connector: input.connector } : {}),
    ...(input.variant ? { variant: input.variant } : {}),
    ...(input.tone ? { tone: input.tone } : {}),
    ...(input.motion ? { motion: input.motion } : {}),
    ...(input.style ? { style: input.style } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.className ? { className: input.className } : {}),
    ...(input.data ? { data: input.data } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

