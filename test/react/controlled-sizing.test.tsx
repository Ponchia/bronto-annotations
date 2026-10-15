// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createIncrementalAnnotationLayoutSession } from '../../src/index.js';
import { AnnotationLayer } from '../../src/react/index.js';
import type { Annotation } from '../../src/index.js';

const bounds = { x: 0, y: 0, width: 580, height: 330 };
const annotations: Annotation[] = Array.from({ length: 18 }, (_, index) => ({
  id: `note-${index}`,
  priority: 18 - index,
  anchor: { type: 'point', point: { x: 20 + index * 24, y: 65 } },
  note: { title: `Note ${index}` },
  placement: { side: 'bottom' }
}));
const noteSizes = Object.fromEntries(annotations.map((item) => [item.id, { width: 75, height: 40 }]));

// The estimator reads note.wrap, while the SVG note renderer does not. Count
// property reads directly instead of mocking an imported ESM function (which
// may change the behavior of internal layout helpers during the test).
function observedSizeOption(annotation: Annotation) {
  let reads = 0;
  return {
    annotation: {
      ...annotation,
      note: {
        ...annotation.note,
        get wrap() { reads += 1; return 38; }
      }
    },
    count: () => reads,
    reset: () => { reads = 0; }
  };
}

describe('controlled React layers skip redundant note-size estimates', () => {
  it('skips internal estimates when rendering a host-owned layout before and after a commit', () => {
    const initial = observedSizeOption(annotations[17]!);
    const source = [...annotations.slice(0, 17), initial.annotation];
    const options = { annotations: source, bounds, noteSizes, refinement: false };
    const session = createIncrementalAnnotationLayoutSession(options);
    initial.reset();

    const first = renderToStaticMarkup(
      <AnnotationLayer layout={session.layout} />
    );
    expect(first).toContain('Note 17');
    expect(initial.count()).toBe(0);

    const edited = observedSizeOption({ ...annotations[17]!, note: { title: 'Edited note' } });
    const updated = [...source.slice(0, 17), edited.annotation];
    const layout = session.update({ ...options, annotations: updated });
    edited.reset();
    const html = renderToStaticMarkup(
      <AnnotationLayer layout={layout} />
    );
    expect(html).toContain('Edited note');
    expect(edited.count()).toBe(0);
  });

  it('still estimates the usual note sizes without an external layout', () => {
    const source = observedSizeOption(annotations[0]!);
    const html = renderToStaticMarkup(
      <AnnotationLayer annotations={[source.annotation]} bounds={bounds} />
    );
    expect(html).toContain('Note 0');
    expect(source.count()).toBeGreaterThan(0);
  });
});
