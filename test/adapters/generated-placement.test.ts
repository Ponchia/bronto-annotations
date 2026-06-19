// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  generatedSurfaceLayoutDefaults,
  overlapArea,
  resolvePreparedAnnotationLayout,
  type Annotation,
  type AnchorAlignmentTarget,
  type Box,
  type PlacementSide
} from '../../src/index.js';
import { prepareD2DiagramAnnotations } from '../../src/adapters/d2.js';
import { prepareMermaidAnnotations } from '../../src/adapters/mermaid.js';
import { prepareReactFlowAnnotations } from '../../src/adapters/react-flow.js';
import { prepareVegaScaleAnnotations, prepareVegaScenegraphAnnotations } from '../../src/adapters/vega.js';
import type { AnchorSpecValidationReport } from '../../src/adapters/diagnostics.js';

type PreparedGeneratedLayer = {
  annotations: Annotation[];
  obstacles: Box[];
  validation: AnchorSpecValidationReport;
};

const bounds: Box = { x: 0, y: 0, width: 420, height: 260 };
const manual = { x: 272, y: 188, side: 'left' as PlacementSide };
const noteSizes = {
  auto: { width: 106, height: 44 },
  manual: { width: 118, height: 48 }
};
const expectedGeneratedTargets: AnchorAlignmentTarget[] = [
  {
    id: 'auto',
    expected: 'generated automatic target',
    box: { x: 112, y: 58, width: 74, height: 44 }
  },
  {
    id: 'manual',
    expected: 'generated manual target',
    box: { x: 76, y: 134, width: 92, height: 48 }
  }
];

describe('generated-surface placement contract', () => {
  it('places generated Vega scenegraph annotations automatically and manually', () => {
    const prepared = prepareVegaScenegraphAnnotations({
      scenegraph: () => ({
        root: {
          items: [
            {
              mark: { name: 'points', marktype: 'symbol', role: 'mark' },
              datum: { id: 'peak' },
              bounds: { x1: 112, y1: 58, x2: 148, y2: 94 }
            },
            {
              mark: { name: 'bars', marktype: 'rect', role: 'mark' },
              datum: { id: 'manual' },
              bounds: { x1: 78, y1: 132, x2: 168, y2: 180 }
            }
          ]
        }
      })
    }, [
      {
        id: 'auto',
        markName: 'points',
        datum: (datum) => datum?.id === 'peak',
        note: { title: 'Generated mark' },
        placement: { side: ['right', 'bottom', 'top'] }
      },
      {
        id: 'manual',
        markName: 'bars',
        datum: (datum) => datum?.id === 'manual',
        note: { title: 'Manual mark' },
        placement: { manual }
      }
    ], {
      obstacles: { padding: 4 }
    });

    expectGeneratedSurfaceLayout('vega', prepared);
  });

  it('places generated Vega scale annotations with generated obstacles automatically and manually', () => {
    const prepared = prepareVegaScaleAnnotations({
      data: () => [
        { id: 'api', x: 112, y: 58, width: 74, height: 44 },
        { id: 'report', x: 76, y: 134, width: 92, height: 48 }
      ],
      scale: () => (value: unknown) => Number(value)
    }, [
      {
        id: 'auto',
        datum: (datum) => datum.id === 'api',
        xScale: 'x',
        yScale: 'y',
        x: 'x',
        y: 'y',
        width: 'width',
        height: 'height',
        note: { title: 'Generated scale mark' },
        placement: { side: ['right', 'bottom', 'top'] }
      },
      {
        id: 'manual',
        datum: (datum) => datum.id === 'report',
        xScale: 'x',
        yScale: 'y',
        x: 'x',
        y: 'y',
        width: 'width',
        height: 'height',
        note: { title: 'Manual scale mark' },
        placement: { manual }
      }
    ], {
      obstacles: {
        xScale: 'x',
        yScale: 'y',
        x: 'x',
        y: 'y',
        width: 'width',
        height: 'height',
        padding: 4
      }
    });

    expectGeneratedSurfaceLayout('vega-scale', prepared);
  });

  it('places rendered Mermaid SVG annotations automatically and manually', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 420 260">
        <g class="node" id="flowchart-api"><rect /><text>API</text></g>
        <g class="node" id="flowchart-report"><rect /><text>Report</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const api = document.querySelector('#flowchart-api') as SVGGraphicsElement;
    const report = document.querySelector('#flowchart-report') as SVGGraphicsElement;
    api.getBBox = () => ({ x: 112, y: 58, width: 74, height: 44 }) as DOMRect;
    report.getBBox = () => ({ x: 76, y: 134, width: 92, height: 48 }) as DOMRect;

    const prepared = prepareMermaidAnnotations(svg, [
      {
        id: 'auto',
        label: 'API',
        coordinateSpace: svg,
        note: { title: 'Rendered node' },
        placement: { side: ['right', 'bottom', 'top'] }
      },
      {
        id: 'manual',
        label: 'Report',
        coordinateSpace: svg,
        note: { title: 'Manual node' },
        placement: { manual }
      }
    ], {
      obstacles: { coordinateSpace: svg, inflate: 4 }
    });

    expectGeneratedSurfaceLayout('mermaid', prepared);
  });

  it('places compiled D2 diagram annotations automatically and manually', () => {
    const prepared = prepareD2DiagramAnnotations({
      shapes: [
        { id: 'api', pos: { x: 112, y: 58 }, width: 74, height: 44, label: 'API' },
        { id: 'report', pos: { x: 76, y: 134 }, width: 92, height: 48, label: 'Report' }
      ],
      connections: [
        {
          id: 'api-report',
          src: 'api',
          dst: 'report',
          route: [
            { x: 186, y: 80 },
            { x: 230, y: 80 },
            { x: 230, y: 158 },
            { x: 168, y: 158 }
          ]
        }
      ]
    }, [
      {
        id: 'auto',
        shapeId: 'api',
        note: { title: 'Compiled shape' },
        placement: { side: ['right', 'bottom', 'top'] }
      },
      {
        id: 'manual',
        shapeId: 'report',
        note: { title: 'Manual shape' },
        placement: { manual }
      }
    ], {
      obstacles: { padding: 4, includeConnections: true }
    });

    expectGeneratedSurfaceLayout('d2', prepared);
  });

  it('places React Flow public-state annotations automatically and manually', () => {
    const prepared = prepareReactFlowAnnotations({
      nodes: [
        { id: 'api', position: { x: 112, y: 58 }, width: 74, height: 44 },
        { id: 'report', position: { x: 76, y: 134 }, width: 92, height: 48 }
      ],
      edges: [
        { id: 'api-report', source: 'api', target: 'report' }
      ]
    }, [
      {
        id: 'auto',
        nodeId: 'api',
        note: { title: 'Flow node' },
        placement: { side: ['right', 'bottom', 'top'] }
      },
      {
        id: 'manual',
        nodeId: 'report',
        note: { title: 'Manual node' },
        placement: { manual }
      }
    ], {
      obstacles: { padding: 4, includeEdges: true }
    });

    expectGeneratedSurfaceLayout('react-flow', prepared);
  });
});

