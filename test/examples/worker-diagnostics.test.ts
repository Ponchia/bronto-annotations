import { describe, expect, it } from 'vitest';
import { resolveAnnotationLayout } from '../../src/core/layout-resolver.js';
import type { LayoutOptions } from '../../src/core/model.js';
import { applyWorkerLayout, encodeWorkerLayout, LayoutRevisionMismatchError } from '../fixtures/worker-browser/layout-patch.js';
import { shareUnchangedWorkerLayout } from '../../examples/react-worker/layout-equality.js';

const options: LayoutOptions = {
  annotations: ['__proto__', 'constructor'].map((id, i) => ({
    id,
    anchor: { type: 'point', point: { x: 40 + i * 180, y: 50 } },
    note: { title: id },
    placement: { side: ['right', 'bottom'], offset: [12, 24] },
    connector: { routing: 'none' }
  })),
  bounds: { x: 0, y: 0, width: 500, height: 300 },
  refinement: false
};

describe('host-owned Worker diagnostic transport', () => {
  it('keeps default snapshots lean after structured clone', () => {
    const layout = resolveAnnotationLayout(options);
    const response = structuredClone(encodeWorkerLayout(1, 0, layout));
    expect(response.kind).toBe('snapshot');
    const accepted = applyWorkerLayout({ revision: 0, layout }, response).state.layout;
    expect(accepted).toEqual(layout);
    expect(accepted).not.toHaveProperty('diagnostics');
    for (const item of accepted.annotations) expect(item.placement).not.toHaveProperty('candidates');
  });

  it('replaces diagnostic fields on patches without losing winner identities or revision checks', () => {
    const lean = resolveAnnotationLayout(options);
    let state = { revision: 1, layout: lean };
    for (const [index, count] of [1, 8, 'all', undefined].entries()) {
      const next = resolveAnnotationLayout({ ...options,
        ...(count === undefined ? {} : { diagnostics: { candidates: count as number | 'all' } }) });
      const revision = index + 2;
      const response = structuredClone(encodeWorkerLayout(revision, state.revision, next, state));
      expect(response.kind).toBe('patch');
      const result = applyWorkerLayout(state, response);
      expect(result.reused).toBe(2);
      expect(result.state.layout).toEqual(next);
      expect(result.state.layout.annotations[0]).toBe(state.layout.annotations[0]);
      expect(result.state.layout.diagnostics).toEqual(next.diagnostics);
      if (count === undefined) expect(result.state.layout).not.toHaveProperty('diagnostics');
      else expect(result.state.layout.diagnostics!.annotations.map((item) => item.id))
        .toEqual(next.annotations.map((item) => item.id));
      expect(() => applyWorkerLayout(result.state, response)).toThrow(LayoutRevisionMismatchError);
      expect(() => applyWorkerLayout({ ...state, revision: 0 }, response)).toThrow(LayoutRevisionMismatchError);
      state = result.state;
    }
  });

  it('snapshot identity sharing keeps current diagnostics and removes obsolete diagnostics', () => {
    const lean = resolveAnnotationLayout(options);
    const debug = resolveAnnotationLayout({ ...options, diagnostics: { candidates: 2 } });
    const shared = shareUnchangedWorkerLayout(lean, structuredClone(debug));
    expect(shared.reused).toBe(2);
    expect(shared.layout.diagnostics).toEqual(debug.diagnostics);
    const disabled = shareUnchangedWorkerLayout(shared.layout, structuredClone(lean));
    expect(disabled.reused).toBe(2);
    expect(disabled.layout).not.toHaveProperty('diagnostics');
  });
});
