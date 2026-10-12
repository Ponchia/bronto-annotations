import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Annotation } from '@ponchia/annotations';
import {
  EDITOR_TITLE_MAX_LENGTH,
  EDITOR_BODY_MAX_LENGTH
} from './json-import.js';

export function NoteTextEditor({
  annotation,
  annotations,
  onSelect,
  onApply
}: {
  annotation: Annotation;
  annotations: readonly Annotation[];
  onSelect: (id: string) => void;
  onApply: (id: string, title: string, body: string) => void;
}) {
  // Draft changes never affect the authoritative layout or editor history
  // until the author presses Apply. The parent remounts this component after
  // selecting another note, importing, committing, undoing or redoing.
  const [title, setTitle] = useState(annotation.note.title ?? '');
  const [body, setBody] = useState(annotation.note.body ?? '');
  const [error, setError] = useState('');
  const changed = title !== (annotation.note.title ?? '') || body !== (annotation.note.body ?? '');
  const missingContent = !title.trim() && !body.trim();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || missingContent) return;
    try {
      onApply(annotation.id, title, body);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this note.');
    }
  }

  return (
    <section className="note-text-editor" aria-labelledby="note-text-editor-title">
      <div className="note-text-editor-heading">
        <h2 id="note-text-editor-title">Edit annotation text</h2>
        <p>Click or focus a note in the diagram to select it, or use the menu. Apply creates one undoable commit.</p>
      </div>
      <form onSubmit={apply}>
        <div className="note-text-editor-grid">
          <div>
            <label htmlFor="text-editor-note">Annotation</label>
            <select id="text-editor-note" value={annotation.id}
              onChange={(event) => onSelect(event.target.value)}>
              {annotations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.note.title?.trim() || item.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="text-editor-title">Title</label>
            <input id="text-editor-title" type="text" value={title}
              maxLength={EDITOR_TITLE_MAX_LENGTH}
              onChange={(event) => { setTitle(event.target.value); setError(''); }} />
          </div>
          <div className="note-text-editor-body">
            <label htmlFor="text-editor-body">Body</label>
            <textarea id="text-editor-body" value={body}
              maxLength={EDITOR_BODY_MAX_LENGTH} rows={2}
              onChange={(event) => { setBody(event.target.value); setError(''); }} />
          </div>
          <button id="apply-note-text" type="submit" disabled={!changed || missingContent}>
            Apply text
          </button>
        </div>
        {missingContent ? (
          <p className="note-text-editor-error" role="alert">
            Enter a title or body before applying.
          </p>
        ) : error ? (
          <p className="note-text-editor-error" role="alert">{error}</p>
        ) : null}
      </form>
    </section>
  );
}
