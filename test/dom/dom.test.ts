// @vitest-environment jsdom

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import {
  anchorFromDOMRect,
  anchorFromElement,
  anchorFromId,
  anchorFromSelector,
  anchorsFromSelectors,
  annotationFrameFromSvg,
  annotationsFromDomSelectors,
  boxFromElement,
  clientBoxToSvgBox,
  obstaclesFromSelector,
  obstaclesFromSelectors,
  prepareDomAnnotations,
  svgPointFromClient
} from '../../src/dom/index.js';

describe('DOM and SVG anchor utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes DOMRects into box anchors', () => {
    expect(anchorFromDOMRect({
      x: 10,
      y: 20,
      width: 80,
      height: 40,
      left: 10,
      top: 20,
      right: 90,
      bottom: 60
    })).toEqual({
      type: 'box',
      box: { x: 10, y: 20, width: 80, height: 40 }
    });
  });

  it('measures an element relative to a coordinate space', () => {
    document.body.innerHTML = `
      <section id="surface">
        <div id="target" data-anchor-id="target"></div>
      </section>
    `;
    const surface = document.querySelector('#surface') as HTMLElement;
    const target = document.querySelector('#target') as HTMLElement;
    surface.getBoundingClientRect = () => rect(100, 50, 400, 300);
    target.getBoundingClientRect = () => rect(140, 90, 80, 40);

    expect(boxFromElement(target, { coordinateSpace: surface })).toEqual({
      x: 40,
      y: 40,
      width: 80,
      height: 40
    });
    expect(anchorFromElement(target, { coordinateSpace: surface, kind: 'point' })).toEqual({
      type: 'point',
      point: { x: 80, y: 60 }
    });
  });

  it('extracts selector anchors from SVG getBBox geometry', () => {
    document.body.innerHTML = `
      <svg id="surface" viewBox="0 0 320 200">
        <g id="node"><rect width="60" height="40" /></g>
      </svg>
    `;
    const node = document.querySelector('#node') as SVGGraphicsElement;
    node.getBBox = () => ({ x: 24, y: 32, width: 60, height: 40 }) as DOMRect;

    const anchor = anchorFromSelector(document, '#node', {
      id: 'node',
      coordinateSpace: document.querySelector('svg') as SVGSVGElement
    });

    expect(anchor?.id).toBe('node');
    expect(anchor?.anchor).toEqual({
      type: 'box',
      box: { x: 24, y: 32, width: 60, height: 40 }
    });
  });

  it('extracts anchors and obstacles from ids and selector specs', () => {
    document.body.innerHTML = `
      <section id="surface">
        <div id="primary" data-anchor-id="primary"></div>
        <div class="obstacle" data-anchor-id="first"></div>
        <div class="obstacle" data-anchor-id="second"></div>
      </section>
    `;
    const surface = document.querySelector('#surface') as HTMLElement;
    const primary = document.querySelector('#primary') as HTMLElement;
    const obstacles = Array.from(document.querySelectorAll('.obstacle')) as HTMLElement[];
    surface.getBoundingClientRect = () => rect(100, 50, 400, 300);
    primary.getBoundingClientRect = () => rect(150, 90, 80, 40);
    obstacles[0]!.getBoundingClientRect = () => rect(220, 120, 60, 30);
    obstacles[1]!.getBoundingClientRect = () => rect(320, 160, 50, 20);

    expect(anchorFromId(document, 'primary', { coordinateSpace: surface })?.box).toEqual({
      x: 50,
      y: 40,
      width: 80,
      height: 40
    });
    expect(anchorsFromSelectors(document, [
      { id: 'by-selector', selector: '#primary', coordinateSpace: surface, kind: 'point' }
    ])[0]?.anchor).toEqual({
      type: 'point',
      point: { x: 90, y: 60 }
    });
    expect(obstaclesFromSelector(document, '.obstacle', { coordinateSpace: surface, inflate: 2 })).toEqual([
      { x: 118, y: 68, width: 64, height: 34 },
      { x: 218, y: 108, width: 54, height: 24 }
    ]);
    expect(obstaclesFromSelectors(document, [
      { selector: '#primary', coordinateSpace: surface }
    ])).toEqual([
      { x: 50, y: 40, width: 80, height: 40 }
    ]);
  });

  it('prepares DOM selector annotations with obstacles and validation diagnostics', () => {
    document.body.innerHTML = `
      <section id="surface">
        <div id="primary" data-anchor-id="primary"></div>
        <div class="obstacle"></div>
      </section>
    `;
    const surface = document.querySelector('#surface') as HTMLElement;
    const primary = document.querySelector('#primary') as HTMLElement;
    const obstacle = document.querySelector('.obstacle') as HTMLElement;
    surface.getBoundingClientRect = () => rect(100, 50, 400, 300);
    primary.getBoundingClientRect = () => rect(150, 90, 80, 40);
    obstacle.getBoundingClientRect = () => rect(220, 120, 60, 30);

    const prepared = prepareDomAnnotations(document, [
      {
        selector: '#primary',
        coordinateSpace: surface,
        source: 'dom-rect',
        note: { title: 'Measured DOM' },
        connector: { end: 'arrow' },
        tone: 'info'
      },
      {
        id: 'missing',
        selector: '#missing',
        note: { title: 'Missing' }
      }
    ], {
      obstacles: [{ selector: '.obstacle', coordinateSpace: surface, inflate: 2 }]
    });

    expect(prepared.annotations).toHaveLength(1);
    expect(prepared.annotations[0]).toMatchObject({
      id: 'primary',
      anchor: {
        type: 'box',
        box: { x: 50, y: 40, width: 80, height: 40 }
      },
      note: { title: 'Measured DOM' },
      connector: { end: 'arrow' },
      tone: 'info',
      data: {
        anchorSource: 'dom-rect',
        domSelector: '#primary',
        domElementId: 'primary'
      }
    });
    expect(prepared.obstacles).toEqual([
      { x: 118, y: 68, width: 64, height: 34 }
    ]);
    expect(prepared.validation.ok).toBe(false);
    expect(prepared.validation.found).toEqual(['primary']);
    expect(prepared.validation.missing[0]).toMatchObject({
      id: 'missing',
      status: 'missing',
      expected: 'selector "#missing"'
    });
  });

  it('converts DOM selector specs directly into annotations', () => {
    document.body.innerHTML = '<button id="cta">Click</button>';
    const button = document.querySelector('#cta') as HTMLButtonElement;
    button.getBoundingClientRect = () => rect(20, 30, 90, 36);

    const annotations = annotationsFromDomSelectors(document, [
      {
        selector: '#cta',
        note: { title: 'CTA' },
        placement: { side: 'right' },
        data: { role: 'button' }
      }
    ]);

    expect(annotations).toEqual([
      {
        id: 'cta',
        anchor: {
          type: 'box',
          box: { x: 20, y: 30, width: 90, height: 36 }
        },
        note: { title: 'CTA' },
        placement: { side: 'right' },
        data: {
          anchorSource: 'dom',
          domSelector: '#cta',
          domElementId: 'cta',
          role: 'button'
        }
      }
    ]);
  });

  it('maps client boxes into SVG coordinates with preserveAspectRatio fallback', () => {
    document.body.innerHTML = `
      <svg id="surface" preserveAspectRatio="xMinYMin meet"></svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    svg.getBoundingClientRect = () => rect(10, 20, 400, 300);
    Object.defineProperty(svg, 'viewBox', {
      configurable: true,
      value: {
        baseVal: { x: 0, y: 0, width: 200, height: 100 }
      }
    });

    expect(svgPointFromClient(svg, { x: 210, y: 170 })).toEqual({
      x: 100,
      y: 75
    });
    expect(clientBoxToSvgBox(svg, { x: 10, y: 20, width: 200, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50
    });
  });

  it('derives annotation frame bounds from rendered SVG viewBox and padding', () => {
    document.body.innerHTML = `
      <svg id="surface" viewBox="-20 10 320 200" preserveAspectRatio="xMinYMin meet"></svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const frame = annotationFrameFromSvg(svg, {
      padding: {
        top: 8,
        right: 24,
        bottom: 12,
        left: 16
      }
    });

    expect(frame).toEqual({
      bounds: { x: -36, y: 2, width: 360, height: 220 },
      viewBox: '-36 2 360 220',
      preserveAspectRatio: 'xMinYMin meet'
    });
  });

  it('derives annotation frame bounds from SVG dimensions when viewBox is absent', () => {
    document.body.innerHTML = '<svg id="surface" width="640px" height="360px"></svg>';
    const svg = document.querySelector('svg') as SVGSVGElement;

    expect(annotationFrameFromSvg(svg, {
      preserveAspectRatio: 'none',
      padding: 10
    })).toEqual({
      bounds: { x: -10, y: -10, width: 660, height: 380 },
      viewBox: '-10 -10 660 380',
      preserveAspectRatio: 'none'
    });
  });

  it('transforms SVG getBBox geometry into the requested SVG coordinate space', () => {
    installDomPoint();
    document.body.innerHTML = `
      <svg id="surface" viewBox="0 0 320 200">
        <g id="translated"><rect width="20" height="10" /></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const translated = document.querySelector('#translated') as SVGGraphicsElement;
    svg.getScreenCTM = () => matrix();
    translated.getScreenCTM = () => matrix({ e: 100, f: 50 });
    translated.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 }) as DOMRect;

    expect(boxFromElement(translated, { coordinateSpace: svg })).toEqual({
      x: 100,
      y: 50,
      width: 20,
      height: 10
    });
  });

  it('transforms zero-height SVG route boxes into the requested SVG coordinate space', () => {
    installDomPoint();
    document.body.innerHTML = `
      <svg id="surface" viewBox="0 0 320 200">
        <line id="route" />
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const route = document.querySelector('#route') as SVGGraphicsElement;
    svg.getScreenCTM = () => matrix();
    route.getScreenCTM = () => matrix({ e: 120, f: 64 });
    route.getBBox = () => ({ x: 0, y: 0, width: 180, height: 0 }) as DOMRect;

    expect(boxFromElement(route, { coordinateSpace: svg })).toEqual({
      x: 120,
      y: 64,
      width: 180,
      height: 0
    });
  });

  it('transforms sampled SVG path anchors into the requested SVG coordinate space', () => {
    installDomPoint();
    document.body.innerHTML = `
      <svg id="surface" viewBox="0 0 320 200">
        <path id="route" />
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const route = document.querySelector('#route') as SVGGeometryElement;
    svg.getScreenCTM = () => matrix();
    route.getScreenCTM = () => matrix({ e: 10, f: 20 });
    route.getBoundingClientRect = () => rect(0, 0, 64, 32);
    route.getBBox = () => ({ x: 0, y: 0, width: 64, height: 32 }) as DOMRect;
    route.getTotalLength = () => 64;
    route.getPointAtLength = (distance: number) => ({
      x: distance,
      y: distance / 2
    }) as DOMPoint;

    expect(anchorFromElement(route, { coordinateSpace: svg, kind: 'path' })).toEqual({
      type: 'path',
      points: [
        { x: 10, y: 20 },
        { x: 74, y: 52 }
      ]
    });
  });
});

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({ x, y, width, height })
  } as DOMRect;
}

type MatrixInit = {
  a?: number;
  b?: number;
  c?: number;
  d?: number;
  e?: number;
  f?: number;
};

function matrix(input: MatrixInit = {}): DOMMatrix {
  const value = {
    a: input.a ?? 1,
    b: input.b ?? 0,
    c: input.c ?? 0,
    d: input.d ?? 1,
    e: input.e ?? 0,
    f: input.f ?? 0
  };

  return {
    ...value,
    inverse: () => {
      const determinant = value.a * value.d - value.b * value.c;

      return matrix({
        a: value.d / determinant,
        b: -value.b / determinant,
        c: -value.c / determinant,
        d: value.a / determinant,
        e: (value.c * value.f - value.d * value.e) / determinant,
        f: (value.b * value.e - value.a * value.f) / determinant
      });
    }
  } as DOMMatrix;
}

function installDomPoint() {
  class TestDOMPoint {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }

    matrixTransform(transform: DOMMatrix) {
      return new TestDOMPoint(
        this.x * transform.a + this.y * transform.c + transform.e,
        this.x * transform.b + this.y * transform.d + transform.f
      );
    }
  }

  vi.stubGlobal('DOMPoint', TestDOMPoint);
}
