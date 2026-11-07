import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareReleaseAssets as prepareVerifiedReleaseAssets, releaseCertificatePolicy, loadCertificateVerifier, mirrorReleaseAssets, type PreparedReleaseAssets,
  type ReleaseAsset, type ReleaseAssetApi, type ListedReleaseAsset } from '../../scripts/mirror-release-assets.mjs';

import { assertReleaseAssetsEnvironment } from '../../scripts/check-release-assets-environment.mjs';

// Synthetic post-audit fixtures exercise structural binding, not cryptography.
const prepareReleaseAssets = (input: Parameters<typeof prepareVerifiedReleaseAssets>[0]) =>
  prepareVerifiedReleaseAssets(input, async () => {});

const tag = 'v1.2.3';
const commit = 'a'.repeat(40);
const repository = 'https://github.com/Ponchia/bronto-annotations';
const SLSA = 'https://slsa.dev/provenance/v1';
const PUBLISH = 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1';
const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'annotations-mirror-test-'));
  directories.push(directory);
  const archiveFile = join(directory, 'package.tgz');
  const archive = gzipSync('small deterministic fixture, not an executable package');
  await writeFile(archiveFile, archive);
  const hash = createHash('sha512').update(archive).digest();
  const metadata = { name: '@ponchia/annotations', version: '1.2.3',
    integrity: `sha512-${hash.toString('base64')}`,
    tarball: 'https://registry.npmjs.org/@ponchia/annotations/-/annotations-1.2.3.tgz' };
  const statements = [PUBLISH, SLSA].map((predicateType) => ({
    predicateType,
    subject: [{ name: 'pkg:npm/%40ponchia/annotations@1.2.3', digest: { sha512: hash.toString('hex') } }],
    predicate: { buildDefinition: {
      externalParameters: { workflow: { repository, ref: `refs/tags/${tag}`, path: '.github/workflows/release.yml' } },
      resolvedDependencies: [{ uri: `git+${repository}@refs/tags/${tag}`, digest: { gitCommit: commit } }],
    } },
  }));
  // Synthetic post-audit fixtures exercise binding logic only. They are NOT
  // cryptographic signatures; the workflow must run the real npm audit first.
  const attestationBundles = statements.map((statement) => ({
    predicateType: statement.predicateType,
    bundle: { mediaType: 'application/vnd.dev.sigstore.bundle.v0.3+json',
      verificationMaterial: { certificate: { rawBytes: 'fixture' }, tlogEntries: ['original evidence'] },
      dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString('base64'),
        payloadType: 'application/vnd.in-toto+json', signatures: [{ sig: 'fixture-signature', keyid: '' }] },
    },
  }));
  const audit = { invalid: [] as unknown[], missing: [] as unknown[],
    verified: [{ name: metadata.name, version: metadata.version, attestationBundles }] };
  return { directory, archive, input: { metadata, audit, archiveFile, tag, commit } };
}

function client(prepared: PreparedReleaseAssets, initial: ReleaseAsset[] = []) {
  const stored = new Map(initial.map((asset, i) => [i + 1, { name: asset.name, bytes: Buffer.from(asset.bytes) }]));
  const calls: string[] = [];
  let release = { id: 7, tag_name: prepared.tag, draft: false };
  let currentCommit = prepared.commit;
  const api: ReleaseAssetApi = {
    release: async () => ({ ...release }),
    tagCommit: async () => currentCommit,
    list: async () => [...stored].map(([id, asset]): ListedReleaseAsset => ({
      id, name: asset.name, size: asset.bytes.length, state: 'uploaded',
    })),
    download: async (id) => Buffer.from(stored.get(id)!.bytes),
    upload: async (_tag, asset) => {
      calls.push(asset.name);
      stored.set(stored.size + 1, { name: asset.name, bytes: Buffer.from(asset.bytes) });
    },
  };
  return { api, calls, stored,
    moveTag: () => { currentCommit = 'b'.repeat(40); },
    replaceRelease: () => { release = { ...release, id: 8 }; },
    makeDraft: () => { release.draft = true; },
  };
}

async function preparedFixture() {
  const f = await fixture();
  return { ...f, prepared: await prepareReleaseAssets(f.input) };
}

