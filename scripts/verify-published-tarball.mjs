/** Verify publicly retrievable npm tarball bytes against a *verified* packument.
 *
 * Registry metadata/dist-tags can become visible before their immutable
 * tarball is available to a fresh consumer. The input metadata must be the
 * validated output of verify-published-registry.mjs; this check never uploads
 * or publishes anything. It reads the actual downloaded gzip archive, bounds
 * the byte count, and compares SHA-512 rather than trusting an HTTP 200 alone.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MAX_TARBALL_BYTES = 32 * 1024 * 1024;

export async function verifyPublishedTarballFile(metadata, archiveFile) {
  assert.equal(metadata?.name, '@ponchia/annotations', 'Unexpected npm package name');
  assert.match(metadata?.version ?? '', /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Invalid published version');
  assert.match(metadata?.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/, 'Missing SHA-512 package integrity');
  const expectedHash = Buffer.from(metadata.integrity.slice('sha512-'.length), 'base64');
  assert.equal(expectedHash.length, 64, 'Expected a complete SHA-512 digest');

  const url = new URL(metadata?.tarball ?? '');
  assert.equal(url.protocol, 'https:', 'Published tarball must use HTTPS');
  assert.equal(url.hostname, 'registry.npmjs.org', 'Published tarball must come from npm');
  assert.equal(url.pathname, `/@ponchia/annotations/-/annotations-${metadata.version}.tgz`,
    'Published tarball must match the exact version');
  assert.equal(url.search, '', 'Published tarball URL must not contain a query');
  assert.equal(url.hash, '', 'Published tarball URL must not contain a fragment');

  const digest = createHash('sha512');
  let bytes = 0;
  let header = Buffer.alloc(0);
  for await (const chunk of createReadStream(archiveFile)) {
    bytes += chunk.length;
    assert.ok(bytes <= MAX_TARBALL_BYTES, 'Published tarball exceeds the allowed byte limit');
    if (header.length < 2) header = Buffer.concat([header, chunk.subarray(0, 2 - header.length)]);
    digest.update(chunk);
  }
  assert.ok(bytes > 0, 'Published tarball has no bytes');
  assert.ok(header[0] === 0x1f && header[1] === 0x8b, 'Published tarball is not a gzip archive');
  const actualIntegrity = `sha512-${digest.digest('base64')}`;
  assert.equal(actualIntegrity, metadata.integrity, 'Published tarball SHA-512 does not match registry metadata');

  return {
    name: metadata.name,
    version: metadata.version,
    bytes,
    integrity: actualIntegrity,
    tarball: metadata.tarball,
    archiveVerified: true
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [confirmedMetadataFile, archiveFile] = process.argv.slice(2);
  assert.ok(confirmedMetadataFile && archiveFile,
    'Usage: verify-published-tarball.mjs <verified-metadata.json> <downloaded-tarball.tgz>');
  const metadata = JSON.parse(await readFile(confirmedMetadataFile, 'utf8'));
  console.log(JSON.stringify(await verifyPublishedTarballFile(metadata, archiveFile), null, 2));
}
