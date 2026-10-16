// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../../src/index.js';
import { NoteList } from '../../examples/react-incremental/NoteList.js';
import { NoteTextEditor } from '../../examples/react-incremental/NoteTextEditor.js';
import { recoverNoteSelection } from '../../examples/react-incremental/note-selection.js';

afterEach(cleanup);
const notes: Annotation[] = [
  { id: '__proto__', priority: 100, anchor: { type: 'point', point: { x: 0, y: 0 } },
    note: { title: 'High priority', body: 'Full text\n' + 'longword'.repeat(40) } },
  { id: 'quotes " spaces [ ]', priority: -100, anchor: { type: 'point', point: { x: 0, y: 0 } },
    note: { title: 'Hidden selected note', body: 'Still available in the host list', visible: false } }
];

describe('host full-text reading and selection', () => {
  it('retains every note, priority and full body without mutating crowded, hidden or opaque-ID inputs', () => {
    const before = structuredClone(notes);
    const { container, rerender } = render(<NoteList annotations={notes}
      selectedId={notes[1]!.id} onSelect={() => {}} />);
    const markup = container.innerHTML;
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelectorAll('li p')[0]!.textContent).toBe(notes[0]!.note.body);
    expect(container.querySelectorAll('li p')[1]!.textContent).toBe(notes[1]!.note.body);
    expect(container.querySelector('button[aria-pressed="true"]')?.getAttribute('data-note-id')).toBe(notes[1]!.id);
    rerender(<NoteList annotations={notes} selectedId={notes[1]!.id} onSelect={() => {}} />);
    expect(container.innerHTML).toBe(markup);
    expect(notes).toEqual(before);
  });

  it('supports arrow, Home and End navigation with synchronized selection and focus', () => {
    function Host() {
      const [selected, select] = useState(notes[0]!.id);
      return <NoteList annotations={notes} selectedId={selected} onSelect={select} />;
    }
    const { container } = render(<Host />);
    const buttons = container.querySelectorAll('button');
    fireEvent.focus(buttons[0]!);
    fireEvent.keyDown(buttons[0]!, { key: 'End' });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(buttons[1]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(buttons[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(buttons[1]!, { key: 'Home' });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('recovers removed selections and restores focus when an imported row disappears', () => {
    const { container, rerender } = render(<NoteList annotations={notes}
      selectedId={notes[1]!.id} onSelect={() => {}} />);
    container.querySelectorAll('button')[1]!.focus();
    const remaining = notes.slice(0, 1);
    const selected = recoverNoteSelection(remaining, notes[1]!.id);
    expect(selected).toBe('__proto__');
    rerender(<NoteList annotations={remaining} selectedId={selected} onSelect={() => {}} />);
    expect(document.activeElement).toBe(container.querySelector('button'));
    expect(recoverNoteSelection(notes, notes[1]!.id)).toBe(notes[1]!.id);
    expect(recoverNoteSelection([], notes[1]!.id)).toBe('');
  });

  it('refreshes committed/undo drafts without replacing the focused form and returns to the list', () => {
    const onApply = vi.fn();
    const onReturn = vi.fn();
    const props = { annotations: notes, onSelect: vi.fn(), onApply, onReturn };
    const { container, rerender, getByText } = render(<NoteTextEditor annotation={notes[0]!} {...props} />);
    const input = container.querySelector<HTMLInputElement>('#text-editor-title')!;
    input.focus();
    fireEvent.change(input, { target: { value: 'Revised title' } });
    fireEvent.submit(container.querySelector('form')!);
    expect(onApply).toHaveBeenCalledWith('__proto__', 'Revised title', notes[0]!.note.body);
    expect(document.activeElement).toBe(input);
    rerender(<NoteTextEditor annotation={notes[1]!} {...props} />);
    expect(container.querySelector('#text-editor-title')).toBe(input);
    expect(input.value).toBe('Hidden selected note');
    expect(document.activeElement).toBe(input);
    fireEvent.click(getByText('Return to selected note'));
    expect(onReturn).toHaveBeenCalledOnce();
  });
});