describe('original signed release asset preparation', () => {
  it('keeps the exact archive and original signed bundle, with exact identity guidance', async () => {
    const { input, archive, prepared } = await preparedFixture();
    expect(prepared.assets.map((a) => a.name)).toEqual([
      'annotations-1.2.3.tgz', 'annotations-1.2.3.tgz.sigstore.json', 'annotations-1.2.3.verify.md',
    ]);
    expect(prepared.assets[0]!.bytes).toEqual(archive);
    expect(JSON.parse(prepared.assets[1]!.bytes.toString())).toEqual(input.audit.verified[0]!.attestationBundles[1]!.bundle);
    const help = prepared.assets[2]!.bytes.toString();
    expect(help).toContain(commit);
    expect(help).toContain(input.metadata.integrity);
    expect(help).toContain('--certificate-identity');
    expect(help).toContain("--type 'https://slsa.dev/provenance/v1'");
    expect(help).toContain(`--certificate-github-workflow-sha '${commit}'`);
    expect(help).toContain('/.github/workflows/release.yml@refs/tags/v1.2.3');
    expect(help).not.toContain('--insecure');
    expect(help).not.toContain('--check-claims=false');
    expect(help).toContain('not a source-commit comparison');
  });
  it('is deterministic for repeated verification of the same immutable package', async () => {
    const { input, prepared } = await preparedFixture();
    expect(await prepareReleaseAssets(input)).toEqual(prepared);
  });
  it.each(['../../other', 'v1.2.3;echo bad', '-v1.2.3', 'main'])('rejects malformed tag %s', async (invalid) => {
    const { input } = await fixture();
    await expect(prepareReleaseAssets({ ...input, tag: invalid })).rejects.toThrow();
  });
  it('rejects a short or mismatched source commit', async () => {
    const { input } = await fixture();
    await expect(prepareReleaseAssets({ ...input, commit: 'abc' })).rejects.toThrow();
    await expect(prepareReleaseAssets({ ...input, commit: 'b'.repeat(40) })).rejects.toThrow(/source Git commit/);
  });
  it('rejects corrupted archive bytes before preparing any assets', async () => {
    const { input } = await fixture();
    await writeFile(input.archiveFile, gzipSync('different'));
    await expect(prepareReleaseAssets(input)).rejects.toThrow(/SHA-512/);
  });
  it.each(['invalid', 'missing'] as const)('refuses an audit with %s signatures', async (key) => {
    const { input } = await fixture();
    input.audit[key] = [{ name: input.metadata.name }];
    await expect(prepareReleaseAssets(input)).rejects.toThrow(/signatures/);
  });
  it('requires both the publish and original provenance attestations', async () => {
    const { input } = await fixture();
    input.audit.verified[0]!.attestationBundles.pop();
    await expect(prepareReleaseAssets(input)).rejects.toThrow(/provenance/);
  });
  it('rejects a different source workflow or archive subject', async () => {
    const { input } = await fixture();
    const envelope = input.audit.verified[0]!.attestationBundles[1]!.bundle.dsseEnvelope;
    const statement = JSON.parse(Buffer.from(envelope.payload, 'base64').toString());
    statement.predicate.buildDefinition.externalParameters.workflow.path = '.github/workflows/untrusted.yml';
    envelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64');
    await expect(prepareReleaseAssets(input)).rejects.toThrow(/workflow path/);
    statement.predicate.buildDefinition.externalParameters.workflow.path = '.github/workflows/release.yml';
    statement.subject[0].digest.sha512 = '0'.repeat(128);
    envelope.payload = Buffer.from(JSON.stringify(statement)).toString('base64');
    await expect(prepareReleaseAssets(input)).rejects.toThrow(/tarball SHA-512/);
  });
  it('rejects untrusted metadata origins and unsupported bundle shapes', async () => {
    const { input } = await fixture();
    const changed = { ...input.metadata, tarball: input.metadata.tarball.replace('registry.npmjs.org', 'example.org') };
    await expect(prepareReleaseAssets({ ...input, metadata: changed })).rejects.toThrow(/come from npm/);
    input.audit.verified[0]!.attestationBundles[1]!.bundle.mediaType = 'text/plain';
    await expect(prepareReleaseAssets(input)).rejects.toThrow(/bundle format/);
  });
});

