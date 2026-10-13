import { afterEach, describe, expect, it, vi } from 'vitest';
import * as connectors from '../../src/core/connectors.js';
import { resolveAnnotationLayout } from '../../src/core/layout.js';
import { createIncrementalAnnotationLayoutSession } from '../../src/core/incremental-layout.js';
import { allPlacementCandidates } from '../../src/core/placement.js';
import { evaluateAnnotationLayout } from '../../src/core/quality.js';
import type { LayoutOptions, ResolvedLayout } from '../../src/core/model.js';

afterEach(() => vi.restoreAllMocks());

function fixture(): LayoutOptions {
  const ids = ['__proto__', 'constructor', 'toString', '', 'last'];
  return {
    bounds: { x: 0, y: 0, width: 1400, height: 900 },
    annotations: ids.map((id, index) => ({
      id, priority: ids.length - index,
      anchor: { type: 'point', point: { x: 200 + index * 210, y: 400 } },
      note: { title: `Note ${index}` }, connector: { type: 'straight', routing: 'none' }
    })),
    noteSizes: Object.fromEntries(ids.map(id => [id, { width: 90, height: 40 }]))
  };
}

function winners(layout: ResolvedLayout): Omit<ResolvedLayout, 'diagnostics'> {
  const { diagnostics: _diagnostics, ...normal } = layout;
  return normal;
}

function assertNoCandidates(value: unknown, seen = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(value).not.toHaveProperty('candidates');
  expect(value).not.toHaveProperty('scoreBreakdown');
  expect(value).not.toHaveProperty('rawNoteBox');
  for (const child of Object.values(value)) assertNoCandidates(child, seen);
}

describe('layout diagnostics are separate from solver results', () => {
  it('has a lean object graph and routes fewer connectors before serializing', () => {
    const options = fixture();
    const spy = vi.spyOn(connectors, 'connectorPath');
    const normal = resolveAnnotationLayout(options);
    const leanCalls = spy.mock.calls.length;
    spy.mockClear();
    const exhaustive = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 'all' } });
    expect(spy).toHaveBeenCalledTimes(options.annotations.length * 240);
    expect(leanCalls).toBeGreaterThanOrEqual(options.annotations.length);
    expect(leanCalls).toBeLessThan(spy.mock.calls.length / 4);
    expect(normal).not.toHaveProperty('diagnostics');
    assertNoCandidates(normal);
    expect(normal).toStrictEqual(winners(exhaustive));
    expect(JSON.stringify(normal).length).toBeLessThan(JSON.stringify(exhaustive).length / 10);
    expect(structuredClone(normal)).toStrictEqual(normal);
  });

  it.each([1, 8, 'all'] as const)('retains original greedy ranking for %s and arbitrary IDs', (limit) => {
    const options = fixture();
    const all = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 'all' } });
    const selected = resolveAnnotationLayout({ ...options, diagnostics: { candidates: limit } });
    expect(winners(selected)).toStrictEqual(winners(all));
    expect(selected.diagnostics!.annotations.map(entry => entry.id)).toEqual(options.annotations.map(a => a.id));
    expect(selected.diagnostics!.annotations).toStrictEqual(all.diagnostics!.annotations.map(entry => ({
      ...entry, candidates: limit === 'all' ? entry.candidates : entry.candidates.slice(0, limit)
    })));
    expect(structuredClone(selected)).toStrictEqual(selected);
    expect(JSON.parse(JSON.stringify(selected))).toStrictEqual(selected);
  });

  it.each([null, false, 8, [], {}, { candidates: undefined }, { candidates: null },
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '8', 'ALL'].map(candidates => ({ candidates }))])(
    'rejects malformed diagnostics %j, including empty and no-op inputs', (diagnostics) => {
      const options = fixture();
      const session = createIncrementalAnnotationLayoutSession(options);
      const invalid = { ...options, diagnostics } as LayoutOptions;
      expect(() => resolveAnnotationLayout(invalid)).toThrow(/diagnostics.candidates/);
      expect(() => resolveAnnotationLayout({ ...invalid, annotations: [] })).toThrow(/diagnostics.candidates/);
      expect(() => session.update(invalid)).toThrow(/diagnostics.candidates/);
      expect(session.layout).toBe(session.update(options));
    }
  );

  it.each([undefined, 0, 8])('rejects removed placement retention %s globally and per annotation', (maxCandidates) => {
    const options = fixture();
    const legacy = { maxCandidates };
    expect(() => resolveAnnotationLayout({ ...options, placement: legacy } as LayoutOptions)).toThrow(/removed.*diagnostics/);
    options.annotations[0]!.placement = legacy as NonNullable<LayoutOptions['placement']>;
    expect(() => resolveAnnotationLayout(options)).toThrow(/removed.*diagnostics/);
    expect(() => allPlacementCandidates({
      annotation: options.annotations[0]!, bounds: options.bounds, noteSize: { width: 90, height: 40 },
      obstacles: [], placedNotes: []
    })).toThrow(/removed.*second argument/);
  });

  it('keeps refined winners independent of diagnostics and keeps greedy ranking unchanged', () => {
    const options = fixture();
    options.bounds = { x: 0, y: 0, width: 360, height: 260 };
    options.annotations.forEach((a, i) => {
      a.anchor = { type: 'point', point: { x: 160 + i * 6, y: 125 + i * 4 } };
    });
    const greedy = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 'all' } });
    const refinement = { passes: 3, maxCandidatesPerAnnotation: 32 };
    const refined = resolveAnnotationLayout({ ...options, refinement });
    expect(refined.annotations.map(a => a.noteBox)).not.toEqual(greedy.annotations.map(a => a.noteBox));
    expect(evaluateAnnotationLayout(refined).metrics.noteOverlapArea).toBeLessThanOrEqual(
      evaluateAnnotationLayout(greedy).metrics.noteOverlapArea
    );
    assertNoCandidates(refined);
    for (const candidates of [1, 8, 'all'] as const) {
      const diagnostic = resolveAnnotationLayout({ ...options, refinement, diagnostics: { candidates } });
      expect(winners(diagnostic)).toStrictEqual(refined);
      expect(diagnostic.diagnostics!.annotations).toStrictEqual(greedy.diagnostics!.annotations.map(entry => ({
        ...entry, candidates: candidates === 'all' ? entry.candidates : entry.candidates.slice(0, candidates)
      })));
    }
  });
});

