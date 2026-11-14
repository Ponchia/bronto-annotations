import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertImmutableAction, assertMatchingPlaywrightImage } from '../workflow-action-pin.mjs';

const action = 'ossf/scorecard-action';
const oldSha = '2d1146689b8cda280b9bc96326124645441f03bc';
const newSha = 'fa7117db83c52d787ae5a89f350999701505d78e';
const check = (text) => assertImmutableAction(text, action, 'scorecard.yml');

for (const sha of [oldSha, newSha]) {
  test(`accepts reviewed immutable revision ${sha.slice(0, 7)}`, () => {
    check(`      - uses: ${action}@${sha} # version comment`);
    check(`        uses: '${action}@${sha}'`);
    check(`        uses: "${action}@${sha}"`);
  });
}
for (const ref of ['v2.5.0', 'main', newSha.slice(0, 12), `${newSha}0`, '${{ inputs.ref }}', '']) {
  test(`rejects mutable or malformed reference ${ref || '(empty)'}`, () => {
    assert.throws(() => check(`      - uses: ${action}@${ref}`));
  });
}
test('rejects a comment-only pin', () => {
  assert.throws(() => check(`# - uses: ${action}@${newSha}`));
});
test('rejects a different action owner', () => {
  assert.throws(() => check(`- uses: unrelated/scorecard-action@${newSha}`));
});
test('a pinned decoy cannot hide a second mutable execution', () => {
  assert.throws(() => check(`- uses: ${action}@${newSha}\n- uses: ${action}@main`));
});
test('rejects references with an appended payload', () => {
  assert.throws(() => check(`- uses: ${action}@${newSha} unexpected`));
});

for (const name of ['readiness-matrix.json', 'completion-audit.json']) {
  test(`${name} delegates immutable pin validation rather than freezing an old release`, () => {
    const text = readFileSync(new URL(`../../docs/${name}`, import.meta.url), 'utf8');
    assert.ok(text.includes(`${action}@`));
    assert.ok(!/ossf\/scorecard-action@[a-f0-9]{40}/.test(text));
  });
}

const browserVersion = '1.65.0';
const browserImage = `mcr.microsoft.com/playwright:v${browserVersion}-noble@sha256:${'a'.repeat(64)}`;
const browserCheck = (text, version = browserVersion) =>
  assertMatchingPlaywrightImage(text, version, 'cross-browser.yml');

test('accepts a matching version and digest, including quoted workflow values', () => {
  browserCheck(`      image: ${browserImage}`);
  browserCheck(`      image: '${browserImage}' # reviewed registry digest`);
  browserCheck(`      image: "${browserImage}"`);
});
test('rejects the package/image drift that broke cross-browser CI', () => {
  assert.throws(() => browserCheck(`image: ${browserImage}`, '1.64.1'), /together/);
});
for (const image of [
  `mcr.microsoft.com/playwright:v${browserVersion}-noble`,
  `mcr.microsoft.com/playwright:latest@sha256:${'a'.repeat(64)}`,
  browserImage.replace('mcr.microsoft.com', 'untrusted.example'),
  browserImage.slice(0, -1),
  `${browserImage} extra`,
]) {
  test(`rejects mutable or malformed browser reference ${image.slice(0, 70)}`, () => {
    assert.throws(() => browserCheck(`image: ${image}`));
  });
}
test('a commented or second image cannot satisfy the browser pin check', () => {
  assert.throws(() => browserCheck(`# image: ${browserImage}`));
  assert.throws(() => browserCheck(`image: ${browserImage}\nimage: untrusted:latest`));
});
test('unknown or floating package versions cannot pass the browser pin check', () => {
  for (const version of ['', '^1.65.0', 'latest']) {
    assert.throws(() => browserCheck(`image: ${browserImage}`, version));
  }
});