function expectGeneratedSurfaceLayout(label: string, prepared: PreparedGeneratedLayer) {
  expect(prepared.validation.ok, `${label} validation`).toBe(true);
  expect(prepared.obstacles.length, `${label} obstacles`).toBeGreaterThan(0);

  const defaults = generatedSurfaceLayoutDefaults({
    anchorLabel: `${label} generated anchors`,
    failOnWarnings: true,
    layoutLabel: `${label} generated layout`
  });
  expect(defaults.assertValidation).toMatchObject({
    failOnWarnings: true,
    label: `${label} generated anchors`
  });
  expect(defaults.assertQuality).toMatchObject({
    label: `${label} generated layout`
  });
  const resolved = resolvePreparedAnnotationLayout(prepared, {
    ...defaults,
    bounds,
    padding: 12,
    placement: {
      ...defaults.placement,
      align: ['center', 'start', 'end'],
      offset: [12, 22],
      crossOffset: [0, -24, 24]
    },
    noteSizes,
    refinement: true,
    targetAlignmentTargets: expectedGeneratedTargets,
    targetAlignmentOptions: {
      minOverlapRatio: 0.98,
      tolerance: 0.5
    },
    targetAlignmentFormat: {
      label: `${label} target alignment`,
      includeAligned: true
    },
    assertTargetAlignment: {
      label: `${label} target alignment`,
      failOnWarnings: true
    }
  });
  const layout = resolved.layout;
  const report = resolved.quality;
  const auto = layout.annotations.find((annotation) => annotation.id === 'auto');
  const manualNote = layout.annotations.find((annotation) => annotation.id === 'manual');

  expect(resolved.validationSummary, `${label} validation summary`).toContain(`${label} generated anchors: ok`);
  expect(resolved.qualitySummary, `${label} quality summary`).toContain(`${label} generated layout: ok`);
  expect(resolved.targetAlignment?.ok, `${label} target alignment`).toBe(true);
  expect(resolved.targetAlignmentSummary, `${label} target alignment summary`).toContain(`${label} target alignment: ok`);
  expect(report.metrics.boundsOverflowArea, `${label} bounds overflow`).toBe(0);
  expect(report.metrics.noteOverlapArea, `${label} note overlap`).toBe(0);
  expect(auto, `${label} automatic annotation`).toBeDefined();
  expect(manualNote, `${label} manual annotation`).toBeDefined();
  expect(auto?.placement.manual, `${label} automatic placement should stay automatic`).toBeUndefined();
  expect(manualNote?.placement.manual, `${label} manual placement`).toBe(true);
  expect(manualNote?.noteBox, `${label} manual note box`).toEqual({
    x: manual.x,
    y: manual.y,
    width: noteSizes.manual.width,
    height: noteSizes.manual.height
  });
  expect(overlapArea(auto!.noteBox, auto!.subject.box), `${label} automatic note over target`).toBe(0);
  expect(auto!.placement.candidates.length, `${label} placement candidates`).toBeGreaterThan(1);
}
