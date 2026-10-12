import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveAnnotationLayout } from '../../src/index.js';
import type { Annotation, ResolvedAnnotation } from '../../src/index.js';
import { markerId } from '../../src/react/marker-defs.js';
import {
  renderConnector,
  renderDebugBoxes,
  renderSubject
} from '../../src/react/svg-annotation-parts.js';

const prefix = 'pa-annotation';

function resolved(changes: Partial<Annotation> = {}): ResolvedAnnotation {
  const note: Annotation = {
    id: 'marker',
    anchor: { type: 'point', point: { x: 65, y: 55 } },
    note: { title: 'Marker' },
    connector: { type: 'straight', routing: 'none', end: 'arrow' },
    placement: {
      side: ['right', 'bottom'], offset: [12, 22],
      crossOffset: [0, 8], maxCandidates: 2
    },
    ...changes
  };
  const result = resolveAnnotationLayout({
    annotations: [note],
    bounds: { x: 0, y: 0, width: 400, height: 260 },
    defaultNoteSize: { width: 88, height: 40 }
  });
  expect(result.annotations).toHaveLength(1);
  return result.annotations[0]!;
}

function paint(item: ResolvedAnnotation) {
  return renderToStaticMarkup(<svg>
    {renderSubject(item, prefix)}
    {renderConnector(item, prefix, 'notes a')}
    {renderDebugBoxes(item, prefix)}
  </svg>);
}

describe('private resolved annotation SVG geometry', () => {
  it('keeps default subject and connector accessible marker contracts', () => {
    const item = resolved({
      subject: { shape: 'point', radius: 6, data: { hostId: 'original' } }
    });
    const markup = paint(item);
    expect(markup).toContain('class="pa-annotation__subject');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-host-id="original"');
    expect(markup).toContain('r="6"');
    expect(markup).toContain('data-annotation-id="marker"');
    expect(markup).toContain('data-connector-type="straight"');
    expect(markup).toContain(`marker-end="url(#${markerId('notes a', 'arrow')})"`);
    expect(markup).toContain('data-debug-kind="winner"');
    expect(markup).toContain('data-debug-kind="candidate"');
    const rectCount = (markup.match(/data-debug-kind="/g) ?? []).length;
    expect(rectCount).toBe(item.placement.candidates.length + 1);
    expect(markup.indexOf('pa-annotation__subject'))
      .toBeLessThan(markup.indexOf('pa-annotation__connector'));
  });

  it('renders directional badges before their label, hiding decorative SVG parts', () => {
    const item = resolved({
      subject: {
        badge: {
          label: '7', x: 'left', y: 'top', radius: 12,
          data: { sourceId: 'graph-7' }
        }
      }
    });
    const markup = renderToStaticMarkup(<svg>{renderSubject(item, prefix)}</svg>);
    expect(markup).toContain('class="pa-annotation__badge-wrap" aria-hidden="true"');
    expect(markup).toContain('class="pa-annotation__badge-pointer"');
    expect(markup).toContain('class="pa-annotation__badge-label pa-annotation__title"');
    expect(markup).toContain('data-source-id="graph-7"');
    expect(markup).toContain('data-badge-x="left"');
    expect(markup).toContain('data-badge-y="top"');
    expect(markup).toContain('>7</text>');
    expect(markup.indexOf('pa-annotation__badge-pointer'))
      .toBeLessThan(markup.indexOf('pa-annotation__badge-label'));
  });

  it('preserves shape overrides and deliberate connector omission', () => {
    const pathItem = resolved({
      subject: { path: 'M 1 2 L 3 4', className: 'host-outline' },
      connector: { type: 'none' }
    });
    const pathMarkup = renderToStaticMarkup(<svg>{renderSubject(pathItem, prefix)}</svg>);
    expect(pathMarkup).toContain('pa-annotation__subject--path');
    expect(pathMarkup).toContain('host-outline');
    expect(pathMarkup).toContain('d="M 1 2 L 3 4"');
    expect(renderConnector(pathItem, prefix, 'notes-a')).toBeNull();

    const hidden = resolved({ subject: { shape: 'none' } });
    expect(renderSubject(hidden, prefix)).toBeNull();
    expect(renderToStaticMarkup(<svg>{renderConnector(hidden, prefix, 'notes-a')}</svg>))
      .toContain('pa-annotation__connector');
  });
});
