import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPublishedProvenance } from '../../scripts/verify-published-provenance.mjs';

const tag = 'v0.6.2';
const version = tag.slice(1);
const commit = 'ccfac76734460da54ecb8ea6a3d9e831d0163530';
const repo = 'https://github.com/Ponchia/bronto-annotations';
const digest = createHash('sha512').update('synthetic archive bytes').digest();
const metadata = {
  name: '@ponchia/annotations', version,
  integrity: `sha512-${digest.toString('base64')}`,
  tarball: `https://registry.npmjs.org/@ponchia/annotations/-/annotations-${version}.tgz`
};
const purl = `pkg:npm/%40ponchia/annotations@${version}`;
const subject = [{ name: purl, digest: { sha512: digest.toString('hex') } }];
const source = {
  repository: repo,
  ref: `refs/tags/${tag}`,
  path: '.github/workflows/release.yml'
};
const provenanceType = 'https://slsa.dev/provenance/v1';
const publishType = 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1';

function bundle(predicateType: string, statement: unknown) {
  return {
    predicateType,
    bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString('base64') } }
  };
}

function provenanceStatement() {
  return {
    _type: 'https://in-toto.io/Statement/v1', predicateType: provenanceType,
    subject: structuredClone(subject),
    predicate: {
      buildDefinition: {
        externalParameters: { workflow: { ...source } },
        resolvedDependencies: [{ uri: `git+${repo}@refs/tags/${tag}`, digest: { gitCommit: commit } }]
      }
    }
  };
}

function verifiedReport() {
  return {
    invalid: [], missing: [],
    verified: [{
      name: metadata.name, version,
      attestationBundles: [
        bundle(publishType, { _type: 'https://in-toto.io/Statement/v0.1', predicateType: publishType, subject }),
        bundle(provenanceType, provenanceStatement())
      ]
    }]
  };
}

function mutatedProvenance(changes: (statement: ReturnType<typeof provenanceStatement>) => void) {
  const audit = verifiedReport();
  const statement = provenanceStatement();
  changes(statement);
  audit.verified[0]!.attestationBundles[1] = bundle(provenanceType, statement);
  return audit;
}

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('signed npm artifact release-notes recovery', () => {
  it('matches both npm publish attestation and signed SLSA tag/source commit', () => {
    const proof = verifyPublishedProvenance(verifiedReport(), metadata, tag, commit);
    expect(proof).toEqual({
      name: metadata.name, version, tag, commit, repository: repo,
      workflow: '.github/workflows/release.yml', integrity: metadata.integrity,
      signedProvenanceVerified: true, npmPublishAttestationVerified: true
    });
  });

  it('rejects a mismatched source repository or signing workflow', () => {
    expect(() => verifyPublishedProvenance(mutatedProvenance((p) => {
      p.predicate.buildDefinition.externalParameters.workflow.repository = 'https://github.com/other/repo';
    }), metadata, tag, commit)).toThrow('Signed source repository');
    expect(() => verifyPublishedProvenance(mutatedProvenance((p) => {
      p.predicate.buildDefinition.externalParameters.workflow.path = '.github/workflows/other.yml';
    }), metadata, tag, commit)).toThrow('Signed workflow path');
  });

  it('rejects a wrong signed tag, workflow source SHA, or package version', () => {
    expect(() => verifyPublishedProvenance(mutatedProvenance((p) => {
      p.predicate.buildDefinition.externalParameters.workflow.ref = 'refs/tags/v0.6.1';
    }), metadata, tag, commit)).toThrow('Signed workflow tag');
    expect(() => verifyPublishedProvenance(mutatedProvenance((p) => {
      p.predicate.buildDefinition.resolvedDependencies[0]!.digest.gitCommit = '0'.repeat(40);
    }), metadata, tag, commit)).toThrow('Signed source Git commit');
    expect(() => verifyPublishedProvenance(verifiedReport(), { ...metadata, version: '0.6.3' }, tag, commit))
      .toThrow('does not match the release tag');
  });

  it('rejects subject SHA-512 divergence and malformed attestation payloads', () => {
    const audit = mutatedProvenance((p) => {
      p.subject = [{ name: purl, digest: { sha512: '00'.repeat(64) } }];
    });
    expect(() => verifyPublishedProvenance(audit, metadata, tag, commit))
      .toThrow('Attestation subject');
    const missing = verifiedReport();
    missing.verified[0]!.attestationBundles.pop();
    expect(() => verifyPublishedProvenance(missing, metadata, tag, commit))
      .toThrow('Missing verified GitHub release workflow provenance');
  });

  it('requires cryptographically verified npm audit results with no invalid/missing packages', () => {
    const invalid = verifiedReport();
    invalid.invalid.push({ name: '@ponchia/annotations' } as never);
    expect(() => verifyPublishedProvenance(invalid, metadata, tag, commit))
      .toThrow('invalid signatures');
    const missing = verifiedReport();
    missing.missing.push({ name: '@ponchia/annotations' } as never);
    expect(() => verifyPublishedProvenance(missing, metadata, tag, commit))
      .toThrow('missing signatures');
    const stripped = verifiedReport();
    stripped.verified[0]!.attestationBundles = [];
    expect(() => verifyPublishedProvenance(stripped, metadata, tag, commit))
      .toThrow('Missing verified GitHub release workflow provenance');
  });

  it('verifies an exact older package version without requiring stale latest/next tags', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ann-recovery-version-'));
    dirs.push(dir);
    const packument = {
      name: metadata.name,
      'dist-tags': { latest: '0.6.9', next: '0.7.0-rc.2' },
      versions: { [version]: { name: metadata.name, version, dist: {
        tarball: metadata.tarball, integrity: metadata.integrity
      } } }
    };
    const file = join(dir, 'packument.json');
    writeFileSync(file, JSON.stringify(packument));
    const result = spawnSync(process.execPath, [
      new URL('../../scripts/verify-published-version.mjs', import.meta.url).pathname,
      file, version
    ], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(metadata);
  });

  it('extracts immutable tagged release notes instead of a newer checkout changelog', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ann-recovery-changelog-'));
    dirs.push(dir);
    const file = join(dir, 'CHANGELOG.md');
    writeFileSync(file, '# Changelog\n\n## 0.6.2 - 2026-10-10\n\nExact tagged release notes.\n\n## 0.6.1 - 2026-10-09\n\nEarlier entry.\n');
    const result = spawnSync(process.execPath, [
      new URL('../../scripts/changelog-section.mjs', import.meta.url).pathname, tag, file
    ], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('Exact tagged release notes.');
  });

  it('keeps manual recovery notes-only, restricted and idempotent', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/recover-release-notes.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain("github.repository == 'Ponchia/bronto-annotations' && github.ref == 'refs/heads/main'");
    expect(workflow).toContain('git merge-base --is-ancestor');
    expect(workflow).toContain('npm audit signatures --json --include-attestations');
    expect(workflow).toContain('node scripts/verify-published-provenance.mjs');
    expect(workflow).toContain('gh release view');
    expect(workflow).toContain('gh release create');
    expect(workflow).toContain('--verify-tag');
    expect(workflow).not.toContain('npm publish --');
    expect(workflow).not.toContain('id-token: write');
    expect(workflow).not.toContain('secrets.NPM_TOKEN');
  });
});
