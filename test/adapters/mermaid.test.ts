// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  anchorsFromMermaidSvg,
  annotationsFromMermaidSvg,
  obstaclesFromMermaidSvg,
  prepareMermaidAnnotations,
  validateMermaidSvgAnchors
} from '../../src/adapters/mermaid.js';

describe('Mermaid adapter', () => {
  it('extracts anchors by rendered node label', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api">
          <rect />
          <text>API</text>
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const node = document.querySelector('g.node') as SVGGraphicsElement;
    node.getBBox = () => ({ x: 80, y: 50, width: 70, height: 44 }) as DOMRect;

    const anchors = anchorsFromMermaidSvg(svg, [
      { id: 'api', label: 'API', coordinateSpace: svg }
    ]);

    expect(anchors[0]?.source).toBe('mermaid-svg');
    expect(anchors[0]?.mermaidKind).toBe('label');
    expect(anchors[0]?.label).toBe('API');
    expect(anchors[0]?.anchor).toEqual({
      type: 'box',
      box: { x: 80, y: 50, width: 70, height: 44 }
    });
  });

  it('extracts anchors by rendered node and cluster ids', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api-1"><text>API</text></g>
        <g class="cluster" id="subGraph-cluster-services"><text>Services</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const api = document.querySelector('#flowchart-api-1') as SVGGraphicsElement;
    const cluster = document.querySelector('#subGraph-cluster-services') as SVGGraphicsElement;
    api.getBBox = () => ({ x: 80, y: 50, width: 70, height: 44 }) as DOMRect;
    cluster.getBBox = () => ({ x: 40, y: 24, width: 160, height: 120 }) as DOMRect;

    const anchors = anchorsFromMermaidSvg(svg, [
      { id: 'api', nodeId: 'api', coordinateSpace: svg },
      { id: 'services', clusterId: 'cluster-services', coordinateSpace: svg }
    ]);

    expect(anchors.map((anchor) => anchor.mermaidKind)).toEqual(['node', 'cluster']);
    expect(anchors[0]?.mermaidId).toBe('api');
    expect(anchors[0]?.element?.id).toBe('flowchart-api-1');
    expect(anchors[1]?.mermaidId).toBe('cluster-services');
    expect(anchors[1]?.box).toEqual({ x: 40, y: 24, width: 160, height: 120 });
  });

  it('creates annotations by selector', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g id="edge-label"><text>Edge</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const edge = document.querySelector('#edge-label') as SVGGraphicsElement;
    edge.getBBox = () => ({ x: 20, y: 30, width: 40, height: 20 }) as DOMRect;

    const annotations = annotationsFromMermaidSvg(svg, [
      { id: 'edge', selector: '#edge-label', coordinateSpace: svg, note: { title: 'Edge' } }
    ]);

    expect(annotations[0]?.note.title).toBe('Edge');
    expect(annotations[0]?.data?.anchorSource).toBe('mermaid-svg');
    expect(annotations[0]?.data?.mermaidKind).toBe('selector');
    expect(annotations[0]?.data?.mermaidSelector).toBe('#edge-label');
  });

  it('preserves annotation authoring fields on generated Mermaid annotations', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api"><text>API</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const node = document.querySelector('g.node') as SVGGraphicsElement;
    node.getBBox = () => ({ x: 80, y: 50, width: 70, height: 44 }) as DOMRect;

    const annotations = annotationsFromMermaidSvg(svg, [
      {
        id: 'api',
        label: 'API',
        coordinateSpace: svg,
        note: { title: 'API' },
        variant: 'badge',
        tone: 'warning',
        motion: 'pulse',
        style: { color: '#d12f6a' },
        priority: 7,
        annotationClassName: 'story-note',
        annotationData: { consumer: 'report' },
        metadata: { owner: 'analytics' }
      }
    ]);

    expect(annotations[0]).toMatchObject({
      variant: 'badge',
      tone: 'warning',
      motion: 'pulse',
      priority: 7,
      className: 'story-note',
      metadata: { owner: 'analytics' }
    });
    expect(annotations[0]?.style).toEqual({ color: '#d12f6a' });
    expect(annotations[0]?.data).toMatchObject({
      anchorSource: 'mermaid-svg',
      mermaidLabel: 'API',
      consumer: 'report'
    });
  });

  it('prepares annotations, obstacles, and validation for rendered Mermaid SVG layout', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api"><text>API</text></g>
        <g class="node" id="flowchart-report"><text>Report</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const nodes = Array.from(document.querySelectorAll('g.node')) as SVGGraphicsElement[];
    nodes[0]!.getBBox = () => ({ x: 80, y: 50, width: 70, height: 44 }) as DOMRect;
    nodes[1]!.getBBox = () => ({ x: 180, y: 50, width: 80, height: 44 }) as DOMRect;

    const prepared = prepareMermaidAnnotations(svg, [
      { id: 'api', label: 'API', coordinateSpace: svg, note: { title: 'API' } }
    ], {
      obstacles: { coordinateSpace: svg, inflate: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations[0]?.data?.mermaidLabel).toBe('API');
    expect(prepared.obstacles).toContainEqual({ x: 78, y: 48, width: 74, height: 48 });
  });

  it('extracts edge path anchors and obstacles from rendered Mermaid SVG', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <path class="flowchart-link" id="edge-api-report" />
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const path = document.querySelector('path') as SVGPathElement;
    path.getBBox = () => ({ x: 20, y: 30, width: 120, height: 40 }) as DOMRect;
    path.getTotalLength = () => 100;
    path.getPointAtLength = (distance: number) => ({ x: 20 + distance, y: 30 + distance / 5 }) as DOMPoint;

    const anchors = anchorsFromMermaidSvg(svg, [
      { id: 'edge', edgeId: 'api-report', kind: 'path', coordinateSpace: svg }
    ]);

    expect(anchors[0]?.anchor.type).toBe('path');
    expect(anchors[0]?.mermaidKind).toBe('edge');
    expect(anchors[0]?.mermaidId).toBe('api-report');
    expect(obstaclesFromMermaidSvg(svg)).toEqual([
      { x: 20, y: 30, width: 120, height: 40 }
    ]);
  });

  it('extracts sequence participant, message, and route anchors from rendered Mermaid SVG hooks', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 480 260">
        <g class="actor" id="actor-api" data-participant-id="api"><rect /><text>API</text></g>
        <g class="actor" id="actor-report" data-participant-id="report"><rect /><text>Report</text></g>
        <line class="messageLine0" data-edge-id="api-report-call" />
        <g class="messageText" data-message-id="api-report-call"><text>call report</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const api = document.querySelector('#actor-api') as SVGGraphicsElement;
    const report = document.querySelector('#actor-report') as SVGGraphicsElement;
    const message = document.querySelector('[data-message-id="api-report-call"]') as SVGGraphicsElement;
    const route = document.querySelector('[data-edge-id="api-report-call"]') as SVGGeometryElement;
    api.getBBox = () => ({ x: 48, y: 24, width: 72, height: 42 }) as DOMRect;
    report.getBBox = () => ({ x: 320, y: 24, width: 88, height: 42 }) as DOMRect;
    message.getBBox = () => ({ x: 176, y: 96, width: 112, height: 24 }) as DOMRect;
    route.getBBox = () => ({ x: 120, y: 108, width: 200, height: 8 }) as DOMRect;
    route.getTotalLength = () => 200;
    route.getPointAtLength = (distance: number) => ({ x: 120 + distance, y: 112 }) as DOMPoint;

    const prepared = prepareMermaidAnnotations(svg, [
      {
        id: 'sequence-api',
        label: 'API',
        coordinateSpace: svg,
        note: { title: 'Participant' }
      },
      {
        id: 'sequence-message',
        data: { messageId: 'api-report-call' },
        coordinateSpace: svg,
        note: { title: 'Message label' }
      },
      {
        id: 'sequence-route',
        edgeId: 'api-report-call',
        kind: 'path',
        coordinateSpace: svg,
        note: { title: 'Message route' }
      }
    ], {
      obstacles: { coordinateSpace: svg, inflate: 2 }
    });

    expect(prepared.validation.ok).toBe(true);
    expect(prepared.annotations.map((annotation) => annotation.anchor.type)).toEqual(['box', 'box', 'path']);
    expect(prepared.annotations.map((annotation) => annotation.data?.mermaidKind)).toEqual(['label', 'data', 'edge']);
    expect(prepared.annotations[0]?.data?.mermaidLabel).toBe('API');
    expect(prepared.annotations[1]?.data?.mermaidDataSelector).toBe('[data-message-id="api-report-call"]');
    expect(prepared.annotations[2]?.data?.mermaidId).toBe('api-report-call');
    expect(prepared.obstacles).toContainEqual({ x: 46, y: 22, width: 76, height: 46 });
    expect(prepared.obstacles).toContainEqual({ x: 318, y: 22, width: 92, height: 46 });
    expect(prepared.obstacles).toContainEqual({ x: 174, y: 94, width: 116, height: 28 });
    expect(prepared.obstacles).toContainEqual({ x: 118, y: 106, width: 204, height: 12 });
  });

  it('extracts anchors from classes, data attributes, edge child paths, and partial labels', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 420 260">
        <g class="node important-node" data-node-id="api">
          <rect />
          <text>API</text>
        </g>
        <g class="edgePath" id="L_api_report_0" data-edge-id="api-report">
          <path class="flowchart-link" data-edge-id="api-report" />
        </g>
        <g data-mermaid-id="decision">
          <text>Decision ready</text>
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const node = document.querySelector('.important-node') as SVGGraphicsElement;
    const edgeGroup = document.querySelector('.edgePath') as SVGGraphicsElement;
    const path = document.querySelector('path.flowchart-link') as SVGPathElement;
    const decision = document.querySelector('[data-mermaid-id="decision"]') as SVGGraphicsElement;
    node.getBBox = () => ({ x: 64, y: 40, width: 84, height: 52 }) as DOMRect;
    edgeGroup.getBBox = () => ({ x: 140, y: 72, width: 140, height: 40 }) as DOMRect;
    path.getBBox = () => ({ x: 152, y: 84, width: 120, height: 16 }) as DOMRect;
    path.getTotalLength = () => 90;
    path.getPointAtLength = (distance: number) => ({ x: 152 + distance, y: 84 + distance / 10 }) as DOMPoint;
    decision.getBBox = () => ({ x: 260, y: 120, width: 96, height: 40 }) as DOMRect;

    const anchors = anchorsFromMermaidSvg(svg, [
      { id: 'class-anchor', className: 'important-node', coordinateSpace: svg },
      { id: 'data-anchor', data: { nodeId: 'api' }, coordinateSpace: svg },
      { id: 'edge-anchor', edgeId: 'api-report', kind: 'path', coordinateSpace: svg },
      { id: 'contains-label', label: 'Decision', labelMatch: 'contains', coordinateSpace: svg }
    ]);

    expect(anchors.map((anchor) => anchor.mermaidKind)).toEqual(['class', 'data', 'edge', 'label']);
    expect(anchors[0]?.className).toBe('important-node');
    expect(anchors[1]?.dataSelector).toBe('[data-node-id="api"]');
    expect(anchors[2]?.anchor.type).toBe('path');
    expect(anchors[2]?.element).toBe(path);
    expect(anchors[2]?.element).not.toBe(edgeGroup);
    expect(anchors[3]?.label).toBe('Decision');

    const annotations = annotationsFromMermaidSvg(svg, [
      { id: 'class-anchor', className: 'important-node', coordinateSpace: svg },
      { id: 'data-anchor', data: { nodeId: 'api' }, coordinateSpace: svg }
    ]);

    expect(annotations[0]?.data?.mermaidClassName).toBe('important-node');
    expect(annotations[1]?.data?.mermaidDataSelector).toBe('[data-node-id="api"]');
  });

  it('extracts Mermaid edge paths from rendered source and target node ids', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 420 260">
        <g class="edgePath" id="L_api_report_0">
          <path class="flowchart-link" />
        </g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const edgeGroup = document.querySelector('.edgePath') as SVGGraphicsElement;
    const path = document.querySelector('path.flowchart-link') as SVGPathElement;
    edgeGroup.getBBox = () => ({ x: 140, y: 72, width: 140, height: 40 }) as DOMRect;
    path.getBBox = () => ({ x: 152, y: 84, width: 120, height: 16 }) as DOMRect;
    path.getTotalLength = () => 90;
    path.getPointAtLength = (distance: number) => ({ x: 152 + distance, y: 84 + distance / 10 }) as DOMPoint;

    const anchors = anchorsFromMermaidSvg(svg, [
      {
        id: 'api-report-route',
        edgeSourceId: 'api',
        edgeTargetId: 'report',
        kind: 'path',
        coordinateSpace: svg
      }
    ]);
    const annotations = annotationsFromMermaidSvg(svg, [
      {
        id: 'api-report-route',
        edgeSourceId: 'api',
        edgeTargetId: 'report',
        kind: 'path',
        coordinateSpace: svg,
        note: { title: 'API to report' }
      }
    ]);

    expect(anchors[0]?.mermaidKind).toBe('edge');
    expect(anchors[0]?.element).toBe(path);
    expect(anchors[0]?.anchor.type).toBe('path');
    expect(anchors[0]?.edgeSourceId).toBe('api');
    expect(anchors[0]?.edgeTargetId).toBe('report');
    expect(annotations[0]?.data?.mermaidEdgeSourceId).toBe('api');
    expect(annotations[0]?.data?.mermaidEdgeTargetId).toBe('report');
  });

  it('reports missing Mermaid SVG anchors without throwing', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api"><text>API</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const report = validateMermaidSvgAnchors(svg, [
      { id: 'api', label: 'API' },
      { id: 'worker', label: 'Worker' }
    ]);

    expect(report.ok).toBe(false);
    expect(report.found).toEqual(['api']);
    expect(report.missing[0]).toMatchObject({
      id: 'worker',
      source: 'mermaid-svg',
      status: 'missing',
      expected: 'exact label "Worker"'
    });
  });
});
