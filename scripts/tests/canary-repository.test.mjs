import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const canonical = 'git+https://github.com/Ponchia/bronto-annotations.git';

async function fixture(repositoryUrl) {
  const directory = await mkdtemp(join(tmpdir(), 'annotations-canary-'));
  await mkdir(join(directory, 'scripts'));
  for (const name of ['prepare-github-canary.mjs', 'log.mjs']) {
    await copyFile(new URL(`../${name}`, import.meta.url), join(directory, 'scripts', name));
  }
  const pkg = { name: '@ponchia/annotations', version: '0.7.0-rc.3', private: false, repository: { url: repositoryUrl } };
  await writeFile(join(directory, 'package.json'), JSON.stringify(pkg));
  return { directory, pkg };
}

test('canonical linkage prepares a canary and check mode leaves metadata unchanged', async () => {
  const { directory, pkg } = await fixture(canonical);
  try {
    const env = { ...process.env, CANARY_VERSION: '0.7.0-canary.1.abcdef0' };
    const result = execFileSync(process.execPath, ['scripts/prepare-github-canary.mjs', '--check'], { cwd: directory, env, encoding: 'utf8' });
    assert.equal(result.trim(), env.CANARY_VERSION);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')), pkg);
    execFileSync(process.execPath, ['scripts/prepare-github-canary.mjs'], { cwd: directory, env });
    const prepared = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    assert.equal(prepared.version, env.CANARY_VERSION);
    assert.equal(prepared.repository.url, canonical);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const url of [
  'https://attacker.example/github.com/Ponchia/bronto-annotations',
  'https://github.com/Ponchia/bronto-annotations-suffix',
  'https://github.com/Ponchia/bronto-annotations@attacker.example',
  `${canonical}?redirect=other`, `${canonical}#other`, `${canonical}\n`, '', null
]) {
  test(`rejects noncanonical repository metadata ${JSON.stringify(url)}`, async () => {
    const { directory, pkg } = await fixture(url);
    try {
      assert.throws(() => execFileSync(process.execPath, ['scripts/prepare-github-canary.mjs'], {
        cwd: directory, stdio: 'pipe', env: { ...process.env, CANARY_VERSION: '0.7.0-canary.1.abcdef0' }
      }), (error) => {
        assert.equal(error.status, 1);
        assert.match(String(error.stderr), /exact canonical repository linkage/);
        return true;
      });
      assert.deepEqual(JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')), pkg);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
}
