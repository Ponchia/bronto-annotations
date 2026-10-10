/** Confirm published npm metadata, bypassing npm CLI's locally cached packument.
 * `npm publish` may succeed before the registry's public read replicas can
 * serve a new version. This verifier consumes a fresh registry HTTP response.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function verifyPublishedRegistry(metadata, version, distTag) {
  assert.match(version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'Expected a release version');
  assert.ok(['latest', 'next'].includes(distTag), 'Unexpected npm dist-tag');
  assert.equal(metadata?.name, '@ponchia/annotations', 'Registry response must describe the expected package');
  assert.equal(metadata?.['dist-tags']?.[distTag], version, `${distTag} has not propagated to ${version}`);

  const published = metadata?.versions?.[version];
  assert.equal(published?.version, version, `Package version ${version} is not yet visible`);
  assert.equal(published?.name, '@ponchia/annotations');
  assert.match(published?.dist?.integrity ?? '', /^sha512-\S+$/, 'Missing published package integrity');
  assert.ok(
    published.dist.tarball.startsWith('https://registry.npmjs.org/@ponchia/annotations/-/'),
    'Unexpected published tarball origin'
  );

  return {
    name: published.name,
    version,
    distTag,
    integrity: published.dist.integrity,
    tarball: published.dist.tarball
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, version, distTag] = process.argv.slice(2);
  assert.ok(file && version && distTag, 'Usage: verify-published-registry.mjs <packument.json> <version> <dist-tag>');
  const packument = JSON.parse(await readFile(file, 'utf8'));
  console.log(JSON.stringify(verifyPublishedRegistry(packument, version, distTag), null, 2));
}
