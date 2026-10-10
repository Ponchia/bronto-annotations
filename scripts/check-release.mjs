import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writeLine } from './log.mjs';
import { verifyPublishedRegistry } from './verify-published-registry.mjs';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = await read('CHANGELOG.md');
const release = await read('.github/workflows/release.yml');
const bugTemplate = await read('.github/ISSUE_TEMPLATE/bug_report.yml');
const { dateChangelogHeading } = await import(new URL('./release-prep.mjs', import.meta.url));

assert.equal(pkg.publishConfig?.access, 'public', 'publishConfig.access must stay public');
assert.equal(pkg.publishConfig?.provenance, true, 'publishConfig.provenance must stay enabled');
assert.equal(pkg.scripts?.['release:prep'], 'node scripts/release-prep.mjs');
assert.equal(pkg.scripts?.['test:release'], 'node scripts/check-release.mjs');
assert.ok(pkg.scripts?.check?.includes('npm run test:release'), 'npm run check must include test:release');

const version = pkg.version;
const baseVersion = version.split('-')[0];
const headings = [...changelog.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
const heading = headings.find((candidate) => candidate.includes(baseVersion));
assert.ok(heading, `CHANGELOG.md must include a section for ${baseVersion}`);

if (!version.includes('-')) {
  assert.ok(!/unreleased/i.test(heading), `package version ${version} must not map to an unreleased CHANGELOG heading`);
  assert.match(heading, /\d{4}-\d{2}-\d{2}/, `CHANGELOG heading for ${version} must include an ISO date`);
}

assertIncludes(bugTemplate, `placeholder: ${version}`, '.github/ISSUE_TEMPLATE/bug_report.yml');

for (const term of [
  'push:',
  "      - 'v*'",
  'release-publish',
  'Verify tag commit is on main',
  'git merge-base --is-ancestor',
  'Verify tag matches package.json version',
  'publish-preflight',
  'npm pack --dry-run --json --ignore-scripts',
  'environment: npm-publish',
  'id-token: write',
  'npm install -g npm@^11.5.1',
  'npm publish --ignore-scripts --provenance --access public --tag "$dist_tag"',
  'dist_tag=next',
  'dist_tag=latest',
  'node scripts/verify-published-registry.mjs',
  'Cache-Control: no-cache',
  'curl --fail --silent --show-error',
  'node scripts/changelog-section.mjs "$REF_NAME"',
  'softprops/action-gh-release'
]) {
  assertIncludes(release, term, '.github/workflows/release.yml');
}

assert.ok(!release.includes('workflow_dispatch:'), 'release workflow must not publish from manual dispatch');
assert.ok(!release.includes('NODE_AUTH_TOKEN'), 'release workflow should use trusted publishing, not a long-lived npm token');

assert.equal(
  dateChangelogHeading('## Unreleased\n\n### Changed\n\n- Release item\n', '0.1.1', '2026-06-19'),
  '## Unreleased\n\n## 0.1.1 - 2026-06-19\n\n### Changed\n\n- Release item\n',
  'release:prep must date the ordinary Unreleased changelog section'
);
assert.equal(
  dateChangelogHeading('## Unreleased\n\n## 0.1.1 - 2026-06-19\n\n### Changed\n\n- Release item\n', '0.1.1', '2026-06-19'),
  '## Unreleased\n\n## 0.1.1 - 2026-06-19\n\n### Changed\n\n- Release item\n',
  'release:prep must be idempotent for an already dated version'
);

const registryVersion = '0.4.1';
const samplePublished = {
  name: '@ponchia/annotations',
  'dist-tags': { latest: registryVersion, next: '0.5.0-rc.1' },
  versions: {
    [registryVersion]: {
      name: '@ponchia/annotations',
      version: registryVersion,
      dist: {
        integrity: 'sha512-dGVzdC1pbnRlZ3JpdHk=',
        tarball: 'https://registry.npmjs.org/@ponchia/annotations/-/annotations-0.4.1.tgz'
      }
    }
  }
};
assert.equal(verifyPublishedRegistry(samplePublished, registryVersion, 'latest').version, registryVersion);
assert.throws(() => verifyPublishedRegistry(samplePublished, '0.4.2', 'latest'), /propagated/);
assert.throws(() => verifyPublishedRegistry({ ...samplePublished, 'dist-tags': { latest: '0.4.0' } }, registryVersion, 'latest'), /propagated/);
assert.throws(() => verifyPublishedRegistry({ ...samplePublished, versions: {} }, registryVersion, 'latest'), /not yet visible/);
assert.throws(() => verifyPublishedRegistry({ ...samplePublished, name: 'different' }, registryVersion, 'latest'), /expected package/);
assert.throws(() => verifyPublishedRegistry(samplePublished, registryVersion, 'unexpected'), /Unexpected npm dist-tag/);

writeLine(`Release hygiene verified: v${version} tag publishing, protected npm environment, provenance, dist-tag routing, and CHANGELOG release notes.`);

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}
