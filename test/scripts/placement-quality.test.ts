import { beforeAll, describe, expect, it } from 'vitest';
import { resolveAnnotationLayout } from '../../src/index.js';
import {
  deterministicResult, loadFixtures, measureQuality, measureResizeJitter, optionsFor,
  renderHostSvg, runFixture, selectedLayout, verifyLayout, verifyResult,
  type Fixture, type Result
} from '../../scripts/placement-quality-corpus.mjs';

let fixtures: Fixture[], feasible: Fixture, impossible: Fixture, result: Result;
beforeAll(async () => {
  fixtures = await loadFixtures();
  feasible = fixtures.find(f => f.id === 'report-wide')!;
  impossible = fixtures.find(f => f.id === 'impossible-240')!;
  // One full fixture only; the full corpus belongs to the explicit script tier.
  result = runFixture(feasible);
});

describe('authored placement quality evaluation', () => {
  it('checks geometric budgets and exact selected geometry, score and quality parity', () => {
    verifyResult(result);
    expect(result.runs[0]!.quality.metrics.noteOverlapArea).toBe(0);
    expect(result.runs[0]!.retainedCandidates.count).toBeGreaterThan(result.runs[1]!.retainedCandidates.count);
    expect(result.runs[0]!.timing.sampleMs).toHaveLength(3);
  });

  it('fails a known 25 × 20 pixel note overlap even after diagnostics are recomputed', () => {
    const broken = structuredClone(result);
    for (const run of broken.runs) {
      const first = run.selected.annotations[0]!.noteBox;
      const second = run.selected.annotations[1]!.noteBox;
      second.x = first.x + first.width - 25;
      second.y = first.y + first.height - 20;
      run.quality = measureQuality(run.selected);
      expect(run.quality.metrics.noteOverlapArea).toBe(500);
    }
    expect(() => verifyResult(broken)).toThrow(/noteOverlapArea=500/);
  });

  it('rejects disappearance, duplicate IDs and note shrinkage', () => {
    const missing = structuredClone(result.runs[0]!.selected);
    missing.annotations.pop();
    expect(() => verifyLayout(feasible, missing)).toThrow(/missing, extra, or duplicate notes/);
    const duplicate = structuredClone(result.runs[0]!.selected);
    duplicate.annotations[1]!.id = duplicate.annotations[0]!.id;
    expect(() => verifyLayout(feasible, duplicate)).toThrow(/missing, extra, or duplicate notes/);
    const smaller = structuredClone(result.runs[0]!.selected);
    smaller.annotations[0]!.noteBox.height = 0;
    expect(() => verifyLayout(feasible, smaller)).toThrow(/note height changed/);
  });

  it('fails overflow, invalid geometry and obstacle occlusion', () => {
    const overflow = structuredClone(result.runs[0]!.selected);
    overflow.annotations[0]!.noteBox.x = -100;
    expect(() => verifyLayout(feasible, overflow)).toThrow(/boundsOverflowArea/);
    const invalid = structuredClone(result.runs[0]!.selected);
    invalid.annotations[0]!.noteBox.y = NaN;
    expect(() => verifyLayout(feasible, invalid)).toThrow(/invalid box/);
    const occluded = structuredClone(result.runs[0]!.selected);
    occluded.annotations[0]!.noteBox.x = feasible.options.obstacles[0]!.x;
    occluded.annotations[0]!.noteBox.y = feasible.options.obstacles[0]!.y;
    expect(() => verifyLayout(feasible, occluded)).toThrow(/obstacleOverlapArea/);
  });

  it('detects stale diagnostic JSON and score parity regressions', () => {
    const stale = structuredClone(result);
    stale.runs[0]!.quality.metrics.noteOverlapArea = 123;
    expect(() => verifyResult(stale)).toThrow(/stale quality measurements/);
    const divergent = structuredClone(result);
    divergent.runs[1]!.selected.annotations[0]!.placement.score += 1;
    expect(() => verifyResult(divergent)).toThrow(/geometry\/score parity/);
  });

  it('keeps impossible problems visible and rejects presenting them as feasible', () => {
    const layout = resolveAnnotationLayout(optionsFor(impossible, 'maxCandidates:8'));
    const quality = verifyLayout(impossible, layout);
    expect(layout.annotations).toHaveLength(5);
    expect(quality.packageReport.ok).toBe(false);
    expect(quality.metrics.noteOverlapArea).toBeGreaterThan(0);
    const goodLabel = structuredClone(impossible);
    goodLabel.expectation = { kind: 'feasible', budgets: { noteOverlapArea: 0 }, rationale: 'negative control' };
    expect(() => verifyLayout(goodLabel, layout)).toThrow(/noteOverlapArea/);
    const svg = renderHostSvg(impossible, selectedLayout(layout), 'maxCandidates:8');
    expect(svg).toContain('impossible');
    expect(svg).toContain('Required content');
  });

  it('excludes all timings from deterministic assertions', () => {
    const varied = structuredClone(result);
    for (const run of varied.runs) {
      run.timing.warmupMs += 300;
      run.timing.medianMs += 200;
      run.timing.sampleMs = [100, 200, 300];
    }
    expect(deterministicResult(varied)).toEqual(deterministicResult(result));
  });

  it('measures stable-ID movement in pixels, independent of annotation order', () => {
    const before = structuredClone(result.runs[0]!.selected);
    const after = structuredClone(before);
    after.bounds.width -= 8;
    after.annotations.reverse();
    after.annotations.forEach(a => { a.noteBox.x += 3; a.noteBox.y += 4; });
    const jitter = measureResizeJitter(before, after);
    expect(jitter.deltaWidthPx).toBe(-8);
    expect(jitter.meanDistancePx).toBe(5);
    expect(jitter.maxDistancePx).toBe(5);
    expect(jitter.sideChanges).toBe(0);
    after.annotations.pop();
    expect(() => measureResizeJitter(before, after)).toThrow(/resize lost note IDs/);
  });

  it('renders complete host content and every note with standalone SVG styles', () => {
    const svg = renderHostSvg(feasible, result.runs[0]!.selected, 'exhaustive');
    expect(svg).toContain('data-host="report-wide"');
    expect(svg).toContain('Quarterly operating report');
    expect(svg).toContain('<style>');
    expect(svg.match(/role="note"/g)).toHaveLength(feasible.options.annotations.length);
    expect(svg).toContain('Growth exceeds plan.');
  });
});
