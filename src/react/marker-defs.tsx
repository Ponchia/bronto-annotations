/**
 * Private SVG connector marker definitions; marker IDs must be identical
 * across React renders and always be derived from the host-supplied prefix.
 */
import { memo } from 'react';
import type { ResolvedAnnotation } from '../core/model.js';

export const MemoMarkerDefs = memo(MarkerDefs);

function MarkerDefs({
  annotations,
  markerPrefix,
  prefix
}: {
  annotations: ResolvedAnnotation[];
  markerPrefix: string;
  prefix: string;
}) {
  const ends = new Set(annotations.map((item) => item.annotation.connector?.end ?? 'none'));

  if (!ends.has('arrow') && !ends.has('dot')) {
    return null;
  }

  return (
    <defs>
      {ends.has('arrow') ? (
        <marker
          id={markerId(markerPrefix, 'arrow')}
          className={`${prefix}__marker ${prefix}__marker--arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      ) : null}
      {ends.has('dot') ? (
        <marker
          id={markerId(markerPrefix, 'dot')}
          className={`${prefix}__marker ${prefix}__marker--dot`}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
        >
          <circle cx="5" cy="5" r="3" />
        </marker>
      ) : null}
    </defs>
  );
}

export function markerId(prefix: string, end: string): string {
  return `${prefix.replace(/[^a-zA-Z0-9_-]+/g, '-')}-marker-${end}`;
}
