// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { prepareDomAnnotations } from '../../src/dom/index.js';
import { prepareD2DiagramAnnotations, prepareD2SvgAnnotations } from '../../src/adapters/d2.js';
import { prepareMermaidAnnotations } from '../../src/adapters/mermaid.js';
import { prepareReactFlowAnnotations } from '../../src/adapters/react-flow.js';
import {
  prepareVegaScaleAnnotations,
  prepareVegaScenegraphAnnotations,
  prepareVegaSvgAnnotations,
  prepareVegaViewAnnotations
} from '../../src/adapters/vega.js';

describe('prepare helper validation assertions', () => {
  it('can fail fast for missing generated and DOM anchors', () => {
    document.body.innerHTML = '<svg viewBox="0 0 120 80"></svg>';
    const svg = document.querySelector('svg') as SVGSVGElement;

    expect(() => prepareDomAnnotations(document, [
      { id: 'dom-missing', selector: '.missing', note: { title: 'Missing' } }
    ], { assert: true })).toThrow('DOM anchors: failed');

    expect(() => prepareVegaViewAnnotations({ data: () => [{ id: 'kept', x: 10, y: 20 }] }, [
      { id: 'vega-view-missing', datum: (datum) => datum.id === 'missing', x: 'x', y: 'y' }
    ], { assert: true })).toThrow('Vega view anchors: failed');

    expect(() => prepareVegaScaleAnnotations({
      data: () => [{ id: 'kept', x: 1, y: 2 }],
      scale: () => (value: unknown) => Number(value)
    }, [
      { id: 'vega-scale-missing', datum: (datum) => datum.id === 'missing', xScale: 'x', yScale: 'y', x: 'x', y: 'y' }
    ], { assert: true })).toThrow('Vega scale anchors: failed');

    expect(() => prepareVegaScenegraphAnnotations({
      scenegraph: () => ({ root: { items: [{ mark: { name: 'points' }, bounds: { x1: 0, y1: 0, x2: 4, y2: 4 } }] } })
    }, [
      { id: 'vega-scene-missing', markName: 'bars' }
    ], { assert: true })).toThrow('Vega scenegraph anchors: failed');

    expect(() => prepareVegaSvgAnnotations(svg, [
      { id: 'vega-svg-missing', selector: '.missing-mark' }
    ], { assert: true })).toThrow('Vega SVG anchors: failed');

    expect(() => prepareMermaidAnnotations(svg, [
      { id: 'mermaid-missing', label: 'Missing node' }
    ], { assert: true })).toThrow('Mermaid anchors: failed');

    expect(() => prepareD2DiagramAnnotations({ shapes: [] }, [
      { id: 'd2-diagram-missing', shapeId: 'missing' }
    ], { assert: true })).toThrow('D2 diagram anchors: failed');

    expect(() => prepareD2SvgAnnotations(svg, [
      { id: 'd2-svg-missing', selector: '.missing-shape' }
    ], { assert: true })).toThrow('D2 SVG anchors: failed');

    expect(() => prepareReactFlowAnnotations({ nodes: [] }, [
      { id: 'flow-missing', nodeId: 'missing' }
    ], { assert: true })).toThrow('React Flow anchors: failed');
  });

  it('can optionally treat fallback diagnostics as failures', () => {
    const input = {
      nodes: [
        { id: 'review', position: { x: 20, y: 30 }, width: 120, height: 64 }
      ]
    };
    const specs = [
      { id: 'review-output', handle: { nodeId: 'review', id: 'approved', side: 'right' as const } }
    ];

    expect(prepareReactFlowAnnotations(input, specs, { assert: true }).validation.warnings[0]?.status)
      .toBe('fallback');
    expect(() => prepareReactFlowAnnotations(input, specs, { assert: { failOnWarnings: true } }))
      .toThrow('1 warning');
  });
});
