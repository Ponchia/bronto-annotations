import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const readme = await read('README.md');
const changelog = await read('CHANGELOG.md');
const contributing = await read('CONTRIBUTING.md');
const security = await read('SECURITY.md');
const releaseDocs = await read('docs/release.md');
const ci = await read('.github/workflows/ci.yml');
const release = await read('.github/workflows/release.yml');
const dependabot = await read('.github/dependabot.yml');
const prTemplate = await read('.github/pull_request_template.md');
const bugTemplate = await read('.github/ISSUE_TEMPLATE/bug_report.yml');
const featureTemplate = await read('.github/ISSUE_TEMPLATE/feature_request.yml');
const codeowners = await read('.github/CODEOWNERS');

assert.notEqual(pkg.version, '0.0.0', 'package version must be release-shaped, not 0.0.0');
assert.equal(lock.version, pkg.version, 'package-lock root version must match package.json');
assert.equal(lock.packages?.['']?.version, pkg.version, 'package-lock package version must match package.json');
assert.equal(pkg.private, false, 'package must remain publishable even if the GitHub repository is private');
assert.equal(pkg.repository?.type, 'git', 'package must declare git repository metadata');
assert.equal(pkg.repository?.url, 'git+https://github.com/Ponchia/bronto-annotations.git');
assert.equal(pkg.homepage, 'https://github.com/Ponchia/bronto-annotations#readme');
assert.equal(pkg.bugs?.url, 'https://github.com/Ponchia/bronto-annotations/issues');
assert.equal(pkg.publishConfig?.access, 'public', 'scoped package publish access must be explicit');
assert.match(pkg.engines?.node ?? '', /^>=20\./, 'package must document the Node support floor');
assert.match(pkg.packageManager ?? '', /^npm@\d+\.\d+\.\d+$/, 'package must pin the package manager family/version');

for (const keyword of [
  'annotations',
  'svg',
  'react',
  'vega',
  'mermaid',
  'd2',
  'react-flow',
  'data-visualization',
  'diagram',
  'layout'
]) {
  assert.ok(pkg.keywords?.includes(keyword), `package keywords must include ${keyword}`);
}

assert.equal(pkg.scripts?.['test:repo'], 'node scripts/check-repo-readiness.mjs');
assert.ok(pkg.scripts?.check?.includes('npm run test:repo'), 'npm run check must include test:repo');

for (const path of [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/dependabot.yml',
  '.github/CODEOWNERS',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/release.md'
]) {
  await assertPath(path);
}

for (const term of [
  'pull_request:',
  'branches:',
  '- main',
  'matrix:',
  'node-version:',
  '- 20',
  '- 22',
  'npm ci',
  'npm run check',
  'actions/upload-artifact@v4',
  '.tmp/screenshots',
  '.tmp-packed-screenshots'
]) {
  assertIncludes(ci, term, '.github/workflows/ci.yml');
}

for (const term of [
  'release:',
  'types:',
  '- published',
  'workflow_dispatch:',
  'id-token: write',
  'npm run check',
  'npm pack --json',
  'npm publish --provenance --access public',
  'NODE_AUTH_TOKEN',
  'environment: npm'
]) {
  assertIncludes(release, term, '.github/workflows/release.yml');
}

for (const term of [
  'package-ecosystem: npm',
  'package-ecosystem: github-actions',
  'optional-peers'
]) {
  assertIncludes(dependabot, term, '.github/dependabot.yml');
}

for (const term of [
  'npm run check',
  'Root import remains free',
  'Product Boundary'
]) {
  assertIncludes(prTemplate, term, '.github/pull_request_template.md');
}

for (const term of [
  'Minimal reproduction',
  'Host surface',
  'Diagnostics'
]) {
  assertIncludes(bugTemplate, term, '.github/ISSUE_TEMPLATE/bug_report.yml');
}

for (const term of [
  'Product boundary check',
  'Proposed API or behavior'
]) {
  assertIncludes(featureTemplate, term, '.github/ISSUE_TEMPLATE/feature_request.yml');
}

assertIncludes(codeowners, '@Ponchia', '.github/CODEOWNERS');

for (const term of [
  '0.1.0 - 2026-06-19',
  'DOM-free annotation models',
  'Repository'
]) {
  assertIncludes(changelog, term, 'CHANGELOG.md');
}

for (const term of [
  'Product Boundaries',
  'npm run check',
  'Adapter Changes',
  'docs/release.md'
]) {
  assertIncludes(contributing, term, 'CONTRIBUTING.md');
}

for (const term of [
  'Reporting a Vulnerability',
  'Security Boundary',
  'Host apps are responsible'
]) {
  assertIncludes(security, term, 'SECURITY.md');
}

for (const term of [
  'Release Runbook',
  'npm pack --dry-run',
  'npm provenance',
  'Root imports work without optional peers'
]) {
  assertIncludes(releaseDocs, term, 'docs/release.md');
}

for (const term of [
  'Repository Quality',
  'CI runs `npm run check`',
  'Release publishing uses npm provenance',
  'Security policy'
]) {
  assertIncludes(readme, term, 'README.md');
}

console.log('Repository readiness verified: metadata, CI, release, templates, lifecycle docs, and package manager policy.');

async function read(path) {
  return readFile(pathUrl(path), 'utf8');
}

async function assertPath(path) {
  try {
    await access(pathUrl(path));
  } catch {
    throw new Error(`Expected repository readiness path to exist: ${path}`);
  }
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}

function pathUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}
