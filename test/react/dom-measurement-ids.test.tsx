// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation, ResolvedLayout, Size } from '../../src/index.js';

class ResizeObserverProbe {
  static instances: ResizeObserverProbe[] = [];
  observed = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) { ResizeObserverProbe.instances.push(this); }
  observe = (node: Element) => { this.observed.add(node); };
  unobserve = (node: Element) => { this.observed.delete(node); };
  disconnect = () => { this.observed.clear(); };
  emit(...targets: Element[]) {
    act(() => this.callback(targets.map(target => ({ target }) as ResizeObserverEntry), this as unknown as ResizeObserver));
  }
}

const bounds = { x: 0, y: 0, width: 1400, height: 600 };
const ids = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'normal-key', ''] as const;
const notes: Annotation[] = ids.map((id, index) => ({
  id,
  anchor: { type: 'point', point: { x: 50 + index * 210, y: 100 } },
  note: { title: `note-${index}` },
  connector: { type: 'none' },
  placement: { manual: { x: 50 + index * 210, y: 130, clamp: false } }
}));

function installMeasurements() {
  const sizes = new Map<string, Size>(notes.map((note, index) => [note.note.title!, { width: 137 + index, height: 61 + index }]));
  const reads: string[] = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverProbe);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (!this.parentElement?.classList.contains('pa-annotation-layer__measurer')) return new DOMRect();
    const key = this.textContent?.trim() ?? '';
    reads.push(key);
    const size = sizes.get(key) ?? { width: 0, height: 0 };
    return new DOMRect(0, 0, size.width, size.height);
  });
  return { sizes, reads };
}

function latestNote(layouts: ResolvedLayout[], id: string) {
  return layouts.at(-1)!.annotations.find(note => note.id === id)!;
}

function nodeFor(container: HTMLElement, title: string) {
  return [...container.querySelectorAll('.pa-annotation-layer__measurer > div')]
    .find(node => node.textContent?.trim() === title)!;
}

afterEach(() => {
  cleanup(); ResizeObserverProbe.instances = []; vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('DOM measurements preserve opaque annotation identifiers', () => {
  it.each(ids)('retains initial measurements for %j', id => {
    const { sizes } = installMeasurements();
    const layouts: ResolvedLayout[] = [];
    render(<AnnotationLayer annotations={notes} bounds={bounds} measure="dom" onLayout={layout => layouts.push(layout)} />);
    const expected = sizes.get(notes.find(note => note.id === id)!.note.title!)!;
    expect(latestNote(layouts, id).noteBox).toMatchObject(expected);
  });

  it.each(ids)('updates only the resized note for %j', id => {
    const { sizes, reads } = installMeasurements();
    const layouts: ResolvedLayout[] = [];
    const { container } = render(<AnnotationLayer annotations={notes} bounds={bounds} measure="dom" onLayout={layout => layouts.push(layout)} />);
    const title = notes.find(note => note.id === id)!.note.title!;
    const observer = ResizeObserverProbe.instances.at(-1)!;
    const previous = layouts.at(-1)!;
    reads.length = 0;
    sizes.set(title, { width: 173, height: 87 });
    observer.emit(nodeFor(container, title));
    expect(latestNote(layouts, id).noteBox).toMatchObject({ width: 173, height: 87 });
    expect(reads).toEqual([title]);
    for (const other of previous.annotations.filter(note => note.id !== id)) {
      expect(latestNote(layouts, other.id).noteBox).toEqual(other.noteBox);
    }
  });

  it('drops a hidden reserved-looking measurement and restores it when visible', () => {
    const { sizes } = installMeasurements();
    const layouts: ResolvedLayout[] = [];
    const { container } = render(<AnnotationLayer annotations={notes} bounds={bounds} measure="dom" onLayout={layout => layouts.push(layout)} />);
    const target = notes.find(note => note.id === '__proto__')!;
    const observer = ResizeObserverProbe.instances.at(-1)!;
    const node = nodeFor(container, target.note.title!);
    sizes.set(target.note.title!, { width: 0, height: 0 });
    observer.emit(node);
    expect(latestNote(layouts, target.id).noteBox.width).not.toBe(137);
    sizes.set(target.note.title!, { width: 181, height: 93 });
    observer.emit(node);
    expect(latestNote(layouts, target.id).noteBox).toMatchObject({ width: 181, height: 93 });
  });

  it('reconciles removal/reintroduction without phantom sizes or prototype writes', () => {
    installMeasurements();
    const before = Object.getOwnPropertyDescriptors(Object.prototype);
    const layouts: ResolvedLayout[] = [];
    const onLayout = (layout: ResolvedLayout) => { layouts.push(layout); };
    const { rerender } = render(<AnnotationLayer annotations={notes} bounds={bounds} measure="dom" onLayout={onLayout} />);
    expect(latestNote(layouts, '__proto__').noteBox.width).toBe(137);
    rerender(<AnnotationLayer annotations={notes.slice(1)} bounds={bounds} measure="dom" onLayout={onLayout} />);
    expect(layouts.at(-1)!.annotations.some(note => note.id === '__proto__')).toBe(false);
    rerender(<AnnotationLayer annotations={notes} bounds={bounds} measure="dom" onLayout={onLayout} />);
    expect(latestNote(layouts, '__proto__').noteBox.width).toBe(137);
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(before);
  });
});
