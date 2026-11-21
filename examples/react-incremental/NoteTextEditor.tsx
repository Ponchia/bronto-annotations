import { useEffect, useRef, useState } from 'react';
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
  onApply,
  onReturn
}: {
  annotation: Annotation;
  annotations: readonly Annotation[];
  onSelect: (id: string) => void;
  onApply: (id: string, title: string, body: string) => void;
  onReturn: () => void;
}) {
  // Geometry edits can replace the annotation object while its authored text
  // is unchanged. Only a different selection or committed text replaces a
  // draft; neither requires remounting the form or dropping keyboard focus.
  const committedTitle = annotation.note.title ?? '';
  const committedBody = annotation.note.body ?? '';
  const [title, setTitle] = useState(committedTitle);
  const [body, setBody] = useState(committedBody);
  const [error, setError] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setTitle(committedTitle);
    setBody(committedBody);
    setError('');
  }, [annotation.id, committedTitle, committedBody]);
  const changed = title !== committedTitle || body !== committedBody;
  const missingContent = !title.trim() && !body.trim();

  function discard() {
    setTitle(committedTitle);
    setBody(committedBody);
    setError('');
    titleInput.current?.focus();
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || missingContent) return;
    try {
      onApply(annotation.id, title, body);
      setError('');
      titleInput.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this note.');
    }
  }

  return (
    <section className="note-text-editor" aria-labelledby="note-text-editor-title">
      <div className="note-text-editor-heading">
        <h2 id="note-text-editor-title">Edit annotation text</h2>
        <p>Select a note in the list, diagram or menu. Apply creates one undoable commit.</p>
        <button className="return-to-note" type="button" onClick={onReturn}>Return to selected note</button>
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
            <input ref={titleInput} id="text-editor-title" type="text" value={title}
              aria-describedby="text-editor-draft-status"
              maxLength={EDITOR_TITLE_MAX_LENGTH}
              onChange={(event) => { setTitle(event.target.value); setError(''); }} />
          </div>
          <div className="note-text-editor-body">
            <label htmlFor="text-editor-body">Body</label>
            <textarea id="text-editor-body" value={body}
              aria-describedby="text-editor-draft-status"
              maxLength={EDITOR_BODY_MAX_LENGTH} rows={2}
              onChange={(event) => { setBody(event.target.value); setError(''); }} />
          </div>
          <div className="note-text-editor-actions">
            <button id="apply-note-text" type="submit" disabled={!changed || missingContent}>
              Apply text
            </button>
            <button id="discard-note-text" className="discard-note-text" type="button"
              disabled={!changed} onClick={discard}>Discard draft</button>
          </div>
        </div>
        <p id="text-editor-draft-status" className="note-text-editor-status" role="status">
          {changed
            ? 'Unapplied text. Apply to update this note, or discard the draft. Selecting another note replaces this draft.'
            : 'Text matches the current note.'}
        </p>
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
