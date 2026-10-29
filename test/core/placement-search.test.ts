import { afterEach, describe, expect, it, vi } from 'vitest';
import * as connectors from '../../src/core/connectors.js';
import {
  allPlacementCandidates,
  resolvePlacementCandidate,
  scorePlacementCandidate
} from '../../src/core/placement.js';
import { resolveAnnotationLayout } from '../../src/core/layout.js';
import type {
  Annotation,
  LayoutOptions,
  PlacementAlign,
  PlacementCandidate,
  PlacementPreference,
  PlacementSide
} from '../../src/core/model.js';

type SearchInput = Parameters<typeof allPlacementCandidates>[0];
const sides: PlacementSide[] = ['top', 'right', 'bottom', 'left'];
const aligns: PlacementAlign[] = ['center', 'start', 'end'];

// Independent eager oracle: enumerate the contract, call the public scorer for
// EVERY entry, then use the original stable sort and JS slice semantics.
function eagerCandidates(input: SearchInput): PlacementCandidate[] {
  if (input.placement?.manual) {
    return allPlacementCandidates(input);
  }
  const preference = input.placement;
  const allowedSides = [...new Set(preference?.allowedSides?.length ? preference.allowedSides : sides)];
  const preferredSides = [...new Set(list(preference?.side).filter((side) => allowedSides.includes(side)))];
  const orderedSides = [...preferredSides, ...allowedSides.filter((side) => !preferredSides.includes(side))];
  const allowedAligns = [...new Set(preference?.allowedAligns?.length ? preference.allowedAligns : aligns)];
  const preferredAligns = [...new Set(list(preference?.align).filter((align) => allowedAligns.includes(align)))];
  const orderedAligns = [...preferredAligns, ...allowedAligns.filter((align) => !preferredAligns.includes(align))];
  const preferredOffsets = finiteUnique(list(preference?.offset));
  const base = preferredOffsets[0] ?? 16;
  const offsets = finiteUnique([...preferredOffsets, base, base + 8, base + 20, Math.max(4, base - 6)]);
  const crossOffsets = finiteUnique([...list(preference?.crossOffset), 0, -32, 32, -64, 64]);
  const candidates: PlacementCandidate[] = [];
  orderedSides.forEach((side, sideIndex) => {
    orderedAligns.forEach((align, alignIndex) => {
      offsets.forEach((offset, offsetIndex) => {
        crossOffsets.forEach((crossOffset, crossOffsetIndex) => {
          candidates.push(scorePlacementCandidate({
            ...input, side, sideIndex, align, alignIndex, offset, offsetIndex, crossOffset, crossOffsetIndex
          }));
        });
      });
    });
  });
  candidates.sort((a, b) => a.score - b.score || sides.indexOf(a.side) - sides.indexOf(b.side));
  return candidates;
}

function list<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function finiteUnique(values: number[]): number[] {
  return values.filter((value, index) => Number.isFinite(value) && values.indexOf(value) === index);
}

