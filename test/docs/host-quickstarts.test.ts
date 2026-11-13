// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { annotateReport } from './dom-report-example.js';
import { annotateExistingSvg } from './svg-host-example.js';
import { FlowNotes } from './react-flow-example.js';

const flow = vi.hoisted(() => ({
  nodes: [{ id: 'review', position: { x: 80, y: 96 }, measured: { width: 90, height: 44 }, data: {} }],
  viewport: { x: 20, y: 10, zoom: 1.5 }
}));
vi.mock('@xyflow/react', () => ({
  useNodes: () => flow.nodes,
  useViewport: () => flow.viewport
}));

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const guide = () => read('../../docs/context-quickstart.md');

describe('first-success host quickstarts', () => {
  it.each([
    ['svg-host-example.ts', 'ts'],
    ['dom-report-example.ts', 'ts'],
    ['react-flow-example.tsx', 'tsx']
  ])('executes the exact %s snippet printed in the adapter chooser', (file, language) => {
    expect(guide()).toContain(`\`\`\`${language}\n${read(`./${file}`).trim()}\n\`\`\``);
  });

  it('anchors an existing SVG mark by measured geometry and reflects chart changes', () => {
    document.body.innerHTML = '<div id="wrapper"><svg id="sales-chart" viewBox="0 0 600 320"><rect id="peak-mark" /></svg><div id="chart-notes"></div></div>';
    const svg = document.querySelector<SVGSVGElement>('#sales-chart')!;
    const mark = svg.querySelector<SVGGraphicsElement>('#peak-mark')!;
    const overlay = document.querySelector<HTMLElement>('#chart-notes')!;
    const currentBox = { x: 350, y: 100, width: 20, height: 80 };
    mark.getBBox = vi.fn(() => ({ ...currentBox }) as DOMRect);

    const first = annotateExistingSvg(svg, overlay);
    expect(first.bounds).toEqual({ x: 0, y: 0, width: 600, height: 320 });
    expect(first.annotations[0]?.annotation.anchor).toEqual({ type: 'box', box: currentBox });
    expect(overlay.querySelectorAll('.pa-annotation')).toHaveLength(1);
    expect(overlay.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 600 320');
    expect(overlay.querySelector('.pa-annotation__title')?.textContent).toBe('Peak response');

    currentBox.x = 420;
    const next = annotateExistingSvg(svg, overlay);
    expect(next.annotations[0]?.annotation.anchor).toEqual({ type: 'box', box: currentBox });
    expect(overlay.querySelectorAll('svg')).toHaveLength(1);

    mark.getBBox = vi.fn(() => ({ ...currentBox, x: Number.NaN }) as DOMRect);
    expect(() => annotateExistingSvg(svg, overlay)).toThrow('valid geometry');
    mark.remove();
    expect(() => annotateExistingSvg(svg, overlay)).toThrow('not found');
  });

  it('measures a DOM target relative to its report surface and remeasures changes', () => {
    document.body.innerHTML = '<section><article id="metric-card">42</article><div id="overlay"></div></section>';
    const surface = document.querySelector('section')!;
    const metric = document.querySelector<HTMLElement>('#metric-card')!;
    const overlay = document.querySelector<HTMLElement>('#overlay')!;
    Object.defineProperties(surface, { clientWidth: { value: 420 }, clientHeight: { value: 260 } });
    surface.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 200, width: 420, height: 260 });
    metric.getBoundingClientRect = () => DOMRect.fromRect({ x: 164, y: 296, width: 90, height: 44 });

    const resolved = annotateReport(surface, overlay);
    expect(resolved.validation.ok).toBe(true);
    expect(resolved.annotations[0]?.anchor).toEqual({ type: 'box', box: { x: 64, y: 96, width: 90, height: 44 } });
    expect(resolved.quality.ok).toBe(true);
    expect(overlay.querySelectorAll('.pa-annotation')).toHaveLength(1);
    expect(overlay.querySelector('.pa-annotation__title')?.textContent).toBe('Measured metric');
    expect(overlay.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 420 260');

    metric.getBoundingClientRect = () => DOMRect.fromRect({ x: 180, y: 310, width: 90, height: 44 });
    expect(annotateReport(surface, overlay).annotations[0]?.anchor).toEqual({
      type: 'box', box: { x: 80, y: 110, width: 90, height: 44 }
    });
    expect(overlay.querySelectorAll('svg')).toHaveLength(1);
    metric.remove();
    expect(() => annotateReport(surface, overlay)).toThrow();
  });

  describe('React Flow measured state', () => {
    beforeEach(() => {
      flow.nodes = [{ id: 'review', position: { x: 80, y: 96 }, measured: { width: 90, height: 44 }, data: {} }];
      flow.viewport = { x: 20, y: 10, zoom: 1.5 };
    });

    it('renders one annotation and applies the viewport exactly once', () => {
      const render = () => renderToStaticMarkup(createElement(FlowNotes, { width: 640, height: 420 }));
      document.body.innerHTML = render();
      expect(document.querySelectorAll('.pa-annotation')).toHaveLength(1);
      expect(document.querySelector('.pa-annotation__title')?.textContent).toBe('Review this step');
      const anchor = document.querySelector('rect.pa-annotation__subject');
      // Node top-left (80,96), zoom 1.5, then viewport translation (20,10).
      const markup = document.body.innerHTML;
      expect(markup).toContain('Graph annotations');
      expect(markup).toContain('viewBox="0 0 640 420"');
      expect(anchor?.getAttribute('x')).toBe('140');
      expect(anchor?.getAttribute('y')).toBe('154');

      flow.viewport = { x: 0, y: 0, zoom: 1 };
      document.body.innerHTML = render();
      expect(document.querySelector('rect.pa-annotation__subject')?.getAttribute('x')).toBe('80');
    });

    it('waits for the requested measured node rather than rendering a false origin', () => {
      flow.nodes = [];
      expect(renderToStaticMarkup(createElement(FlowNotes, { width: 640, height: 420 }))).toBe('');
      flow.nodes = [{ id: 'review', position: { x: 80, y: 96 }, measured: { width: 0, height: 0 }, data: {} }];
      expect(renderToStaticMarkup(createElement(FlowNotes, { width: 640, height: 420 }))).toBe('');
    });
  });
});
