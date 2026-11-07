/** Mirror an existing npm release, never create or re-sign a package.
 *
 * TRUST BOUNDARY: audit is the output of a SUCCESSFUL, fresh `npm audit
 * signatures --json --include-attestations` in the guarded workflow. Parsing
 * an arbitrary audit JSON file is not cryptographic verification. The helper
 * additionally binds its verified statements to the exact bytes and tag.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { verifyPublishedTarballFile } from './verify-published-tarball.mjs';
import { verifyPublishedProvenance } from './verify-published-provenance.mjs';

const exec = promisify(execFile);
const REPOSITORY = 'Ponchia/bronto-annotations';
const SLSA = 'https://slsa.dev/provenance/v1';
const MAX_ASSET_BYTES = 32 * 1024 * 1024;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const validateIdentity = ({ tag, commit }) => {
  assert.match(tag, /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Invalid release tag');
  assert.match(commit, /^[a-f0-9]{40}$/, 'Expected a full source commit');
};

/** Exact identity policy for the ORIGINAL tag-driven release certificate. */
export function releaseCertificatePolicy(tag, commit) {
  validateIdentity({ tag, commit });
  const identity = `https://github.com/${REPOSITORY}/.github/workflows/release.yml@refs/tags/${tag}`;
  const escaped = identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    certificateIdentityURI: `^${escaped}$`,
    certificateIssuer: 'https://token.actions.githubusercontent.com',
    certificateOIDs: { '1.3.6.1.4.1.57264.1.3': commit },
  };
}

