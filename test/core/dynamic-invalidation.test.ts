import { describe, expect, it } from 'vitest';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../../src/index.js';
import type { Annotation, LayoutOptions, ResolvedLayout } from '../../src/index.js';

function note(index: number, routing: 'none' | 'orthogonal' = 'none'): Annotation {
  return {
    id: `note-${String(index).padStart(3, '0')}`,
    priority: 1000 - index,
    anchor: { type: 'point', point: { x: 32 + index * 46, y: 125 } },
    note: { title: `Annotation ${index}` },
    placement: {
      side: ['right', 'top'],
      allowedSides: ['right', 'top'],
      align: 'center',
      allowedAligns: ['center'],
      offset: [12, 22],
      crossOffset: [0, 12],
      maxCandidates: 2
    },
    connector: { type: 'straight', routing }
  };
}

function scenario(count = 14, routing: 'none' | 'orthogonal' = 'none'): LayoutOptions {
  const annotations = Array.from({ length: count }, (_, index) => note(index, routing));
  return {
    annotations,
    bounds: { x: 0, y: 0, width: 3000, height: 400 },
    obstacles: [{ x: 2750, y: 40, width: 45, height: 70 }],
    noteSizes: Object.fromEntries(annotations.map((item) => [item.id, { width: 90, height: 40 }])),
    refinement: false
  };
}

function parity(actual: ResolvedLayout, options: LayoutOptions): void {
  const full = resolveAnnotationLayout(options);
  expect(actual).toEqual(full);
  expect(evaluateAnnotationLayout(actual)).toEqual(evaluateAnnotationLayout(full));
}

