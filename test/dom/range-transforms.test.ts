// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { measureRangeAnchor } from '../../src/dom/range.js';

function fixture() {
  const parent = document.createElement('div');
  const space = document.createElement('div');
  space.textContent = 'Selected text'; parent.append(space); document.body.append(parent);
  space.getBoundingClientRect = () => new DOMRect(100, 50, 400, 200);
  Object.defineProperties(space, { offsetWidth: { value: 200, configurable: true },
    offsetHeight: { value: 100, configurable: true }, clientLeft: { value: 2 }, clientTop: { value: 2 },
    scrollLeft: { value: 10 }, scrollTop: { value: 5 } });
  const range = document.createRange(); range.selectNodeContents(space);
  range.getClientRects = () => [new DOMRect(160, 90, 80, 36)] as unknown as DOMRectList;
  return { parent, space, range };
}
afterEach(() => { document.body.replaceChildren(); });

const unsupported = [
  ['rotate', '30deg'], ['rotate', 'x 30deg'], ['rotate', '0 0 1 30deg'],
  ['scale', '-1 1'], ['scale', '1 -1'], ['scale', '-1'], ['scale', '0'],
  ['scale', '1 1 2'], ['translate', '0px 0px 20px'],
  ['offset-path', 'path("M 0 0 L 30 40")']
] as const;

describe('Range local-coordinate transform boundary', () => {
  it.each(unsupported)('rejects %s: %s on the coordinate space and an ancestor', (property, value) => {
    for (const ancestor of [false, true]) {
      const { parent, space, range } = fixture();
      (ancestor ? parent : space).style.setProperty(property, value);
      const measured = measureRangeAnchor(range, { coordinateSpace: space });
      expect(measured.status).toBe('unsupported');
      expect(measured.rects).toEqual([]);
      expect(measured.box).toBeUndefined();
      expect(measureRangeAnchor(range).status).toBe('resolved');
      parent.remove();
    }
  });

  it.each([
    '', 'translate: 10px 20px; scale: 2 3', 'translate: calc(10% + 2px) 20px',
    'translate: 10px 20px 0px', 'rotate: 0deg', 'rotate: 360deg', 'rotate: x 0deg',
    'rotate: 400grad', 'rotate: 1turn', 'scale: 1 1 1', 'scale: 100% 200%', 'perspective: 500px'
  ])('retains positive axis-aligned geometry for %s', css => {
    const { space, range } = fixture(); space.style.cssText = css;
    expect(measureRangeAnchor(range, { coordinateSpace: space }).box)
      .toEqual({ x: 38, y: 23, width: 40, height: 18 });
  });

  it('checks shadow hosts rather than stopping at the shadow-root boundary', () => {
    const { parent, space, range } = fixture();
    const host = document.createElement('div'); parent.append(host);
    host.attachShadow({ mode: 'open' }).append(space);
    host.style.rotate = '30deg'; range.selectNodeContents(space);
    expect(measureRangeAnchor(range, { coordinateSpace: space }).status).toBe('unsupported');
  });

  it('checks assigned slots and their composed ancestors', () => {
    const { parent, space, range } = fixture();
    const host = document.createElement('div'); parent.append(host); host.append(space);
    const shadow = host.attachShadow({ mode: 'open' });
    const rotated = document.createElement('div'); rotated.style.rotate = '30deg';
    rotated.append(document.createElement('slot')); shadow.append(rotated);
    expect(space.assignedSlot).not.toBeNull(); range.selectNodeContents(space);
    expect(measureRangeAnchor(range, { coordinateSpace: space }).status).toBe('unsupported');
  });

  it('rejects nonfinite local transforms and conversion overflow', () => {
    for (const bounds of [new DOMRect(Infinity, 0, 400, 200), new DOMRect(0, 0, Infinity, 200),
      new DOMRect(0, 0, Number.MIN_VALUE, 200)]) {
      const { parent, space, range } = fixture(); space.getBoundingClientRect = () => bounds;
      expect(measureRangeAnchor(range, { coordinateSpace: space }).status).toBe('unsupported');
      parent.remove();
    }
  });
});
