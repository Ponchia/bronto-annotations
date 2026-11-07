// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anchorPoint, evaluateAnchorAlignment } from '../../src/index.js';
import { extractedAnchorFromElement } from '../../src/dom/index.js';
import { anchorsFromD2Svg } from '../../src/adapters/d2.js';
import { anchorsFromMermaidSvg } from '../../src/adapters/mermaid.js';
import { anchorsFromVegaSvg } from '../../src/adapters/vega.js';

function routeFixture(length: number) {
  document.body.innerHTML = '<svg viewBox="0 0 1200 400"><path id="route" /></svg>';
  const svg = document.querySelector('svg') as SVGSVGElement;
  const path = document.querySelector('path') as SVGGeometryElement;
  path.getBBox = () => ({ x: 0, y: 70, width: length, height: 0 }) as DOMRect;
  path.getTotalLength = () => length;
  path.getPointAtLength = (distance: number) => ({ x: distance, y: 70 }) as DOMPoint;
  return { svg, path };
}

afterEach(() => vi.unstubAllGlobals());

describe('SVG representative path points', () => {
  it.each([20, 64, 96, 128, 800])('matches the core midpoint for a %i-unit sampled path', (length) => {
    const { svg, path } = routeFixture(length);
    const result = extractedAnchorFromElement(path, { id: 'route-note', coordinateSpace: svg, kind: 'path' });
    expect(result.point).toEqual({ x: length / 2, y: 70 });
    expect(result.point).toEqual(anchorPoint(result.anchor));
    expect(result.box).toEqual({ x: 0, y: 70, width: length, height: 0 });
    expect(result.element).toBe(path);
    expect(result.anchor.type).toBe('path');
    if (result.anchor.type !== 'path') throw new Error('Expected a sampled path');
    expect(result.anchor.points).toHaveLength(Math.max(2, Math.min(24, Math.ceil(length / 32))));
    expect(result.anchor.points[0]).toEqual({ x: 0, y: 70 });
    expect(result.anchor.points.at(-1)).toEqual({ x: length, y: 70 });
    const report = evaluateAnchorAlignment([
      { id: 'route-note', anchor: result.anchor, note: { title: 'Route' } }
    ], [{ id: 'route-note', point: result.point }]);
    expect(report.diagnostics[0]?.distance).toBe(0);
  });

  it('uses the transformed route midpoint without resampling the path', () => {
    class Point {
      constructor(public x: number, public y: number) {}
      matrixTransform(m: DOMMatrix) {
        return new Point(this.x * m.a + this.y * m.c + m.e, this.x * m.b + this.y * m.d + m.f);
      }
    }
    vi.stubGlobal('DOMPoint', Point);
    const { svg, path } = routeFixture(20);
    path.getCTM = () => ({ a: 2, b: 0, c: 0, d: 3, e: 10, f: 20 }) as DOMMatrix;
    const result = extractedAnchorFromElement(path, { coordinateSpace: svg, kind: 'path' });
    expect(result.point).toEqual({ x: 30, y: 230 });
    expect(result.anchor).toEqual({ type: 'path', points: [{ x: 10, y: 230 }, { x: 50, y: 230 }] });
    expect(result.box).toEqual({ x: 10, y: 230, width: 40, height: 0 });
  });

  it.each([
    { name: 'D2', extract: anchorsFromD2Svg },
    { name: 'Mermaid', extract: anchorsFromMermaidSvg },
    { name: 'Vega', extract: anchorsFromVegaSvg }
  ])('keeps the $name rendered SVG result consistent', ({ extract }) => {
    const { svg } = routeFixture(20);
    const result = extract(svg, [{ id: 'route-note', selector: '#route', kind: 'path', coordinateSpace: svg }])[0]!;
    expect(result.point).toEqual({ x: 10, y: 70 });
    expect(result.point).toEqual(anchorPoint(result.anchor));
  });

  it('preserves zero-length fallback geometry and non-path centers', () => {
    const { svg, path } = routeFixture(0);
    const fallback = extractedAnchorFromElement(path, { coordinateSpace: svg, kind: 'path' });
    expect(fallback.point).toEqual({ x: 0, y: 70 });
    path.getBBox = () => ({ x: 10, y: 20, width: 40, height: 60 }) as DOMRect;
    const box = extractedAnchorFromElement(path, { coordinateSpace: svg, side: 'left' });
    expect(box.point).toEqual({ x: 30, y: 50 });
    expect(box.anchor).toEqual({ type: 'box', box: { x: 10, y: 20, width: 40, height: 60 }, side: 'left' });
  });
});
