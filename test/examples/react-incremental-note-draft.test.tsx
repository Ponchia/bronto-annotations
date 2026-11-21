// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../../src/index.js';
import { NoteTextEditor } from '../../examples/react-incremental/NoteTextEditor.js';

const original: Annotation = {
  id: 'signal',
  anchor: { type: 'point', point: { x: 80, y: 90 } },
  note: { title: 'Signal', body: 'Current body' }
};
const second: Annotation = {
  id: 'second',
  anchor: { type: 'point', point: { x: 180, y: 90 } },
  note: { title: 'Second', body: 'Another body' }
};
afterEach(cleanup);

function setup() {
  const onApply = vi.fn();
  const onSelect = vi.fn();
  const onReturn = vi.fn();
  const element = (annotation: Annotation) => <NoteTextEditor
    annotation={annotation} annotations={annotation.id === second.id ? [original, annotation] : [annotation, second]}
    onApply={onApply} onSelect={onSelect} onReturn={onReturn} />;
  const view = render(element(original));
  const title = view.getByRole('textbox', { name: 'Title' }) as HTMLInputElement;
  const body = view.getByRole('textbox', { name: 'Body' }) as HTMLTextAreaElement;
  return { ...view, title, body, onApply, onSelect, onReturn,
    replace: (annotation: Annotation) => view.rerender(element(annotation)) };
}

describe('incremental editor text draft lifecycle', () => {
  it('keeps unapplied text and field focus through same-note geometry updates', () => {
    const view = setup();
    fireEvent.change(view.title, { target: { value: 'Unapplied title' } });
    fireEvent.change(view.body, { target: { value: 'Unapplied body' } });
    view.title.focus();
    view.replace({ ...original, anchor: { type: 'point', point: { x: 140, y: 100 } },
      note: { ...original.note }, placement: { manual: { x: 240, y: 30 } } });
    expect(view.title.value).toBe('Unapplied title');
    expect(view.body.value).toBe('Unapplied body');
    expect(document.activeElement).toBe(view.title);
    expect(view.getByRole('status').textContent).toContain('Unapplied text');
    expect(view.onApply).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Apply text' }));
    expect(view.onApply).toHaveBeenCalledTimes(1);
    expect(view.onApply).toHaveBeenCalledWith('signal', 'Unapplied title', 'Unapplied body');
  });

  it('discards only the draft and returns focus without authoring a change', () => {
    const view = setup();
    fireEvent.change(view.title, { target: { value: 'Unapplied title' } });
    fireEvent.change(view.body, { target: { value: 'Unapplied body' } });
    fireEvent.click(view.getByRole('button', { name: 'Discard draft' }));
    expect(view.title.value).toBe('Signal');
    expect(view.body.value).toBe('Current body');
    expect(document.activeElement).toBe(view.title);
    expect(view.onApply).not.toHaveBeenCalled();
    expect(view.onSelect).not.toHaveBeenCalled();
    expect(view.onReturn).not.toHaveBeenCalled();
    expect((view.getByRole('button', { name: 'Apply text' }) as HTMLButtonElement).disabled).toBe(true);
    expect((view.getByRole('button', { name: 'Discard draft' }) as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByRole('status').textContent).toBe('Text matches the current note.');
  });

  it('loads new committed text or another selection instead of applying a stale draft', () => {
    const view = setup();
    fireEvent.change(view.title, { target: { value: 'Unapplied title' } });
    view.replace({ ...original, note: { title: 'Imported title', body: 'Imported body' } });
    expect(view.title.value).toBe('Imported title');
    expect(view.body.value).toBe('Imported body');
    fireEvent.change(view.body, { target: { value: 'Another draft' } });
    view.replace(second);
    expect(view.title.value).toBe('Second');
    expect(view.body.value).toBe('Another body');
    expect(view.onApply).not.toHaveBeenCalled();
    expect((view.getByRole('button', { name: 'Apply text' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
