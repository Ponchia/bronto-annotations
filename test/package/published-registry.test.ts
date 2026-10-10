import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const verifier = fileURLToPath(new URL('../../scripts/verify-published-registry.mjs', import.meta.url));
const version = '0.4.1';
const tarball = `https://registry.npmjs.org/@ponchia/annotations/-/annotations-${version}.tgz`;
const integrity = 'sha512-ZG9jdW1lbnRhdGlvbi1pbnRlZ3JpdHk=';
const metadata = {
  name: '@ponchia/annotations',
  'dist-tags': { latest: version, next: '0.5.0-rc.1' },
  versions: {
    [version]: { name: '@ponchia/annotations', version, dist: { integrity, tarball } }
  }
};

function verify(packument: unknown, expectedVersion = version, expectedTag = 'latest') {
  const dir = mkdtempSync(join(tmpdir(), 'annotations-registry-'));
  try {
    const file = join(dir, 'metadata.json');
    writeFileSync(file, JSON.stringify(packument));
    return spawnSync(process.execPath, [verifier, file, expectedVersion, expectedTag], {
      encoding: 'utf8'
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('fresh npm registry publication verification', () => {
  it('accepts exact published metadata and latest dist-tag', () => {
    const result = verify(metadata);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      name: '@ponchia/annotations', version, distTag: 'latest', integrity, tarball
    });
  });

  it('rejects stale latest tags', () => {
    expect(verify({ ...metadata, 'dist-tags': { latest: '0.4.0' } }).stderr)
      .toContain('has not propagated');
  });

  it('rejects missing exact versions', () => {
    expect(verify({ ...metadata, versions: {} }).stderr)
      .toContain('not yet visible');
  });

  it('rejects absent or invalid integrity', () => {
    const invalid = { ...metadata, versions: {
      [version]: { name: metadata.name, version, dist: { integrity: '', tarball } }
    } };
    expect(verify(invalid).stderr).toContain('SHA-512');
  });

  it('rejects a tarball for a different published version', () => {
    const wrong = { ...metadata, versions: {
      [version]: { name: metadata.name, version, dist: {
        integrity,
        tarball: 'https://registry.npmjs.org/@ponchia/annotations/-/annotations-0.4.0.tgz'
      } }
    } };
    expect(verify(wrong).stderr).toContain('exact version');
  });

  it('rejects a third-party tarball origin', () => {
    const wrong = { ...metadata, versions: {
      [version]: { name: metadata.name, version, dist: {
        integrity, tarball: 'https://example.com/@ponchia/annotations/-/annotations-0.4.1.tgz'
      } }
    } };
    expect(verify(wrong).stderr).toContain('come from npm');
  });

  it('verifies next for prereleases without modifying latest', () => {
    const preview = '0.5.0-rc.1';
    const obj = { ...metadata, versions: {
      ...metadata.versions,
      [preview]: { name: metadata.name, version: preview, dist: {
        integrity,
        tarball: `https://registry.npmjs.org/@ponchia/annotations/-/annotations-${preview}.tgz`
      } }
    } };
    expect(JSON.parse(verify(obj, preview, 'next').stdout).distTag).toBe('next');
    expect(verify(obj, preview, 'latest').stderr).toContain('has not propagated');
  });

  it('keeps registry observation nonpublishing and recovery-safe', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('Record npm registry state');
    expect(workflow).toContain('continue-on-error: true');
    expect(workflow).toContain('Cache-Control: no-cache');
    expect(workflow).toContain('node scripts/verify-published-registry.mjs');
    expect(workflow).toContain('needs: publish-npm');
    expect(workflow).toContain('Do not republish the immutable version');
  });
});
