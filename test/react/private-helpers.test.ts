import { describe, expect, it } from 'vitest';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { AnnotationEditHandle } from '../../src/core/edit.js';
import {
  editHandlePosition,
  groupEditHandles,
  keyboardDelta,
  normalizeEditOptions,
  round
} from '../../src/react/edit-geometry.js';
import { dataAttributes } from '../../src/react/render-data.js';
import { markerId } from '../../src/react/marker-defs.js';

function keyEvent(key: string, shiftKey = false): ReactKeyboardEvent<SVGCircleElement> {
  return { key, shiftKey } as ReactKeyboardEvent<SVGCircleElement>;
}

describe('private React rendering and editing helpers', () => {
  it('retains stable grouping and per-handle ordering', () => {
    const handles = [
      { annotationId: 'alpha', data: { editHandlePosition: 'north' } },
      { annotationId: 'beta', data: {} },
      { annotationId: 'alpha', data: { editHandlePosition: 4 } }
    ] as AnnotationEditHandle[];
    const grouped = groupEditHandles(handles);
    expect([...grouped.keys()]).toEqual(['alpha', 'beta']);
    expect(grouped.get('alpha')).toEqual([handles[0], handles[2]]);
    expect(grouped.get('beta')).toEqual([handles[1]]);
    expect(editHandlePosition(handles[0]!)).toBe('north');
    expect(editHandlePosition(handles[2]!)).toBe('4');
    expect(editHandlePosition(handles[1]!)).toBeUndefined();
  });

  it('does not change keyboard edit semantics', () => {
    expect(normalizeEditOptions(false)).toBeUndefined();
    expect(normalizeEditOptions(true)).toEqual({});
    const options = { keyboardStep: 2, keyboardLargeStep: 9 };
    expect(normalizeEditOptions(options)).toBe(options);
    expect(keyboardDelta(keyEvent('ArrowLeft'), options)).toEqual({ x: -2, y: 0 });
    expect(keyboardDelta(keyEvent('ArrowUp', true), options)).toEqual({ x: 0, y: -9 });
    expect(keyboardDelta(keyEvent('ArrowDown', true), options)).toEqual({ x: 0, y: 9 });
    expect(keyboardDelta(keyEvent('ArrowRight'), options)).toEqual({ x: 2, y: 0 });
    expect(keyboardDelta(keyEvent('Escape'), options)).toBeUndefined();
    expect(keyboardDelta(keyEvent('ArrowLeft'), undefined)).toEqual({ x: -1, y: 0 });
  });

  it('keeps emitted data and SVG marker IDs stable', () => {
    expect(dataAttributes({
      hostKey: 'ready',
      isActive: false,
      skipped: null,
      unknown: undefined,
      'bad value': 'normalized'
    })).toEqual({
      'data-host-key': 'ready',
      'data-is-active': 'false',
      'data-bad-value': 'normalized'
    });
    expect(markerId('my notes', 'arrow')).toBe('my-notes-marker-arrow');
    expect(markerId('another layer', 'arrow')).not.toBe(markerId('my notes', 'arrow'));
    expect(round(1.23456)).toBe(1.235);
  });
});
