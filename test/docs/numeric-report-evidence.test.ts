import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateAnnotationLayout, resolveAnnotationLayout } from '../../src/index.js';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('documented numerical report evidence', () => {
  it('retains nonfinite meaning in saved JSON without pretending to restore a typed report', () => {
    const layout = resolveAnnotationLayout({
      annotations: [{ id: 'note', anchor: { type: 'point', point: { x: 20, y: 20 } }, note: { title: 'Evidence' } }],
      bounds: { x: 0, y: 0, width: 400, height: 300 }
    });
    // Exercise a measured host whose coordinates have exceeded numeric area range.
    const box = { x: 0, y: 0, width: 1e200, height: 1e200 };
    const measured = { ...layout, bounds: box, placementBounds: box, obstacles: [box],
      annotations: layout.annotations.map(note => ({ ...note, noteBox: box })) };
    const quality = evaluateAnnotationLayout(measured, { readability: true });
    const savedEvidence = JSON.stringify(quality);
    const parsed = JSON.parse(savedEvidence);
    expect(quality.metrics.obstacleOverlapArea).toBe(Infinity);
    expect(parsed.metrics.obstacleOverlapArea).toBeNull();
    expect(parsed.numericDiagnostics).toContainEqual({ path: 'metrics.obstacleOverlapArea', value: 'Infinity' });
    expect(parsed.ok).toBe(false);
    expect(read('../../docs/api-reference.md')).toContain('const savedEvidence = JSON.stringify(quality)');
    expect(read('../../docs/api-reference.md')).toContain('quality.numericDiagnostics ?? []');
  });

  it('keeps the established finite report shape and documents the new source boundary', () => {
    const quality = evaluateAnnotationLayout(resolveAnnotationLayout({ annotations: [],
      bounds: { x: 0, y: 0, width: 400, height: 300 } }));
    expect(Object.hasOwn(quality, 'numericDiagnostics')).toBe(false);
    const stability = read('../../docs/api-stability.md');
    expect(stability).toContain('### Numeric report evidence (0.9)');
    expect(stability).toContain('Reports whose numeric fields are all\nfinite retain their previous shape.');
  });
});
