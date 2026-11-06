#!/usr/bin/env node
// Applies the Ponchia npm dist-tag policy after a verified release. It runs in
// the protected npm-publish job with the source-locked npm, which authenticates
// through npm OIDC trusted publishing ("Allow npm dist-tag"); no token exists.
// Every Ponchia package repository carries this script with the same policy.
//
// Policy (maintainer decision, 6 November 2026):
// - While a package has no stable version, `latest` follows the newest
//   prerelease, so a plain install gets the current beta.
// - `latest` never moves backwards and never moves to a prerelease once a
//   stable version exists. A stable publish sets `latest` itself.
// - A prerelease channel tag (next, beta, rc, alpha, canary) that points below
//   `latest` is removed. No other tag is touched.
//
// Usage:
//   node scripts/sync-dist-tags.mjs --package @ponchia/<name> --version <released>
//     --npm-cli <path/to/npm-cli.js> [--dry-run]
// Rerunning is safe: an already applied policy plans no change.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CHANNEL_TAGS = Object.freeze(['next', 'beta', 'rc', 'alpha', 'canary']);
const REGISTRY = 'https://registry.npmjs.org';
// Registry reads can lag writes by minutes: 12 reads, 15 seconds apart.
const ATTEMPTS = 12;
const pause = () => new Promise((resolve) => setTimeout(resolve, 15_000));
const IDENTIFIER = '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)';
const SEMVER = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?$`,
);

export function parseVersion(version) {
  const match = typeof version === 'string' ? SEMVER.exec(version) : null;
  if (!match) return null;
  return { core: match.slice(1, 4).map(Number), pre: match[4] ? match[4].split('.') : [] };
}

export const isPrerelease = (version) => (parseVersion(version)?.pre.length ?? 0) > 0;

// Semantic Versioning 2.0.0 precedence; build metadata is ignored.
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw Error(`Not a semantic version: ${x ? b : a}`);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1;
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1;
  if (!y.pre.length) return -1;
  for (let i = 0; ; i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined || q === undefined) return p === q ? 0 : p === undefined ? -1 : 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) {
      if (Number(p) !== Number(q)) return Number(p) < Number(q) ? -1 : 1;
    } else if (pn !== qn) {
      return pn ? -1 : 1;
    } else if (p !== q) {
      return p < q ? -1 : 1;
    }
  }
}

/**
 * Returns the dist-tag changes the policy requires, in order. The state must
 * already include the released version: versions and dist-tags come from one
 * registry document, so an older read could remove a tag the publish just moved.
 */
export function planDistTags({ tags, versions, released }) {
  if (!parseVersion(released)) throw Error(`Not a semantic version: ${released}`);
  if (!versions.includes(released)) throw Error(`Registry state predates ${released}; read it again`);
  const hasStable = versions.some((version) => parseVersion(version) && !isPrerelease(version));
  const changes = [];
  let latest = parseVersion(tags.latest) ? tags.latest : undefined;
  if (!hasStable && (!latest || compareVersions(released, latest) > 0)) {
    changes.push({ action: 'add', tag: 'latest', version: released });
    latest = released;
  }
  for (const tag of CHANNEL_TAGS) {
    const version = tags[tag];
    if (latest && parseVersion(version) && compareVersions(version, latest) < 0)
      changes.push({ action: 'rm', tag, version });
  }
  return changes;
}

function parseArgs(argv) {
  const options = { dryRun: false };
  const names = new Map([
    ['--package', 'packageName'],
    ['--version', 'version'],
    ['--npm-cli', 'npmCli'],
  ]);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    const key = names.get(argv[i]);
    const value = argv[i + 1];
    if (!key || value === undefined || value.startsWith('--') || options[key] !== undefined)
      throw Error(`Usage: sync-dist-tags.mjs --package @ponchia/<name> --version <released> --npm-cli <npm-cli.js> [--dry-run]`);
    options[key] = value;
    i++;
  }
  if (!/^@ponchia\/[a-z0-9][a-z0-9._-]*$/.test(options.packageName ?? '')) throw Error('Only @ponchia packages are managed');
  if (!parseVersion(options.version)) throw Error(`Not a semantic version: ${options.version}`);
  if (!options.npmCli) throw Error('--npm-cli is required: the source-locked publisher, never the runner npm');
  return options;
}

function npm(npmCli, args) {
  return execFileSync(process.execPath, [npmCli, ...args, '--registry', REGISTRY], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function readState(npmCli, packageName) {
  const view = JSON.parse(npm(npmCli, ['view', packageName, 'dist-tags', 'versions', '--json', '--prefer-online']));
  return { tags: view['dist-tags'] ?? {}, versions: view.versions ?? [] };
}

async function main() {
  const { packageName, version, npmCli, dryRun } = parseArgs(process.argv.slice(2));
  let before;
  for (let attempt = 1; ; attempt++) {
    before = readState(npmCli, packageName);
    if (before.versions.includes(version)) break;
    if (attempt === ATTEMPTS) throw Error(`${packageName}@${version} is not visible in the registry yet; rerun this job`);
    await pause();
  }
  const changes = planDistTags({ ...before, released: version });
  const lines = [`dist-tags before: ${JSON.stringify(before.tags)}`];
  if (!changes.length) lines.push('Policy already satisfied; no dist-tag change.');
  for (const change of changes) {
    lines.push(change.action === 'add' ? `+${change.tag}: ${change.version}` : `-${change.tag} (was ${change.version})`);
    if (dryRun) continue;
    if (change.action === 'add') npm(npmCli, ['dist-tag', 'add', `${packageName}@${change.version}`, change.tag]);
    else npm(npmCli, ['dist-tag', 'rm', packageName, change.tag]);
  }
  if (!dryRun && changes.length) {
    const expected = { ...before.tags };
    for (const change of changes) {
      if (change.action === 'add') expected[change.tag] = change.version;
      else delete expected[change.tag];
    }
    for (let attempt = 1; ; attempt++) {
      const { tags } = readState(npmCli, packageName);
      const settled = Object.keys({ ...expected, ...tags }).every((tag) => tags[tag] === expected[tag]);
      if (settled) {
        lines.push(`dist-tags after: ${JSON.stringify(tags)}`);
        break;
      }
      if (attempt === ATTEMPTS) throw Error(`Registry still reports ${JSON.stringify(tags)}; expected ${JSON.stringify(expected)}`);
      await pause();
    }
  }
  if (dryRun) lines.push('Dry run: nothing changed.');
  console.log(lines.join('\n'));
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
