import { describe, expect, it } from 'vitest';
import {
  annotationEditPatch,
  annotationEditHandles,
  applyAnnotationEdit,
  applyAnnotationEdits,
  resolveAnnotationLayout,
  translateAnchor
} from '../../src/index.js';

describe('annotation edit handles', () => {
  it('creates deterministic note handles for resolved annotations', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'editable',
          anchor: { type: 'point', point: { x: 40, y: 40 } },
          note: { title: 'Editable note' },
          placement: { manual: { x: 80, y: 24 } }
        }
      ],
      bounds: { x: 0, y: 0, width: 240, height: 160 },
      noteSizes: {
        editable: { width: 100, height: 48 }
      }
    });

    expect(annotationEditHandles(layout)).toEqual([
      {
        id: 'editable:note',
        annotationId: 'editable',
        kind: 'note',
        point: { x: 180, y: 24 },
        box: { x: 170, y: 14, width: 20, height: 20 },
        radius: 5,
        hitRadius: 10,
        cursor: 'move',
        ariaLabel: 'Move note for Editable note',
        data: {
          annotationId: 'editable',
          editHandle: 'note',
          editHandlePosition: 'top-right'
        }
      }
    ]);
  });

  it('orders edit handles so higher-priority annotations remain on top', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'low',
          priority: 1,
          anchor: { type: 'point', point: { x: 40, y: 40 } },
          note: { title: 'Low priority' },
          placement: { manual: { x: 72, y: 24 } }
        },
        {
          id: 'high',
          priority: 8,
          anchor: { type: 'point', point: { x: 48, y: 48 } },
          note: { title: 'High priority' },
          placement: { manual: { x: 80, y: 32 } }
        }
      ],
      bounds: { x: 0, y: 0, width: 260, height: 180 },
      noteSizes: {
        high: { width: 100, height: 48 },
        low: { width: 100, height: 48 }
      }
    });

    expect(layout.annotations.map((item) => item.id)).toEqual(['high', 'low']);
    expect(annotationEditHandles(layout).map((handle) => handle.annotationId)).toEqual(['low', 'high']);
  });

  it('can place note handles on different note corners or the center', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'editable',
          anchor: { type: 'point', point: { x: 40, y: 40 } },
          note: { title: 'Editable note' },
          placement: { manual: { x: 80, y: 24 } }
        }
      ],
      bounds: { x: 0, y: 0, width: 240, height: 160 },
      noteSizes: {
        editable: { width: 100, height: 48 }
      }
    });

    expect(annotationEditHandles(layout, { noteHandlePosition: 'bottom-left' })[0]?.point)
      .toEqual({ x: 80, y: 72 });
    expect(annotationEditHandles(layout, { noteHandlePosition: 'bottom-right' })[0]?.point)
      .toEqual({ x: 180, y: 72 });
    expect(annotationEditHandles(layout, { noteHandlePosition: 'center' })[0]?.point)
      .toEqual({ x: 130, y: 48 });
  });

  it('can include anchor handles for authoring tools', () => {
    const layout = resolveAnnotationLayout({
      annotations: [
        {
          id: 'anchor',
          anchor: { type: 'point', point: { x: 40, y: 40 } },
          note: { title: 'Anchor note' },
          placement: { manual: { x: 80, y: 24 } }
        }
      ],
      bounds: { x: 0, y: 0, width: 240, height: 160 },
      noteSizes: {
        anchor: { width: 100, height: 48 }
      }
    });
    const handles = annotationEditHandles(layout, {
      includeAnchor: true,
      radius: 4,
      hitRadius: 8
    });

    expect(handles.map((handle) => handle.kind)).toEqual(['note', 'anchor']);
    expect(handles[0]?.radius).toBe(4);
    expect(handles[0]?.hitRadius).toBe(8);
    expect(handles[1]?.point).toEqual({ x: 40, y: 40 });
  });

  it('translates point, box, and path anchors for authoring callbacks', () => {
    expect(translateAnchor({ type: 'point', point: { x: 10, y: 20 } }, { x: 5.1234, y: -2 }))
      .toEqual({ type: 'point', point: { x: 15.123, y: 18 } });
    expect(translateAnchor({
      type: 'box',
      box: { x: 10, y: 20, width: 30, height: 40 },
      side: 'left'
    }, { x: 5, y: -2 })).toEqual({
      type: 'box',
      box: { x: 15, y: 18, width: 30, height: 40 },
      side: 'left'
    });
    expect(translateAnchor({
      type: 'path',
      points: [{ x: 0, y: 0 }, { x: 10, y: 20 }]
    }, { x: 1, y: 2 })).toEqual({
      type: 'path',
      points: [{ x: 1, y: 2 }, { x: 11, y: 22 }]
    });
  });

  it('builds edit patches from React-style suggestions', () => {
    expect(annotationEditPatch({
      annotationId: 'editable',
      suggestedPlacement: {
        manual: { x: 80, y: 24, side: 'right' }
      }
    })).toEqual({
      annotationId: 'editable',
      placement: {
        manual: { x: 80, y: 24, side: 'right' }
      }
    });

    expect(annotationEditPatch({
      annotationId: 'editable',
      suggestedAnnotation: {
        id: 'editable',
        anchor: { type: 'point', point: { x: 72, y: 88 } },
        note: { title: 'Edited' }
      }
    })).toEqual({
      annotationId: 'editable',
      anchor: { type: 'point', point: { x: 72, y: 88 } }
    });
  });

  it('applies note placement and anchor edit patches without replacing annotation content', () => {
    const annotation = {
      id: 'editable',
      anchor: { type: 'point' as const, point: { x: 40, y: 40 } },
      note: { title: 'Original', body: 'Keep this copy.' },
      tone: 'info' as const
    };
    const movedNote = applyAnnotationEdit(annotation, {
      annotationId: 'editable',
      suggestedPlacement: {
        manual: { x: 120, y: 32, side: 'right', align: 'center' }
      },
      suggestedAnnotation: {
        ...annotation,
        note: { title: 'Stale event copy' },
        placement: { manual: { x: 120, y: 32, side: 'right', align: 'center' } }
      }
    });
    const movedAnchor = applyAnnotationEdit(movedNote, {
      annotationId: 'editable',
      anchor: { type: 'point', point: { x: 52, y: 64 } }
    });

    expect(movedNote.note).toEqual(annotation.note);
    expect(movedNote.tone).toBe('info');
    expect(movedNote.placement?.manual).toEqual({ x: 120, y: 32, side: 'right', align: 'center' });
    expect(movedAnchor.anchor).toEqual({ type: 'point', point: { x: 52, y: 64 } });
  });

  it('applies edit patches to annotation arrays and can enforce missing targets', () => {
    const annotations = [
      {
        id: 'first',
        anchor: { type: 'point' as const, point: { x: 10, y: 20 } },
        note: { title: 'First' }
      },
      {
        id: 'second',
        anchor: { type: 'point' as const, point: { x: 30, y: 40 } },
        note: { title: 'Second' }
      }
    ];
    const next = applyAnnotationEdits(annotations, [
      {
        annotationId: 'second',
        suggestedAnchor: { type: 'point', point: { x: 36, y: 48 } }
      }
    ]);

    expect(next[0]).toBe(annotations[0]);
    expect(next[1]).not.toBe(annotations[1]);
    expect(next[1]?.anchor).toEqual({ type: 'point', point: { x: 36, y: 48 } });
    expect(() => applyAnnotationEdits(annotations, {
      annotationId: 'missing',
      anchor: { type: 'point', point: { x: 0, y: 0 } }
    }, { missing: 'throw' })).toThrow('Annotation edit target not found: missing');
  });
});
