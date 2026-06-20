// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { Spec } from 'vega';
import {
  anchorsFromVegaScales,
  anchorsFromVegaScenegraph,
  anchorsFromVegaSvg,
  annotationsFromVegaSvg,
  anchorsFromVegaView,
  annotationsFromVegaView,
  findVegaSvgElement,
  obstaclesFromVegaScales,
  obstaclesFromVegaScenegraph,
  obstaclesFromVegaSvg,
  obstaclesFromVegaView,
  prepareVegaScaleAnnotations,
  prepareVegaScenegraphAnnotations,
  prepareVegaSvgAnnotations,
  prepareVegaViewAnnotations,
  validateVegaScaleAnchors,
  validateVegaScenegraphAnchors,
  validateVegaSvgAnchors,
  validateVegaViewAnchors
} from '../../src/adapters/vega.js';

describe('Vega adapter', () => {
  it('extracts anchors from a Vega view-like public data API', () => {
    const anchors = anchorsFromVegaView({
      data: (name?: string) => name === 'table'
        ? [{ id: 'peak', x: 120, y: 48, width: 16, height: 16 }]
        : []
    }, [
      {
        id: 'peak',
        data: 'table',
        datum: (datum) => datum.id === 'peak',
        x: 'x',
        y: 'y',
        width: 'width',
        height: 'height'
      }
    ]);

    expect(anchors[0]?.source).toBe('vega-view');
    expect(anchors[0]?.anchor).toEqual({
      type: 'box',
      box: { x: 120, y: 48, width: 16, height: 16 }
    });
  });

  it('extracts and prepares obstacles from Vega view data geometry', () => {
    const view = {
      data: (name?: string) => name === 'table'
        ? [
          { id: 'baseline', x: 40, y: 80, width: 24, height: 36 },
          { id: 'peak', x: 120, y: 48, width: 16, height: 16 }
        ]
        : []
    };
    const specs = [
      {
        id: 'peak',
        data: 'table',
        datum: (datum: { id: string }) => datum.id === 'peak',
        x: 'x',
        y: 'y',
        width: 'width',
        height: 'height',
        note: { title: 'Peak' }
      }
    ];
    const prepared = prepareVegaViewAnnotations(view, specs);

    expect(obstaclesFromVegaView(view, {
      data: 'table',
      x: 'x',
      y: 'y',
      width: 'width',
      height: 'height',
      padding: 2
    })).toEqual([
      { x: 38, y: 78, width: 28, height: 40 },
      { x: 118, y: 46, width: 20, height: 20 }
    ]);
    expect(prepared.validation.ok).toBe(true);
    expect(prepared.obstacles).toEqual([
      { x: 120, y: 48, width: 16, height: 16 }
    ]);
  });

  it('creates annotations from Vega view anchors', () => {
    const annotations = annotationsFromVegaView({
      data: () => [{ id: 'peak', x: 10, y: 20 }]
    }, [
      {
        id: 'peak',
        datum: (datum) => datum.id === 'peak',
        x: 'x',
        y: 'y',
        note: { title: 'Peak' },
        variant: 'threshold',
        tone: 'danger',
        motion: 'focus',
        style: { textColor: '#7f1d1d' },
        priority: 8,
        annotationClassName: 'vega-generated-note',
        annotationData: { consumer: 'chart' },
        metadata: { owner: 'analytics' }
      }
    ]);

    expect(annotations[0]?.note.title).toBe('Peak');
    expect(annotations[0]?.variant).toBe('threshold');
    expect(annotations[0]?.tone).toBe('danger');
    expect(annotations[0]?.motion).toBe('focus');
    expect(annotations[0]?.style).toEqual({ textColor: '#7f1d1d' });
    expect(annotations[0]?.priority).toBe(8);
    expect(annotations[0]?.className).toBe('vega-generated-note');
    expect(annotations[0]?.metadata).toEqual({ owner: 'analytics' });
    expect(annotations[0]?.data?.anchorSource).toBe('vega-view');
    expect(annotations[0]?.data?.datumIndex).toBe(0);
    expect(annotations[0]?.data?.consumer).toBe('chart');
  });

  it('extracts anchors from rendered Vega SVG marks', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="mark-symbol points">
          <path aria-label="point-peak" />
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const path = document.querySelector('path') as SVGGraphicsElement;
    path.getBBox = () => ({ x: 100, y: 40, width: 12, height: 12 }) as DOMRect;

    const anchors = anchorsFromVegaSvg(svg, [
      {
        id: 'peak',
        selector: 'path[aria-label="point-peak"]',
        kind: 'point',
        coordinateSpace: svg
      }
    ]);

    expect(anchors[0]?.source).toBe('vega-svg');
    expect(anchors[0]?.anchor).toEqual({
      type: 'point',
      point: { x: 106, y: 46 }
    });
  });

  it('extracts rendered Vega SVG anchors by mark metadata without a selector', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g id="points-layer" class="mark-symbol role-mark points">
          <path aria-label="point-peak" />
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const group = document.querySelector('#points-layer') as SVGGraphicsElement;
    const path = document.querySelector('#points-layer path') as SVGGraphicsElement;
    group.getBBox = () => ({ x: 100, y: 40, width: 24, height: 18 }) as DOMRect;
    path.getBBox = () => ({ x: 105, y: 44, width: 8, height: 8 }) as DOMRect;

    const anchors = anchorsFromVegaSvg(svg, [
      {
        id: 'points',
        markName: 'points',
        markType: 'symbol',
        role: 'mark',
        coordinateSpace: svg
      }
    ]);
    const annotations = annotationsFromVegaSvg(svg, [
      {
        id: 'points',
        markName: 'points',
        markType: 'symbol',
        role: 'mark',
        coordinateSpace: svg,
        note: { title: 'Rendered points' },
        subject: { shape: 'circle' },
        connector: { type: 'curve' }
      }
    ]);

    expect(findVegaSvgElement(svg, { id: 'points', markName: 'points', markType: 'symbol' })?.id).toBe('points-layer');
    expect(anchors[0]?.source).toBe('vega-svg');
    expect(anchors[0]?.markName).toBe('points');
    expect(anchors[0]?.markType).toBe('symbol');
    expect(anchors[0]?.role).toBe('mark');
    expect(anchors[0]?.elementId).toBe('points-layer');
    expect(anchors[0]?.element).toBe(path);
    expect(anchors[0]?.box).toEqual({ x: 105, y: 44, width: 8, height: 8 });
    expect(annotations[0]?.data?.vegaMarkName).toBe('points');
    expect(annotations[0]?.data?.vegaMarkType).toBe('symbol');
    expect(annotations[0]?.data?.vegaRole).toBe('mark');
    expect(annotations[0]?.data?.vegaElementId).toBe('points-layer');
    expect(annotations[0]?.subject?.shape).toBe('circle');
    expect(annotations[0]?.connector?.type).toBe('curve');
  });

  it('keeps multi-mark Vega SVG metadata anchors on the wrapper unless a selector is supplied', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g id="points-layer" class="mark-symbol role-mark points">
          <path aria-label="point-a" />
          <path aria-label="point-b" />
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const group = document.querySelector('#points-layer') as SVGGraphicsElement;
    const paths = Array.from(document.querySelectorAll('#points-layer path')) as SVGGraphicsElement[];
    group.getBBox = () => ({ x: 80, y: 32, width: 64, height: 28 }) as DOMRect;
    paths[0]!.getBBox = () => ({ x: 84, y: 36, width: 8, height: 8 }) as DOMRect;
    paths[1]!.getBBox = () => ({ x: 130, y: 48, width: 8, height: 8 }) as DOMRect;

    const anchors = anchorsFromVegaSvg(svg, [
      {
        id: 'points',
        markName: 'points',
        markType: 'symbol',
        role: 'mark',
        coordinateSpace: svg
      }
    ]);

    expect(anchors[0]?.element).toBe(group);
    expect(anchors[0]?.box).toEqual({ x: 80, y: 32, width: 64, height: 28 });
  });

  it('extracts obstacles from rendered Vega SVG selectors and mark metadata', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g id="points-layer" class="mark-symbol role-mark points" data-mark-name="points">
          <path aria-label="point-peak" />
        </g>
        <g id="bars-layer" class="mark-rect role-mark bars" data-mark-type="rect">
          <rect />
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const points = document.querySelector('#points-layer') as SVGGraphicsElement;
    const point = document.querySelector('#points-layer path') as SVGGraphicsElement;
    const bars = document.querySelector('#bars-layer') as SVGGraphicsElement;
    points.getBBox = () => ({ x: 100, y: 40, width: 24, height: 18 }) as DOMRect;
    point.getBBox = () => ({ x: 105, y: 44, width: 8, height: 8 }) as DOMRect;
    bars.getBBox = () => ({ x: 40, y: 80, width: 90, height: 60 }) as DOMRect;

    expect(obstaclesFromVegaSvg(svg, {
      markName: 'points',
      coordinateSpace: svg,
      padding: 3
    })).toEqual([
      { x: 102, y: 41, width: 14, height: 14 }
    ]);
    expect(obstaclesFromVegaSvg(svg, {
      selector: '#bars-layer',
      coordinateSpace: svg
    })).toEqual([
      { x: 40, y: 80, width: 90, height: 60 }
    ]);
  });

  it('extracts anchors from Vega scales and data predicates', () => {
    const xScale = Object.assign((value: unknown) => Number(value) * 20, { bandwidth: () => 12 });
    const yScale = (value: unknown) => 100 - Number(value) * 10;
    const anchors = anchorsFromVegaScales({
      data: () => [{ id: 'bar', category: 3, value: 7 }],
      scale: (name: string) => name === 'x' ? xScale : yScale
    }, [
      {
        id: 'bar',
        datum: (datum) => datum.id === 'bar',
        xScale: 'x',
        yScale: 'y',
        x: 'category',
        y: 'value',
        height: () => 70
      }
    ]);

    expect(anchors[0]?.source).toBe('vega-scale');
    expect(anchors[0]?.anchor).toEqual({
      type: 'box',
      box: { x: 60, y: 30, width: 12, height: 70 }
    });
  });

  it('extracts and prepares obstacles from Vega scale geometry', () => {
    const xScale = Object.assign((value: unknown) => Number(value) * 20, { bandwidth: () => 12 });
    const yScale = (value: unknown) => 100 - Number(value) * 10;
    const view = {
      data: () => [
        { id: 'baseline', category: 1, value: 4 },
        { id: 'bar', category: 3, value: 7 }
      ],
      scale: (name: string) => name === 'x' ? xScale : yScale
    };
    const specs = [
      {
        id: 'bar',
        datum: (datum: { id: string }) => datum.id === 'bar',
        xScale: 'x',
        yScale: 'y',
        x: 'category',
        y: 'value',
        height: () => 70,
        note: { title: 'Bar' }
      }
    ];
    const prepared = prepareVegaScaleAnnotations(view, specs);

    expect(obstaclesFromVegaScales(view, {
      xScale: 'x',
      yScale: 'y',
      x: 'category',
      y: 'value',
      height: () => 70,
      padding: 2
    })).toEqual([
      { x: 18, y: 58, width: 16, height: 74 },
      { x: 58, y: 28, width: 16, height: 74 }
    ]);
    expect(prepared.validation.ok).toBe(true);
    expect(prepared.obstacles).toEqual([
      { x: 60, y: 30, width: 12, height: 70 }
    ]);
  });

  it('applies Vega view padding to scale and scenegraph geometry', () => {
    const anchors = anchorsFromVegaScales({
      data: () => [{ id: 'point', x: 2, y: 3 }],
      scale: () => (value: unknown) => Number(value) * 10,
      padding: () => ({ left: 30, top: 12 })
    }, [
      {
        id: 'point',
        xScale: 'x',
        yScale: 'y',
        x: 'x',
        y: 'y'
      }
    ]);
    const sceneAnchors = anchorsFromVegaScenegraph({
      padding: () => ({ left: 30, top: 12 }),
      scenegraph: () => ({
        root: {
          items: [
            {
              mark: { name: 'points' },
              bounds: { x1: 10, y1: 20, x2: 30, y2: 40 }
            }
          ]
        }
      })
    }, [
      { id: 'scene-point', markName: 'points' }
    ]);

    expect(anchors[0]?.point).toEqual({ x: 50, y: 42 });
    expect(sceneAnchors[0]?.box).toEqual({ x: 40, y: 32, width: 20, height: 20 });
  });

  it('applies Vega SVG export origin to scenegraph geometry', () => {
    const sceneAnchors = anchorsFromVegaScenegraph({
      padding: () => ({ left: 48, top: 48 }),
      origin: () => [30, 6],
      scenegraph: () => ({
        root: {
          items: [
            {
              mark: { name: 'points', marktype: 'symbol', role: 'mark' },
              datum: { id: 'peak' },
              bounds: { x1: 314, y1: -6, x2: 326, y2: 6 }
            }
          ]
        }
      })
    }, [
      {
        id: 'peak',
        markName: 'points',
        markType: 'symbol',
        datum: (datum) => datum?.id === 'peak'
      }
    ]);

    expect(sceneAnchors[0]?.box).toEqual({ x: 392, y: 48, width: 12, height: 12 });
  });

  it('extracts anchors and obstacles from Vega scenegraph items', () => {
    const view = {
      scenegraph: () => ({
        root: {
          items: [
            {
              mark: { name: 'points', marktype: 'symbol', role: 'mark' },
              datum: { id: 'peak' },
              bounds: { x1: 40, y1: 24, x2: 52, y2: 36 }
            }
          ]
        }
      })
    };
    const anchors = anchorsFromVegaScenegraph(view, [
      {
        id: 'peak',
        markName: 'points',
        datum: (datum) => datum?.id === 'peak'
      }
    ]);

    expect(anchors[0]?.source).toBe('vega-scenegraph');
    expect(anchors[0]?.markName).toBe('points');
    expect(anchors[0]?.markType).toBe('symbol');
    expect(anchors[0]?.role).toBe('mark');
    expect(anchors[0]?.box).toEqual({ x: 40, y: 24, width: 12, height: 12 });
    expect(obstaclesFromVegaScenegraph(view, { markName: 'points', padding: 2 })).toEqual([
      { x: 38, y: 22, width: 16, height: 16 }
    ]);
  });

  it('prepares annotations, obstacles, and validation from Vega scenegraph items', () => {
    const view = {
      scenegraph: () => ({
        root: {
          items: [
            {
              mark: { name: 'points', marktype: 'symbol', role: 'mark' },
              datum: { id: 'peak' },
              bounds: { x1: 40, y1: 24, x2: 52, y2: 36 }
            },
            {
              mark: { name: 'axis', role: 'axis' },
              bounds: { x1: 0, y1: 120, x2: 220, y2: 124 }
            }
          ]
        }
      })
    };
    const prepared = prepareVegaScenegraphAnnotations(view, [
      {
        id: 'peak',
        markName: 'points',
        datum: (datum) => datum?.id === 'peak',
        note: { title: 'Peak' }
      }
    ], {
      obstacles: { role: 'axis', padding: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.data?.vegaMarkName).toBe('points');
    expect(prepared.obstacles).toEqual([
      { x: -2, y: 118, width: 224, height: 8 }
    ]);
  });

  it('extracts anchors from Vega-Lite charts after public Vega compilation', async () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => ({
        measureText: (text: string) => ({ width: text.length * 6 })
      })
    });
    const { compile } = await import('vega-lite');
    const vega = await import('vega');
    const liteSpec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      data: {
        values: [
          { id: 'baseline', category: 'A', value: 3 },
          { id: 'peak', category: 'B', value: 9 }
        ]
      },
      mark: { type: 'point' },
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' }
      }
    } as const;
    const compiled = compile(liteSpec).spec as Spec;
    const view = new vega.View(vega.parse(compiled), { renderer: 'none' });

    await view.runAsync();

    const prepared = prepareVegaScenegraphAnnotations<{ id?: string }>(view, [
      {
        id: 'vega-lite-peak',
        markName: 'marks',
        markType: 'symbol',
        datum: (datum) => datum?.id === 'peak',
        note: { title: 'Vega-Lite peak' },
        annotationData: { source: 'vega-lite' }
      }
    ], {
      obstacles: { markName: 'marks', markType: 'symbol', padding: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    const annotation = prepared.annotations[0];
    expect(annotation?.anchor.type).toBe('box');
    expect(annotation?.data).toMatchObject({
      anchorSource: 'vega-scenegraph',
      vegaMarkName: 'marks',
      vegaMarkType: 'symbol',
      vegaRole: 'mark',
      source: 'vega-lite'
    });
    if (!annotation || annotation.anchor.type !== 'box') {
      throw new Error('Expected Vega-Lite annotation to resolve to a box anchor.');
    }
    expect(annotation.anchor.box.width).toBeGreaterThan(0);
    expect(annotation.anchor.box.height).toBeGreaterThan(0);
    expect(prepared.obstacles.length).toBeGreaterThanOrEqual(2);
    expect(prepared.obstacles.every((obstacle) => obstacle.width > 0 && obstacle.height > 0)).toBe(true);
  });

  it('prepares annotations, obstacles, and validation from rendered Vega SVG marks', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g id="points-layer" class="mark-symbol role-mark points" data-mark-name="points">
          <path aria-label="point-peak" />
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const point = document.querySelector('#points-layer path') as SVGGraphicsElement;
    point.getBBox = () => ({ x: 105, y: 44, width: 8, height: 8 }) as DOMRect;

    const prepared = prepareVegaSvgAnnotations(svg, [
      {
        id: 'peak',
        selector: 'path[aria-label="point-peak"]',
        coordinateSpace: svg,
        note: { title: 'Peak' }
      }
    ], {
      obstacles: { markName: 'points', coordinateSpace: svg, padding: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.data?.vegaSelector).toBe('path[aria-label="point-peak"]');
    expect(prepared.obstacles).toEqual([
      { x: 103, y: 42, width: 12, height: 12 }
    ]);
  });

  it('reports missing and invalid Vega anchors across extraction modes', () => {
    const viewReport = validateVegaViewAnchors({
      data: () => [{ id: 'peak', x: 10, y: 20 }]
    }, [
      { id: 'peak', datum: (datum) => datum.id === 'peak', x: 'x', y: 'y' },
      { id: 'missing', datum: (datum) => datum.id === 'missing', x: 'x', y: 'y' }
    ]);
    const scaleReport = validateVegaScaleAnchors({
      data: () => [{ id: 'bar', x: 1 }],
      scale: () => (value: unknown) => Number(value)
    }, [
      { id: 'invalid-scale', xScale: 'x', yScale: 'y', x: 'x', y: 'missing' }
    ]);
    const sceneReport = validateVegaScenegraphAnchors({
      scenegraph: () => ({ root: { items: [{ mark: { name: 'points' }, bounds: { x1: 1, y1: 2, x2: 3, y2: 4 } }] } })
    }, [
      { id: 'points', markName: 'points' },
      { id: 'bars', markName: 'bars' }
    ]);

    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="mark-symbol points"></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const svgReport = validateVegaSvgAnchors(svg, [
      { id: 'points', markName: 'points', markType: 'symbol' },
      { id: 'bars', selector: '.mark-rect.bars' }
    ]);

    expect(viewReport.ok).toBe(false);
    expect(viewReport.found).toEqual(['peak']);
    expect(viewReport.missing[0]).toMatchObject({ id: 'missing', status: 'missing' });
    expect(scaleReport.ok).toBe(false);
    expect(scaleReport.missing[0]).toMatchObject({ id: 'invalid-scale', status: 'invalid' });
    expect(sceneReport.found).toEqual(['points']);
    expect(sceneReport.missing[0]).toMatchObject({ id: 'bars', expected: 'mark name "bars"' });
    expect(svgReport.found).toEqual(['points']);
    expect(svgReport.missing[0]).toMatchObject({ id: 'bars', expected: 'selector ".mark-rect.bars"' });
  });
});
