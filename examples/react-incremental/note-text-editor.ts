/**
 * Tiny host-owned text-edit transaction for the interactive example.
 *
 * The library does not own forms, draft state, undo history or persistence.
 * Keep the result within the same subset and length bounds as JSON import so
 * an ordinary form edit can always be exported and reloaded in this demo.
 */
import type { Annotation } from '@ponchia/annotations';
import { EDITOR_TITLE_MAX_LENGTH, EDITOR_BODY_MAX_LENGTH } from './json-import.js';

export function editAnnotationText(
  annotations: Annotation[],
  id: string,
  title: string,
  body: string
): Annotation[] {
  if (typeof title !== 'string' || title.length > EDITOR_TITLE_MAX_LENGTH) {
    throw new Error(`Title must be at most ${EDITOR_TITLE_MAX_LENGTH} characters.`);
  }
  if (typeof body !== 'string' || body.length > EDITOR_BODY_MAX_LENGTH) {
    throw new Error(`Body must be at most ${EDITOR_BODY_MAX_LENGTH} characters.`);
  }
  if (!title.trim() && !body.trim()) {
    throw new Error('An annotation needs a title or body.');
  }
  const previous = annotations.find((item) => item.id === id);
  if (!previous) throw new Error('The selected annotation is no longer present.');

  const note = { ...previous.note };
  if (title.length > 0) note.title = title;
  else delete note.title;
  if (body.length > 0) note.body = body;
  else delete note.body;

  // A no-op must not trigger a full layout solve, discard a redo branch or
  // alter previously verified identities.
  if (previous.note.title === note.title && previous.note.body === note.body) {
    return annotations;
  }
  return annotations.map((item) => item.id === id ? { ...item, note } : item);
}
