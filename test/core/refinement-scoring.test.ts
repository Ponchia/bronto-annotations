import { describe, expect, it } from 'vitest';
import { resolveAnnotationLayout, refineAnnotationLayout } from '../../src/core/layout-resolver.js';
import { createRefinementScoreWorkspace } from '../../src/core/refinement-score.js';
import { evaluateAnnotationLayout } from '../../src/core/quality.js';
import { eagerRefinementReference, fullQualityRefinementScore } from '../fixtures/refinement-reference.js';
import type { LayoutOptions, ResolvedLayout } from '../../src/core/model.js';

function fixture(seed: number, count = 12): LayoutOptions {
  let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  return { bounds: { x: -12.3, y: -9.8, width: 370.7, height: 265.3 },
    annotations: Array.from({ length: count }, (_, index) => ({
      id: ['__proto__', 'Å', 'z'][index] ?? `note-${index}`,
      priority: index % 3,
      anchor: { type: 'point', point: { x: random() * 330, y: random() * 235 } },
      note: { title: `Note ${index}` },
      connector: { type: index % 2 ? 'straight' : 'elbow', routing: 'none' },
      placement: index === 0 ? { manual: { x: 50.25, y: 40.75 } } : {}
    })),
    obstacles: [{ x: 81.17, y: 50.23, width: 58.77, height: 71.09 },
      { x: -3.5, y: 205.2, width: 33.1, height: 25.3 }],
    defaultNoteSize: { width: 64.1, height: 34.7 },
    diagnostics: { candidates: 8 }
  };
}

describe('bounded exact refinement scoring', () => {
  it('matches full quality evaluation for every trial and retains the original base', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const layout = resolveAnnotationLayout(fixture(seed));
      const before = structuredClone(layout);
      const workspace = createRefinementScoreWorkspace(layout)!;
      for (const [index, note] of layout.annotations.entries()) {
        for (const candidate of layout.diagnostics!.annotations[index]!.candidates) {
          const replacement = { ...note, noteBox: candidate.noteBox, connector: candidate.connector };
          const annotations = [...layout.annotations]; annotations[index] = replacement;
          expect(workspace.scoreReplacement(index, replacement)).toBe(fullQualityRefinementScore({ ...layout, annotations }));
        }
        expect(workspace.scoreReplacement(index, note)).toBe(fullQualityRefinementScore(layout));
      }
      expect(layout).toEqual(before);
    }
  });
  it('preserves selected geometry, diagnostics, manual placements and public quality exactly', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const initial = resolveAnnotationLayout(fixture(seed));
      const frontier = initial.diagnostics!.annotations.map((entry) => entry.candidates);
      const reference = eagerRefinementReference(initial, frontier, 3, 8);
      const actual = refineAnnotationLayout(initial, frontier, { passes: 3, maxCandidatesPerAnnotation: 8 });
      expect(actual).toEqual(reference);
      expect(evaluateAnnotationLayout(actual)).toEqual(evaluateAnnotationLayout(reference));
      expect(actual.annotations.find((note) => note.id === '__proto__')?.noteBox)
        .toBe(initial.annotations.find((note) => note.id === '__proto__')?.noteBox);
      expect(actual.diagnostics).toBe(initial.diagnostics);
    }
  });
  it('updates incoming and outgoing connector interactions after committing a winner', () => {
    const layout = resolveAnnotationLayout(fixture(91));
    const workspace = createRefinementScoreWorkspace(layout)!;
    const committed = { ...layout.annotations[3]!, noteBox: { x: 50.1, y: 75.3, width: 101.1, height: 88.9 } };
    workspace.commit(3, committed);
    const base = { ...layout, annotations: [...layout.annotations] }; base.annotations[3] = committed;
    const next = { ...layout.annotations[6]!, connector: { ...layout.annotations[6]!.connector,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 180, y: 160 }] } };
    const expected = { ...base, annotations: [...base.annotations] }; expected.annotations[6] = next;
    expect(workspace.scoreReplacement(6, next)).toBe(fullQualityRefinementScore(expected));
    expect(workspace.scoreReplacement(0, base.annotations[0]!)).toBe(fullQualityRefinementScore(base));
  });
  it('retains evaluator semantics for nonfinite and zero-sized boxes without subtractive NaNs', () => {
    const layout = resolveAnnotationLayout(fixture(7, 4));
    const workspace = createRefinementScoreWorkspace(layout)!;
    for (const width of [0, -1, Infinity, NaN, 1e100, Number.MIN_VALUE]) {
      const item = { ...layout.annotations[0]!, noteBox: { x: 0, y: 0, width, height: 40 } };
      const annotations = [...layout.annotations]; annotations[0] = item;
      expect(workspace.scoreReplacement(0, item)).toBe(fullQualityRefinementScore({ ...layout, annotations }));
    }
  });
  it('falls back above the fixed scratch budget and keeps zero-score clone behavior', () => {
    const small = resolveAnnotationLayout({ annotations: [], bounds: { x: 0, y: 0, width: 100, height: 100 } });
    const large = { ...small, annotations: new Array(400) } as ResolvedLayout;
    expect(createRefinementScoreWorkspace(large)).toBeUndefined();
    const clear = resolveAnnotationLayout({ ...fixture(22, 2), obstacles: [],
      bounds: { x: 0, y: 0, width: 3000, height: 3000 },
      annotations: [{ id: 'one', anchor: { type: 'point', point: { x: 100, y: 100 } }, note: { title: 'One' } },
        { id: 'two', anchor: { type: 'point', point: { x: 1000, y: 1000 } }, note: { title: 'Two' } }] });
    const result = refineAnnotationLayout(clear, clear.diagnostics!.annotations.map((entry) => entry.candidates));
    expect(fullQualityRefinementScore(result)).toBe(0);
    expect(result).toEqual(clear);
    expect(result).not.toBe(clear);
    expect(result.annotations[0]).toBe(clear.annotations[0]);
  });
});
