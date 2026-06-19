// @vitest-environment jsdom

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  assertAnnotationLayoutQuality,
  evaluateAnnotationLayout,
  formatLayoutQualityReport,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation,
  type Box
} from '../../src/index.js';
import { prepareD2DiagramAnnotations } from '../../src/adapters/d2.js';
import { prepareMermaidAnnotations } from '../../src/adapters/mermaid.js';
import { prepareReactFlowAnnotations } from '../../src/adapters/react-flow.js';
import { prepareVegaScenegraphAnnotations } from '../../src/adapters/vega.js';
import { AnnotationLayer } from '../../src/react/index.js';

type PreparedSnippet = {
  annotations: Annotation[];
  obstacles: Box[];
  validation: {
    ok: boolean;
    missing: unknown[];
  };
};

describe('documentation snippets', () => {
  it('runs the shared layout and SVG render shape from the quickstart docs', () => {
    const prepared: PreparedSnippet = {
      annotations: [{
        id: 'manual-note',
        anchor: { type: 'point', point: { x: 120, y: 88 } },
        note: { title: 'Manual note' },
        connector: { end: 'arrow' },
        placement: { manual: { x: 220, y: 54, side: 'left' } }
      }],
      obstacles: [{ x: 104, y: 72, width: 32, height: 32 }],
      validation: { ok: true, missing: [] }
    };
    const layout = resolveAnnotationLayout({
      annotations: prepared.annotations,
      obstacles: prepared.obstacles,
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      padding: 16,
      placement: {
        side: ['right', 'bottom', 'top', 'left'],
        align: ['center', 'start', 'end'],
        offset: [16, 28],
        crossOffset: [0, -32, 32]
      },
      refinement: { passes: 2, maxCandidatesPerAnnotation: 32 }
    });
    const quality = evaluateAnnotationLayout(layout);
    assertAnnotationLayoutQuality(quality, {
      failOnWarnings: true,
      label: 'Report annotations',
      minScore: 95
    });
    const qualitySummary = formatLayoutQualityReport(quality, { includeInfo: true });
    const svg = renderAnnotationsSvg(layout, {
      title: 'Annotations',
      markerIdPrefix: 'surface-annotations',
      preserveAspectRatio: 'xMidYMid meet'
    });

    expect(prepared.validation.ok).toBe(true);
    expect(quality.ok).toBe(true);
    expect(qualitySummary).toContain('Annotation layout quality: ok');
    expect(svg).toContain('pa-annotation-layer');
    expect(svg).toContain('surface-annotations-marker-arrow');
  });

  it('runs generated-surface quickstart snippets through layout', () => {
    expectSnippetLayout('vega', prepareVegaScenegraphAnnotations({
      scenegraph: () => ({
        root: {
          items: [
            {
              mark: { name: 'points', marktype: 'symbol', role: 'mark' },
              datum: { id: 'peak' },
              bounds: { x1: 64, y1: 68, x2: 92, y2: 96 }
            }
          ]
        }
      })
    }, [{
      id: 'peak',
      markName: 'points',
      datum: (datum) => datum?.id === 'peak',
      note: { title: 'Generated mark' }
    }], {
      assert: { label: 'Vega docs anchors' },
      obstacles: { padding: 4 }
    }));

    document.body.innerHTML = `
      <svg viewBox="0 0 420 260">
        <g class="node" id="flowchart-api"><rect /><text>API</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const api = document.querySelector('#flowchart-api') as SVGGraphicsElement;
    api.getBBox = () => ({ x: 64, y: 68, width: 74, height: 44 }) as DOMRect;

    expectSnippetLayout('mermaid', prepareMermaidAnnotations(svg, [{
      id: 'api',
      label: 'API',
      coordinateSpace: svg,
      note: { title: 'Rendered Mermaid node' }
    }], {
      assert: { label: 'Mermaid docs anchors' },
      obstacles: { coordinateSpace: svg, inflate: 4 }
    }));

    expectSnippetLayout('d2', prepareD2DiagramAnnotations({
      shapes: [
        { id: 'process', pos: { x: 64, y: 68 }, width: 74, height: 44, label: 'Process' }
      ],
      connections: [
        {
          id: 'api-process',
          src: 'api',
          dst: 'process',
          route: [{ x: 20, y: 90 }, { x: 64, y: 90 }]
        }
      ]
    }, [{
      id: 'process',
      shapeId: 'process',
      note: { title: 'Compiled D2 shape' }
    }], {
      assert: { label: 'D2 docs anchors' },
      obstacles: { includeConnections: true, padding: 4 }
    }));

    expectSnippetLayout('react-flow', prepareReactFlowAnnotations({
      nodes: [
        { id: 'review', position: { x: 64, y: 68 }, width: 74, height: 44 }
      ],
      edges: []
    }, [{
      id: 'review',
      nodeId: 'review',
      note: { title: 'React Flow node' }
    }], {
      assert: { label: 'React Flow docs anchors' },
      obstacles: { includeEdges: true, padding: 4 }
    }));
  });

  it('renders the React API reference shape on the server', () => {
    const markup = renderToStaticMarkup(createElement(AnnotationLayer, {
      annotations: [{
        id: 'react-docs',
        anchor: { type: 'point', point: { x: 120, y: 88 } },
        note: { title: 'React docs' }
      }],
      bounds: { x: 0, y: 0, width: 420, height: 260 },
      label: 'Documentation annotation layer',
      markerIdPrefix: 'docs-react',
      preserveAspectRatio: 'xMidYMid meet'
    }));

    expect(markup).toContain('Documentation annotation layer');
    expect(markup).toContain('pa-annotation__connector');
    expect(markup).toContain('React docs');
  });
});

function expectSnippetLayout(label: string, prepared: PreparedSnippet) {
  const layout = resolveAnnotationLayout({
    annotations: prepared.annotations,
    obstacles: prepared.obstacles,
    bounds: { x: 0, y: 0, width: 420, height: 260 },
    padding: 12,
    noteSizes: Object.fromEntries(prepared.annotations.map((annotation) => [
      annotation.id,
      { width: 132, height: 48 }
    ]))
  });
  const quality = evaluateAnnotationLayout(layout);
  const svg = renderAnnotationsSvg(layout, { title: `${label} docs snippet` });

  expect(prepared.validation.ok, `${label} validation`).toBe(true);
  expect(prepared.validation.missing, `${label} missing targets`).toHaveLength(0);
  expect(prepared.annotations, `${label} annotations`).toHaveLength(1);
  expect(prepared.obstacles.length, `${label} obstacles`).toBeGreaterThan(0);
  expect(quality.ok, `${label} quality`).toBe(true);
  expect(svg, `${label} svg`).toContain('pa-annotation__note');
}