/** Use only the separately source-locked, audited publisher prepared by CI. */
export async function loadCertificateVerifier(npmCli) {
  assert.ok(typeof npmCli === 'string' && isAbsolute(npmCli),
    'Set ANNOTATIONS_PUBLISHER_NPM_CLI to the audited publisher npm-cli.js');
  assert.equal(basename(npmCli), 'npm-cli.js', 'Expected the audited npm CLI entry');
  assert.equal(basename(dirname(npmCli)), 'bin', 'Unexpected audited publisher layout');
  const require = createRequire(npmCli);
  const lock = JSON.parse(await readFile(new URL('../tooling/publisher/package-lock.json', import.meta.url), 'utf8'));
  const expected = lock.packages['node_modules/sigstore'].version;
  // This dependency belongs to the external, audited publisher installation,
  // not to the annotation package or its development node_modules. Resolve its
  // explicit installation directory, so analysis does not mistake it for a new
  // dependency of the annotation runtime.
  const sourceDirectory = dirname(dirname(npmCli));
  assert.equal(basename(sourceDirectory), 'source', 'Expected the audited publisher source/bin layout');
  const verifierRoot = join(dirname(sourceDirectory), 'node_modules', 'sigstore');
  const manifest = JSON.parse(await readFile(join(verifierRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'sigstore');
  const actual = manifest.version;
  const verifierEntry = require.resolve(verifierRoot);
  assert.equal(actual, expected, 'Certificate verifier differs from the audited publisher lock');
  // 4.1.1 fixed ignored certificateOIDs; a lower version cannot enforce SHA.
  const [major, minor, patch] = actual.split('.').map(Number);
  assert.ok(major > 4 || (major === 4 && (minor > 1 || (minor === 1 && patch >= 1))),
    'Certificate verifier must enforce the source-commit OID policy');
  const { verify } = require(verifierEntry);
  // DSSE's options are the SECOND argument. Passing undefined as a second
  // data argument would silently discard the third-argument policy.
  return (bundle, policy) => verify(bundle, policy);
}

/** Pure preparation from previously signature-verified npm evidence. */
export async function prepareReleaseAssets({ metadata, audit, archiveFile, tag, commit }, verifySignature) {
  validateIdentity({ tag, commit });
  const archive = await verifyPublishedTarballFile(metadata, archiveFile);
  const source = verifyPublishedProvenance(audit, metadata, tag, commit);
  const entries = audit.verified.find((item) => item.name === source.name && item.version === source.version)
    .attestationBundles.filter((entry) => entry.predicateType === SLSA);
  assert.equal(entries.length, 1, 'Expected one verified original SLSA bundle');
  const bundle = entries[0].bundle;
  assert.equal(typeof verifySignature, 'function', 'A cryptographic certificate-policy verifier is required');
  // The signed payload's repository fields are not the certificate's identity.
  // Verify both, including the issuer-certified immutable workflow source SHA.
  await verifySignature(bundle, releaseCertificatePolicy(tag, commit));
  assert.match(bundle.mediaType, /^application\/vnd\.dev\.sigstore\.bundle(?:\+json;version=0\.[123]|\.v0\.3\+json)$/,
    'Unsupported original Sigstore bundle format');
  assert.ok(bundle.verificationMaterial && bundle.dsseEnvelope?.signatures?.length,
    'Original certificate, signatures and transparency evidence must be retained');

  // Re-read and recheck the in-memory bytes used for upload, closing a local
  // time-of-check/time-of-use gap between the streamed check and copying.
  const bytes = await readFile(archiveFile);
  assert.equal(bytes.length, archive.bytes);
  assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, source.integrity);
  const name = `annotations-${source.version}.tgz`;
  const bundleName = `${name}.sigstore.json`;
  const certificateIdentity = `https://github.com/${REPOSITORY}/.github/workflows/release.yml@refs/tags/${tag}`;
  const command = [
    `cosign verify-blob-attestation \\`,
    `  --type 'https://slsa.dev/provenance/v1' \\`,
    `  --bundle '${bundleName}' \\`,
    `  --certificate-identity '${certificateIdentity}' \\`,
    `  --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' \\`,
    `  --certificate-github-workflow-sha '${commit}' \\`,
    `  '${name}'`,
].join("\n");
  const instructions = `# Verify @ponchia/annotations ${source.version}

This archive is the unchanged npm package, not GitHub's generated source archive.
The adjacent Sigstore bundle contains the ORIGINAL signed npm SLSA provenance.
No package was rebuilt, republished or re-signed for this mirror.

Expected source commit: ${commit}
Expected SHA-512 (npm SRI): ${source.integrity}
Archive SHA-256: ${sha256(bytes)}

Use a supported Cosign version with Sigstore bundle verification:

\`\`\`bash
${command}
\`\`\`

Cosign 2.x also needs --new-bundle-format; Cosign 3.x uses the bundle format by default.
Do not disable signature, identity, transparency or artifact-digest checks.
After signature verification, inspect the signed SLSA resolvedDependencies
for gitCommit ${commit}; identity alone is not a source-commit comparison.
Checksums detect corruption but do not authenticate a download by themselves.

Official npm provenance verification guidance:
https://blog.sigstore.dev/cosign-verify-bundles/
Maintainer mirror runbook:
https://github.com/${REPOSITORY}/blob/main/docs/release-assets.md
`;
  return {
    tag, commit,
    assets: [
      { name, bytes },
      // JSON serialization preserves the signed DSSE payload, signatures and
      // verification material. This is a bundle, not an unsigned statement.
      { name: bundleName, bytes: Buffer.from(JSON.stringify(bundle, null, 2) + '\n') },
      { name: `annotations-${source.version}.verify.md`, bytes: Buffer.from(instructions) },
    ],
  };
}

/** Add missing assets only. Existing names must match exactly before ANY upload.
 * A transport failure is inspected, not blindly replayed; the next invocation
 * can resume a partial mirror after re-verifying all source evidence.
 */
export async function mirrorReleaseAssets(prepared, api, { dryRun = false } = {}) {
  validateIdentity(prepared);
  const { tag, commit, assets } = prepared;
  const version = tag.slice(1);
  assert.deepEqual(assets.map((asset) => asset.name), [
    `annotations-${version}.tgz`, `annotations-${version}.tgz.sigstore.json`, `annotations-${version}.verify.md`,
  ], 'Unexpected mirror asset set');
  for (const asset of assets) {
    assert.ok(Buffer.isBuffer(asset.bytes) && asset.bytes.length > 0 && asset.bytes.length <= MAX_ASSET_BYTES,
      `Invalid or oversized asset: ${asset.name}`);
  }
  const release = await api.release(tag);
  assert.ok(Number.isSafeInteger(release?.id) && release.id > 0, 'Existing GitHub release required');
  assert.equal(release.tag_name, tag, 'GitHub release tag mismatch');
  assert.equal(release.draft, false, 'Refuse to modify a draft release');
  const checkIdentity = async () => {
    assert.equal(await api.tagCommit(tag), commit, 'Release tag moved or names a different source commit');
    const current = await api.release(tag);
    assert.equal(current.id, release.id, 'GitHub release was replaced');
    assert.equal(current.tag_name, tag);
    assert.equal(current.draft, false, 'GitHub release became a draft');
  };
  const inspect = async (asset, listed) => {
    const matches = listed.filter((item) => item.name === asset.name);
    assert.ok(matches.length <= 1, `Duplicate GitHub asset name: ${asset.name}`);
    if (!matches.length) return false;
    const match = matches[0];
    assert.ok(Number.isSafeInteger(match.id) && match.id > 0, 'Invalid GitHub asset ID');
    assert.equal(match.state, 'uploaded', `Asset is incomplete: ${asset.name}`);
    assert.equal(match.size, asset.bytes.length, `Conflicting asset size: ${asset.name}`);
    const remote = await api.download(match.id);
    assert.ok(Buffer.isBuffer(remote), 'Expected downloaded asset bytes');
    assert.equal(remote.length, asset.bytes.length, `Conflicting downloaded size: ${asset.name}`);
    assert.equal(sha256(remote), sha256(asset.bytes), `Conflicting asset bytes: ${asset.name}`);
    return true;
  };
  await checkIdentity();
  const existing = await api.list(release.id);
  assert.ok(Array.isArray(existing), 'Cannot inspect GitHub release assets');
  const present = new Set();
  for (const asset of assets) if (await inspect(asset, existing)) present.add(asset.name);
  const planned = assets.filter((asset) => !present.has(asset.name)).map((asset) => asset.name);
  if (dryRun) return { tag, commit, dryRun: true, planned, uploaded: [], retained: [...present] };

  const uploaded = [];
  for (const asset of assets) {
    await checkIdentity();
    // Recheck before each write: another verified run might have uploaded it.
    if (await inspect(asset, await api.list(release.id))) continue;
    let uploadError;
    try { await api.upload(release.id, asset); } catch (error) { uploadError = error; }
    const now = await api.list(release.id);
    const found = await inspect(asset, now);
    if (!found) {
      if (uploadError) throw uploadError;
      throw new Error(`Upload outcome is unconfirmed for ${asset.name}; inspect before retrying`);
    }
    uploaded.push(asset.name);
  }
  await checkIdentity();
  return {
    tag, commit, dryRun: false, planned, uploaded, retained: [...present],
    assets: assets.map(({ name, bytes }) => ({ name, bytes: bytes.length, sha256: sha256(bytes) })),
  };
}

async function githubClient() {
  const scratch = await mkdtemp(join(tmpdir(), 'annotations-release-assets-'));
  const gh = async (args, binary = false) => {
    const { stdout } = await exec('gh', args, {
      encoding: binary ? 'buffer' : 'utf8', timeout: 60_000, maxBuffer: MAX_ASSET_BYTES + 1024 * 1024,
    });
    return binary ? stdout : JSON.parse(stdout);
  };
  const endpoint = `repos/${REPOSITORY}`;
  return {
    close: () => rm(scratch, { recursive: true, force: true }),
    release: (tag) => gh(['api', `${endpoint}/releases/tags/${tag}`]),
    tagCommit: async (tag) => {
      let { object } = await gh(['api', `${endpoint}/git/ref/tags/${tag}`]);
      for (let depth = 0; object.type === 'tag' && depth < 5; depth++) {
        assert.match(object.sha, /^[a-f0-9]{40}$/);
        ({ object } = await gh(['api', `${endpoint}/git/tags/${object.sha}`]));
      }
      assert.equal(object.type, 'commit', 'Tag does not resolve to a commit');
      assert.match(object.sha, /^[a-f0-9]{40}$/);
      return object.sha;
    },
    list: async (id) => {
      const results = [];
      for (let page = 1; page <= 10; page++) {
        const items = await gh(['api', `${endpoint}/releases/${id}/assets?per_page=100&page=${page}`]);
        assert.ok(Array.isArray(items));
        results.push(...items);
        if (items.length < 100) return results;
      }
      throw new Error('Release asset listing exceeds the bounded scan; no upload is safe');
    },
    download: (id) => gh(['api', `${endpoint}/releases/assets/${id}`, '-H', 'Accept: application/octet-stream'], true),
    upload: async (releaseId, asset) => {
      assert.ok(Number.isSafeInteger(releaseId) && releaseId > 0, 'Invalid target release ID');
      const file = join(scratch, asset.name);
      await writeFile(file, asset.bytes, { flag: 'wx', mode: 0o600 });
      // The immutable numeric release ID is the one inspected above. A tag
      // or release replacement cannot redirect this write to another release.
      const endpoint = `https://uploads.github.com/repos/${REPOSITORY}/releases/${releaseId}/assets?name=${encodeURIComponent(asset.name)}`;
      await exec('gh', ['api', '--method', 'POST', endpoint,
        '-H', 'Content-Type: application/octet-stream', '--input', file], {
        timeout: 60_000, maxBuffer: 1024 * 1024,
      });
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const dryRun = args.at(-1) === '--dry-run';
  if (dryRun) args.pop();
  assert.equal(args.length, 5,
    'Usage: mirror-release-assets.mjs <metadata.json> <archive.tgz> <successful-npm-audit.json> <tag> <commit> [--dry-run]');
  const [metadataFile, archiveFile, auditFile, tag, commit] = args;
  const metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
  const audit = JSON.parse(await readFile(auditFile, 'utf8'));
  const verifySignature = await loadCertificateVerifier(process.env.ANNOTATIONS_PUBLISHER_NPM_CLI);
  const prepared = await prepareReleaseAssets({ metadata, audit, archiveFile, tag, commit }, verifySignature);
  const api = await githubClient();
  try { console.log(JSON.stringify(await mirrorReleaseAssets(prepared, api, { dryRun }), null, 2)); }
  finally { await api.close(); }
}
