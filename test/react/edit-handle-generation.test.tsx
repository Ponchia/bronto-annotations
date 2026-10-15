// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIncrementalAnnotationLayoutSession } from '../../src/index.js';
import { annotationEditHandles } from '../../src/core/edit.js';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation } from '../../src/index.js';

vi.mock('../../src/core/edit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/edit.js')>();
  return { ...actual, annotationEditHandles: vi.fn(actual.annotationEditHandles) };
});

const bounds = { x: 0, y: 0, width: 1160, height: 420 };
const annotations: Annotation[] = Array.from({ length: 32 }, (_, index) => ({
  id: `annotation-${index}`,
  priority: 32 - index,
  anchor: { type: 'point', point: { x: 20 + index * 28, y: 100 } },
  note: { title: `Current ${index}` },
  placement: { manual: { x: 40 + index * 28, y: 150, clamp: false } }
}));
const noteSizes = Object.fromEntries(annotations.map((a) => [a.id, { width: 72, height: 35 }]));
const options = { annotations, bounds, noteSizes, refinement: false };

beforeEach(() => { vi.mocked(annotationEditHandles).mockClear(); });

describe('incremental React edit-handle generation', () => {
  it('generates handles only for changed winners, retaining exact stable handles and DOM', () => {
    const session = createIncrementalAnnotationLayoutSession(options);
    const onEditStart = vi.fn();
    const { container, rerender } = render(
      <AnnotationLayer layout={session.layout}
        editable={{ includeAnchor: true }} onEditStart={onEditStart} />
    );
    expect(vi.mocked(annotationEditHandles)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(annotationEditHandles).mock.calls[0]![0].annotations).toHaveLength(32);
    expect(container.querySelectorAll('.pa-annotation__edit-handle--note')).toHaveLength(32);
    expect(container.querySelectorAll('.pa-annotation__edit-handle--anchor')).toHaveLength(32);
    const first = container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="annotation-0"]');
    const last = container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="annotation-31"]');

    const edited = structuredClone(annotations);
    edited[31]!.note.title = 'Latest changed note';
    const updated = session.update({ ...options, annotations: edited });
    rerender(
      <AnnotationLayer layout={updated}
        editable={{ includeAnchor: true }} onEditStart={onEditStart} />
    );
    expect(vi.mocked(annotationEditHandles)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(annotationEditHandles).mock.calls[1]![0].annotations.map((a) => a.id))
      .toEqual(['annotation-31']);
    expect(container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="annotation-0"]')).toBe(first);
    expect(container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="annotation-31"]')).toBe(last);
    expect(last?.getAttribute('aria-label')).toContain('Latest changed note');
    expect(container.querySelectorAll('.pa-annotation__edit-handle--note')).toHaveLength(32);
    expect(container.querySelectorAll('.pa-annotation__edit-handle--anchor')).toHaveLength(32);
    fireEvent.keyDown(first!, { key: 'ArrowRight' });
    expect(onEditStart).toHaveBeenCalledTimes(1);
    expect(onEditStart.mock.calls[0]![0].annotationId).toBe('annotation-0');

    const noOp = structuredClone(edited);
    const stable = session.update({ ...options, annotations: noOp });
    expect(stable).toBe(updated);
    rerender(
      <AnnotationLayer layout={stable}
        editable={{ includeAnchor: true }} onEditStart={onEditStart} />
    );
    expect(vi.mocked(annotationEditHandles)).toHaveBeenCalledTimes(2);

    // Option changes regenerate all handles so hit areas and labels remain correct.
    rerender(
      <AnnotationLayer layout={stable}
        editable={{ includeAnchor: true, noteHandlePosition: 'bottom-left', radius: 9 }} />
    );
    expect(vi.mocked(annotationEditHandles)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(annotationEditHandles).mock.calls[2]![0].annotations).toHaveLength(32);
    expect(container.querySelector('.pa-annotation__edit-handle--note')?.getAttribute('r')).toBe('9');
  });
});