function seeded(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function searchFixture(index: number): SearchInput {
  const random = seeded(12345 + index);
  const point = { x: 30 + random() * 390, y: 30 + random() * 250 };
  const annotation: Annotation = {
    id: `seed-${index}`,
    note: { title: `Note ${index}` },
    anchor: index % 3 === 0
      ? { type: 'point', point }
      : index % 3 === 1
        ? { type: 'box', box: { ...point, width: index % 2 ? -38.5 : 38.5, height: 24.25 } }
        : { type: 'path', points: [point, { x: point.x + 60.5, y: point.y - 20.25 }, { x: point.x + 90, y: point.y + 40 }] },
    connector: [
      { type: 'elbow' as const },
      { type: 'straight' as const, routing: 'none' as const },
      { type: 'curve' as const, points: [{ x: 20, y: -30 }], pointMode: 'relative' as const },
      { type: 'elbow' as const, points: [{ x: 200, y: 70 }, { x: 260, y: 170 }] },
      { type: 'none' as const },
      { type: 'straight' as const, startOffset: 3.5, endOffset: 2.25, routing: { padding: 2, preference: 'vertical' as const } }
    ][index % 6]!
  };
  return {
    annotation,
    bounds: { x: -10.5, y: 5.25, width: 500, height: 350 },
    noteSize: { width: 65.25 + random() * 70, height: 25.5 + random() * 40 },
    obstacles: Array.from({ length: 2 }, () => ({ x: random() * 420, y: random() * 280, width: 25, height: 32 })),
    placedNotes: [{ x: 60 + random() * 290, y: 30 + random() * 220, width: 85, height: 40 }],
    ...(index % 2 ? { placement: {
      side: ['left', 'bottom', 'left'], allowedSides: ['bottom', 'right', 'left', 'top', 'right'],
      align: ['end', 'start'], allowedAligns: ['start', 'center', 'end', 'center'],
      offset: [-3.25, 17.125, 17.125, NaN], crossOffset: [-0.5, 7.25, -0.5]
    } satisfies PlacementPreference } : {})
  };
}

afterEach(() => vi.restoreAllMocks());

describe('exact bounded placement search', () => {
  it.each(Array.from({ length: 12 }, (_, i) => i))('matches eager point/box/path search for seed %i', (index) => {
    const input = searchFixture(index);
    const eager = eagerCandidates(input);
    expect(allPlacementCandidates(input)).toStrictEqual(eager);
    for (const limit of [1, 3, 8, 20, eager.length - 1, eager.length, eager.length + 1]) {
      expect(allPlacementCandidates(input, { limit })).toStrictEqual(eager.slice(0, limit));
      expect(resolvePlacementCandidate(input, { limit })).toStrictEqual(eager[0]);
    }
  });

  it('routes past the best geometry when connector penalties change the winner', () => {
    const input: SearchInput = {
      annotation: {
        id: 'crossing', note: { title: 'Crossing' },
        anchor: { type: 'point', point: { x: 100, y: 100 } },
        connector: { type: 'straight', routing: 'none' }
      },
      bounds: { x: 0, y: 0, width: 500, height: 400 },
      noteSize: { width: 40, height: 20 },
      obstacles: [{ x: 103, y: 98, width: 5, height: 4 }], placedNotes: [],
      placement: { allowedSides: ['right'], allowedAligns: ['center'], offset: 10 }
    };
    const eager = eagerCandidates(input);
    const cheapestGeometry = [...eager].sort((a, b) => (a.score - a.scoreBreakdown.connectors) - (b.score - b.scoreBreakdown.connectors))[0]!;
    expect(cheapestGeometry.scoreBreakdown.connectors).toBeGreaterThan(0);
    expect(eager[0]!.scoreBreakdown.connectors).toBe(0);
    expect(eager[0]!.crossOffset).not.toBe(cheapestGeometry.crossOffset);
    expect(allPlacementCandidates(input, { limit: 1 })).toStrictEqual(eager.slice(0, 1));
  });

  it('preserves side and original insertion order when rounding erases tie penalties', () => {
    const input = searchFixture(0);
    input.annotation.connector = { type: 'none' };
    input.bounds = { x: -1e22, y: -1e22, width: 2e22, height: 2e22 };
    input.noteSize = { width: 0, height: 0 };
    input.obstacles = [];
    input.placedNotes = [];
    input.placement = { allowedSides: ['left', 'bottom', 'right', 'top'], offset: [1e20, 1e20 + 16384] };
    const eager = eagerCandidates(input);
    expect(new Set(eager.map((candidate) => candidate.score)).size).toBeLessThan(eager.length / 2);
    expect(eager[0]!.side).toBe('top');
    const bounded = allPlacementCandidates(input, { limit: 19 });
    expect(bounded).toStrictEqual(eager.slice(0, 19));
    expect(bounded[0]!.align).toBe('center');
    expect(bounded[0]!.crossOffset).toBe(0);
  });

  it('preserves signed zero and tiny fractional candidate data', () => {
    const input = searchFixture(0);
    input.obstacles = [];
    input.placedNotes = [];
    input.placement = { offset: [-0, Number.MIN_VALUE, -1e-12], crossOffset: [-0, Number.MIN_VALUE, -1e-12] };
    const eager = eagerCandidates(input);
    expect(eager.some((candidate) => Object.is(candidate.offset, -0))).toBe(true);
    expect(eager.some((candidate) => Object.is(candidate.crossOffset, -0))).toBe(true);
    expect(allPlacementCandidates(input, { limit: 20 })).toStrictEqual(eager.slice(0, 20));
  });

  it.each([
    { x: 0, y: 0, width: 500, height: 350 },
    { x: -50, y: -30, width: 70, height: 50 },
    { x: 100, y: 100, width: 0, height: 0 }
  ])('matches eager scores at boundaries and with oversized notes: %j', (bounds) => {
    const input = { ...searchFixture(2), bounds, noteSize: { width: 125, height: 75 } };
    input.annotation.anchor = { type: 'path', points: [] };
    const eager = eagerCandidates(input);
    expect(allPlacementCandidates(input, { limit: 7 })).toStrictEqual(eager.slice(0, 7));
  });

  it.each([0, -0, -1, -2.75, -Infinity, 0.75, 2.75, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid search limit %s', (limit) => {
    expect(() => allPlacementCandidates(searchFixture(1), { limit })).toThrow(/positive safe integer/);
    expect(() => resolvePlacementCandidate(searchFixture(1), { limit })).toThrow(/positive safe integer/);
  });

  it.each(['nan', 'infinite', 'overflow', 'cancellation', 'large-finite'] as const)('falls back to exhaustive search for unsafe %s scores', (kind) => {
    const input = searchFixture(0);
    input.annotation.connector = { type: 'none' };
    if (kind === 'nan') input.bounds.x = NaN;
    if (kind === 'infinite') input.noteSize.width = Infinity;
    if (kind === 'overflow') input.noteSize = { width: 1e200, height: 1e200 };
    if (kind === 'cancellation') {
      input.noteSize = { width: -1e307, height: 1 };
      input.placement = { offset: -1e307 };
    }
    if (kind === 'large-finite') input.noteSize = { width: 3e153, height: 3e153 };
    const spy = vi.spyOn(connectors, 'connectorPath');
    const eager = eagerCandidates(input);
    const calls = spy.mock.calls.length;
    spy.mockClear();
    expect(allPlacementCandidates(input, { limit: 5 })).toStrictEqual(eager.slice(0, 5));
    expect(spy).toHaveBeenCalledTimes(calls);
  });

  it.each([true, false])('leaves manual placement and waypoint diagnostics unchanged (clamp=%s)', (clamp) => {
    const input = searchFixture(3);
    input.placement = { manual: { x: -50.25, y: 90.5, side: 'left', align: 'end', clamp } };
    const expected = eagerCandidates(input);
    const spy = vi.spyOn(connectors, 'connectorPath');
    for (const limit of [1, 8, undefined]) {
      spy.mockClear();
      expect(allPlacementCandidates(input, { limit: limit })).toStrictEqual(expected);
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });

  it.each(['point', 'box', 'path'] as const)('keeps connector point aliases from the eager %s output', (type) => {
    const input = searchFixture(['point', 'box', 'path'].indexOf(type));
    const waypoint = { x: 240, y: 120 };
    input.annotation.connector = { type: 'straight', routing: 'none', points: [waypoint] };
    const expected = eagerCandidates(input).slice(0, 6);
    const actual = allPlacementCandidates(input, { limit: 6 });
    expect(actual).toStrictEqual(expected);
    expect(actual.every((candidate) => candidate.connector.points[1] === waypoint)).toBe(true);
    expect(actual[0]!.connector.points[0] === actual[1]!.connector.points[0]).toBe(
      expected[0]!.connector.points[0] === expected[1]!.connector.points[0]
    );
    if (input.annotation.anchor.type === 'point') {
      expect(actual[0]!.connector.points[0]).toBe(input.annotation.anchor.point);
    }
    for (let i = 1; i < actual.length; i++) expect(actual[i]!.noteBox).not.toBe(actual[0]!.noteBox);
  });

  it.each([5, 12, 20])('reduces connector calls with exact full-layout parity for %i notes', (count) => {
    const annotations: Annotation[] = Array.from({ length: count }, (_, i) => ({
      id: `layout-${i}`, note: { title: `Note ${i}` }, priority: count - i,
      anchor: { type: 'box', box: { x: 110 + i % 5 * 235, y: 150 + Math.floor(i / 5) * 190, width: 35, height: 25 } },
      connector: { type: i % 2 ? 'straight' : 'elbow' },
      ...(i % 3 === 0 ? { placement: { side: 'right' as const, align: 'start' as const } } : {})
    }));
    const options: LayoutOptions = {
      annotations, bounds: { x: 0, y: 0, width: 1400, height: 950 }, padding: 12,
      obstacles: [{ x: 350, y: 160, width: 35, height: 35 }, { x: 800, y: 420, width: 60, height: 30 }],
      noteSizes: Object.fromEntries(annotations.map((annotation, i) => [annotation.id, { width: 90 + i % 3 * 12, height: 38 + i % 2 * 8 }]))
    };
    const spy = vi.spyOn(connectors, 'connectorPath');
    const eager = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 'all' } });
    const eagerCalls = spy.mock.calls.length;
    expect(eagerCalls).toBe(count * 240);
    spy.mockClear();
    const actual = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 6 } });
    expect(actual).toStrictEqual({
      ...eager,
      diagnostics: { annotations: eager.diagnostics!.annotations.map((entry) => ({
        ...entry, candidates: entry.candidates.slice(0, 6)
      })) }
    });
    expect(spy.mock.calls.length).toBeLessThan(eagerCalls / 2);
  });
});

