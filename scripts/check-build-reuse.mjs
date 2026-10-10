/**
 * Guard against reusing stale/missing compiled artifacts inside npm run check.
 * Only temporary probe files are created, and both are removed in finally.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLine } from './log.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const helper = join(root, 'scripts/build-package.mjs');
const original = join(root, 'dist/index.js');
const sourceProbe = join(root, 'src/.verified-build-probe');
const outputProbe = join(root, 'dist/.verified-build-probe');

function verify(shouldPass, reason) {
  const result = spawnSync(process.execPath, [helper, '--verify'], {
    cwd: root,
    encoding: 'utf8'
  });
  assert.equal(result.status === 0, shouldPass,
    `Build verification did not ${shouldPass ? 'pass' : 'reject'} ${reason}: ${result.stderr}`);
  return result;
}

verify(true, 'fresh build');
const before = await stat(original);
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, PONCHIA_ANNOTATIONS_REUSE_BUILD: '1' }
});
assert.equal(build.status, 0, `Expected a verified no-op build: ${build.stderr}`);
assert.match(build.stdout, /Reusing byte-verified compiled package/);
assert.equal((await stat(original)).mtimeMs, before.mtimeMs,
  'Verified reuse must not overwrite the compiled JavaScript');

try {
  await writeFile(sourceProbe, 'modified source input');
  assert.match(verify(false, 'modified inputs').stderr, /Build inputs changed/);
} finally {
  await unlink(sourceProbe);
}
verify(true, 'restored source');

try {
  await writeFile(outputProbe, 'modified output file');
  assert.match(verify(false, 'modified outputs').stderr, /Compiled package changed/);
} finally {
  await unlink(outputProbe);
}
verify(true, 'restored output');
writeLine('Verified build reuse: fresh artifacts reused without compilation; changed input/output rejected.');
