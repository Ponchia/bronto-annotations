import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPublishedTarballFile } from '../../scripts/verify-published-tarball.mjs';

const version = '0.6.2';
const tgz = gzipSync(Buffer.from('A small independent test archive for public npm release verification.'));
const integrity = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
const metadata = {
  name: '@ponchia/annotations',
  version,
  distTag: 'latest',
  integrity,
  tarball: `https://registry.npmjs.org/@ponchia/annotations/-/annotations-${version}.tgz`
};

const temporaryDirectories: string[] = [];
function archiveFile(bytes: Uint8Array = tgz): string {
  const dir = mkdtempSync(join(tmpdir(), 'annotations-public-tarball-'));
  temporaryDirectories.push(dir);
  const file = join(dir, 'downloaded.tgz');
  writeFileSync(file, bytes);
  return file;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('real npm tarball byte verification', () => {
  it('accepts downloaded gzip bytes only when their SHA-512 matches the packument', async () => {
    const proof = await verifyPublishedTarballFile(metadata, archiveFile());
    expect(proof).toEqual({
      name: metadata.name,
      version,
      bytes: tgz.byteLength,
      integrity,
      tarball: metadata.tarball,
      archiveVerified: true
    });
  });

  it('rejects a missing or not-yet-downloadable tarball file', async () => {
    await expect(verifyPublishedTarballFile(metadata, '/tmp/nonexistent-bronto-annotations-tarball.tgz'))
      .rejects.toThrow(/ENOENT/);
  });

  it('rejects corrupted bytes even when the CDN returns an intact gzip header', async () => {
    const altered = Buffer.from(tgz);
    altered[altered.length - 3] ^= 0x7f;
    await expect(verifyPublishedTarballFile(metadata, archiveFile(altered)))
      .rejects.toThrow('SHA-512 does not match');
  });

  it('rejects zero-length and non-gzip responses such as a CDN error body', async () => {
    await expect(verifyPublishedTarballFile(metadata, archiveFile(new Uint8Array(0))))
      .rejects.toThrow('has no bytes');
    await expect(verifyPublishedTarballFile(metadata, archiveFile(Buffer.from('{"error":"not found"}'))))
      .rejects.toThrow('not a gzip archive');
  });

  it('rejects mismatched versions, third-party origins and query-string manipulation', async () => {
    const file = archiveFile();
    await expect(verifyPublishedTarballFile({ ...metadata, version: '0.6.3' }, file))
      .rejects.toThrow('exact version');
    await expect(verifyPublishedTarballFile({ ...metadata,
      tarball: 'https://example.org/@ponchia/annotations/-/annotations-0.6.2.tgz' }, file))
      .rejects.toThrow('come from npm');
    await expect(verifyPublishedTarballFile({ ...metadata,
      tarball: `${metadata.tarball}?unsafe=1` }, file))
      .rejects.toThrow('query');
  });

  it('rejects malformed or incomplete digest values', async () => {
    const file = archiveFile();
    await expect(verifyPublishedTarballFile({ ...metadata, integrity: 'sha512-wrong!' }, file))
      .rejects.toThrow('SHA-512 package integrity');
    await expect(verifyPublishedTarballFile({ ...metadata, integrity: 'sha512-YWJjZA==' }, file))
      .rejects.toThrow('complete SHA-512 digest');
  });

  it('documents bounded, advisory observation without introducing a second publish action', () => {
    // This test is deliberately an offline contract: publishing and CDN
    // propagation are external effects, and we must never retry npm publish.
    const workflow = requireReleaseWorkflow();
    expect(workflow).toContain('continue-on-error: true');
    expect(workflow).toContain('node scripts/verify-published-tarball.mjs');
    expect(workflow).toContain('archive_verified=false');
    expect(workflow).toContain('Public npm archive was downloaded');
    expect(workflow).toContain('Do not republish the immutable version');
    expect(workflow.match(/npm publish --ignore-scripts/g)).toHaveLength(1);
  });
});

function requireReleaseWorkflow(): string {
  // Stay independent of package and source build state.
  return readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
}
