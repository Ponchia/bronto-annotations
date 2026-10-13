import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const finiteBox = b => b && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(b[k])) && b.width > 0 && b.height > 0;
const area = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const contains = (outer, inner, tolerance = 0.25) => inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.width <= outer.x + outer.width + tolerance && inner.y + inner.height <= outer.y + outer.height + tolerance;

export async function verifyProvenance(directory) {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.hosts.length, 3, 'Expected two Vega sources and one Mermaid source');
  assert.equal(new Set(manifest.hosts.map(h => h.id)).size, 3);
  const readChecked = async entry => {
    const file = resolve(root, entry.file);
    assert.ok(file.startsWith(root + sep), 'Fixture path escapes provenance root');
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const bytes = await readFile(file);
    assert.equal(sha256(bytes), entry.sha256, `${entry.file}: checksum changed; review upstream source and update expected provenance explicitly`);
    return bytes;
  };
  assert.equal(manifest.licenses.length, 2, 'Both complete upstream license notices are required');
  for (const license of manifest.licenses) {
    const bytes = await readChecked(license);
    assert.ok(bytes.toString().includes('Copyright') && bytes.toString().includes('SOFTWARE'), 'Incomplete license notice');
  }
  for (const host of manifest.hosts) {
    assert.match(host.commit, /^[a-f0-9]{40}$/);
    assert.match(host.sourceSha256, /^[a-f0-9]{64}$/);
    const expectedUrl = `https://github.com/${host.repository}/blob/${host.commit}/${host.sourceFile}`;
    assert.ok(host.sourceUrl === expectedUrl || host.sourceUrl === `${expectedUrl}#L${host.lines.start}-L${host.lines.end}`, 'Source URL must pin the declared commit/file/range');
    assert.ok(Number.isInteger(host.lines.start) && host.lines.start > 0 && host.lines.end >= host.lines.start);
    assert.ok(host.adaptations.length > 0 && host.extraction.length > 0, 'Extraction and renderer adaptations must be explicit');
    assert.equal(host.expectedNotes, 3);
    const license = manifest.licenses.find(l => l.host === host.host);
    assert.ok(license, 'Missing upstream license');
    assert.equal(license.url, `https://github.com/${host.repository}/blob/${host.commit}/LICENSE`);
    const bytes = await readChecked(host);
    assert.equal(bytes.toString().split('\n').length - 1, host.lines.end - host.lines.start + 1, 'Extracted line range changed');
    if (host.host === 'vega') {
      assert.equal(host.repository, 'vega/vega');
      assert.equal(host.sourceSha256, host.sha256, 'Complete Vega input must match upstream source bytes');
      const spec = JSON.parse(bytes);
      const visit = value => {
        if (!value || typeof value !== 'object') return;
        for (const [key, child] of Object.entries(value)) {
          assert.notEqual(key, 'url', 'Offline Vega input cannot load remote data/images');
          visit(child);
        }
      };
      visit(spec);
      assert.equal(spec.data[0].values.length, host.expectedMarks);
    } else {
      assert.equal(host.host, 'mermaid');
      assert.equal(host.repository, 'mermaid-js/mermaid');
      assert.equal(host.fence.language, 'mermaid-example');
      assert.ok(bytes.toString().startsWith('flowchart LR\n  subgraph Client\n'));
      assert.ok(bytes.toString().includes('Auth -. token .-> UI'));
      assert.equal(host.expectedMarks, 6);
    }
  }
  return manifest;
}

