import { describe, expect, it } from 'vitest';
import { resolveAnnotationLayout } from '../../src/index.js';
import type { Annotation, LayoutOptions, ResolvedLayout } from '../../src/index.js';
import {
  applyWorkerLayout,
  canReuseWorkerAnnotation,
  encodeWorkerLayout,
  LayoutRevisionMismatchError
} from '../fixtures/worker-browser/layout-patch.js';
import { shareUnchangedWorkerLayout } from '../../examples/react-worker/layout-equality.js';

function options(count: number): LayoutOptions {
  const annotations: Annotation[] = Array.from({ length: count }, (_, i) => ({
    id: `note-${String(i).padStart(3, '0')}`,
    priority: count - i,
    anchor: { type: 'point', point: { x: 24 + (i % 12) * 86, y: 45 + Math.floor(i / 12) * 71 } },
    note: { title: `Note ${i}` },
    placement: { side: 'right', align: 'center', offset: [12, 24] },
    connector: { type: 'straight', routing: 'none' }
  }));
  return {
    annotations,
    noteSizes: Object.fromEntries(annotations.map(a => [a.id, { width: 80, height: 38 }])),
    bounds: { x: 0, y: 0, width: 1380, height: 900 },
    obstacles: [{ x: 1250, y: 800, width: 50, height: 45 }]
  };
}

function sample(count = 40) { return resolveAnnotationLayout(options(count)); }
function encodeAndApply(before: ResolvedLayout, after: ResolvedLayout) {
  const result = encodeWorkerLayout(3, 2, after, { revision: 2, layout: before });
  const applied = applyWorkerLayout({ revision: 2, layout: before }, result);
  expect(applied.state.layout).toEqual(after);
  expect(canReuseWorkerAnnotation(applied.state.layout, after)).toBe(true);
  return { result, applied };
}

