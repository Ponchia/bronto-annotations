import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

it('passes the unchanged published Bronto UI v0.16.3 geometry contract', () => {
  const fixture = resolve('test/fixtures/legacy-ui-geometry');
  const source = readFileSync(join(fixture, 'annotations.test.mjs.txt'), 'utf8');
  const provenance = JSON.parse(readFileSync(join(fixture, 'provenance.json'), 'utf8'));
  expect(createHash('sha256').update(source).digest('hex')).toBe(provenance.sha256);
  expect(provenance.revision).toMatch(/^[a-f0-9]{40}$/);
  expect(readFileSync(join(fixture, 'LICENSE'), 'utf8')).toContain('MIT');
  const before = "'../annotations/index.js'";
  expect(source.split(before)).toHaveLength(2);
  const temp = mkdtempSync(join(tmpdir(), 'legacy-ui-geometry-'));
  try {
    const target = join(temp, 'contract.test.mjs');
    const moduleUrl = pathToFileURL(resolve('dist/index.js')).href;
    writeFileSync(target, source.replace(before, JSON.stringify(moduleUrl)));
    const result = spawnSync(process.execPath, ['--test', target], { encoding: 'utf8', timeout: 10_000 });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/pass 20\b/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
