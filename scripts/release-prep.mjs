import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLine } from './log.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function dateChangelogHeading(text, version, isoDate) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const releasedHeadingPattern = new RegExp(`^##\\s+${escapedVersion}\\s+[-—]\\s+\\d{4}-\\d{2}-\\d{2}$`, 'm');
  if (releasedHeadingPattern.test(text)) {
    return text;
  }

  const targets = [`## Unreleased - ${version}`, `## Unreleased — ${version}`];
  return text
    .split('\n')
    .flatMap((line) => {
      const trimmed = line.trimEnd();
      if (targets.includes(trimmed)) {
        return [`## ${version} - ${isoDate}`];
      }
      if (trimmed === '## Unreleased') {
        return ['## Unreleased', '', `## ${version} - ${isoDate}`];
      }
      return [line];
    })
    .join('\n');
}

function updatePackageVersionEvidence(filePath, version) {
  const document = JSON.parse(readFileSync(filePath, 'utf8'));
  const versionTermPattern = /^"version": "\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?"$/;
  const nextVersionTerm = `"version": "${version}"`;
  let changed = false;

  function visit(value) {
    if (typeof value === 'string') {
      if (versionTermPattern.test(value) && value !== nextVersionTerm) {
        changed = true;
        return nextVersionTerm;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => visit(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
    }

    return value;
  }

  const updated = visit(document);
  if (changed) {
    writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`);
  }
  return changed;
}

function main(argv) {
  const version = argv[0];
  if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    console.error('usage: node scripts/release-prep.mjs <new-version>   (e.g. 0.1.1)');
    process.exit(1);
  }

  const pkgPath = resolve(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const from = pkg.version;
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
    cwd: root,
    stdio: 'inherit',
  });
  writeLine(`package.json + lock: ${from} -> ${version}`);

  const isPrerelease = version.includes('-');
  const changelogPath = resolve(root, 'CHANGELOG.md');
  const changelog = readFileSync(changelogPath, 'utf8');
  const dated = isPrerelease ? changelog : dateChangelogHeading(changelog, version, new Date().toISOString().slice(0, 10));
  if (dated !== changelog) {
    writeFileSync(changelogPath, dated);
    writeLine(`CHANGELOG.md: dated ${version}`);
  } else if (isPrerelease) {
    writeLine('CHANGELOG.md: prerelease, base heading left unchanged');
  } else {
    writeLine(`CHANGELOG.md: no "Unreleased - ${version}" heading found; verify it is already dated`);
  }

  const bugPath = resolve(root, '.github/ISSUE_TEMPLATE/bug_report.yml');
  const bug = readFileSync(bugPath, 'utf8');
  const bumped = bug.replace(/placeholder: \d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/, `placeholder: ${version}`);
  if (bumped !== bug) {
    writeFileSync(bugPath, bumped);
    writeLine('bug report template: bumped version placeholder');
  }

  for (const evidencePath of ['docs/readiness-matrix.json', 'docs/completion-audit.json']) {
    const changed = updatePackageVersionEvidence(resolve(root, evidencePath), version);
    if (changed) {
      writeLine(`${evidencePath}: bumped package version evidence`);
    }
  }

  writeLine('\nNext: review the diff, run `npm run check`, merge to main, then tag from main.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
