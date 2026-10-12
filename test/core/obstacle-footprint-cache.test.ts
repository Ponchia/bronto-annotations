import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/core/placement.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/placement.js')>();
  return { ...actual, allPlacementCandidates: vi.fn(actual.allPlacementCandidates) };
});

import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout
} from '../../src/index.js';
import { allPlacementCandidates } from '../../src/core/placement.js';
import type { Annotation, LayoutOptions, ResolvedLayout } from '../../src/index.js';

const candidateSearch = vi.mocked(allPlacementCandidates);

function scenario(count = 16): LayoutOptions {
  const annotations: Annotation[] = Array.from({ length: count }, (_, index) => ({
    id: `note-${String(index).padStart(3, '0')}`,
    priority: count - index,
    anchor: { type: 'point', point: { x: 56 + index * 66, y: 140 } },
    note: { title: `Note ${index}` },
    placement: {
      side: ['right', 'top'],
      allowedSides: ['right', 'top'],
      align: 'center',
      allowedAligns: ['center'],
      offset: [12, 22],
      maxCandidates: 1
    },
    connector: { type: 'straight', routing: 'none' }
  }));
  return {
    annotations,
    bounds: { x: 0, y: 0, width: 3000, height: 600 },
    noteSizes: Object.fromEntries(annotations.map((note) => [note.id, { width: 88, height: 40 }])),
    obstacles: [{ x: 2720, y: 450, width: 38, height: 30 }],
    refinement: false
  };
}

function expectFreshParity(layout: ResolvedLayout, options: LayoutOptions) {
  const fresh = resolveAnnotationLayout(options);
  expect(layout).toEqual(fresh);
  expect(evaluateAnnotationLayout(layout)).toEqual(evaluateAnnotationLayout(fresh));
}