describe('incremental diagnostic retention', () => {
  it('enables, increases, reduces, disables and re-enables diagnostics while retaining winners', () => {
    const options = fixture();
    const session = createIncrementalAnnotationLayoutSession(options);
    const original = session.layout;
    const spy = vi.spyOn(connectors, 'connectorPath');
    let previous = original;
    for (const candidates of [8, 1, 8, 'all', 'all', 8, undefined, undefined, 1] as const) {
      const next = { ...structuredClone(options), ...(candidates === undefined ? {} : { diagnostics: { candidates } }) };
      spy.mockClear();
      const actual = session.update(next);
      const calls = spy.mock.calls.length;
      expect(actual.annotations.every((a, index) => a === original.annotations[index])).toBe(true);
      const oldLimit = previous.diagnostics?.annotations[0]?.candidates.length ?? 0;
      if (candidates === undefined || typeof candidates === 'number' && candidates <= oldLimit) expect(calls).toBe(0);
      if (candidates === undefined && !previous.diagnostics
        || candidates === 'all' && oldLimit === 240) expect(actual).toBe(previous);
      expect(actual).toStrictEqual(resolveAnnotationLayout(next));
      expect(structuredClone(actual)).toStrictEqual(actual);
      previous = actual;
    }
  });

  it.each([1, 8, 'all'] as const)('retains reused diagnostics and refreshes changed geometry for %s', (candidates) => {
    const options = { ...fixture(), diagnostics: { candidates } };
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const next = structuredClone(options);
    next.annotations[3]!.anchor = { type: 'point', point: { x: 720, y: 210 } };
    const actual = session.update(next);
    expect(actual).toStrictEqual(resolveAnnotationLayout(next));
    expect(actual.annotations[0]).toBe(previous.annotations[0]);
    expect(actual.diagnostics!.annotations[0]!.candidates).toBe(previous.diagnostics!.annotations[0]!.candidates);
    expect(actual.diagnostics!.annotations[3]!.candidates).not.toBe(previous.diagnostics!.annotations[3]!.candidates);
    expect(session.update(structuredClone(next))).toBe(actual);
    const smaller = structuredClone(next);
    smaller.annotations.pop();
    expect(session.update(smaller)).toStrictEqual(resolveAnnotationLayout(smaller));
    expect(session.update(next)).toStrictEqual(resolveAnnotationLayout(next));
  });
});
