// @vitest-environment jsdom

import { fireEvent, render, renderHook } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { estimateNoteSize, resolveAnnotationLayout } from '../../src/core/layout-resolver.js';
import { AnnotationLayer, useAnnotations } from '../../src/react/index.js';
import type { LayoutOptions } from '../../src/core/model.js';

vi.mock('../../src/core/layout-resolver.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/layout-resolver.js')>();
  return {
    ...actual,
    estimateNoteSize: vi.fn(actual.estimateNoteSize),
    resolveAnnotationLayout: vi.fn(actual.resolveAnnotationLayout)
  };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(): LayoutOptions {
  return {
    annotations: ['__proto__', 'constructor'].map((id, i) => ({
      id,
      anchor: { type: 'point', point: { x: 60 + i * 160, y: 60 } },
      note: { title: id },
      placement: { side: ['right', 'bottom'], offset: [12, 24] }
    })),
    bounds: { x: 10, y: 20, width: 400, height: 260 },
    defaultNoteSize: { width: 60, height: 32 },
    refinement: false
  };
}

describe('single-source React rendering and diagnostics', () => {
  it('never solves, estimates or DOM-measures a render-only layout, including debug and edits', () => {
    const options = fixture();
    const layout = resolveAnnotationLayout(options);
    vi.mocked(resolveAnnotationLayout).mockClear();
    vi.mocked(estimateNoteSize).mockClear();
    const observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = vi.fn(); });
    const readBox = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const onLayout = vi.fn();
    const onEditEnd = vi.fn();
    const { container, rerender } = render(
      <AnnotationLayer layout={layout} editable previewEdits onLayout={onLayout} onEditEnd={onEditEnd} />
    );
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('10 20 400 260');
    rerender(<AnnotationLayer layout={layout} editable previewEdits debug qualityDebug
      onLayout={onLayout} onEditEnd={onEditEnd} />);
    expect(container.querySelectorAll('[data-debug-kind="winner"]')).toHaveLength(2);
    expect(container.querySelector('[data-debug-kind="candidate"]')).toBeNull();
    fireEvent.keyDown(container.querySelector('.pa-annotation__edit-handle--note')!, { key: 'ArrowRight' });
    expect(onEditEnd).toHaveBeenCalledTimes(1);
    const handle = container.querySelector('.pa-annotation__edit-handle--note')!;
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(handle, { pointerId: 3, clientX: 80, clientY: 70 });
    fireEvent.pointerMove(svg, { pointerId: 3, clientX: 90, clientY: 75 });
    fireEvent.pointerUp(svg, { pointerId: 3, clientX: 90, clientY: 75 });
    expect(onEditEnd).toHaveBeenCalledTimes(2);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.pa-annotation-layer__measurer')).toBeNull();
    expect(observe).not.toHaveBeenCalled();
    expect(readBox).not.toHaveBeenCalled();
    expect(estimateNoteSize).not.toHaveBeenCalled();
    expect(resolveAnnotationLayout).not.toHaveBeenCalled();
    renderToStaticMarkup(<AnnotationLayer layout={layout} debug />);
    expect(resolveAnnotationLayout).not.toHaveBeenCalled();
  });

  it('draws only supplied candidates by annotation ID and always draws the final winner', () => {
    const options = fixture();
    const layout = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 2 } });
    // Diagnostic entries need not share paint order, and special IDs are safe.
    const supplied = { ...layout, diagnostics: { annotations: [...layout.diagnostics!.annotations].reverse() } };
    vi.mocked(resolveAnnotationLayout).mockClear();
    const { container, rerender } = render(<AnnotationLayer layout={supplied} debug />);
    for (const item of layout.annotations) {
      const group = [...container.querySelectorAll('g.pa-annotation')]
        .find((element) => element.getAttribute('data-annotation-id') === item.id)!;
      const candidates = layout.diagnostics!.annotations.find((entry) => entry.id === item.id)!.candidates;
      expect(group.querySelectorAll('[data-debug-kind="candidate"]')).toHaveLength(candidates.length);
      expect(group.querySelector('[data-debug-kind="candidate"]')?.getAttribute('x')).toBe(String(candidates[0]!.noteBox.x));
      expect(group.querySelector('[data-debug-kind="winner"]')?.getAttribute('x')).toBe(String(item.noteBox.x));
    }
    const { diagnostics: _diagnostics, ...lean } = layout;
    rerender(<AnnotationLayer layout={lean} debug />);
    expect(container.querySelector('[data-debug-kind="candidate"]')).toBeNull();
    expect(resolveAnnotationLayout).not.toHaveBeenCalled();
  });

  it('input debug requests 8 candidates unless the caller supplies diagnostics', () => {
    const options = fixture();
    const onLayout = vi.fn();
    vi.mocked(resolveAnnotationLayout).mockClear();
    const { container, rerender } = render(<AnnotationLayer {...options} debug onLayout={onLayout} />);
    expect(vi.mocked(resolveAnnotationLayout).mock.calls[0]![0].diagnostics).toEqual({ candidates: 8 });
    expect(container.querySelector('[data-debug-kind="candidate"]')).not.toBeNull();
    rerender(<AnnotationLayer {...options} debug diagnostics={{ candidates: 1 }} onLayout={onLayout} />);
    expect(vi.mocked(resolveAnnotationLayout).mock.calls.at(-1)![0].diagnostics).toEqual({ candidates: 1 });
    expect(container.querySelectorAll('[data-debug-kind="candidate"]')).toHaveLength(2);
    rerender(<AnnotationLayer {...options} onLayout={onLayout} />);
    expect(vi.mocked(resolveAnnotationLayout).mock.calls.at(-1)![0]).not.toHaveProperty('diagnostics');
    expect(onLayout.mock.calls.at(-1)![0]).not.toHaveProperty('diagnostics');
  });

  it('invalidates useAnnotations when diagnostics change and returns lean results when disabled', () => {
    const options = fixture();
    const { result, rerender } = renderHook((props: LayoutOptions) => useAnnotations(props), { initialProps: options });
    expect(result.current).not.toHaveProperty('diagnostics');
    const winners = result.current.annotations;
    rerender({ ...options, diagnostics: { candidates: 1 } });
    expect(result.current.diagnostics!.annotations.map((item) => item.candidates.length)).toEqual([1, 1]);
    expect(result.current.annotations).toEqual(winners);
    rerender({ ...options, diagnostics: { candidates: 'all' } });
    expect(result.current.diagnostics!.annotations[0]!.candidates.length).toBeGreaterThan(1);
    rerender(options);
    expect(result.current).not.toHaveProperty('diagnostics');
  });
});
