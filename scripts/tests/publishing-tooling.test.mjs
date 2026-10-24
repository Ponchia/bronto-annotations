import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { auditPublishingTooling, candidate, verifyAudit, verifyBundle } from '../audit-publishing-tooling.mjs';

const dependencyPath = 'node_modules/npm/node_modules/example-dependency';
const inventory = new Map([[dependencyPath, { name: 'example-dependency', version: '1.0.0' }]]);
function report(severity) {
  const vulnerabilities = severity ? { 'example-dependency': { name: 'example-dependency', severity, nodes: [dependencyPath] } } : {};
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: severity ? 1 : 0 };
  if (severity) counts[severity] = 1;
  return { auditReportVersion: 2, vulnerabilities, metadata: { vulnerabilities: counts } };
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'publisher-audit-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packages = {
    '': { name: 'publisher-audit', dependencies: { npm: candidate.version } },
    'node_modules/npm': { version: candidate.version, resolved: candidate.tarball, integrity: candidate.integrity },
    [dependencyPath]: { version: '1.0.0', inBundle: true },
    [`${dependencyPath}/node_modules/example-dependency`]: { version: '2.0.0', inBundle: true },
    'node_modules/npm/node_modules/@example/scoped': { version: '3.0.0', inBundle: true }
  };
  for (const [path, entry] of Object.entries(packages)) {
    if (!path) continue;
    await mkdir(join(directory, path), { recursive: true });
    const name = path === 'node_modules/npm' ? 'npm' : path.split('/node_modules/').at(-1);
    await writeFile(join(directory, path, 'package.json'), JSON.stringify({ name, version: entry.version }));
  }
  const lock = { lockfileVersion: 3, packages };
  const save = () => writeFile(join(directory, 'package-lock.json'), JSON.stringify(lock));
  await save();
  return { directory, lock, save };
}

test('actual inventory includes scoped packages and multiple nested versions', async (t) => {
  const { directory } = await fixture(t);
  const actual = await verifyBundle(directory);
  assert.equal(actual.size, 4);
  assert.equal(actual.get(`${dependencyPath}/node_modules/example-dependency`).version, '2.0.0');
  assert.equal(actual.get('node_modules/npm/node_modules/@example/scoped').version, '3.0.0');
});

