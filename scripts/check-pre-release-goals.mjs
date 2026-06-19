import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const readme = await read('README.md');
const roadmap = await read('docs/pre-release-roadmap.md');
const apiStability = await read('docs/api-stability.md');
const apiStabilityManifest = JSON.parse(await read('docs/api-stability.manifest.json'));
const compatibility = await read('docs/compatibility.md');
const releaseDecisions = await read('docs/public-release-decisions.md');
const dogfood = await read('docs/dogfood-friction-report.md');
const dogfoodCleanConsumer = await read('docs/dogfood-clean-consumer-report.md');
const dogfoodBrontoReport = await read('docs/dogfood-bronto-report.md');
const dogfoodSelfReport = await read('docs/dogfood-self-report.md');
const dogfoodExternalReport = await read('docs/dogfood-external-consumer-report.md');
const visual = await read('docs/visual-regression.md');
const performanceDocs = await read('docs/performance.md');
const accessibility = await read('docs/accessibility.md');
const adapterRecipes = await read('docs/adapter-recipes-roadmap.md');
const adapterRecipesProof = await read('docs/adapter-recipes-proof.md');
const benchmark = await read('scripts/benchmark-layout.mjs');
const apiStabilityCheck = await read('scripts/check-api-stability.mjs');
const compatibilityCheck = await read('scripts/check-compatibility-matrix.mjs');
const compatibilityLaneSmoke = await read('scripts/smoke-compatibility-lanes.mjs');
const canaryDocs = await read('docs/canary-release.md');
const canaryPublishReport = await read('docs/canary-publish-report.md');
const canaryCheck = await read('scripts/check-canary-readiness.mjs');
const canaryWorkflow = await read('.github/workflows/canary.yml');
const dogfoodScript = await read('scripts/dogfood-clean-consumer.mjs');
const dogfoodBrontoScript = await read('scripts/dogfood-bronto-report.mjs');
const dogfoodSelfScript = await read('scripts/dogfood-self-report.mjs');
const dogfoodExternalScript = await read('scripts/dogfood-external-consumer.mjs');
const screenshotCheck = await read('scripts/check-browser-screenshots.mjs');
const visualBaseline = JSON.parse(await read('test/visual-baselines/browser-screenshots.json'));

for (const path of [
  'docs/pre-release-roadmap.md',
  'docs/api-stability.md',
  'docs/api-stability.manifest.json',
  'docs/compatibility.md',
  'docs/public-release-decisions.md',
  'docs/dogfood-friction-report.md',
  'docs/dogfood-clean-consumer-report.md',
  'docs/dogfood-bronto-report.md',
  'docs/dogfood-self-report.md',
  'docs/dogfood-external-consumer-report.md',
  'docs/visual-regression.md',
  'docs/performance.md',
  'docs/accessibility.md',
  'docs/adapter-recipes-roadmap.md',
  'docs/adapter-recipes-proof.md',
  'docs/canary-release.md',
  'docs/canary-publish-report.md',
  '.github/workflows/canary.yml',
  'scripts/check-api-stability.mjs',
  'scripts/check-compatibility-matrix.mjs',
  'scripts/smoke-compatibility-lanes.mjs',
  'scripts/check-canary-readiness.mjs',
  'scripts/benchmark-layout.mjs',
  'scripts/dogfood-clean-consumer.mjs',
  'scripts/dogfood-bronto-report.mjs',
  'scripts/dogfood-self-report.mjs',
  'scripts/dogfood-external-consumer.mjs',
  'test/visual-baselines/browser-screenshots.json'
]) {
  await assertPath(path);
}