describe('additive, conflict-refusing GitHub release mirroring', () => {
  it('dry-runs without mutation and uploads the exact three verified assets', async () => {
    const { prepared } = await preparedFixture();
    const { api, calls, stored } = client(prepared);
    expect((await mirrorReleaseAssets(prepared, api, { dryRun: true })).planned).toHaveLength(3);
    expect(calls).toEqual([]);
    const result = await mirrorReleaseAssets(prepared, api);
    expect(result.uploaded).toEqual(prepared.assets.map((a) => a.name));
    expect(stored.size).toBe(3);
    expect(result.assets?.every((a) => /^[a-f0-9]{64}$/.test(a.sha256))).toBe(true);
  });
  it('does nothing for an exact existing mirror, leaving unrelated assets alone', async () => {
    const { prepared } = await preparedFixture();
    const { api, calls, stored } = client(prepared, [...prepared.assets, { name: 'other.txt', bytes: Buffer.from('untouched') }]);
    expect((await mirrorReleaseAssets(prepared, api)).uploaded).toEqual([]);
    expect(calls).toEqual([]);
    expect(stored.size).toBe(4);
  });
  it('resumes a matching partial upload without replacing it', async () => {
    const { prepared } = await preparedFixture();
    const { api, calls } = client(prepared, [prepared.assets[0]!]);
    const result = await mirrorReleaseAssets(prepared, api);
    expect(result.retained).toEqual([prepared.assets[0]!.name]);
    expect(calls).toEqual(prepared.assets.slice(1).map((a) => a.name));
  });
  it('checks ALL pre-existing assets before any write, even a late-name conflict', async () => {
    const { prepared } = await preparedFixture();
    const conflict = { ...prepared.assets[2]!, bytes: Buffer.from(prepared.assets[2]!.bytes) };
    conflict.bytes[0] = 0;
    const { api, calls } = client(prepared, [conflict]);
    await expect(mirrorReleaseAssets(prepared, api)).rejects.toThrow(/Conflicting asset bytes/);
    expect(calls).toEqual([]);
  });
  it('rejects missing/draft releases and changed tags without uploading', async () => {
    const { prepared } = await preparedFixture();
    const c = client(prepared);
    c.moveTag();
    await expect(mirrorReleaseAssets(prepared, c.api)).rejects.toThrow(/tag moved/);
    expect(c.calls).toEqual([]);
    const d = client(prepared); d.makeDraft();
    await expect(mirrorReleaseAssets(prepared, d.api)).rejects.toThrow(/draft release/);
    expect(d.calls).toEqual([]);
    const e = client(prepared); e.api.release = async () => { throw new Error('404'); };
    await expect(mirrorReleaseAssets(prepared, e.api)).rejects.toThrow('404');
    expect(e.calls).toEqual([]);
  });
  it.each(['duplicate', 'starter', 'size', 'download'])('refuses %s asset conflicts', async (mode) => {
    const { prepared } = await preparedFixture();
    const { api, calls } = client(prepared, [prepared.assets[0]!]);
    const list = api.list;
    api.list = async (id) => {
      const existing = await list(id);
      if (mode === 'duplicate') return [...existing, existing[0]!];
      if (mode === 'starter') existing[0]!.state = 'starter';
      if (mode === 'size') existing[0]!.size++;
      return existing;
    };
    if (mode === 'download') api.download = async () => { throw new Error('download failed'); };
    await expect(mirrorReleaseAssets(prepared, api)).rejects.toThrow();
    expect(calls).toEqual([]);
  });
  it('recovers an acknowledged upload with a lost response by inspecting its actual bytes', async () => {
    const { prepared } = await preparedFixture();
    const { api, calls } = client(prepared);
    const upload = api.upload;
    api.upload = async (tag, asset) => { await upload(tag, asset); throw new Error('response lost'); };
    expect((await mirrorReleaseAssets(prepared, api)).uploaded).toHaveLength(3);
    expect(calls).toHaveLength(3); // Exactly once per asset, never a blind retry.
  });
  it('does not retry an uncertain upload that is not visible', async () => {
    const { prepared } = await preparedFixture();
    const { api } = client(prepared);
    let attempts = 0;
    api.upload = async () => { attempts++; throw new Error('uncertain outcome'); };
    await expect(mirrorReleaseAssets(prepared, api)).rejects.toThrow('uncertain outcome');
    expect(attempts).toBe(1);
  });
  it('stops after a tag move during upload rather than touching later assets', async () => {
    const { prepared } = await preparedFixture();
    const c = client(prepared);
    const upload = c.api.upload;
    c.api.upload = async (tag, asset) => { await upload(tag, asset); c.moveTag(); };
    await expect(mirrorReleaseAssets(prepared, c.api)).rejects.toThrow(/tag moved/);
    expect(c.calls).toHaveLength(1);
  });
  it('refuses unexpected asset names before invoking the GitHub API', async () => {
    const { prepared } = await preparedFixture();
    const { api, calls } = client(prepared);
    prepared.assets[0]!.name = '../../unexpected.tgz';
    await expect(mirrorReleaseAssets(prepared, api)).rejects.toThrow(/asset set/);
    expect(calls).toEqual([]);
  });
});

