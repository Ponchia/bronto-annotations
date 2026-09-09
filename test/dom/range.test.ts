// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { measureRangeAnchor } from '../../src/dom/index.js';

function rangeWithRects(rects: DOMRect[]) {
  const element = document.createElement('div'); element.textContent = 'A selected passage'; document.body.append(element);
  const range = document.createRange(); range.selectNodeContents(element);
  range.getClientRects = () => rects as unknown as DOMRectList;
  return { range, element };
}
describe('range measurement', () => {
  it('retains wrapped geometry and an explicit bounded result', () => {
    const a = new DOMRect(10, 20, 100, 18), b = new DOMRect(10, 42, 50, 18);
    const { range } = rangeWithRects([a, a, b]);
    expect(measureRangeAnchor(range)).toMatchObject({ status: 'resolved', box: { x: 10, y: 20, width: 100, height: 40 }, truncated: false });
    expect(measureRangeAnchor(range).rects).toHaveLength(2);
    expect(measureRangeAnchor(range, { maxRects: 1 }).truncated).toBe(true);
    range.getClientRects = () => [a, a] as unknown as DOMRectList;
    expect(measureRangeAnchor(range, { maxRects: 1 }).truncated).toBe(false);
    expect(() => measureRangeAnchor(range, { maxRects: 0 })).toThrow(RangeError);
  });
  it('converts viewport bounds into a scaled, scrolled local padding space', () => {
    const { range, element } = rangeWithRects([new DOMRect(160, 90, 80, 36)]);
    element.getBoundingClientRect = () => new DOMRect(100, 50, 400, 200);
    Object.defineProperties(element, {
      offsetWidth: { value: 200 }, offsetHeight: { value: 100 },
      clientLeft: { value: 2 }, clientTop: { value: 2 },
      scrollLeft: { value: 10 }, scrollTop: { value: 5 }
    });
    // A two-times zoom turns 80×36 viewport pixels into 40×18 local pixels.
    expect(measureRangeAnchor(range, { coordinateSpace: element }).box).toEqual({ x: 38, y: 23, width: 40, height: 18 });
  });
  it('does not invent geometry for a collapsed, hidden or unrelated selection', () => {
    const { range, element } = rangeWithRects([]);
    expect(measureRangeAnchor(range).status).toBe('empty');
    expect(measureRangeAnchor(range, { coordinateSpace: element }).status).toBe('unsupported');
    expect(measureRangeAnchor(range, { coordinateSpace: document.createElement('div') }).status).toBe('unsupported');
    range.collapse(); expect(measureRangeAnchor(range).status).toBe('empty');
  });
});
