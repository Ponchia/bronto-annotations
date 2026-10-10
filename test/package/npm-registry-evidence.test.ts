import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const verifier = fileURLToPath(new URL('../../scripts/verify-npm-registry.mjs', import.meta.url));
const version = '0.4.1';
const registryView = {
  version,
  dist: {
    integrity: 'sha512-ZG9jdW1lbnRhdGlvbi1pbnRlZ3JpdHk=',
    tarball: `https://registry.npmjs.org/@ponchia/annotations/-/annotations-${version}.tgz`
  }
};
const tags = { latest: version, next: '0.5.0-preview.1' };

function verify(metadata: unknown, distTags: unknown, expected = version, tag = 'latest') {
  const dir = mkdtempSync(join(tmpdir(), 'annotations-npm-verify-'));
  try {
    const viewPath = join(dir, 'metadata.json');
    const tagsPath = join(dir, 'tags.json');
    writeFileSync(viewPath, JSON.stringify(metadata));
    writeFileSync(tagsPath, JSON.stringify(distTags));
    return spawnSync(process.execPath, [verifier, viewPath, tagsPath, expected, tag], {
      encoding: 'utf8'
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('npm publication evidence gate', () => {
  it('accepts a visible exact package version, tarball integrity and expected tag', () => {
    const result = verify(registryView, tags);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      published: { version, integrity: registryView.dist.integrity, tarball: registryView.dist.tarball },
      distTags: { latest: version }
    });
  });

  it('fails when the registry still exposes the previous version', () => {
    const result = verify({ ...registryView, version: '0.4.0' }, tags);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('expected exact version');
  });

  it('fails when npm has not propagated the intended latest tag', () => {
    const result = verify(registryView, { latest: '0.4.0' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does not yet target');
  });

  it('fails for an unsigned or missing-integrity tarball', () => {
    const result = verify({ ...registryView, dist: { ...registryView.dist, integrity: '' } }, tags);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('SHA-512 integrity');
  });

  it('fails when tarball URL does not correspond to the tagged version', () => {
    const result = verify({ ...registryView, dist: {
      ...registryView.dist,
      tarball: 'https://registry.npmjs.org/@ponchia/annotations/-/annotations-0.4.0.tgz'
    } }, tags);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('tarball version');
  });

  it('rejects misleading third-party tarball hosts', () => {
    const result = verify({ ...registryView, dist: {
      ...registryView.dist,
      tarball: 'https://example.com/annotations-0.4.1.tgz'
    } }, tags);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('from npm');
  });

  it('requires next for a prerelease, without changing latest', () => {
    const prerelease = '0.5.0-preview.1';
    const view = {
      version: prerelease,
      dist: {
        integrity: registryView.dist.integrity,
        tarball: `https://registry.npmjs.org/@ponchia/annotations/-/annotations-${prerelease}.tgz`
      }
    };
    const result = verify(view, tags, prerelease, 'next');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).distTags).toEqual({ next: prerelease });
  });

  it('keeps the release workflow gated on public registry confirmation', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('Verify published package on npm');
    expect(workflow).toContain('node scripts/verify-npm-registry.mjs');
    expect(workflow).not.toContain('continue-on-error: true');
    expect(workflow).toContain('needs: publish-npm');
  });
});
