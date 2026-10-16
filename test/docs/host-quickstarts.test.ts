// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { annotateReport } from './dom-report-example.js';
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
    ['dom-report-example.ts', 'ts'],
    ['react-flow-example.tsx', 'tsx']
  ])('executes the exact %s snippet printed in the adapter chooser', (file, language) => {
    expect(guide()).toContain(`\`\`\`${language}\n${read(`./${file}`).trim()}\n\`\`\``);
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
