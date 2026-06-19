import { describe, expect, it } from 'vitest';
import {
  annotationFromD3Style,
  annotationsFromD3Style,
  annotationsFromD3StyleCollection,
  applyD3StyleAnnotationCollectionEdit,
  applyD3StyleAnnotationEdit,
  badgeAnnotation,
  createD3StyleAnnotationBuilder,
  d3StyleAnnotationCollectionEditPatch,
  d3StyleAnnotationEditPatch,
  defineD3StyleAnnotationType,
  annotationsFromD3StyleType,
  encircleCallout,
  pathCallout,
  pointCallout,
  prepareD3StyleAnnotationCollection,
  regionCallout,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  thresholdAnnotation
} from '../../src/index.js';

describe('annotation presets', () => {
  it('creates plain-data callout presets that render through the normal engine', () => {
    const annotations = [
      pointCallout({
        id: 'point',
        point: { x: 60, y: 60 },
        note: { title: 'Point' },
        style: { color: '#d12f6a', subjectFill: 'rgba(209, 47, 106, 0.14)' },
        metadata: { source: 'preset' }
      }),
      regionCallout({
        id: 'region',
        box: { x: 120, y: 80, width: 80, height: 48 },
        note: { title: 'Region' }
      }),
      pathCallout({
        id: 'path',
        points: [
          { x: 40, y: 140 },
          { x: 120, y: 160 }
        ],
        note: { title: 'Path' }
      }),
      encircleCallout({
        id: 'encircle',
        points: [
          { x: 180, y: 150 },
          { x: 220, y: 150 },
          { x: 200, y: 178 }
        ],
        pointRadius: 4,
        padding: 8,
        note: { title: 'Cluster' }
      }),
      thresholdAnnotation({
        id: 'threshold',
        orientation: 'horizontal',
        value: 180,
        range: [30, 260],
        note: { title: 'Threshold' }
      }),
      badgeAnnotation({
        id: 'badge',
        point: { x: 260, y: 40 },
        note: { title: '!' }
      })
    ];
    const layout = resolveAnnotationLayout({
      annotations,
      bounds: { x: 0, y: 0, width: 360, height: 260 },
      noteSizes: Object.fromEntries(annotations.map((item) => [item.id, { width: 88, height: 42 }]))
    });
    const svg = renderAnnotationsSvg(layout);

    expect(layout.annotations).toHaveLength(6);
    expect(svg).toContain('marker-end');
    expect(svg).toContain('--pa-annotation-accent: #d12f6a');
    expect(svg).toContain('--pa-annotation-subject-fill: rgba(209, 47, 106, 0.14)');
    expect(annotations[0]?.metadata).toEqual({ source: 'preset' });
    expect(svg).toContain('data-connector-type="curve"');
    expect(svg).toContain('pa-annotation--circle');
    expect(svg).toContain('pa-annotation--rect');
    expect(svg).toContain('pa-annotation--threshold');
    expect(svg).toContain('pa-annotation--cluster');
    expect(svg).toContain('pa-annotation__subject--geometry-encircle');
    expect(svg).toContain('pa-annotation--badge');
    expect(svg).toContain('pa-annotation__badge');
    expect(svg).toContain('>!</text>');
    expect(annotations.find((item) => item.id === 'badge')?.connector?.type).toBe('none');
    expect(annotations.find((item) => item.id === 'badge')?.note.visible).toBe(false);
  });

  it('converts d3-annotation style objects into normal engine annotations with package style overrides', () => {
    const annotations = annotationsFromD3Style([
      {
        id: 'circle',
        type: 'annotationCalloutCircle',
        x: 120,
        y: 100,
        dx: 90,
        dy: -20,
        note: {
          title: 'Peak',
          label: 'D3-style offset',
          wrap: 24,
          align: 'middle',
          lineType: 'vertical',
          wrapSplitter: /[,;]/,
          bgPadding: { top: 8, right: 12, bottom: 8, left: 12 }
        },
        subject: { radius: 10, radiusPadding: 3 },
        connector: { end: 'arrow' },
        tone: 'warning',
        color: '#d12f6a',
        annotationData: { migration: 'd3', color: 'override' },
        style: {
          lineColor: '#7c2d12',
          noteBackground: 'white',
          vars: { '--custom-annotation-token': 'd3-style' }
        }
      },
      {
        id: 'curve',
        type: 'annotationCalloutCurve',
        x: 70,
        y: 180,
        dx: 60,
        dy: 32,
        note: { label: 'Routed through a relative point', orientation: 'leftRight', align: 'bottom' },
        connector: { type: 'curve', points: [[24, -18]], end: 'dot' }
      },
      {
        id: 'badge',
        type: 'annotationBadge',
        x: 260,
        y: 60,
        subject: {
          text: '1',
          radius: 9,
          x: 'right',
          y: 'top',
          className: 'legacy-badge-subject',
          data: { step: 'one' }
        }
      },
      {
        id: 'encircle',
        type: 'annotationCalloutCircle',
        dx: 48,
        dy: 28,
        note: { label: 'Computed cluster' },
        subject: {
          points: [
            { x: 180, y: 150 },
            { x: 220, y: 150 },
            { x: 200, y: 178 }
          ],
          pointRadius: 4,
          padding: 8
        }
      }
    ]);
    const layout = resolveAnnotationLayout({
      annotations,
      bounds: { x: 0, y: 0, width: 360, height: 260 },
      noteSizes: {
        circle: { width: 96, height: 44 },
        curve: { width: 108, height: 44 },
        badge: { width: 0, height: 0 },
        encircle: { width: 120, height: 44 }
      }
    });
    const circle = layout.annotations.find((item) => item.id === 'circle');
    const curve = layout.annotations.find((item) => item.id === 'curve');
    const encircle = layout.annotations.find((item) => item.id === 'encircle');
    const svg = renderAnnotationsSvg(layout);

    expect(annotations[0]?.variant).toBe('circle');
    expect(annotations[0]?.placement?.manual).toMatchObject({ x: 210, y: 80, side: 'right' });
    expect(annotations[0]?.connector?.startOffset).toBe(13);
    expect(annotations[0]?.note.line).toMatchObject({ orientation: 'vertical' });
    expect(annotations[0]?.note.align).toBe('center');
    expect(annotations[0]?.note.wrapSplitter).toEqual(/[,;]/);
    expect(annotations[0]?.note.padding).toEqual({ top: 8, right: 12, bottom: 8, left: 12 });
    expect(annotations[0]?.style).toEqual({
      color: '#d12f6a',
      lineColor: '#7c2d12',
      noteBackground: 'white',
      vars: { '--custom-annotation-token': 'd3-style' }
    });
    expect(annotations[0]?.metadata?.color).toBe('#d12f6a');
    expect(annotations[0]?.metadata?.datum).toBeUndefined();
    expect(annotations[0]?.data).toEqual({ color: 'override', migration: 'd3' });
    expect(annotations[1]?.connector?.pointMode).toBe('relative');
    expect(annotations[1]?.note.line).toMatchObject({ orientation: 'vertical' });
    expect(annotations[1]?.note.align).toBe('end');
    expect(annotations[2]?.note.visible).toBe(false);
    expect(annotations[2]?.subject?.badge).toMatchObject({
      className: 'legacy-badge-subject',
      data: { step: 'one' },
      x: 'right',
      y: 'top'
    });
    expect(annotations[3]?.anchor.type).toBe('point');
    expect(annotations[3]?.subject?.geometry).toMatchObject({
      type: 'encircle',
      points: [
        { x: 180, y: 150 },
        { x: 220, y: 150 },
        { x: 200, y: 178 }
      ],
      radius: 4,
      padding: 8
    });
    expect(annotations[3]?.connector?.startOffset).toBeGreaterThan(30);
    expect(circle?.placement.manual).toBe(true);
    expect(circle?.noteBox).toMatchObject({ x: 210, y: 80, width: 96, height: 44 });
    expect(curve?.connector.type).toBe('curve');
    expect(curve?.connector.points).toContainEqual({ x: 94, y: 162 });
    expect(encircle?.placement.manual).toBe(true);
    expect(svg).toContain('pa-annotation--circle');
    expect(svg).toContain('data-migration="d3"');
    expect(svg).toContain('data-color="override"');
    expect(svg).toContain('--pa-annotation-accent: #d12f6a');
    expect(svg).toContain('--pa-annotation-line: #7c2d12');
    expect(svg).toContain('--pa-annotation-paper: white');
    expect(svg).toContain('--custom-annotation-token: d3-style');
    expect(svg).toContain('pa-annotation--curve');
    expect(svg).toContain('pa-annotation--badge');
    expect(svg).toContain('pa-annotation__badge legacy-badge-subject');
    expect(svg).toContain('pa-annotation__badge-pointer');
    expect(svg).toContain('data-step="one"');
    expect(svg).toContain('d="M260,60L269,60L260,51Z"');
    expect(svg).toContain('pa-annotation__subject--geometry-encircle');
    expect(svg).toContain('marker-end');
    expect(svg).toContain('>1</text>');
  });

  it('supports d3-style data accessors, thresholds, and disabled parts', () => {
    const [threshold] = annotationsFromD3Style([
      {
        id: 'limit',
        type: 'annotationXYThreshold',
        data: { x: 70, y: 120 },
        dx: 24,
        dy: -40,
        note: { label: 'Limit' },
        subject: { x1: 20, x2: 220 }
      }
    ], {
      x: 'x',
      y: (datum) => datum.y
    });
    const disabled = annotationFromD3Style({
      id: 'disabled',
      x: 12,
      y: 18,
      note: { label: 'Hidden' },
      disable: ['subject', 'connector', 'note']
    });

    expect(threshold?.anchor).toEqual({
      type: 'path',
      points: [
        { x: 20, y: 120 },
        { x: 220, y: 120 }
      ]
    });
    expect(threshold?.placement?.manual).toMatchObject({ x: 94, y: 80, side: 'top' });
    expect(threshold?.metadata?.datum).toEqual({ x: 70, y: 120 });
    expect(disabled.subject?.shape).toBe('none');
    expect(disabled.connector?.type).toBe('none');
    expect(disabled.note.visible).toBe(false);
  });

  it('converts d3-style collection configs with generator-like defaults', () => {
    const prepared = prepareD3StyleAnnotationCollection({
      annotations: [
        {
          data: { period: 12, score: 34 },
          dx: 44,
          dy: -20,
          note: { label: 'Peak' },
          subject: { radius: 8, radiusPadding: 2 }
        },
        {
          id: 'explicit-badge',
          type: 'annotationBadge',
          data: { period: 18, score: 22 },
          subject: { text: '2', x: 'left', y: 'top' }
        }
      ],
      type: 'annotationCalloutCircle',
      accessors: {
        x: 'period',
        y: (datum) => datum.score
      },
      ids: ['generated-peak', 'ignored-because-explicit'],
      editMode: true,
      notePadding: 6,
      textWrap: 18
    });
    const annotations = annotationsFromD3StyleCollection({
      annotations: prepared.styleAnnotations,
      accessors: {
        x: 'period',
        y: (datum) => datum.score
      }
    });

    expect(prepared.editMode).toBe(true);
    expect(prepared.styleAnnotations[0]?.id).toBe('generated-peak');
    expect(prepared.styleAnnotations[1]?.id).toBe('explicit-badge');
    expect(prepared.annotations[0]?.id).toBe('generated-peak');
    expect(prepared.annotations[0]?.anchor).toEqual({ type: 'point', point: { x: 12, y: 34 } });
    expect(prepared.annotations[0]?.variant).toBe('circle');
    expect(prepared.annotations[0]?.note.padding).toBe(6);
    expect(prepared.annotations[0]?.note.wrap).toBe(18);
    expect(prepared.annotations[0]?.connector?.startOffset).toBe(10);
    expect(prepared.annotations[1]?.id).toBe('explicit-badge');
    expect(prepared.annotations[1]?.variant).toBe('badge');
    expect(prepared.annotations[1]?.note.visible).toBe(false);
    expect(annotations.map((annotation) => annotation.id)).toEqual(['generated-peak', 'explicit-badge']);
  });

  it('round-trips d3-style collection edits through collection accessors', () => {
    const collection = {
      idPrefix: 'legacy',
      accessors: {
        x: 'period' as const,
        y: 'score' as const
      },
      accessorsInverse: {
        x: 'period' as const,
        y: 'score' as const
      },
      annotations: [
        {
          data: { period: 1, score: 2 },
          dx: 10,
          dy: 10,
          note: { label: 'Editable' }
        }
      ]
    };
    const patch = d3StyleAnnotationCollectionEditPatch(collection, {
      annotationId: 'legacy-1',
      suggestedAnchor: { type: 'point', point: { x: 5, y: 7 } },
      suggestedPlacement: {
        manual: { x: 20, y: 21, side: 'right' }
      }
    });
    const next = applyD3StyleAnnotationCollectionEdit(collection, {
      annotationId: 'legacy-1',
      suggestedAnchor: { type: 'point', point: { x: 5, y: 7 } },
      suggestedPlacement: {
        manual: { x: 20, y: 21, side: 'right' }
      }
    });

    expect(patch).toMatchObject({
      index: 0,
      id: 'legacy-1',
      annotation: {
        data: { period: 5, score: 7 },
        dx: 15,
        dy: 14
      }
    });
    expect(next.annotations[0]).toMatchObject({
      data: { period: 5, score: 7 },
      dx: 15,
      dy: 14,
      placement: {
        manual: { x: 20, y: 21, side: 'right' }
      }
    });
    expect(annotationsFromD3StyleCollection(next)[0]?.placement?.manual).toMatchObject({ x: 20, y: 21 });
  });

  it('provides a chainable DOM-free d3-style builder for migrated generator configs', () => {
    const builder = createD3StyleAnnotationBuilder<{ period: number; score: number }>()
      .type('annotationCalloutCircle')
      .accessors({ x: 'period', y: 'score' })
      .accessorsInverse({ x: 'period', y: 'score' })
      .ids((_, index) => `builder-${index + 1}`)
      .editMode(true)
      .notePadding(5)
      .textWrap(16)
      .annotations([
        {
          data: { period: 2, score: 9 },
          dx: 24,
          dy: -12,
          note: { label: 'Builder' },
          subject: { radius: 6 }
        }
      ]);
    const prepared = builder.prepare();
    const patch = builder.editPatch({
      annotationId: 'builder-1',
      suggestedAnchor: { type: 'point', point: { x: 4, y: 12 } },
      suggestedPlacement: {
        manual: { x: 44, y: 20, side: 'right' }
      }
    });

    builder.applyEdit({
      annotationId: 'builder-1',
      suggestedAnchor: { type: 'point', point: { x: 4, y: 12 } },
      suggestedPlacement: {
        manual: { x: 44, y: 20, side: 'right' }
      }
    });

    expect(builder.editMode()).toBe(true);
    expect(builder.type()).toBe('annotationCalloutCircle');
    expect(builder.annotations()).toHaveLength(1);
    expect(prepared.annotations[0]?.id).toBe('builder-1');
    expect(prepared.annotations[0]?.anchor).toEqual({ type: 'point', point: { x: 2, y: 9 } });
    expect(prepared.annotations[0]?.note.padding).toBe(5);
    expect(prepared.annotations[0]?.note.wrap).toBe(16);
    expect(patch.annotation).toMatchObject({
      data: { period: 4, score: 12 },
      dx: 40,
      dy: 8
    });
    expect(builder.config().annotations[0]).toMatchObject({
      data: { period: 4, score: 12 },
      dx: 40,
      dy: 8
    });
    expect(builder.toAnnotations()[0]?.placement?.manual).toMatchObject({ x: 44, y: 20 });
  });

  it('supports d3-style callout rect subjects with negative dimensions', () => {
    const rect = annotationFromD3Style({
      id: 'negative-rect',
      type: 'annotationCalloutRect',
      x: 120,
      y: 80,
      dx: 32,
      dy: -24,
      note: { label: 'Negative rect' },
      subject: {
        x: 0,
        y: 0,
        width: -54,
        height: -28
      }
    });
    const centered = annotationFromD3Style({
      id: 'centered-negative-rect',
      type: 'annotationCalloutRect',
      x: 120,
      y: 80,
      note: { label: 'Centered negative rect' },
      subject: {
        width: -54,
        height: -28
      }
    });

    expect(rect.anchor).toEqual({
      type: 'box',
      box: { x: 66, y: 52, width: 54, height: 28 }
    });
    expect(centered.anchor).toEqual({
      type: 'box',
      box: { x: 93, y: 66, width: 54, height: 28 }
    });
    expect(rect.variant).toBe('rect');
    expect(rect.subject?.shape).toBe('rect');
  });

  it('supports d3-style nx/ny absolute note coordinates', () => {
    const absoluteNote = annotationFromD3Style({
      id: 'absolute-note',
      type: 'annotationCallout',
      x: 40,
      y: 50,
      nx: 120,
      ny: 32,
      note: { label: 'Absolute note' }
    });
    const mixedNote = annotationFromD3Style({
      id: 'mixed-note',
      type: 'annotationCallout',
      x: 40,
      y: 50,
      dx: 20,
      ny: 120,
      note: { label: 'Mixed note' }
    });

    expect(absoluteNote.placement?.manual).toMatchObject({
      x: 120,
      y: 32,
      side: 'right'
    });
    expect(mixedNote.placement?.manual).toMatchObject({
      x: 60,
      y: 120,
      side: 'bottom'
    });
  });

  it('round-trips d3-style note edits back into nx/ny when absolute coordinates are used', () => {
    const next = applyD3StyleAnnotationEdit({
      id: 'absolute-note-edit',
      type: 'annotationCallout' as const,
      x: 40,
      y: 50,
      nx: 120,
      ny: 32,
      note: { label: 'Absolute note edit' }
    }, {
      annotationId: 'absolute-note-edit',
      suggestedPlacement: {
        manual: { x: 144, y: 68, side: 'right' }
      }
    });

    expect(next).toMatchObject({
      nx: 144,
      ny: 68,
      placement: {
        manual: { x: 144, y: 68, side: 'right' }
      }
    });
    expect(next.dx).toBeUndefined();
    expect(next.dy).toBeUndefined();
    expect(annotationFromD3Style(next).placement?.manual).toMatchObject({ x: 144, y: 68 });
  });

  it('uses d3-style callout note-line defaults and allows lineType none', () => {
    const callout = annotationFromD3Style({
      id: 'default-line',
      type: 'annotationCallout',
      x: 40,
      y: 50,
      note: { label: 'Default line' }
    });
    const withoutLine = annotationFromD3Style({
      id: 'without-line',
      type: 'annotationCallout',
      x: 40,
      y: 50,
      note: { label: 'No line', lineType: 'none' }
    });
    const label = annotationFromD3Style({
      id: 'label',
      type: 'annotationLabel',
      x: 40,
      y: 50,
      note: { label: 'Plain label', align: 'middle' }
    });

    expect(callout.note.line).toMatchObject({ orientation: 'horizontal' });
    expect(withoutLine.note.line).toBe(false);
    expect(label.note.line).toBeUndefined();
    expect(label.note.align).toBe('center');
  });

  it('round-trips edit suggestions back into d3-style coordinates and offsets', () => {
    const input = {
      id: 'editable',
      type: 'annotationCalloutCircle' as const,
      x: 100,
      y: 80,
      dx: 40,
      dy: -20,
      note: { label: 'Editable' },
      subject: { radius: 8 }
    };
    const next = applyD3StyleAnnotationEdit(input, {
      annotationId: 'editable',
      suggestedAnchor: { type: 'point', point: { x: 112, y: 90 } },
      suggestedPlacement: {
        side: 'right',
        manual: { x: 174, y: 60, side: 'right' }
      }
    });

    expect(next).toMatchObject({
      x: 112,
      y: 90,
      dx: 62,
      dy: -30,
      placement: {
        side: 'right',
        manual: { x: 174, y: 60, side: 'right' }
      }
    });
    expect(annotationFromD3Style(next).placement?.manual).toMatchObject({ x: 174, y: 60 });
  });

  it('round-trips d3-style edits through datum and inverse accessors', () => {
    const input = {
      id: 'datum-edit',
      data: { period: 2, score: 9, untouched: true },
      dx: 30,
      dy: -10,
      note: { label: 'Datum' }
    };
    const patch = d3StyleAnnotationEditPatch(input, {
      annotationId: 'datum-edit',
      suggestedAnchor: { type: 'point', point: { x: 90, y: 120 } },
      suggestedPlacement: {
        manual: { x: 130, y: 96 }
      }
    }, {
      x: (datum) => datum.period * 20,
      y: (datum) => datum.score * 10,
      accessorsInverse: {
        x: (value, datum) => ({ period: value / 20, score: datum?.score ?? 0 }),
        y: (value) => ({ score: value / 10 })
      }
    });

    expect(patch).toMatchObject({
      data: { period: 4.5, score: 12, untouched: true },
      dx: 40,
      dy: -24
    });
  });

  it('round-trips threshold path edits back into d3-style subject ranges', () => {
    const next = applyD3StyleAnnotationEdit({
      id: 'threshold-edit',
      type: 'annotationXYThreshold' as const,
      x: 0,
      y: 120,
      dx: 24,
      dy: -40,
      note: { label: 'Threshold' },
      subject: { x1: 20, x2: 220 }
    }, {
      annotationId: 'threshold-edit',
      suggestedAnchor: {
        type: 'path',
        points: [
          { x: 40, y: 144 },
          { x: 260, y: 144 }
        ]
      }
    });

    expect(next.y).toBe(144);
    expect(next.subject).toMatchObject({ x1: 40, x2: 260 });
  });

  it('round-trips d3-style negative callout rect anchor edits', () => {
    const next = applyD3StyleAnnotationEdit({
      id: 'negative-rect-edit',
      type: 'annotationCalloutRect' as const,
      x: 120,
      y: 80,
      note: { label: 'Negative rect edit' },
      subject: {
        x: 0,
        y: 0,
        width: -54,
        height: -28
      }
    }, {
      annotationId: 'negative-rect-edit',
      suggestedAnchor: {
        type: 'box',
        box: { x: 40, y: 30, width: 54, height: 28 }
      }
    });

    expect(next.x).toBe(94);
    expect(next.y).toBe(58);
    expect(annotationFromD3Style(next).anchor).toEqual({
      type: 'box',
      box: { x: 40, y: 30, width: 54, height: 28 }
    });
  });

  it('defines DOM-free d3-style custom annotation types with defaults and transforms', () => {
    const statusBand = defineD3StyleAnnotationType<{
      phase: string;
      severity?: string;
    }>({
      baseType: 'annotationCalloutRect',
      defaults: {
        dx: 56,
        dy: -32,
        tone: 'info',
        note: {
          lineType: 'vertical',
          bgPadding: 6
        },
        subject: {
          width: 88,
          height: 28,
          x: -44,
          y: -14
        },
        connector: {
          type: 'elbow',
          end: 'arrow'
        },
        style: {
          color: '#0f766e',
          lineColor: '#0f766e'
        },
        metadata: {
          customFamily: 'status-band'
        }
      },
      transform: (annotation, context) => ({
        ...annotation,
        variant: 'band',
        subject: {
          ...annotation.subject,
          shape: 'path',
          geometry: {
            type: 'band',
            width: 88,
            height: 28,
            x: -44,
            y: -14,
            padding: 3
          }
        },
        metadata: {
          ...annotation.metadata,
          customType: 'status-band',
          customIndex: context.index,
          originalId: context.input.id,
          mergedTone: context.mergedInput.tone
        }
      })
    });
    const annotation = statusBand({
      id: 'deploy-band',
      x: 160,
      y: 92,
      note: {
        label: 'Deployment gate'
      },
      data: {
        phase: 'deploy',
        severity: 'medium'
      },
      metadata: {
        source: 'fixture'
      },
      style: {
        noteBackground: '#ecfeff'
      }
    }, {}, 2);
    const layout = resolveAnnotationLayout({
      annotations: [annotation],
      bounds: { x: 0, y: 0, width: 360, height: 220 },
      noteSizes: {
        'deploy-band': { width: 118, height: 52 }
      }
    });
    const svg = renderAnnotationsSvg(layout);

    expect(annotation.anchor).toEqual({
      type: 'box',
      box: { x: 116, y: 78, width: 88, height: 28 }
    });
    expect(annotation.note.body).toBe('Deployment gate');
    expect(annotation.note.padding).toBe(6);
    expect(annotation.note.line).toMatchObject({ orientation: 'vertical' });
    expect(annotation.connector).toMatchObject({ type: 'elbow', end: 'arrow' });
    expect(annotation.style).toEqual({
      color: '#0f766e',
      lineColor: '#0f766e',
      noteBackground: '#ecfeff'
    });
    expect(annotation.variant).toBe('band');
    expect(annotation.tone).toBe('info');
    expect(annotation.metadata).toMatchObject({
      customFamily: 'status-band',
      customType: 'status-band',
      customIndex: 2,
      originalId: 'deploy-band',
      mergedTone: 'info',
      source: 'fixture',
      datum: {
        phase: 'deploy',
        severity: 'medium'
      },
      d3AnnotationType: 'callout-rect'
    });
    expect(svg).toContain('pa-annotation--band');
    expect(svg).toContain('pa-annotation__subject--geometry-band');
    expect(svg).toContain('marker-end');
  });

  it('converts arrays through DOM-free d3-style custom annotation types', () => {
    const rankedBadge = defineD3StyleAnnotationType({
      baseType: 'annotationBadge',
      defaults: {
        subject: {
          radius: 10,
          x: 'right',
          y: 'top'
        },
        tone: 'warning'
      },
      transform: (annotation, context) => ({
        ...annotation,
        metadata: {
          ...annotation.metadata,
          rank: context.index + 1
        }
      })
    });
    const annotations = annotationsFromD3StyleType(rankedBadge, [
      {
        id: 'first',
        x: 30,
        y: 40,
        subject: { text: '1' }
      },
      {
        id: 'second',
        x: 60,
        y: 80,
        subject: { text: '2', x: 'left' }
      }
    ]);

    expect(annotations).toHaveLength(2);
    expect(annotations[0]?.subject?.badge).toMatchObject({ label: '1', x: 'right', y: 'top' });
    expect(annotations[1]?.subject?.badge).toMatchObject({ label: '2', x: 'left', y: 'top' });
    expect(annotations[0]?.metadata?.rank).toBe(1);
    expect(annotations[1]?.metadata?.rank).toBe(2);
    expect(annotations[0]?.tone).toBe('warning');
    expect(annotations[1]?.tone).toBe('warning');
  });
});
