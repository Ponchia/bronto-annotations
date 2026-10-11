// @vitest-environment jsdom

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation, ResolvedLayout } from '../../src/index.js';

const annotations: Annotation[] = Array.from({ length: 48 }, (_, i) => ({
  id: `measured-${i}`,
  anchor: { type: 'point', point: { x: 40 + (i % 12) * 88, y: 50 + Math.floor(i / 12) * 90 } },
  note: { title: `Measured ${i}` },
  connector: { type: 'straight', routing: 'none' },
  placement: { manual: { x: 55 + (i % 12) * 88, y: 63 + Math.floor(i / 12) * 90, clamp: false } }
}));
const bounds = { x: 0, y: 0, width: 1250, height: 700 };

class ManualResizeObserver {
  static instances: ManualResizeObserver[] = [];
  observed = new Set<Element>();
  disconnect = vi.fn(() => this.observed.clear());
  constructor(private readonly callback: ResizeObserverCallback) {
    ManualResizeObserver.instances.push(this);
  }
  observe = vi.fn((node: Element) => this.observed.add(node));
  unobserve = vi.fn((node: Element) => this.observed.delete(node));
  emit(...targets: Element[]) {
    const entries = targets.map((target) => ({ target } as ResizeObserverEntry));
    act(() => this.callback(entries, this as unknown as ResizeObserver));
  }
}

function installMeasurements() {
  const sizes = new Map<number, { width: number; height: number }>();
  const measured: number[] = [];
  for (let index = 0; index < annotations.length + 1; index += 1) {
    sizes.set(index, { width: 80, height: 42 });
  }
  vi.stubGlobal('ResizeObserver', ManualResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (!this.parentElement?.classList.contains('pa-annotation-layer__measurer')) {
      return new DOMRect(0, 0, 0, 0);
    }
    const match = /^Measured (\d+)$/.exec(this.textContent?.trim() ?? '');
    const id = match ? Number(match[1]) : -1;
    measured.push(id);
    const size = sizes.get(id) ?? { width: 0, height: 0 };
    return new DOMRect(0, 0, size.width, size.height);
  });
  return { sizes, measured };
}

function noteWidth(layout: ResolvedLayout | undefined, index: number): number | undefined {
  return layout?.annotations.find((item) => item.id === `measured-${index}`)?.noteBox.width;
}

describe('ResizeObserver measures only changed DOM notes', () => {
  afterEach(() => {
    ManualResizeObserver.instances = [];
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses O(changed notes) geometry reads for one-note and batched resize notifications', async () => {
    const { sizes, measured } = installMeasurements();
    const layouts: ResolvedLayout[] = [];
    const { container, unmount } = render(
      <AnnotationLayer annotations={annotations} bounds={bounds} measure="dom"
        onLayout={(layout) => layouts.push(layout)} />
    );
    await waitFor(() => expect(noteWidth(layouts.at(-1), 13)).toBe(80));
    const observer = ManualResizeObserver.instances.at(-1)!;
    const nodes = Array.from(container.querySelectorAll('.pa-annotation-layer__measurer > div'));
    // Render order follows lexical ID paint order, not numeric fixture order.
    // Resolve changed nodes by their rendered content, not by array index.
    const nodeFor = (index: number) => nodes.find((node) => node.textContent?.trim() === `Measured ${index}`)!;
    expect(nodes).toHaveLength(48);
    expect(observer.observed.size).toBe(48);
    expect(measured.length).toBeGreaterThanOrEqual(48);

    measured.length = 0;
    sizes.set(13, { width: 116, height: 47 });
    observer.emit(nodeFor(13));
    await waitFor(() => expect(noteWidth(layouts.at(-1), 13)).toBe(116));
    expect(measured).toEqual([13]);
    expect(noteWidth(layouts.at(-1), 12)).toBe(80);

    measured.length = 0;
    sizes.set(13, { width: 121, height: 47 });
    sizes.set(36, { width: 94, height: 47 });
    observer.emit(nodeFor(13), nodeFor(36), nodeFor(13));
    await waitFor(() => expect(noteWidth(layouts.at(-1), 36)).toBe(94));
    expect(noteWidth(layouts.at(-1), 13)).toBe(121);
    expect(measured).toEqual([13, 36]);

    const layoutCount = layouts.length;
    measured.length = 0;
    observer.emit(nodeFor(36));
    expect(measured).toEqual([36]);
    expect(layouts).toHaveLength(layoutCount);

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('ignores foreign notifications and fully reconciles additions/removals', async () => {
    const { measured } = installMeasurements();
    const initial = annotations.slice(0, 6);
    const layouts: ResolvedLayout[] = [];
    const onLayout = (layout: ResolvedLayout) => layouts.push(layout);
    const { container, rerender, unmount } = render(
      <AnnotationLayer annotations={initial} bounds={bounds} measure="dom" onLayout={onLayout} />
    );
    await waitFor(() => expect(noteWidth(layouts.at(-1), 5)).toBe(80));
    const first = ManualResizeObserver.instances.at(-1)!;
    measured.length = 0;
    first.emit(document.createElement('div'));
    expect(measured).toHaveLength(0);

    rerender(<AnnotationLayer annotations={annotations.slice(0, 7)} bounds={bounds}
      measure="dom" onLayout={onLayout} />);
    await waitFor(() => expect(noteWidth(layouts.at(-1), 6)).toBe(80));
    const addedObserver = ManualResizeObserver.instances.at(-1)!;
    expect(first.disconnect).toHaveBeenCalled();
    expect(addedObserver.observed.size).toBe(7);

    rerender(<AnnotationLayer annotations={annotations.slice(0, 4)} bounds={bounds}
      measure="dom" onLayout={onLayout} />);
    await waitFor(() => expect(layouts.at(-1)?.annotations).toHaveLength(4));
    expect(container.querySelectorAll('.pa-annotation-layer__measurer > div')).toHaveLength(4);
    expect(ManualResizeObserver.instances.at(-1)?.observed.size).toBe(4);
    unmount();
  });
});
