// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  assertAnchorAlignmentReport,
  assertAnchorValidationReport,
  evaluateAnchorAlignment,
  formatAnchorAlignmentReport,
  formatAnchorDiagnostic,
  formatAnchorValidationReport,
  type AnchorAlignmentReport,
  type AnchorSpecValidationReport
} from '../../src/index.js';
import {
  formatAnchorValidationReport as formatMermaidAnchorValidationReport,
  validateMermaidSvgAnchors
} from '../../src/adapters/mermaid.js';

describe('adapter diagnostics', () => {
  it('formats validation reports with missing and fallback diagnostics', () => {
    const report: AnchorSpecValidationReport = {
      ok: false,
      found: ['node-note', 'handle-note'],
      warnings: [
        {
          id: 'handle-note',
          source: 'react-flow-state',
          status: 'fallback',
          expected: 'handle "approve"',
          found: true,
          reason: 'Requested handle was not measured; using node side midpoint.'
        }
      ],
      missing: [
        {
          id: 'edge-note',
          source: 'mermaid-svg',
          status: 'missing',
          expected: 'edge id "api-report"',
          found: false,
          reason: 'No rendered Mermaid SVG element matched edge id "api-report".'
        }
      ],
      diagnostics: []
    };

    expect(formatAnchorDiagnostic(report.missing[0]!)).toBe(
      'edge-note: missing mermaid-svg edge id "api-report". No rendered Mermaid SVG element matched edge id "api-report".'
    );
    expect(formatAnchorValidationReport(report, { label: 'Generated anchors' })).toContain(
      'Generated anchors: failed (2 found, 1 warning, 1 missing).'
    );
    expect(formatAnchorValidationReport(report, { maxDiagnostics: 1 })).toContain('1 more diagnostic omitted');
    expect(() => assertAnchorValidationReport(report, { label: 'Generated anchors' }))
      .toThrow(/Generated anchors: failed/);
  });

  it('can fail on fallback warnings for measured generated surfaces', () => {
    const report: AnchorSpecValidationReport = {
      ok: true,
      found: ['handle-note'],
      warnings: [
        {
          id: 'handle-note',
          source: 'react-flow-state',
          status: 'fallback',
          expected: 'handle "approve"',
          found: true
        }
      ],
      missing: [],
      diagnostics: []
    };

    expect(() => assertAnchorValidationReport(report)).not.toThrow();
    expect(() => assertAnchorValidationReport(report, { failOnWarnings: true }))
      .toThrow(/1 warning/);
  });

  it('evaluates generated anchor alignment against target geometry', () => {
    const report = evaluateAnchorAlignment([
      {
        id: 'node-note',
        anchor: { type: 'box', box: { x: 20, y: 30, width: 80, height: 44 } },
        note: { title: 'Node' }
      },
      {
        id: 'near-note',
        anchor: { type: 'point', point: { x: 207, y: 112 } },
        note: { title: 'Near' }
      },
      {
        id: 'bad-note',
        anchor: { type: 'point', point: { x: 300, y: 300 } },
        note: { title: 'Bad' }
      }
    ], [
      {
        id: 'node-note',
        expected: 'rendered node box',
        box: { x: 20, y: 30, width: 80, height: 44 }
      },
      {
        id: 'near-note',
        expected: 'rendered handle point',
        point: { x: 200, y: 110 },
        tolerance: 2,
        nearTolerance: 10
      },
      {
        id: 'bad-note',
        expected: 'rendered edge midpoint',
        point: { x: 60, y: 64 },
        tolerance: 2
      },
      {
        id: 'missing-note',
        expected: 'rendered generated node',
        box: { x: 0, y: 0, width: 20, height: 20 }
      }
    ]);

    expect(report.ok).toBe(false);
    expect(report.aligned).toEqual(['node-note']);
    expect(report.warnings.map((item) => item.id)).toEqual(['near-note']);
    expect(report.missing.map((item) => item.id)).toEqual(['bad-note', 'missing-note']);
    expect(formatAnchorAlignmentReport(report, { label: 'Generated target alignment' })).toContain(
      'Generated target alignment: failed (1 aligned, 1 warning, 2 missing).'
    );
    expect(() => assertAnchorAlignmentReport(report, { label: 'Generated target alignment' }))
      .toThrow(/Generated target alignment: failed/);
  });

  it('can fail on near alignment warnings when exact generated target alignment is required', () => {
    const report: AnchorAlignmentReport = {
      ok: true,
      aligned: ['handle-note'],
      warnings: [{
        id: 'handle-note',
        status: 'near',
        expected: 'rendered handle point',
        found: true,
        distance: 3,
        overlapRatio: 0,
        reason: 'Measured handle was close to the fallback point.'
      }],
      missing: [],
      diagnostics: []
    };

    expect(() => assertAnchorAlignmentReport(report)).not.toThrow();
    expect(() => assertAnchorAlignmentReport(report, { failOnWarnings: true }))
      .toThrow(/1 warning/);
  });

  it('formats real rendered Mermaid validation reports through adapter subpaths', () => {
    document.body.innerHTML = `
      <svg viewBox="0 0 320 200">
        <g class="node" id="flowchart-api"><text>API</text></g>
      </svg>
    `;
    const svg = document.querySelector('svg') as SVGSVGElement;
    const report = validateMermaidSvgAnchors(svg, [
      { id: 'api-note', label: 'API' },
      { id: 'worker-note', label: 'Worker' }
    ]);
    const summary = formatMermaidAnchorValidationReport(report, { label: 'Mermaid anchors' });

    expect(report.ok).toBe(false);
    expect(summary).toContain('Mermaid anchors: failed (1 found, 0 warnings, 1 missing).');
    expect(summary).toContain('worker-note: missing mermaid-svg exact label "Worker".');
  });
});
