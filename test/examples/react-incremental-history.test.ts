import { describe, expect, it } from 'vitest';
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  resolveAnnotationLayout,
  type Annotation
} from '../../src/index.js';
import {
  createEditorHistory, pushEditorHistory, undoEditorHistory, redoEditorHistory,
  EDITOR_HISTORY_LIMIT
} from '../../examples/react-incremental/editor-history.js';
import { parseEditorAnnotationJson } from '../../examples/react-incremental/json-import.js';

const original: Annotation[] = [
  {
    id: 'intake',
    anchor: { type: 'box', box: { x: 40, y: 110, width: 120, height: 55 } },
    note: { title: 'Intake' },
    placement: { manual: { x: 42, y: 36, side: 'top' } }
  },
  {
    id: 'signal',
    anchor: { type: 'point', point: { x: 275, y: 142 } },
    note: { title: 'Signal' },
    placement: { manual: { x: 240, y: 28, side: 'right' } }
  }
];

function options(annotations: Annotation[]) {
  return {
    annotations,
    bounds: { x: 0, y: 0, width: 440, height: 310 },
    refinement: false as const
  };
}

describe('host-owned React annotation authoring history', () => {
  it('keeps independent snapshots, skips no-op steps and caps the undo memory', () => {
    const source = structuredClone(original);
    let history = createEditorHistory(source);
    source[0]!.note.title = 'Mutated outside the editor';
    expect(history.present.annotations[0]!.note.title).toBe('Intake');
    expect(history.past).toHaveLength(0);
    expect(undoEditorHistory(history)).toBe(history);
    expect(redoEditorHistory(history)).toBe(history);

    expect(pushEditorHistory(history, structuredClone(original), 'No change')).toBe(history);
    for (let index = 0; index < 45; index++) {
      const changed = structuredClone(original);
      changed[1]!.note.title = `New title ${index}`;
      history = pushEditorHistory(history, changed, `Edit ${index}`);
      changed[1]!.note.title = 'Mutated later';
      expect(history.present.annotations[1]!.note.title).toBe(`New title ${index}`);
    }
    expect(history.past).toHaveLength(EDITOR_HISTORY_LIMIT);
    for (let index = 0; index < EDITOR_HISTORY_LIMIT; index++) {
      history = undoEditorHistory(history);
    }
    expect(history.past).toHaveLength(0);
    expect(history.future).toHaveLength(EDITOR_HISTORY_LIMIT);
    expect(history.present.action).toBe('Edit 14');
    expect(undoEditorHistory(history)).toBe(history);
  });

  it('restores earlier edits and import snapshots, redoes, then clears redo on a new branch', () => {
    const initial = createEditorHistory(original);
    const moved = structuredClone(original);
    if (moved[1]!.anchor.type !== 'point') throw new Error('Expected point');
    moved[1]!.anchor.point.x += 40;
    const afterMove = pushEditorHistory(initial, moved, 'Moved signal');
    expect(afterMove.past).toHaveLength(1);
    expect(afterMove.future).toHaveLength(0);

    const imported = parseEditorAnnotationJson(JSON.stringify([
      original[0],
      { id: 'annotation-import', anchor: {
        type: 'point', point: { x: 210, y: 228 }
      }, note: { title: 'Imported note' } }
    ]));
    const afterImport = pushEditorHistory(afterMove, imported, 'Imported two annotations');
    expect(afterImport.past).toHaveLength(2);

    const undoneImport = undoEditorHistory(afterImport);
    expect(undoneImport.present.annotations).toEqual(moved);
    expect(undoneImport.future[0]?.action).toBe('Imported two annotations');
    expect(redoEditorHistory(undoneImport).present.annotations).toEqual(imported);

    const undoneMove = undoEditorHistory(undoneImport);
    expect(undoneMove.present.annotations).toEqual(original);
    expect(redoEditorHistory(undoneMove).present.annotations).toEqual(moved);

    // A new authoring transaction clears the old redo branch, but a no-op
    // keeps it so the user can still return to an imported document.
    expect(pushEditorHistory(undoneImport, moved, 'No change')).toBe(undoneImport);
    const newBranch = structuredClone(moved);
    newBranch[0]!.note.title = 'Alternative description';
    const branched = pushEditorHistory(undoneImport, newBranch, 'New branch');
    expect(branched.future).toHaveLength(0);
    expect(redoEditorHistory(branched)).toBe(branched);
    expect(undoEditorHistory(branched).present.annotations).toEqual(moved);
  });

  it('replays imported, removed and dragged inputs through the same authoritative layout', () => {
    let history = createEditorHistory(original);
    const session = createIncrementalAnnotationLayoutSession(options(history.present.annotations));
    const expectParity = (annotations: Annotation[]) => {
      const actual = session.update(options(annotations));
      const fresh = resolveAnnotationLayout(options(annotations));
      expect(actual).toEqual(fresh);
      expect(evaluateAnnotationLayout(actual)).toEqual(evaluateAnnotationLayout(fresh));
    };

    const dragged = structuredClone(original);
    dragged[1]!.placement!.manual!.x += 21;
    history = pushEditorHistory(history, dragged, 'Dragged last note');
    expectParity(history.present.annotations);

    const imported = parseEditorAnnotationJson(JSON.stringify([
      dragged[0],
      { id: 'new', anchor: { type: 'point', point: { x: 300, y: 220 } },
        note: { title: 'New arrival' } }
    ]));
    history = pushEditorHistory(history, imported, 'Imported JSON');
    expectParity(history.present.annotations);

    history = undoEditorHistory(history);
    expectParity(history.present.annotations);
    history = undoEditorHistory(history);
    expectParity(history.present.annotations);
    history = redoEditorHistory(history);
    expectParity(history.present.annotations);
    history = redoEditorHistory(history);
    expectParity(history.present.annotations);

    const reset = pushEditorHistory(history, original, 'Reset to initial diagram');
    history = reset;
    expectParity(history.present.annotations);
    history = undoEditorHistory(history);
    expect(history.present.annotations).toEqual(imported);
    expectParity(history.present.annotations);
  });
});
