/** Execute the site's exact copied recipes against an isolated packed consumer.
 * This checks candidate package bytes, not registry publication or visual parity.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { createServer } from 'vite';
import ts from 'typescript';

const exec = promisify(execFile);

async function geometry(page, selector) {
  return page.locator(selector).evaluate((container) =>
    [...container.querySelectorAll('.pa-annotation')].map((item) => ({
      id: item.getAttribute('data-annotation-id'),
      transform: item.querySelector('.pa-annotation__note')?.getAttribute('transform'),
      width: item.querySelector('.pa-annotation__note-box')?.getAttribute('width'),
      height: item.querySelector('.pa-annotation__note-box')?.getAttribute('height'),
      connector: item.querySelector('.pa-annotation__connector')?.getAttribute('d'),
      title: [...item.querySelectorAll('.pa-annotation__title')].map(node => node.textContent),
      body: [...item.querySelectorAll('.pa-annotation__body')].map(node => node.textContent),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  );
}

/** The owning browser test supplies its browser; all child pages are closed. */
export async function verifyPlaygroundCopy({ browser, siteUrl, root }) {
  const scratch = await mkdtemp(join(tmpdir(), 'annotations-playground-copy-'));
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  let server;
  try {
    const page = await context.newPage();
    await page.goto(siteUrl, { waitUntil: 'networkidle' });
    const scenes = [];
    for (const preset of ['balanced', 'crowded', 'sparse']) {
      for (const mode of ['automatic', 'fixed']) {
        await page.locator(`button[data-scene="${preset}"]`).click();
        await page.locator('#placement-mode').selectOption(mode);
        scenes.push({
          name: `${preset}-${mode}`,
          code: await page.locator('#scene-source-code').textContent(),
          expected: await geometry(page, '#annotation-overlay'),
        });
      }
    }
    scenes.push({ name: 'starter', code: await page.locator('#starter-code').textContent(), expected: null });

    // No repository aliases or shared node_modules: resolve the actual archive.
    const packed = await exec('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch],
      { cwd: root, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const record = JSON.parse(packed.stdout)[0];
    assert(record && basename(record.filename) === record.filename, 'Unexpected package archive path');
    assert(record.files.every(file => !file.path.startsWith('site/')), 'Site UI must not enter the package');
    await writeFile(join(scratch, 'package.json'), JSON.stringify({
      name: 'annotation-copy-consumer', private: true, type: 'module',
    }));
    await exec('npm', ['install', join(scratch, record.filename), '--offline', '--ignore-scripts',
      '--omit=optional', '--no-audit', '--no-fund', '--package-lock=false'],
    { cwd: scratch, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
    const installed = JSON.parse(await readFile(join(scratch, 'node_modules/@ponchia/annotations/package.json'), 'utf8'));
    assert.equal(installed.version, record.version, 'Copied code must use the packed version');

    const sources = [];
    for (const scene of scenes) {
      assert(scene.code?.includes('@ponchia/annotations/bronto.css'), 'Copied browser recipe needs its CSS');
      const source = join(scratch, `${scene.name}.ts`);
      sources.push(source);
      await writeFile(source, scene.code);
      await writeFile(join(scratch, `${scene.name}.html`), `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Copied annotation recipe</title>
<style>#chart-annotations { width:760px; height:430px; }</style>
</head><body><main><div id="chart-annotations"></div></main>
<script type="module" src="./${scene.name}.ts"></script></body></html>`);
    }
    // Typecheck the same text visitors receive, not a hand-maintained fixture.
    const program = ts.createProgram(sources, {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true,
      noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
      skipLibCheck: true, noEmit: true, types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => scratch, getCanonicalFileName: name => name, getNewLine: () => '\n',
      }));

    server = await createServer({ root: scratch, configFile: false, logLevel: 'error',
      server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    await server.listen();
    const address = server.httpServer.address();
    assert(address && typeof address !== 'string');
    for (const scene of scenes) {
      const consumer = await context.newPage();
      const errors = [];
      consumer.on('pageerror', error => errors.push(error.message));
      consumer.on('response', response => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      await consumer.goto(`http://127.0.0.1:${address.port}/${scene.name}.html`, { waitUntil: 'networkidle' });
      await consumer.locator('#chart-annotations .pa-annotation').first().waitFor();
      if (scene.expected) assert.deepEqual(await geometry(consumer, '#chart-annotations'), scene.expected,
        `Copied ${scene.name} geometry must match the real playground`);
      const count = scene.expected?.length ?? 1;
      assert.equal(await consumer.locator('.pa-annotation').count(), count);
      assert.equal(await consumer.locator('.pa-annotation__note[tabindex="0"]').count(), count);
      assert.equal(await consumer.locator('svg.pa-annotation-layer').getAttribute('role'), 'group');
      const paint = await consumer.locator('.pa-annotation').first().evaluate(item => ({
        paper: getComputedStyle(item.querySelector('.pa-annotation__note-box')).fill,
        text: getComputedStyle(item.querySelector('.pa-annotation__title')).fill,
        stroke: getComputedStyle(item.querySelector('.pa-annotation__connector')).stroke,
      }));
      assert.notEqual(paint.paper, paint.text, 'Copied annotation text must differ from its background');
      assert.notEqual(paint.paper, 'none');
      assert.notEqual(paint.stroke, 'none', 'Package CSS must give connectors a visible stroke');
      assert.deepEqual(errors, [], `Copied ${scene.name} runtime errors`);
      await consumer.close();
    }
    console.log(`Copied recipes verified: ${scenes.length} strict TypeScript consumers; six scene/mode geometries match; package-only CSS and keyboard-focusable notes.`);
  } finally {
    await context.close();
    if (server) await server.close();
    await rm(scratch, { recursive: true, force: true });
  }
}