assert.equal(pkg.scripts?.['test:pre-release'], 'node scripts/check-pre-release-goals.mjs');
assert.equal(pkg.scripts?.['test:api-stability'], 'node scripts/check-api-stability.mjs');
assert.equal(pkg.scripts?.['test:canary'], 'node scripts/check-canary-readiness.mjs');
assert.equal(pkg.scripts?.['test:dogfood'], 'npm run build && node scripts/dogfood-clean-consumer.mjs');
assert.equal(pkg.scripts?.['test:dogfood:bronto-report'], 'npm run build && node scripts/dogfood-bronto-report.mjs');
assert.equal(pkg.scripts?.['test:dogfood:self-report'], 'npm run build && node scripts/dogfood-self-report.mjs');
assert.equal(pkg.scripts?.['test:dogfood:external'], 'npm run build && node scripts/dogfood-external-consumer.mjs');
assert.equal(pkg.scripts?.['test:compatibility'], 'node scripts/check-compatibility-matrix.mjs');
assert.equal(pkg.scripts?.['test:compatibility:lanes'], 'npm run build && node scripts/smoke-compatibility-lanes.mjs');
assert.equal(pkg.scripts?.['test:performance'], 'npm run build && node scripts/benchmark-layout.mjs --assert');
assert.ok(pkg.scripts?.check?.includes('npm run test:pre-release'), 'npm run check must include test:pre-release');
assert.ok(pkg.scripts?.check?.includes('npm run test:api-stability'), 'npm run check must include test:api-stability');
assert.ok(pkg.scripts?.check?.includes('npm run test:canary'), 'npm run check must include test:canary');
assert.ok(pkg.scripts?.check?.includes('npm run test:dogfood'), 'npm run check must include test:dogfood');
assert.ok(pkg.scripts?.check?.includes('npm run test:dogfood:bronto-report'), 'npm run check must include test:dogfood:bronto-report');
assert.ok(pkg.scripts?.check?.includes('npm run test:dogfood:self-report'), 'npm run check must include test:dogfood:self-report');
assert.ok(pkg.scripts?.check?.includes('npm run test:dogfood:external'), 'npm run check must include test:dogfood:external');
assert.ok(pkg.scripts?.check?.includes('npm run test:compatibility'), 'npm run check must include test:compatibility');
assert.ok(pkg.scripts?.check?.includes('npm run test:compatibility:lanes'), 'npm run check must include test:compatibility:lanes');
assert.ok(pkg.scripts?.check?.includes('npm run test:performance'), 'npm run check must include test:performance');

for (const term of [
  'Dogfood in a real consumer',
  'Freeze the `0.1.x` public API contract',
  'Publish a private/canary package',
  'docs/canary-publish-report.md',
  'docs/public-release-decisions.md',
  'docs/dogfood-bronto-report.md',
  'docs/dogfood-self-report.md',
  'docs/dogfood-external-consumer-report.md',
  'createAnnotationEditEvent',
  'createAnnotationEditDelta',
  'visual regression baselines',
  'Performance',
  'Accessibility',
  'Compatibility matrix',
  'public package/repository naming'
]) {
  assertIncludes(roadmap, term, 'docs/pre-release-roadmap.md');
}

for (const term of [
  'Public Release Decisions',
  'Package Name',
  'Ownership',
  'Repository Name And Visibility',
  'Npm Access And Provenance',
  'README Positioning',
  'Examples Hosting',
  '@ponchia/annotations',
  'Ponchia/bronto-annotations',
  'publishConfig.access',
  'No separate hosted examples site is required before `0.1.0`'
]) {
  assertIncludes(releaseDecisions, term, 'docs/public-release-decisions.md');
}

for (const term of [
  'Stable for `0.1.x`',
  'Experimental',
  'Root imports must remain DOM-free',
  'docs/api-stability.manifest.json',
  '@public',
  '@experimental',
  'createAnnotationEditEvent',
  'createAnnotationEditDelta',
  'npm run test:api-stability'
]) {
  assertIncludes(apiStability, term, 'docs/api-stability.md');
}

assert.equal(apiStabilityManifest.schemaVersion, 1, 'API stability manifest schemaVersion must be 1');
assert.equal(apiStabilityManifest.policy, '0.1.x', 'API stability manifest policy must be 0.1.x');
assert.equal(Object.keys(apiStabilityManifest.subpaths).length, 8, 'API stability manifest must cover all public subpaths');

for (const term of [
  'API stability verified',
  'docs/api-stability.manifest.json',
  '@public',
  '@experimental',
  'collectPublicExports'
]) {
  assertIncludes(apiStabilityCheck, term, 'scripts/check-api-stability.mjs');
}

for (const term of [
  'GitHub Packages Canary',
  'gh workflow run canary.yml -f publish=true',
  'docs/canary-publish-report.md',
  'clean registry consumer',
  'npm run test:canary'
]) {
  assertIncludes(canaryDocs, term, 'docs/canary-release.md');
}

for (const term of [
  'Canary Publish Report',
  'Workflow run: `27827132524`',
  '0.1.0-canary.1.e754177',
  'Publish GitHub Packages canary`: success',
  'Smoke registry consumer`: success',
  'Registry consumer smoke verified',
  '@ponchia/annotations@0.1.0-canary.1.e754177'
]) {
  assertIncludes(canaryPublishReport, term, 'docs/canary-publish-report.md');
}

for (const term of [
  'Canary readiness verified',
  'prepare-github-canary',
  'smoke-registry-consumer',
  'npm.pkg.github.com'
]) {
  assertIncludes(canaryCheck, term, 'scripts/check-canary-readiness.mjs');
}

