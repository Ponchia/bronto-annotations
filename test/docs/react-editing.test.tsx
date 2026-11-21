// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FigureAnnotations } from './react-editing-example.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
afterEach(cleanup);

describe('copyable React edit admission', () => {
  it('keeps the complete tested component in the editing guide', () => {
    const fixture = read('./react-editing-example.tsx').trim();
    expect(read('../../docs/react-guide.md')).toContain(`\`\`\`tsx\n${fixture}\n\`\`\``);
  });

  it('commits a keyboard move and restores the exact note geometry with undo', () => {
    const { container, getByRole } = render(<FigureAnnotations />);
    const handle = () => container.querySelector('.pa-annotation__edit-handle--note')!;
    const note = () => container.querySelector('.pa-annotation__note')!.outerHTML;
    const original = note();
    expect((getByRole('button', { name: 'Undo last move' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    expect(note()).not.toBe(original);
    expect(getByRole('status').textContent).toBe('Move saved. Undo is available.');
    fireEvent.click(getByRole('button', { name: 'Undo last move' }));
    expect(note()).toBe(original);
    expect(getByRole('status').textContent).toBe('Previous move restored.');
    expect((getByRole('button', { name: 'Undo last move' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('rejects an overlapping move without replacing accepted state or undo history', () => {
    const { container, getByRole } = render(<FigureAnnotations />);
    const handle = () => container.querySelector('.pa-annotation__edit-handle--note')!;
    const note = () => container.querySelector('.pa-annotation__note')!.outerHTML;
    const original = note();
    fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    const accepted = note();
    fireEvent.keyDown(handle(), { key: 'ArrowUp', shiftKey: true });
    expect(note()).toBe(accepted);
    expect(getByRole('status').textContent).toContain('Move rejected');
    expect((getByRole('button', { name: 'Undo last move' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(getByRole('button', { name: 'Undo last move' }));
    expect(note()).toBe(original);
  });
});
