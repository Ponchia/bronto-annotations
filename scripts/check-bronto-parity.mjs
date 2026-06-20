import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { writeLine } from './log.mjs';

const parity = JSON.parse(await readFile(new URL('../docs/bronto-ui-annotation-parity.json', import.meta.url), 'utf8'));
const css = await readFile(new URL('../src/styles/bronto.css', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const core = await import('@ponchia/annotations');

assert.equal(parity.schemaVersion, 1, 'Bronto annotation parity schemaVersion must be 1');

for (const selector of [
  ...parity.legacySelectors,
  ...parity.packageSelectors,
  ...parity.packageExtensions
]) {
  assertIncludes(css, selector, 'src/styles/bronto.css');
}

for (const property of parity.customProperties) {
  assertIncludes(css, property, 'src/styles/bronto.css');
}

for (const mediaQuery of parity.mediaQueries) {
  assertIncludes(css, mediaQuery, 'src/styles/bronto.css');
}

for (const keyframe of parity.keyframes) {
  assertIncludes(css, `@keyframes ${keyframe}`, 'src/styles/bronto.css');
}

for (const helper of parity.helperExports) {
  assert.equal(typeof core[helper], 'function', `root export ${helper} must be a function`);
}

assert.equal(pkg.dependencies, undefined, '@ponchia/annotations must not gain runtime dependencies for Bronto parity');
assert.equal(pkg.devDependencies?.['@ponchia/ui'], undefined, '@ponchia/ui must not be required to test or build the annotation bridge');
assert.equal(pkg.peerDependencies?.['@ponchia/ui'], undefined, '@ponchia/ui must not be a peer dependency of the annotation bridge');
assert.ok(pkg.exports?.['./bronto.css'], 'package must export ./bronto.css');
assert.equal(pkg.sideEffects?.includes('./dist/bronto.css'), true, 'bronto.css must be marked as side-effectful');

writeLine(`Bronto annotation parity verified: ${parity.legacySelectors.length} legacy selectors, ${parity.packageSelectors.length} package selectors, ${parity.helperExports.length} helper exports.`);

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}