describe('session-local exhaustive obstacle footprint cache', () => {
  it('reuses validated footprints across subsequent distant obstacle updates', () => {
    candidateSearch.mockClear();
    const initial = scenario();
    const session = createIncrementalAnnotationLayoutSession(initial);
    const original = session.layout;

    const first = structuredClone(initial);
    first.obstacles![0]!.x += 21;
    const beforeFirstProof = candidateSearch.mock.calls.length;
    const firstLayout = session.update(first);
    // The first obstacle update must still enumerate EVERY placement candidate
    // for each note. Retained maxCandidates=1 is not a safe spatial proof.
    expect(candidateSearch.mock.calls.length - beforeFirstProof).toBe(16);
    expect(firstLayout.annotations.every((note, index) => note === original.annotations[index])).toBe(true);

    const second = structuredClone(first);
    second.obstacles![0]!.x += 17;
    const beforeSecondProof = candidateSearch.mock.calls.length;
    const secondLayout = session.update(second);
    // The exhaustive footprints are already proven to correspond to the same
    // global geometry + note value fingerprints. Rechecking the changed boxes
    // must not regenerate candidates or re-run the full placement solver.
    expect(candidateSearch.mock.calls.length - beforeSecondProof).toBe(0);
    expect(secondLayout.annotations.every((note, index) => note === original.annotations[index])).toBe(true);

    expectFreshParity(firstLayout, first);
    expectFreshParity(secondLayout, second);
  });

  it('invalidates an edited suffix, in-place changes and changed global geometry', () => {
    candidateSearch.mockClear();
    const initial = scenario(10);
    const session = createIncrementalAnnotationLayoutSession(initial);
    const first = structuredClone(initial);
    first.obstacles![0]!.x += 13;
    session.update(first);

    // A later anchor edit must not reuse footprints generated for its old
    // geometry. The normal committed update recomputes only that suffix.
    const edited = structuredClone(first);
    edited.annotations[9]!.anchor = { type: 'point', point: { x: 800, y: 275 } };
    edited.obstacles![0]!.x += 10;
    const updated = session.update(edited);
    expectFreshParity(updated, edited);

    const moved = structuredClone(edited);
    moved.obstacles![0]!.x += 10;
    const beforeChangedNoteProof = candidateSearch.mock.calls.length;
    const validated = session.update(moved);
    expect(candidateSearch.mock.calls.length - beforeChangedNoteProof).toBe(1);
    expectFreshParity(validated, moved);

    // A different *global* bounds snapshot discards cached footprints rather
    // than applying geometry produced for the earlier coordinate space.
    const resized = structuredClone(moved);
    resized.bounds.width += 120;
    const afterResize = session.update(resized);
    expectFreshParity(afterResize, resized);

    const later = structuredClone(resized);
    later.obstacles![0]!.x += 9;
    const beforeReproof = candidateSearch.mock.calls.length;
    const reproved = session.update(later);
    expect(candidateSearch.mock.calls.length - beforeReproof).toBe(10);
    expectFreshParity(reproved, later);

    const last = structuredClone(later);
    last.obstacles![0]!.x += 7;
    const beforeHit = candidateSearch.mock.calls.length;
    const reused = session.update(last);
    expect(candidateSearch.mock.calls.length - beforeHit).toBe(0);
    expectFreshParity(reused, last);
  });

  it('revalidates every unretained candidate after a warm cache sees a nearby obstacle', () => {
    const initial = scenario(8);
    // The best visible placement is retained; the proof deliberately includes
    // other candidates despite maxCandidates=1.
    const session = createIncrementalAnnotationLayoutSession(initial);
    const before = session.layout;
    const warmed = structuredClone(initial);
    warmed.obstacles![0]!.x += 8;
    const warm = session.update(warmed);
    expect(warm.annotations.every((note, index) => note === before.annotations[index])).toBe(true);

    const updated = structuredClone(warmed);
    updated.obstacles!.push({ x: 35, y: 72, width: 78, height: 48 });
    const near = session.update(updated);
    // A cached footprint can *disprove* independence. It may never hide a
    // potentially affected placement simply because the old winner fits.
    expect(near.annotations[0]).not.toBe(warm.annotations[0]);
    expectFreshParity(near, updated);
  });

  it('rebuilds a changed effective note size footprint after in-place host edits', () => {
    candidateSearch.mockClear();
    const original = scenario(8);
    const session = createIncrementalAnnotationLayoutSession(original);
    const far = structuredClone(original);
    far.obstacles![0]!.x += 8;
    session.update(far);

    // Mutate the host's existing input, not a newly allocated note: snapshot
    // fingerprinting must still identify the effective note-size change.
    far.noteSizes!['note-007']!.width += 36;
    far.obstacles![0]!.x += 7;
    const changed = session.update(far);
    expectFreshParity(changed, far);
    const next = structuredClone(far);
    next.obstacles![0]!.x += 11;
    const callsBefore = candidateSearch.mock.calls.length;
    const reproof = session.update(next);
    expect(candidateSearch.mock.calls.length - callsBefore).toBe(1);
    expectFreshParity(reproof, next);
  });

  it('keeps fractional coordinates and closed-box boundary contacts conservative', () => {
    candidateSearch.mockClear();
    const source = scenario(4);
    source.annotations[0]!.anchor = {
      type: 'point', point: { x: 56.123456789123, y: 140.987654321987 }
    };
    source.noteSizes!['note-000'] = { width: 88.123456789123, height: 40.987654321987 };
    const session = createIncrementalAnnotationLayoutSession(source);
    const first = structuredClone(source);
    first.obstacles![0]!.x += 11.125;
    const warm = session.update(first);
    expectFreshParity(warm, first);

    // Closed contact must conservatively invalidate the old winner. This
    // differs from half-open drawing semantics, intentionally favoring parity
    // over reuse of a potentially affected connector segment.
    const box = warm.annotations[0]!.noteBox;
    const touching = structuredClone(first);
    touching.obstacles![0] = {
      x: box.x + box.width,
      y: box.y + box.height / 2,
      width: 17.125, height: 6.375
    };
    const touched = session.update(touching);
    expect(touched.annotations[0]).not.toBe(warm.annotations[0]);
    expectFreshParity(touched, touching);

    // Float64 cache coordinates retain subpixel data; repeated unaffected
    // updates after a geometry change still match the independent full solve.
    const farAgain = structuredClone(touching);
    farAgain.obstacles![0] = { x: 2780.123456789123, y: 510, width: 10, height: 10 };
    const repacked = session.update(farAgain);
    expectFreshParity(repacked, farAgain);
    const next = structuredClone(farAgain);
    next.obstacles![0]!.x += 0.0000000001;
    const reused = session.update(next);
    expectFreshParity(reused, next);
  });

  it('falls back rather than retaining an oversized all-candidate footprint cache', async () => {
    const original = await vi.importActual<typeof import('../../src/core/placement.js')>(
      '../../src/core/placement.js'
    );
    candidateSearch.mockImplementation((input) => {
      const candidates = original.allPlacementCandidates(input);
      if (input.annotation.id !== 'note-000'
        || input.obstacles.length !== 0
        || input.placedNotes.length !== 0) return candidates;
      expect(candidates.length).toBeGreaterThan(0);
      // The original resolver deliberately retains fewer candidates, but
      // the proof must account for *every* placement. This many would exceed
      // the private 128 KiB/note cache budget.
      return Array.from({ length: 4097 }, (_, index) => candidates[index % candidates.length]!);
    });
    try {
      const initial = scenario(1);
      const session = createIncrementalAnnotationLayoutSession(initial);
      const before = session.layout;
      const next = structuredClone(initial);
      next.obstacles![0]!.x += 10;
      const updated = session.update(next);
      // Cache refusal must never lead to an unsupported reused identity.
      expect(updated.annotations[0]).not.toBe(before.annotations[0]);
      expectFreshParity(updated, next);
    } finally {
      candidateSearch.mockImplementation(original.allPlacementCandidates);
    }
  });

  it('does not cache unsafe route-dependent geometry', () => {
    candidateSearch.mockClear();
    const initial = scenario(6);
    initial.annotations[0]!.connector = { type: 'elbow', routing: 'orthogonal' };
    const session = createIncrementalAnnotationLayoutSession(initial);
    const old = session.layout;
    const next = structuredClone(initial);
    next.obstacles![0]!.x += 15;
    const current = session.update(next);
    expect(current.annotations[0]).not.toBe(old.annotations[0]);
    expectFreshParity(current, next);
  });
});