for (const term of [
  'workflow_dispatch:',
  'packages: write',
  'npm publish --tag canary --registry https://npm.pkg.github.com',
  'node scripts/smoke-registry-consumer.mjs'
]) {
  assertIncludes(canaryWorkflow, term, '.github/workflows/canary.yml');
}

for (const term of [
  'Node.js',
  'TypeScript',
  'npm run test:compatibility',
  'npm run test:compatibility:lanes',
  'React 18',
  'React 18 clean consumer',
  'React 19',
  'React',
  'Vega',
  'Vega 5',
  'Vega 5 clean consumer',
  'Vega 6',
  'Mermaid',
  'D2',
  'React Flow',
  'optional peers'
]) {
  assertIncludes(compatibility, term, 'docs/compatibility.md');
}

for (const term of [
  'Compatibility matrix verified',
  'expectedPeers',
  'peerDependenciesMeta',
  'clean root consumer unexpectedly installed optional peers',
  'Node 20',
  'Node 22'
]) {
  assertIncludes(compatibilityCheck, term, 'scripts/check-compatibility-matrix.mjs');
}

for (const term of [
  'Compatibility lane smoke verified',
  'React 18 clean consumer',
  'Vega 5 clean consumer',
  'react@18.2.0',
  'vega@5',
  'prepareVegaScenegraphAnnotations'
]) {
  assertIncludes(compatibilityLaneSmoke, term, 'scripts/smoke-compatibility-lanes.mjs');
}

for (const term of [
  'Dogfood Friction Report Template',
  'Coordinate space',
  'Generated geometry timing',
  'Would ship with this API today'
]) {
  assertIncludes(dogfood, term, 'docs/dogfood-friction-report.md');
}

for (const term of [
  'Dogfood Clean Consumer Report',
  'clean Vite report',
  'Vega-Lite generated chart',
  'Mermaid generated diagram',
  'npm run test:dogfood',
  'Would ship with this API today: yes',
  'external note list',
  'screen-reader summary',
  'Coordinate space',
  'Generated geometry timing'
]) {
  assertIncludes(dogfoodCleanConsumer, term, 'docs/dogfood-clean-consumer-report.md');
}

for (const term of [
  'Dogfood Bronto Report',
  'public `@ponchia/ui` report CSS',
  'report stat cards',
  'SVG report chart',
  'report table row',
  'mixed DOM/SVG report figure',
  'mixedCoordinateSpaces',
  'npm run test:dogfood:bronto-report',
  'Would ship with this API today: yes',
  'Manual coordinates are top-left note coordinates',
  'createAnnotationEditEvent',
  'createAnnotationEditDelta'
]) {
  assertIncludes(dogfoodBrontoReport, term, 'docs/dogfood-bronto-report.md');
}

for (const term of [
  'Dogfood Self Report',
  'docs/readiness-matrix.json',
  'docs/completion-audit.json',
  'generated SVG readiness chart',
  'generated SVG release-flow diagram',
  'npm run test:dogfood:self-report',
  'Would ship with this API today: yes',
  'dogfood-self-report.png'
]) {
  assertIncludes(dogfoodSelfReport, term, 'docs/dogfood-self-report.md');
}

for (const term of [
  'Dogfood External Consumer Report',
  'external Astro/React writing site',
  'rendered DOM stack diagram',
  'npm run test:dogfood:external',
  'PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_ROOT',
  'Target-alignment checks used: yes',
  'Layout-quality checks used: yes',
  'Would ship with this API today: yes',
  'dogfood-external-consumer.png',
  'dogfood-external-consumer.json'
]) {
  assertIncludes(dogfoodExternalReport, term, 'docs/dogfood-external-consumer-report.md');
}

for (const term of [
  'Dogfood clean consumer verified',
  'packed tarball clean consumer',
  'prepareVegaScenegraphAnnotations',
  'prepareMermaidAnnotations',
  'prepareDomAnnotations',
  'compiledFromVegaLite',
  'setupExternalNoteList',
  'screenReaderSummary',
  'rovingFocus',
  '.tmp-dogfood/dogfood-report.png'
]) {
  assertIncludes(dogfoodScript, term, 'scripts/dogfood-clean-consumer.mjs');
}

for (const term of [
  'Bronto report dogfood verified',
  'public @ponchia/ui static report grammar',
  '@ponchia/ui@0.6.8',
  'prepareDomAnnotations',
  'annotationFrameFromSvg',
  'dogfood-bronto-report.png',
  'mixedCoordinateSpaces',
  'Manual placement uses report-surface pixels'
]) {
  assertIncludes(dogfoodBrontoScript, term, 'scripts/dogfood-bronto-report.mjs');
}

