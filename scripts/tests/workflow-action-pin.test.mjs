import assert from 'node:assert/strict';
import test from 'node:test';
import { assertImmutableAction } from '../workflow-action-pin.mjs';

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
