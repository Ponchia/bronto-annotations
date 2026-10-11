/**
 * Isolated Mermaid 12 browser compatibility lane.
 *
 * Mermaid 12 requires Node >=22.12, whereas @ponchia/annotations also
 * supports Node 20 through the Mermaid 11 adapter lane. Do not replace the
 * checked Mermaid 11 dependency in the repository. Install Mermaid 12 next
 * to a real packed annotations package in an external, disposable Vite host.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'vite';
import { writeLine } from './log.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const major = Number(process.versions.node.split('.')[0]);
const minor = Number(process.versions.node.split('.')[1]);
assert.ok(major > 22 || (major === 22 && minor >= 12),
  'Mermaid 12 requires Node >=22.12; keep Mermaid 11 on the supported Node 20 lane.');

const workdir = await mkdtemp(join(tmpdir(), 'annotations-mermaid12-'));
let server;
let browser;
const results = [];

try {
  const { stdout } = await exec('npm', [
    'pack', '.', '--json', '--ignore-scripts', '--pack-destination', workdir
  ], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  const pack = JSON.parse(stdout)[0];
  const tarball = join(workdir, pack.filename);
  assert.ok(pack.files.some((file) => file.path === 'dist/adapters/mermaid.js'),
    'Package tarball must include its compiled Mermaid adapter');

  await writeFile(join(workdir, 'package.json'), JSON.stringify({
    name: 'annotations-mermaid12-consumer', private: true, type: 'module'
  }, null, 2));
  await exec('npm', [
    'install', tarball, 'mermaid@12.1.0',
    '--ignore-scripts', '--no-audit', '--no-fund', '--no-save'
  ], { cwd: workdir, maxBuffer: 3 * 1024 * 1024, env: {
    ...process.env,
    npm_config_engine_strict: 'true'
  } });

  const installed = JSON.parse(await readFile(join(workdir, 'node_modules/mermaid/package.json'), 'utf8'));
  assert.equal(installed.version, '12.1.0');
  const installedAdapter = JSON.parse(await readFile(join(workdir, 'node_modules/@ponchia/annotations/package.json'), 'utf8'));
  assert.equal(installedAdapter.version, pack.version);

  // Use the existing real browser fixture, including flowchart and sequence
  // diagrams, edge paths, translated node labels and data-hook lookup.
  const fixture = join(root, 'examples/mermaid-basic');
  for (const file of ['index.html', 'main.ts', 'styles.css']) {
    await cp(join(fixture, file), join(workdir, file));
  }

  server = await createServer({
    root: workdir,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: false }
  });
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address !== 'string', 'Vite did not bind a test port');
  browser = await chromium.launch();

  for (const viewport of [
    { name: 'desktop', width: 1200, height: 800 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    // axe-core requires an explicit browser context rather than the
    // convenience browser.newPage() context which cannot be reused safely.
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    try {
      await page.goto(`http://127.0.0.1:${address.port}/`, {
        waitUntil: 'networkidle', timeout: 45000
      });
      await page.waitForFunction(() => window.__annotationsExample?.anchorIds?.length === 7,
        null, { timeout: 35000 });

      const evidence = await page.evaluate(() => {
        const data = window.__annotationsExample;
        const notes = document.querySelectorAll('.pa-annotation');
        const flowchart = document.querySelector('#flowchart svg');
        const sequence = document.querySelector('#sequence svg');
        return {
          anchorIds: data.anchorIds,
          validationOk: data.validation.ok,
          alignmentOk: data.targetAlignment?.ok ?? false,
          alignmentWarnings: data.targetAlignment?.warningCount ?? 0,
          annotationsRendered: notes.length,
          connectorCount: document.querySelectorAll('.pa-annotation__connector').length,
          renderedFlowchartNodes: flowchart?.querySelectorAll('g.node').length ?? 0,
          renderedEdges: data.renderedEdges,
          renderedActors: sequence?.querySelectorAll('[data-participant-id]').length ?? 0,
          renderedMessages: sequence?.querySelectorAll('[data-message-id]').length ?? 0,
          translatedHooks: data.renderedTranslatedHooks,
          obstacleCount: data.obstacles?.length ?? 0,
          pathHooks: document.querySelectorAll('#flowchart [data-edge-id], #sequence [data-edge-id]').length,
          source: data.anchorSource
        };
      });

      assert.equal(pageErrors.length, 0, `${viewport.name} browser errors: ${pageErrors.join('; ')}`);
      assert.equal(evidence.validationOk, true, `${viewport.name}: Mermaid 12 anchor validation failed`);
      assert.equal(evidence.alignmentOk, true, `${viewport.name}: Mermaid 12 target alignment failed`);
      assert.equal(evidence.alignmentWarnings, 0, `${viewport.name}: Mermaid 12 target warnings`);
      assert.equal(evidence.annotationsRendered, 7, `${viewport.name}: expected seven rendered annotations`);
      assert.equal(evidence.connectorCount, 7, `${viewport.name}: expected seven generated connectors`);
      assert.ok(evidence.renderedFlowchartNodes >= 3, `${viewport.name}: Mermaid flowchart nodes missing`);
      assert.ok(evidence.renderedEdges >= 3, `${viewport.name}: Mermaid 12 edges missing`);
      assert.ok(evidence.renderedActors >= 2, `${viewport.name}: sequence actors missing`);
      assert.ok(evidence.renderedMessages >= 1, `${viewport.name}: sequence messages missing`);
      assert.ok(evidence.translatedHooks >= 1, `${viewport.name}: translated node hook missing`);
      assert.ok(evidence.obstacleCount >= 3, `${viewport.name}: no extracted diagram obstacles`);
      assert.ok(evidence.pathHooks >= 2, `${viewport.name}: path hooks absent`);
      assert.equal(evidence.source, 'mermaid-svg');
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      assert.equal(audit.violations.length, 0,
        `${viewport.name}: Mermaid 12 WCAG violations: ${audit.violations.map((item) => `${item.id} (${item.impact})`).join(', ')}`);
      results.push({ viewport: viewport.name, ...evidence, wcagViolations: audit.violations.length });
    } catch (error) {
      throw new Error(`Mermaid 12 ${viewport.name} compatibility failed: ${error instanceof Error ? error.message : String(error)}. Page errors: ${pageErrors.join('; ')}`, { cause: error });
    } finally {
      await context.close();
    }
  }

  writeLine(JSON.stringify({
    lane: 'mermaid12-clean-consumer',
    runtimeNode: process.version,
    hostMermaid: installed.version,
    annotationsPackage: installedAdapter.version,
    results
  }, null, 2));
} finally {
  await browser?.close();
  await server?.close();
  await rm(workdir, { recursive: true, force: true });
}
