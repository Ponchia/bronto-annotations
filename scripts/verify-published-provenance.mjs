/** Bind npm's *already signature-verified* provenance to our exact tag/commit.
 *
 * The caller MUST have successfully run `npm audit signatures --json
 * --include-attestations` in a clean consumer. npm cryptographically checks
 * registry/publish/Sigstore signatures; we additionally check the signed SLSA
 * source identity, workflow, commit and archive digest before repairing notes.
 * This module does NOT verify raw unsigned registry JSON by itself.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const NAME = '@ponchia/annotations';
const REPO = 'https://github.com/Ponchia/bronto-annotations';
const WORKFLOW = '.github/workflows/release.yml';
const PROVENANCE = 'https://slsa.dev/provenance/v1';
const PUBLISH = 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1';

export function verifyPublishedProvenance(audit, metadata, tag, commit) {
  assert.match(tag, /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Invalid recovery release tag');
  assert.match(commit, /^[a-f0-9]{40}$/, 'Expected a full Git commit SHA');
  const version = tag.slice(1);
  assert.equal(metadata?.name, NAME, 'Unexpected published package name');
  assert.equal(metadata?.version, version, 'Published version does not match the release tag');
  assert.match(metadata?.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/, 'Missing package SHA-512 integrity');
  const digestBytes = Buffer.from(metadata.integrity.slice('sha512-'.length), 'base64');
  assert.equal(digestBytes.length, 64, 'Invalid complete SHA-512 digest');
  const expectedSha512 = digestBytes.toString('hex');

  assert.ok(Array.isArray(audit?.verified), 'Missing npm audit verified package results');
  assert.deepEqual(audit.invalid ?? [], [], 'npm audit reported invalid signatures');
  assert.deepEqual(audit.missing ?? [], [], 'npm audit reported missing signatures');
  const matches = audit.verified.filter((item) => item.name === NAME && item.version === version);
  assert.equal(matches.length, 1, 'npm audit must verify the exact package and version once');
  const bundles = matches[0].attestationBundles;
  assert.ok(Array.isArray(bundles), 'npm audit must include verified attestation bundles');

  let provenanceFound = false;
  let publishFound = false;
  for (const entry of bundles) {
    if (entry.predicateType !== PROVENANCE && entry.predicateType !== PUBLISH) continue;
    const payload = entry.bundle?.dsseEnvelope?.payload;
    assert.equal(typeof payload, 'string', 'Signed attestation payload is missing');
    const statement = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    assert.equal(statement.predicateType, entry.predicateType, 'Attestation predicate mismatches its bundle');
    assert.ok(statement.subject?.some((subject) =>
      subject.name === `pkg:npm/%40ponchia/annotations@${version}`
      && subject.digest?.sha512 === expectedSha512
    ), 'Attestation subject must bind to the exact published tarball SHA-512');

    if (entry.predicateType === PUBLISH) {
      assert.equal(publishFound, false, 'Duplicate publish attestations');
      publishFound = true;
      continue;
    }

    assert.equal(provenanceFound, false, 'Duplicate provenance attestations');
    const definition = statement.predicate?.buildDefinition;
    const source = definition?.externalParameters?.workflow;
    assert.equal(source?.repository, REPO, 'Signed source repository does not match');
    assert.equal(source?.ref, `refs/tags/${tag}`, 'Signed workflow tag does not match');
    assert.equal(source?.path, WORKFLOW, 'Signed workflow path does not match');
    assert.ok(definition?.resolvedDependencies?.some((dependency) =>
      dependency.uri === `git+${REPO}@refs/tags/${tag}`
      && dependency.digest?.gitCommit === commit
    ), 'Signed source Git commit does not match');
    provenanceFound = true;
  }

  assert.ok(provenanceFound, 'Missing verified GitHub release workflow provenance');
  assert.ok(publishFound, 'Missing verified npm publish attestation');
  return {
    name: NAME,
    version,
    tag,
    commit,
    repository: REPO,
    workflow: WORKFLOW,
    integrity: metadata.integrity,
    signedProvenanceVerified: true,
    npmPublishAttestationVerified: true
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [auditFile, metadataFile, tag, commit] = process.argv.slice(2);
  assert.ok(auditFile && metadataFile && tag && commit,
    'Usage: verify-published-provenance.mjs <npm-audit.json> <verified-metadata.json> <tag> <commit-sha>');
  const audit = JSON.parse(await readFile(auditFile, 'utf8'));
  const metadata = JSON.parse(await readFile(metadataFile, 'utf8'));
  console.log(JSON.stringify(verifyPublishedProvenance(audit, metadata, tag, commit), null, 2));
}
