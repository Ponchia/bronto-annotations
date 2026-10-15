import { describe, expect, it } from 'vitest';
import {
  assertAnnotationLayoutQuality,
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  renderAnnotationsSvg,
  resolveAnnotationLayout
} from '../../src/index.js';
import { countTextGraphemes, wrapNoteText } from '../../src/core/text.js';
import type { Annotation, LayoutOptions } from '../../src/index.js';

function annotation(id: string, x = 140): Annotation {
  return {
    id,
    anchor: { type: 'point', point: { x, y: 110 } },
    note: { title: id },
    connector: { type: 'straight', routing: 'none' }
  };
}

const bounds = { x: 0, y: 0, width: 420, height: 260 };

describe('source-identity and deterministic layout invariants', () => {
  it('places equal-priority IDs in a fixed code-unit order instead of locale order', () => {
    const annotations = [annotation('ä'), annotation('z')];
    const sizes = { 'ä': { width: 100, height: 48 }, z: { width: 100, height: 48 } };
    const layout = resolveAnnotationLayout({ annotations, bounds, noteSizes: sizes });
    expect(layout.annotations.map((item) => item.id)).toEqual(['z', 'ä']);
    expect(layout.annotations[0]?.noteBox.x).toBe(90);
    expect(layout.annotations[1]?.noteBox.x).not.toBe(90);

    // Layout output order and SVG stacking order must use the same tie-breaker.
    const svg = renderAnnotationsSvg(layout);
    expect(svg.indexOf('data-annotation-id="z"')).toBeLessThan(svg.indexOf('data-annotation-id="ä"'));
    expect(resolveAnnotationLayout({ annotations: [...annotations].reverse(), bounds, noteSizes: sizes }))
      .toEqual(layout);
  });

  it('rejects duplicate IDs at creation and on incremental updates without corrupting state', () => {
    const first = annotation('__proto__');
    const second = annotation('__proto__', 210);
    const duplicate = { annotations: [first, second], bounds };
    expect(() => resolveAnnotationLayout(duplicate)).toThrow(/Duplicate annotation ID "__proto__"/);
    expect(() => createIncrementalAnnotationLayoutSession(duplicate)).toThrow(/Duplicate annotation ID/);

    const options = { annotations: [annotation('constructor'), annotation('toString')], bounds };
    const session = createIncrementalAnnotationLayoutSession(options);
    const stable = session.layout;
    expect(() => session.update({
      annotations: [options.annotations[0]!, { ...options.annotations[1]!, id: 'constructor' }],
      bounds
    })).toThrow(/Duplicate annotation ID "constructor"/);
    expect(session.layout).toBe(stable);
    expect(session.update(structuredClone(options))).toBe(stable);
    expect(resolveAnnotationLayout(options).annotations).toHaveLength(2);
  });

  it('treats all equivalent disabled-refinement forms as safe no-op reuse', () => {
    for (const refinement of [undefined, false, { enabled: false }] as const) {
      const options: LayoutOptions = { annotations: [annotation('a'), annotation('b', 190)], bounds,
        ...(refinement === undefined ? {} : { refinement }) };
      const session = createIncrementalAnnotationLayoutSession(options);
      const original = session.layout;
      const omitted = structuredClone(options);
      delete omitted.refinement;
      const variants: LayoutOptions[] = [
        { ...structuredClone(options), refinement: false },
        { ...structuredClone(options), refinement: { enabled: false } },
        omitted
      ];
      for (const next of variants) {
        expect(session.update(next)).toBe(original);
      }
    }
  });

  it('distinguishes valid geometry from host-content occlusion and fails a default assertion', () => {
    const layout = resolveAnnotationLayout({
      annotations: [{ ...annotation('obscured'), placement: { manual: { x: 180, y: 20 } } }],
      bounds,
      noteSizes: { obscured: { width: 120, height: 70 } },
      obstacles: [{ x: 190, y: 30, width: 40, height: 40 }]
    });
    const quality = evaluateAnnotationLayout(layout);
    expect(quality.geometryValid).toBe(true);
    expect(quality.hostContentClear).toBe(false);
    expect(quality.ok).toBe(false);
    expect(quality.issues.some((issue) => issue.type === 'obstacle-overlap' && issue.severity === 'warning')).toBe(true);
    expect(() => assertAnnotationLayoutQuality(quality)).toThrow(/obscure protected host content/);
  });

  it('does not promise wire serialization for arbitrary host metadata', () => {
    const cycle: Record<string, unknown> = { purpose: 'host-only' };
    cycle.self = cycle;
    const cyclic = resolveAnnotationLayout({ annotations: [{ ...annotation('cycle'), metadata: cycle }], bounds });
    expect(cyclic.annotations[0]?.annotation.metadata).toBe(cycle);
    expect(() => JSON.stringify(cyclic)).toThrow(TypeError);

    const fn = () => 1;
    const nonCloneable = resolveAnnotationLayout({
      annotations: [{ ...annotation('closure'), metadata: { fn } }], bounds
    });
    expect(nonCloneable.annotations[0]?.annotation.metadata).toEqual({ fn });
    expect(() => structuredClone(nonCloneable)).toThrow();
  });
});

describe('Unicode-safe annotation text', () => {
  it('wraps complete graphemes instead of splitting surrogate pairs', () => {
    expect(wrapNoteText('😀😀😀', { maxChars: 1 })).toEqual(['😀', '😀', '😀']);
    expect(wrapNoteText('😀😀😀', { maxChars: 2 })).toEqual(['😀😀', '😀']);
    expect(wrapNoteText('e\u0301e\u0301', { maxChars: 1 })).toEqual(['e\u0301', 'e\u0301']);
    expect(wrapNoteText('👩‍👩‍👧‍👦🫱🏽‍🫲🏻', { maxChars: 1 })).toEqual(['👩‍👩‍👧‍👦', '🫱🏽‍🫲🏻']);
    expect(countTextGraphemes('👩‍👩‍👧‍👦 e\u0301')).toBe(3);
  });

  it('preserves ordinary ASCII wrapping and explicit custom splitters', () => {
    expect(wrapNoteText('alpha beta gamma', { maxChars: 10 })).toEqual(['alpha beta', 'gamma']);
    expect(wrapNoteText('abc-def-ghi', { maxChars: 4, splitter: '-' })).toEqual(['abc', 'def', 'ghi']);
    expect(wrapNoteText('one two three', { maxChars: 5, maxLines: 2 })).toEqual(['one', 'two']);
  });

  it('renders complete graphemes in SVG note lines', () => {
    const layout = resolveAnnotationLayout({
      annotations: [{ ...annotation('emoji'), note: { title: 'emoji', body: '😀😀😀', wrap: 1 } }],
      bounds,
      noteSizes: { emoji: { width: 115, height: 95 } }
    });
    const svg = renderAnnotationsSvg(layout);
    expect(svg.match(/>😀<\/text>/g)).toHaveLength(3);
    expect(svg).not.toContain('�');
  });
});
