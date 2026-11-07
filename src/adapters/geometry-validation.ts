import type { Anchor, Box, Point } from '../core/model.js';
import { anchorSubject } from '../core/anchors.js';
import type { ExtractedAnchor } from '../dom/index.js';
import { anchorDiagnostic, type AnchorSpecDiagnostic } from './diagnostics.js';

/** Internal adapter validation; extraction remains permissive. */
export function validateExtractedAnchor(
  context: { id: string; source: string; expected: string; missingReason: string },
  resolve: () => ExtractedAnchor | undefined
): AnchorSpecDiagnostic {
  const { id, source, expected, missingReason } = context;
  try {
    const result = resolve();
    if (!result) {
      return anchorDiagnostic({ id, source, expected, status: 'missing', reason: missingReason });
    }
    if (!finiteBox(result.box) || !finitePoint(result.point) || !finiteAnchor(result.anchor)) {
      return anchorDiagnostic({
        id, source, expected, status: 'invalid',
        reason: `Resolved ${source} coordinates or bounds are nonfinite for ${expected}.`
      });
    }
    return anchorDiagnostic({ id, source, expected, status: 'found' });
  } catch (error) {
    return anchorDiagnostic({
      id, source, expected, status: 'invalid',
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}

function finiteBox(box: Box): boolean {
  // Preserve finite negative dimensions; check far edges as well as fields.
  return [box.x, box.y, box.width, box.height,
    box.x + box.width, box.y + box.height].every(Number.isFinite);
}

function finitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function finiteAnchor(anchor: Anchor): boolean {
  switch (anchor.type) {
    case 'box': return finiteBox(anchor.box);
    case 'point': return finitePoint(anchor.point);
    case 'path': {
      if (!anchor.points.every(finitePoint)) return false;
      // The measured SVG box can be finite while sampled-path arithmetic
      // overflows. Validate the geometry the core will resolve as well.
      const subject = anchorSubject(anchor);
      return finiteBox(subject.box) && finitePoint(subject.point);
    }
  }
}
