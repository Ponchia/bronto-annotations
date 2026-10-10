// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnotationLayer } from '../../src/react/index.js';
import { createIncrementalAnnotationLayoutSession } from '../../src/index.js';
import { evaluateAnnotationLayout } from '../../src/core/quality.js';
import type { Annotation } from '../../src/index.js';

vi.mock('../../src/core/quality.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/quality.js')>();
  return {
    ...original,
    evaluateAnnotationLayout: vi.fn(original.evaluateAnnotationLayout)
  };
});

const bounds = { x: 0, y: 0, width: 560, height: 320 };
const annotations: Annotation[] = [
  { id: 'first', anchor: { type: 'point', point: { x: 65, y: 90 } },
    note: { title: 'First' }, priority: 2,
    connector: { type: 'straight', routing: 'none' },
    placement: { manual: { x: 160, y: 150 } } },
  { id: 'second', anchor: { type: 'point', point: { x: 245, y: 125 } },
    note: { title: 'Second' }, priority: 1,
    connector: { type: 'straight', routing: 'none' },
    placement: { manual: { x: 180, y: 166 } } }
];
const noteSizes = {
  first: { width: 115, height: 60 },
  second: { width: 105, height: 56 }
};

beforeEach(() => {
  vi.mocked(evaluateAnnotationLayout).mockClear();
});

describe('React quality diagnostics are demand-driven', () => {
  it('skips the quadratic quality pass for passive host-controlled layouts', () => {
    const opts = { annotations, bounds, noteSizes, refinement: false };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const onLayout = vi.fn();
    const { container, rerender } = render(
      <AnnotationLayer {...opts} resolvedLayout={session.layout} onLayout={onLayout} />
    );
    expect(evaluateAnnotationLayout).not.toHaveBeenCalled();
    expect(onLayout).toHaveBeenCalledTimes(1);

    const next = structuredClone(annotations);
    next[1]!.anchor = { type: 'point', point: { x: 305, y: 171 } };
    const updated = session.update({ ...opts, annotations: next });
    rerender(
      <AnnotationLayer {...opts} annotations={next} resolvedLayout={updated} onLayout={onLayout} />
    );
    expect(evaluateAnnotationLayout).not.toHaveBeenCalled();
    expect(onLayout).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll('g.pa-annotation')).toHaveLength(2);
  });

  it('does not emit duplicate onLayout notifications when diagnostic inputs change', () => {
    const opts = { annotations, bounds, noteSizes };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const onLayout = vi.fn();
    const onQuality = vi.fn();
    const { rerender } = render(
      <AnnotationLayer {...opts} resolvedLayout={session.layout} onLayout={onLayout} />
    );
    expect(onLayout).toHaveBeenCalledTimes(1);
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} onLayout={onLayout} qualityDebug />);
    expect(onLayout).toHaveBeenCalledTimes(1);
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} onLayout={onLayout}
      qualityDebug onQuality={onQuality} />);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onQuality).toHaveBeenCalledTimes(1);
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} onLayout={onLayout}
      onQuality={onQuality} qualityFormat={{ label: 'Custom quality heading' }} />);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onQuality).toHaveBeenCalledTimes(2);
    expect(onQuality.mock.calls[1]![0].summary).toContain('Custom quality heading');
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} onLayout={onLayout} />);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onQuality).toHaveBeenCalledTimes(2);
  });

  it('provides unchanged report semantics for requested onQuality callbacks', () => {
    const opts = { annotations, bounds, noteSizes };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const onQuality = vi.fn();
    const { rerender } = render(
      <AnnotationLayer {...opts} resolvedLayout={session.layout} onQuality={onQuality} />
    );
    expect(evaluateAnnotationLayout).toHaveBeenCalledTimes(1);
    expect(onQuality).toHaveBeenCalledTimes(1);
    expect(onQuality.mock.calls[0]![0].layout).toBe(session.layout);
    expect(onQuality.mock.calls[0]![0].quality.metrics.annotationCount).toBe(2);
    expect(onQuality.mock.calls[0]![0].quality.metrics.noteOverlapArea).toBeGreaterThan(0);
    expect(onQuality.mock.calls[0]![0].summary).toContain('Annotation');

    // Changing output formatting must not recalculate the same geometry.
    rerender(
      <AnnotationLayer {...opts} resolvedLayout={session.layout} onQuality={onQuality}
        qualityFormat={{ label: 'Changed label', maxIssues: 3 }} />
    );
    expect(evaluateAnnotationLayout).toHaveBeenCalledTimes(1);
    expect(onQuality).toHaveBeenCalledTimes(2);
    expect(onQuality.mock.calls[1]![0].summary).toContain('Changed label');
  });

  it('honors assertions and visual debugging when no callback is registered', () => {
    const opts = {
      annotations: [annotations[0]!, {
        ...annotations[1]!, placement: { manual: { x: 325, y: 205 } }
      }],
      bounds, noteSizes,
      obstacles: [{ x: 170, y: 163, width: 30, height: 25 }]
    };
    const session = createIncrementalAnnotationLayoutSession(opts);
    const { container, rerender } = render(
      <AnnotationLayer {...opts} resolvedLayout={session.layout} />
    );
    expect(evaluateAnnotationLayout).not.toHaveBeenCalled();

    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} assertQuality={{ minScore: 0 }} />);
    expect(evaluateAnnotationLayout).toHaveBeenCalledTimes(1);
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} qualityDebug />);
    // The report is identical: enabling the visual overlay consumes the
    // existing memoized report instead of recomputing a second time.
    expect(evaluateAnnotationLayout).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.pa-annotation__quality-issue').length).toBeGreaterThan(0);
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} />);
    rerender(<AnnotationLayer {...opts} resolvedLayout={session.layout} qualityDebug />);
    expect(evaluateAnnotationLayout).toHaveBeenCalledTimes(2);

    // SSR and usual consumers do not need the report just to render notes.
    vi.mocked(evaluateAnnotationLayout).mockClear();
    const markup = renderToStaticMarkup(<AnnotationLayer {...opts} resolvedLayout={session.layout} />);
    expect(markup).toContain('First');
    expect(evaluateAnnotationLayout).not.toHaveBeenCalled();
  });
});
