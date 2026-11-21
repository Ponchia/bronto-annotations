import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planChecks, readChanges } from '../../scripts/check-affected.mjs';

const repos: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'annotations-affected-'));
  repos.push(root);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: 'pipe' }).trim();
  const write = (path: string, text = 'initial\n') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  git('init', '-q');
  git('config', 'user.email', 'fixture@example.test');
  git('config', 'user.name', 'Fixture');
  for (const path of ['README.md', 'docs/guide.md', 'src/core/model.ts', 'site/index.html']) write(path);
  git('add', '.');
  git('commit', '-qm', 'fixture');
  git('branch', 'base');
  return { root, git, write };
}
afterEach(() => {
  for (const root of repos.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('affected verification planning', () => {
  it('collects committed, staged, unstaged and untracked changes in ordinal path order', () => {
    const { root, git, write } = fixture();
    write('README.md', 'committed\n');
    git('add', 'README.md');
    git('commit', '-qm', 'docs');
    write('src/core/model.ts', 'staged\n');
    git('add', 'src/core/model.ts');
    write('site/index.html', 'unstaged\n');
    write('docs/a space\nand newline.md', 'new\n');
    write('docs/Z-uppercase.md', 'new\n');
    const result = readChanges(root, 'base');
    expect(result.changes).toEqual([
      { path: 'README.md', status: 'M' },
      { path: 'docs/Z-uppercase.md', status: '?' },
      { path: 'docs/a space\nand newline.md', status: '?' },
      { path: 'site/index.html', status: 'M' },
      { path: 'src/core/model.ts', status: 'M' }
    ]);
    expect(result.mergeBase).toBe(git('rev-parse', 'base'));
    expect(result.head).toBe(git('rev-parse', 'HEAD'));
  });

  it('uses the common ancestor when the comparison branch advanced', () => {
    const { root, git, write } = fixture();
    git('checkout', '-qb', 'topic');
    write('README.md', 'topic\n');
    git('add', 'README.md');
    git('commit', '-qm', 'topic');
    git('checkout', 'base');
    write('site/index.html', 'upstream\n');
    git('add', 'site/index.html');
    git('commit', '-qm', 'upstream');
    git('checkout', 'topic');
    expect(readChanges(root, 'base').changes).toEqual([{ path: 'README.md', status: 'M' }]);
  });

  it('falls back to the complete check for a rename or deletion', () => {
    const { root, git } = fixture();
    git('mv', 'src/core/model.ts', 'docs/moved.md');
    git('rm', 'docs/guide.md');
    const changes = readChanges(root, 'base').changes;
    expect(changes).toContainEqual({ path: 'src/core/model.ts', status: 'D' });
    expect(changes).toContainEqual({ path: 'docs/moved.md', status: 'A' });
    expect(planChecks(changes).commands).toEqual(['check']);
  });

  it('fails closed when the base is missing or option-shaped', () => {
    const { root } = fixture();
    expect(() => readChanges(root, 'no-such-base')).toThrow();
    expect(() => readChanges(root, '--all')).toThrow('base revision');
  });

  it('keeps docs, rendered site and source checks distinct while combining scopes', () => {
    const doc = planChecks([{ path: 'docs/getting-started.md', status: 'M' }]);
    expect(doc.commands).toEqual(['build', 'test:docs-snippets', 'test:site', 'test:hygiene']);
    const combined = planChecks([
      { path: 'site/main.ts', status: 'M' },
      { path: 'src/core/placement.ts', status: 'M' },
      { path: 'README.md', status: 'M' },
      { path: 'test/scripts/check-affected.test.ts', status: 'M' }
    ]);
    expect(combined.commands).toEqual(['build', 'check:fast', 'test:quality', 'test:browser', 'test:site', 'test:hygiene']);
    expect(combined.qualification).toContain('exact proposed revision');
    expect(combined.deferred.join(' ')).toContain('Other full-check stages');
  });

  it('uses fast checks for exact Vitest test files and retains source checks when combined', () => {
    for (const change of [
      { path: 'test/model.test.ts', status: 'A' },
      { path: 'test/scripts/check-affected.test.ts', status: 'M' },
      { path: 'test/react/note.test.tsx', status: '?' }
    ]) {
      expect(planChecks([change]).commands).toEqual(['build', 'check:fast', 'test:hygiene']);
      expect(planChecks([change, { path: 'src/core/placement.ts', status: 'M' }]).commands)
        .toEqual(['build', 'check:fast', 'test:quality', 'test:browser', 'test:hygiene']);
    }
  });

  it('keeps fixtures, shared helpers and non-ordinary test changes conservative', () => {
    for (const path of ['test/fixtures/component.test.ts', 'test/fixtures/placement-quality/corpus.json',
      'test/setup.ts', 'src/core/model.test.ts']) {
      expect(planChecks([{ path, status: 'M' }]).commands)
        .toEqual(['build', 'check:fast', 'test:quality', 'test:browser', 'test:hygiene']);
    }
    for (const status of ['D', 'T']) {
      expect(planChecks([{ path: 'test/model.test.ts', status }]).commands).toEqual(['check']);
    }
  });

  it.each(['package.json', 'package-lock.json', 'tsconfig.json', '.github/workflows/ci.yml',
    'scripts/check-affected.mjs', 'new-area/config.toml', 'test/model.test.mts', 'test/model.test.ts.snap'])('does not guess narrow ownership for %s', (path) => {
    const plan = planChecks([{ path, status: 'M' }]);
    expect(plan.commands).toEqual(['check']);
    expect(plan.mode).toBe('full');
    expect(plan.fallback).toHaveLength(1);
  });

  it('does not claim verification when no files changed', () => {
    const { root } = fixture();
    const plan = planChecks(readChanges(root, 'HEAD').changes);
    expect(plan.mode).toBe('no-changes');
    expect(plan.commands).toEqual([]);
  });

  it('plans without running commands and rejects ambiguous execution options', () => {
    // Compatibility lanes copy source without .git; the CLI owns a Git fixture too.
    const { root } = fixture();
    mkdirSync(join(root, 'scripts'));
    for (const name of ['check-affected.mjs', 'log.mjs'])
      copyFileSync(resolve('scripts', name), join(root, 'scripts', name));
    const cli = join(root, 'scripts/check-affected.mjs');
    const plan = spawnSync(process.execPath, [cli, '--base', 'HEAD'], { encoding: 'utf8' });
    expect(plan.status, plan.stderr).toBe(0);
    expect(plan.stdout).toContain('Plan only; no build or tests ran.');
    expect(plan.stdout).not.toContain('Selected checks passed.');
    const invalid = spawnSync(process.execPath, [cli, '--plan', '--run'], { encoding: 'utf8' });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('Choose --plan or --run');
  });
});