describe('dynamic topology / obstacle invalidation', () => {
  it('adds a lower-priority annotation and retains every preceding winner', () => {
    const options = scenario();
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const next = structuredClone(options);
    next.annotations.push(note(14));
    const resolved = session.update(next);
    parity(resolved, next);
    expect(resolved.annotations).toHaveLength(15);
    for (let index = 0; index < 14; index += 1) {
      expect(resolved.annotations[index]).toBe(previous.annotations[index]);
    }
    expect(resolved.annotations[14]?.id).toBe('note-014');
  });

  it('removes and restores the last note while retaining the unchanged prefix', () => {
    const options = scenario();
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    const smaller = structuredClone(options);
    smaller.annotations.pop();
    const reduced = session.update(smaller);
    parity(reduced, smaller);
    expect(reduced.annotations).toHaveLength(13);
    for (let index = 0; index < 13; index += 1) {
      expect(reduced.annotations[index]).toBe(before.annotations[index]);
    }
    const restored = session.update(options);
    parity(restored, options);
    for (let index = 0; index < 13; index += 1) {
      expect(restored.annotations[index]).toBe(reduced.annotations[index]);
    }
  });

  it('inserts an annotation mid-priority and invalidates only its suffix', () => {
    const options = scenario();
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    const next = structuredClone(options);
    next.annotations.push({ ...note(40), id: 'inserted', priority: 995.5 });
    const result = session.update(next);
    parity(result, next);
    for (let i = 0; i < 5; i += 1) expect(result.annotations[i]).toBe(before.annotations[i]);
    expect(result.annotations[5]?.id).toBe('inserted');
    expect(result.annotations[5]).not.toBe(before.annotations[5]);
  });

  it('reuses every annotation when added or in-place moved obstacles are far from all candidates', () => {
    const options = scenario();
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    options.obstacles!.push({ x: 2850, y: 210, width: 38, height: 32 });
    const added = session.update(options);
    parity(added, options);
    expect(added).not.toBe(before);
    for (let i = 0; i < 14; i += 1) expect(added.annotations[i]).toBe(before.annotations[i]);
    options.obstacles![1]!.x += 45;
    const moved = session.update(options);
    parity(moved, options);
    for (let i = 0; i < 14; i += 1) expect(moved.annotations[i]).toBe(before.annotations[i]);
  });

  it('recomputes the suffix when an obstacle touches a later note candidate', () => {
    const options = scenario();
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    const lastBox = before.annotations[13]!.noteBox;
    const next = structuredClone(options);
    next.obstacles!.push({ x: lastBox.x + 8, y: lastBox.y + 6, width: 27, height: 24 });
    const updated = session.update(next);
    parity(updated, next);
    expect(updated.annotations[0]).toBe(before.annotations[0]);
    expect(updated.annotations[13]).not.toBe(before.annotations[13]);
  });

  it('does not falsely reuse a truncated unselected placement candidate', () => {
    const options = scenario(8);
    // Every candidate must be examined, not only the two retained winners.
    for (const item of options.annotations) item.placement!.maxCandidates = 1;
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    const next = structuredClone(options);
    // Top-side candidate is farther than the preferred right-side winner.
    // A new obstacle above the anchor can change an unretained candidate's
    // scores even if the winning box remains unchanged.
    next.obstacles!.push({ x: 21, y: 40, width: 60, height: 40 });
    const updated = session.update(next);
    parity(updated, next);
    expect(updated.annotations[0]).not.toBe(before.annotations[0]);
  });

  it('falls back for default orthogonal routing even if the changed obstacle is far away', () => {
    const options = scenario(8, 'orthogonal');
    const session = createIncrementalAnnotationLayoutSession(options);
    const old = session.layout;
    const next = structuredClone(options);
    next.obstacles!.push({ x: 2900, y: 300, width: 40, height: 25 });
    const updated = session.update(next);
    parity(updated, next);
    expect(updated.annotations[0]).not.toBe(old.annotations[0]);
  });

  it('never reuses an edited annotation even if obstacles are spatially unrelated', () => {
    const options = scenario(10);
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    const next = structuredClone(options);
    next.annotations[7]!.anchor = { type: 'point', point: { x: 450, y: 240 } };
    next.obstacles!.push({ x: 2800, y: 340, width: 15, height: 12 });
    const updated = session.update(next);
    parity(updated, next);
    expect(updated.annotations[6]).toBe(before.annotations[6]);
    expect(updated.annotations[7]).not.toBe(before.annotations[7]);
  });

  it('combines appended annotations and far obstacle changes without losing parity', () => {
    const options = scenario(10);
    const session = createIncrementalAnnotationLayoutSession(options);
    const before = session.layout;
    const next = structuredClone(options);
    next.obstacles!.push({ x: 2800, y: 320, width: 18, height: 20 });
    next.annotations.push(note(10));
    const updated = session.update(next);
    parity(updated, next);
    expect(updated.annotations).toHaveLength(11);
    for (let i = 0; i < 10; i += 1) expect(updated.annotations[i]).toBe(before.annotations[i]);
  });

  it('returns fresh normalized bounds and obstacles for zero-annotation updates', () => {
    const empty: LayoutOptions = { annotations: [], bounds: { x: 0, y: 0, width: 200, height: 160 } };
    const session = createIncrementalAnnotationLayoutSession(empty);
    const first = session.layout;
    const changed: LayoutOptions = {
      annotations: [], bounds: { x: 0, y: 0, width: 320, height: 180 },
      obstacles: [{ x: 20, y: 20, width: 30, height: 30 }]
    };
    const updated = session.update(changed);
    parity(updated, changed);
    expect(updated).not.toBe(first);
    expect(updated.bounds.width).toBe(320);
    expect(updated.obstacles).toHaveLength(1);
    expect(session.update(structuredClone(changed))).toBe(updated);
  });

  it('supports unrouted curves and explicit routing mode objects with moved far obstacles', () => {
    const options = scenario(8);
    options.annotations[0]!.connector = { type: 'curve' };
    options.annotations[1]!.connector = { type: 'elbow', routing: { mode: 'none' } };
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const next = structuredClone(options);
    next.obstacles!.push({ x: 2690, y: 310, width: 30, height: 40 });
    const updated = session.update(next);
    parity(updated, next);
    for (let i = 0; i < 8; i += 1) expect(updated.annotations[i]).toBe(previous.annotations[i]);
  });

  it('does not reuse a prefix when the host changes routing on the first annotation', () => {
    const options = scenario(8);
    const session = createIncrementalAnnotationLayoutSession(options);
    const previous = session.layout;
    const next = structuredClone(options);
    next.annotations[0]!.connector = { type: 'straight', routing: 'orthogonal' };
    next.obstacles!.push({ x: 2860, y: 330, width: 15, height: 15 });
    const updated = session.update(next);
    parity(updated, next);
    expect(updated.annotations[0]).not.toBe(previous.annotations[0]);
  });

  it('preserves full 200-note parity across dense graph edits and a relocated obstacle', () => {
    // Regression: a distant box on the same line as a short straight connector
    // used to incur a false obstacle hit in candidate scoring. When moved,
    // previously higher-scored notes changed in the full solver even though
    // incremental spatial checks saw no actual geometry intersection.
    const bounds = { x: 0, y: 0, width: 1750, height: 1450 };
    const dense = Array.from({ length: 200 }, (_, index): Annotation => ({
      id: `dense-${index}`,
      priority: 10000 - index,
      anchor: { type: 'point', point: {
        x: 60 + (index % 11) * 110,
        y: 60 + Math.floor(index / 11) * 65
      } },
      note: { title: `Note ${index}` },
      connector: { type: 'straight', routing: 'none' },
      placement: {
        side: 'right', allowedSides: ['right'],
        align: 'center', allowedAligns: ['center'],
        offset: 12, crossOffset: 0, maxCandidates: 2
      }
    }));
    const options: LayoutOptions = {
      annotations: dense,
      bounds,
      defaultNoteSize: { width: 92, height: 32 },
      obstacles: [{ x: 1550, y: 1100, width: 70, height: 60 }],
      refinement: false
    };
    const session = createIncrementalAnnotationLayoutSession(options);
    const original = session.layout;
    const append: LayoutOptions = { ...options, annotations: [...dense, {
      ...dense[0]!, id: 'trailing', priority: -1000
    }] };
    const first = session.update(append);
    parity(first, append);
    expect(first.annotations.slice(0, 200).every((item, index) => item === original.annotations[index])).toBe(true);
    const second = session.update(options);
    parity(second, options);
    const far: LayoutOptions = {
      ...options, obstacles: [{ ...options.obstacles![0]!, x: 1500 }]
    };
    const beforeNear = session.update(far);
    parity(beforeNear, far);
    expect(beforeNear.annotations.every((item, index) => item === second.annotations[index])).toBe(true);
    const lastBox = beforeNear.annotations.at(-1)!.noteBox;
    const near: LayoutOptions = {
      ...options,
      obstacles: [{ x: lastBox.x + 2, y: lastBox.y + 2, width: 35, height: 25 }]
    };
    const moved = session.update(near);
    parity(moved, near);
    const prefix = moved.annotations.filter((item, index) => item === beforeNear.annotations[index]).length;
    expect(prefix).toBeGreaterThan(100);
    expect(prefix).toBeLessThan(200);
    expect(session.update(structuredClone(near))).toBe(moved);
  });

  it('preserves full solver parity through deterministic random topology mutations', () => {
    let seed = 18371;
    const random = () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let iteration = 0; iteration < 28; iteration += 1) {
      const options = scenario(6 + iteration % 6);
      const session = createIncrementalAnnotationLayoutSession(options);
      const next = structuredClone(options);
      const mode = iteration % 7;
      if (mode === 0) next.annotations.push(note(30));
      if (mode === 1) next.annotations.splice(4, 1);
      if (mode === 2) next.annotations[5]!.priority = (next.annotations[5]!.priority ?? 0) + 100;
      if (mode === 3) next.obstacles!.push({ x: 2400 + random() * 200, y: random() * 200, width: 60, height: 50 });
      if (mode === 4) next.obstacles!.push({ x: random() * 450, y: random() * 200, width: 50, height: 60 });
      if (mode === 5) next.annotations[5]!.connector!.routing = 'orthogonal';
      if (mode === 6) next.obstacles![0]!.x = random() * 800;
      const updated = session.update(next);
      parity(updated, next);
    }
  });
});