for (const term of [
  'Self dogfood report verified',
  'self-dogfood project evidence report',
  'docs/readiness-matrix.json',
  'docs/completion-audit.json',
  'prepareDomAnnotations',
  'annotationFrameFromSvg',
  'generated-svg-chart',
  'generated-svg-diagram',
  'dogfood-self-report.png'
]) {
  assertIncludes(dogfoodSelfScript, term, 'scripts/dogfood-self-report.mjs');
}

for (const term of [
  'External consumer dogfood verified',
  'PONCHIA_ANNOTATIONS_EXTERNAL_CONSUMER_ROOT',
  'Skipped external consumer dogfood',
  'anchorFromDOMRect',
  'resolvePreparedAnnotationLayout',
  'renderAnnotationsSvg',
  'External consumer target alignment',
  'dogfood-external-consumer.png'
]) {
  assertIncludes(dogfoodExternalScript, term, 'scripts/dogfood-external-consumer.mjs');
}

for (const term of [
  'visual baselines',
  'CI compares new screenshots',
  'non-empty screenshot evidence',
  'test/visual-baselines/browser-screenshots.json',
  '--write-baseline'
]) {
  assertIncludes(visual, term, 'docs/visual-regression.md');
}

assert.equal(visualBaseline.schemaVersion, 1, 'visual baseline schemaVersion must be 1');
assert.equal(visualBaseline.screenshots.length, 22, 'visual baseline must cover every browser and packed-consumer screenshot');

for (const term of [
  'test/visual-baselines/browser-screenshots.json',
  '--write-baseline',
  'Visual baselines',
  'assertVisualBaseline'
]) {
  assertIncludes(screenshotCheck, term, 'scripts/check-browser-screenshots.mjs');
}

for (const term of [
  'npm run test:performance',
  '10 annotations',
  '50 annotations',
  '200 annotations'
]) {
  assertIncludes(performanceDocs, term, 'docs/performance.md');
}

for (const term of [
  'Static SVG',
  'React',
  'External Note Lists',
  'roving focus',
  'screenReaderSummary',
  'keyboard activation',
  'npm run test:dogfood'
]) {
  assertIncludes(accessibility, term, 'docs/accessibility.md');
}

for (const term of [
  'Vega-Lite',
  'Sequence diagram',
  'Nested diagram',
  'Zoom/pan',
  'docs/adapter-recipes-proof.md',
  'Acceptance Criteria'
]) {
  assertIncludes(adapterRecipes, term, 'docs/adapter-recipes-roadmap.md');
}

for (const term of [
  'Deep Adapter Recipes Proof',
  'Vega-Lite Compile-To-Vega',
  'Mermaid Flowchart And Sequence SVG',
  'D2 Nested Diagrams And Routes',
  'React Flow Viewport, Handles, And Editing',
  'non-identity React Flow viewport',
  'host-owned annotation patch',
  'examples/mermaid-basic',
  'mermaid-sequence-route',
  'mermaid-translated-data',
  'data-node-id="flow-intake"',
  'translated labels',
  'flowchart and sequence browser-proven',
  'test/adapters/mermaid.test.ts',
  'data-message-id',
  'line.messageLine0',
  'messageLine0',
  'Remaining Limits'
]) {
  assertIncludes(adapterRecipesProof, term, 'docs/adapter-recipes-proof.md');
}

for (const term of [
  'layout-stress',
  'annotations: 10',
  'annotations: 50',
  'annotations: 200',
  'maxMedianMs',
  'evaluateAnnotationLayout'
]) {
  assertIncludes(benchmark, term, 'scripts/benchmark-layout.mjs');
}

for (const term of [
  'Pre-Release Hardening',
  'docs/pre-release-roadmap.md',
  'docs/dogfood-self-report.md',
  'docs/dogfood-external-consumer-report.md',
  'npm run test:dogfood:external',
  'npm run test:compatibility',
  'npm run test:compatibility:lanes',
  'npm run test:performance'
]) {
  assertIncludes(readme, term, 'README.md');
}

console.log('Pre-release goals verified: roadmap, API stability, compatibility, dogfood, self-dogfood, external dogfood, visual regression, performance, accessibility, adapter recipes, and public release decisions.');

async function read(path) {
  return readFile(pathUrl(path), 'utf8');
}

async function assertPath(path) {
  try {
    await access(pathUrl(path));
  } catch {
    throw new Error(`Expected pre-release goal path to exist: ${path}`);
  }
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}

function pathUrl(path) {
  return new URL(`../${path}`, import.meta.url);
}
