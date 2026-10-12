/**
 * Host-only Add/Remove actions for the interactive annotations example.
 *
 * Imported IDs are arbitrary host data. Never reserve the demo's "added" ID:
 * choose a free identifier and remove the explicit final item, rather than
 * accidentally deleting or overwriting an imported note named "added".
 */
import type { Annotation } from '@ponchia/annotations';
import { EDITOR_MAX_NOTES } from './json-import.js';

export function appendDemoNote(annotations: Annotation[]): Annotation[] {
  if (annotations.length >= EDITOR_MAX_NOTES) return annotations;
  const ids = new Set(annotations.map((item) => item.id));
  let id = 'added';
  for (let suffix = 2; ids.has(id); suffix += 1) id = `added-${suffix}`;

  return [...annotations, {
    id,
    priority: 0,
    anchor: { type: 'point', point: { x: 689, y: 250 } },
    note: { title: 'New annotation', body: 'Earlier placements are unchanged.' },
    placement: { manual: { x: 637, y: 354, side: 'bottom' } }
  }];
}

export function removeFinalNote(annotations: Annotation[]): Annotation[] {
  // The small editor's JSON importer requires at least one note.
  if (annotations.length <= 1) return annotations;
  return annotations.slice(0, -1);
}
