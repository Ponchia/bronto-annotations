import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

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

console.log('Canary readiness verified: GitHub Packages workflow, version prep, registry smoke, and docs.');

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
