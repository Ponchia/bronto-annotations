/**
 * Build once per verification pipeline, while keeping `npm run build` a fresh
 * standalone build. Reuse is opt-in and only accepted for byte-identical
 * source inputs AND compiled outputs recorded by a successful build.
 *
 * State lives in .tmp, outside the published package. No dependency on git,
 * mtime granularity, or the calling shell's execution directory.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLine } from './log.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stampFile = join(root, '.tmp/verified-build.json');
const reuse = process.env.PONCHIA_ANNOTATIONS_REUSE_BUILD === '1';

async function filesUnder(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) {
      result.push(...await filesUnder(file));
    } else if (item.isFile()) {
      result.push(file);
    }
  }
  return result;
}

async function digest(paths) {
  const hash = createHash('sha256');
  for (const file of paths.sort()) {
    hash.update(relative(root, file));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

async function fingerprint() {
  const inputs = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'scripts/build-package.mjs'
  ].map((name) => join(root, name));
  inputs.push(...await filesUnder(join(root, 'src')));
  const outputs = await filesUnder(join(root, 'dist'));
  assert.ok(outputs.some((path) => path === join(root, 'dist/index.js')),
    'Compiled dist/index.js is missing');
  assert.ok(outputs.some((path) => path === join(root, 'dist/index.d.ts')),
    'Compiled dist/index.d.ts is missing');
  assert.ok(outputs.some((path) => path === join(root, 'dist/bronto.css')),
    'Compiled dist/bronto.css is missing');
  return { inputs: await digest(inputs), outputs: await digest(outputs) };
}

async function verify() {
  let previous;
  try {
    previous = JSON.parse(await readFile(stampFile, 'utf8'));
  } catch {
    throw new Error('No verified build found. Run `npm run build` without PONCHIA_ANNOTATIONS_REUSE_BUILD first.');
  }
  let actual;
  try {
    actual = await fingerprint();
  } catch (error) {
    throw new Error(`Compiled package is incomplete: ${error.message}`, { cause: error });
  }
  assert.equal(actual.inputs, previous.inputs,
    'Build inputs changed since the verified build; run `npm run build` again.');
  assert.equal(actual.outputs, previous.outputs,
    'Compiled package changed since the verified build; run `npm run build` again.');
  writeLine('Reusing byte-verified compiled package (no redundant TypeScript build).');
}

if (reuse || process.argv.includes('--verify')) {
  await verify();
} else {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const run = spawnSync(npm, ['run', 'build:compile'], { cwd: root, stdio: 'inherit' });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
  const current = await fingerprint();
  await mkdir(dirname(stampFile), { recursive: true });
  await writeFile(stampFile, JSON.stringify(current) + '\n');
}
