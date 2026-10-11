// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation } from '../../src/index.js';
import type { AnnotationLayerEditEvent } from '../../src/react/index.js';

const bounds = { x: 0, y: 0, width: 500, height: 320 };
const annotations: Annotation[] = [
  { id: 'selected', anchor: { type: 'point', point: { x: 48, y: 60 } },
    note: { title: 'Selected' },
    placement: { manual: { x: 92, y: 38, side: 'right' } } },
  { id: 'neighbor', anchor: { type: 'point', point: { x: 360, y: 120 } },
    note: { title: 'Neighbor' },
    placement: { manual: { x: 270, y: 170, side: 'right' } } }
];

function pointer(target: Element, type: string, x: number, y: number, id = 5) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: id }
  });
  fireEvent(target, event);
}

function boundingRect(): DOMRect {
  return {
    x: 0, y: 0, width: bounds.width, height: bounds.height,
    left: 0, top: 0, right: bounds.width, bottom: bounds.height,
    toJSON: () => ({ ...bounds })
  } as DOMRect;
}

function scheduledFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextId;
    frames.set(id, callback);
    return id;
  });
  const cancel = vi.fn((id: number) => { frames.delete(id); });
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  return {
    request, cancel, frames,
    flush() {
      const entries = [...frames.entries()];
      frames.clear();
      act(() => entries.forEach(([, callback]) => callback(performance.now())));
    }
  };
}

describe('high-frequency React pointer previews', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('coalesces many pointer events into the latest visual preview while emitting every edit event', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(boundingRect());
    const frames = scheduledFrames();
    const edits: AnnotationLayerEditEvent[] = [];
    const commits: AnnotationLayerEditEvent[] = [];
    const onLayout = vi.fn();
    const { container } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        noteSizes={{ selected: { width: 110, height: 52 }, neighbor: { width: 105, height: 48 } }}
        editable={{ includeAnchor: true }} previewEdits
        onEdit={(event) => edits.push(event)}
        onEditEnd={(event) => commits.push(event)}
        onLayout={onLayout}
      />
    );
    const layer = container.querySelector('svg.pa-annotation-layer')!;
    const selected = () => container.querySelector('g.pa-annotation[data-annotation-id="selected"] foreignObject')!;
    const neighbor = () => container.querySelector('g.pa-annotation[data-annotation-id="neighbor"] foreignObject')!;
    const handle = container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="selected"]')!;
    const initial = Number(selected().getAttribute('x'));
    const neighborInitial = Number(neighbor().getAttribute('x'));

    pointer(handle, 'pointerdown', 100, 70);
    for (let index = 1; index <= 12; index += 1) {
      pointer(layer, 'pointermove', 100 + index * 3, 70 + index);
    }
    expect(edits.filter((event) => event.phase === 'move')).toHaveLength(12);
    expect(frames.request).toHaveBeenCalledTimes(1);
    expect(frames.frames.size).toBe(1);
    expect(Number(selected().getAttribute('x'))).toBe(initial);
    expect(commits).toHaveLength(0);
    expect(onLayout).toHaveBeenCalledTimes(1);

    frames.flush();
    expect(Number(selected().getAttribute('x'))).toBe(initial + 36);
    expect(Number(neighbor().getAttribute('x'))).toBe(neighborInitial);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(frames.frames.size).toBe(0);

    // The next visual frame can be scheduled independently of the first.
    pointer(layer, 'pointermove', 143, 83);
    expect(frames.request).toHaveBeenCalledTimes(2);
    frames.flush();
    expect(Number(selected().getAttribute('x'))).toBe(initial + 43);
    pointer(layer, 'pointerup', 147, 84);
    expect(commits).toHaveLength(1);
    expect(commits[0]?.suggestedPlacement?.manual?.x).toBe(initial + 47);
    expect(Number(selected().getAttribute('x'))).toBe(initial);
    expect(onLayout).toHaveBeenCalledTimes(1);
  });

  it('cancels unpainted movement on pointerup, pointercancel and component unmount', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(boundingRect());
    const frames = scheduledFrames();
    const end = vi.fn();
    const { container, unmount } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable previewEdits onEditEnd={end} />
    );
    const layer = container.querySelector('svg.pa-annotation-layer')!;
    const note = () => container.querySelector('g.pa-annotation[data-annotation-id="selected"] foreignObject')!;
    const handle = () => container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="selected"]')!;
    const initial = Number(note().getAttribute('x'));

    pointer(handle(), 'pointerdown', 80, 50);
    pointer(layer, 'pointermove', 110, 70);
    const canceledFrame = [...frames.frames.values()][0]!;
    pointer(layer, 'pointerup', 118, 75);
    expect(end).toHaveBeenCalledTimes(1);
    expect(frames.cancel).toHaveBeenCalledTimes(1);
    expect(frames.frames.size).toBe(0);
    expect(Number(note().getAttribute('x'))).toBe(initial);
    act(() => canceledFrame(performance.now())); // Even a leaked browser callback is inert.
    expect(Number(note().getAttribute('x'))).toBe(initial);

    pointer(handle(), 'pointerdown', 80, 50);
    pointer(layer, 'pointermove', 120, 81);
    pointer(layer, 'pointercancel', 120, 81);
    expect(end).toHaveBeenCalledTimes(1);
    expect(frames.frames.size).toBe(0);
    expect(Number(note().getAttribute('x'))).toBe(initial);

    pointer(handle(), 'pointerdown', 80, 50);
    pointer(layer, 'pointermove', 120, 81);
    const lastFrame = [...frames.frames.values()][0]!;
    unmount();
    expect(frames.frames.size).toBe(0);
    act(() => lastFrame(performance.now()));
    expect(end).toHaveBeenCalledTimes(1);
  });
});
