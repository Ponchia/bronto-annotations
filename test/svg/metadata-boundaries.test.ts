// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderAnnotationsSvg } from '../../src/svg/render.js';
import { resolveAnnotationLayout } from '../../src/core/layout-resolver.js';
import type { Annotation, DataAttributes, ResolvedLayout } from '../../src/core/model.js';
import { PaintedAnnotation } from '../../src/react/annotation-presentation.js';

function parseMarkup(markup: string, type: DOMParserSupportedType = 'text/html'): Document {
  const parsed = new DOMParser().parseFromString(markup, type);
  expect(parsed.querySelector('parsererror'), 'SVG must remain well-formed XML').toBeNull();
  return parsed;
}

type Location = 'annotation' | 'note' | 'connector';
const selector = { annotation: '.pa-annotation', note: '[role="note"]', connector: '.pa-annotation__connector' };
function fixture(location: Location, data: DataAttributes): ResolvedLayout {
  const annotation: Annotation = {
    id: 'owned-note', anchor: { type: 'point', point: { x: 60, y: 70 } },
    note: { title: 'Metadata', body: 'Original note', align: 'center' },
    connector: { type: 'straight' }
  };
  if (location === 'annotation') annotation.data = data;
  else if (location === 'note') annotation.note.data = data;
  else annotation.connector = { ...annotation.connector, data };
  return resolveAnnotationLayout({ annotations: [annotation], bounds: { x: 0, y: 0, width: 320, height: 240 } });
}
function reactMarkup(layout: ResolvedLayout): string {
  return renderToStaticMarkup(createElement('svg', null, createElement(PaintedAnnotation, {
    item: layout.annotations[0]!, prefix: 'pa-annotation', markerPrefix: 'pa-annotation',
    debug: false, candidates: undefined, noteTabIndex: undefined, renderNote: undefined
  })));
}
const identityCases = (['annotation', 'note', 'connector'] as const).flatMap(location =>
  ['annotationId', 'annotation-id', 'annotation id'].map(key => ({ location, key })));

describe('renderer metadata boundaries', () => {
  it.each(identityCases)('keeps generated $location identity when custom data uses $key', ({ location, key }) => {
    const data: DataAttributes = { [key]: 'consumer-alias', usefulValue: 'retained' };
    const before = { ...data };
    const layout = fixture(location, data);
    const svg = renderAnnotationsSvg(layout);
    const xml = parseMarkup(svg, 'image/svg+xml');
    const html = parseMarkup(svg);
    const react = parseMarkup(reactMarkup(layout));
    for (const parsed of [xml, html, react]) {
      const element = parsed.querySelector(selector[location])!;
      expect(element.getAttribute('data-annotation-id')).toBe('owned-note');
      expect(element.getAttribute('data-useful-value')).toBe('retained');
    }
    expect(data).toEqual(before);
  });

  it.each([
    { location: 'annotation' as const, key: 'annotationSide', attribute: 'data-annotation-side' },
    { location: 'note' as const, key: 'noteAlign', attribute: 'data-note-align' },
    { location: 'connector' as const, key: 'connectorType', attribute: 'data-connector-type' }
  ])('retains generated $attribute rather than custom metadata', ({ location, key, attribute }) => {
    const layout = fixture(location, { [key]: 'custom-value', [attribute.slice(5)]: 'another-alias' });
    const expected = location === 'annotation' ? layout.annotations[0]!.placement.side
      : location === 'note' ? 'center' : layout.annotations[0]!.connector.type;
    for (const markup of [renderAnnotationsSvg(layout), reactMarkup(layout)]) {
      const dom = parseMarkup(markup);
      expect(dom.querySelector(selector[location])!.getAttribute(attribute)).toBe(expected);
    }
    parseMarkup(renderAnnotationsSvg(layout), 'image/svg+xml');
  });

  it.each(['annotation', 'note', 'connector'] as const)('normalizes custom aliases once on %s with deterministic last-value precedence', location => {
    const data: DataAttributes = { userLabel: 'first', 'user-label': 'last', ignored: undefined, empty: null, flag: false, count: 0 };
    const layout = fixture(location, data);
    const markup = renderAnnotationsSvg(layout);
    const xml = parseMarkup(markup, 'image/svg+xml');
    const react = parseMarkup(reactMarkup(layout));
    for (const dom of [xml, react]) {
      const node = dom.querySelector(selector[location])!;
      expect(node.getAttribute('data-user-label')).toBe('last');
      expect(node.getAttribute('data-flag')).toBe('false');
      expect(node.getAttribute('data-count')).toBe('0');
      expect(node.hasAttribute('data-ignored')).toBe(false);
      expect(node.hasAttribute('data-empty')).toBe(false);
    }
  });

  it('keeps unexpected enum text inside one escaped attribute', () => {
    const layout = fixture('note', { usefulValue: 'kept' });
    const text = 'center" data-boundary-probe="value & <tag>';
    layout.annotations[0]!.annotation.note.align = text as NonNullable<Annotation['note']['align']>;
    const svg = renderAnnotationsSvg(layout);
    const xml = parseMarkup(svg, 'image/svg+xml');
    expect(xml.querySelector('[data-boundary-probe]')).toBeNull();
    expect(xml.querySelector('[role="note"]')!.getAttribute('data-note-align')).toBe(text);
  });

  it('does not change ordinary custom metadata order or escaping', () => {
    const layout = fixture('note', { firstValue: 'one & two', second: false });
    const svg = renderAnnotationsSvg(layout);
    expect(svg).toContain('data-first-value="one &amp; two" data-second="false" data-annotation-id="owned-note" data-note-align="center"');
    expect(svg).toContain('data-annotation-id="owned-note" data-annotation-side="');
    const xml = parseMarkup(svg, 'image/svg+xml');
    expect(xml.querySelectorAll('[role="note"]')).toHaveLength(1);
  });
});
