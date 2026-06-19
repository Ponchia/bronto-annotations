import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await read('package.json'));
const codeql = await read('.github/workflows/codeql.yml');
const codeqlConfig = await read('.github/codeql/codeql-config.yml');
const dependencyReview = await read('.github/workflows/dependency-review.yml');
const scorecard = await read('.github/workflows/scorecard.yml');
const dependabot = await read('.github/dependabot.yml');
const securityPolicy = await read('SECURITY.md');
const docs = await read('docs/security-automation.md');
const readme = await read('README.md');

assert.equal(pkg.scripts?.['test:security-automation'], 'node scripts/check-security-automation.mjs');
assert.ok(pkg.scripts?.check?.includes('npm run test:security-automation'), 'npm run check must include test:security-automation');

for (const term of [
  'name: CodeQL',
  'pull_request:',
  'push:',
  'schedule:',
  'workflow_dispatch:',
  'security-events: write',
  'pull-requests: read',
  'github/codeql-action/init@v4',
  'languages: javascript-typescript',
  'config-file: ./.github/codeql/codeql-config.yml',
  'queries: security-extended,security-and-quality',
  'github/codeql-action/analyze@v4'
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
  'actions/dependency-review-action@v5',
  'fail-on-severity: high',
  'warn-only: false'
]) {
  assertIncludes(dependencyReview, term, '.github/workflows/dependency-review.yml');
}

assert.ok(!dependencyReview.includes('workflow_dispatch:'), 'Dependency Review should run only with pull request base/head context');

for (const term of [
  'name: Scorecard',
  'branch_protection_rule:',
  'push:',
  'schedule:',
  'workflow_dispatch:',
  'id-token: write',
  'security-events: write',
  'persist-credentials: false',
  'ossf/scorecard-action@v2.4.3',
  'results_format: sarif',
  'publish_results: true',
  'github/codeql-action/upload-sarif@v4'
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
  'Automated security fixes',
  'Private vulnerability reporting',
  'Secret scanning push protection',
  'npm run test:security-automation'
]) {
  assertIncludes(docs, term, 'docs/security-automation.md');
}

for (const term of [
  'CodeQL',
  'Dependency Review',
  'OpenSSF Scorecard',
  'docs/security-automation.md'
]) {
  assertIncludes(readme, term, 'README.md');
}

console.log('Security automation verified: CodeQL, Dependency Review, Scorecard, Dependabot docs, and public security settings guidance.');

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}
