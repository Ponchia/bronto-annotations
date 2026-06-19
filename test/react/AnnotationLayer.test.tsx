// @vitest-environment jsdom

import {
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';
import { AnnotationLayer, useAnnotations } from '../../src/react/index.js';
import {
  annotationFromD3Style,
  evaluateAnnotationLayout,
  generatedSurfaceLayoutDefaults
} from '../../src/index.js';
import type { Annotation, ResolvedLayout } from '../../src/index.js';
import type {
  AnnotationLayerEditEvent,
  AnnotationLayerQualityEvent,
  AnnotationLayerTargetAlignmentEvent
} from '../../src/react/index.js';

const annotations: Annotation[] = [
  {
    id: 'revenue',
    anchor: { type: 'point', point: { x: 160, y: 120 } },
    note: { title: 'Revenue', body: 'Highest observed point.' }
  }
];

describe('React adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders an annotation layer with note content', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        noteTabIndex={0}
      />
    );

    expect(screen.getByRole('img', { name: 'Annotation layer' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Revenue' })).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(document.querySelector('.pa-annotation__connector')).toBeTruthy();
    expect(container.querySelector('.pa-annotation__subject')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.pa-annotation__connector')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.pa-annotation__note-box')?.getAttribute('role')).toBe('note');
    expect(container.querySelector('.pa-annotation__note-box')?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('.pa-annotation__note-box')?.getAttribute('data-annotation-id')).toBe('revenue');
  });

  it('renders on the server without DOM measurement globals', () => {
    const markup = renderToStaticMarkup(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        label="SSR annotation layer"
        preserveAspectRatio="xMinYMin meet"
      />
    );

    expect(markup).toContain('SSR annotation layer');
    expect(markup).toContain('preserveAspectRatio="xMinYMin meet"');
    expect(markup).toContain('pa-annotation__connector');
    expect(markup).toContain('Revenue');
  });

  it('can scope connector marker ids in server-rendered React output', () => {
    const markup = renderToStaticMarkup(
      <AnnotationLayer
        annotations={[
          {
            ...annotations[0]!,
            connector: { end: 'arrow' }
          }
        ]}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        markerIdPrefix="react-layer-a"
      />
    );

    expect(markup).toContain('id="react-layer-a-marker-arrow"');
    expect(markup).toContain('marker-end="url(#react-layer-a-marker-arrow)"');
    expect(markup).not.toContain('id="pa-annotation-marker-arrow"');
  });

  it('renders custom subject paths in React output', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'timeline',
            anchor: { type: 'point', point: { x: 80, y: 80 } },
            note: { title: 'Timeline' },
            subject: {
              path: 'M80,80L86,92H74Z',
              data: { subjectKind: 'timeline' }
            },
            variant: 'timeline'
          }
        ]}
        bounds={{ x: 0, y: 0, width: 220, height: 160 }}
      />
    );

    const path = container.querySelector('path.pa-annotation__subject--path');

    expect(path).toBeTruthy();
    expect(path?.getAttribute('d')).toBe('M80,80L86,92H74Z');
    expect(path?.getAttribute('data-subject-kind')).toBe('timeline');
  });

  it('renders structured subject geometry in React output', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'bracket',
            anchor: { type: 'point', point: { x: 100, y: 72 } },
            note: { title: 'Bracket' },
            subject: {
              geometry: { type: 'bracket', x1: -24, y1: 0, x2: 24, y2: 0, depth: 8 },
              data: { subjectKind: 'structured-bracket' }
            },
            variant: 'bracket'
          },
          {
            id: 'encircle',
            anchor: { type: 'point', point: { x: 40, y: 40 } },
            note: { title: 'Encircle' },
            subject: {
              geometry: { type: 'encircle', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], radius: 2, padding: 3 },
              geometrySpace: 'absolute',
              data: { subjectKind: 'encircle' }
            },
            variant: 'cluster'
          }
        ]}
        bounds={{ x: 0, y: 0, width: 220, height: 160 }}
      />
    );

    const path = container.querySelector('path.pa-annotation__subject--geometry');

    expect(path).toBeTruthy();
    expect(path?.getAttribute('d')).toBe('M-24,0V8H24V0');
    expect(path?.getAttribute('transform')).toBe('translate(100 72)');
    expect(path?.getAttribute('data-subject-kind')).toBe('structured-bracket');
    const encircle = container.querySelector('path.pa-annotation__subject--geometry-encircle');

    expect(encircle).toBeTruthy();
    expect(encircle?.getAttribute('d')).toBe('M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z');
    expect(encircle?.getAttribute('transform')).toBeNull();
    expect(encircle?.getAttribute('data-subject-kind')).toBe('encircle');
  });

  it('renders note alignment classes and metadata in React output', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'aligned',
            anchor: { type: 'point', point: { x: 120, y: 90 } },
            note: {
              title: 'Aligned',
              body: 'Right aligned note.',
              align: 'end'
            }
          }
        ]}
        bounds={{ x: 0, y: 0, width: 280, height: 180 }}
        measure="dom"
      />
    );

    const note = container.querySelector('foreignObject.pa-annotation__note--align-end');
    const noteBox = container.querySelector('.pa-annotation__note-box--align-end');
    const measuredNoteBox = container.querySelector('.pa-annotation-layer__measurer .pa-annotation__note-box--align-end');

    expect(note?.getAttribute('data-note-align')).toBe('end');
    expect(noteBox?.getAttribute('data-note-align')).toBe('end');
    expect(measuredNoteBox?.getAttribute('data-note-align')).toBe('end');
  });

  it('applies per-annotation CSS variable style overrides in React output', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'colored',
            anchor: { type: 'point', point: { x: 120, y: 90 } },
            note: { title: 'Colored' },
            style: {
              color: '#d12f6a',
              lineColor: '#7c2d12',
              vars: {
                '--custom-annotation-token': 'demo'
              }
            }
          }
        ]}
        bounds={{ x: 0, y: 0, width: 280, height: 180 }}
      />
    );

    const group = container.querySelector('[data-annotation-id="colored"]') as SVGGElement | null;

    expect(group?.style.getPropertyValue('--pa-annotation-accent')).toBe('#d12f6a');
    expect(group?.style.getPropertyValue('--annotation-color')).toBe('#d12f6a');
    expect(group?.style.getPropertyValue('--pa-annotation-line')).toBe('#7c2d12');
    expect(group?.style.getPropertyValue('--custom-annotation-token')).toBe('demo');
  });

  it('renders lower-priority annotations before higher-priority annotations for SVG stacking', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'low',
            priority: 1,
            anchor: { type: 'point', point: { x: 60, y: 60 } },
            note: { title: 'Low priority' },
            placement: { manual: { x: 108, y: 32, side: 'right' } }
          },
          {
            id: 'high',
            priority: 10,
            anchor: { type: 'point', point: { x: 64, y: 64 } },
            note: { title: 'High priority' },
            placement: { manual: { x: 112, y: 36, side: 'right' } }
          }
        ]}
        bounds={{ x: 0, y: 0, width: 300, height: 200 }}
        editable
        noteSizes={{
          high: { width: 120, height: 56 },
          low: { width: 120, height: 56 }
        }}
      />
    );
    const groups = Array.from(container.querySelectorAll('svg > g.pa-annotation[data-annotation-id]'))
      .map((group) => group.getAttribute('data-annotation-id'));
    const handles = Array.from(container.querySelectorAll('.pa-annotation__edit-handle--note'))
      .map((handle) => handle.getAttribute('data-annotation-id'));

    expect(groups).toEqual(['low', 'high']);
    expect(handles).toEqual(['low', 'high']);
  });

  it('renders Bronto-style note lines and label aliases in the default React note', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'lined',
            anchor: { type: 'point', point: { x: 120, y: 90 } },
            note: {
              title: 'Lined',
              body: 'Label text',
              line: {
                length: 84,
                data: { lineKind: 'rule' }
              }
            }
          }
        ]}
        bounds={{ x: 0, y: 0, width: 280, height: 180 }}
      />
    );

    const line = container.querySelector('.pa-annotation__note-line');
    const label = container.querySelector('.pa-annotation__body.pa-annotation__label');

    expect(line?.getAttribute('data-note-line')).toBe('true');
    expect(line?.getAttribute('data-note-line-orientation')).toBe('horizontal');
    expect(line?.getAttribute('data-line-kind')).toBe('rule');
    expect((line as HTMLElement | null)?.style.inlineSize).toBe('84px');
    expect(label?.textContent).toBe('Label text');
  });

  it('renders vertical note lines in the default React note', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'vertical-line',
            anchor: { type: 'point', point: { x: 120, y: 90 } },
            note: {
              title: 'Vertical',
              line: {
                orientation: 'vertical',
                length: 48
              }
            }
          }
        ]}
        bounds={{ x: 0, y: 0, width: 280, height: 180 }}
      />
    );

    const line = container.querySelector('.pa-annotation__note-line--vertical');

    expect(line?.getAttribute('data-note-line')).toBe('true');
    expect(line?.getAttribute('data-note-line-orientation')).toBe('vertical');
    expect((line as HTMLElement | null)?.style.blockSize).toBe('48px');
  });

  it('renders compact badge markers without a note foreignObject when notes are hidden', () => {
    const { container } = render(
      <AnnotationLayer
        annotations={[
          {
            id: 'badge-only',
            anchor: { type: 'point', point: { x: 120, y: 90 } },
            note: { title: '3', ariaLabel: 'Third event', visible: false },
            subject: {
              shape: 'circle',
              badge: {
                label: '3',
                radius: 10,
                x: 'left',
                y: 'bottom',
                data: { badgeKind: 'step' }
              }
            },
            variant: 'badge'
          }
        ]}
        bounds={{ x: 0, y: 0, width: 280, height: 180 }}
        measure="dom"
      />
    );

    const badge = container.querySelector('.pa-annotation__badge');
    const pointer = container.querySelector('.pa-annotation__badge-pointer');
    const label = container.querySelector('.pa-annotation__badge-label.pa-annotation__title');

    expect(badge?.getAttribute('data-badge-kind')).toBe('step');
    expect(badge?.getAttribute('data-badge-x')).toBe('left');
    expect(badge?.getAttribute('data-badge-y')).toBe('bottom');
    expect(pointer?.getAttribute('d')).toBe('M120,90L110,90L120,100Z');
    expect(badge?.getAttribute('cx')).toBe('110');
    expect(badge?.getAttribute('cy')).toBe('100');
    expect(label?.textContent).toBe('3');
    expect(container.querySelector('foreignObject.pa-annotation__note')).toBeNull();
    expect(container.querySelector('.pa-annotation-layer__measurer .pa-annotation__note-box')).toBeNull();
  });

  it('preserves d3-style badge subject hooks in React output', () => {
    const d3Badge = annotationFromD3Style({
      id: 'legacy-badge',
      type: 'annotationBadge',
      x: 160,
      y: 90,
      subject: {
        text: '1',
        radius: 11,
        x: 'right',
        y: 'top',
        className: 'legacy-badge-subject',
        data: { step: 'one' }
      }
    });

    const { container } = render(
      <AnnotationLayer
        annotations={[d3Badge]}
        bounds={{ x: 0, y: 0, width: 280, height: 180 }}
        measure="dom"
      />
    );

    const badge = container.querySelector('.pa-annotation__badge.legacy-badge-subject');
    const pointer = container.querySelector('.pa-annotation__badge-pointer');
    const label = container.querySelector('.pa-annotation__badge-label.pa-annotation__title');

    expect(badge).toBeTruthy();
    expect(badge?.getAttribute('data-step')).toBe('one');
    expect(badge?.getAttribute('data-badge-x')).toBe('right');
    expect(badge?.getAttribute('data-badge-y')).toBe('top');
    expect(pointer?.getAttribute('data-step')).toBe('one');
    expect(label?.textContent).toBe('1');
    expect(container.querySelector('foreignObject.pa-annotation__note')).toBeNull();
  });

  it('keeps useAnnotations on the same core layout path', () => {
    function Probe() {
      const layout = useAnnotations({
        annotations,
        bounds: { x: 0, y: 0, width: 320, height: 220 }
      });

      return <output>{layout.annotations[0]?.id}</output>;
    }

    render(<Probe />);

    expect(screen.getByText('revenue')).toBeTruthy();
  });

  it('passes bounded layout refinement through the React adapter', () => {
    const crowded: Annotation[] = [
      {
        id: 'important',
        priority: 2,
        anchor: { type: 'point', point: { x: 123, y: 107 } },
        note: { title: 'Important' },
        placement: { side: ['right', 'bottom', 'top', 'left'] }
      },
      {
        id: 'supporting',
        priority: 1,
        anchor: { type: 'point', point: { x: 201, y: 98 } },
        note: { title: 'Supporting' },
        placement: { side: ['right', 'bottom', 'top', 'left'] }
      }
    ];
    const layouts: ResolvedLayout[] = [];

    render(
      <AnnotationLayer
        annotations={crowded}
        bounds={{ x: 0, y: 0, width: 300, height: 220 }}
        noteSizes={{
          important: { width: 110, height: 60 },
          supporting: { width: 110, height: 60 }
        }}
        refinement
        onLayout={(layout) => layouts.push(layout)}
      />
    );

    const report = evaluateAnnotationLayout(layouts.at(-1)!);

    expect(report.metrics.noteOverlapArea).toBe(0);
    expect(layouts.at(-1)?.annotations.map((item) => item.placement.side)).toEqual(['right', 'top']);
  });

  it('reports and asserts layout quality through the React adapter', () => {
    const defaults = generatedSurfaceLayoutDefaults({
      includeInfo: true,
      layoutLabel: 'React quality annotations'
    });
    const qualityEvents: AnnotationLayerQualityEvent[] = [];
    const layouts: ResolvedLayout[] = [];

    render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        assertQuality={defaults.assertQuality}
        noteSizes={{ revenue: { width: 120, height: 52 } }}
        onLayout={(layout) => layouts.push(layout)}
        onQuality={(event) => qualityEvents.push(event)}
        qualityFormat={defaults.qualityFormat}
      />
    );

    expect(qualityEvents).toHaveLength(1);
    expect(qualityEvents[0]?.quality.ok).toBe(true);
    expect(qualityEvents[0]?.summary).toContain('React quality annotations: ok');
    expect(qualityEvents[0]?.layout).toBe(layouts[0]);
  });

  it('reports and asserts target alignment through the React adapter', () => {
    const targetAlignmentEvents: AnnotationLayerTargetAlignmentEvent[] = [];

    render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        assertTargetAlignment={{
          label: 'React target alignment',
          failOnWarnings: true
        }}
        targetAlignmentTargets={[{
          id: 'revenue',
          expected: 'rendered revenue target',
          point: { x: 160, y: 120 }
        }]}
        targetAlignmentFormat={{
          label: 'React target alignment',
          includeAligned: true
        }}
        targetAlignmentOptions={{ tolerance: 0.5 }}
        onTargetAlignment={(event) => targetAlignmentEvents.push(event)}
      />
    );

    expect(targetAlignmentEvents).toHaveLength(1);
    expect(targetAlignmentEvents[0]?.targetAlignment.ok).toBe(true);
    expect(targetAlignmentEvents[0]?.summary).toContain('React target alignment: ok');
    expect(targetAlignmentEvents[0]?.summary).toContain('revenue: aligned rendered revenue target');
    expect(targetAlignmentEvents[0]?.layout.annotations[0]?.id).toBe('revenue');
  });

  it('supports renderNote, onLayout, debug boxes, and DOM measurement with ResizeObserver', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();

    vi.stubGlobal('ResizeObserver', class {
      observe = observe;
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
      if (this.classList.contains('pa-annotation__note-box')) {
        return rect(0, 0, 244, 92);
      }

      return rect(0, 0, 0, 0);
    });

    const layouts: ResolvedLayout[] = [];
    const { unmount } = render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        debug
        measure="dom"
        onLayout={(layout) => layouts.push(layout)}
        renderNote={(item) => <span>Custom note for {item.id}</span>}
      />
    );

    expect(screen.getAllByText('Custom note for revenue').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('.pa-annotation__debug-box--winner')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.pa-annotation__debug-box--candidate')).toBeTruthy();
    expect(document.querySelector('.pa-annotation__debug-box--candidate')?.getAttribute('data-candidate-score')).toBeTruthy();

    await waitFor(() => {
      expect(layouts.at(-1)?.annotations[0]?.noteBox.width).toBe(244);
      expect(layouts.at(-1)?.annotations[0]?.noteBox.height).toBe(92);
    });
    expect(observe).toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('emits editable note handles with suggested manual placement while dragging', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 320, 220));

    const editEvents: AnnotationLayerEditEvent[] = [];
    const layouts: ResolvedLayout[] = [];
    const { container } = render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        editable
        noteSizes={{ revenue: { width: 120, height: 52 } }}
        onEdit={(event) => editEvents.push(event)}
        onLayout={(layout) => layouts.push(layout)}
      />
    );

    const handle = container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="revenue"]');
    const layer = handle?.closest('svg');
    const initialNoteBox = layouts.at(-1)?.annotations[0]?.noteBox;
    expect(handle).toBeTruthy();
    expect(initialNoteBox).toBeTruthy();
    expect(layer).toBeTruthy();

    pointer(handle!, 'pointerdown', { clientX: 160, clientY: 80, pointerId: 1 });
    pointer(layer!, 'pointermove', { clientX: 184, clientY: 94, pointerId: 1 });
    pointer(layer!, 'pointerup', { clientX: 184, clientY: 94, pointerId: 1 });

    expect(editEvents.map((event) => event.phase)).toEqual(['start', 'move', 'end']);
    expect(editEvents[1]?.delta).toEqual({ x: 24, y: 14 });
    expect(editEvents[1]?.suggestedPlacement?.manual).toMatchObject({
      x: (initialNoteBox?.x ?? 0) + 24,
      y: (initialNoteBox?.y ?? 0) + 14,
      side: layouts.at(-1)?.annotations[0]?.placement.side,
      align: layouts.at(-1)?.annotations[0]?.placement.align
    });
    expect(editEvents[1]?.suggestedAnnotation?.placement).toEqual(editEvents[1]?.suggestedPlacement);
  });

  it('emits editable anchor handles with suggested translated anchors', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 320, 220));

    const editEvents: AnnotationLayerEditEvent[] = [];
    const { container } = render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        editable={{ includeAnchor: true }}
        noteSizes={{ revenue: { width: 120, height: 52 } }}
        onEdit={(event) => editEvents.push(event)}
      />
    );

    const handle = container.querySelector('.pa-annotation__edit-handle--anchor[data-annotation-id="revenue"]');
    const layer = handle?.closest('svg');
    expect(handle).toBeTruthy();
    expect(layer).toBeTruthy();

    pointer(handle!, 'pointerdown', { clientX: 160, clientY: 120, pointerId: 1 });
    pointer(layer!, 'pointermove', { clientX: 172, clientY: 132, pointerId: 1 });
    pointer(layer!, 'pointerup', { clientX: 172, clientY: 132, pointerId: 1 });

    expect(editEvents.map((event) => event.phase)).toEqual(['start', 'move', 'end']);
    expect(editEvents[1]?.suggestedAnchor).toEqual({
      type: 'point',
      point: { x: 172, y: 132 }
    });
    expect(editEvents[1]?.suggestedAnnotation?.anchor).toEqual(editEvents[1]?.suggestedAnchor);
  });

  it('maps editable pointer deltas through SVG preserveAspectRatio letterboxing', () => {
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 300));

    const editEvents: AnnotationLayerEditEvent[] = [];
    const { container } = render(
      <AnnotationLayer
        annotations={[{
          id: 'letterbox',
          anchor: { type: 'point', point: { x: 100, y: 50 } },
          note: { title: 'Letterbox' }
        }]}
        bounds={{ x: 0, y: 0, width: 200, height: 100 }}
        editable={{ includeAnchor: true }}
        preserveAspectRatio="xMidYMid meet"
        noteSizes={{ letterbox: { width: 96, height: 42 } }}
        onEdit={(event) => editEvents.push(event)}
      />
    );

    const handle = container.querySelector('.pa-annotation__edit-handle--anchor[data-annotation-id="letterbox"]');
    const layer = handle?.closest('svg');
    expect(handle).toBeTruthy();
    expect(layer).toBeTruthy();

    pointer(handle!, 'pointerdown', { clientX: 200, clientY: 150, pointerId: 1 });
    pointer(layer!, 'pointermove', { clientX: 200, clientY: 170, pointerId: 1 });

    expect(editEvents[1]?.delta).toEqual({ x: 0, y: 10 });
    expect(editEvents[1]?.suggestedAnchor).toEqual({
      type: 'point',
      point: { x: 100, y: 60 }
    });
  });

  it('supports keyboard nudging for note and anchor edit handles', () => {
    const editEvents: AnnotationLayerEditEvent[] = [];
    const layouts: ResolvedLayout[] = [];
    const { container } = render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        editable={{ includeAnchor: true, noteHandlePosition: 'bottom-left', keyboardStep: 2, keyboardLargeStep: 12 }}
        noteSizes={{ revenue: { width: 120, height: 52 } }}
        onEdit={(event) => editEvents.push(event)}
        onLayout={(layout) => layouts.push(layout)}
      />
    );

    const noteHandle = container.querySelector('.pa-annotation__edit-handle--note[data-annotation-id="revenue"]');
    const initialNoteBox = layouts.at(-1)?.annotations[0]?.noteBox;

    expect(noteHandle).toBeTruthy();
    expect(initialNoteBox).toBeTruthy();
    expect(noteHandle?.getAttribute('data-edit-handle-position')).toBe('bottom-left');

    fireEvent.keyDown(noteHandle!, { key: 'ArrowRight' });

    expect(editEvents.map((event) => event.phase)).toEqual(['start', 'end']);
    expect(editEvents[1]?.delta).toEqual({ x: 2, y: 0 });
    expect(editEvents[1]?.suggestedPlacement?.manual.x).toBe((initialNoteBox?.x ?? 0) + 2);

    editEvents.length = 0;

    const anchorHandle = container.querySelector('.pa-annotation__edit-handle--anchor[data-annotation-id="revenue"]');

    expect(anchorHandle).toBeTruthy();

    fireEvent.keyDown(anchorHandle!, { key: 'ArrowDown', shiftKey: true });

    expect(editEvents.map((event) => event.phase)).toEqual(['start', 'end']);
    expect(editEvents[1]?.delta).toEqual({ x: 0, y: 12 });
    expect(editEvents[1]?.suggestedAnchor).toEqual({
      type: 'point',
      point: { x: 160, y: 132 }
    });
  });

  it('allows hosts to control React edit handle tab order', () => {
    const { container, rerender } = render(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        editable={{ includeAnchor: true }}
        noteSizes={{ revenue: { width: 120, height: 52 } }}
      />
    );

    expect(container.querySelector('.pa-annotation__edit-handle--note')?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('.pa-annotation__edit-handle--anchor')?.getAttribute('tabindex')).toBe('0');

    rerender(
      <AnnotationLayer
        annotations={annotations}
        bounds={{ x: 0, y: 0, width: 320, height: 220 }}
        editable={{ includeAnchor: true }}
        editHandleTabIndex={-1}
        noteSizes={{ revenue: { width: 120, height: 52 } }}
      />
    );

    expect(container.querySelector('.pa-annotation__edit-handle--note')?.getAttribute('tabindex')).toBe('-1');
    expect(container.querySelector('.pa-annotation__edit-handle--anchor')?.getAttribute('tabindex')).toBe('-1');
  });

  it('recomputes useAnnotations when padding changes', () => {
    function Probe({ padding }: { padding: number }) {
      const layout = useAnnotations({
        annotations,
        bounds: { x: 0, y: 0, width: 320, height: 220 },
        padding
      });

      return <output>{layout.placementBounds.x}</output>;
    }

    const { rerender } = render(<Probe padding={8} />);

    expect(screen.getByText('8')).toBeTruthy();

    rerender(<Probe padding={24} />);

    expect(screen.getByText('24')).toBeTruthy();
  });
});

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({ x, y, width, height })
  } as DOMRect;
}

function pointer(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { clientX: number; clientY: number; pointerId: number }
) {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true
  });

  Object.defineProperties(event, {
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    pointerId: { value: init.pointerId }
  });

  fireEvent(target, event);
}
