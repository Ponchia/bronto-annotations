/** Verify an exact immutable public npm package, regardless of dist-tag drift.
 * Used only for the manual release-notes repair path: a newer release may
 * have changed latest/next, but the older signed version remains immutable.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { verifyPublishedVersion } from './verify-published-registry.mjs';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, version] = process.argv.slice(2);
  assert.ok(file && version, 'Usage: verify-published-version.mjs <packument.json> <version>');
  const packument = JSON.parse(await readFile(file, 'utf8'));
  console.log(JSON.stringify(verifyPublishedVersion(packument, version), null, 2));
}
