import type {
  AnnotationMotion,
  AnnotationTone,
  AnnotationVariant,
  PlacementSide
} from './model.js';

export type AnnotationClassNameInput = {
  prefix?: string;
  variant?: AnnotationVariant;
  tone?: AnnotationTone;
  motion?: AnnotationMotion;
  side?: PlacementSide;
  manual?: boolean;
  className?: AnnotationClassNameValue;
};

export type AnnotationClassNameValue =
  | string
  | false
  | null
  | undefined
  | Array<string | false | null | undefined>;

const DEFAULT_PREFIX = 'pa-annotation';
const LEGACY_BRONTO_PREFIX = 'ui-annotation';

export function annotationClassName(input: AnnotationClassNameInput = {}): string {
  const prefix = input.prefix ?? DEFAULT_PREFIX;

  return classNames(
    prefix,
    input.side ? `${prefix}--${input.side}` : undefined,
    input.manual ? `${prefix}--manual` : undefined,
    input.variant ? `${prefix}--${input.variant}` : undefined,
    input.tone ? `${prefix}--${input.tone}` : undefined,
    input.motion ? `${prefix}--${input.motion}` : undefined,
    input.className
  );
}

export function brontoAnnotationClassName(input: Omit<AnnotationClassNameInput, 'prefix'> = {}): string {
  return annotationClassName({
    ...input,
    prefix: LEGACY_BRONTO_PREFIX
  });
}

function classNames(...values: AnnotationClassNameValue[]): string {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join(' ');
}
