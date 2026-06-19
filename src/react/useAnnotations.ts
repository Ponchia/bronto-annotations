import { useMemo } from 'react';
import { resolveAnnotationLayout } from '../core/layout.js';
import type { ResolvedLayout } from '../core/model.js';
import type { UseAnnotationsOptions } from './types.js';

export function useAnnotations(options: UseAnnotationsOptions): ResolvedLayout {
  return useMemo(
    () => resolveAnnotationLayout(options),
    [
      options.annotations,
      options.bounds,
      options.defaultNoteSize,
      options.noteSizes,
      options.obstacles,
      options.padding,
      options.placement,
      options.refinement
    ]
  );
}
