import assert from 'node:assert/strict';

/** Require a real uses entry for this action, with every occurrence SHA-pinned.
 * This deliberately checks our block-style workflow entries, not arbitrary YAML.
 * Review still decides which upstream commit is trusted; pins prevent tag drift.
 */
export function assertImmutableAction(workflow, action, label) {
  const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s*(.*?)\s*$/gm)]
    .map((match) => match[1].replace(/\s+#.*$/, '').trim())
    .map((value) => value.replace(/^(['"])(.*)\1$/, '$2'));
  const refs = uses.filter((value) => value === action || value.startsWith(`${action}@`));
  assert.ok(refs.length > 0, `${label} must execute ${action}, not merely mention it`);
  for (const ref of refs) {
    assert.match(ref.slice(action.length), /^@[a-f0-9]{40}$/,
      `${label}: ${action} must use a full immutable commit SHA`);
  }
}

/** Check our single block-style browser container against the locked tool.
 * This is a static version/pin check; CI verifies the actual image metadata.
 */
export function assertMatchingPlaywrightImage(workflow, version, label) {
  assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `${label}: missing exact Playwright version`);
  const images = [...workflow.matchAll(/^\s*image:\s*(.*?)\s*$/gm)]
    .map((match) => match[1].replace(/\s+#.*$/, '').trim())
    .map((value) => value.replace(/^(['"])(.*)\1$/, '$2'));
  assert.equal(images.length, 1, `${label}: expected exactly one browser image`);
  const match = /^mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[a-f0-9]{64}$/.exec(images[0]);
  assert.ok(match, `${label}: require the official versioned image and immutable digest`);
  assert.equal(match[1], version, `${label}: update Playwright and its browser image together`);
}
