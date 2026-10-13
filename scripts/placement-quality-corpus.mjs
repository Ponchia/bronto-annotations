import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { evaluateAnnotationLayout, resolveAnnotationLayout, renderAnnotationsSvg } from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export const configurations = ['normal', 'diagnostics:8', 'diagnostics:all'];

export async function loadFixtures() {
  const corpus = JSON.parse(await readFile(new URL('../test/fixtures/placement-quality/corpus.json', import.meta.url), 'utf8'));
  assert.equal(corpus.schema, 1);
  assert.ok(corpus.fixtures.length > 0);
  assert.equal(new Set(corpus.fixtures.map(f => f.id)).size, corpus.fixtures.length);
  for (const fixture of corpus.fixtures) {
    assert.match(fixture.id, /^[a-z0-9-]+$/);
    assert.equal(fixture.provenance, 'authored synthetic host geometry');
    assert.ok(['feasible', 'impossible'].includes(fixture.expectation.kind));
    assert.ok(fixture.options.annotations.length >= 5 && fixture.options.annotations.length <= 20);
    assert.equal(new Set(fixture.options.annotations.map(a => a.id)).size, fixture.options.annotations.length);
    assert.equal(fixture.options.refinement.maxCandidatesPerAnnotation, 8);
    for (const annotation of fixture.options.annotations) {
      assert.notEqual(annotation.note.visible, false);
      assert.equal(annotation.placement?.maxCandidates, undefined);
      const size = fixture.options.noteSizes[annotation.id];
      assert.ok(size.width > 0 && size.height > 0);
    }
    if (fixture.expectation.kind === 'feasible') {
      assert.equal(fixture.expectation.budgets.noteOverlapArea, 0);
      assert.equal(fixture.expectation.budgets.boundsOverflowArea, 0);
      assert.ok(Number.isFinite(fixture.expectation.budgets.obstacleOverlapArea));
    } else {
      const { bounds, padding, noteSizes } = fixture.options;
      assert.ok(Object.values(noteSizes).reduce((sum, s) => sum + s.width * s.height, 0)
        > (bounds.width - 2 * padding) * (bounds.height - 2 * padding));
      assert.ok(fixture.expectation.requiredProblems.includes('note-overlap'));
    }
  }
  return corpus.fixtures;
}

export function optionsFor(fixture, configuration) {
  assert.ok(configurations.includes(configuration));
  const options = structuredClone(fixture.options);
  // Every run refines over the same top-eight frontier, independently of diagnostics.
  if (configuration === 'diagnostics:8') options.diagnostics = { candidates: 8 };
  if (configuration === 'diagnostics:all') options.diagnostics = { candidates: 'all' };
  return options;
}

export function selectedLayout(layout) {
  return {
    bounds: layout.bounds, placementBounds: layout.placementBounds, padding: layout.padding,
    obstacles: layout.obstacles,
    annotations: layout.annotations.map(({ id, subject, anchorPoint, noteBox, connector, placement }) => ({
      id, subject, anchorPoint, noteBox, connector,
      placement: { side: placement.side, align: placement.align, offset: placement.offset, score: placement.score }
    }))
  };
}

function intersectionArea(a, b) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

export function measureQuality(layout) {
  const report = evaluateAnnotationLayout(layout);
  // Independent rectangle-area checks keep the fixture budgets grounded in actual geometry.
  // True outside area counts corner overflow once (the package reports edge-strip sums).
  const boxes = layout.annotations.map(a => a.noteBox);
  const metrics = { ...report.metrics,
    boundsOverflowArea: boxes.reduce((sum, b) => sum + b.width * b.height - intersectionArea(b, layout.placementBounds), 0),
    noteOverlapArea: boxes.reduce((sum, a, i) => sum + boxes.slice(i + 1).reduce((s, b) => s + intersectionArea(a, b), 0), 0),
    obstacleOverlapArea: boxes.reduce((sum, a) => sum + layout.obstacles.reduce((s, b) => s + intersectionArea(a, b), 0), 0)
  };
  return { metrics, packageReport: report };
}

