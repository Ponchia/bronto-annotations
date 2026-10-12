import { describe, expect, it } from 'vitest';
import { createIncrementalAnnotationLayoutSession, resolveAnnotationLayout } from '../../src/index.js';
import { EDITOR_MAX_NOTES, parseEditorAnnotationJson } from '../../examples/react-incremental/json-import.js';
import type { Annotation } from '../../src/index.js';

const base: Annotation[] = [
  {
    id: 'intake',
    priority: 4,
    anchor: { type: 'box', box: { x: 102, y: 210, width: 170, height: 80 } },
    note: { title: 'Intake', body: 'An authored source note.' },
    placement: { manual: { x: 70, y: 92, side: 'top' } }
  },
  {
    id: 'signal',
    priority: 1,
    anchor: { type: 'point', point: { x: 435, y: 248 } },
    note: { title: 'Live marker', body: 'Move or drag.' },
    placement: { manual: { x: 307, y: 83, side: 'top' } }
  }
];

describe('host-owned JSON import for the incremental React example', () => {
  it('round-trips the exact exported basic fields without adding computed layout data', () => {
    const restored = parseEditorAnnotationJson(JSON.stringify(base));
    expect(restored).toEqual(base);
    const options = {
      annotations: restored,
      bounds: { x: 0, y: 0, width: 860, height: 500 },
      refinement: false as const
    };
    const session = createIncrementalAnnotationLayoutSession(options);
    expect(session.layout).toEqual(resolveAnnotationLayout(options));
    expect(restored.some((item) => Object.hasOwn(item, 'candidates'))).toBe(false);
  });

  it('accepts a validated custom note and basic manual placement options', () => {
    const notes = parseEditorAnnotationJson(JSON.stringify([{
      id: 'Nota 1: Übersicht',
      anchor: { type: 'point', point: { x: 220, y: 80 } },
      note: { body: 'Additional comment', ariaLabel: 'Detail', visible: true, align: 'center' },
      placement: {
        manual: { x: 310, y: 90, side: 'right', align: 'start', clamp: true },
        side: 'right', offset: 14, crossOffset: 0
      }
    }]));
    expect(notes).toEqual([{
      id: 'Nota 1: Übersicht', anchor: { type: 'point', point: { x: 220, y: 80 } },
      note: { body: 'Additional comment', ariaLabel: 'Detail', visible: true, align: 'center' },
      placement: {
        manual: { x: 310, y: 90, side: 'right', align: 'start', clamp: true },
        side: 'right', offset: 14, crossOffset: 0
      }
    }]);
  });

  it('keeps the maximum accepted document size explicit and round-trippable', () => {
    const maximal = Array.from({ length: EDITOR_MAX_NOTES }, (_, index) => ({
      id: `note-${index}`,
      anchor: { type: 'point', point: { x: 45 + index * 70, y: 410 } },
      note: { title: `Imported ${index + 1}` }
    }));
    const accepted = parseEditorAnnotationJson(JSON.stringify(maximal));
    expect(accepted).toEqual(maximal);
    expect(accepted).toHaveLength(EDITOR_MAX_NOTES);
    const extra = [...maximal, { ...maximal[0], id: 'extra' }];
    expect(() => parseEditorAnnotationJson(JSON.stringify(extra))).toThrow(
      `1 to ${EDITOR_MAX_NOTES} annotation objects`
    );
  });

  it('rejects malformed, duplicate and non-finite entries with useful errors', () => {
    expect(() => parseEditorAnnotationJson('{bad-json')).toThrow('Invalid JSON');
    expect(() => parseEditorAnnotationJson('{}')).toThrow('Expected an array');
    expect(() => parseEditorAnnotationJson('[]')).toThrow('Expected an array');
    expect(() => parseEditorAnnotationJson(JSON.stringify([...base, base[0]]))).toThrow('Duplicate');
    const bad = JSON.stringify(base).replace('"x":435', '"x":1e999');
    expect(() => parseEditorAnnotationJson(bad)).toThrow('finite number');
    expect(() => parseEditorAnnotationJson('x'.repeat(24001))).toThrow('character demo limit');
    expect(() => parseEditorAnnotationJson(JSON.stringify(Array(11).fill(base[0])))).toThrow('1 to 10');
  });

  it('fails closed on unsupported shapes, extra fields and invalid manual placements', () => {
    const malformed = structuredClone(base);
    malformed[0]!.anchor = { type: 'path', points: [{ x: 1, y: 2 }, { x: 5, y: 6 }] };
    expect(() => parseEditorAnnotationJson(JSON.stringify(malformed))).toThrow('point" or "box"');
    const withMetadata = structuredClone(base) as unknown as Record<string, unknown>[];
    withMetadata[0]!.metadata = { "__proto__": { unsafe: true } };
    expect(() => parseEditorAnnotationJson(JSON.stringify(withMetadata))).toThrow('unsupported field "metadata"');
    const wrongSide = structuredClone(base);
    wrongSide[1]!.placement!.manual!.side = 'outside' as never;
    expect(() => parseEditorAnnotationJson(JSON.stringify(wrongSide))).toThrow('must be one of');
    const badId = structuredClone(base);
    badId[1]!.id = 'bad\u0000id';
    expect(() => parseEditorAnnotationJson(JSON.stringify(badId))).toThrow('control characters');
    const missingNote = structuredClone(base);
    missingNote[0]!.note = {};
    expect(() => parseEditorAnnotationJson(JSON.stringify(missingNote))).toThrow('needs a title or body');
    const negativeBox = structuredClone(base);
    if (negativeBox[0]!.anchor.type !== 'box') throw new Error('Expected box fixture');
    negativeBox[0]!.anchor.box.width = -1;
    expect(() => parseEditorAnnotationJson(JSON.stringify(negativeBox))).toThrow('finite number');
  });
});