for (const field of ['version', 'resolved', 'integrity']) {
  test(`rejects an unreviewed npm ${field}`, async (t) => {
    const f = await fixture(t);
    f.lock.packages['node_modules/npm'][field] = 'unreviewed';
    await f.save();
    await assert.rejects(verifyBundle(f.directory), /Unexpected publisher/);
  });
}
test('rejects metadata-only remediation of an installed bundled package', async (t) => {
  const f = await fixture(t);
  f.lock.packages[dependencyPath].version = '9.0.0';
  await f.save();
  await assert.rejects(verifyBundle(f.directory), /lock differs from installed bytes/);
});
test('rejects removed audit-root dependency edges', async (t) => {
  const f = await fixture(t);
  f.lock.packages[''].dependencies = {};
  await f.save();
  await assert.rejects(verifyBundle(f.directory), /Audit root must reach/);
});
test('rejects changed bundled dependency edges even with unchanged versions', async (t) => {
  const f = await fixture(t);
  f.lock.packages[dependencyPath].dependencies = { omitted: '1.0.0' };
  await f.save();
  await assert.rejects(verifyBundle(f.directory), /dependency edges differ/);
});
test('rejects a lock omitting an installed bundled package', async (t) => {
  const f = await fixture(t);
  delete f.lock.packages[dependencyPath];
  await f.save();
  await assert.rejects(verifyBundle(f.directory), /lock differs from installed bytes/);
});
test('rejects a lock declaring a package missing from disk', async (t) => {
  const f = await fixture(t);
  f.lock.packages['node_modules/npm/node_modules/missing'] = { version: '1.0.0', inBundle: true };
  await f.save();
  await assert.rejects(verifyBundle(f.directory), /exactly the same packages/);
});
test('rejects package symlinks instead of following dependencies outside the audited tree', async (t) => {
  const { directory } = await fixture(t);
  await symlink(directory, join(directory, 'node_modules/npm/node_modules/linked'));
  await assert.rejects(verifyBundle(directory), /regular directories/);
});
test('accepts a complete clean audit and retains moderate findings', () => {
  verifyAudit(report(), 0, inventory);
  assert.equal(verifyAudit(report('moderate'), 0, inventory).moderate, 1);
});
for (const level of ['high', 'critical']) {
  test(`blocks ${level} findings even if the CLI incorrectly exits zero`, () => {
    assert.throws(() => verifyAudit(report(level), 0, inventory), /high\/critical/);
    assert.throws(() => verifyAudit(report(level), 1, inventory), /high\/critical/);
  });
}
for (const value of [{}, [], null, { ...report(), error: { code: 'E503' } }, { ...report(), auditReportVersion: 3 }]) {
  test(`rejects malformed or unavailable audit result ${JSON.stringify(value)}`, () => {
    assert.throws(() => verifyAudit(value, 0, inventory));
  });
}
test('blocks inconsistent counters and findings outside the inventory', () => {
  const high = report('high');
  high.metadata.vulnerabilities.high = 0;
  assert.throws(() => verifyAudit(high, 0, inventory), /counts differ/);
  const outside = report('moderate');
  outside.vulnerabilities['example-dependency'].nodes = ['node_modules/other'];
  assert.throws(() => verifyAudit(outside, 0, inventory), /outside installed inventory/);
  const malformed = report();
  malformed.metadata.vulnerabilities.total = '0';
  assert.throws(() => verifyAudit(malformed, 0, inventory), /Invalid audit total/);
});
test('blocks unsuccessful CLI exits even with clean JSON', () => {
  for (const code of [1, 2, 'ENOENT', undefined]) assert.throws(() => verifyAudit(report(), code, inventory));
});
test('preserves raw malformed output on audit failure and applies a process timeout', async (t) => {
  const { directory } = await fixture(t);
  const output = join(directory, 'report.json');
  await assert.rejects(auditPublishingTooling(directory, output, async (command, args, options) => {
    assert.equal(command, 'npm');
    for (const arg of ['--package-lock-only', '--ignore-scripts', '--include=dev', '--audit-level=high', '--registry=https://registry.npmjs.org']) assert.ok(args.includes(arg));
    assert.equal(options.timeout, 90_000);
    throw Object.assign(new Error('service unavailable'), { code: 1, stdout: '<unavailable>' });
  }));
  assert.equal(await readFile(output, 'utf8'), '<unavailable>');
});
test('preserves the full high finding when refusing publication', async (t) => {
  const { directory } = await fixture(t);
  const output = join(directory, 'report.json');
  const raw = JSON.stringify(report('high'));
  await assert.rejects(auditPublishingTooling(directory, output, async () => {
    throw Object.assign(new Error('vulnerable'), { code: 1, stdout: raw });
  }), /high\/critical/);
  assert.equal(await readFile(output, 'utf8'), raw);
});

test('every write job waits for the read-only tooling audit; canary publisher stays checkout-free', async () => {
  const root = new URL('../../', import.meta.url);
  const read = (file) => readFile(new URL(file, root), 'utf8');
  for (const [file, id] of [['release.yml', 'publish-npm'], ['canary.yml', 'publish'], ['recover-release-notes.yml', 'recover-notes']]) {
    const text = await read(`.github/workflows/${file}`);
    const job = text.split(`\n  ${id}:\n`)[1].split(/\n  [a-z][\w-]*:\n/)[0];
    assert.match(job, /needs:.*\bpublishing-tooling\b/);
    assert.ok(!job.includes('continue-on-error: true\n    steps:'));
    assert.match(text, /uses: \.\/\.github\/workflows\/publishing-tooling.yml/);
    assert.ok(job.includes(`npm@${candidate.version}`));
    assert.ok(job.includes('--ignore-scripts'));
    assert.ok(job.includes('package-manager-cache: false'));
    if (file === 'canary.yml') assert.ok(!job.includes('actions/checkout@'));
  }
  const workflow = await read('.github/workflows/publishing-tooling.yml');
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.ok(!workflow.includes(': write'));
  assert.ok(!workflow.includes('secrets.'));
  assert.ok(!workflow.includes('continue-on-error'));
  assert.ok(workflow.includes('if: always()'));
  assert.ok(workflow.includes(`--registry=https://registry.npmjs.org npm@${candidate.version}`));
  assert.ok(workflow.includes('package-manager-cache: false'));
  assert.ok(workflow.includes('node scripts/audit-publishing-tooling.mjs'));
});
