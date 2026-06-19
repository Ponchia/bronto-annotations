import { describe, expect, it } from 'vitest';
import { estimateNoteSize, renderAnnotationsSvg, resolveAnnotationLayout } from '../../src/index.js';

describe('SVG renderer', () => {
  it('renders subjects, connectors, and notes from resolved layout data', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'point',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Point', body: 'A placed note.' }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout, { title: 'Test annotations' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('pa-annotation__subject');
    expect(svg).toContain('pa-annotation__connector');
    expect(svg).toContain('pa-annotation__note');
    expect(svg).toContain('Point');
    expect(svg).toContain('<g class="pa-annotation pa-annotation--top"');
    expect(svg.indexOf('pa-annotation__subject')).toBeGreaterThan(svg.indexOf('<g class="pa-annotation'));
  });

  it('emits data attributes, accessible labels, and candidate debug boxes', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'metadata',
          anchor: { type: 'box', box: { x: 96, y: 70, width: 40, height: 30 } },
          note: {
            title: 'Metadata',
            ariaLabel: 'Metadata note',
            data: { noteKind: 'callout' }
          },
          data: { anchorSource: 'unit-test' }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout, {
      includeDebugBoxes: true,
      ariaLabel: 'Debug annotation layer',
      noteTabIndex: 0
    });

    expect(svg).toContain('aria-label="Debug annotation layer"');
    expect(svg).toContain('data-anchor-source="unit-test"');
    expect(svg).toContain('data-note-kind="callout"');
    expect(svg).toContain('data-debug-kind="candidate"');
    expect(svg).toContain('data-candidate-score=');
    expect(svg).toContain('data-debug-kind="winner"');
    expect(svg).toContain('aria-hidden="true" data-annotation-id="metadata" data-debug-kind="winner"');
    expect(svg).toContain('role="group" aria-label="Metadata note"');
    expect(svg).toContain('role="note" aria-label="Metadata note"');
    expect(svg).toContain('data-annotation-id="metadata" data-note-align="start" tabindex="0"');
    expect(svg).toMatch(/class="pa-annotation__subject[^"]*"[^>]+aria-hidden="true"/);
    expect(svg).toMatch(/class="pa-annotation__connector"[^>]+aria-hidden="true"/);
    expect(svg).toMatch(/class="pa-annotation__note-box"[^>]+aria-hidden="true"/);
  });

  it('emits typed variant, tone, and motion classes', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'styled',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Styled' },
          variant: 'badge',
          tone: 'warning',
          motion: 'pulse'
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('pa-annotation--badge');
    expect(svg).toContain('pa-annotation--warning');
    expect(svg).toContain('pa-annotation--pulse');
  });

  it('emits per-annotation CSS variable style overrides', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'colored',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Colored' },
          style: {
            color: '#d12f6a',
            lineColor: '#7c2d12',
            noteBackground: 'white',
            strokeWidth: 2,
            vars: {
              '--custom-annotation-token': 'demo',
              '--bad token': 'ignored'
            }
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('style="--pa-annotation-accent: #d12f6a; --annotation-color: #d12f6a; --pa-annotation-line: #7c2d12; --annotation-line: #7c2d12; --pa-annotation-paper: white; --annotation-note-bg: white; --pa-annotation-stroke-width: 2; --annotation-stroke-width: 2; --custom-annotation-token: demo"');
    expect(svg).not.toContain('--bad token');
  });

  it('renders lower-priority annotations before higher-priority annotations for SVG stacking', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
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
      ],
      bounds: { x: 0, y: 0, width: 300, height: 200 },
      noteSizes: {
        high: { width: 120, height: 56 },
        low: { width: 120, height: 56 }
      }
    });
    const svg = renderAnnotationsSvg(layout, { includeEditHandles: true });
    const lowGroup = svg.indexOf('data-annotation-id="low" data-annotation-side');
    const highGroup = svg.indexOf('data-annotation-id="high" data-annotation-side');
    const editHandles = svg.indexOf('pa-annotation__edit-handles');
    const lowHandle = svg.indexOf('data-annotation-id="low" data-edit-handle="note"', editHandles);
    const highHandle = svg.indexOf('data-annotation-id="high" data-edit-handle="note"', editHandles);

    expect(layout.annotations.map((item) => item.id)).toEqual(['high', 'low']);
    expect(lowGroup).toBeGreaterThan(-1);
    expect(highGroup).toBeGreaterThan(lowGroup);
    expect(lowHandle).toBeGreaterThan(-1);
    expect(highHandle).toBeGreaterThan(lowHandle);
  });

  it('renders compact badge markers without forcing a visible note card', () => {
    const annotation = {
      id: 'badge-only',
      anchor: { type: 'point' as const, point: { x: 80, y: 90 } },
      note: { title: '2', ariaLabel: 'Second event', visible: false },
      subject: {
        shape: 'circle' as const,
        badge: {
          label: '2',
          radius: 11,
          x: 'right' as const,
          y: 'top' as const,
          data: { badgeKind: 'step' }
        }
      },
      variant: 'badge' as const
    };
    const size = estimateNoteSize(annotation);
    const layout = resolveAnnotationLayout({
      annotations: [annotation],
      bounds: { x: 0, y: 0, width: 220, height: 160 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(size).toEqual({ width: 0, height: 0 });
    expect(svg).toContain('pa-annotation__badge');
    expect(svg).toContain('pa-annotation__badge-pointer');
    expect(svg).toContain('data-badge-kind="step"');
    expect(svg).toContain('data-badge-x="right"');
    expect(svg).toContain('data-badge-y="top"');
    expect(svg).toContain('d="M80,90L91,90L80,79Z"');
    expect(svg).toContain('cx="91" cy="79" r="11"');
    expect(svg).toContain('class="pa-annotation__badge-label pa-annotation__title"');
    expect(svg).toContain('>2</text>');
    expect(svg).not.toContain('role="note"');
    expect(svg).not.toContain('pa-annotation__note-box');
  });

  it('wraps note text with a custom splitter', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'split-note',
          anchor: { type: 'point', point: { x: 72, y: 70 } },
          note: {
            title: 'Split',
            body: 'alpha/beta/gamma',
            wrap: 8,
            wrapSplitter: /\//,
            maxLines: 3
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 260, height: 180 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('>alpha</text>');
    expect(svg).toContain('>beta</text>');
    expect(svg).toContain('>gamma</text>');
    expect(svg).not.toContain('alpha/beta');
  });

  it('can match a host SVG preserveAspectRatio policy', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'aligned',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Aligned' }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout, {
      preserveAspectRatio: 'xMinYMin meet'
    });

    expect(svg).toContain('preserveAspectRatio="xMinYMin meet"');
  });

  it('can render manual-placement edit handles', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'manual',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Manual note' },
          placement: { manual: { x: 160, y: 40, side: 'right' } }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 },
      noteSizes: {
        manual: { width: 100, height: 48 }
      }
    });
    const svg = renderAnnotationsSvg(layout, {
      includeEditHandles: { includeAnchor: true, noteHandlePosition: 'bottom-right' },
      editHandleTabIndex: 0
    });

    expect(svg).toContain('pa-annotation--manual');
    expect(svg).toContain('pa-annotation__edit-handle');
    expect(svg).toContain('data-edit-handle="note"');
    expect(svg).toContain('data-edit-handle-position="bottom-right"');
    expect(svg).toContain('data-edit-handle="anchor"');
    expect(svg).toContain('aria-label="Move note for Manual note"');
    expect(svg).toContain('role="button" aria-label="Move note for Manual note" tabindex="0"');
    expect(svg).toContain('role="button" aria-label="Move anchor for Manual note" tabindex="0"');
    expect(svg).toContain('pa-annotation__edit-hit pa-annotation__edit-hit--note');
    expect(svg).toContain('aria-hidden="true"');
  });

  it('renders rich subjects and connector markers', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'rich',
          anchor: { type: 'box', box: { x: 72, y: 64, width: 48, height: 32 } },
          note: {
            title: 'Rich',
            body: 'Connector and subject options',
            wrap: 12,
            maxLines: 2,
            padding: 8
          },
          subject: {
            shape: 'circle',
            padding: 6,
            data: { subjectKind: 'circle' }
          },
          connector: {
            type: 'curve',
            end: 'arrow',
            data: { connectorKind: 'curve' }
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('marker-end="url(#pa-annotation-marker-arrow)"');
    expect(svg).toContain('data-connector-type="curve"');
    expect(svg).toContain('data-subject-kind="circle"');
    expect(svg).toContain('<circle class="pa-annotation__subject');
  });

  it('renders structured subject geometry without precomputed paths', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'bracket',
          anchor: { type: 'point', point: { x: 100, y: 72 } },
          note: { title: 'Bracket' },
          variant: 'bracket',
          subject: {
            geometry: { type: 'bracket', x1: -24, y1: 0, x2: 24, y2: 0, depth: 8 },
            data: { subjectKind: 'bracket' }
          }
        },
        {
          id: 'absolute-band',
          anchor: { type: 'point', point: { x: 20, y: 20 } },
          note: { title: 'Band' },
          variant: 'band',
          subject: {
            geometry: { type: 'band', x: 12, y: 30, width: 90, height: 18, padding: 3 },
            geometrySpace: 'absolute'
          }
        },
        {
          id: 'absolute-encircle',
          anchor: { type: 'point', point: { x: 20, y: 20 } },
          note: { title: 'Encircle' },
          variant: 'cluster',
          subject: {
            geometry: { type: 'encircle', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], radius: 2, padding: 3 },
            geometrySpace: 'absolute'
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('pa-annotation__subject--geometry');
    expect(svg).toContain('d="M-24,0V8H24V0" transform="translate(100 72)" data-subject-kind="bracket"');
    expect(svg).toContain('d="M9,27H105V51H9Z"');
    expect(svg).not.toContain('d="M9,27H105V51H9Z" transform=');
    expect(svg).toContain('pa-annotation__subject--geometry-encircle');
    expect(svg).toContain('d="M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z"');
    expect(svg).not.toContain('d="M5,-10A10,10 0 1 1 5,10A10,10 0 1 1 5,-10Z" transform=');
  });

  it('can scope connector marker ids for multiple layers in one document', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'scoped',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: { title: 'Scoped' },
          connector: { end: 'arrow' }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout, {
      markerIdPrefix: 'chart-a'
    });

    expect(svg).toContain('id="chart-a-marker-arrow"');
    expect(svg).toContain('marker-end="url(#chart-a-marker-arrow)"');
    expect(svg).not.toContain('id="pa-annotation-marker-arrow"');
  });

  it('renders note text alignment and wraps long words consistently', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'aligned-note',
          anchor: { type: 'point', point: { x: 140, y: 100 } },
          note: {
            title: 'Centered HyperFocused',
            body: 'supercalifragilistic',
            align: 'center',
            wrap: 8,
            maxLines: 3,
            padding: { top: 8, right: 20, bottom: 8, left: 20 }
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 },
      noteSizes: {
        'aligned-note': { width: 160, height: 92 }
      }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('pa-annotation__note--align-center');
    expect(svg).toContain('data-note-align="center"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('x="80"');
    expect(svg).toContain('>Centered</text>');
    expect(svg).toContain('>HyperFocused</text>');
    expect(svg).toContain('>supercal</text>');
    expect(svg).toContain('>ifragili</text>');
    expect(svg).toContain('>stic</text>');
  });

  it('renders Bronto-style note lines and label aliases when requested', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'note-line',
          anchor: { type: 'point', point: { x: 120, y: 88 } },
          note: {
            title: 'Rule',
            body: 'Label text',
            line: {
              length: 96,
              offset: 12,
              data: { lineKind: 'rule' }
            }
          },
          motion: 'draw'
        }
      ],
      bounds: { x: 0, y: 0, width: 280, height: 180 },
      noteSizes: {
        'note-line': { width: 160, height: 84 }
      }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('class="pa-annotation__note-line"');
    expect(svg).toContain('d="M14,12H110"');
    expect(svg).toContain('data-line-kind="rule"');
    expect(svg).toContain('class="pa-annotation__body pa-annotation__label"');
  });

  it('renders vertical note lines for d3-style note line orientation', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'vertical-note-line',
          anchor: { type: 'point', point: { x: 120, y: 88 } },
          note: {
            title: 'Vertical rule',
            line: {
              orientation: 'vertical',
              length: 50,
              offset: 16
            }
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 280, height: 180 },
      noteSizes: {
        'vertical-note-line': { width: 140, height: 80 }
      }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('class="pa-annotation__note-line"');
    expect(svg).toContain('d="M16,10V60"');
    expect(svg).toContain('data-note-line-orientation="vertical"');
  });

  it('estimates note size from note padding, wrap, and max lines', () => {
    const size = estimateNoteSize({
      id: 'estimate',
      anchor: { type: 'point', point: { x: 0, y: 0 } },
      note: {
        body: 'supercalifragilistic',
        wrap: 8,
        maxLines: 2,
        padding: 20
      }
    }, { width: 40, height: 20 });

    expect(size.width).toBeCloseTo(97.6);
    expect(size.height).toBe(74);
  });

  it('reserves note-size space for visible note lines', () => {
    const withoutLine = estimateNoteSize({
      id: 'without',
      anchor: { type: 'point', point: { x: 0, y: 0 } },
      note: { title: 'Title', body: 'Body' }
    }, { width: 40, height: 20 });
    const withLine = estimateNoteSize({
      id: 'with',
      anchor: { type: 'point', point: { x: 0, y: 0 } },
      note: { title: 'Title', body: 'Body', line: true }
    }, { width: 40, height: 20 });

    expect(withLine.height - withoutLine.height).toBe(10);
  });

  it('renders custom subject paths from geometry helpers', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'bracket',
          anchor: { type: 'box', box: { x: 72, y: 64, width: 48, height: 32 } },
          note: { title: 'Bracket' },
          subject: {
            path: 'M72,64V76H120V96',
            data: { subjectKind: 'bracket' }
          },
          variant: 'bracket'
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(svg).toContain('<path class="pa-annotation__subject pa-annotation__subject--box pa-annotation__subject--path"');
    expect(svg).toContain('d="M72,64V76H120V96"');
    expect(svg).toContain('data-subject-kind="bracket"');
    expect(svg).toContain('pa-annotation--bracket');
  });

  it('escapes text, data attributes, class names, and custom class prefixes', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'escaped" id',
          anchor: { type: 'point', point: { x: 80, y: 90 } },
          note: {
            title: '<Unsafe title>',
            body: 'Body with <tag> & "quote"',
            className: 'note" onclick="boom',
            data: { unsafeValue: 'value" <tag> &' }
          },
          className: 'group" onload="boom',
          subject: {
            className: 'subject" onmouseover="boom'
          },
          connector: {
            className: 'connector" onclick="boom'
          }
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 }
    });
    const svg = renderAnnotationsSvg(layout, {
      classPrefix: 'x" onload="boom',
      ariaLabel: 'Layer "quoted"'
    });

    expect(svg).toContain('aria-label="Layer &quot;quoted&quot;"');
    expect(svg).toContain('&lt;Unsafe title&gt;');
    expect(svg).toContain('Body with &lt;tag&gt; &amp;');
    expect(svg).toContain('&amp; "quote"</text>');
    expect(svg).toContain('data-unsafe-value="value&quot; &lt;tag&gt; &amp;"');
    expect(svg).toContain('class="x&quot; onload=&quot;boom-layer"');
    expect(svg).toContain('note&quot; onclick=&quot;boom');
    expect(svg).toContain('group&quot; onload=&quot;boom');
    expect(svg).not.toContain('<Unsafe title>');
    expect(svg).not.toContain('onclick="boom');
    expect(svg).not.toContain('onload="boom');
    expect(svg).not.toContain('onmouseover="boom');
  });
});