it.each([0, 1, 2, 4, 7])('indexed obstacles preserve exhaustive candidates and winners for seed %i', (index) => {
  const input = searchFixture(index);
  input.annotation.connector = index % 2 ? { type: 'elbow', routing: 'none' } : { type: 'straight', routing: 'none' };
  input.obstacles.push(...Array.from({ length: 200 }, (_, i) => ({
    x: (i % 20) * 160.125, y: Math.floor(i / 20) * 121.5, width: 35.25, height: 23.75
  })));
  const eager = eagerCandidates(input);
  expect(allPlacementCandidates(input)).toStrictEqual(eager);
  expect(allPlacementCandidates(input, { limit: 8 })).toStrictEqual(eager.slice(0, 8));
  expect(allPlacementCandidates(input, { limit: 1 })).toStrictEqual(eager.slice(0, 1));
  // Reusing and mutating the caller array cannot reuse a stale spatial index.
  input.obstacles[2] = { x: 0, y: 0, width: 500, height: 350 };
  expect(allPlacementCandidates(input, { limit: 1 })).toStrictEqual(eagerCandidates(input).slice(0, 1));
});

it('indexed scoring keeps obstacle-aware routes and manual candidates identical to the public scorer', () => {
  const input = searchFixture(5);
  input.obstacles = Array.from({ length: 35 }, (_, i) => ({ x: 180 + (i % 7) * 70, y: 80 + Math.floor(i / 7) * 60, width: 12, height: 18 }));
  input.placement = { allowedSides: ['right'], allowedAligns: ['center'], offset: 16, crossOffset: [0] };
  const expected = eagerCandidates(input);
  expect(allPlacementCandidates(input, { limit: 1 })).toStrictEqual(expected.slice(0, 1));
  input.placement = { manual: { x: 120, y: 240 } };
  const manual = allPlacementCandidates(input)[0]!;
  // Removing only distant boxes cannot change manual geometry; both scoring
  // contributions are independently checked against original obstacle order.
  const area = input.obstacles.reduce((sum, box) => sum + Math.max(0, Math.min(manual.noteBox.x + manual.noteBox.width, box.x + box.width) - Math.max(manual.noteBox.x, box.x))
    * Math.max(0, Math.min(manual.noteBox.y + manual.noteBox.height, box.y + box.height) - Math.max(manual.noteBox.y, box.y)), 0);
  expect(manual.scoreBreakdown.obstacles).toBe(area * 4);
});
