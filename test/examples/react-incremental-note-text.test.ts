import { describe, expect, it } from 'vitest';
import type { Annotation } from '../../src/index.js';
import { editAnnotationText } from '../../examples/react-incremental/note-text-editor.js';
import { parseEditorAnnotationJson } from '../../examples/react-incremental/json-import.js';
import {
  createEditorHistory, pushEditorHistory, undoEditorHistory, redoEditorHistory
} from '../../examples/react-incremental/editor-history.js';

const source: Annotation[] = [
  { id: 'first', priority: 2,
    anchor: { type: 'point', point: { x: 70, y: 90 } },
    note: { title: 'Before', body: 'Previous body', ariaLabel: 'First callout' },
    placement: { manual: { x: 120, y: 45, side: 'right' } } },
  { id: 'second', anchor: { type: 'box', box: { x: 220, y: 200, width: 30, height: 35 } },
    note: { body: 'Second callout' } }
];

describe('host-owned note text authoring', () => {
  it('changes only the selected note and remains JSON round-trippable', () => {
    const next = editAnnotationText(source, 'first', 'Revised', 'Useful explanation');
    expect(next).not.toBe(source);
    expect(next[0]).not.toBe(source[0]);
    expect(next[1]).toBe(source[1]);
    expect(next[0]!.note).toEqual({
      title: 'Revised', body: 'Useful explanation', ariaLabel: 'First callout'
    });
    expect(next[0]!.anchor).toBe(source[0]!.anchor);
    expect(next[0]!.placement).toBe(source[0]!.placement);
    expect(source[0]!.note.title).toBe('Before');
    expect(parseEditorAnnotationJson(JSON.stringify(next))).toEqual(next);
    expect(editAnnotationText(next, 'first', 'Revised', 'Useful explanation')).toBe(next);
  });

  it('allows body-only and title-only notes without exporting empty fields', () => {
    const titleOnly = editAnnotationText(source, 'first', 'Revised', '');
    expect(Object.hasOwn(titleOnly[0]!.note, 'body')).toBe(false);
    const bodyOnly = editAnnotationText(titleOnly, 'first', '', 'Explanation');
    expect(Object.hasOwn(bodyOnly[0]!.note, 'title')).toBe(false);
    expect(parseEditorAnnotationJson(JSON.stringify(bodyOnly))).toEqual(bodyOnly);
  });

  it('rejects an unavailable note, empty text and unimportable field lengths', () => {
    expect(() => editAnnotationText(source, 'missing', 'New', 'Body')).toThrow('no longer present');
    expect(() => editAnnotationText(source, 'first', ' ', '  ')).toThrow('title or body');
    expect(() => editAnnotationText(source, 'first', 'x'.repeat(101), '')).toThrow('at most 100');
    expect(() => editAnnotationText(source, 'first', 'Okay', 'x'.repeat(401))).toThrow('at most 400');
    expect(source[0]!.note.title).toBe('Before');
  });

  it('adds one undoable transaction and preserves no-op and redo behavior', () => {
    const initial = createEditorHistory(source);
    const edited = editAnnotationText(initial.present.annotations, 'first', 'Changed', 'Updated');
    const history = pushEditorHistory(initial, edited, 'Edited first note text');
    expect(history.past).toHaveLength(1);
    expect(history.present.annotations[0]!.note.title).toBe('Changed');

    const undone = undoEditorHistory(history);
    expect(undone.present.annotations[0]!.note.title).toBe('Before');
    expect(redoEditorHistory(undone).present.annotations[0]!.note.title).toBe('Changed');
    const unchanged = editAnnotationText(undone.present.annotations, 'first', 'Before', 'Previous body');
    expect(pushEditorHistory(undone, unchanged, 'No-op')).toBe(undone);
    expect(redoEditorHistory(undone).present.annotations[0]!.note.title).toBe('Changed');
  });
});
