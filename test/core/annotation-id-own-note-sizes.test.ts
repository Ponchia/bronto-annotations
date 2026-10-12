import { describe, expect, it } from 'vitest';
import {
  createIncrementalAnnotationLayoutSession,
  estimateNoteSize,
  resolveAnnotationLayout,
  type Annotation,
  type LayoutOptions,
  type Size
} from '../../src/index.js';

const bounds = { x: 0, y: 0, width: 1000, height: 700 };

function annotation(id: string): Annotation {
  return {
    id,
    anchor: { type: 'point', point: { x: 330, y: 240 } },
    note: { title: `Annotation ${id}`, body: 'Source-provided identifier' },
    connector: { type: 'none' },
    placement: { manual: { x: 410, y: 180, side: 'right' } }
  };
}

function options(note: Annotation, noteSizes?: Record<string, Size>): LayoutOptions {
  return {
    annotations: [note], bounds,
    ...(noteSizes === undefined ? {} : { noteSizes }),
    refinement: false
  };
}

describe('host note-size lookup uses only own annotation IDs', () => {
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'treats %s as an ordinary annotation identifier with no inherited size',
    (id) => {
      const item = annotation(id);
      const explicitEmpty = {};
      const resolved = resolveAnnotationLayout(options(item, explicitEmpty));
      const expected = resolveAnnotationLayout(options(item));
      expect(resolved.annotations).toHaveLength(1);
      expect(resolved.annotations[0]!.noteBox).toEqual(expected.annotations[0]!.noteBox);
      expect(resolved.annotations[0]!.noteBox.width).toBe(estimateNoteSize(item).width);
      expect(resolved.annotations[0]!.noteBox.height).toBe(estimateNoteSize(item).height);
      for (const coordinate of Object.values(resolved.annotations[0]!.noteBox)) {
        expect(Number.isFinite(coordinate)).toBe(true);
      }
    }
  );

  it('ignores inherited map entries, even when an inherited size is well-formed', () => {
    const item = annotation('custom host key');
    const sizes = Object.create({ 'custom host key': { width: 300, height: 250 } }) as Record<string, Size>;
    sizes.another = { width: 80, height: 60 };
    expect(resolveAnnotationLayout(options(item, sizes)).annotations[0]!.noteBox)
      .toEqual(resolveAnnotationLayout(options(item)).annotations[0]!.noteBox);
  });

  it('still accepts explicit own keys on ordinary and null-prototype maps', () => {
    const item = annotation('__proto__');
    const regular = Object.fromEntries([['__proto__', { width: 160, height: 70 }]]);
    const nullPrototype = Object.assign(Object.create(null) as Record<string, Size>, regular);
    for (const sizes of [regular, nullPrototype]) {
      const layout = resolveAnnotationLayout(options(item, sizes));
      expect(layout.annotations[0]!.noteBox).toMatchObject({ width: 160, height: 70 });
    }
  });

  it('keeps incremental session results aligned with fresh full layouts across ID-sensitive updates', () => {
    const item = annotation('__proto__');
    const current = options(item, {});
    const session = createIncrementalAnnotationLayoutSession(current);
    expect(session.layout).toEqual(resolveAnnotationLayout(current));

    const updated = options({ ...item, note: { title: 'Changed title for reserved-looking ID' } }, {});
    expect(session.update(updated)).toEqual(resolveAnnotationLayout(updated));
    const withOwnSize = options(updated.annotations[0]!, Object.fromEntries([
      ['__proto__', { width: 190, height: 74 }]
    ]));
    expect(session.update(withOwnSize)).toEqual(resolveAnnotationLayout(withOwnSize));

    const cleared = options(updated.annotations[0]!, {});
    expect(session.update(cleared)).toEqual(resolveAnnotationLayout(cleared));
  });
});
