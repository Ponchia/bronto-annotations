// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { evaluateAnnotationLayout, resolveAnnotationLayout, type Annotation } from '@ponchia/annotations';
import { updatePlaygroundInspector } from '../../site/playground-inspector.js';

const annotation: Annotation = {
  id: 'first', anchor: { type: 'point', point: { x: 80, y: 80 } },
  note: { title: 'A real explanation', body: 'The complete text stays readable.' },
  placement: { manual: { x: 100, y: 60 } },
};
const report = (annotations: Annotation[]) => evaluateAnnotationLayout(resolveAnnotationLayout({
  annotations, bounds: { x: 0, y: 0, width: 500, height: 300 },
}));

beforeEach(() => {
  document.body.innerHTML = '<p id="layout-result-summary"></p><details open><summary>Read notes</summary>' +
    '<ol id="scene-note-list"></ol><p id="layout-findings-empty"></p><ul id="layout-findings"></ul></details>';
});

describe('site-only readable annotation inspector', () => {
  it('shows complete authored text, identity and zero-error status', () => {
    updatePlaygroundInspector([annotation], report([annotation]), 'automatic');
    expect(document.querySelector('#scene-note-list strong')?.textContent).toBe(annotation.note?.title);
    expect(document.querySelector('#scene-note-list p')?.textContent).toBe(annotation.note?.body);
    expect(document.querySelector('#scene-note-list small')?.textContent).toBe('ID: first');
    expect(document.querySelector('#layout-result-summary')?.textContent).toContain('1 note · 0 errors · 0 warnings');
    expect(document.querySelector<HTMLElement>('#layout-findings-empty')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('#layout-findings')?.hidden).toBe(true);
  });

  it('reports real overlaps and clears previous findings when geometry recovers', () => {
    const second = { ...annotation, id: 'second' };
    const crowded = [annotation, second];
    const quality = report(crowded);
    const before = structuredClone(quality);
    updatePlaygroundInspector(crowded, quality, 'fixed');
    expect(document.querySelectorAll('#layout-findings li')).toHaveLength(quality.issues.length);
    expect(document.querySelector('[data-issue-type="note-overlap"]')?.textContent).toContain('chart units²');
    expect(document.querySelector<HTMLElement>('#layout-findings-empty')?.hidden).toBe(true);
    expect(quality).toEqual(before);
    updatePlaygroundInspector([annotation], report([annotation]), 'automatic');
    expect(document.querySelectorAll('#layout-findings li')).toHaveLength(0);
    expect(document.querySelectorAll('#scene-note-list li')).toHaveLength(1);
    expect(document.querySelector('details')?.open).toBe(true);
  });

  it('renders titles, bodies and engine messages as text rather than HTML', () => {
    const raw = '<img src=x onerror="alert(1)">';
    const note = { ...annotation, note: { title: raw, body: '<script>bad()</script>' } };
    const quality = report([note]);
    quality.issues.push({ type: 'bounds-overflow', severity: 'error', message: raw });
    updatePlaygroundInspector([note], quality, 'fixed');
    expect(document.querySelectorAll('img,script')).toHaveLength(0);
    expect(document.querySelector('#scene-note-list strong')?.textContent).toBe(raw);
    expect(document.querySelector('#layout-findings')?.textContent).toContain(raw);
  });

  it('tolerates absent optional site markup without changing unrelated content', () => {
    document.body.innerHTML = '<p>Standalone host</p>';
    expect(() => updatePlaygroundInspector([annotation], report([annotation]), 'automatic')).not.toThrow();
    expect(document.body.textContent).toBe('Standalone host');
  });
});
