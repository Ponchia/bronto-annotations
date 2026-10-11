// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIncrementalAnnotationLayoutSession } from '../../src/index.js';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation } from '../../src/index.js';
import type { AnnotationLayerEditEvent, AnnotationLayerEditOptions } from '../../src/react/index.js';

const bounds = { x: 0, y: 0, width: 920, height: 340 };
const annotations: Annotation[] = Array.from({ length: 12 }, (_, i) => ({
  id: `stable-${i}`,
  priority: 12 - i,
  anchor: { type: 'point', point: { x: 25 + 65 * i, y: 85 } },
  note: { title: `Annotation ${i}` },
  placement: { manual: { x: 40 + 65 * i, y: 140 } }
}));
const sizes = Object.fromEntries(annotations.map((item) => [item.id, { width: 60, height: 40 }]));
const base = { annotations, bounds, noteSizes: sizes, refinement: false };

function noteHandle(container: HTMLElement, id: string): Element {
  const handle = container.querySelector(
    `.pa-annotation__edit-handle--note[data-annotation-id="${id}"]`
  );
  if (!handle) throw new Error(`Missing editing control for ${id}`);
  return handle;
}

afterEach(() => vi.restoreAllMocks());

describe('React edit-handle identity across incremental commits', () => {
  it('preserves semantic handle objects for unchanged winners, with current callbacks', () => {
    const session = createIncrementalAnnotationLayoutSession(base);
    const firstCallback = vi.fn<(event: AnnotationLayerEditEvent) => void>();
    const nextCallback = vi.fn<(event: AnnotationLayerEditEvent) => void>();
    const nextEndCallback = vi.fn<(event: AnnotationLayerEditEvent) => void>();
    const { container, rerender } = render(
      <AnnotationLayer {...base} resolvedLayout={session.layout}
        editable={{ includeAnchor: true, keyboardStep: 2 }}
        onEditStart={firstCallback} />
    );
    const fixed = noteHandle(container, 'stable-0');
    fireEvent.keyDown(fixed, { key: 'ArrowRight' });
    expect(firstCallback).toHaveBeenCalledTimes(1);
    const firstHandle = firstCallback.mock.calls[0]![0].handle;
    expect(firstHandle.id).toBe('stable-0:note');
    expect(firstCallback.mock.calls[0]![0].phase).toBe('start');

    // Different wrapper object and copied semantic input, but identical
    // authoritative layout. Neither handles nor their DOM node should change.
    const equivalent = structuredClone(annotations);
    expect(session.update({ ...base, annotations: equivalent })).toBe(session.layout);
    rerender(
      <AnnotationLayer {...base} annotations={equivalent} resolvedLayout={session.layout}
        editable={{ includeAnchor: true, keyboardStep: 2 }}
        onEditStart={nextCallback} onEditEnd={nextEndCallback} />
    );
    expect(noteHandle(container, 'stable-0')).toBe(fixed);
    fireEvent.keyDown(fixed, { key: 'ArrowRight' });
    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(nextCallback).toHaveBeenCalledTimes(1);
    expect(nextCallback.mock.calls[0]![0].handle).toBe(firstHandle);

    // A committed edit to the final low-priority note produces a new layout,
    // but the unchanged first note retains its ResolvedAnnotation identity.
    const changed = structuredClone(equivalent);
    changed.at(-1)!.note.title = 'Edited final annotation';
    const updated = session.update({ ...base, annotations: changed });
    rerender(
      <AnnotationLayer {...base} annotations={changed} resolvedLayout={updated}
        editable={{ includeAnchor: true, keyboardStep: 2 }}
        onEditStart={nextCallback} onEditEnd={nextEndCallback} />
    );
    fireEvent.keyDown(noteHandle(container, 'stable-0'), { key: 'ArrowRight' });
    expect(nextCallback).toHaveBeenCalledTimes(2);
    expect(nextCallback.mock.calls[1]![0].handle).toBe(firstHandle);
    // The start event has delta 0; keyboard movement is committed by the
    // separate end event with the configured two-unit step.
    expect(nextEndCallback.mock.calls[1]![0].suggestedPlacement?.manual.x)
      .toBe(updated.annotations[0]!.noteBox.x + 2);

    const editedControl = noteHandle(container, 'stable-11');
    expect(editedControl.getAttribute('aria-label')).toContain('Edited final annotation');
    fireEvent.keyDown(editedControl, { key: 'ArrowRight' });
    expect(nextCallback.mock.calls.at(-1)![0].suggestedAnnotation?.note.title)
      .toBe('Edited final annotation');

    // The existing DOM control must also dispatch pointer gestures using the
    // newest committed model and callback, not a closure from an old layout.
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: bounds.width, bottom: bounds.height,
      width: bounds.width, height: bounds.height, toJSON: () => ({})
    } as DOMRect);
    const pointerCallback = vi.fn<(event: AnnotationLayerEditEvent) => void>();
    rerender(
      <AnnotationLayer {...base} annotations={changed} resolvedLayout={updated}
        editable={{ includeAnchor: true, keyboardStep: 2 }}
        onEditStart={pointerCallback} />
    );
    const unchangedNoteHandle = noteHandle(container, 'stable-0');
    fireEvent.pointerDown(unchangedNoteHandle, { pointerId: 7, clientX: 45, clientY: 145 });
    expect(pointerCallback).toHaveBeenCalledTimes(1);
    expect(pointerCallback.mock.calls[0]![0].handle).toBe(firstHandle);
    expect(pointerCallback.mock.calls[0]![0].suggestedAnnotation?.note.title).toBe('Annotation 0');
    fireEvent.pointerUp(container.querySelector('svg.pa-annotation-layer')!, {
      pointerId: 7, clientX: 45, clientY: 145
    });
  });

  it('recomputes handles and keyboard deltas when supported options actually change', () => {
    const session = createIncrementalAnnotationLayoutSession(base);
    const onEditEnd = vi.fn<(event: AnnotationLayerEditEvent) => void>();
    const editable: AnnotationLayerEditOptions = { includeAnchor: true, keyboardStep: 2, noteHandlePosition: 'top-right' };
    const { container, rerender } = render(
      <AnnotationLayer {...base} resolvedLayout={session.layout} editable={editable} onEditEnd={onEditEnd} />
    );
    const before = noteHandle(container, 'stable-0');
    fireEvent.keyDown(before, { key: 'ArrowDown' });
    expect(onEditEnd.mock.calls[0]![0].delta).toEqual({ x: 0, y: 2 });
    const originalHandle = onEditEnd.mock.calls[0]![0].handle;
    expect(container.querySelector('.pa-annotation__edit-handle--anchor')).toBeTruthy();

    // Even mutating an object in place must update the supported scalar
    // dependencies, not rely on the old wrapper's object identity.
    editable.keyboardStep = 7;
    editable.noteHandlePosition = 'bottom-left';
    rerender(
      <AnnotationLayer {...base} resolvedLayout={session.layout} editable={editable} onEditEnd={onEditEnd} />
    );
    const after = noteHandle(container, 'stable-0');
    expect(after.getAttribute('data-edit-handle-position')).toBe('bottom-left');
    fireEvent.keyDown(after, { key: 'ArrowDown' });
    expect(onEditEnd.mock.calls[1]![0].delta).toEqual({ x: 0, y: 7 });
    expect(onEditEnd.mock.calls[1]![0].handle).not.toBe(originalHandle);

    rerender(
      <AnnotationLayer {...base} resolvedLayout={session.layout}
        editable={{ includeAnchor: false, keyboardStep: 7, noteHandlePosition: 'bottom-left' }}
        onEditEnd={onEditEnd} />
    );
    expect(container.querySelector('.pa-annotation__edit-handle--anchor')).toBeNull();
    expect(noteHandle(container, 'stable-0')).toBeTruthy();
  });
});
