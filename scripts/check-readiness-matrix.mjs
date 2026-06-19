import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const matrix = JSON.parse(await readFile(new URL('../docs/readiness-matrix.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const browserScript = await readFile(new URL('../scripts/verify-examples-browser.mjs', import.meta.url), 'utf8');
const packedScript = await readFile(new URL('../scripts/smoke-packed-consumer.mjs', import.meta.url), 'utf8');
const exportScript = await readFile(new URL('../scripts/check-package-exports.mjs', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const e2ePlan = await readFile(new URL('../docs/e2e-plan.md', import.meta.url), 'utf8');
const integrationRecipes = await readFile(new URL('../docs/integration-recipes.md', import.meta.url), 'utf8');
const docsText = `${readme}\n${e2ePlan}\n${integrationRecipes}`;

assert.equal(matrix.schemaVersion, 1, 'readiness matrix schemaVersion must be 1');
assert.equal(matrix.status, 'usable-public-package-with-known-limits');
assert.ok(Array.isArray(matrix.publicExports) && matrix.publicExports.length > 0, 'readiness matrix must list public exports');
assert.ok(Array.isArray(matrix.contexts) && matrix.contexts.length > 0, 'readiness matrix must list contexts');
assert.ok(Array.isArray(matrix.capabilities) && matrix.capabilities.length > 0, 'readiness matrix must list capabilities');

for (const script of matrix.requiredScripts) {
  assert.ok(pkg.scripts?.[script], `package.json is missing script ${script}`);

  if (script !== 'check') {
    assert.ok(pkg.scripts.check.includes(`npm run ${script}`), `npm run check does not include ${script}`);
  }
}

assert.ok(pkg.files?.includes('docs'), 'published package must include docs');
assert.ok(pkg.files?.includes('README.md'), 'published package must include README.md');
assert.equal(pkg.sideEffects?.includes('./dist/bronto.css'), true, 'CSS export must be marked side-effectful');

for (const publicExport of matrix.publicExports) {
  assertUniqueId(publicExport.subpath, 'public export');
  const exportEntry = pkg.exports?.[publicExport.subpath];
  assert.ok(exportEntry, `package.json exports is missing ${publicExport.subpath}`);
  await assertPath(publicExport.source);
  await assertPath(publicExport.declaration);

  if (typeof exportEntry === 'string') {
    assert.equal(exportEntry, `./${publicExport.declaration}`, `${publicExport.subpath} must point at ${publicExport.declaration}`);
  } else {
    assert.equal(exportEntry.types, `./${publicExport.declaration}`, `${publicExport.subpath} must expose declaration ${publicExport.declaration}`);
  }

  const sourceText = await readFile(pathUrl(publicExport.source), 'utf8');
  for (const term of publicExport.terms) {
    assertIncludes(sourceText, term, publicExport.source);
  }

  assertIncludes(exportScript, publicExport.declaration, 'scripts/check-package-exports.mjs');
}

for (const peer of matrix.optionalPeers) {
  assert.ok(pkg.peerDependencies?.[peer], `peer dependency ${peer} is missing`);
  assert.equal(pkg.peerDependenciesMeta?.[peer]?.optional, true, `peer dependency ${peer} must be optional`);
}

assert.equal(pkg.dependencies, undefined, 'runtime dependencies must stay absent unless intentionally added');
assert.equal(pkg.devDependencies?.['@ponchia/ui'], undefined, '@ponchia/ui must not be a dev dependency');

const contextIds = new Set();
for (const context of matrix.contexts) {
  assertUniqueId(context.id, 'context');
  assert.equal(contextIds.has(context.id), false, `duplicate context id ${context.id}`);
  contextIds.add(context.id);

  const exportEntry = pkg.exports?.[context.subpath];
  assert.ok(exportEntry, `context ${context.id} references missing export ${context.subpath}`);
  await assertPath(context.example);
  await assertPath(join(context.example, 'index.html'));
  await assertPath(join(context.example, 'styles.css'));
  const mainFile = await exampleMainFile(context.example);
  const mainText = await readFile(pathUrl(mainFile), 'utf8');

  for (const requiredImport of context.requiredImports) {
    assertIncludes(mainText, requiredImport, mainFile);
  }

  for (const source of context.source) {
    await assertPath(source);
  }

  for (const test of context.tests) {
    await assertPath(test);
  }

  for (const term of context.browserTerms) {
    assertIncludes(browserScript, term, 'scripts/verify-examples-browser.mjs');
  }

  for (const term of context.packedTerms) {
    assertIncludes(packedScript, term, 'scripts/smoke-packed-consumer.mjs');
  }

  for (const term of context.docsTerms) {
    assertIncludes(docsText, term, 'README.md/docs/e2e-plan.md');
  }
}

for (const capability of matrix.capabilities) {
  assertUniqueId(capability.id, 'capability');

  for (const evidence of capability.evidence) {
    await assertPath(evidence.file);
    const evidenceText = await readFile(pathUrl(evidence.file), 'utf8');

    for (const term of evidence.terms) {
      assertIncludes(evidenceText, term, evidence.file);
    }
  }
}

for (const boundaryTerm of matrix.boundaryTerms) {
  assertIncludes(e2ePlan, boundaryTerm, 'docs/e2e-plan.md');
}

assertIncludes(readme, '## Known Limits', 'README.md');
assertIncludes(e2ePlan, '## Verification Gates', 'docs/e2e-plan.md');
assertIncludes(e2ePlan, 'Readiness matrix', 'docs/e2e-plan.md');
assertIncludes(integrationRecipes, '## First-Use Checklist', 'docs/integration-recipes.md');

console.log(`Readiness matrix verified: ${matrix.publicExports.length} exports, ${matrix.contexts.length} contexts, ${matrix.capabilities.length} capability groups.`);

function assertUniqueId(value, label) {
  assert.equal(typeof value, 'string', `${label} id must be a string`);
  assert.notEqual(value.trim(), '', `${label} id must not be empty`);
}

async function assertPath(relativePath) {
  try {
    await access(pathUrl(relativePath));
  } catch {
    throw new Error(`Expected readiness evidence path to exist: ${relativePath}`);
  }
}

async function exampleMainFile(exampleDir) {
  const ts = join(exampleDir, 'main.ts');
  const tsx = join(exampleDir, 'main.tsx');

  try {
    await assertPath(ts);
    return ts;
  } catch (error) {
    if (!String(error.message).includes('Expected readiness evidence path')) {
      throw error;
    }
  }

  await assertPath(tsx);
  return tsx;
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}

function pathUrl(relativePath) {
  return new URL(`../${relativePath}`, import.meta.url);
}