export function verifyLayout(fixture, layout) {
  const expected = fixture.options.annotations.map(a => a.id).sort();
  assert.deepEqual(layout.annotations.map(a => a.id).sort(), expected, `${fixture.id}: missing, extra, or duplicate notes`);
  assert.deepEqual(layout.bounds, fixture.options.bounds, `${fixture.id}: bounds changed`);
  assert.deepEqual(layout.obstacles, fixture.options.obstacles, `${fixture.id}: obstacles changed`);
  const { bounds, padding } = fixture.options;
  assert.deepEqual(layout.placementBounds, { x: bounds.x + padding, y: bounds.y + padding,
    width: bounds.width - padding * 2, height: bounds.height - padding * 2 });
  for (const item of layout.annotations) {
    const size = fixture.options.noteSizes[item.id];
    assert.equal(item.noteBox.width, size.width, `${item.id}: note width changed`);
    assert.equal(item.noteBox.height, size.height, `${item.id}: note height changed`);
    assert.ok(Object.values(item.noteBox).every(Number.isFinite), `${item.id}: invalid box`);
    assert.ok(Number.isFinite(item.placement.score), `${item.id}: invalid placement score`);
    assert.ok(item.connector.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), `${item.id}: invalid connector`);
  }
  const quality = measureQuality(layout);
  assert.equal(quality.metrics.invalidBoxCount, 0, `${fixture.id}: invalid boxes`);
  if (fixture.expectation.kind === 'feasible') {
    for (const [metric, budget] of Object.entries(fixture.expectation.budgets)) {
      assert.ok(Number.isFinite(quality.metrics[metric]) && quality.metrics[metric] <= budget,
        `${fixture.id}: ${metric}=${quality.metrics[metric]} exceeds reviewed budget ${budget}`);
    }
  } else {
    assert.equal(quality.packageReport.ok, false, `${fixture.id}: impossible layout presented as good`);
    for (const type of fixture.expectation.requiredProblems) {
      assert.ok(quality.packageReport.issues.some(issue => issue.type === type && issue.area > 0),
        `${fixture.id}: expected nonzero ${type} diagnostic`);
    }
  }
  return quality;
}

export function measureResizeJitter(before, after) {
  const old = new Map(before.annotations.map(a => [a.id, a]));
  assert.equal(old.size, before.annotations.length);
  assert.deepEqual([...old.keys()].sort(), after.annotations.map(a => a.id).sort(), 'resize lost note IDs');
  const deltaWidth = after.bounds.width - before.bounds.width;
  const movements = after.annotations.map(a => {
    const b = old.get(a.id);
    const dx = a.noteBox.x - b.noteBox.x, dy = a.noteBox.y - b.noteBox.y;
    return { id: a.id, dxPx: dx, dyPx: dy, distancePx: Math.hypot(dx, dy), sideChanged: a.placement.side !== b.placement.side };
  });
  const distances = movements.map(m => m.distancePx);
  return { method: 'fixed host geometry; only viewport right boundary moves', deltaWidthPx: deltaWidth,
    beforeBounds: before.bounds, afterBounds: after.bounds, movements,
    meanDistancePx: distances.reduce((sum, n) => sum + n, 0) / distances.length,
    maxDistancePx: Math.max(...distances), sideChanges: movements.filter(m => m.sideChanged).length };
}

export function runFixture(fixture, { samples = 3 } = {}) {
  assert.ok(Number.isInteger(samples) && samples >= 3, 'At least three measured samples are required');
  const runs = configurations.map(configuration => {
    const options = optionsFor(fixture, configuration);
    const warmStart = performance.now();
    resolveAnnotationLayout(options);
    const warmupMs = performance.now() - warmStart;
    const sampleMs = [];
    let layout, selected;
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      const next = resolveAnnotationLayout(options);
      sampleMs.push(performance.now() - start);
      const geometry = selectedLayout(next);
      if (selected) assert.deepEqual(geometry, selected, `${fixture.id}: nondeterministic solve`);
      layout = next; selected = geometry;
    }
    const sorted = [...sampleMs].sort((a, b) => a - b);
    const candidates = layout.annotations.map(a => {
      const retained = layout.diagnostics?.annotations.find(entry => entry.id === a.id)?.candidates;
      return { id: a.id, count: retained?.length ?? 0,
        bytes: retained ? Buffer.byteLength(JSON.stringify(retained), 'utf8') : 0 };
    });
    const resizedOptions = structuredClone(options);
    resizedOptions.bounds.width -= 8;
    const resized = selectedLayout(resolveAnnotationLayout(resizedOptions));
    return { configuration, selected, quality: measureQuality(selected),
      retainedCandidates: { notes: candidates, count: candidates.reduce((s, a) => s + a.count, 0),
        bytes: candidates.reduce((s, a) => s + a.bytes, 0), unit: 'UTF-8 JSON bytes of per-note candidate arrays; not heap memory' },
      timing: { warmupCount: 1, warmupMs, sampleMs,
        medianMs: samples % 2 ? sorted[Math.floor(samples / 2)] : (sorted[samples / 2 - 1] + sorted[samples / 2]) / 2,
        unit: 'milliseconds; solve only' },
      resize: { selected: resized, quality: measureQuality(resized), jitter: measureResizeJitter(selected, resized) } };
  });
  return { fixture, runs };
}