export function assertObservations(observations, manifest) {
  assert.equal(observations.length, manifest.hosts.length, 'All upstream hosts must produce evidence');
  assert.equal(new Set(observations.map(o => o.id)).size, observations.length);
  for (const o of observations) {
    const source = manifest.hosts.find(h => h.id === o.id);
    assert.ok(source, `Unexpected host ${o.id}`);
    const label = o.id;
    assert.equal(o.renderedMarks, source.expectedMarks, `${label}: incomplete upstream graphic`);
    assert.equal(o.renderedNotes, source.expectedNotes, `${label}: note count`);
    assert.equal(o.renderedConnectors, source.expectedNotes, `${label}: connector count`);
    assert.equal(o.validation, true, `${label}: anchor validation`);
    assert.equal(o.alignment.ok, true, `${label}: target alignment`);
    assert.equal(o.alignment.aligned.length, source.expectedNotes);
    assert.equal(o.alignment.warnings.length + o.alignment.missing.length, 0);
    assert.equal(o.manualPlacements, 0, `${label}: automatic placement required`);
    assert.equal(o.finiteConnectorPoints, true, `${label}: finite connector geometry`);
    assert.ok(finiteBox(o.bounds));
    assert.equal(o.anchorBoxes.length, source.expectedNotes);
    assert.equal(o.targetBoxes.length, source.expectedNotes);
    assert.equal(o.noteBoxes.length, source.expectedNotes);
    assert.equal(o.layoutNoteBoxes.length, source.expectedNotes);
    assert.equal(o.paintedNoteBoxes.length, source.expectedNotes);
    assert.equal(o.browserNoteBoxes.length, source.expectedNotes);
    assert.ok(o.obstacleBoxes.length >= source.expectedMarks, `${label}: missing protected host obstacles`);
    assert.equal(o.candidateCounts.length, source.expectedNotes);
    assert.ok(o.protectedHostBoxes.length >= source.expectedMarks, `${label}: missing independently protected host content`);
    assert.ok(o.candidateCounts.every(n => Number.isInteger(n) && n > 0 && n <= 8), `${label}: candidate retention exceeded maxCandidates:8`);
    for (const list of [o.anchorBoxes, o.targetBoxes, o.noteBoxes, o.layoutNoteBoxes, o.paintedNoteBoxes, o.browserNoteBoxes, o.obstacleBoxes, o.protectedHostBoxes]) assert.ok(list.every(finiteBox), `${label}: non-finite or empty geometry`);
    o.anchorBoxes.forEach((a, i) => {
      for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(a[key] - o.targetBoxes[i][key]) <= 0.25, `${label}: independently measured target ${i} ${key} differs`);
    });
    // Paint order may differ from layout order, so match boxes by rectangle rather than index.
    for (const [index, note] of o.noteBoxes.entries()) {
      const painted = o.paintedNoteBoxes[index], client = o.browserNoteBoxes[index];
      assert.ok(contains(painted, note), `${label}: stroke envelope must contain fill geometry`);
      assert.ok([note, painted].some(b => ['x', 'y', 'width', 'height'].every(k => Math.abs(b[k] - client[k]) <= 0.25)), `${label}: browser note rectangle disagrees with measured fill/stroke geometry`);
      assert.ok(contains(o.bounds, painted), `${label}: painted note overflows canvas`);
      assert.ok(o.layoutNoteBoxes.some(b => ['x', 'y', 'width', 'height'].every(k => Math.abs(b[k] - note[k]) <= 0.25)), `${label}: painted note differs from layout`);
      for (const obstacle of o.protectedHostBoxes) assert.ok(area(painted, obstacle) <= 0.01, `${label}: painted note covers protected host content`);
    }
    for (let i = 0; i < o.noteBoxes.length; i++) for (let j = i + 1; j < o.noteBoxes.length; j++) assert.ok(area(o.paintedNoteBoxes[i], o.paintedNoteBoxes[j]) <= 0.01, `${label}: painted notes collide`);
    for (const key of ['invalidBoxCount', 'boundsOverflowArea', 'noteOverlapArea', 'obstacleOverlapArea']) assert.equal(o.quality[key], 0, `${label}: ${key}`);
    assert.ok(o.hostTextCount >= source.expectedMarks, `${label}: host labels missing`);
    assert.ok(o.minHostTextPixels >= 13.5 && o.minNoteTextPixels >= 13.5, `${label}: mobile text scaled below readable size`);
    assert.ok(o.text.length >= source.expectedNotes * 2);
    for (const text of o.text) {
      assert.ok(text.text.trim() && finiteBox(text.box));
      assert.ok(contains(text.noteBox, text.box), `${label}: painted text is clipped or spills outside note: ${text.text}`);
      assert.ok(text.pixels >= 13.5, `${label}: illegible text`);
    }
  }
}

// Capability metadata can disagree with automation's input delivery (WebKit
// reports zero maxTouchPoints while delivering native pointerType="touch").
// Keep it as recorded telemetry; require the actual per-host interaction.
export function assertNarrowInteractions(profile, interaction, manifest, touchEmulated) {
  assert.ok(Number.isInteger(profile.touch) && profile.touch >= 0, 'Invalid reported touch capability');
  for (const host of manifest.hosts) {
    const input = interaction[host.id];
    assert.equal(input?.keyboardScroll, true, `${host.id}: narrow host must remain keyboard navigable`);
    if (touchEmulated) {
      assert.ok(Number.isInteger(input.touchPointer) && input.touchPointer > 0,
        `${host.id}: host must receive a real emulated touch pointer`);
    } else {
      assert.equal(input.touchPointer, null, `${host.id}: narrow-desktop lane must not claim emulated touch coverage`);
    }
  }
}
