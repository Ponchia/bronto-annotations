import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots: string[] = [];
const script = resolve('scripts/check-bronto-upstream-parity.mjs');
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'annotation-parity-'));
  roots.push(root);
  return root;
}
function run(root: string, strict = false) {
  const env = { ...process.env };
  delete env.PONCHIA_REQUIRE_UPSTREAM_UI;
  return spawnSync(process.execPath, [script, '--ui-root', root, ...(strict ? ['--require'] : [])], {
    encoding: 'utf8', env, timeout: 10_000
  });
}
function legacy(root: string, css = '.ui-annotation { --annotation-color: black; }') {
  mkdirSync(join(root, 'css'));
  mkdirSync(join(root, 'annotations'));
  writeFileSync(join(root, 'css/annotations.css'), css);
  // This is only an inspection input: the checker must never execute it.
  writeFileSync(join(root, 'annotations/index.js'), 'throw new Error("do not execute local UI");\nexport function annotationParts() {}\n');
}

describe('historical Bronto UI annotation contract', () => {
  it('verifies the frozen contract when no sibling UI checkout exists', () => {
    const result = run(join(fixture(), 'absent'));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('not skipping verification');
    expect(result.stdout).toContain('35 selectors, 154 CSS declarations, 22 helpers, 4 keyframes');
  });
  it('still refuses missing legacy files when explicitly required', () => {
    const result = run(join(fixture(), 'absent'), true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--require demands a local UI checkout');
  });
  it('rejects a partial removal instead of silently ignoring it', () => {
    const root = fixture();
    mkdirSync(join(root, 'css'));
    writeFileSync(join(root, 'css/annotations.css'), '.ui-annotation {}');
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('only one of the two legacy files');
  });
  it('inspects legacy source without executing its JavaScript', () => {
    const root = fixture(); legacy(root);
    const result = run(root, true);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('verified against local checkout');
  });
  it('rejects undocumented additions to the deprecated UI CSS contract', () => {
    const root = fixture(); legacy(root, '.ui-annotation { --annotation-new-contract: black; }');
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('local UI added undocumented legacy variables');
  });
});