export function verifyResult(result, fixture = result.fixture) {
  assert.deepEqual(result.fixture, fixture, `${fixture.id}: fixture configuration changed`);
  assert.deepEqual(result.runs.map(r => r.configuration), configurations);
  for (const run of result.runs) {
    assert.deepEqual(run.quality, verifyLayout(fixture, run.selected), `${fixture.id}: stale quality measurements`);
    const resizedFixture = structuredClone(fixture);
    resizedFixture.options.bounds.width -= 8;
    assert.deepEqual(run.resize.quality, verifyLayout(resizedFixture, run.resize.selected));
    assert.deepEqual(run.resize.jitter, measureResizeJitter(run.selected, run.resize.selected));
    const retained = run.retainedCandidates;
    assert.deepEqual(retained.notes.map(n => n.id).sort(), fixture.options.annotations.map(a => a.id).sort());
    for (const note of retained.notes) {
      assert.ok(Number.isInteger(note.count) && note.count >= 0 && Number.isInteger(note.bytes) && note.bytes >= 0);
      if (run.configuration === 'normal') {
        assert.equal(note.count, 0);
        assert.equal(note.bytes, 0);
      } else {
        assert.ok(run.configuration === 'diagnostics:all' ? note.count > 8 : note.count === 8);
        assert.ok(note.bytes > 0);
      }
    }
    assert.equal(retained.count, retained.notes.reduce((s, n) => s + n.count, 0));
    assert.equal(retained.bytes, retained.notes.reduce((s, n) => s + n.bytes, 0));
    assert.equal(run.timing.warmupCount, 1);
    assert.ok(run.timing.sampleMs.length >= 3);
    assert.ok([run.timing.warmupMs, run.timing.medianMs, ...run.timing.sampleMs].every(n => Number.isFinite(n) && n >= 0));
  }
  for (const run of result.runs.slice(1)) {
    assert.deepEqual(result.runs[0].selected, run.selected, `${fixture.id}: selected geometry/score parity`);
    assert.deepEqual(result.runs[0].quality, run.quality, `${fixture.id}: quality parity`);
    assert.deepEqual(result.runs[0].resize, run.resize, `${fixture.id}: resize parity`);
  }
  assert.ok(result.runs[0].retainedCandidates.bytes < result.runs[1].retainedCandidates.bytes);
  assert.ok(result.runs[1].retainedCandidates.bytes < result.runs[2].retainedCandidates.bytes);
}

