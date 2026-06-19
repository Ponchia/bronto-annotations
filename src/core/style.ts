import type {
  AnnotationStyle,
  AnnotationStyleVariableName
} from './model.js';

export type AnnotationStyleVariables = Record<AnnotationStyleVariableName, string | number>;

const STYLE_FIELDS: Array<{
  key: keyof Omit<AnnotationStyle, 'vars'>;
  vars: AnnotationStyleVariableName[];
}> = [
  { key: 'color', vars: ['--pa-annotation-accent', '--annotation-color'] },
  { key: 'lineColor', vars: ['--pa-annotation-line', '--annotation-line'] },
  { key: 'noteBackground', vars: ['--pa-annotation-paper', '--annotation-note-bg'] },
  { key: 'subjectFill', vars: ['--pa-annotation-subject-fill', '--annotation-subject-fill'] },
  { key: 'borderColor', vars: ['--pa-annotation-border'] },
  { key: 'textColor', vars: ['--pa-annotation-ink'] },
  { key: 'mutedColor', vars: ['--pa-annotation-muted'] },
  { key: 'strokeWidth', vars: ['--pa-annotation-stroke-width', '--annotation-stroke-width'] }
];

export function annotationStyleVariables(style: AnnotationStyle | undefined): AnnotationStyleVariables {
  const variables: AnnotationStyleVariables = {};

  if (!style) {
    return variables;
  }

  for (const field of STYLE_FIELDS) {
    const value = style[field.key];

    if (validStyleValue(value)) {
      for (const variable of field.vars) {
        variables[variable] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(style.vars ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    if (isCssVariableName(key) && validStyleValue(value)) {
      variables[key as AnnotationStyleVariableName] = value;
    }
  }

  return variables;
}

function validStyleValue(value: unknown): value is string | number {
  return (typeof value === 'string' && value.length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function isCssVariableName(value: string): value is AnnotationStyleVariableName {
  return /^--[a-zA-Z0-9_-]+$/.test(value);
}
