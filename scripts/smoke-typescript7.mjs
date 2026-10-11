/**
 * Isolated TypeScript 7 consumer lane for the *published declarations*.
 *
 * The library continues building under TypeScript 6, and TypeScript 5.8
 * remains covered independently. Test TS7 without rewriting the development
 * compiler, lockfile, or compatibility floor for existing consumers.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workdir = await mkdtemp(join(tmpdir(), 'annotations-typescript7-'));

try {
  const { stdout } = await exec('npm', [
    'pack', '.', '--json', '--ignore-scripts', '--pack-destination', workdir
  ], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  const pack = JSON.parse(stdout)[0];
  assert.ok(pack.files.some((file) => file.path === 'dist/index.d.ts'),
    'TypeScript 7 requires the compiled package declarations');
  assert.ok(pack.files.some((file) => file.path === 'dist/react/index.d.ts'),
    'TypeScript 7 requires the compiled React declarations');
  const tarball = join(workdir, pack.filename);

  await writeFile(join(workdir, 'package.json'), JSON.stringify({
    name: 'annotations-typescript7-clean-consumer',
    private: true,
    type: 'module'
  }, null, 2));
  await exec('npm', [
    'install', tarball, 'typescript@7.0.2',
    'react@19.1.1', '@types/react@19.1.8',
    '--ignore-scripts', '--no-audit', '--no-fund', '--no-save'
  ], {
    cwd: workdir,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, npm_config_engine_strict: 'true' }
  });

  const compiler = JSON.parse(await readFile(join(workdir, 'node_modules/typescript/package.json'), 'utf8'));
  assert.equal(compiler.version, '7.0.2', 'Clean consumer must actually use TypeScript 7');
  await writeFile(join(workdir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM'],
      jsx: 'react-jsx',
      strict: true,
      skipLibCheck: false,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noEmit: true,
      types: []
    },
    include: ['index.ts', 'layer.tsx']
  }, null, 2));

  await writeFile(join(workdir, 'index.ts'), `
import {
  createIncrementalAnnotationLayoutSession,
  evaluateAnnotationLayout,
  renderAnnotationsSvg,
  resolveAnnotationLayout,
  type Annotation,
  type ResolvedLayout
} from '@ponchia/annotations';
import { anchorFromDOMRect } from '@ponchia/annotations/dom';
import type { MermaidAnchorSpec } from '@ponchia/annotations/mermaid';
import type { VegaViewAnchorSpec } from '@ponchia/annotations/vega';

export const bounds = { x: 0, y: 0, width: 600, height: 350 };
export const annotations: Annotation[] = [{
  id: 'typescript7-note',
  anchor: { type: 'point', point: { x: 30, y: 44 } },
  note: { title: 'TypeScript 7 controlled note' },
  placement: { manual: { x: 88, y: 60, side: 'bottom' } }
}];

const session = createIncrementalAnnotationLayoutSession({ annotations, bounds });
export const resolved: ResolvedLayout = session.update({ annotations, bounds });
export const full: ResolvedLayout = resolveAnnotationLayout({ annotations, bounds });
export const quality = evaluateAnnotationLayout(resolved);
export const markup: string = renderAnnotationsSvg(full);
export const point = anchorFromDOMRect({ left: 2, top: 3, right: 10, bottom: 13 });

const mermaidAnchor: MermaidAnchorSpec = {
  id: 'diagram', nodeId: 'api', note: { title: 'Mermaid 12 declaration' }
};

type Datum = { id: string; x: number; y: number };
const vegaAnchor: VegaViewAnchorSpec<Datum> = {
  id: 'chart', data: 'table', datum: (datum) => datum.id === 'peak',
  x: 'x', y: 'y', note: { title: 'Vega declaration' }
};
void [mermaidAnchor, vegaAnchor, quality, markup, point];
`);

  await writeFile(join(workdir, 'layer.tsx'), `
import type { ReactElement } from 'react';
import {
  AnnotationLayer,
  type AnnotationLayerProps,
  type AnnotationLayerQualityEvent
} from '@ponchia/annotations/react';
import { annotations, bounds, resolved } from './index.js';

const onQuality = (event: AnnotationLayerQualityEvent): void => {
  const score: number = event.quality.score;
  void score;
};

const props: AnnotationLayerProps = {
  annotations,
  bounds,
  resolvedLayout: resolved,
  previewEdits: true,
  editable: { includeAnchor: true },
  onQuality,
  noteTabIndex: 0
};
export const annotationLayer: ReactElement = <AnnotationLayer {...props} />;
`);

  const { stdout: versionOutput } = await exec(join(workdir, 'node_modules/.bin/tsc'),
    ['--version'], { cwd: workdir, maxBuffer: 1024 * 1024 });
  assert.match(versionOutput.trim(), /^Version 7\.0\.2$/);
  await exec(join(workdir, 'node_modules/.bin/tsc'),
    ['--noEmit', '--project', 'tsconfig.json'], {
      cwd: workdir, maxBuffer: 2 * 1024 * 1024
    });

  writeLine(JSON.stringify({
    lane: 'typescript7-clean-packed-declarations',
    compiler: compiler.version,
    annotationsPackage: pack.version,
    rootDeclarations: true,
    domDeclarations: true,
    mermaidDeclarations: true,
    vegaDeclarations: true,
    controlledReactDeclarations: true,
    typecheck: 'passed'
  }, null, 2));
} finally {
  await rm(workdir, { recursive: true, force: true });
}