describe('guarded workflow boundary', () => {
  it('requires main, protected review and audited fresh evidence before any release write', async () => {
    const workflow = await readFile(new URL('../../.github/workflows/mirror-release-assets.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^  (?:push|pull_request|pull_request_target|schedule):/m);
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain('environment: release-assets');
    expect(workflow).not.toContain('environment: npm-publish');
    expect(workflow).toContain('needs: [publishing-tooling, approval-preflight]');
    expect(workflow).toContain('run: node scripts/check-release-assets-environment.mjs');
    expect(workflow).toContain('actions: read');
    expect(workflow).toContain('ANNOTATIONS_PUBLISHER_NPM_CLI: ${{ runner.temp }}/annotations-publisher/source/bin/npm-cli.js');
    expect(workflow).toContain('needs: [publishing-tooling, approval-preflight]');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('git merge-base --is-ancestor');
    expect(workflow).toContain('audit signatures --json --include-attestations');
    expect(workflow).toContain('scripts/source-publisher.mjs audit');
    expect(workflow).toContain('scripts/verify-published-provenance.mjs');
    expect(workflow.indexOf('audit signatures --json')).toBeLessThan(workflow.indexOf('node scripts/mirror-release-assets.mjs'));
    expect(workflow).not.toMatch(/^\s*(?:id-token|packages):\s*write/m);
    expect(workflow).not.toMatch(/^\s*(?:npm(?:\s+--[a-z-]+)*\s+publish|gh\s+release\s+(?:create|delete))\b/m);
    expect(workflow).not.toContain('--clobber');
    expect(workflow).toContain('default: false');
    expect(workflow).toContain('args+=(--dry-run)');
    for (const use of workflow.matchAll(/uses:\s*([^\s#]+)/g)) {
      if (!use[1]!.startsWith('./')) expect(use[1]).toMatch(/@[a-f0-9]{40}$/);
    }
  });
});


describe('expected original certificate identity before asset preparation', () => {
  it('requires the certificate verifier instead of trusting a saved audit JSON', async () => {
    const { input } = await fixture();
    await expect(prepareVerifiedReleaseAssets(input,
      undefined as unknown as Parameters<typeof prepareVerifiedReleaseAssets>[1])).rejects.toThrow(/verifier is required/);
  });
  it('uses exact issuer, anchored workflow/tag identity and source-commit OID', async () => {
    const { input } = await fixture();
    let calls = 0;
    await prepareVerifiedReleaseAssets(input, async (bundle, policy) => {
      calls++;
      expect(bundle).toEqual(input.audit.verified[0]!.attestationBundles[1]!.bundle);
      expect(policy.certificateIssuer).toBe('https://token.actions.githubusercontent.com');
      expect(policy.certificateOIDs).toEqual({ '1.3.6.1.4.1.57264.1.3': commit });
      const identity = `${repository}/.github/workflows/release.yml@refs/tags/${tag}`;
      const pattern = new RegExp(policy.certificateIdentityURI);
      expect(pattern.test(identity)).toBe(true);
      expect(pattern.test(`${identity}-wrong`)).toBe(false);
      expect(pattern.test(`wrong-${identity}`)).toBe(false);
      expect(pattern.test(identity.replace('github.com', 'githubXcom'))).toBe(false);
      expect(pattern.test(identity.replace('v1.2.3', 'v1X2X3'))).toBe(false);
    });
    expect(calls).toBe(1);
  });
  it.each(['issuer', 'workflow identity', 'source commit'])('propagates an actual verifier rejection of %s', async (field) => {
    const { input } = await fixture();
    await expect(prepareVerifiedReleaseAssets(input, async () => { throw new Error(`Certificate ${field} mismatch`); }))
      .rejects.toThrow(`Certificate ${field} mismatch`);
  });
  it('passes DSSE identity options as the second argument, never a discarded third argument', async () => {
    const { directory } = await fixture();
    const module = join(directory, 'node_modules/sigstore');
    await mkdir(join(module, 'dist'), { recursive: true });
    const lock = JSON.parse(await readFile(new URL('../../tooling/publisher/package-lock.json', import.meta.url), 'utf8'));
    await writeFile(join(module, 'package.json'), JSON.stringify({ name: 'sigstore', main: 'dist/index.js', version: lock.packages['node_modules/sigstore'].version }));
    await writeFile(join(module, 'dist/index.js'), `exports.verify = function(bundle, options) {
      if (arguments.length !== 2 || !options.certificateIdentityURI || !options.certificateOIDs) throw new Error('policy discarded');
      return Promise.resolve({ options, bundle });
    };`);
    const verifier = await loadCertificateVerifier(join(directory, 'source/bin/npm-cli.js'));
    const policy = releaseCertificatePolicy(tag, commit);
    expect(await verifier({ test: true }, policy)).toEqual({ bundle: { test: true }, options: policy });
  });
  it('does not confuse an ordinary global npm layout with the audited publisher prefix', async () => {
    const { directory } = await fixture();
    await expect(loadCertificateVerifier(join(directory, 'bin/npm-cli.js'))).rejects.toThrow(/source\/bin layout/);
  });
  it('rejects an absent or relative verifier path', async () => {
    await expect(loadCertificateVerifier(undefined)).rejects.toThrow(/audited publisher/);
    await expect(loadCertificateVerifier('./node_modules/sigstore')).rejects.toThrow(/audited publisher/);
  });
});

describe('immutable upload target', () => {
  it('cannot redirect an upload when a release is replaced after the last identity check', async () => {
    const { prepared } = await preparedFixture();
    const c = client(prepared);
    let lists = 0;
    const list = c.api.list;
    c.api.list = async (id) => {
      if (++lists === 2) c.replaceRelease();
      return list(id);
    };
    const targets: number[] = [];
    c.api.upload = async (releaseId) => { targets.push(releaseId); throw new Error('Original release no longer exists'); };
    await expect(mirrorReleaseAssets(prepared, c.api)).rejects.toThrow(/Original release/);
    expect(targets).toEqual([7]);
    expect(targets).not.toContain(8);
  });
});

const environmentFixture = () => ({
  environment: { id: 12, name: 'release-assets', deployment_branch_policy: { custom_branch_policies: true, protected_branches: false },
    protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 4352894, login: 'Ponchia' } }] }] },
  branches: { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] },
});

