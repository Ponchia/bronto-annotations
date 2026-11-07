import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYGROUND_STATE,
  parseSceneHash,
  sceneHash,
  sceneUrl,
  type PlaygroundState,
} from '../../site/playground-state.js';

const example = { notes: 5, obstacle: 215, routing: 'none', placement: 'fixed' } as const;

describe('public playground scene links', () => {
  it('round-trips every allowed control combination without changing its input', () => {
    for (const notes of [2, 3, 4, 5]) {
      for (let obstacle = 80; obstacle <= 215; obstacle += 5) {
        for (const routing of ['none', 'orthogonal'] as const) {
          for (const placement of ['automatic', 'fixed'] as const) {
            const state = Object.freeze({ notes, obstacle, routing, placement });
            expect(parseSceneHash(sceneHash(state))).toEqual({ kind: 'scene', state });
          }
        }
      }
    }
  });

  it('has a stable versioned format and includes both boundaries', () => {
    expect(sceneHash(example)).toBe('#playground?v=1&notes=5&obstacle=215&routing=none&placement=fixed');
    expect(parseSceneHash(sceneHash(DEFAULT_PLAYGROUND_STATE))).toEqual({ kind: 'scene', state: DEFAULT_PLAYGROUND_STATE });
  });

  it.each(['', '#playground', '#examples', '#documentation?notes=5', '#playground-malformed?'])
    ('leaves unrelated navigation alone: %s', (hash) => {
      expect(parseSceneHash(hash)).toEqual({ kind: 'unrelated' });
    });

  it.each([
    '',
    'v=1',
    'v=2&notes=3&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=3&notes=4&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=3&obstacle=150&routing=orthogonal&placement=automatic&extra=1',
    'v=1&notes=Infinity&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=2.5&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=0&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=6&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=03&obstacle=150&routing=orthogonal&placement=automatic',
    'v=1&notes=3&obstacle=151&routing=orthogonal&placement=automatic',
    'v=1&notes=3&obstacle=75&routing=orthogonal&placement=automatic',
    'v=1&notes=3&obstacle=220&routing=orthogonal&placement=automatic',
    'v=1&notes=3&obstacle=NaN&routing=orthogonal&placement=automatic',
    'v=1&notes=3&obstacle=150&routing=javascript%3Aalert(1)&placement=automatic',
    'v=1&notes=3&obstacle=150&routing=orthogonal&placement=%3Cscript%3E',
    'v=1&notes=3&obstacle=150&routing=orthogonal&placement=automatic&' + 'x'.repeat(300),
  ])('rejects malformed state without partial application: %s', (query) => {
    expect(parseSceneHash('#playground?' + query)).toEqual({ kind: 'invalid' });
  });

  it('rejects invalid state when serializing rather than producing a broken link', () => {
    for (const state of [
      { ...example, notes: NaN }, { ...example, obstacle: Infinity },
      { ...example, obstacle: 81 }, { ...example, placement: 'other' },
    ]) {
      expect(() => sceneHash(state as PlaygroundState)).toThrow(RangeError);
    }
  });

  it('retains the deployment subpath and strips unrelated query strings', () => {
    const url = new URL(sceneUrl('https://example.com/bronto-annotations/?campaign=anything#examples', example));
    expect(url.origin).toBe('https://example.com');
    expect(url.pathname).toBe('/bronto-annotations/');
    expect(url.search).toBe('');
    expect(parseSceneHash(url.hash)).toEqual({ kind: 'scene', state: example });
  });

  it('does not copy URL credentials and rejects non-web pages', () => {
    const url = new URL(sceneUrl('https://name:secret@example.com/demo/', example));
    expect(url.username).toBe('');
    expect(url.password).toBe('');
    expect(() => sceneUrl('javascript:alert(1)', example)).toThrow(TypeError);
  });
});
