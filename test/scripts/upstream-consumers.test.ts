import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertObservations, verifyProvenance } from '../../scripts/upstream-consumers-proof.mjs';

const fixtures = resolve('test/fixtures/upstream-consumers');
const temporary: string[] = [];
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }); });
async function copyFixtures() {
  const path = await mkdtemp(join(tmpdir(), 'upstream-consumers-'));
  temporary.push(path); await cp(fixtures, path, { recursive: true }); return path;
}

describe('reviewed upstream provenance', () => {
  it('retains two self-contained Vega gallery inputs, a real Mermaid fence, and complete license notices', async () => {
    const manifest = await verifyProvenance(fixtures);
    expect(manifest.hosts.map((h: { id: string }) => h.id)).toEqual(['vega-bar-chart', 'vega-grouped-bar-chart', 'mermaid-client-services-storage']);
    expect(manifest.hosts[2]?.lines).toEqual({ start: 116, end: 134 });
    expect(manifest.licenses.map((l: { spdx: string }) => l.spdx)).toEqual(['BSD-3-Clause', 'MIT']);
  });
  it.each(['inputs/bar-chart.vg.json', 'inputs/client-services-storage.mmd', 'licenses/vega-LICENSE', 'licenses/mermaid-LICENSE'])('rejects unreviewed changes to %s', async file => {
    const path = await copyFixtures();
    await writeFile(join(path, file), (await readFile(join(path, file), 'utf8')) + '\nchanged\n');
    await expect(verifyProvenance(path)).rejects.toThrow('checksum changed');
  });
  it('rejects floating source references even when fixture checksums still match', async () => {
    const path = await copyFixtures();
    const manifest = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8'));
    manifest.hosts[0].sourceUrl = manifest.hosts[0].sourceUrl.replace(manifest.hosts[0].commit, 'main');
    await writeFile(join(path, 'manifest.json'), JSON.stringify(manifest));
    await expect(verifyProvenance(path)).rejects.toThrow('Source URL must pin');
  });
});

// Deliberately adversarial browser observations: proof checks must fail on
// missing hosts, misaligned geometry and unreadable/clipped painted text.
function proof() {
  const source = { id: 'host', expectedNotes: 3, expectedMarks: 6 };
  const noteBoxes = [10, 210, 410].map(x => ({ x, y: 10, width: 180, height: 80 }));
  const targetBoxes = [100, 160, 220].map(x => ({ x, y: 200, width: 20, height: 30 }));
  const observation = {
    id: 'host', bounds: { x: 0, y: 0, width: 600, height: 500 }, renderedMarks: 6,
    renderedNotes: 3, renderedConnectors: 3, validation: true,
    alignment: { ok: true, aligned: ['a', 'b', 'c'], warnings: [], missing: [] },
    manualPlacements: 0, finiteConnectorPoints: true,
    anchorBoxes: structuredClone(targetBoxes), targetBoxes, noteBoxes, layoutNoteBoxes: structuredClone(noteBoxes),
    paintedNoteBoxes: structuredClone(noteBoxes), browserNoteBoxes: structuredClone(noteBoxes),
    obstacleBoxes: Array.from({ length: 6 }, () => ({ x: 100, y: 200, width: 200, height: 100 })),
    candidateCounts: [8, 8, 8], quality: { invalidBoxCount: 0, boundsOverflowArea: 0, noteOverlapArea: 0, obstacleOverlapArea: 0 },
    hostTextCount: 6, minHostTextPixels: 14, minNoteTextPixels: 14,
    text: noteBoxes.flatMap(noteBox => [0, 20].map(offset => ({ text: 'Visible text', noteBox, box: { x: noteBox.x + 10, y: 20 + offset, width: 90, height: 16 }, pixels: 14 })))
  };
  return { source, observation };
}
describe('strict rendered consumer evidence', () => {
  it('accepts complete independent geometry and readable painted text', () => {
    const { source, observation } = proof();
    expect(() => assertObservations([observation], { hosts: [source] })).not.toThrow();
  });
  it('rejects absent evidence instead of reporting a green skip', () => {
    const { source } = proof();
    expect(() => assertObservations([], { hosts: [source] })).toThrow('All upstream hosts');
  });
  it.each(['alignment', 'collision', 'overflow', 'clipped', 'tiny', 'nonfinite', 'retention', 'obstacles', 'stroke', 'browser-box'])('rejects %s regressions', kind => {
    const { source, observation: o } = proof();
    if (kind === 'alignment') o.anchorBoxes[0]!.x += 1;
    if (kind === 'collision') o.noteBoxes[1] = { ...o.noteBoxes[0]! };
    if (kind === 'overflow') o.noteBoxes[0]!.x = -20;
    if (kind === 'clipped') o.text[0]!.box.width = 900;
    if (kind === 'tiny') o.minHostTextPixels = 9;
    if (kind === 'nonfinite') o.targetBoxes[0]!.x = Number.NaN;
    if (kind === 'retention') o.candidateCounts[0] = 9;
    if (kind === 'obstacles') o.obstacleBoxes = [];
    if (kind === 'stroke') o.paintedNoteBoxes[0]!.height += 220;
    if (kind === 'browser-box') o.browserNoteBoxes[0]!.x += 5;
    expect(() => assertObservations([o], { hosts: [source] })).toThrow();
  });
});
