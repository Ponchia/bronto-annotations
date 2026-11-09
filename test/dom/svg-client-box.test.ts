// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientBoxToSvgBox, svgPointFromClient } from '../../src/dom/index.js';
import type { Box, Point } from '../../src/core/model.js';

type Affine = Pick<DOMMatrix, 'a' | 'b' | 'c' | 'd' | 'e' | 'f'>;
const identity: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
function fixture(inverse: Affine = identity) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const invert = vi.fn(() => inverse as DOMMatrix);
  svg.getScreenCTM = vi.fn(() => ({ inverse: invert }) as unknown as DOMMatrix);
  svg.createSVGPoint = vi.fn(() => ({
    x: 0, y: 0,
    matrixTransform(matrix: DOMMatrix): DOMPoint {
      return { x: matrix.a * this.x + matrix.c * this.y + matrix.e,
        y: matrix.b * this.x + matrix.d * this.y + matrix.f } as DOMPoint;
    }
  }) as DOMPoint);
  return { svg, invert };
}
function close(actual: Box, expected: Box) {
  for (const field of ['x', 'y', 'width', 'height'] as const) {
    expect(actual[field], field).toBeCloseTo(expected[field], 9);
  }
}
// Independent affine rectangle oracle: map its center and absolute half-extents,
// rather than copying the implementation's corner enumeration.
function enclosure(box: Box, m: Affine): Box {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const width = Math.abs(m.a * box.width) + Math.abs(m.c * box.height);
  const height = Math.abs(m.b * box.width) + Math.abs(m.d * box.height);
  return { x: m.a * cx + m.c * cy + m.e - width / 2,
    y: m.b * cx + m.d * cy + m.f - height / 2, width, height };
}

afterEach(() => vi.restoreAllMocks());

describe('client SVG boxes enclose all transformed corners', () => {
  const h = Math.SQRT1_2;
  const transforms: Array<[string, Affine]> = [
    ['identity', identity],
    ['translation and unequal scale', { a: 0.5, b: 0, c: 0, d: 2, e: -13.5, f: 7.25 }],
    ['45 degree rotation', { a: h, b: -h, c: h, d: h, e: 0, f: 0 }],
    ['negative rotation', { a: h, b: h, c: -h, d: h, e: 17, f: -21 }],
    ['horizontal skew', { a: 1, b: 0, c: -1, d: 1, e: 5, f: 10 }],
    ['vertical skew', { a: 1, b: -1, c: 0, d: 1, e: -5, f: 10 }],
    ['reflection', { a: -1.5, b: 0, c: 0, d: 0.75, e: 20, f: 0 }],
    ['reflection and rotation', { a: -h, b: -h, c: -h, d: h, e: 2.5, f: 4.5 }]
  ];
  it.each(transforms)('computes the affine enclosure for %s', (_name, matrix) => {
    const { svg } = fixture(matrix);
    for (const box of [
      { x: 200, y: 200, width: 100, height: 100 },
      { x: -12.25, y: 4.75, width: 0.125, height: 27.5 },
      { x: 3.5, y: -8.25, width: -20, height: 15 },
      { x: 3.5, y: -8.25, width: -20, height: -15 },
      { x: 3, y: 8, width: 0, height: 15 },
      { x: 3, y: 8, width: 20, height: 0 },
      { x: 3, y: 8, width: 0, height: 0 }
    ]) {
      const before = { ...box };
      close(clientBoxToSvgBox(svg, box), enclosure(box, matrix));
      expect(box).toEqual(before);
    }
  });
  it('uses one screen matrix and one inverse for the whole box', () => {
    const { svg, invert } = fixture();
    let calls = 0;
    svg.getScreenCTM = vi.fn(() => {
      const offset = calls++ * 100;
      return { inverse: vi.fn(() => ({ ...identity, e: offset, f: offset })) } as unknown as DOMMatrix;
    });
    const box = { x: 10, y: 20, width: 30, height: 40 };
    expect(clientBoxToSvgBox(svg, box)).toEqual(box);
    expect(svg.getScreenCTM).toHaveBeenCalledTimes(1);
    expect(svg.createSVGPoint).toHaveBeenCalledTimes(1);
    const stable = fixture();
    clientBoxToSvgBox(stable.svg, box);
    expect(stable.invert).toHaveBeenCalledTimes(1);
    expect(invert).not.toHaveBeenCalled();
  });
  it('refreshes the mapping on the next call', () => {
    const { svg, invert } = fixture();
    const box = { x: 1, y: 2, width: 3, height: 4 };
    expect(clientBoxToSvgBox(svg, box)).toEqual(box);
    invert.mockReturnValue({ ...identity, e: 11, f: 13 } as DOMMatrix);
    expect(clientBoxToSvgBox(svg, box)).toEqual({ ...box, x: 12, y: 15 });
    expect(svg.getScreenCTM).toHaveBeenCalledTimes(2);
  });
  it.each(['none', 'xMinYMin meet', 'xMidYMid meet', 'xMaxYMax slice'])('retains the missing-matrix %s fallback', mode => {
    const { svg } = fixture();
    svg.getScreenCTM = () => null;
    svg.setAttribute('preserveAspectRatio', mode);
    svg.getBoundingClientRect = vi.fn(() => new DOMRect(10, 20, 400, 300));
    Object.defineProperty(svg, 'viewBox', { value: { baseVal: { x: -20, y: 10, width: 200, height: 100 } } });
    const box = { x: 10, y: 20, width: 200, height: 100 };
    const start = svgPointFromClient(svg, box);
    const end = svgPointFromClient(svg, { x: 210, y: 120 });
    vi.mocked(svg.getBoundingClientRect).mockClear();
    close(clientBoxToSvgBox(svg, box), { ...start, width: end.x - start.x, height: end.y - start.y });
    expect(svg.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });
  it('preserves normalized client coordinates when neither mapping is available', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect(clientBoxToSvgBox(svg, { x: 30, y: 40, width: -10, height: -20 }))
      .toEqual({ x: 20, y: 20, width: 10, height: 20 });
    const point: Point = { x: 8, y: 9 };
    expect(svgPointFromClient(svg, point)).toBe(point);
  });
  it('propagates inversion exceptions without substituting an approximate rectangle', () => {
    const { svg, invert } = fixture();
    const failure = new Error('Non-invertible host matrix');
    invert.mockImplementation(() => { throw failure; });
    expect(() => clientBoxToSvgBox(svg, { x: 1, y: 2, width: 3, height: 4 })).toThrow(failure);
    expect(() => svgPointFromClient(svg, { x: 1, y: 2 })).toThrow(failure);
  });
  it('retains nonfinite inversion evidence instead of manufacturing finite geometry', () => {
    const { svg } = fixture({ a: NaN, b: NaN, c: NaN, d: NaN, e: NaN, f: NaN });
    const result = clientBoxToSvgBox(svg, { x: 1, y: 2, width: 3, height: 4 });
    expect(Object.values(result).every(Number.isNaN)).toBe(true);
  });
});