describe('consumer-owned revisioned Worker layout transport', () => {
  it('falls back to a full snapshot until the host has acknowledged a baseline', () => {
    const layout = sample(8);
    const initial = encodeWorkerLayout(1, 0, layout);
    expect(initial.kind).toBe('snapshot');
    const reconstructed = applyWorkerLayout({ revision: 0, layout }, initial);
    expect(reconstructed.state.layout).toEqual(layout);
    expect(encodeWorkerLayout(2, 1, layout, { revision: 0, layout }).kind).toBe('snapshot');
  });

  it('sends one changed result for late edits and preserves all other object identities', () => {
    const first = options(40);
    const before = resolveAnnotationLayout(first);
    const changed = structuredClone(first);
    changed.annotations[39]!.note.title = 'New text';
    changed.annotations[39]!.anchor = { type: 'point', point: { x: 1130, y: 480 } };
    const after = resolveAnnotationLayout(changed);
    const { result, applied } = encodeAndApply(before, after);
    expect(result.kind).toBe('patch');
    if (result.kind !== 'patch') throw new Error('Expected compact patch');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]?.index).toBe(39);
    expect(applied.changed).toBe(1);
    expect(applied.reused).toBe(39);
    for (let i = 0; i < 39; i += 1) {
      expect(applied.state.layout.annotations[i]).toBe(before.annotations[i]);
    }
    const fullJSONBytes = Buffer.byteLength(JSON.stringify(after), 'utf8');
    const patchJSONBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    expect(patchJSONBytes).toBeLessThan(fullJSONBytes / 4);
  });

  it('keeps global obstacle metadata correct even when none of the notes change', () => {
    const first = options(18);
    const before = resolveAnnotationLayout(first);
    const edited = structuredClone(first);
    edited.obstacles![0]!.x += 9;
    const after = resolveAnnotationLayout(edited);
    const { result, applied } = encodeAndApply(before, after);
    expect(result.kind).toBe('patch');
    expect(applied.reused).toBe(18);
    expect(applied.state.layout.obstacles).toEqual(after.obstacles);
  });

  it('returns complete snapshots for reordered, inserted or removed annotations', () => {
    const source = options(6);
    const before = resolveAnnotationLayout(source);
    const fewer = structuredClone(source);
    fewer.annotations.pop();
    expect(encodeWorkerLayout(3, 2, resolveAnnotationLayout(fewer), { revision: 2, layout: before }).kind)
      .toBe('snapshot');
    const reordered = structuredClone(source);
    reordered.annotations[5]!.priority = 100;
    expect(encodeWorkerLayout(3, 2, resolveAnnotationLayout(reordered), { revision: 2, layout: before }).kind)
      .toBe('snapshot');
  });

  it('enforces revision admission before mutating any host layout state', () => {
    const before = sample(10);
    const patched = encodeWorkerLayout(3, 2, before, { revision: 2, layout: before });
    expect(() => applyWorkerLayout({ revision: 1, layout: before }, patched))
      .toThrow(LayoutRevisionMismatchError);
    expect(() => applyWorkerLayout({ revision: 3, layout: before }, patched))
      .toThrow('stale');
    expect(() => encodeWorkerLayout(2, 2, before, { revision: 2, layout: before }))
      .toThrow('revisions');
  });

  it('refuses malformed patch indices, duplicates and changed annotation IDs', () => {
    const before = sample(8);
    const result = encodeWorkerLayout(3, 2, before, { revision: 2, layout: before });
    if (result.kind !== 'patch') throw new Error('Expected no-op patch');
    const state = { revision: 2, layout: before };
    expect(() => applyWorkerLayout(state, { ...result, changed: [{ index: 9, annotation: before.annotations[0]! }] }))
      .toThrow('strictly ascending');
    expect(() => applyWorkerLayout(state, { ...result, changed: [
      { index: 1, annotation: before.annotations[1]! },
      { index: 1, annotation: before.annotations[1]! }
    ] })).toThrow('strictly ascending');
    expect(() => applyWorkerLayout(state, { ...result, changed: [{ index: 1, annotation: before.annotations[0]! }] }))
      .toThrow('annotation ID');
    expect(() => applyWorkerLayout(state, { ...result, count: 9 })).toThrow('count');
  });

  it('detects changes in shared-reference aliasing while retaining matching clone graphs', () => {
    const reused = { status: 'ready', values: [2, 4, 6] };
    const previous = { first: reused, second: reused };
    const sameSharing = structuredClone(previous);
    expect(sameSharing.first).toBe(sameSharing.second);
    expect(canReuseWorkerAnnotation(previous, sameSharing)).toBe(true);

    const split = {
      first: { status: 'ready', values: [2, 4, 6] },
      second: { status: 'ready', values: [2, 4, 6] }
    };
    expect(canReuseWorkerAnnotation(previous, split)).toBe(false);
    expect(canReuseWorkerAnnotation(split, previous)).toBe(false);
    expect(canReuseWorkerAnnotation(split, structuredClone(split))).toBe(true);

    const left = { x: 1 };
    const right = { x: 1 };
    expect(canReuseWorkerAnnotation({ a: left, b: right }, { a: left, b: left })).toBe(false);
  });

  it('sends an actual patch when metadata aliasing changes without moving geometry', () => {
    const source = options(9);
    const shared = { source: 'user', properties: ['a', 'b'] };
    source.annotations[8]!.metadata = { first: shared, second: shared };
    const before = resolveAnnotationLayout(source);
    const updatedOptions = structuredClone(source);
    updatedOptions.annotations[8]!.metadata = {
      first: { source: 'user', properties: ['a', 'b'] },
      second: { source: 'user', properties: ['a', 'b'] }
    };
    const after = resolveAnnotationLayout(updatedOptions);
    const { result, applied } = encodeAndApply(before, after);
    expect(result.kind).toBe('patch');
    if (result.kind !== 'patch') throw new Error('Expected compact patch');
    expect(result.changed.map((entry) => entry.index)).toEqual([8]);
    expect(applied.reused).toBe(8);
    const metadata = applied.state.layout.annotations[8]!.annotation.metadata!;
    expect(metadata.first).not.toBe(metadata.second);
    for (let i = 0; i < 8; i += 1) {
      expect(applied.state.layout.annotations[i]).toBe(before.annotations[i]);
    }
  });

  it('sends a full snapshot when two annotations split or join an equal-valued shared object', () => {
    const original = options(9);
    const shared = { stable: true, measurements: [1, 2] };
    original.annotations[0]!.metadata = shared;
    original.annotations[8]!.metadata = shared;
    const before = resolveAnnotationLayout(original);
    const split = structuredClone(original);
    split.annotations[8]!.metadata = { stable: true, measurements: [1, 2] };
    const after = resolveAnnotationLayout(split);
    const response = encodeWorkerLayout(3, 2, after, { revision: 2, layout: before });
    expect(response.kind).toBe('snapshot');
    const installed = applyWorkerLayout({ revision: 2, layout: before }, response).state.layout;
    expect(installed.annotations[0]!.annotation.metadata)
      .not.toBe(installed.annotations[8]!.annotation.metadata);
    expect(shareUnchangedWorkerLayout(before, after).reused).toBe(0);

    const rejoined = structuredClone(original);
    const again = resolveAnnotationLayout(rejoined);
    expect(encodeWorkerLayout(4, 3, again, { revision: 3, layout: after }).kind)
      .toBe('snapshot');
    expect(shareUnchangedWorkerLayout(after, again).reused).toBe(0);
    expect(again.annotations[0]!.annotation.metadata)
      .toBe(again.annotations[8]!.annotation.metadata);
  });

  it('keeps cross-note aliases intact when one member changes content', () => {
    const source = options(9);
    const metadata = { source: 'host', copy: { count: 5 } };
    source.annotations[0]!.metadata = metadata;
    source.annotations[8]!.metadata = metadata;
    const before = resolveAnnotationLayout(source);
    const next = structuredClone(source);
    next.annotations[8]!.note.title = 'Edited shared annotation';
    const after = resolveAnnotationLayout(next);
    expect(encodeWorkerLayout(3, 2, after, { revision: 2, layout: before }).kind)
      .toBe('snapshot');
    const shared = shareUnchangedWorkerLayout(before, after);
    expect(shared.reused).toBe(0);
    expect(shared.layout.annotations[0]!.annotation.metadata)
      .toBe(shared.layout.annotations[8]!.annotation.metadata);
  });

  it('retains compact reuse when the change is unrelated to shared annotations', () => {
    const source = options(9);
    const metadata = { tags: ['shared'] };
    source.annotations[0]!.metadata = metadata;
    source.annotations[1]!.metadata = metadata;
    const before = resolveAnnotationLayout(source);
    const next = structuredClone(source);
    next.annotations[8]!.note.title = 'Unrelated edit';
    const after = resolveAnnotationLayout(next);
    const response = encodeWorkerLayout(3, 2, after, { revision: 2, layout: before });
    expect(response.kind).toBe('patch');
    const committed = applyWorkerLayout({ revision: 2, layout: before }, response);
    expect(committed.changed).toBe(1);
    expect(committed.reused).toBe(8);
    expect(committed.state.layout.annotations[0]!.annotation.metadata)
      .toBe(committed.state.layout.annotations[1]!.annotation.metadata);
    const publiclyShared = shareUnchangedWorkerLayout(before, after);
    expect(publiclyShared.reused).toBe(8);
    expect(publiclyShared.layout.annotations[0]!.annotation.metadata)
      .toBe(publiclyShared.layout.annotations[1]!.annotation.metadata);
  });

  it('uses complete results rather than triggering host getters during reuse inspection', () => {
    const source = options(4);
    let reads = 0;
    const metadata = { stable: 'value' } as Record<string, unknown>;
    Object.defineProperty(metadata, 'computed', {
      enumerable: true,
      get() { reads++; return 'private'; }
    });
    source.annotations[3]!.metadata = metadata;
    const before = resolveAnnotationLayout(source);
    const after = resolveAnnotationLayout(source);
    const reply = encodeWorkerLayout(3, 2, after, { revision: 2, layout: before });
    expect(reply.kind).toBe('snapshot');
    expect(shareUnchangedWorkerLayout(before, after).reused).toBe(0);
    expect(reads).toBe(0);
  });

  it('recovers via revision mismatch for missing fields or malformed reply entries', () => {
    const before = sample(8);
    const response = encodeWorkerLayout(3, 2, before, { revision: 2, layout: before });
    if (response.kind !== 'patch') throw new Error('Expected compact no-op patch');
    const state = { revision: 2, layout: before };
    const invalid = (value: unknown) => () => applyWorkerLayout(state, value as typeof response);

    expect(invalid({ ...response, changed: [null] }))
      .toThrow(LayoutRevisionMismatchError);
    expect(invalid({ ...response, changed: [null] }))
      .toThrow('strictly ascending');
    expect(invalid({ ...response, fields: undefined }))
      .toThrow(LayoutRevisionMismatchError);
    expect(invalid({ ...response, fields: { bounds: before.bounds } }))
      .toThrow('authoritative layout fields');
    expect(invalid({ ...response, kind: 'unexpected' }))
      .toThrow(LayoutRevisionMismatchError);
    expect(invalid({ kind: 'snapshot', revision: 3, baseRevision: 2, layout: null }))
      .toThrow('snapshot');
    expect(state.layout).toBe(before);
  });

  it('never confuses omitted keys, sparse array sizes, or cyclic/opaque metadata with equality', () => {
    expect(canReuseWorkerAnnotation({ data: { info: undefined } }, { data: {} })).toBe(false);
    expect(canReuseWorkerAnnotation([,], new Array(2))).toBe(false);
    expect(canReuseWorkerAnnotation({ d: new Date('2024-01-01') }, { d: new Date('2024-01-01') })).toBe(false);
    const cyclicA: { value?: unknown; self?: unknown } = { value: 1 };
    cyclicA.self = cyclicA;
    const cyclicB: { value?: unknown; self?: unknown } = { value: 1 };
    cyclicB.self = cyclicB;
    expect(canReuseWorkerAnnotation(cyclicA, cyclicB)).toBe(false);
    expect(canReuseWorkerAnnotation({ score: Number.NaN }, { score: Number.NaN })).toBe(true);
    expect(canReuseWorkerAnnotation({ score: -0 }, { score: 0 })).toBe(false);
  });
});
