/**
 * Validates post-publish evidence from npm's public registry. A successful
 * `npm publish` response alone does not imply immediate registry visibility.
 * Called by the release workflow after each bounded polling attempt.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyNpmPublication(metadata, distTags, expectedVersion, expectedTag) {
  assert.match(expectedVersion, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
    'Expected version must be a valid release version');
  assert.ok(['latest', 'next'].includes(expectedTag), 'Unexpected npm dist-tag');
  assert.equal(metadata?.version, expectedVersion,
    'npm registry has not exposed the expected exact version');
  assert.match(metadata?.dist?.integrity ?? '', /^sha512-[A-Za-z0-9+/=]+$/,
    'Exact published version must have a SHA-512 integrity digest');
  const tarball = metadata?.dist?.tarball;
  assert.equal(typeof tarball, 'string', 'Published tarball URL is missing');
  const url = new URL(tarball);
  assert.equal(url.protocol, 'https:', 'Published tarball must use HTTPS');
  assert.equal(url.hostname, 'registry.npmjs.org', 'Published tarball must come from npm');
  assert.ok(url.pathname.endsWith(`/annotations-${expectedVersion}.tgz`),
    'Published tarball version must match the release tag');
  assert.equal(distTags?.[expectedTag], expectedVersion,
    `npm dist-tag "${expectedTag}" does not yet target ${expectedVersion}`);

  return {
    published: { version: metadata.version, integrity: metadata.dist.integrity, tarball },
    distTags: { [expectedTag]: expectedVersion }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [metadataPath, tagsPath, version, tag] = process.argv.slice(2);
  assert.ok(metadataPath && tagsPath && version && tag,
    'usage: node scripts/verify-npm-registry.mjs <view.json> <tags.json> <version> <latest|next>');
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const tags = JSON.parse(readFileSync(tagsPath, 'utf8'));
  console.log(JSON.stringify(verifyNpmPublication(metadata, tags, version, tag), null, 2));
}
