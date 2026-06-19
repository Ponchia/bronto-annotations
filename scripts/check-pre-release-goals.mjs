import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const readme = await read('README.md');
const roadmap = await read('docs/pre-release-roadmap.md');
const apiStability = await read('docs/api-stability.md');
const compatibility = await read('docs/compatibility.md');
const dogfood = await read('docs/dogfood-friction-report.md');
const visual = await read('docs/visual-regression.md');
const performanceDocs = await read('docs/performance.md');
const accessibility = await read('docs/accessibility.md');
const adapterRecipes = await read('docs/adapter-recipes-roadmap.md');
const benchmark = await read('scripts/benchmark-layout.mjs');

for (const path of [
  'docs/pre-release-roadmap.md',
  'docs/api-stability.md',
  'docs/compatibility.md',
  'docs/dogfood-friction-report.md',
  'docs/visual-regression.md',
  'docs/performance.md',
  'docs/accessibility.md',
  'docs/adapter-recipes-roadmap.md',
  'scripts/benchmark-layout.mjs'
]) {
  await assertPath(path);
}

assert.equal(pkg.scripts?.['test:pre-release'], 'node scripts/check-pre-release-goals.mjs');
assert.equal(pkg.scripts?.['test:performance'], 'npm run build && node scripts/benchmark-layout.mjs --assert');
assert.ok(pkg.scripts?.check?.includes('npm run test:pre-release'), 'npm run check must include test:pre-release');
assert.ok(pkg.scripts?.check?.includes('npm run test:performance'), 'npm run check must include test:performance');

for (const term of [
  'Dogfood in a real consumer',
  'Freeze the `0.1.x` public API contract',
  'Publish a private/canary package',
  'visual regression baselines',
  'Performance',
  'Accessibility',
  'Compatibility matrix',
  'public package/repository naming'
]) {
  assertIncludes(roadmap, term, 'docs/pre-release-roadmap.md');
}

for (const term of [
  'Stable for `0.1.x`',
  'Experimental',
  'Root imports must remain DOM-free'
]) {
  assertIncludes(apiStability, term, 'docs/api-stability.md');
}

for (const term of [
  'Node.js',
  'TypeScript',
  'React',
  'Vega',
  'Mermaid',
  'D2',
  'React Flow',
  'optional peers'
]) {
  assertIncludes(compatibility, term, 'docs/compatibility.md');
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
  'visual baselines',
  'CI compares new screenshots',
  'non-empty screenshot evidence'
]) {
  assertIncludes(visual, term, 'docs/visual-regression.md');
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
  'roving focus'
]) {
  assertIncludes(accessibility, term, 'docs/accessibility.md');
}

for (const term of [
  'Vega-Lite',
  'Sequence diagram',
  'Nested diagram',
  'Zoom/pan',
  'Acceptance Criteria'
]) {
  assertIncludes(adapterRecipes, term, 'docs/adapter-recipes-roadmap.md');
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
  'npm run test:performance'
]) {
  assertIncludes(readme, term, 'README.md');
}

console.log('Pre-release goals verified: roadmap, API stability, compatibility, dogfood, visual regression, performance, accessibility, and adapter recipes.');

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
