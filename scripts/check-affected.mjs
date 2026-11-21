import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLine } from './log.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Include both sides of renames, plus each staged, unstaged and untracked path. */
export function readChanges(cwd, base = 'origin/main') {
  if (!base || base.startsWith('-')) throw new Error('Expected a Git base revision after --base.');
  const revision = git(cwd, ['rev-parse', '--verify', '--end-of-options', base + '^{commit}']).trim();
  const mergeBase = git(cwd, ['merge-base', revision, 'HEAD']).trim();
  const paths = new Map();
  for (const args of [
    ['diff', '--name-status', '-z', '--no-renames', mergeBase, 'HEAD', '--'],
    ['diff', '--name-status', '-z', '--no-renames', '--cached', 'HEAD', '--'],
    ['diff', '--name-status', '-z', '--no-renames', '--']
  ]) {
    const fields = git(cwd, args).split('\0').filter(Boolean);
    for (let i = 0; i < fields.length; i += 2) {
      const status = fields[i];
      const path = fields[i + 1];
      if (!path || !/^[AMDTUXB]$/.test(status)) throw new Error('Unrecognized Git change record.');
      const previous = paths.get(path);
      paths.set(path, { path, status: previous && !['A', 'M', '?'].includes(previous.status) ? previous.status : status });
    }
  }
  for (const path of git(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
    if (!paths.has(path)) paths.set(path, { path, status: '?' });
  }
  return {
    base,
    mergeBase,
    head: git(cwd, ['rev-parse', 'HEAD']).trim(),
    changes: [...paths.values()].sort((a, b) => a.path.localeCompare(b.path))
  };
}

/** A small iteration aid, never a replacement for complete CI qualification. */
export function planChecks(changes) {
  const categories = new Set();
  const fallback = [];
  for (const { path, status } of changes) {
    if (!['A', 'M', '?'].includes(status)) {
      fallback.push(path + ': removal or non-ordinary change');
    } else if (/^(?:[^/]+\.md|docs\/.+\.md|examples\/.+\.md)$/.test(path)) {
      categories.add('documentation');
    } else if (/^(?:site|examples)\//.test(path)) {
      categories.add('site');
    } else if (/^(?:src|test)\/.+\.(?:ts|tsx|css|html|json)$/.test(path)) {
      categories.add('source');
    } else {
      fallback.push(path + ': no narrow check owner');
    }
  }
  let commands = [];
  if (fallback.length) {
    commands = ['check'];
  } else if (categories.size) {
    commands.push('build');
    if (categories.has('source') || categories.has('site')) commands.push('check:fast');
    else commands.push('test:docs-snippets');
    if (categories.has('source')) commands.push('test:quality', 'test:browser');
    if (categories.has('documentation') || categories.has('site')) commands.push('test:site');
    commands.push('test:hygiene');
  }
  return {
    mode: fallback.length ? 'full' : commands.length ? 'iteration' : 'no-changes',
    categories: [...categories].sort(),
    changes,
    commands,
    fallback,
    qualification: 'Full CI at the exact proposed revision remains required. This plan is not merge or release approval.',
    deferred: fallback.length
      ? ['Additional CI compatibility and device lanes; physical-device and human acceptance.']
      : ['Other full-check stages, additional CI compatibility and device lanes; physical-device and human acceptance.']
  };
}

function parseArgs(args) {
  let base = 'origin/main';
  let run = false;
  let selectedMode;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') {
      base = args[++i];
      if (!base || base.startsWith('-')) throw new Error('Expected a Git base revision after --base.');
    } else if (args[i] === '--run' || args[i] === '--plan') {
      if (selectedMode && selectedMode !== args[i]) throw new Error('Choose --plan or --run, not both.');
      selectedMode = args[i];
      run = args[i] === '--run';
    } else {
      throw new Error('Unknown argument: ' + args[i]);
    }
  }
  return { base, run };
}

function runChecks(plan) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = { ...process.env };
  delete env.PONCHIA_ANNOTATIONS_REUSE_BUILD;
  for (const command of plan.commands) {
    const started = performance.now();
    const result = spawnSync(npm, ['run', command], { cwd: root, env, stdio: 'inherit' });
    writeLine(command + ': ' + ((performance.now() - started) / 1000).toFixed(2) + 's');
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    // Delegate all reuse validation to the existing package builder.
    if (command === 'build') env.PONCHIA_ANNOTATIONS_REUSE_BUILD = '1';
  }
  writeLine(plan.commands.length
    ? 'Selected checks passed. Full CI qualification and human acceptance remain separate.'
    : 'No changes found against the selected base. No checks ran.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--help')) {
      writeLine('Usage: npm run check:affected -- [--base <revision>] [--plan | --run]');
      writeLine('Default: plan only, against origin/main. --run explicitly executes the listed checks.');
    } else {
      const options = parseArgs(process.argv.slice(2));
      const snapshot = readChanges(root, options.base);
      const plan = { ...snapshot, ...planChecks(snapshot.changes) };
      writeLine(JSON.stringify(plan, null, 2));
      if (options.run) process.exitCode = runChecks(plan);
      else writeLine('Plan only; no build or tests ran. Use --run after reviewing its scope and cost.');
    }
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}
