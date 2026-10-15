// @vitest-environment jsdom

import { Profiler } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import { createIncrementalAnnotationLayoutSession } from '../../src/index.js';
import type { Annotation } from '../../src/index.js';

const bounds = { x: 0, y: 0, width: 800, height: 460 };
function fixture(count = 40) {
  const annotations: Annotation[] = Array.from({ length: count }, (_, index) => ({
    id: `annotation-${index}`,
    priority: count - index,
    anchor: { type: 'point', point: { x: 20 + index * 15, y: 85 } },
    note: { title: `Note ${index}` },
    placement: { manual: { x: 35 + index * 15, y: 150, clamp: false } },
    connector: { type: 'straight', routing: 'none' }
  }));
  const noteSizes = Object.fromEntries(annotations.map((a) => [a.id, { width: 75, height: 32 }]));
  const session = createIncrementalAnnotationLayoutSession({ annotations, bounds, noteSizes, refinement: false });
  return { annotations, noteSizes, session };
}

describe('controlled React layout no-op reconciliation', () => {
  it('retains notes when the host returns the same layout and rebuilds inline presentation props', () => {
    const { annotations, noteSizes, session } = fixture(40);
    const onEdit = vi.fn();
    const onLayout = vi.fn();
    const onRender = vi.fn();
    const { container, rerender } = render(
      <Profiler id="controlled" onRender={onRender}>
        <AnnotationLayer
          layout={session.layout}
          editable={{ includeAnchor: true }}
          onEdit={onEdit} onLayout={onLayout}
          label="Stable graph"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />
      </Profiler>
    );
    const originalNote = container.querySelector('g.pa-annotation[data-annotation-id="annotation-0"]');
    const commits = onRender.mock.calls.length;
    expect(commits).toBe(1);
    expect(container.querySelectorAll('g.pa-annotation')).toHaveLength(40);
    expect(onLayout).toHaveBeenCalledTimes(1);

    const clone = structuredClone(annotations);
    expect(session.update({ annotations: clone, bounds, noteSizes, refinement: false })).toBe(session.layout);
    rerender(
      <Profiler id="controlled" onRender={onRender}>
        <AnnotationLayer
          layout={session.layout}
          editable={{ includeAnchor: true }}
          onEdit={onEdit} onLayout={onLayout}
          label="Stable graph"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />
      </Profiler>
    );

    expect(container.querySelector('g.pa-annotation[data-annotation-id="annotation-0"]')).toBe(originalNote);
    expect(container.querySelectorAll('g.pa-annotation')).toHaveLength(40);
    expect(onLayout).toHaveBeenCalledTimes(1);
    // A bailout may still be recorded by the surrounding Profiler as a
    // zero-cost commit; no timing assertion is imposed on shared CI runners.
    expect(onRender.mock.calls.length).toBeGreaterThanOrEqual(commits);
  });

  it('does not hide changed host callbacks, labels, editing options or debugging', () => {
    const { session } = fixture(2);
    const firstHandler = vi.fn();
    const newHandler = vi.fn();
    const nextLayoutCallback = vi.fn();
    const { container, rerender } = render(
      <AnnotationLayer
        layout={session.layout} editable={{ includeAnchor: true, radius: 4 }}
        onEditStart={firstHandler} label="Original" />
    );
    expect(container.querySelector('svg.pa-annotation-layer')?.getAttribute('aria-label')).toBe('Original');
    const oldHandle = container.querySelector('.pa-annotation__edit-handle--note');
    expect(oldHandle?.getAttribute('r')).toBe('4');

    rerender(
      <AnnotationLayer layout={session.layout}
        editable={{ includeAnchor: true, radius: 9 }}
        onEditStart={newHandler} onLayout={nextLayoutCallback}
        label="Updated" qualityDebug style={{ opacity: 0.65 }} />
    );
    expect(container.querySelector('svg.pa-annotation-layer')?.getAttribute('aria-label')).toBe('Updated');
    expect(container.querySelector('.pa-annotation-layer-wrap')?.getAttribute('style')).toContain('opacity: 0.65');
    expect(container.querySelector('.pa-annotation__edit-handle--note')?.getAttribute('r')).toBe('9');
    expect(nextLayoutCallback).toHaveBeenCalledWith(session.layout);
    expect(firstHandler).not.toHaveBeenCalled();
    expect(newHandler).not.toHaveBeenCalled();
    fireEvent.pointerDown(container.querySelector('.pa-annotation__edit-handle--note')!, {
      pointerId: 1, clientX: 60, clientY: 185
    });
    expect(newHandler).toHaveBeenCalledTimes(1);
    expect(firstHandler).not.toHaveBeenCalled();
  });

  it('derives target-alignment reports from source annotations in the new layout', () => {
    const { annotations, noteSizes, session } = fixture(2);
    const target = [{ id: 'annotation-0', point: { x: 20, y: 85 } }];
    const onTargetAlignment = vi.fn();
    const { rerender } = render(
      <AnnotationLayer layout={session.layout} targetAlignmentTargets={target} onTargetAlignment={onTargetAlignment} />
    );
    expect(onTargetAlignment).toHaveBeenCalledTimes(1);
    expect(onTargetAlignment.mock.calls[0]![0].targetAlignment.aligned).toContain('annotation-0');

    const changed = structuredClone(annotations);
    changed[0]!.anchor = { type: 'point', point: { x: 170, y: 85 } };
    const updated = session.update({ annotations: changed, bounds, noteSizes, refinement: false });
    rerender(
      <AnnotationLayer layout={updated} targetAlignmentTargets={target} onTargetAlignment={onTargetAlignment} />
    );
    expect(onTargetAlignment).toHaveBeenCalledTimes(2);
    expect(onTargetAlignment.mock.calls[1]![0].targetAlignment.aligned).not.toContain('annotation-0');
  });

  it('updates presentation and SVG bounds from the current authoritative layout', () => {
    const { session } = fixture(2);
    const { container, rerender } = render(
      <AnnotationLayer layout={session.layout} style={{ opacity: 0.25 }} />
    );
    expect(container.querySelector('.pa-annotation-layer-wrap')?.getAttribute('style'))
      .toContain('opacity: 0.25');
    const updated = { ...session.layout, bounds: { x: 10, y: 20, width: 900, height: 500 } };
    rerender(<AnnotationLayer layout={updated} style={{ opacity: 0.75 }} />);
    expect(container.querySelector('.pa-annotation-layer-wrap')?.getAttribute('style'))
      .toContain('opacity: 0.75');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('10 20 900 500');
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('900');
  });
});
