import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { writeLine } from './log.mjs';
import { assertImmutableAction } from './workflow-action-pin.mjs';

for (const file of await readdir(new URL('../.github/workflows/', import.meta.url))) {
  if (!/\.ya?ml$/.test(file)) continue;
  const workflow = await read(`.github/workflows/${file}`);
  for (const match of workflow.matchAll(/^\s*(?:-\s+)?uses:\s*([^\s]+)/gm)) {
    const action = match[1].replace(/^["']/, '').split('@')[0];
    if (!action.startsWith('./')) assertImmutableAction(workflow, action, file);
  }
}

const pkg = JSON.parse(await read('package.json'));
const ci = await read('.github/workflows/ci.yml');
const codeql = await read('.github/workflows/codeql.yml');
const codeqlConfig = await read('.github/codeql/codeql-config.yml');
const dependencyReview = await read('.github/workflows/dependency-review.yml');
const scorecard = await read('.github/workflows/scorecard.yml');
assertImmutableAction(scorecard, 'ossf/scorecard-action', '.github/workflows/scorecard.yml');
const dependabot = await read('.github/dependabot.yml');
const securityPolicy = await read('SECURITY.md');
const docs = await read('docs/security-automation.md');
const verification = await read('docs/verification.md');

assert.equal(pkg.scripts?.['test:security-automation'], 'node scripts/check-security-automation.mjs');
assert.ok(pkg.scripts?.check?.includes('npm run test:security-automation'), 'npm run check must include test:security-automation');

for (const term of [
  'name: CI',
  'pull_request:',
  'runs-on: ubuntu-latest',
  'npm run check'
]) {
  assertIncludes(ci, term, '.github/workflows/ci.yml');
}

for (const term of [
  'name: CodeQL',
  'pull_request:',
  'push:',
  'schedule:',
  'workflow_dispatch:',
  'security-events: write',
  'pull-requests: read',
  'github/codeql-action/init@',
  'languages: javascript-typescript',
  'config-file: ./.github/codeql/codeql-config.yml',
  'queries: security-extended,security-and-quality',
  'github/codeql-action/analyze@'
]) {
  assertIncludes(codeql, term, '.github/workflows/codeql.yml');
}

for (const term of [
  '@ponchia/annotations CodeQL config',
  'query-filters:',
  'js/html-constructed-from-input',
  'escaped SVG string renderers',
  'SECURITY.md'
]) {
  assertIncludes(codeqlConfig, term, '.github/codeql/codeql-config.yml');
}

for (const term of [
  'name: Dependency Review',
  'pull_request:',
  'contents: read',
  'pull-requests: read',
  'actions/dependency-review-action@',
  'fail-on-severity: high',
  'warn-only: false'
]) {
  assertIncludes(dependencyReview, term, '.github/workflows/dependency-review.yml');
}

assert.ok(!dependencyReview.includes('workflow_dispatch:'), 'Dependency Review should run only with pull request base/head context');

for (const [workflow, label] of [
  [ci, '.github/workflows/ci.yml'],
  [codeql, '.github/workflows/codeql.yml'],
  [dependencyReview, '.github/workflows/dependency-review.yml']
]) {
  assertIncludes(workflow, 'runs-on: ubuntu-latest', label);
  assertNoPublicSelfHostedRunner(workflow, label);
}

for (const term of [
  'name: Scorecard',
  'branch_protection_rule:',
  'push:',
  'schedule:',
  'workflow_dispatch:',
  'id-token: write',
  'security-events: write',
  'persist-credentials: false',
  'results_format: sarif',
  'publish_results: true',
  'github/codeql-action/upload-sarif@'
]) {
  assertIncludes(scorecard, term, '.github/workflows/scorecard.yml');
}

for (const term of [
  'package-ecosystem: npm',
  'package-ecosystem: github-actions',
  'optional-peers'
]) {
  assertIncludes(dependabot, term, '.github/dependabot.yml');
}

for (const term of [
  'dev-tooling:',
  'optional-peers:',
  'update-types:',
  'version-update:semver-major',
  'dependency-name: mermaid',
  'dependency-name: typescript',
  'dependency-name: vitest',
  'dependency-name: jsdom'
]) {
  assertIncludes(dependabot, term, '.github/dependabot.yml');
}

for (const term of [
  'private vulnerability reporting',
  'Host apps are responsible'
]) {
  assertIncludes(securityPolicy, term, 'SECURITY.md');
}

for (const term of [
  'Security Automation',
  'CodeQL',
  'Dependency Review',
  'OpenSSF Scorecard',
  'js/html-constructed-from-input',
  'Dependabot alerts',
  'Dependabot security updates',
  'Version Update Compatibility Policy',
  'Automated security fixes',
  'Private vulnerability reporting',
  'Secret scanning push protection',
  'Runner Policy',
  'GitHub-hosted runners',
  'Do not move',
  'self-hosted runner',
  'ubuntu-latest',
  'npm run test:security-automation'
]) {
  assertIncludes(docs, term, 'docs/security-automation.md');
}

for (const term of [
  'CodeQL',
  'Dependency Review',
  'OpenSSF Scorecard',
  'standard GitHub-hosted',
  'docs/security-automation.md'
]) {
  assertIncludes(verification, term, 'docs/verification.md');
}

const toolingPackage = JSON.parse(await read('.github/tooling/npm/package.json'));
const toolingLock = JSON.parse(await read('.github/tooling/npm/package-lock.json'));
assert.equal(toolingPackage.private, true, 'The npm CLI project must remain private');
assert.deepEqual(toolingPackage.dependencies, { npm: '11.21.1' }, 'Review the exact supported npm CLI');
assert.equal(toolingPackage.overrides, undefined, 'Do not override or repack npm bundled dependencies');
assert.equal(toolingLock.lockfileVersion, 3, 'Tooling needs an integrity-bearing package lock');
assert.equal(toolingLock.name, toolingPackage.name);
assert.equal(toolingLock.packages?.['']?.name, toolingPackage.name);
assert.deepEqual(toolingLock.packages?.['']?.dependencies, toolingPackage.dependencies);
assert.deepEqual(toolingLock.packages?.['']?.engines, toolingPackage.engines);
const npmLock = toolingLock.packages?.['node_modules/npm'];
assert.equal(npmLock?.version, '11.21.1');
assert.equal(npmLock?.resolved, 'https://registry.npmjs.org/npm/-/npm-11.21.1.tgz');
assert.match(npmLock?.integrity ?? '', /^sha512-[A-Za-z0-9+/]{86}==$/, 'The reviewed npm tarball needs SHA-512 integrity');
for (const [path, entry] of Object.entries(toolingLock.packages)) {
  if (path === '' || path === 'node_modules/npm') continue;
  assert.ok(path.startsWith('node_modules/npm/'), 'Tooling dependencies must stay isolated below npm');
  assert.equal(entry.inBundle, true, `${path} must inherit the reviewed npm tarball integrity`);
}

const audit = await read('.github/workflows/dependency-audit.yml');
const release = await read('.github/workflows/release.yml');
const recovery = await read('.github/workflows/recover-release-notes.yml');
const canary = await read('.github/workflows/canary.yml');
for (const [job, label] of [
  [workflowJob(audit, 'audit'), 'Dependency Audit'],
  [workflowJob(release, 'publish-npm'), 'Protected npm publisher'],
  [workflowJob(recovery, 'recover-notes'), 'Signed release recovery'],
  [workflowJob(canary, 'publish'), 'Canary archive publisher']
]) {
  assert.ok(!/npm\s+install\s+--global\b/.test(job), `${label} must use the committed CLI lock`);
  assert.ok(!/^\s*cache:\s*npm\s*$/m.test(job), `${label} must not restore an npm cache`);
  for (const term of [
    'package-manager-cache: false',
    'npm ci --prefix "$tooling" --ignore-scripts --no-audit --no-fund',
    'export PATH="$tooling/node_modules/.bin:$PATH"',
    'hash -r',
    'test "$(command -v npm)" = "$tooling/node_modules/.bin/npm"',
    'test "$(realpath "$(command -v npm)")" = "$(realpath "$tooling/node_modules/npm/bin/npm-cli.js")"',
    'test "$(npm --version)" = "11.21.1"',
    '"$tooling/node_modules/.bin" >> "$GITHUB_PATH"'
  ]) assertIncludes(job, term, label);
}

for (const term of [
  '.github/tooling/npm/package.json',
  '.github/tooling/npm/package-lock.json',
  'schedule:',
  'workflow_dispatch:',
  'npm audit --package-lock-only --ignore-scripts --include=dev --audit-level=high --json > npm-audit.json || status=1',
  'npm audit --prefix .github/tooling/npm --package-lock-only --ignore-scripts --include=dev --audit-level=high --json > npm-tooling-audit.json || status=1',
  "node --input-type=module <<'NODE' || status=1",
  'assert.equal(report.error, undefined',
  'Number.isInteger(count) && count >= 0',
  'assert.equal(count, 0',
  'exit "$status"',
  'if: always()',
  'path: |\n            npm-audit.json\n            npm-tooling-audit.json'
]) assertIncludes(audit, term, 'Whole-lock advisory audit');
assertIncludes(dependabot, 'directory: /.github/tooling/npm', 'Isolated CLI updates');
assertIncludes(securityPolicy, 'https://github.com/Ponchia/bronto-annotations/security/advisories/new', 'Private vulnerability reporting');

// Recovery must still verify the requested immutable registry package.
for (const term of [
  'npm install --ignore-scripts --no-audit --no-fund',
  '"@ponchia/annotations@$RELEASE_VERSION"',
  'npm audit signatures --json --include-attestations',
  'node scripts/verify-published-provenance.mjs'
]) assertIncludes(recovery, term, 'Signed release recovery');

writeLine('Security automation verified: CodeQL, Dependency Review, Scorecard, Dependabot docs, public runner policy, and public security settings guidance.');

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}

function assertNoPublicSelfHostedRunner(text, label) {
  assert.ok(!/\bruns-on:\s*(?:self-hosted|arc-vps-[\w-]+)/.test(text), `${label} public pull_request jobs must stay on GitHub-hosted runners`);
}

function workflowJob(text, name) {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${name}:`);
  assert.ok(start >= 0, `Expected workflow job ${name}`);
  const remaining = lines.slice(start + 1);
  const end = remaining.findIndex((line) => /^  [\w-]+:$/.test(line));
  return [lines[start], ...(end < 0 ? remaining : remaining.slice(0, end))].join('\n');
}
