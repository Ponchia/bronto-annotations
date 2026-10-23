import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const pkg = JSON.parse(await read('package.json'));
const workflow = await read('.github/workflows/canary.yml');
const docs = await read('docs/canary-release.md');
const publishReport = await read('docs/canary-publish-report.md');
const releaseDocs = await read('docs/release.md');
const prepareScript = await read('scripts/prepare-github-canary.mjs');
const smokeScript = await read('scripts/smoke-registry-consumer.mjs');

for (const path of [
  '.github/workflows/canary.yml',
  'docs/canary-release.md',
  'docs/canary-publish-report.md',
  'scripts/prepare-github-canary.mjs',
  'scripts/smoke-registry-consumer.mjs'
]) {
  await assertPath(path);
}

assert.equal(pkg.scripts?.['test:canary'], 'node scripts/check-canary-readiness.mjs');
assert.ok(pkg.scripts?.check?.includes('npm run test:canary'), 'npm run check must include test:canary');

for (const term of [
  'workflow_dispatch:',
  'publish:',
  'packages: write',
  'registry-url: https://npm.pkg.github.com',
  "scope: '@ponchia'",
  'node scripts/prepare-github-canary.mjs',
  'npm publish --tag canary --registry https://npm.pkg.github.com',
  'node scripts/smoke-registry-consumer.mjs',
  'NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}'
]) {
  assertIncludes(workflow, term, '.github/workflows/canary.yml');
}

// Only the two committed tooling manifests may cross from the code-running
// read-only build into the publisher, which deliberately has no checkout.
const canaryBuild = workflowJob(workflow, 'github-packages');
const canaryPublish = workflowJob(workflow, 'publish');
assert.ok(!canaryPublish.includes('actions/checkout@'), 'Canary publisher must not check out source');
assert.ok(!/npm (?:run|install)\b/.test(canaryPublish), 'Canary publisher must not build or install a registry consumer');
assertIncludes(canaryBuild, 'name: github-packages-canary-npm-${{ github.run_id }}-${{ steps.canary.outputs.version }}', 'Canary tooling upload');
assertIncludes(canaryBuild, 'path: |\n            .github/tooling/npm/package.json\n            .github/tooling/npm/package-lock.json', 'Canary tooling allowlist');
assertIncludes(canaryBuild, 'include-hidden-files: true', 'Canary tooling upload');
assertIncludes(canaryBuild, 'if-no-files-found: error', 'Canary tooling upload');
assertIncludes(canaryPublish, 'name: github-packages-canary-npm-${{ github.run_id }}-${{ needs.github-packages.outputs.version }}', 'Canary tooling download');
assertIncludes(canaryPublish, 'path: ${{ runner.temp }}/canary-npm-tooling', 'Canary tooling download');
assertIncludes(canaryPublish, 'entries.map((entry) => entry.name).sort(), Object.keys(expected).sort()', 'Canary tooling contents verification');
assertIncludes(canaryPublish, 'entries.every((entry) => entry.isFile())', 'Canary tooling regular-file verification');
assertIncludes(canaryPublish, "createHash('sha256').update(readFileSync(join(directory, file))).digest('hex'), digest", 'Canary tooling integrity verification');
for (const file of ['package.json', 'package-lock.json']) {
  const digest = createHash('sha256').update(await read(`.github/tooling/npm/${file}`)).digest('hex');
  assertIncludes(canaryPublish, `'${file}': '${digest}'`, `Canary committed ${file} hash`);
}
assert.ok(
  canaryPublish.indexOf('const expected = {') < canaryPublish.indexOf('npm ci --prefix'),
  'Canary tooling hashes must be verified before installation'
);

for (const term of [
  'GitHub Packages Canary',
  'gh workflow run canary.yml -f publish=true',
  '0.1.0-canary.',
  'docs/canary-publish-report.md',
  'clean registry consumer',
  'npm run test:canary'
]) {
  assertIncludes(docs, term, 'docs/canary-release.md');
}

for (const term of [
  'Canary Publish Report',
  'Workflow run: `27827132524`',
  '0.1.0-canary.1.e754177',
  'Publish GitHub Packages canary`: success',
  'Smoke registry consumer`: success',
  'Registry consumer smoke verified',
  '@ponchia/annotations@0.1.0-canary.1.e754177',
  'https://npm.pkg.github.com'
]) {
  assertIncludes(publishReport, term, 'docs/canary-publish-report.md');
}

for (const term of [
  'Canary / Private Registry',
  'GitHub Packages',
  'docs/canary-release.md',
  'docs/canary-publish-report.md'
]) {
  assertIncludes(releaseDocs, term, 'docs/release.md');
}

for (const term of [
  'https://npm.pkg.github.com',
  'CANARY_VERSION',
  '--check',
  'publishConfig'
]) {
  assertIncludes(prepareScript, term, 'scripts/prepare-github-canary.mjs');
}

for (const term of [
  '--version',
  '@ponchia/annotations@',
  '@ponchia/annotations/bronto.css',
  'prepareVegaScenegraphAnnotations',
  'prepareMermaidAnnotations',
  'prepareD2DiagramAnnotations',
  'prepareReactFlowAnnotations',
  'Registry consumer smoke verified'
]) {
  assertIncludes(smokeScript, term, 'scripts/smoke-registry-consumer.mjs');
}

const { stdout } = await exec(process.execPath, ['scripts/prepare-github-canary.mjs', '--check']);
assert.match(stdout.trim(), /^\d+\.\d+\.\d+-canary\.[0-9a-z-]+(\.[0-9a-z-]+)*$/, 'prepare-github-canary --check must print a valid canary version');

await exec(process.execPath, ['--check', 'scripts/prepare-github-canary.mjs']);
await exec(process.execPath, ['--check', 'scripts/smoke-registry-consumer.mjs']);

writeLine('Canary readiness verified: GitHub Packages workflow, version prep, registry smoke, and docs.');

async function read(path) {
  return readFile(pathUrl(path), 'utf8');
}

async function assertPath(path) {
  try {
    await access(pathUrl(path));
  } catch {
    throw new Error(`Expected canary readiness path to exist: ${path}`);
  }
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}

function pathUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}

function workflowJob(text, name) {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${name}:`);
  assert.ok(start >= 0, `Expected workflow job ${name}`);
  const remaining = lines.slice(start + 1);
  const end = remaining.findIndex((line) => /^  [\w-]+:$/.test(line));
  return [lines[start], ...(end < 0 ? remaining : remaining.slice(0, end))].join('\n');
}
