import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { writeLine } from './log.mjs';

const checkOnly = process.argv.includes('--check');
const pkgUrl = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(await readFile(pkgUrl, 'utf8'));
const baseVersion = pkg.version.split('-')[0];
const runNumber = process.env.GITHUB_RUN_NUMBER ?? 'local';
const sha = (process.env.GITHUB_SHA ?? 'dev').slice(0, 7).toLowerCase();
const version = process.env.CANARY_VERSION ?? `${baseVersion}-canary.${runNumber}.${sha}`;

assert.equal(pkg.name, '@ponchia/annotations', 'GitHub Packages canary expects the @ponchia/annotations scoped package name.');
assert.equal(pkg.private, false, 'GitHub Packages canary package must remain publishable.');
assert.match(pkg.repository?.url ?? '', /github\.com\/Ponchia\/bronto-annotations/, 'GitHub Packages canary must keep repository linkage.');
assert.match(version, /^\d+\.\d+\.\d+-canary\.[0-9a-z-]+(\.[0-9a-z-]+)*$/, `Invalid canary version: ${version}`);

if (!checkOnly) {
  pkg.version = version;
  pkg.publishConfig = {
    registry: 'https://npm.pkg.github.com'
  };

  await writeFile(pkgUrl, `${JSON.stringify(pkg, null, 2)}\n`);
}

writeLine(version);
