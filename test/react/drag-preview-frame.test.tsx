// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import { resolveAnnotationLayout } from '../../src/index.js';
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

  it('discards stale frames after host geometry changes and ignores unrelated pointers', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(boundingRect());
    const frames = scheduledFrames();
    const edits: AnnotationLayerEditEvent[] = [];
    const commits: AnnotationLayerEditEvent[] = [];
    const { container, rerender } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable previewEdits onEdit={(event) => edits.push(event)}
        onEditEnd={(event) => commits.push(event)} />
    );
    const layer = container.querySelector('svg.pa-annotation-layer')!;
    const note = () => container.querySelector(
      'g.pa-annotation[data-annotation-id="selected"] foreignObject')!;
    const handle = () => container.querySelector(
      '.pa-annotation__edit-handle--note[data-annotation-id="selected"]')!;
    const originalX = Number(note().getAttribute('x'));

    pointer(handle(), 'pointerdown', 100, 70, 5);
    // Another pointer cannot hijack the active gesture, its pending frame, or
    // any host edit callbacks.
    pointer(layer, 'pointermove', 120, 78, 23);
    expect(frames.request).not.toHaveBeenCalled();
    expect(edits.filter((event) => event.phase === 'move')).toHaveLength(0);
    pointer(layer, 'pointermove', 138, 80, 5);
    expect(frames.request).toHaveBeenCalledTimes(1);
    const oldFrame = [...frames.frames.values()][0]!;

    // The host commits new authoritative coordinates during the gesture.
    // Its old preview projection must be rejected even if a browser invokes
    // an already-queued callback despite cancelAnimationFrame.
    rerender(
      <AnnotationLayer annotations={annotations} bounds={{ ...bounds, width: 540 }}
        editable previewEdits onEdit={(event) => edits.push(event)}
        onEditEnd={(event) => commits.push(event)} />
    );
    expect(frames.cancel).toHaveBeenCalledTimes(1);
    expect(frames.frames.size).toBe(0);
    act(() => oldFrame(performance.now()));
    expect(Number(note().getAttribute('x'))).toBe(originalX);

    pointer(layer, 'pointerup', 140, 80, 23);
    expect(commits).toHaveLength(0);
    // The pointer that began the now-stale drag must not submit a placement
    // derived from the geometry that existed before the host replacement.
    pointer(layer, 'pointerup', 140, 80, 5);
    expect(commits).toHaveLength(0);
    expect(edits.filter((event) => event.phase === 'end')).toHaveLength(0);
    expect(Number(note().getAttribute('x'))).toBe(originalX);

    // A new gesture is free to schedule a fresh frame generation.
    pointer(handle(), 'pointerdown', 100, 70, 5);
    pointer(layer, 'pointermove', 129, 86, 5);
    expect(frames.request).toHaveBeenCalledTimes(2);
    frames.flush();
    expect(Number(note().getAttribute('x'))).not.toBe(originalX);
    pointer(layer, 'pointercancel', 129, 86, 5);
    expect(Number(note().getAttribute('x'))).toBe(originalX);
    expect(commits).toHaveLength(0);
  });

  it('discards an incomplete drag when the capturing edit handle loses pointer capture', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(boundingRect());
    const frames = scheduledFrames();
    const onEditEnd = vi.fn();
    const { container } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable previewEdits onEditEnd={onEditEnd} />
    );
    const layer = container.querySelector('svg.pa-annotation-layer')!;
    const handle = () => container.querySelector(
      '.pa-annotation__edit-handle--note[data-annotation-id="selected"]')!;
    const note = () => container.querySelector(
      'g.pa-annotation[data-annotation-id="selected"] foreignObject')!;
    const originalX = Number(note().getAttribute('x'));
    pointer(handle(), 'pointerdown', 100, 70, 5);
    pointer(layer, 'pointermove', 132, 83, 5);
    const queued = [...frames.frames.values()][0]!;
    expect(frames.frames.size).toBe(1);

    pointer(handle(), 'lostpointercapture', 132, 83, 5);
    expect(frames.frames.size).toBe(0);
    act(() => queued(performance.now()));
    pointer(layer, 'pointerup', 132, 83, 5);
    expect(onEditEnd).not.toHaveBeenCalled();
    expect(Number(note().getAttribute('x'))).toBe(originalX);

    // The next pointer can author a normal edit after capture was lost.
    pointer(handle(), 'pointerdown', 100, 70, 9);
    pointer(layer, 'pointermove', 116, 75, 9);
    pointer(layer, 'pointerup', 116, 75, 9);
    expect(onEditEnd).toHaveBeenCalledTimes(1);
    expect(onEditEnd.mock.calls[0]?.[0].phase).toBe('end');
  });

  it('invalidates an active drag if the host disables editing without changing layout', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(boundingRect());
    const frames = scheduledFrames();
    const onEditEnd = vi.fn();
    const { container, rerender } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable previewEdits onEditEnd={onEditEnd} />
    );
    const layer = container.querySelector('svg.pa-annotation-layer')!;
    const handle = container.querySelector(
      '.pa-annotation__edit-handle--note[data-annotation-id="selected"]')!;
    pointer(handle, 'pointerdown', 100, 70, 5);
    pointer(layer, 'pointermove', 130, 80, 5);
    const queued = [...frames.frames.values()][0]!;
    expect(frames.frames.size).toBe(1);

    rerender(
      <AnnotationLayer annotations={annotations} bounds={bounds}
        editable={false} previewEdits onEditEnd={onEditEnd} />
    );
    expect(frames.frames.size).toBe(0);
    act(() => queued(performance.now()));
    pointer(layer, 'pointerup', 135, 82, 5);
    expect(onEditEnd).not.toHaveBeenCalled();
    expect(container.querySelector('.pa-annotation__edit-handle--note')).toBeNull();
  });

  it('does not commit an old controlled-layout edit after the host replaces note geometry', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(boundingRect());
    const frames = scheduledFrames();
    const noteSizes = {
      selected: { width: 110, height: 52 },
      neighbor: { width: 105, height: 48 }
    };
    const first = resolveAnnotationLayout({ annotations, bounds, noteSizes });
    const replacedAnnotations: Annotation[] = annotations.map((item) => item.id === 'selected'
      ? {
          ...item,
          placement: { manual: { x: 212, y: 47, side: 'right' } }
        }
      : item);
    const second = resolveAnnotationLayout({
      annotations: replacedAnnotations, bounds, noteSizes
    });
    const commits: AnnotationLayerEditEvent[] = [];
    const edits: AnnotationLayerEditEvent[] = [];
    const props = {
      editable: true as const, previewEdits: true,
      onEdit: (event: AnnotationLayerEditEvent) => edits.push(event),
      onEditEnd: (event: AnnotationLayerEditEvent) => commits.push(event)
    };
    const { container, rerender } = render(
      <AnnotationLayer {...props} layout={first} />
    );
    const layer = container.querySelector('svg.pa-annotation-layer')!;
    const note = () => container.querySelector(
      'g.pa-annotation[data-annotation-id="selected"] foreignObject')!;
    const handle = () => container.querySelector(
      '.pa-annotation__edit-handle--note[data-annotation-id="selected"]')!;
    pointer(handle(), 'pointerdown', 100, 70, 5);
    pointer(layer, 'pointermove', 125, 82, 5);
    const queuedFrame = [...frames.frames.values()][0]!;
    expect(queuedFrame).toBeDefined();

    rerender(<AnnotationLayer {...props}
      layout={second} />);
    expect(frames.cancel).toHaveBeenCalledTimes(1);
    expect(Number(note().getAttribute('x')))
      .toBe(second.annotations.find((item) => item.id === 'selected')!.noteBox.x);

    // A stale release must not override the accepted authoritative placement.
    pointer(layer, 'pointerup', 144, 87, 5);
    expect(commits).toHaveLength(0);
    expect(edits.filter((event) => event.phase === 'end')).toHaveLength(0);
    act(() => queuedFrame(performance.now()));
    expect(Number(note().getAttribute('x')))
      .toBe(second.annotations.find((item) => item.id === 'selected')!.noteBox.x);

    // A fresh gesture using the new host layout still commits normally.
    pointer(handle(), 'pointerdown', 110, 70, 5);
    pointer(layer, 'pointerup', 133, 80, 5);
    expect(commits).toHaveLength(1);
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
