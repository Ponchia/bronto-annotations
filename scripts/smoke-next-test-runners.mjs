/**
 * Isolated Vitest 5 / jsdom 30 regression lane on a recent Node runtime.
 *
 * The package still supports Node 20, so the regular Vitest 4 / jsdom 29
 * unit suite must remain intact on the Node 20 and Node 22 CI matrices.
 * Newer tooling requires Node >=22.22.2 and is installed only in a throwaway
 * copy of tracked source, with no rewrite of this repository's package lock.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vitestVersion = '5.0.3';
const jsdomVersion = '30.1.2';
// npm 10 can crash in Arborist peer-set resolution with newer Vitest optional
// peers (npm/cli#9787). Use a pinned newer npm only for this disposable
// experiment; the normal Node 20/22 project install remains unchanged.
const installNpmVersion = '11.19.1';

const nodeParts = process.versions.node.split('.').map(Number);
const supported = (nodeParts[0] === 22 && (nodeParts[1] > 22 || nodeParts[1] === 22 && nodeParts[2] >= 2))
  || (nodeParts[0] === 24 && (nodeParts[1] > 15 || nodeParts[1] === 15 && nodeParts[2] >= 0))
  || nodeParts[0] >= 26;
assert.ok(supported,
  `Vitest 5 / jsdom 30 isolated lane requires Node >=22.22.2, >=24.15, or >=26; got ${process.version}. Keep the main Node 20 runner on Vitest 4/jsdom 29.`);

const workdir = await mkdtemp(join(tmpdir(), 'annotations-next-test-runners-'));
const maxBuffer = 8 * 1024 * 1024;
try {
  // Copy the *tracked* real unit suites and source/config to a new checkout.
  // This keeps the original Node 20-compatible package.json and lockfile
  // immutable, and prevents the new runner from borrowing old node_modules.
  const { stdout: tracked } = await exec('git', ['ls-files', '-z'], { cwd: root, maxBuffer });
  const files = tracked.split('\0').filter(Boolean);
  assert.ok(files.length >= 120, 'Expected the complete annotations repository, not a minimal fixture');
  for (const file of files) {
    assert.ok(!file.startsWith('/') && !file.split('/').includes('..'), 'Tracked path escapes the source root');
    const dest = join(workdir, file);
    await mkdir(dirname(dest), { recursive: true });
    await cp(join(root, file), dest, { recursive: false });
  }

  // Rewrite the manifest only inside the disposable checkout. Its existing
  // lockfile remains a starting point for npm reification of these two majors.
  const packageFile = join(workdir, 'package.json');
  const pkg = JSON.parse(await readFile(packageFile, 'utf8'));
  pkg.devDependencies.vitest = vitestVersion;
  pkg.devDependencies.jsdom = jsdomVersion;
  await writeFile(packageFile, JSON.stringify(pkg, null, 2) + '\n');

  const env = { ...process.env, npm_config_engine_strict: 'true' };
  // Keep normal npm peer checks; --legacy-peer-deps would hide the very
  // compatibility conflicts this lane is meant to detect. npx downloads the
  // exact npm CLI into its isolated cache without changing the runner's npm.
  const installer = ['--yes', `npm@${installNpmVersion}`];
  const { stdout: observedInstaller } = await exec('npx', [...installer, '--version'], {
    cwd: workdir, env, maxBuffer
  });
  assert.equal(observedInstaller.trim(), installNpmVersion,
    'The isolated test-runner installer must use the pinned npm version');
  await exec('npx', [...installer, 'install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: workdir, env, maxBuffer
  });

  const installed = async (name) => JSON.parse(await readFile(join(workdir, `node_modules/${name}/package.json`), 'utf8'));
  assert.equal((await installed('vitest')).version, vitestVersion);
  assert.equal((await installed('jsdom')).version, jsdomVersion);

  // Both the compiled package surface and *all* existing real Vitest suites
  // run against the new runner. This is not a synthetic smoke-only success.
  await exec('npm', ['run', 'typecheck'], { cwd: workdir, env, maxBuffer });
  const { stdout: vitestOutput, stderr: vitestErrors } = await exec('npm', ['test'], {
    cwd: workdir, env, maxBuffer
  });
  const combinedOutput = vitestOutput + '\n' + vitestErrors;
  const summaryLines = combinedOutput.split('\n').filter((line) =>
    /Test Files|Tests\s|Duration|Isolate|worker|failed/i.test(line));
  assert.ok(/Tests\s+.*passed/.test(combinedOutput), 'Vitest summary did not confirm passed tests');

  writeLine(JSON.stringify({
    lane: 'vitest5-jsdom30-isolated-full-unit-suite',
    node: process.version,
    vitest: vitestVersion,
    jsdom: jsdomVersion,
    installerNpm: installNpmVersion,
    typecheck: 'passed',
    unitTests: 'passed',
    sourceFiles: files.length,
    primaryNode20Runner: 'unchanged',
    summary: summaryLines.slice(-10).map((line) => line.replace(/\u001b\[[0-9;]*m/g, '').trim())
  }, null, 2));
} finally {
  await rm(workdir, { recursive: true, force: true });
}
