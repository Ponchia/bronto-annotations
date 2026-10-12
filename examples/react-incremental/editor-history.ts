/**
 * Small, host-owned authoring history for the interactive React demo.
 *
 * Only committed JSON-compatible annotation inputs belong here, never a
 * resolved candidate graph, worker reply, pointer-move preview or DOM object.
 * Production hosts should use their own app state and persistence model.
 */
import type { Annotation } from '@ponchia/annotations';

export const EDITOR_HISTORY_LIMIT = 30;

type EditorHistoryEntry = Readonly<{
  annotations: Annotation[];
  action: string;
}>;

export type EditorHistory = Readonly<{
  past: readonly EditorHistoryEntry[];
  present: EditorHistoryEntry;
  future: readonly EditorHistoryEntry[];
}>;

function snapshot(annotations: Annotation[], action: string): EditorHistoryEntry {
  // Detached immutable-by-convention inputs: a host commit or later edit
  // cannot retrospectively mutate another step in the history.
  return { annotations: structuredClone(annotations), action };
}

export function createEditorHistory(annotations: Annotation[]): EditorHistory {
  return { past: [], present: snapshot(annotations, 'Initial layout'), future: [] };
}

export function pushEditorHistory(
  history: EditorHistory, annotations: Annotation[], action: string
): EditorHistory {
  // This demo's imported inputs are deliberately JSON-only. Identical
  // authored values should not create an extra undo step or delete redo.
  if (JSON.stringify(history.present.annotations) === JSON.stringify(annotations)) {
    return history;
  }
  return {
    past: [...history.past, history.present].slice(-EDITOR_HISTORY_LIMIT),
    present: snapshot(annotations, action),
    future: []
  };
}

export function undoEditorHistory(history: EditorHistory): EditorHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1]!,
    future: [history.present, ...history.future]
  };
}

export function redoEditorHistory(history: EditorHistory): EditorHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present].slice(-EDITOR_HISTORY_LIMIT),
    present: history.future[0]!,
    future: history.future.slice(1)
  };
}
