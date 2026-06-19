import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  annotationClassName,
  brontoAnnotationClassName,
  renderAnnotationsSvg,
  resolveAnnotationLayout
} from '../../src/index.js';

describe('Bronto CSS bridge', () => {
  const css = readFileSync(new URL('../../src/styles/bronto.css', import.meta.url), 'utf8');
  const parity = JSON.parse(readFileSync(new URL('../../docs/bronto-ui-annotation-parity.json', import.meta.url), 'utf8')) as {
    packageSelectors: string[];
    packageExtensions: string[];
  };
  const variants = [
    'label',
    'callout',
    'elbow',
    'curve',
    'circle',
    'rect',
    'threshold',
    'badge',
    'bracket',
    'band',
    'slope',
    'compare',
    'cluster',
    'axis',
    'timeline',
    'evidence'
  ];
  const tones = ['accent', 'muted', 'success', 'warning', 'danger', 'info'];
  const motions = ['draw', 'reveal', 'pulse', 'focus'];

  it('generates package and legacy Bronto annotation class recipes', () => {
    expect(annotationClassName({
      variant: 'bracket',
      tone: 'info',
      motion: 'draw',
      side: 'right',
      manual: true,
      className: ['extra-callout', false, 'is-selected']
    })).toBe('pa-annotation pa-annotation--right pa-annotation--manual pa-annotation--bracket pa-annotation--info pa-annotation--draw extra-callout is-selected');
    expect(brontoAnnotationClassName({
      variant: 'bracket',
      tone: 'info',
      motion: 'draw'
    })).toBe('ui-annotation ui-annotation--bracket ui-annotation--info ui-annotation--draw');
    expect(annotationClassName({ prefix: 'custom', variant: 'badge' }))
      .toBe('custom custom--badge');
  });

  it('styles package renderer classes and legacy Bronto annotation classes', () => {
    expect(css).toContain('.pa-annotation-layer');
    expect(css).toContain('.pa-annotation__edit-handle');
    expect(css).toContain('.pa-annotation__note-line--vertical');
    expect(css).toContain('.ui-annotation');
    expect(css).toContain('.ui-annotation__connector-end');
    expect(css).toContain('.ui-annotation__title');
    expect(css).toContain('.ui-annotation__badge');
    expect(css).toContain('.ui-annotation__badge-pointer');
    expect(css).toContain('.ui-annotation--evidence');
    expect(css).toContain('uiAnnotationPulse');
  });

  it('keeps annotation overlays passive while edit handles remain interactive', () => {
    expect(css).toContain('.pa-annotation-layer-wrap');
    expect(css).toContain('.pa-annotation-layer');
    expect(css).toContain('.pa-annotation__edit-hit');
    expect(css).toMatch(/\.pa-annotation-layer-wrap\s*\{[^}]*pointer-events: none;/s);
    expect(css).toMatch(/\.pa-annotation-layer\s*\{[^}]*pointer-events: none;/s);
    expect(css).toMatch(/\.pa-annotation\s*\{[^}]*pointer-events: none;/s);
    expect(css).toMatch(/\.ui-annotation\s*\{[^}]*pointer-events: none;/s);
    expect(css).toMatch(/\.pa-annotation__edit-handles\s*\{[^}]*pointer-events: auto;/s);
    expect(css).toMatch(/\.pa-annotation__edit-hit\s*\{[^}]*pointer-events: auto;/s);
    expect(css).toMatch(/\.pa-annotation__edit-handle\s*\{[^}]*pointer-events: auto;/s);
  });

  it('styles the critical classes emitted by the static SVG renderer', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'rendered-callout',
          anchor: { type: 'point', point: { x: 80, y: 72 } },
          note: {
            title: 'Rendered',
            body: 'CSS coverage',
            line: true
          },
          connector: { end: 'arrow' },
          subject: { shape: 'circle', radius: 8 },
          placement: { manual: { x: 148, y: 40, side: 'right' } },
          variant: 'circle',
          tone: 'warning',
          motion: 'draw'
        },
        {
          id: 'rendered-badge',
          anchor: { type: 'point', point: { x: 48, y: 132 } },
          note: { title: '1', visible: false },
          connector: { type: 'none' },
          subject: { badge: { label: '1', x: 'right', y: 'top' } },
          variant: 'badge',
          tone: 'accent'
        }
      ],
      bounds: { x: 0, y: 0, width: 320, height: 220 },
      noteSizes: {
        'rendered-callout': { width: 132, height: 64 },
        'rendered-badge': { width: 0, height: 0 }
      }
    });
    const svg = renderAnnotationsSvg(layout, {
      includeDebugBoxes: true,
      includeEditHandles: true
    });
    const renderedClasses = new Set(
      [...svg.matchAll(/class="([^"]+)"/g)]
        .flatMap((match) => match[1]?.split(/\s+/) ?? [])
        .filter(Boolean)
    );
    const criticalClasses = [
      'pa-annotation-layer',
      'pa-annotation',
      'pa-annotation--manual',
      'pa-annotation--circle',
      'pa-annotation--badge',
      'pa-annotation--warning',
      'pa-annotation--draw',
      'pa-annotation__subject',
      'pa-annotation__connector',
      'pa-annotation__marker',
      'pa-annotation__note',
      'pa-annotation__note-box',
      'pa-annotation__note-line',
      'pa-annotation__title',
      'pa-annotation__body',
      'pa-annotation__label',
      'pa-annotation__badge',
      'pa-annotation__badge-pointer',
      'pa-annotation__badge-label',
      'pa-annotation__debug-box',
      'pa-annotation__edit-hit',
      'pa-annotation__edit-handle'
    ];

    for (const className of criticalClasses) {
      expect(renderedClasses.has(className), `${className} should be emitted`).toBe(true);
      expect(css, `${className} should be styled by bronto.css`).toContain(`.${className}`);
    }
  });

  it('tracks emitted package text, badge, and edit classes in the Bronto parity manifest', () => {
    const trackedSelectors = new Set([
      ...parity.packageSelectors,
      ...parity.packageExtensions
    ]);
    const emittedPublicClasses = [
      '.pa-annotation__note-box',
      '.pa-annotation__body',
      '.pa-annotation__badge-label',
      '.pa-annotation__edit-handles',
      '.pa-annotation__edit-hit',
      '.pa-annotation__edit-handle'
    ];

    for (const selector of emittedPublicClasses) {
      expect(trackedSelectors.has(selector), `${selector} should be tracked by Bronto parity`).toBe(true);
      expect(css, `${selector} should be styled by bronto.css`).toContain(selector);
    }
  });

  it('covers every public variant, tone, and motion on package and legacy classes', () => {
    for (const variant of variants) {
      expect(css).toContain(`.pa-annotation--${variant}`);
      expect(css).toContain(`.ui-annotation--${variant}`);
    }

    for (const tone of tones) {
      expect(css).toContain(`.pa-annotation--${tone}`);
      expect(css).toContain(`.ui-annotation--${tone}`);
    }

    for (const motion of motions) {
      expect(css).toContain(`.pa-annotation--${motion}`);
      expect(css).toContain(`.ui-annotation--${motion}`);
    }

    expect(css).toContain('.pa-annotation--threshold .pa-annotation__subject');
    expect(css).toContain('.pa-annotation__subject--geometry-encircle');
    expect(css).toContain('stroke-dasharray: 6 4');
    expect(css).toContain('.pa-annotation--evidence .pa-annotation__subject');
    expect(css).toContain('.pa-annotation--focus');
    expect(css).toContain('--pa-annotation-subject-fill: var(--bronto-accent-soft, var(--accent-soft, color-mix(in srgb, var(--pa-annotation-accent) 10%, transparent)))');
    expect(css).toContain('color-mix(in srgb, var(--pa-annotation-accent) 14%, transparent)');
    expect(css).toContain('--pa-annotation-accent: CanvasText !important');
    expect(css).toContain('.pa-annotation__note-box');
    expect(css).toContain('fill: Canvas !important');
    expect(css).toContain('stroke: CanvasText !important');
  });

  it('keeps legacy static SVG text legible over report figures', () => {
    expect(css).toContain('paint-order: stroke fill');
    expect(css).toContain('stroke: var(--annotation-note-bg)');
    expect(css).toContain('text-transform: uppercase');
  });
});
