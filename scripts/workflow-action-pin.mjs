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
