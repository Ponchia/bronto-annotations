/**
 * Private annotation style and SVG data-attribute adapters. This module
 * deliberately does not depend on a renderer or on React runtime state.
 */
import type { CSSProperties } from 'react';
import { annotationStyleVariables } from '../core/style.js';
import type { Annotation } from '../core/model.js';

export function dataAttributes(
  data: Record<string, string | number | boolean | null | undefined> | undefined,
  reserved: readonly string[] = []
) {
  if (!data) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [`data-${dataKey(key)}`, String(value)])
      .filter(([name]) => !reserved.includes(name!))
  );
}

export function annotationStyle(style: Annotation['style']): CSSProperties | undefined {
  const variables = annotationStyleVariables(style);

  return Object.keys(variables).length > 0
    ? variables as CSSProperties
    : undefined;
}

function dataKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .toLowerCase();
}
