import { useLayoutEffect, useRef } from 'react';
import type { Annotation } from '@ponchia/annotations';

/** A host reading surface: every authored note stays available, even when
 * hidden in the diagram, clipped by its fixed box, or impossible to place. */
export function NoteList({ annotations, selectedId, onSelect }: {
  annotations: readonly Annotation[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const focusedId = useRef<string | null>(null);
  useLayoutEffect(() => {
    // Import/removal can remove the focused row. Restore to the recovered
    // selection only when focus fell out of the document, never from a form.
    if (focusedId.current !== null
      && !annotations.some((note) => note.id === focusedId.current)
      && document.activeElement === document.body) {
      const buttons = list.current?.querySelectorAll<HTMLButtonElement>('button');
      Array.from(buttons ?? []).find((button) => button.dataset.noteId === selectedId)?.focus();
    }
  }, [annotations, selectedId]);

  return <section className="note-list" aria-labelledby="note-list-title">
    <div className="note-list-heading">
      <h2 id="note-list-title">All notes <span>{annotations.length}</span></h2>
      <a href="#text-editor-title" onClick={(event) => {
        event.preventDefault();
        document.getElementById('text-editor-title')?.focus();
      }}>Edit selected note</a>
    </div>
    <p id="note-list-help">Read every note here. Select a title to edit it; use ↑ / ↓, Home or End to move between titles.</p>
    <ol ref={list} aria-describedby="note-list-help">
      {annotations.map((note, index) => <li key={note.id} data-selected={note.id === selectedId}>
        <button type="button" data-note-id={note.id}
          aria-pressed={note.id === selectedId}
          onFocus={() => { focusedId.current = note.id; onSelect(note.id); }}
          onClick={() => onSelect(note.id)}
          onKeyDown={(event) => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? annotations.length - 1
              : event.key === 'ArrowDown' ? (index + 1) % annotations.length
                : event.key === 'ArrowUp' ? (index + annotations.length - 1) % annotations.length : null;
            if (next === null) return;
            event.preventDefault();
            list.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
          }}>
          <span className="note-number" aria-hidden="true">{index + 1}</span>
          <strong>{note.note.title?.trim() || note.id}</strong>
          {note.id === selectedId && <span className="selected-label">Selected</span>}
        </button>
        {note.note.body && <p>{note.note.body}</p>}
        {note.note.visible === false && <small>Hidden in diagram · retained in this list</small>}
      </li>)}
    </ol>
  </section>;
}
