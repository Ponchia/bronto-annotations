import { describe, expect, it } from 'vitest';
import { validateHostAnnotationEdit } from '../../examples/react-flow-basic/validate-edit.js';
import type { Annotation, LayoutOptions } from '../../src/index.js';

const bounds = { x: 0, y: 0, width: 560, height: 320 };
const annotations: Annotation[] = [{
  id: 'note',
  anchor: { type: 'point', point: { x: 90, y: 135 } },
  note: { title: 'Host note' },
  placement: { manual: { x: 280, y: 38 } }
}];
const options: LayoutOptions = {
  annotations,
  bounds,
  padding: 12,
  obstacles: [{ x: 120, y: 60, width: 125, height: 98 }],
  noteSizes: { note: { width: 150, height: 60 } }
};

describe('React Flow consumer edit admission', () => {
  it('rejects a proposed note position over a protected graph node', () => {
    const report = validateHostAnnotationEdit(options, {
      annotationId: 'note',
      placement: { manual: { x: 145, y: 75 } }
    });
    expect(report.geometryValid).toBe(true);
    expect(report.hostContentClear).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.metrics.obstacleOverlapArea).toBeGreaterThan(0);
    expect(annotations[0]!.placement?.manual?.x).toBe(280);
  });

  it('accepts a clear position without mutating the host annotation collection', () => {
    const report = validateHostAnnotationEdit(options, {
      annotationId: 'note',
      placement: { manual: { x: 340, y: 38 } }
    });
    expect(report.geometryValid).toBe(true);
    expect(report.hostContentClear).toBe(true);
    expect(report.ok).toBe(true);
    expect(annotations[0]!.placement?.manual?.x).toBe(280);
  });

  it('fails explicitly for unknown IDs instead of silently claiming an accepted edit', () => {
    expect(() => validateHostAnnotationEdit(options, {
      annotationId: 'missing',
      placement: { manual: { x: 350, y: 55 } }
    })).toThrow();
  });
});
