// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  resolveAnnotationLayout,
  type Annotation,
  type PlacementSide
} from '../../src/index.js';
import { annotationsFromD2Diagram } from '../../src/adapters/d2.js';
import { annotationsFromMermaidSvg } from '../../src/adapters/mermaid.js';
import { annotationsFromReactFlow } from '../../src/adapters/react-flow.js';
import { annotationsFromVegaView } from '../../src/adapters/vega.js';

const manualPlacement = {
  manual: {
    x: 172,
    y: 24,
    side: 'left' as PlacementSide
  }
};

const authoringFields = {
  note: {
    title: 'Manual placement',
    body: 'Generated geometry, authored note.'
  },
  placement: manualPlacement,
  subject: {
    shape: 'rect' as const,
    padding: 4
  },
  connector: {
    type: 'elbow' as const,
    end: 'arrow' as const
  },
  variant: 'callout' as const,
  tone: 'info' as const,
  motion: 'draw' as const,
  style: {
    color: '#d12f6a'
  },
  priority: 12,
  annotationClassName: 'generated-manual-note',
  annotationData: {
    consumer: 'adapter-contract'
  },
  metadata: {
    owner: 'adapter-contract'
  }
};

describe('adapter authoring contract', () => {
  it('preserves manual placement and normal annotation fields for generated Vega anchors', () => {
    const [annotation] = annotationsFromVegaView({
      data: () => [{ id: 'peak', x: 84, y: 64 }]
    }, [{
      id: 'vega-manual',
      datum: (datum) => datum.id === 'peak',
      x: 'x',
      y: 'y',
      ...authoringFields
    }]);

    expectAdapterAnnotation(annotation, {
      source: 'vega-view',
      provenance: { datumIndex: 0 }
    });
  });

  it('preserves manual placement and normal annotation fields for rendered Mermaid SVG anchors', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api"><text>API</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const node = document.querySelector('g.node') as SVGGraphicsElement;
    node.getBBox = () => ({ x: 72, y: 40, width: 88, height: 48 }) as DOMRect;

    const [annotation] = annotationsFromMermaidSvg(svg, [{
      id: 'mermaid-manual',
      label: 'API',
      coordinateSpace: svg,
      ...authoringFields
    }]);

    expectAdapterAnnotation(annotation, {
      source: 'mermaid-svg',
      provenance: { mermaidLabel: 'API' }
    });
  });

  it('preserves manual placement and normal annotation fields for compiled D2 geometry', () => {
    const [annotation] = annotationsFromD2Diagram({
      shapes: [
        { id: 'process', pos: { x: 64, y: 52 }, width: 96, height: 44, label: 'Process' }
      ]
    }, [{
      id: 'd2-manual',
      shapeId: 'process',
      ...authoringFields
    }]);

    expectAdapterAnnotation(annotation, {
      source: 'd2-diagram',
      provenance: { d2ShapeId: 'process' }
    });
  });

  it('preserves manual placement and normal annotation fields for React Flow public state', () => {
    const [annotation] = annotationsFromReactFlow({
      nodes: [
        { id: 'review', position: { x: 80, y: 50 }, width: 120, height: 64 }
      ]
    }, [{
      id: 'flow-manual',
      nodeId: 'review',
      ...authoringFields
    }]);

    expectAdapterAnnotation(annotation, {
      source: 'react-flow-node',
      provenance: { reactFlowNodeId: 'review' }
    });
  });
});

function expectAdapterAnnotation(
  annotation: Annotation | undefined,
  expected: {
    source: string;
    provenance: Record<string, unknown>;
  }
) {
  expect(annotation).toBeDefined();
  expect(annotation?.note).toMatchObject(authoringFields.note);
  expect(annotation?.placement).toEqual(manualPlacement);
  expect(annotation?.subject).toEqual(authoringFields.subject);
  expect(annotation?.connector).toEqual(authoringFields.connector);
  expect(annotation?.variant).toBe(authoringFields.variant);
  expect(annotation?.tone).toBe(authoringFields.tone);
  expect(annotation?.motion).toBe(authoringFields.motion);
  expect(annotation?.style).toEqual(authoringFields.style);
  expect(annotation?.priority).toBe(authoringFields.priority);
  expect(annotation?.className).toBe(authoringFields.annotationClassName);
  expect(annotation?.metadata).toEqual(authoringFields.metadata);
  expect(annotation?.data).toMatchObject({
    anchorSource: expected.source,
    consumer: 'adapter-contract',
    ...expected.provenance
  });

  const layout = resolveAnnotationLayout({
    annotations: [annotation!],
    bounds: { x: 0, y: 0, width: 360, height: 240 },
    noteSizes: {
      [annotation!.id]: { width: 112, height: 52 }
    }
  });
  const resolved = layout.annotations[0];

  expect(resolved?.placement.manual).toBe(true);
  expect(resolved?.placement.side).toBe('left');
  expect(resolved?.noteBox).toEqual({
    x: manualPlacement.manual.x,
    y: manualPlacement.manual.y,
    width: 112,
    height: 52
  });
}
