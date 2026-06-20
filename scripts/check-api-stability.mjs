import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import ts from 'typescript';
import { writeLine } from './log.mjs';

const root = new URL('..', import.meta.url);
const manifestUrl = new URL('../docs/api-stability.manifest.json', import.meta.url);
const writeManifest = process.argv.includes('--write-manifest');
const publicSubpaths = {
  '.': { source: 'src/index.ts', requiresExperimental: true },
  './react': { source: 'src/react/index.ts', requiresExperimental: true },
  './dom': { source: 'src/dom/index.ts', requiresExperimental: true },
  './vega': { source: 'src/adapters/vega.ts', requiresExperimental: true },
  './mermaid': { source: 'src/adapters/mermaid.ts', requiresExperimental: true },
  './d2': { source: 'src/adapters/d2.ts', requiresExperimental: true },
  './react-flow': { source: 'src/adapters/react-flow.ts', requiresExperimental: true },
  './bronto.css': { source: 'src/styles/bronto.css.d.ts', css: true }
};

const pkg = JSON.parse(await read('package.json'));
const apiStability = await read('docs/api-stability.md');
const actualSubpaths = Object.fromEntries(await Promise.all(
  Object.entries(publicSubpaths).map(async ([subpath, metadata]) => [
    subpath,
    {
      ...metadata,
      exports: metadata.css ? ['bronto.css'] : collectPublicExports(metadata.source),
      sourceText: await read(metadata.source)
    }
  ])
));

for (const subpath of Object.keys(publicSubpaths)) {
  assert.ok(pkg.exports?.[subpath], `package.json exports is missing public subpath ${subpath}`);
}

if (writeManifest) {
  await writeApiStabilityManifest(actualSubpaths);
  writeLine(`API stability manifest updated: ${Object.keys(actualSubpaths).length} public subpaths.`);
} else {
  await assertApiStabilityManifest(actualSubpaths);
  writeLine(`API stability verified: ${Object.keys(actualSubpaths).length} public subpaths with explicit stable/experimental labels.`);
}

async function assertApiStabilityManifest(actualSubpaths) {
  const manifest = JSON.parse(await read('docs/api-stability.manifest.json'));

  assert.equal(manifest.schemaVersion, 1, 'API stability manifest schemaVersion must be 1');
  assert.equal(manifest.package, '@ponchia/annotations', 'API stability manifest package must match package name');
  assert.equal(manifest.policy, '0.1.x', 'API stability policy must be 0.1.x');
  assert.deepEqual(
    Object.keys(manifest.subpaths).sort(),
    Object.keys(actualSubpaths).sort(),
    'API stability manifest must cover every public subpath'
  );

  for (const [subpath, actual] of Object.entries(actualSubpaths)) {
    const entry = manifest.subpaths[subpath];

    assert.equal(entry.source, actual.source, `${subpath} source path must match`);
    assert.ok(actual.sourceText.includes('@public'), `${actual.source} must include an @public stability note`);

    if (actual.requiresExperimental) {
      assert.ok(actual.sourceText.includes('@experimental'), `${actual.source} must include an @experimental stability note`);
    }

    const stable = [...entry.stable].sort();
    const experimental = [...entry.experimental].sort();
    const duplicate = stable.find((name) => experimental.includes(name));

    assert.equal(duplicate, undefined, `${subpath} export ${duplicate} cannot be both stable and experimental`);
    assert.deepEqual(
      [...new Set([...stable, ...experimental])].sort(),
      actual.exports,
      `${subpath} stable/experimental labels must cover all public exports`
    );

    for (const name of experimental) {
      assert.equal(isExperimentalExport(subpath, name), true, `${subpath} ${name} is unexpectedly experimental`);
    }

    for (const name of stable) {
      assert.equal(isExperimentalExport(subpath, name), false, `${subpath} ${name} should be experimental according to policy`);
    }
  }

  for (const term of [
    'docs/api-stability.manifest.json',
    '@public',
    '@experimental',
    'test:api-stability'
  ]) {
    assert.ok(apiStability.includes(term), `docs/api-stability.md must include ${JSON.stringify(term)}`);
  }
}

async function writeApiStabilityManifest(actualSubpaths) {
  const manifest = {
    schemaVersion: 1,
    package: '@ponchia/annotations',
    policy: '0.1.x',
    description: 'Stable and experimental public export labels for the 0.1.x API contract.',
    updateCommand: 'node scripts/check-api-stability.mjs --write-manifest',
    subpaths: Object.fromEntries(Object.entries(actualSubpaths).map(([subpath, actual]) => {
      const stable = [];
      const experimental = [];

      for (const name of actual.exports) {
        if (isExperimentalExport(subpath, name)) {
          experimental.push(name);
        } else {
          stable.push(name);
        }
      }

      return [subpath, {
        source: actual.source,
        stable,
        experimental
      }];
    }))
  };

  await mkdir(dirname(manifestUrl.pathname), { recursive: true });
  await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
}

function collectPublicExports(source) {
  const text = ts.sys.readFile(new URL(`../${source}`, import.meta.url).pathname);
  assert.ok(text, `Could not read ${source}`);

  const sourceFile = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = [];

  function add(name) {
    if (name && name !== 'default') {
      names.push(name);
    }
  }

  function visit(node) {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const exported = modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

    if (exported && ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        add(declaration.name.getText(sourceFile));
      }
    } else if (exported && (
      ts.isClassDeclaration(node)
      || ts.isEnumDeclaration(node)
      || ts.isFunctionDeclaration(node)
      || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node)
    )) {
      add(node.name?.text);
    } else if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        add((element.propertyName ?? element.name).text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return [...new Set(names)].sort();
}

function isExperimentalExport(subpath, name) {
  if (subpath === '.') {
    return rootExperimental(name);
  }

  if (subpath === './react') {
    return name === 'AnnotationLayerEditEvent' || name === 'AnnotationLayerEditOptions';
  }

  if (subpath === './vega') {
    return name === 'anchorFromVegaDatum' || name === 'findVegaSvgElement';
  }

  if (subpath === './mermaid') {
    return name === 'findElementByText' || name === 'findMermaidElement';
  }

  if (subpath === './d2') {
    return name === 'allD2Connections' || name === 'allD2Shapes' || name === 'findD2SvgElement';
  }

  if (subpath === './react-flow') {
    return name === 'handleBox' || name === 'handlePoint' || name === 'nodeBox';
  }

  return false;
}

function rootExperimental(name) {
  return name.includes('D3')
    || name.includes('Edit')
    || [
      'allPlacementCandidates',
      'annotationEditHandles',
      'annotationEditPatch',
      'applyAnnotationEdit',
      'applyAnnotationEdits',
      'candidateNoteBox',
      'getCandidateSides',
      'resolvePlacementCandidate',
      'scorePlacementCandidate',
      'translateAnchor'
    ].includes(name);
}

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}
