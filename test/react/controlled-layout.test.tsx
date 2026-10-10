// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout
} from '../../src/index.js';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation, ResolvedAnnotation } from '../../src/index.js';

const bounds = { x: 0, y: 0, width: 550, height: 300 };

function fixture() {
  const annotations: Annotation[] = Array.from({ length: 8 }, (_, i) => ({
    id: `controlled-${i}`,
    priority: 8 - i,
    anchor: { type: 'point', point: { x: 20 + i * 58, y: 90 } },
    note: { title: `Controlled ${i}` },
    placement: { side: 'bottom', offset: 16 }
  }));
  const noteSizes = Object.fromEntries(annotations.map((item) => [item.id, { width: 50, height: 40 }]));
  return { annotations, bounds, noteSizes, refinement: false };
}

describe('controlled React annotation layouts', () => {
  it('uses committed incremental geometry while stable neighbors retain their React node and custom content', () => {
    const options = fixture();
    const session = createIncrementalAnnotationLayoutSession(options);
    const painted = new Map<string, number>();
    const renderNote = (item: ResolvedAnnotation) => {
      painted.set(item.id, (painted.get(item.id) ?? 0) + 1);
      return <span>{item.annotation.note.title}</span>;
    };
    const onLayout = vi.fn();
    const onQuality = vi.fn();
    const { container, rerender } = render(
      <AnnotationLayer
        {...options}
        resolvedLayout={session.layout}
        renderNote={renderNote}
        onLayout={onLayout}
        onQuality={onQuality}
      />
    );
    const firstObject = container.querySelector('g.pa-annotation[data-annotation-id="controlled-0"]');
    const lastNote = () => container.querySelector('g.pa-annotation[data-annotation-id="controlled-7"] foreignObject')!;
    const firstCounts = new Map(painted);
    const firstLayout = session.layout;

    expect(firstCounts.size).toBe(8);
    expect(onLayout).toHaveBeenCalledWith(firstLayout);
    expect(onQuality).toHaveBeenCalledWith({
      layout: firstLayout,
      quality: evaluateAnnotationLayout(firstLayout),
      summary: expect.any(String)
    });

    // Reconstructing equivalent host input must not rerun callbacks or
    // invalidate memoized React notes when the authoritative layout is stable.
    const noOp = structuredClone(options.annotations);
    const identical = session.update({ ...options, annotations: noOp });
    expect(identical).toBe(firstLayout);
    rerender(
      <AnnotationLayer
        {...options}
        annotations={noOp}
        resolvedLayout={identical}
        renderNote={renderNote}
        onLayout={onLayout}
        onQuality={onQuality}
      />
    );
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onQuality).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 8; i += 1) {
      expect(painted.get(`controlled-${i}`), `no-op ${i}`).toBe(firstCounts.get(`controlled-${i}`));
    }

    const edited = structuredClone(options.annotations);
    edited[7]!.anchor = { type: 'point', point: { x: 485, y: 165 } };
    const updated = session.update({ ...options, annotations: edited });
    expect(updated.annotations[0]).toBe(firstLayout.annotations[0]);
    expect(updated.annotations[7]).not.toBe(firstLayout.annotations[7]);
    rerender(
      <AnnotationLayer
        {...options}
        annotations={edited}
        resolvedLayout={updated}
        renderNote={renderNote}
        onLayout={onLayout}
        onQuality={onQuality}
      />
    );

    expect(container.querySelector('g.pa-annotation[data-annotation-id="controlled-0"]')).toBe(firstObject);
    expect(lastNote().getAttribute('x')).toBe(String(updated.annotations[7]!.noteBox.x));
    expect(lastNote().getAttribute('y')).toBe(String(updated.annotations[7]!.noteBox.y));
    expect(onLayout).toHaveBeenCalledTimes(2);
    expect(onLayout).toHaveBeenLastCalledWith(updated);
    expect(onQuality).toHaveBeenCalledTimes(2);
    expect(onQuality.mock.calls[1]![0].quality).toEqual(evaluateAnnotationLayout(updated));
    for (let i = 0; i < 7; i += 1) {
      expect(painted.get(`controlled-${i}`), `controlled-${i}`).toBe(firstCounts.get(`controlled-${i}`));
    }
    expect(painted.get('controlled-7')).toBeGreaterThan(firstCounts.get('controlled-7') ?? 0);
  });

  it('supports externally supplied note geometry during server rendering', () => {
    const options = fixture();
    const layout = createIncrementalAnnotationLayoutSession(options).layout;
    const controlled = {
      ...layout,
      annotations: [{
        ...layout.annotations[0]!, noteBox: { ...layout.annotations[0]!.noteBox, x: 11, y: 14 }
      }, ...layout.annotations.slice(1)]
    };
    const markup = renderToStaticMarkup(
      <AnnotationLayer {...options} resolvedLayout={controlled} />
    );
    expect(markup).toContain('x="11"');
    expect(markup).toContain('y="14"');
    expect(markup).toContain('Controlled 0');
  });

  it('rejects mismatched host bounds, annotation IDs and incompatible DOM measurement', () => {
    const options = fixture();
    const layout = createIncrementalAnnotationLayoutSession(options).layout;
    expect(() => renderToStaticMarkup(
      <AnnotationLayer {...options} bounds={{ ...bounds, width: 500 }} resolvedLayout={layout} />
    )).toThrow('bounds do not match');
    expect(() => renderToStaticMarkup(
      <AnnotationLayer {...options} annotations={[...options.annotations.slice(0, 7), {
        ...options.annotations[7]!, id: 'wrong-id'
      }]} resolvedLayout={layout} />
    )).toThrow('exactly the current host annotation IDs');
    expect(() => renderToStaticMarkup(
      <AnnotationLayer {...options} resolvedLayout={layout} measure="dom" />
    )).toThrow('requires measure="estimate"');
  });
});
