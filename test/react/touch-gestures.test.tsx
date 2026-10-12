// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation } from '../../src/index.js';

const annotations: Annotation[] = [{
  id: 'touch-note',
  anchor: { type: 'point', point: { x: 85, y: 80 } },
  note: { title: 'Touch editing' },
  placement: { manual: { x: 160, y: 75, side: 'right' } }
}];
const bounds = { x: 0, y: 0, width: 420, height: 270 };

function gesture(node: Element) {
  const event = new Event('touchstart', { bubbles: true, cancelable: true });
  const accepted = node.dispatchEvent(event);
  return { prevented: event.defaultPrevented, accepted };
}

describe('mobile touch event boundary', () => {
  it('prevents native scrolling only for editable SVG circles, not notes or stage', () => {
    const { container, rerender } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable previewEdits />
    );
    const hit = container.querySelector('.pa-annotation__edit-hit--note')!;
    const control = container.querySelector('.pa-annotation__edit-handle--note')!;
    const note = container.querySelector('.pa-annotation__note-box')!;
    const svg = container.querySelector('svg.pa-annotation-layer')!;
    expect(hit).toBeTruthy();
    expect(control).toBeTruthy();
    expect(note).toBeTruthy();
    expect(gesture(hit)).toEqual({ prevented: true, accepted: false });
    expect(gesture(control)).toEqual({ prevented: true, accepted: false });
    expect(gesture(note)).toEqual({ prevented: false, accepted: true });
    expect(gesture(svg)).toEqual({ prevented: false, accepted: true });

    // Disabling editing must detach the fallback immediately; no touch
    // behavior may leak from the previous host-owned editor generation.
    rerender(<AnnotationLayer annotations={annotations} bounds={bounds}
      editable={false} previewEdits />);
    expect(container.querySelector('.pa-annotation__edit-handle')).toBeNull();
    expect(gesture(svg)).toEqual({ prevented: false, accepted: true });
  });

  it('keeps the parent SVG listener non-invasive for noncancelable touches', () => {
    const { container } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable previewEdits />
    );
    const control = container.querySelector('.pa-annotation__edit-handle--note')!;
    const event = new Event('touchstart', { bubbles: true, cancelable: false });
    expect(control.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });
});
