import { describe, expect, it } from 'vitest';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../../src/index.js';
import type { Annotation, LayoutOptions, ResolvedLayout } from '../../src/index.js';

function fixture(count = 30): LayoutOptions {
  const annotations: Annotation[] = Array.from({ length: count }, (_, index) => ({
    id: `annotation-${String(index).padStart(3, '0')}`,
    anchor: { type: 'box', box: {
      x: 32 + (index % 10) * 94,
      y: 42 + Math.floor(index / 10) * 104,
      width: 34,
      height: 26
    } },
    note: { title: `Annotation ${index}`, body: 'Example text for a diagram.' },
    priority: count - index,
    connector: { type: index % 5 === 0 ? 'elbow' : 'straight' },
    placement: index % 11 === 0
      ? { manual: { x: 10 + (index % 10) * 100, y: 10 + Math.floor(index / 10) * 98 } }
      : { side: ['right', 'bottom', 'top'], align: 'center', offset: [12, 26], crossOffset: [0, 24, -24] }
  }));
  return {
    annotations,
    bounds: { x: 0, y: 0, width: 1110, height: 640 },
    padding: 12,
    obstacles: [{ x: 500, y: 45, width: 80, height: 70 }, { x: 700, y: 300, width: 90, height: 50 }],
    noteSizes: Object.fromEntries(annotations.map((a, index) => [a.id, {
      width: 100 + index % 3 * 16,
      height: 42 + index % 2 * 6
    }])),
    placement: { maxCandidates: 6 },
    refinement: false
  };
}

function assertFullParity(layout: ResolvedLayout, input: LayoutOptions) {
  const full = resolveAnnotationLayout(input);
  expect(layout).toEqual(full);
  expect(evaluateAnnotationLayout(layout)).toEqual(evaluateAnnotationLayout(full));
}

describe('experimental incremental annotation layout session', () => {
  it('returns a shared stable layout for semantic no-op updates', () => {
    const options = fixture(18);
    const session = createIncrementalAnnotationLayoutSession(options);
    const initial = session.layout;
    const independentCopy = structuredClone(options);
    expect(session.update(independentCopy)).toBe(initial);
    expect(session.layout).toBe(initial);
  });

  it('reuses priority-ordered prefix and recomputes only a changed suffix', () => {
    const options = fixture(30);
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const next = structuredClone(options);
    const annotation = next.annotations[27]!;
    annotation.anchor = { type: 'point', point: { x: 850, y: 455 } };

    const updated = session.update(next);
    assertFullParity(updated, next);
    expect(updated.annotations).toHaveLength(30);
    for (let index = 0; index < 27; index++) {
      expect(updated.annotations[index]).toBe(previous.annotations[index]);
    }
    expect(updated.annotations[27]).not.toBe(previous.annotations[27]);
    expect(updated.annotations[28]).not.toBe(previous.annotations[28]);
  });

  it('handles changes to an earlier note without retaining an invalid suffix', () => {
    const options = fixture(18);
    const session = createIncrementalAnnotationLayoutSession(options);
    const next = structuredClone(options);
    next.annotations[0]!.anchor = { type: 'point', point: { x: 250, y: 320 } };
    const updated = session.update(next);
    assertFullParity(updated, next);
  });

  it('detects nested in-place changes after capturing a value snapshot', () => {
    const options = fixture(20);
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const late = options.annotations[19]!;
    if (late.anchor.type !== 'box') throw new Error('Expected box fixture');
    late.anchor.box.x += 63;

    const updated = session.update(options);
    assertFullParity(updated, options);
    expect(updated.annotations[0]).toBe(previous.annotations[0]);
    expect(updated.annotations[19]).not.toBe(previous.annotations[19]);
  });

  it('detects later note size changes and preserves earlier candidate geometry', () => {
    const options = fixture(19);
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    options.noteSizes![options.annotations[18]!.id]!.width += 30;

    const updated = session.update(options);
    assertFullParity(updated, options);
    expect(updated.annotations[0]).toBe(previous.annotations[0]);
    expect(updated.annotations[18]!.noteBox.width).toBe(previous.annotations[18]!.noteBox.width + 30);
  });

  it('fully reflows when global obstacles, bounds or layout defaults change', () => {
    const options = fixture(12);
    const session = createIncrementalAnnotationLayoutSession(options);
    const first = session.layout;
    options.obstacles![0]!.x += 30;
    const obstacleChange = session.update(options);
    assertFullParity(obstacleChange, options);
    expect(obstacleChange.annotations[0]).not.toBe(first.annotations[0]);

    const next = structuredClone(options);
    next.bounds.width -= 80;
    assertFullParity(session.update(next), next);
    next.placement = { ...next.placement, offset: 35 };
    assertFullParity(session.update(next), next);
  });

  it('falls back when priorities reorder or the number of annotations changes', () => {
    const options = fixture(16);
    const session = createIncrementalAnnotationLayoutSession(options);
    const next = structuredClone(options);
    next.annotations[15]!.priority = 999;
    assertFullParity(session.update(next), next);
    next.annotations.splice(7, 1);
    assertFullParity(session.update(next), next);
    next.annotations.push({
      id: 'brand-new', anchor: { type: 'point', point: { x: 40, y: 80 } },
      note: { title: 'New note' }
    });
    assertFullParity(session.update(next), next);
  });

  it('never keeps a prefix across iterative refinement', () => {
    const options = fixture(5);
    options.refinement = { enabled: true, passes: 1, maxCandidatesPerAnnotation: 5 };
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const next = structuredClone(options);
    next.annotations[4]!.anchor = { type: 'point', point: { x: 235, y: 90 } };
    const updated = session.update(next);
    assertFullParity(updated, next);
    expect(updated.annotations[0]).not.toBe(previous.annotations[0]);
  });

  it('preserves prior state when an update throws, then recovers on valid input', () => {
    const options = fixture(8);
    const session = createIncrementalAnnotationLayoutSession(options);
    const stable = session.layout;
    const invalid = structuredClone(options);
    invalid.annotations[7]!.placement = { manual: { x: Number.NaN, y: 20 } };
    expect(() => session.update(invalid)).toThrow();
    expect(session.layout).toBe(stable);
    expect(session.update(options)).toBe(stable);
  });

  it('detects changed regex splitter options even with the same annotation ID', () => {
    const options = fixture(12);
    delete options.noteSizes![options.annotations[11]!.id];
    options.annotations[11]!.note = {
      title: 'one two three four', wrapSplitter: /\\s+/, wrap: 18
    };
    const session = createIncrementalAnnotationLayoutSession(options);
    const original = session.layout;
    const next = structuredClone(options);
    next.annotations[11]!.note.wrapSplitter = /,/;
    const updated = session.update(next);
    assertFullParity(updated, next);
    expect(updated.annotations[0]).toBe(original.annotations[0]);
    expect(updated.annotations[11]).not.toBe(original.annotations[11]);
  });
});
