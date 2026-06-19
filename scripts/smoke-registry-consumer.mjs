import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const workdir = new URL('../.tmp/registry-consumer/', import.meta.url).pathname;
const version = valueAfter('--version');
const registry = valueAfter('--registry') ?? 'https://npm.pkg.github.com';
const scope = valueAfter('--scope') ?? '@ponchia';

assert.ok(version, 'Usage: node scripts/smoke-registry-consumer.mjs --version <version> [--registry https://npm.pkg.github.com] [--scope @ponchia]');

await rm(workdir, { recursive: true, force: true });
await mkdir(workdir, { recursive: true });
await writeFile(join(workdir, 'package.json'), `${JSON.stringify({
  private: true,
  type: 'module'
}, null, 2)}\n`);
await writeFile(join(workdir, '.npmrc'), [
  `${scope}:registry=${registry}`,
  registry === 'https://npm.pkg.github.com' ? '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' : undefined,
  'always-auth=true'
].filter(Boolean).join('\n') + '\n');

await exec('npm', [
  'install',
  '--silent',
  '--no-audit',
  '--no-fund',
  `@ponchia/annotations@${version}`,
  '@terrastruct/d2@^0.1.33',
  '@xyflow/react@^12.11.0',
  'jsdom@^26.1.0',
  'mermaid@^11.15.0',
  'react@^19.1.0',
  'react-dom@^19.1.0',
  'vega@^6.2.0'
], {
  cwd: workdir,
  env: {
    ...process.env,
    npm_config_registry: 'https://registry.npmjs.org'
  }
});

await writeFile(join(workdir, 'smoke.mjs'), `
  import assert from 'node:assert/strict';
  import { createRequire } from 'node:module';
  import { readFile } from 'node:fs/promises';
  import {
    generatedSurfaceLayoutDefaults,
    renderAnnotationsSvg,
    resolveAnnotationLayout,
    resolvePreparedAnnotationLayout
  } from '@ponchia/annotations';
  import { prepareDomAnnotations } from '@ponchia/annotations/dom';
  import { prepareVegaScenegraphAnnotations } from '@ponchia/annotations/vega';
  import { prepareMermaidAnnotations } from '@ponchia/annotations/mermaid';
  import { prepareD2DiagramAnnotations } from '@ponchia/annotations/d2';
  import { prepareReactFlowAnnotations } from '@ponchia/annotations/react-flow';
  import { JSDOM } from 'jsdom';

  const require = createRequire(import.meta.url);
  const pkg = require('@ponchia/annotations/package.json');
  assert.equal(pkg.version, ${JSON.stringify(version)}, 'registry install should resolve the requested canary version');

  const layout = resolveAnnotationLayout({
    annotations: [{
      id: 'registry-root',
      anchor: { type: 'point', point: { x: 32, y: 40 } },
      note: { title: 'Registry root' },
      placement: { manual: { x: 72, y: 58, side: 'left' } }
    }],
    bounds: { x: 0, y: 0, width: 240, height: 180 }
  });
  assert.equal(layout.annotations.length, 1, 'root layout should resolve from registry install');
  assert.ok(renderAnnotationsSvg(layout).includes('pa-annotation__note'), 'root SVG renderer should work from registry install');

  const cssUrl = import.meta.resolve('@ponchia/annotations/bronto.css');
  const css = await readFile(new URL(cssUrl), 'utf8');
  assert.ok(css.includes('.pa-annotation'), 'CSS subpath should resolve from registry install');

  const dom = new JSDOM('<div id="surface"><div data-target="risk">Risk</div></div>');
  const surface = dom.window.document.querySelector('#surface');
  const target = dom.window.document.querySelector('[data-target="risk"]');
  surface.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120 });
  target.getBoundingClientRect = () => ({ x: 20, y: 16, left: 20, top: 16, right: 100, bottom: 56, width: 80, height: 40 });
  const domPrepared = prepareDomAnnotations(surface, [{
    id: 'registry-dom',
    selector: '[data-target="risk"]',
    coordinateSpace: surface,
    note: { title: 'DOM registry' }
  }], { assert: true });
  assert.equal(domPrepared.annotations.length, 1, 'DOM subpath should prepare annotations from registry install');

  const vegaPrepared = prepareVegaScenegraphAnnotations({
    scenegraph: () => ({
      root: {
        items: [{
          mark: { name: 'points', role: 'mark', marktype: 'symbol' },
          datum: { id: 'peak' },
          bounds: { x1: 12, y1: 18, x2: 24, y2: 30 }
        }]
      }
    })
  }, [{
    id: 'registry-vega',
    markName: 'points',
    datum: (datum) => datum?.id === 'peak',
    note: { title: 'Vega registry' }
  }], { assert: true });
  assert.equal(vegaPrepared.annotations.length, 1, 'Vega subpath should prepare annotations from registry install');

  const mermaidSvg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mermaidSvg.innerHTML = '<g class="node"><rect width="80" height="32"></rect><text>API</text></g>';
  mermaidSvg.querySelector('g.node').getBBox = () => ({ x: 10, y: 12, width: 80, height: 32 });
  const mermaidPrepared = prepareMermaidAnnotations(mermaidSvg, [{
    id: 'registry-mermaid',
    label: 'API',
    coordinateSpace: mermaidSvg,
    note: { title: 'Mermaid registry' }
  }], { assert: true, obstacles: false });
  assert.equal(mermaidPrepared.annotations.length, 1, 'Mermaid subpath should prepare annotations from registry install');

  const d2Prepared = prepareD2DiagramAnnotations({
    shapes: [{ id: 'process', pos: { x: 10, y: 20 }, width: 80, height: 40 }]
  }, [{
    id: 'registry-d2',
    shapeId: 'process',
    note: { title: 'D2 registry' }
  }], { assert: true });
  assert.equal(d2Prepared.annotations.length, 1, 'D2 subpath should prepare annotations from registry install');

  const flowPrepared = prepareReactFlowAnnotations({
    nodes: [{ id: 'review', position: { x: 10, y: 20 }, width: 120, height: 54 }]
  }, [{
    id: 'registry-flow',
    nodeId: 'review',
    note: { title: 'React Flow registry' }
  }], { assert: true });
  assert.equal(flowPrepared.annotations.length, 1, 'React Flow subpath should prepare annotations from registry install');

  const resolved = resolvePreparedAnnotationLayout(vegaPrepared, {
    ...generatedSurfaceLayoutDefaults({ anchorLabel: 'Registry anchors', layoutLabel: 'Registry annotations' }),
    bounds: { x: 0, y: 0, width: 260, height: 160 },
    noteSizes: { 'registry-vega': { width: 96, height: 48 } },
    assertQuality: true
  });
  assert.equal(resolved.quality.ok, true, 'prepared layout should work from registry install');
`);
await exec('node', ['smoke.mjs'], { cwd: workdir });

console.log(`Registry consumer smoke verified: @ponchia/annotations@${version} from ${registry}.`);

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);

  return index >= 0 ? process.argv[index + 1] : undefined;
}
