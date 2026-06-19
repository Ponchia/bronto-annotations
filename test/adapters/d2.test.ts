// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  anchorsFromD2Diagram,
  anchorsFromD2Svg,
  annotationsFromD2Diagram,
  annotationsFromD2Svg,
  obstaclesFromD2Diagram,
  obstaclesFromD2Svg,
  prepareD2DiagramAnnotations,
  prepareD2SvgAnnotations,
  validateD2DiagramAnchors,
  validateD2SvgAnchors
} from '../../src/adapters/d2.js';

describe('D2 adapter', () => {
  it('extracts shape and route anchors from compiled D2 diagram data', () => {
    const diagram = {
      shapes: [
        { id: 'process', pos: { x: 20, y: 40 }, width: 120, height: 60, label: 'Process' }
      ],
      connections: [
        {
          id: 'edge',
          src: 'input',
          dst: 'process',
          route: [
            { x: 0, y: 70 },
            { x: 20, y: 70 }
          ]
        }
      ]
    };
    const anchors = anchorsFromD2Diagram(diagram, [
      { id: 'shape-note', shapeId: 'process' },
      { id: 'edge-note', connectionId: 'edge' }
    ]);

    expect(anchors[0]?.source).toBe('d2-diagram');
    expect(anchors[0]?.d2Kind).toBe('shape');
    expect(anchors[0]?.shapeId).toBe('process');
    expect(anchors[0]?.anchor).toEqual({
      type: 'box',
      box: { x: 20, y: 40, width: 120, height: 60 }
    });
    expect(anchors[1]?.anchor.type).toBe('path');
    expect(anchors[1]?.d2Kind).toBe('connection');
    expect(anchors[1]?.connectionId).toBe('edge');
  });

  it('creates annotations from compiled D2 diagram data', () => {
    const annotations = annotationsFromD2Diagram({
      shapes: [
        { id: 'output', pos: { x: 4, y: 8 }, width: 80, height: 40, label: 'Output' }
      ]
    }, [
      {
        id: 'output-note',
        label: 'Output',
        note: { title: 'Output' },
        variant: 'callout',
        tone: 'info',
        motion: 'draw',
        style: { lineColor: '#0f766e' },
        priority: 4,
        annotationClassName: 'd2-generated-note',
        annotationData: { consumer: 'diagram' },
        metadata: { owner: 'systems' }
      }
    ]);

    expect(annotations[0]?.note.title).toBe('Output');
    expect(annotations[0]?.variant).toBe('callout');
    expect(annotations[0]?.tone).toBe('info');
    expect(annotations[0]?.motion).toBe('draw');
    expect(annotations[0]?.style).toEqual({ lineColor: '#0f766e' });
    expect(annotations[0]?.priority).toBe(4);
    expect(annotations[0]?.className).toBe('d2-generated-note');
    expect(annotations[0]?.metadata).toEqual({ owner: 'systems' });
    expect(annotations[0]?.data?.anchorSource).toBe('d2-diagram');
    expect(annotations[0]?.data?.d2Kind).toBe('shape');
    expect(annotations[0]?.data?.d2ShapeId).toBe('output');
    expect(annotations[0]?.data?.consumer).toBe('diagram');
  });

  it('prepares annotations, obstacles, and validation from compiled D2 diagram data', () => {
    const diagram = {
      shapes: [
        { id: 'process', pos: { x: 20, y: 40 }, width: 120, height: 60 }
      ],
      connections: [
        {
          id: 'edge',
          src: 'input',
          dst: 'process',
          route: [
            { x: 0, y: 70 },
            { x: 20, y: 70 }
          ]
        }
      ]
    };
    const prepared = prepareD2DiagramAnnotations(diagram, [
      { id: 'process-note', shapeId: 'process', note: { title: 'Process' } }
    ], {
      obstacles: { padding: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.data?.d2ShapeId).toBe('process');
    expect(prepared.obstacles).toContainEqual({ x: 18, y: 38, width: 124, height: 64 });
    expect(prepared.obstacles).toContainEqual({ x: -2, y: 68, width: 24, height: 4 });
  });

  it('extracts anchors from rendered D2 SVG selectors', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="d2-node" data-anchor-id="process"><text>Process</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const node = document.querySelector('.d2-node') as SVGGraphicsElement;
    node.getBBox = () => ({ x: 42, y: 54, width: 82, height: 40 }) as DOMRect;

    const anchors = anchorsFromD2Svg(svg, [
      { id: 'process', selector: '.d2-node', coordinateSpace: svg }
    ]);

    expect(anchors[0]?.source).toBe('d2-svg');
    expect(anchors[0]?.d2Kind).toBe('svg');
    expect(anchors[0]?.selector).toBe('.d2-node');
    expect(anchors[0]?.box).toEqual({ x: 42, y: 54, width: 82, height: 40 });
  });

  it('prefers rendered D2 child paths for requested connection path anchors', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="d2-connection" data-d2-connection-id="process-output">
          <path class="route" />
          <text>Process to output</text>
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const group = document.querySelector('.d2-connection') as SVGGraphicsElement;
    const path = document.querySelector('path.route') as SVGPathElement;
    group.getBBox = () => ({ x: 104, y: 44, width: 148, height: 54 }) as DOMRect;
    path.getBBox = () => ({ x: 120, y: 72, width: 90, height: 12 }) as DOMRect;
    path.getTotalLength = () => 90;
    path.getPointAtLength = (distance: number) => ({ x: 120 + distance, y: 72 + distance / 10 }) as DOMPoint;

    const anchors = anchorsFromD2Svg(svg, [
      { id: 'connection-route', connectionId: 'process-output', kind: 'path', coordinateSpace: svg }
    ]);

    expect(anchors[0]?.element).toBe(path);
    expect(anchors[0]?.anchor.type).toBe('path');
    expect(anchors[0]?.box).toEqual({ x: 120, y: 72, width: 90, height: 12 });
    expect(anchors[0]?.connectionId).toBe('process-output');
  });

  it('prepares annotations, obstacles, and validation from rendered D2 SVG', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="shape d2-shape" data-d2-shape-id="process"><text>Process</text></g>
        <path class="connection d2-connection" data-d2-connection-id="process-output" />
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const shape = document.querySelector('.d2-shape') as SVGGraphicsElement;
    const connection = document.querySelector('.d2-connection') as SVGPathElement;
    shape.getBBox = () => ({ x: 42, y: 54, width: 82, height: 40 }) as DOMRect;
    connection.getBBox = () => ({ x: 120, y: 72, width: 90, height: 12 }) as DOMRect;

    const prepared = prepareD2SvgAnnotations(svg, [
      { id: 'process-note', shapeId: 'process', coordinateSpace: svg, note: { title: 'Process' } }
    ], {
      obstacles: { coordinateSpace: svg, padding: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.data?.d2ShapeId).toBe('process');
    expect(prepared.obstacles).toContainEqual({ x: 40, y: 52, width: 86, height: 44 });
    expect(prepared.obstacles).toContainEqual({ x: 118, y: 70, width: 94, height: 16 });
  });

  it('matches compiled and rendered D2 labels with contains mode', () => {
    const diagram = {
      shapes: [
        {
          id: 'wrapped-process',
          pos: { x: 24, y: 32 },
          width: 96,
          height: 48,
          label: 'Primary\nProcess'
        }
      ],
      connections: [
        {
          id: 'process-output',
          src: 'wrapped-process',
          dst: 'output',
          label: 'Primary route to output',
          route: [
            { x: 120, y: 56 },
            { x: 180, y: 56 }
          ]
        }
      ]
    };

    const compiled = anchorsFromD2Diagram(diagram, [
      { id: 'shape-label', label: 'Primary Process', labelMatch: 'contains' },
      { id: 'connection-label', label: 'route to', labelMatch: 'contains' }
    ]);

    expect(compiled.map((anchor) => anchor.d2Kind)).toEqual(['shape', 'connection']);
    expect(compiled[0]?.shapeId).toBe('wrapped-process');
    expect(compiled[1]?.connectionId).toBe('process-output');

    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g><text>Rendered</text><text>D2 Label</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const group = document.querySelector('g') as SVGGraphicsElement;
    group.getBBox = () => ({ x: 42, y: 54, width: 82, height: 40 }) as DOMRect;

    const rendered = anchorsFromD2Svg(svg, [
      { id: 'rendered-label', label: 'D2 Label', labelMatch: 'contains', coordinateSpace: svg }
    ]);
    const missing = validateD2SvgAnchors(svg, [
      { id: 'missing-label', label: 'Absent', labelMatch: 'contains', coordinateSpace: svg }
    ]);

    expect(rendered[0]?.box).toEqual({ x: 42, y: 54, width: 82, height: 40 });
    expect(rendered[0]?.label).toBe('D2 Label');
    expect(missing.missing[0]?.expected).toBe('contains label "Absent"');
  });

  it('extracts anchors from rendered D2 SVG ids, classes, labels, and data attributes', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g id="shape-id"><text>By Id</text></g>
        <g class="class-match"><text>By Class</text></g>
        <g data-anchor-id="from-data"><text>By Data</text></g>
        <g><text>By Label</text></g>
        <path data-d2-connection-id="process-output" />
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const elements = Array.from(document.querySelectorAll('g')) as SVGGraphicsElement[];
    const path = document.querySelector('path') as SVGPathElement;

    elements.forEach((element, index) => {
      element.getBBox = () => ({
        x: 20 + index * 40,
        y: 30,
        width: 30,
        height: 20
      }) as DOMRect;
    });
    path.getBBox = () => ({ x: 170, y: 50, width: 80, height: 20 }) as DOMRect;
    path.getTotalLength = () => 80;
    path.getPointAtLength = (distance: number) => ({ x: 170 + distance, y: 50 + distance / 4 }) as DOMPoint;

    const anchors = anchorsFromD2Svg(svg, [
      { id: 'by-id', shapeId: 'shape-id', coordinateSpace: svg },
      { id: 'by-class', className: 'class-match', coordinateSpace: svg },
      { id: 'by-data', data: { anchorId: 'from-data' }, coordinateSpace: svg },
      { id: 'by-label', label: 'By Label', coordinateSpace: svg },
      { id: 'by-connection', connectionId: 'process-output', kind: 'path', coordinateSpace: svg }
    ]);
    const annotations = annotationsFromD2Svg(svg, [
      {
        id: 'connection-note',
        connectionId: 'process-output',
        kind: 'path',
        coordinateSpace: svg,
        note: { title: 'Connection' }
      }
    ]);

    expect(anchors).toHaveLength(5);
    expect(anchors.map((anchor) => anchor.source)).toEqual(['d2-svg', 'd2-svg', 'd2-svg', 'd2-svg', 'd2-svg']);
    expect(anchors.map((anchor) => anchor.d2Kind)).toEqual(['shape', 'svg', 'svg', 'svg', 'connection']);
    expect(anchors[0]?.shapeId).toBe('shape-id');
    expect(anchors[1]?.className).toBe('class-match');
    expect(anchors[2]?.box).toEqual({ x: 100, y: 30, width: 30, height: 20 });
    expect(anchors[3]?.label).toBe('By Label');
    expect(anchors[4]?.anchor.type).toBe('path');
    expect(anchors[4]?.connectionId).toBe('process-output');
    expect(annotations[0]?.data?.d2Kind).toBe('connection');
    expect(annotations[0]?.data?.d2ConnectionId).toBe('process-output');
  });

  it('walks nested diagrams and returns generated obstacles', () => {
    const diagram = {
      shapes: [
        {
          id: 'group',
          pos: { x: 0, y: 0 },
          width: 200,
          height: 120,
          shapes: [
            { id: 'nested', pos: { x: 24, y: 32 }, width: 60, height: 40 }
          ]
        }
      ],
      layers: [
        {
          shapes: [
            { id: 'layer-node', pos: { x: 220, y: 40 }, width: 70, height: 44 }
          ],
          connections: [
            {
              id: 'layer-edge',
              src: 'nested',
              dst: 'layer-node',
              route: [
                { x: 84, y: 52 },
                { x: 220, y: 62 }
              ]
            }
          ]
        }
      ]
    };

    expect(anchorsFromD2Diagram(diagram, [{ id: 'nested-note', shapeId: 'nested' }])[0]?.box).toEqual({
      x: 24,
      y: 32,
      width: 60,
      height: 40
    });
    expect(obstaclesFromD2Diagram(diagram, { includeConnections: true, padding: 2 })).toContainEqual({
      x: 22,
      y: 30,
      width: 64,
      height: 44
    });
  });

  it('reports missing and unrouted D2 targets', () => {
    const diagram = {
      shapes: [
        { id: 'process', pos: { x: 20, y: 40 }, width: 120, height: 60 }
      ],
      connections: [
        { id: 'unrouted', src: 'a', dst: 'b' }
      ]
    };
    const report = validateD2DiagramAnchors(diagram, [
      { id: 'process-note', shapeId: 'process' },
      { id: 'unrouted-note', connectionId: 'unrouted' },
      { id: 'missing-note', shapeId: 'missing' }
    ]);

    expect(report.ok).toBe(false);
    expect(report.found).toEqual(['process-note']);
    expect(report.missing.map((item) => item.id)).toEqual(['unrouted-note', 'missing-note']);
    expect(report.missing[0]?.reason).toContain('no route points');
  });

  it('reports missing rendered D2 SVG selectors', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="d2-node" data-d2-shape-id="process"><text>Process</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const report = validateD2SvgAnchors(svg, [
      { id: 'process', shapeId: 'process' },
      { id: 'output', selector: '.missing-output' }
    ]);

    expect(report.ok).toBe(false);
    expect(report.found).toEqual(['process']);
    expect(report.missing[0]).toMatchObject({
      id: 'output',
      source: 'd2-svg',
      status: 'missing',
      expected: 'selector ".missing-output"'
    });
  });

  it('extracts obstacles from rendered D2 SVG selectors and generated hooks', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="shape d2-shape" data-d2-shape-id="process"><text>Process</text></g>
        <path class="connection d2-connection" data-d2-connection-id="process-output" />
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const shape = document.querySelector('.d2-shape') as SVGGraphicsElement;
    const connection = document.querySelector('.d2-connection') as SVGGraphicsElement;
    shape.getBBox = () => ({ x: 42, y: 54, width: 82, height: 40 }) as DOMRect;
    connection.getBBox = () => ({ x: 120, y: 72, width: 90, height: 12 }) as DOMRect;

    expect(obstaclesFromD2Svg(svg, {
      coordinateSpace: svg,
      padding: 3
    })).toEqual([
      { x: 39, y: 51, width: 88, height: 46 }
    ]);
    expect(obstaclesFromD2Svg(svg, {
      coordinateSpace: svg,
      includeConnections: true,
      padding: 2
    })).toContainEqual({
      x: 118,
      y: 70,
      width: 94,
      height: 16
    });
    expect(obstaclesFromD2Svg(svg, {
      selector: '.d2-connection',
      coordinateSpace: svg
    })).toEqual([
      { x: 120, y: 72, width: 90, height: 12 }
    ]);
  });
});