export async function verifyCorpus(report) {
  const fixtures = await loadFixtures();
  assert.equal(report.schema, 1);
  assert.equal(report.kind, 'authored-placement-quality');
  assert.match(report.sourceCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(report.results.map(r => r.fixture.id), fixtures.map(f => f.id), 'missing/extra corpus cases');
  report.results.forEach((result, i) => verifyResult(result, fixtures[i]));
  return { fixtures: fixtures.length, configurations: configurations.length };
}

// Deterministic assertions deliberately exclude wall-clock observations and repository provenance.
export function deterministicResult(result) {
  return { fixture: result.fixture, runs: result.runs.map(({ timing, ...run }) => run) };
}

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const svgStyle = `.pa-annotation__note-box{fill:#fff;stroke:#334155;stroke-width:1}.pa-annotation__connector,.pa-annotation__subject{fill:none;stroke:#2563eb;stroke-width:1.5}.pa-annotation__title{font:bold 13px sans-serif;fill:#0f172a}.pa-annotation__body{font:12px sans-serif;fill:#334155}`;

export function renderHostSvg(fixture, selected, configuration) {
  const annotations = selected.annotations.map(item => ({ ...item,
    annotation: fixture.options.annotations.find(a => a.id === item.id) }));
  const host = fixture.host.map(shape => {
    if (shape.type === 'rect') return `<g><rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" fill="${escape(shape.fill)}" stroke="#94a3b8"/><text x="${shape.x + 5}" y="${shape.y + 18}" font-size="12">${escape(shape.label)}</text></g>`;
    if (shape.type === 'line') return `<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="#64748b"/>`;
    if (shape.type === 'text') return `<text x="${shape.x}" y="${shape.y}" font-size="14">${escape(shape.text)}</text>`;
    throw new Error(`Unsupported authored host shape: ${shape.type}`);
  }).join('');
  const svg = renderAnnotationsSvg({ ...selected, annotations }, { includeSubjects: false,
    title: `${fixture.title} — ${configuration} — ${fixture.expectation.kind}`, markerIdPrefix: `${fixture.id}-${configuration.replace(/[^a-z0-9]/gi, '-')}` });
  const boundary = selected.placementBounds;
  return svg.replace(/(<svg[^>]*>)/, `$1<style>${svgStyle}</style><rect x="0" y="0" width="100%" height="100%" fill="#f8fafc"/><g data-host="${escape(fixture.id)}" font-family="sans-serif">${host}</g><rect x="${boundary.x}" y="${boundary.y}" width="${boundary.width}" height="${boundary.height}" fill="none" stroke="#94a3b8" stroke-dasharray="4 4"/>`);
}

export async function writeGallery(report, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const sections = [];
  for (const { fixture, runs } of report.results) {
    const figures = [];
    for (const [i, run] of runs.entries()) {
      const filename = `${fixture.id}-${i}.svg`;
      await writeFile(join(outputDir, filename), renderHostSvg(fixture, run.selected, run.configuration));
      figures.push(`<figure><figcaption>${escape(run.configuration)} · ${run.retainedCandidates.count} candidates · ${run.retainedCandidates.bytes} bytes</figcaption><div class="surface" tabindex="0" role="region" aria-label="Scrollable ${escape(fixture.title)} ${escape(run.configuration)}"><img src="${filename}" width="${fixture.options.bounds.width}" height="${fixture.options.bounds.height}" alt="${escape(fixture.title)} with all host content and annotation notes"/></div><pre>${escape(JSON.stringify(run.quality.metrics, null, 2))}</pre></figure>`);
    }
    sections.push(`<section><h2>${escape(fixture.id)} — ${fixture.expectation.kind === 'impossible' ? 'EXPECTED PROBLEMS — NOT A GOOD LAYOUT' : 'Feasible quality budget'}</h2><p>${escape(fixture.expectation.rationale)}</p><div class="pair">${figures.join('')}</div></section>`);
  }
  await writeFile(join(outputDir, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(outputDir, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authored placement quality gallery</title><style>body{font:15px system-ui;margin:2rem;color:#172033}section{border-top:1px solid #aaa;margin-top:2rem}.pair{display:grid;grid-template-columns:1fr;gap:1rem}figure{margin:0;min-width:0}.surface{overflow:auto;border:1px solid #bbb}.surface:focus-visible{outline:2px solid}img{display:block;max-width:none}@media(min-width:2000px){.pair{grid-template-columns:1fr 1fr}}pre{overflow:auto;font-size:12px}</style><h1>Authored placement quality corpus</h1><p>Synthetic authored host geometry; not independent adoption or upstream evidence. Source ${escape(report.sourceCommit)}. Inspect full host shapes, text and connectors. Expected impossible problems remain visible. See <a href="results.json">measurements</a>.</p>${sections.join('')}</html>`);
}

export async function main(argv = process.argv.slice(2)) {
  let outputDir = resolve(process.env.TMPDIR ?? '/tmp', 'annotations-placement-quality');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output-dir' && argv[i + 1]) outputDir = resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  const fixtures = await loadFixtures();
  const report = { schema: 1, kind: 'authored-placement-quality',
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    sourceDirty: execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts/placement-quality-corpus.mjs',
      'scripts/verify-placement-quality.mjs', 'test/fixtures/placement-quality'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    results: fixtures.map(fixture => runFixture(fixture)) };
  // Preserve all measurements and visual failures before asserting budgets.
  await writeGallery(report, outputDir);
  const verified = await verifyCorpus(report);
  process.stdout.write(`${JSON.stringify({ ...verified, outputDir, passed: true })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
}
