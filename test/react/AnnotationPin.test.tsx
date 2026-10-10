// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AnnotationPin } from '../../src/react/index.js';

it('exposes a named native control and keeps activation out of underlying content', () => {
  const host = vi.fn(), open = vi.fn();
  render(<div onClick={host} onPointerDown={host}><AnnotationPin point={{ x: 40, y: 60 }} label="Open 3 comments on this passage" selected controls="discussion-panel" onClick={open}>3</AnnotationPin></div>);
  const button = screen.getByRole('button', { name: 'Open 3 comments on this passage' });
  button.focus(); expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-controls')).toBe('discussion-panel');
  expect(button.getAttribute('aria-pressed')).toBe('true');
  fireEvent.pointerDown(button); fireEvent.click(button);
  expect(open).toHaveBeenCalledTimes(1); expect(host).not.toHaveBeenCalled();
  expect(button.style.left).toBe('40px'); expect(button.style.top).toBe('60px');
});
