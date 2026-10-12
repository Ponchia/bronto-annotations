import { describe, expect, it } from 'vitest';
import type { Annotation } from '../../src/index.js';
import { createIncrementalAnnotationLayoutSession, resolveAnnotationLayout } from '../../src/index.js';
import { parseEditorAnnotationJson, EDITOR_MAX_NOTES } from '../../examples/react-incremental/json-import.js';
import { appendDemoNote, removeFinalNote } from '../../examples/react-incremental/note-actions.js';
import {
  createEditorHistory, pushEditorHistory, undoEditorHistory, redoEditorHistory
} from '../../examples/react-incremental/editor-history.js';

const seed: Annotation[] = [
  { id: 'first', anchor: { type: 'point', point: { x: 70, y: 90 } },
    note: { title: 'First' }, placement: { manual: { x: 140, y: 45, side: 'right' } } },
  { id: 'second', anchor: { type: 'point', point: { x: 240, y: 220 } },
    note: { title: 'Second' } }
];

describe('host-owned interactive demo note actions', () => {
  it('appends a note without mutating the original or overwriting imported IDs', () => {
    const first = appendDemoNote(seed);
    expect(first.map((item) => item.id)).toEqual(['first', 'second', 'added']);
    expect(first[0]).toBe(seed[0]);
    expect(first[1]).toBe(seed[1]);
    expect(seed).toHaveLength(2);
    expect(parseEditorAnnotationJson(JSON.stringify(first))).toEqual(first);

    const imported: Annotation[] = [
      ...seed,
      { id: 'added', anchor: { type: 'point', point: { x: 80, y: 215 } },
        note: { title: 'This imported note must not be touched' } },
      { id: 'added-2', anchor: { type: 'point', point: { x: 85, y: 226 } },
        note: { title: 'Another imported note' } }
    ];
    const appended = appendDemoNote(imported);
    expect(appended.at(-1)?.id).toBe('added-3');
    expect(appended.slice(0, imported.length)).toEqual(imported);
    expect(parseEditorAnnotationJson(JSON.stringify(appended))).toEqual(appended);
  });

  it('removes only the final note, including when the imported document used "added"', () => {
    const imported = parseEditorAnnotationJson(JSON.stringify([
      ...seed,
      { id: 'added', anchor: { type: 'point', point: { x: 80, y: 220 } },
        note: { title: 'User supplied' } }
    ]));
    const withDemo = appendDemoNote(imported);
    expect(withDemo.at(-1)?.id).toBe('added-2');
    const removed = removeFinalNote(withDemo);
    expect(removed).toEqual(imported);
    expect(removed[2]).toBe(imported[2]);
    expect(removeFinalNote([seed[0]!])).toEqual([seed[0]!]);
    const single = [seed[0]!];
    expect(removeFinalNote(single)).toBe(single);
  });

  it('never generates an unimportable note count and allows further edits after removal', () => {
    const full = Array.from({ length: EDITOR_MAX_NOTES }, (_, i): Annotation => ({
      id: `note-${i}`,
      anchor: { type: 'point', point: { x: 50 + i * 65, y: 410 } },
      note: { title: `Note ${i}` }
    }));
    expect(appendDemoNote(full)).toBe(full);
    const shortened = removeFinalNote(full);
    expect(shortened).toHaveLength(EDITOR_MAX_NOTES - 1);
    const appended = appendDemoNote(shortened);
    expect(appended).toHaveLength(EDITOR_MAX_NOTES);
    expect(parseEditorAnnotationJson(JSON.stringify(appended))).toEqual(appended);
  });

  it('keeps append/remove as undoable authoritative layout transactions', () => {
    let history = createEditorHistory(seed);
    const session = createIncrementalAnnotationLayoutSession({
      annotations: seed,
      bounds: { x: 0, y: 0, width: 860, height: 500 },
      refinement: false
    });
    const compare = (annotations: Annotation[]) => {
      const options = { annotations, bounds: { x: 0, y: 0, width: 860, height: 500 }, refinement: false as const };
      expect(session.update(options)).toEqual(resolveAnnotationLayout(options));
    };
    history = pushEditorHistory(history, appendDemoNote(history.present.annotations), 'Add');
    compare(history.present.annotations);
    history = pushEditorHistory(history, removeFinalNote(history.present.annotations), 'Remove');
    compare(history.present.annotations);
    history = undoEditorHistory(history);
    expect(history.present.annotations).toHaveLength(3);
    compare(history.present.annotations);
    history = redoEditorHistory(history);
    expect(history.present.annotations).toHaveLength(2);
    compare(history.present.annotations);
  });
});