describe('existing main-only protected environment prerequisite', () => {
  it('accepts the explicitly configured maintainer-reviewed main-only boundary', () => {
    const f = environmentFixture();
    expect(assertReleaseAssetsEnvironment(f.environment, f.branches)).toEqual({
      environment: 'release-assets', id: 12, branch: 'main', requiredReviewer: 'Ponchia', verified: true,
    });
  });
  it('refuses a missing environment, the npm publishing environment, or a tag policy', () => {
    const f = environmentFixture();
    expect(() => assertReleaseAssetsEnvironment(undefined, f.branches)).toThrow();
    expect(() => assertReleaseAssetsEnvironment({ ...f.environment, name: 'npm-publish' }, f.branches)).toThrow();
    expect(() => assertReleaseAssetsEnvironment(f.environment, { total_count: 1, branch_policies: [{ name: 'v*', type: 'tag' }] })).toThrow();
  });
  it('refuses broad/extra branches, wildcard main matches and missing review', () => {
    const f = environmentFixture();
    expect(() => assertReleaseAssetsEnvironment(f.environment, { total_count: 2, branch_policies: [...f.branches.branch_policies, { name: 'dev', type: 'branch' }] })).toThrow();
    expect(() => assertReleaseAssetsEnvironment(f.environment, { total_count: 1, branch_policies: [{ name: 'main*', type: 'branch' }] })).toThrow();
    expect(() => assertReleaseAssetsEnvironment({ ...f.environment, protection_rules: [] }, f.branches)).toThrow();
    expect(() => assertReleaseAssetsEnvironment({ ...f.environment, deployment_branch_policy: { custom_branch_policies: false, protected_branches: true } }, f.branches)).toThrow();
  });
  it('refuses another identity, a team alias, or an alternative reviewer', () => {
    for (const reviewer of [{ type: 'User', reviewer: { id: 1, login: 'Ponchia' } },
      { type: 'Team', reviewer: { id: 4352894, login: 'Ponchia' } },
      { type: 'User', reviewer: { id: 4352894, login: 'other' } }]) {
      const f = environmentFixture(); f.environment.protection_rules[0]!.reviewers = [reviewer];
      expect(() => assertReleaseAssetsEnvironment(f.environment, f.branches)).toThrow();
    }
    const f = environmentFixture(); f.environment.protection_rules[0]!.reviewers.push({ type: 'User', reviewer: { id: 1, login: 'other' } });
    expect(() => assertReleaseAssetsEnvironment(f.environment, f.branches)).toThrow();
  });
});
