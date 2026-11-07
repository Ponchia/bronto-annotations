// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { anchorsFromD2Svg, prepareD2SvgAnnotations, validateD2SvgAnchors } from '../../src/adapters/d2.js';
import { anchorsFromMermaidSvg, prepareMermaidAnnotations, validateMermaidSvgAnchors } from '../../src/adapters/mermaid.js';
import { anchorsFromVegaSvg, prepareVegaSvgAnnotations, validateVegaSvgAnchors } from '../../src/adapters/vega.js';
import type { ElementAnchorOptions } from '../../src/dom/index.js';
import type { Box } from '../../src/core/model.js';

const adapters = [
  { source: 'd2-svg', extract: anchorsFromD2Svg, validate: validateD2SvgAnchors, prepare: prepareD2SvgAnnotations },
  { source: 'mermaid-svg', extract: anchorsFromMermaidSvg, validate: validateMermaidSvgAnchors, prepare: prepareMermaidAnnotations },
  { source: 'vega-svg', extract: anchorsFromVegaSvg, validate: validateVegaSvgAnchors, prepare: prepareVegaSvgAnnotations }
];
const strict = { assert: true, obstacles: false } as const;
const max = Number.MAX_VALUE;

function fixture(box: Box = { x: 10, y: 20, width: 30, height: 40 }) {
  document.body.innerHTML = '<div id="space"><svg viewBox="0 0 320 200"><g id="group"><path id="p" /></g></svg></div>';
  const svg = document.querySelector('svg') as SVGSVGElement;
  const path = document.querySelector('#p') as SVGGeometryElement;
  const space = document.querySelector('#space') as HTMLElement;
  path.getBBox = () => ({ ...box }) as DOMRect;
  return { svg, path, space, spec: { id: 'note', selector: '#p', coordinateSpace: svg } };
}

describe.each(adapters)('$source finite resolved SVG geometry', (adapter) => {
  function expectRejected(svg: SVGSVGElement, spec: ElementAnchorOptions & { id: string; selector: string }) {
    const report = adapter.validate(svg, [spec]);
    expect(report.ok).toBe(false);
    expect(report.diagnostics[0]).toMatchObject({
      id: 'note', source: adapter.source, status: 'invalid', found: false,
      reason: expect.stringMatching(/finite/i)
    });
    expect(() => adapter.prepare(svg, [spec], strict)).toThrow(/finite/i);
    const prepared = adapter.prepare(svg, [spec], { obstacles: false });
    expect(prepared.validation.ok).toBe(false);
    expect(prepared.annotations).toHaveLength(1);
    expect(prepared.annotations[0]?.anchor).toEqual(adapter.extract(svg, [spec])[0]?.anchor);
  }

  it.each([NaN, Infinity, -Infinity, max])('rejects nonfinite or overflowing inflation %s', (inflate) => {
    const { svg, spec } = fixture();
    expectRejected(svg, { ...spec, inflate });
  });

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite resolved SVG positions %s', (x) => {
    const { svg, spec } = fixture({ x, y: 0, width: 10, height: 20 });
    expectRejected(svg, spec);
  });

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite coordinate-space offsets %s', (x) => {
    const { svg, path, space, spec } = fixture();
    path.getBoundingClientRect = () => new DOMRect(10, 20, 30, 40);
    space.getBoundingClientRect = () => new DOMRect(x, 0, 320, 200);
    expectRejected(svg, { ...spec, coordinateSpace: space });
  });

  it('rejects finite coordinate subtraction that overflows', () => {
    const { svg, path, space, spec } = fixture();
    path.getBoundingClientRect = () => new DOMRect(max, 0, 0, 0);
    space.getBoundingClientRect = () => new DOMRect(-max, 0, 320, 200);
    expectRejected(svg, { ...spec, coordinateSpace: space });
  });

  it('rejects overflowing extents even when center and dimensions are finite', () => {
    const { svg, spec } = fixture({ x: max * 0.75, y: 0, width: max / 2, height: 0 });
    expect(Number.isFinite(adapter.extract(svg, [spec])[0]?.point.x)).toBe(true);
    expectRejected(svg, spec);
  });

  it('checks every sampled path point, including a nonrepresentative endpoint', () => {
    const { svg, path, spec } = fixture();
    path.getTotalLength = () => 64;
    path.getPointAtLength = (distance) => ({ x: distance === 0 ? NaN : 10, y: 20 }) as DOMPoint;
    expectRejected(svg, { ...spec, kind: 'path' });
  });

  it('does not overlook invalid measured bounds when the sampled path is finite', () => {
    const { svg, path, spec } = fixture();
    path.getTotalLength = () => 64;
    path.getPointAtLength = (distance) => ({ x: distance, y: 20 }) as DOMPoint;
    expectRejected(svg, { ...spec, kind: 'path', inflate: NaN });
  });

  it('keeps missing targets missing even with invalid geometry options', () => {
    const { svg, spec } = fixture();
    const report = adapter.validate(svg, [{ ...spec, selector: '#missing', inflate: NaN }]);
    expect(report.diagnostics[0]).toMatchObject({ status: 'missing', expected: 'selector "#missing"' });
    expect(report.diagnostics[0]?.reason).toMatch(/^No rendered .* SVG element matched/);
  });

  it('preserves finite negative dimensions and zero-sized geometry', () => {
    const { svg, spec } = fixture({ x: 10, y: 20, width: 0, height: 0 });
    expect(adapter.prepare(svg, [spec], strict).validation.ok).toBe(true);
    const negative = { ...spec, inflate: -5 };
    expect(adapter.extract(svg, [negative])[0]?.box.width).toBe(-10);
    expect(adapter.prepare(svg, [negative], strict).validation.ok).toBe(true);
  });

  it('preserves client-rectangle and degenerate-path fallbacks', () => {
    const { svg, path, spec } = fixture();
    Reflect.deleteProperty(path, 'getBBox');
    path.getBoundingClientRect = () => new DOMRect(10, 20, 30, 40);
    path.getTotalLength = () => 0;
    path.getPointAtLength = () => ({ x: NaN, y: NaN }) as DOMPoint;
    const fallback = { ...spec, kind: 'path' as const };
    expect(adapter.prepare(svg, [fallback], strict).validation.ok).toBe(true);
    expect(adapter.extract(svg, [fallback])[0]?.anchor.type).toBe('path');
  });

  it('reports thrown geometry reads as invalid diagnostics', () => {
    const { svg, path, spec } = fixture();
    path.getBBox = () => { throw new Error('geometry unavailable'); };
    expect(adapter.validate(svg, [spec]).diagnostics[0]).toMatchObject({ status: 'invalid', reason: 'geometry unavailable' });
    expect(() => adapter.prepare(svg, [spec], strict)).toThrow(/geometry unavailable/);
  });
});

it('validates the same sole Vega geometry descendant that extraction selects', () => {
  const { svg, path, spec } = fixture();
  const group = document.querySelector('#group') as SVGGraphicsElement;
  group.getBBox = () => ({ x: NaN, y: 0, width: 10, height: 20 }) as DOMRect;
  const groupSpec = { ...spec, selector: '#group' };
  expect(prepareVegaSvgAnnotations(svg, [groupSpec], strict).validation.ok).toBe(true);
  group.getBBox = () => new DOMRect(0, 0, 10, 20);
  path.getBBox = () => ({ x: NaN, y: 0, width: 10, height: 20 }) as DOMRect;
  expect(validateVegaSvgAnchors(svg, [groupSpec]).diagnostics[0]?.status).toBe('invalid');
});
