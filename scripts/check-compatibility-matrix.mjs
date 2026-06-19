import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await read('package.json'));
const compatibility = await read('docs/compatibility.md');
const ciWorkflow = await read('.github/workflows/ci.yml');
const packedSmoke = await read('scripts/smoke-packed-consumer.mjs');
const laneSmoke = await read('scripts/smoke-compatibility-lanes.mjs');

const expectedPeers = {
  '@terrastruct/d2': '>=0.1.0',
  '@xyflow/react': '>=12.0.0',
  mermaid: '>=11.0.0',
  react: '>=18.2.0 || >=19.0.0',
  'react-dom': '>=18.2.0 || >=19.0.0',
  vega: '>=5.0.0 || >=6.0.0'
};

const expectedDevDependencyTerms = {
  '@terrastruct/d2': '0.1.',
  '@xyflow/react': '12.',
  mermaid: '11.',
  react: '19.',
  'react-dom': '19.',
  typescript: '5.8',
  vega: '6.'
};
const expectedNodeLaneLabels = ['Node 20', 'Node 22'];

assert.equal(pkg.engines?.node, '>=20.19.0', 'package.json must declare the supported Node floor');
assert.equal(pkg.scripts?.['test:compatibility'], 'node scripts/check-compatibility-matrix.mjs');
assert.equal(pkg.scripts?.['test:compatibility:lanes'], 'npm run build && node scripts/smoke-compatibility-lanes.mjs');
assert.ok(pkg.scripts?.check?.includes('npm run test:compatibility'), 'npm run check must include test:compatibility');
assert.ok(pkg.scripts?.check?.includes('npm run test:compatibility:lanes'), 'npm run check must include test:compatibility:lanes');
assert.equal(pkg.dependencies, undefined, 'root runtime dependencies must stay absent');
assert.equal(pkg.peerDependencies?.['@ponchia/ui'], undefined, '@ponchia/ui must not be a peer dependency');
assert.equal(pkg.devDependencies?.['@ponchia/ui'], undefined, '@ponchia/ui must not be a dev dependency');

assert.deepEqual(
  Object.keys(pkg.peerDependencies ?? {}).sort(),
  Object.keys(expectedPeers).sort(),
  'peer dependency set must match the optional integration peer set'
);

for (const [peer, range] of Object.entries(expectedPeers)) {
  assert.equal(pkg.peerDependencies?.[peer], range, `${peer} peer range must match compatibility matrix`);
  assert.equal(pkg.peerDependenciesMeta?.[peer]?.optional, true, `${peer} peer must be marked optional`);
  assertIncludes(compatibility, `| ${peerLabel(peer)} | \`${range}\` |`, 'docs/compatibility.md');
}

for (const [dependency, term] of Object.entries(expectedDevDependencyTerms)) {
  assert.ok(
    pkg.devDependencies?.[dependency]?.includes(term),
    `${dependency} dev dependency must keep the documented verification lane`
  );
}

for (const nodeVersion of expectedNodeLaneLabels.map((label) => label.replace('Node ', ''))) {
  assertIncludes(ciWorkflow, `- ${nodeVersion}`, '.github/workflows/ci.yml');
  assertIncludes(compatibility, `Node ${nodeVersion}`, 'docs/compatibility.md');
}

for (const term of [
  '# Compatibility Matrix',
  'npm run test:compatibility',
  'npm run test:compatibility:lanes',
  'Node.js',
  'TypeScript',
  'React 18',
  'React 18 clean consumer',
  'React 19',
  'React DOM',
  'Vega 5',
  'Vega 5 clean consumer',
  'Vega 6',
  'Mermaid',
  'D2',
  'React Flow',
  'optional peers',
  'Root imports must work',
  'without React, Vega, Mermaid, D2, React Flow, or `@ponchia/ui` installed.',
  'Any peer range change must update this matrix, package metadata, docs, and',
  'packed-consumer smoke coverage.'
]) {
  assertIncludes(compatibility, term, 'docs/compatibility.md');
}

for (const term of [
  'react@^19.1.0',
  'react-dom@^19.1.0',
  '@xyflow/react@^12.11.0',
  'clean root consumer unexpectedly installed optional peers',
  '@ponchia/annotations/vega',
  '@ponchia/annotations/mermaid',
  '@ponchia/annotations/d2',
  '@ponchia/annotations/react-flow'
]) {
  assertIncludes(packedSmoke, term, 'scripts/smoke-packed-consumer.mjs');
}

for (const term of [
  'Compatibility lane smoke verified',
  'React 18 clean consumer',
  'Vega 5 clean consumer',
  'react@18.2.0',
  'react-dom@18.2.0',
  'vega@5',
  'renderToStaticMarkup',
  'createRoot',
  'prepareVegaViewAnnotations',
  'prepareVegaScenegraphAnnotations',
  'resolvePreparedAnnotationLayout'
]) {
  assertIncludes(laneSmoke, term, 'scripts/smoke-compatibility-lanes.mjs');
}

console.log('Compatibility matrix verified: package peers, optional metadata, CI Node lanes, docs, and packed-smoke evidence are aligned.');

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertIncludes(text, term, label) {
  assert.ok(text.includes(term), `${label} must include ${JSON.stringify(term)}`);
}

function peerLabel(peer) {
  switch (peer) {
    case '@terrastruct/d2':
      return 'D2';
    case '@xyflow/react':
      return 'React Flow';
    case 'react':
      return 'React';
    case 'react-dom':
      return 'React DOM';
    case 'vega':
      return 'Vega';
    default:
      return peer[0].toUpperCase() + peer.slice(1);
  }
}
