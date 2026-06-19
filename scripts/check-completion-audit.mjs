import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const audit = JSON.parse(await readFile(new URL('../docs/completion-audit.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const readiness = JSON.parse(await readFile(new URL('../docs/readiness-matrix.json', import.meta.url), 'utf8'));
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const e2ePlan = await readFile(new URL('../docs/e2e-plan.md', import.meta.url), 'utf8');
const recipes = await readFile(new URL('../docs/integration-recipes.md', import.meta.url), 'utf8');
const quickstart = await readFile(new URL('../docs/context-quickstart.md', import.meta.url), 'utf8');
const migrationGuide = await readFile(new URL('../docs/migration-guide.md', import.meta.url), 'utf8');

const requiredRequirementIds = [
  'typescript-esm-scaffold',
  'dom-free-core-engine',
  'root-import-purity',
  'svg-renderer',
  'react-adapter',
  'dom-svg-utilities',
  'generated-surface-adapters',
  'generated-placement-quality',
  'bronto-css-and-styling',
  'susie-lu-d3-style-ergonomics',
  'examples-coverage',
  'packed-consumer-and-browser-verification',
  'public-hygiene',
  'docs-api-boundaries-and-known-limits',
  'repo-operations-readiness',
  'pre-release-hardening',
  'product-boundaries'
];

assert.equal(audit.schemaVersion, 1, 'completion audit schemaVersion must be 1');
assert.equal(audit.status, 'usable-public-package-with-known-limits');
assert.ok(Array.isArray(audit.requirements), 'completion audit must list requirements');
assert.deepEqual(
  [...audit.requirements.map((requirement) => requirement.id)].sort(),
  [...requiredRequirementIds].sort(),
  'completion audit must cover the requested scope requirement set'
);

for (const script of audit.requiredScripts) {
  assert.ok(pkg.scripts?.[script], `package.json is missing script ${script}`);

  if (script !== 'check') {
    assert.ok(pkg.scripts.check.includes(`npm run ${script}`), `npm run check does not include ${script}`);
  }
}

assert.equal(pkg.dependencies, undefined, 'runtime dependencies must stay absent');
assert.equal(pkg.devDependencies?.['@ponchia/ui'], undefined, '@ponchia/ui must not be a dev dependency');
assert.ok(pkg.files?.includes('docs'), 'published package must include docs');
assert.ok(readiness.requiredScripts.includes('test:completion-audit'), 'readiness matrix must include test:completion-audit');
assert.ok(readme.includes('docs/completion-audit.json'), 'README must mention the completion audit');
assert.ok(e2ePlan.toLowerCase().includes('completion audit'), 'e2e plan must mention the completion audit');
assert.ok(recipes.includes('## First-Use Checklist'), 'integration recipes must include the first-use checklist');
assert.ok(quickstart.includes('## Choose The Adapter'), 'context quickstart must include the adapter chooser');
assert.ok(migrationGuide.includes('## From d3-annotation'), 'migration guide must include d3 migration');
assert.ok(migrationGuide.includes('## From Bronto UI Annotations'), 'migration guide must include Bronto migration');

for (const requirement of audit.requirements) {
  assert.equal(requirement.status, 'proven', `${requirement.id} must be proven`);
  assert.equal(typeof requirement.claim, 'string', `${requirement.id} must include a claim`);
  assert.notEqual(requirement.claim.trim(), '', `${requirement.id} claim must not be empty`);
  assert.ok(Array.isArray(requirement.evidence), `${requirement.id} must include evidence`);
  assert.ok(requirement.evidence.length >= 2, `${requirement.id} must include at least two evidence entries`);

  for (const evidence of requirement.evidence) {
    await assertPath(evidence.file);
    const evidenceText = await readFile(pathUrl(evidence.file), 'utf8');

    for (const term of evidence.terms) {
      assert.ok(
        evidenceText.includes(term),
        `${requirement.id} evidence ${evidence.file} must include ${JSON.stringify(term)}`
      );
    }
  }
}

assert.ok(readme.includes('## Known Limits'), 'README must document known limits');
assert.ok(e2ePlan.includes('## Known Limits'), 'e2e plan must document known limits');
assert.ok(e2ePlan.includes('It does not create chart'), 'product boundary must remain documented');
assert.ok(e2ePlan.includes('parse Mermaid source or own diagram layout'), 'Mermaid parser boundary must remain documented');
assert.ok(e2ePlan.includes('It does not parse D2'), 'D2 parser boundary must remain documented');
assert.ok(e2ePlan.includes('It does not own graph'), 'React Flow graph-state boundary must remain documented');

console.log(`Completion audit verified: ${audit.requirements.length} requirement groups with direct evidence.`);

async function assertPath(relativePath) {
  try {
    await access(pathUrl(relativePath));
  } catch {
    throw new Error(`Expected completion-audit evidence path to exist: ${relativePath}`);
  }
}

function pathUrl(relativePath) {
  return new URL(`../${relativePath}`, import.meta.url);
}
