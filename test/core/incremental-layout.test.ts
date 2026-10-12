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
  // A complete 30-note cold full resolver can exceed Vitest's 5s default on
  // busy Node 20 runners. Keep every parity assertion, but give the test a
  // realistic deadline rather than introducing an intermittent CI failure.
  }, 20_000);

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
  it('invalidates a late note when equally valued metadata changes alias sharing', () => {
    const opts = fixture(20);
    const shared = { key: 'same', nested: { score: 5 } };
    opts.annotations[19]!.metadata = { first: shared, second: shared };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const prior = session.layout;
    const next = structuredClone(opts);
    next.annotations[19]!.metadata = {
      first: { key: 'same', nested: { score: 5 } },
      second: { key: 'same', nested: { score: 5 } }
    };
    const resolved = session.update(next);
    assertFullParity(resolved, next);
    expect(resolved.annotations[0]).toBe(prior.annotations[0]);
    expect(resolved.annotations[19]).not.toBe(prior.annotations[19]);
    const metadata = resolved.annotations[19]!.annotation.metadata!;
    expect(metadata.first).not.toBe(metadata.second);

    const linked = structuredClone(next);
    const sharedAgain = { key: 'same', nested: { score: 5 } };
    linked.annotations[19]!.metadata = { first: sharedAgain, second: sharedAgain };
    const reverted = session.update(linked);
    assertFullParity(reverted, linked);
    expect(reverted.annotations[19]).not.toBe(resolved.annotations[19]);
    expect(reverted.annotations[19]!.annotation.metadata!.first)
      .toBe(reverted.annotations[19]!.annotation.metadata!.second);
  });

  it('preserves cross-note alias topology on semantic no-ops and invalidates changed sharing', () => {
    const opts = fixture(8);
    const reusedAcrossNotes = { shared: { source: 'host', count: 3 } };
    opts.annotations[0]!.metadata = reusedAcrossNotes;
    opts.annotations[7]!.metadata = reusedAcrossNotes;
    const session = createIncrementalAnnotationLayoutSession(opts);
    const previous = session.layout;

    // A stable sharing relation is safe to reuse, even when a host clones its
    // source objects while preserving the same alias graph.
    expect(session.update(opts)).toBe(previous);
    expect(session.update(structuredClone(opts))).toBe(previous);

    // Splitting one alias into an independent, value-equivalent object only
    // changes the later note. Keep earlier identity and recompute its suffix.
    const detached = structuredClone(opts);
    detached.annotations[7]!.metadata = { shared: { source: 'host', count: 3 } };
    const next = session.update(detached);
    assertFullParity(next, detached);
    expect(next.annotations[0]).toBe(previous.annotations[0]);
    expect(next.annotations[7]).not.toBe(previous.annotations[7]);
    expect(next.annotations[0]!.annotation.metadata).not.toBe(next.annotations[7]!.annotation.metadata);

    const rejoined = structuredClone(opts);
    const restored = session.update(rejoined);
    assertFullParity(restored, rejoined);
    // Rejoined suffix uses a *cloned* owner metadata object, so refreshing the
    // owner is required to keep cross-note identity correct on this commit.
    expect(restored.annotations[0]).not.toBe(next.annotations[0]);
    expect(restored.annotations[7]).not.toBe(next.annotations[7]);
    expect(restored.annotations[0]!.annotation.metadata).toBe(restored.annotations[7]!.annotation.metadata);
  });

  it('invalidates cloned prefix owners when a new suffix note aliases them', () => {
    const opts = fixture(8);
    const session = createIncrementalAnnotationLayoutSession(opts);
    const previous = session.layout;

    const appended = structuredClone(opts);
    appended.annotations.push({
      ...appended.annotations[0]!, id: 'last', priority: -1000
    });
    const updated = session.update(appended);
    assertFullParity(updated, appended);
    // The newly appended note shares a cloned anchor and note with the first
    // source annotation. Retaining the prior first note here would break that
    // cross-note reference graph even though its values are unchanged.
    expect(updated.annotations[0]).not.toBe(previous.annotations[0]);
    expect(updated.annotations.at(-1)!.annotation.anchor).toBe(updated.annotations[0]!.annotation.anchor);
    expect(updated.annotations.at(-1)!.annotation.note).toBe(updated.annotations[0]!.annotation.note);

    // A separate append sharing the *original* owner preserves prefix objects.
    const oldInput = fixture(8);
    const oldSession = createIncrementalAnnotationLayoutSession(oldInput);
    const oldLayout = oldSession.layout;
    const sharingOld = { ...oldInput, annotations: [...oldInput.annotations, {
      ...oldInput.annotations[0]!, id: 'suffix', priority: -1000
    }] };
    const withOldAlias = oldSession.update(sharingOld);
    assertFullParity(withOldAlias, sharingOld);
    for (let i = 0; i < 8; i++) expect(withOldAlias.annotations[i]).toBe(oldLayout.annotations[i]);
    expect(withOldAlias.annotations.at(-1)!.annotation.anchor).toBe(withOldAlias.annotations[0]!.annotation.anchor);
  });

  it('distinguishes omitted metadata fields from explicit undefined values', () => {
    const opts = fixture(14);
    opts.annotations[13]!.metadata = { details: { present: true, extra: undefined } };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const prior = session.layout;
    const edited = structuredClone(opts);
    edited.annotations[13]!.metadata = { details: { present: true } };
    const result = session.update(edited);
    assertFullParity(result, edited);
    expect(result.annotations[0]).toBe(prior.annotations[0]);
    expect(result.annotations[13]).not.toBe(prior.annotations[13]);
    expect(Object.hasOwn(result.annotations[13]!.annotation.metadata!.details as object, 'extra'))
      .toBe(false);
  });

  it('distinguishes sparse arrays from explicit undefined entries', () => {
    const opts = fixture(10);
    opts.annotations[9]!.metadata = { values: [10, , 30] };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const prior = session.layout;
    const updated = structuredClone(opts);
    updated.annotations[9]!.metadata = { values: [10, undefined, 30] };
    const result = session.update(updated);
    assertFullParity(result, updated);
    expect(result.annotations[0]).toBe(prior.annotations[0]);
    expect(result.annotations[9]).not.toBe(prior.annotations[9]);
    const entries = result.annotations[9]!.annotation.metadata!.values as unknown[];
    expect(Object.hasOwn(entries, 1)).toBe(true);
  });

  it('recognizes negative zero and RegExp lastIndex changes that JSON masks', () => {
    const opts = fixture(10);
    opts.annotations[9]!.metadata = { coordinate: -0 };
    const splitter = /\s+/g;
    splitter.lastIndex = 2;
    opts.annotations[9]!.note.wrapSplitter = splitter;
    const session = createIncrementalAnnotationLayoutSession(opts);
    const first = session.layout;
    const next = structuredClone(opts);
    next.annotations[9]!.metadata = { coordinate: 0 };
    (next.annotations[9]!.note.wrapSplitter as RegExp).lastIndex = 5;
    const result = session.update(next);
    assertFullParity(result, next);
    expect(result.annotations[0]).toBe(first.annotations[0]);
    expect(result.annotations[9]).not.toBe(first.annotations[9]);
    expect(Object.is(result.annotations[9]!.annotation.metadata!.coordinate, 0)).toBe(true);
  });

  it('keeps unrelated prefix notes when an unsafe suffix also holds stored aliases', () => {
    const opts = fixture(8);
    const shared = { source: 'earlier note' };
    opts.annotations[0]!.metadata = { shared };
    let called = 0;
    const late: Record<string, unknown> = { shared };
    Object.defineProperty(late, 'computed', {
      enumerable: true,
      get() { called++; return 'not inspected'; }
    });
    opts.annotations[7]!.metadata = late;
    const session = createIncrementalAnnotationLayoutSession(opts);
    const before = session.layout;

    // A non-cloning update keeps the safe prefix. The suffix is always fresh.
    const same = session.update(opts);
    assertFullParity(same, opts);
    expect(same.annotations[0]).toBe(before.annotations[0]);
    expect(same.annotations[7]).not.toBe(before.annotations[7]);
    expect(called).toBe(0);

    // If a cloned prefix owner is now shared with the unsafe suffix, retaining
    // the old owner would detach the source object's reference graph.
    const clonedShared = { source: 'earlier note' };
    const cloned = fixture(8);
    cloned.annotations[0]!.metadata = { shared: clonedShared };
    const otherLate: Record<string, unknown> = { shared: clonedShared };
    Object.defineProperty(otherLate, 'computed', {
      enumerable: true,
      get() { called++; return 'not inspected'; }
    });
    cloned.annotations[7]!.metadata = otherLate;
    const updated = session.update(cloned);
    assertFullParity(updated, cloned);
    expect(updated.annotations[0]).not.toBe(same.annotations[0]);
    expect(updated.annotations[0]!.annotation.metadata!.shared)
      .toBe(updated.annotations[7]!.annotation.metadata!.shared);
    expect(called).toBe(0);
  });

  it('falls back without calling metadata getters or hiding cyclic/opaque values', () => {
    const opts = fixture(8);
    let getterCalls = 0;
    const metadata: Record<string, unknown> = { title: 'safe' };
    Object.defineProperty(metadata, 'private', {
      configurable: true, enumerable: true,
      get() { getterCalls += 1; return 'invisible'; }
    });
    opts.annotations[7]!.metadata = metadata;
    const session = createIncrementalAnnotationLayoutSession(opts);
    const previous = session.layout;
    const noOp = session.update(opts);
    assertFullParity(noOp, opts);
    expect(getterCalls).toBe(0);
    expect(noOp.annotations[0]).toBe(previous.annotations[0]);
    expect(noOp.annotations[7]).not.toBe(previous.annotations[7]);

    const cycle: Record<string, unknown> = { label: 'cycle' };
    cycle.self = cycle;
    opts.annotations[7]!.metadata = cycle;
    const withCycle = session.update(opts);
    assertFullParity(withCycle, opts);
    expect(withCycle.annotations[7]).not.toBe(noOp.annotations[7]);
    expect((withCycle.annotations[7]!.annotation.metadata as Record<string, unknown>).self)
      .toBe(withCycle.annotations[7]!.annotation.metadata);

    opts.annotations[7]!.metadata = { date: new Date('2025-01-01T00:00:00Z') };
    const opaque = session.update(opts);
    assertFullParity(opaque, opts);
    expect(opaque.annotations[7]).not.toBe(withCycle.annotations[7]);
  });

});
