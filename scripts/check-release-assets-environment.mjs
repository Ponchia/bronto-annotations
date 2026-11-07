/** Read-only prerequisite for the existing, separately protected asset mirror.
 * No environment is referenced by a write job until its restrictive policy has
 * been verified. This avoids automatically creating an unprotected environment.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export function assertReleaseAssetsEnvironment(environment, branches) {
  assert.equal(environment?.name, 'release-assets', 'Expected the existing release-assets environment');
  assert.ok(Number.isSafeInteger(environment.id) && environment.id > 0, 'Environment is missing');
  assert.equal(environment.deployment_branch_policy?.custom_branch_policies, true, 'Explicit main-only policy required');
  assert.equal(environment.deployment_branch_policy?.protected_branches, false, 'A broad protected-branches policy is not main-only');
  assert.equal(branches?.total_count, 1, 'Only main may deploy release assets');
  assert.equal(branches?.branch_policies?.length, 1, 'Unexpected environment branch policies');
  assert.equal(branches.branch_policies[0].name, 'main', 'Only the main branch may deploy');
  assert.equal(branches.branch_policies[0].type, 'branch', 'A matching tag is not the main branch');
  const rules = environment.protection_rules?.filter((rule) => rule.type === 'required_reviewers') ?? [];
  assert.equal(rules.length, 1, 'Required maintainer review is missing');
  const reviewers = rules[0].reviewers;
  assert.equal(reviewers?.length, 1, 'Expected the explicit single-maintainer review boundary');
  assert.equal(reviewers[0].type, 'User');
  assert.equal(reviewers[0].reviewer?.id, 4352894, 'Unexpected required reviewer identity');
  assert.equal(reviewers[0].reviewer?.login, 'Ponchia');
  return { environment: environment.name, id: environment.id, branch: 'main', requiredReviewer: 'Ponchia', verified: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  assert.equal(process.argv.length, 2, 'This check accepts no alternate environment or repository');
  const exec = promisify(execFile);
  const get = async (path) => JSON.parse((await exec('gh', ['api', path], {
    encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024,
  })).stdout);
  const path = 'repos/Ponchia/bronto-annotations/environments/release-assets';
  const environment = await get(path);
  const branches = await get(`${path}/deployment-branch-policies?per_page=100`);
  console.log(JSON.stringify(assertReleaseAssetsEnvironment(environment, branches), null, 2));
}
