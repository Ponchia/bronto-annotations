import type { LayoutOptions, ResolvedLayout, ResolvedAnnotation, ResolvedPlacement, LayoutQualityReport } from '../src/index.js';

export type Fixture = {
  id: string; title: string; provenance: string; description: string;
  options: LayoutOptions & { padding: number; noteSizes: NonNullable<LayoutOptions['noteSizes']>; obstacles: NonNullable<LayoutOptions['obstacles']> };
  host: Array<Record<string, string | number>>;
  expectation: { kind: 'feasible' | 'impossible'; budgets?: Record<string, number>; requiredProblems?: string[]; rationale: string };
};
export type SelectedLayout = Omit<ResolvedLayout, 'annotations'> & {
  annotations: Array<Omit<ResolvedAnnotation, 'annotation' | 'placement'> & { placement: Omit<ResolvedPlacement, 'candidates'> }>;
};
export type Quality = { metrics: LayoutQualityReport['metrics']; packageReport: LayoutQualityReport };
export type Jitter = {
  method: string; deltaWidthPx: number; beforeBounds: ResolvedLayout['bounds']; afterBounds: ResolvedLayout['bounds'];
  movements: Array<{ id: string; dxPx: number; dyPx: number; distancePx: number; sideChanged: boolean }>;
  meanDistancePx: number; maxDistancePx: number; sideChanges: number;
};
export type Run = {
  configuration: string; selected: SelectedLayout; quality: Quality;
  retainedCandidates: { notes: Array<{ id: string; count: number; bytes: number }>; count: number; bytes: number; unit: string };
  timing: { warmupCount: number; warmupMs: number; sampleMs: number[]; medianMs: number; unit: string };
  resize: { selected: SelectedLayout; quality: Quality; jitter: Jitter };
};
export type Result = { fixture: Fixture; runs: Run[] };
export type CorpusReport = { schema: number; kind: string; sourceCommit: string; sourceDirty: boolean; runtime: Record<string, string>; results: Result[] };
export const configurations: string[];
export function loadFixtures(): Promise<Fixture[]>;
export function optionsFor(fixture: Fixture, configuration: string): LayoutOptions;
export function selectedLayout(layout: ResolvedLayout): SelectedLayout;
export function measureQuality(layout: SelectedLayout | ResolvedLayout): Quality;
export function verifyLayout(fixture: Fixture, layout: SelectedLayout | ResolvedLayout): Quality;
export function measureResizeJitter(before: SelectedLayout, after: SelectedLayout): Jitter;
export function runFixture(fixture: Fixture, options?: { samples?: number }): Result;
export function verifyResult(result: Result, fixture?: Fixture): void;
export function verifyCorpus(report: CorpusReport): Promise<{ fixtures: number; configurations: number }>;
export function deterministicResult(result: Result): { fixture: Fixture; runs: Array<Omit<Run, 'timing'>> };
export function renderHostSvg(fixture: Fixture, selected: SelectedLayout, configuration: string): string;
export function writeGallery(report: CorpusReport, outputDir: string): Promise<void>;
export function main(argv?: string[]): Promise<void>;
