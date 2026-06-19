import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const consumersDir = new URL('../.tmp/compatibility-lanes/', import.meta.url).pathname;
let tarball;

try {
  const { stdout } = await exec('npm', ['pack', '--json'], { cwd: root });
  const packResult = JSON.parse(stdout)[0];
  tarball = new URL(`../${packResult.filename}`, import.meta.url).pathname;

  await rm(consumersDir, { recursive: true, force: true });
  await smokeReact18(tarball);
  await smokeVega5(tarball);
} finally {
  if (tarball) {
    await rm(tarball, { force: true });
  }
}

console.log('Compatibility lane smoke verified: React 18 clean consumer and Vega 5 clean consumer.');

async function smokeReact18(packageTarball) {
  const workdir = await consumerWorkdir('react18-');
  await install(workdir, [
    packageTarball,
    'react@18.2.0',
    'react-dom@18.2.0',
    'jsdom@^26.1.0'
  ]);

  await writeFile(join(workdir, 'smoke-react18.mjs'), `
    import React from 'react';
    import { flushSync } from 'react-dom';
    import { createRoot } from 'react-dom/client';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { JSDOM } from 'jsdom';
    import { AnnotationLayer } from '@ponchia/annotations/react';

    const annotations = [{
      id: 'react18-lane',
      anchor: { type: 'point', point: { x: 40, y: 44 } },
      note: { title: 'React 18 lane' },
      placement: { manual: { x: 84, y: 48 } },
      connector: { end: 'arrow' }
    }];
    const bounds = { x: 0, y: 0, width: 240, height: 180 };
    const markup = renderToStaticMarkup(React.createElement(AnnotationLayer, {
      annotations,
      bounds,
      markerIdPrefix: 'react18-lane',
      qualityDebug: true
    }));

    if (!markup.includes('React 18 lane')) throw new Error('React 18 SSR note failed');
    if (!markup.includes('pa-annotation__connector')) throw new Error('React 18 SSR connector failed');
    if (!markup.includes('pa-annotation--manual')) throw new Error('React 18 SSR manual placement failed');

    const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.SVGElement = dom.window.SVGElement;
    globalThis.Node = dom.window.Node;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: dom.window.navigator
    });

    let layout;
    let quality;
    const root = createRoot(document.querySelector('#root'));
    flushSync(() => root.render(React.createElement(AnnotationLayer, {
      annotations,
      bounds,
      onLayout: (nextLayout) => {
        layout = nextLayout;
      },
      onQuality: (event) => {
        quality = event;
      }
    })));

    if (!layout || layout.annotations.length !== 1) throw new Error('React 18 client layout failed');
    if (!quality?.quality?.ok) throw new Error('React 18 client quality event failed');
    if (!document.querySelector('.pa-annotation__note')) throw new Error('React 18 client DOM note failed');
    root.unmount();
  `);

  await exec(process.execPath, ['smoke-react18.mjs'], { cwd: workdir, maxBuffer: 1024 * 1024 });
}

async function smokeVega5(packageTarball) {
  const workdir = await consumerWorkdir('vega5-');
  await install(workdir, [
    packageTarball,
    'vega@5'
  ]);

  await writeFile(join(workdir, 'smoke-vega5.mjs'), `
    import * as vega from 'vega';
    import {
      resolvePreparedAnnotationLayout,
      renderAnnotationsSvg
    } from '@ponchia/annotations';
    import {
      anchorsFromVegaScenegraph,
      prepareVegaScenegraphAnnotations,
      prepareVegaViewAnnotations
    } from '@ponchia/annotations/vega';

    const spec = {
      $schema: 'https://vega.github.io/schema/vega/v5.json',
      width: 220,
      height: 140,
      data: [{
        name: 'table',
        values: [
          { id: 'peak', x: 80, y: 35, width: 28, height: 22 },
          { id: 'base', x: 20, y: 90, width: 36, height: 18 }
        ]
      }],
      marks: [{
        name: 'bars',
        type: 'rect',
        from: { data: 'table' },
        encode: {
          enter: {
            x: { field: 'x' },
            y: { field: 'y' },
            width: { field: 'width' },
            height: { field: 'height' }
          }
        }
      }]
    };

    const view = new vega.View(vega.parse(spec), { renderer: 'none' });
    await view.runAsync();

    const viewPrepared = prepareVegaViewAnnotations(view, [{
      id: 'peak-view',
      data: 'table',
      datum: (datum) => datum.id === 'peak',
      x: 'x',
      y: 'y',
      width: 'width',
      height: 'height',
      note: { title: 'Vega 5 view lane' }
    }], {
      assert: true
    });
    if (!viewPrepared.validation.ok) throw new Error('Vega 5 view validation failed');
    if (viewPrepared.annotations[0]?.data?.anchorSource !== 'vega-view') throw new Error('Vega 5 view source failed');
    if (viewPrepared.obstacles.length !== 1) throw new Error('Vega 5 view obstacles failed');

    const scenegraphAnchors = anchorsFromVegaScenegraph(view, [{
      id: 'peak-scenegraph',
      markName: 'bars',
      markType: 'rect',
      datum: (datum) => datum?.id === 'peak',
      note: { title: 'Vega 5 scenegraph lane' }
    }]);
    if (scenegraphAnchors[0]?.box?.x !== 80 || scenegraphAnchors[0]?.box?.y !== 35) throw new Error('Vega 5 scenegraph geometry failed');

    const scenegraphPrepared = prepareVegaScenegraphAnnotations(view, [{
      id: 'peak-scenegraph',
      markName: 'bars',
      markType: 'rect',
      datum: (datum) => datum?.id === 'peak',
      note: { title: 'Vega 5 scenegraph lane' },
      placement: { manual: { x: 130, y: 32 } }
    }], {
      assert: true,
      obstacles: { markName: 'bars', markType: 'rect' }
    });
    const layout = resolvePreparedAnnotationLayout(scenegraphPrepared, {
      bounds: { x: 0, y: 0, width: 260, height: 180 },
      assertQuality: true,
      targetAlignmentTargets: [{
        id: 'peak-scenegraph',
        expected: 'Vega 5 rendered rect',
        box: { x: 80, y: 35, width: 28, height: 22 }
      }],
      assertTargetAlignment: { label: 'Vega 5 lane target alignment', failOnWarnings: true },
      targetAlignmentOptions: { tolerance: 0.5 }
    });

    if (!layout.validation.ok || !layout.targetAlignment?.ok || !layout.quality.ok) throw new Error('Vega 5 prepared layout failed');
    const svg = renderAnnotationsSvg(layout.layout, { includeQualityIssues: layout.quality });
    if (!svg.includes('Vega 5 scenegraph lane')) throw new Error('Vega 5 SVG note failed');
    if (!svg.includes('pa-annotation__connector')) throw new Error('Vega 5 SVG connector failed');
  `);

  await exec(process.execPath, ['smoke-vega5.mjs'], { cwd: workdir, maxBuffer: 1024 * 1024 });
}

async function consumerWorkdir(prefix) {
  await mkdir(consumersDir, { recursive: true });

  const workdir = await mkdtemp(join(consumersDir, prefix));
  await writeFile(join(workdir, 'package.json'), JSON.stringify({
    type: 'module',
    private: true
  }, null, 2));
  return workdir;
}

async function install(workdir, packages) {
  await exec('npm', ['install', ...packages, '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: workdir,
    maxBuffer: 1024 * 1024
  });
}
