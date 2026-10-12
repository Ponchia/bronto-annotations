// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { noteIdFromCanvasTarget } from '../../examples/react-incremental/note-selection.js';

describe('host-owned annotation text selection', () => {
  it('finds opaque imported IDs from nested note text without interpolating them into CSS selectors', () => {
    const stage = document.createElement('section');
    stage.innerHTML = '<div class="pa-annotation__note-box" role="note" data-annotation-id="__proto__">'
      + '<strong data-extra="text">Imported annotation</strong></div>';
    const text = stage.querySelector('strong')!;
    const note = stage.querySelector('.pa-annotation__note-box')!;
    expect(noteIdFromCanvasTarget(text, stage)).toBe('__proto__');
    expect(noteIdFromCanvasTarget(note, stage)).toBe('__proto__');

    note.setAttribute('data-annotation-id', 'contains "quotes" & spaces');
    expect(noteIdFromCanvasTarget(text, stage)).toBe('contains "quotes" & spaces');
  });

  it('ignores editing controls, SVG connectors, unrelated DOM and missing IDs', () => {
    const stage = document.createElement('section');
    stage.innerHTML = '<svg><g class="pa-annotation">'
      + '<circle class="pa-annotation__edit-handle--note"></circle>'
      + '<path class="pa-annotation__connector"></path>'
      + '</g></svg>'
      + '<div class="pa-annotation__note-box" role="note" data-annotation-id="safe"></div>';
    expect(noteIdFromCanvasTarget(stage.querySelector('circle'), stage)).toBeUndefined();
    expect(noteIdFromCanvasTarget(stage.querySelector('path'), stage)).toBeUndefined();
    const detached = document.createElement('strong');
    const foreign = document.createElement('div');
    foreign.className = 'pa-annotation__note-box';
    foreign.setAttribute('role', 'note');
    foreign.setAttribute('data-annotation-id', 'foreign');
    foreign.append(detached);
    expect(noteIdFromCanvasTarget(detached, stage)).toBeUndefined();
    expect(noteIdFromCanvasTarget(null, stage)).toBeUndefined();
    const note = stage.querySelector('.pa-annotation__note-box')!;
    note.removeAttribute('data-annotation-id');
    expect(noteIdFromCanvasTarget(note, stage)).toBeUndefined();
  });
});
