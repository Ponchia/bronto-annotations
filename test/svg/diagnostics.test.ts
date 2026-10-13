import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAnnotationLayout } from '../../src/core/layout.js';
import * as search from '../../src/core/placement.js';
import * as connectors from '../../src/core/connectors.js';
import { renderAnnotationsSvg } from '../../src/svg/render.js';
import type { LayoutOptions } from '../../src/core/model.js';

afterEach(() => vi.restoreAllMocks());

const options: LayoutOptions = {
  bounds: { x: 0, y: 0, width: 500, height: 400 },
  annotations: [{ id: '__proto__', anchor: { type: 'point', point: { x: 240, y: 210 } }, note: { title: 'Debug' } }]
};

describe('SVG diagnostic presentation', () => {
  it.each([undefined, 1, 8, 'all'] as const)('renders only requested %s alternatives without solving', (candidates) => {
    const layout = resolveAnnotationLayout({ ...options, ...(candidates === undefined ? {} : { diagnostics: { candidates } }) });
    const normal = resolveAnnotationLayout(options);
    const candidateSearch = vi.spyOn(search, 'allPlacementCandidates');
    const routing = vi.spyOn(connectors, 'connectorPath');
    expect(renderAnnotationsSvg(layout)).toBe(renderAnnotationsSvg(normal));
    const svg = renderAnnotationsSvg(structuredClone(layout), { includeDebugBoxes: true });
    expect(svg.match(/data-debug-kind="winner"/g)).toHaveLength(1);
    expect(svg.match(/data-debug-kind="candidate"/g) ?? []).toHaveLength(candidates === 'all' ? 240 : candidates ?? 0);
    expect(svg).toContain('data-annotation-id="__proto__"');
    expect(candidateSearch).not.toHaveBeenCalled();
    expect(routing).not.toHaveBeenCalled();
  });

  it('preserves greedy diagnostic rank when a refined winner differs', () => {
    const layout = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 1 } });
    const greedy = layout.diagnostics!.annotations[0]!.candidates[0]!;
    // A render snapshot can already contain a final winner different from the greedy diagnostic.
    layout.annotations[0]!.noteBox = { ...layout.annotations[0]!.noteBox, x: 10, y: 20 };
    const svg = renderAnnotationsSvg(layout, { includeDebugBoxes: true });
    expect(svg).toContain('x="10" y="20"');
    expect(svg).toContain(`x="${greedy.noteBox.x}" y="${greedy.noteBox.y}"`);
    expect(svg).toContain('data-candidate-index="0"');
  });
});
