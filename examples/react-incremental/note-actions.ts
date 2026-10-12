/**
 * Host-only Add/Remove actions for the interactive annotations example.
 *
 * Imported IDs are arbitrary host data. Never reserve the demo's "added" ID:
 * choose a free identifier and remove the explicit final item, rather than
 * accidentally deleting or overwriting an imported note named "added".
 */
import type { Annotation } from '@ponchia/annotations';
import { EDITOR_MAX_NOTES, EDITOR_PRIORITY_MIN } from './json-import.js';

export function appendDemoNote(annotations: Annotation[]): Annotation[] {
  if (annotations.length >= EDITOR_MAX_NOTES) return annotations;
  const ids = new Set(annotations.map((item) => item.id));
  let id = 'added';
  for (let suffix = 2; ids.has(id); suffix += 1) id = `added-${suffix}`;

  // Imported documents may contain negative priorities. Appending at 0
  // would unexpectedly *promote* the added note ahead of those annotations,
  // invalidating their previously settled placements. Use a priority below
  // all existing values whenever the JSON schema allows it.
  // At the -100 import floor, reuse that value rather than generating a note
  // this same editor could not import. Equal-priority IDs use lexical ordering
  // in the core, so the floor remains a deliberately non-guaranteed reuse case.
  const lowest = annotations.reduce(
    (minimum, note) => Math.min(minimum, note.priority ?? 0), 0
  );
  const appendedPriority = Math.max(EDITOR_PRIORITY_MIN, lowest - 1);

  return [...annotations, {
    id,
    priority: appendedPriority,
    anchor: { type: 'point', point: { x: 689, y: 250 } },
    note: { title: 'New annotation', body: 'Unchanged placements can be reused.' },
    placement: { manual: { x: 637, y: 354, side: 'bottom' } }
  }];
}

export function removeFinalNote(annotations: Annotation[]): Annotation[] {
  // The small editor's JSON importer requires at least one note.
  if (annotations.length <= 1) return annotations;
  return annotations.slice(0, -1);
}

/**
 * Move the final authored anchor, not a reserved demo ID. Imported JSON
 * can replace every built-in note, and its last anchor may be a point *or*
 * a box. Keep the source geometry type, box dimensions, and earlier notes
 * unchanged; never generate coordinates outside the demo import's bounds.
 */
export function moveFinalNoteAnchor(annotations: Annotation[]): Annotation[] {
  if (!annotations.length) return annotations;
  const last = annotations[annotations.length - 1]!;
  const nudge = (value: number, delta: number) =>
    value + delta <= 2_000 ? value + delta : value - delta;
  const anchor = last.anchor;
  const updated = anchor.type === 'point'
    ? { ...anchor, point: {
      x: nudge(anchor.point.x, 55),
      y: nudge(anchor.point.y, 52)
    } }
    : anchor.type === 'box'
      ? { ...anchor, box: {
        ...anchor.box,
        x: nudge(anchor.box.x, 55),
        y: nudge(anchor.box.y, 52)
      } }
      : null;
  if (!updated) return annotations;
  return [...annotations.slice(0, -1), { ...last, anchor: updated }];
}
