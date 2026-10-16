import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeLine } from './log.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const upstreamRoot = resolve(
  cliValue('--ui-root')
  ?? process.env.PONCHIA_UI_ROOT
  ?? resolve(root, '..', 'bronto-ui')
);
const requireUpstream = process.argv.includes('--require') || process.env.PONCHIA_REQUIRE_UPSTREAM_UI === '1';

const parity = JSON.parse(await readFile(new URL('../docs/bronto-ui-annotation-parity.json', import.meta.url), 'utf8'));
const bridgeCss = await readFile(new URL('../src/styles/bronto.css', import.meta.url), 'utf8');
const core = await import('@ponchia/annotations');

assert.equal(parity.schemaVersion, 2, 'frozen Bronto UI contract must use schema version 2');
assert.match(parity.sourceSnapshot.revision, /^[a-f0-9]{40}$/);
assert.match(parity.sourceSnapshot.cssSha256, /^[a-f0-9]{64}$/);
assert.match(parity.sourceSnapshot.helperSha256, /^[a-f0-9]{64}$/);

const legacySelectors = parity.legacySelectors;
const legacyExports = parity.helperExports;
const legacyProperties = parity.customProperties.filter((property) => property.startsWith('--annotation-'));
const legacyKeyframes = parity.keyframes.filter((value) => value.startsWith('uiAnnotation'));
const frozenDeclarations = new Map(
  Object.entries(parity.legacyCssDeclarationProperties).map(([selector, props]) => [selector, new Set(props)])
);
const bridgeDeclarationIndex = legacyDeclarationIndex(bridgeCss);

assert.deepEqual(
  missing(legacySelectors, selectors(bridgeCss)),
  [],
  'src/styles/bronto.css must preserve historical .ui-annotation selectors'
);
assert.deepEqual(
  legacyExports.filter((helper) => typeof core[helper] !== 'function'),
  [],
  'root package must preserve historical Bronto UI annotation helper exports'
);
assert.deepEqual(
  missing(legacyProperties, customProperties(bridgeCss)),
  [],
  'src/styles/bronto.css must preserve historical annotation custom properties'
);
assert.deepEqual(
  missing(legacyKeyframes, keyframes(bridgeCss)),
  [],
  'src/styles/bronto.css must preserve historical annotation keyframes'
);

const missingDeclarations = [];

for (const [selector, properties] of frozenDeclarations) {
  const bridgeProperties = bridgeDeclarationIndex.get(selector) ?? new Set();
  for (const property of properties) {
    if (!bridgeProperties.has(property)) {
      missingDeclarations.push(`${selector} { ${property} }`);
    }
  }
}
assert.deepEqual(missingDeclarations, [], 'annotation CSS must retain the published legacy declaration contract');

// A checkout is extra drift evidence, never the sole source of the contract:
// Bronto UI removes its legacy annotation files after the deprecation window.
const hasCss = await exists(resolve(upstreamRoot, 'css/annotations.css'));
const hasHelpers = await exists(resolve(upstreamRoot, 'annotations/index.js'));
if (hasCss !== hasHelpers) {
  throw new Error('Local Bronto UI checkout contains only one of the two legacy files; inspect this partial removal.');
}

if (hasCss && hasHelpers) {
  const upstreamCss = await readFile(resolve(upstreamRoot, 'css/annotations.css'), 'utf8');
  const upstreamHelpers = await readFile(resolve(upstreamRoot, 'annotations/index.js'), 'utf8');
  const upstreamSelectors = selectors(upstreamCss);
  const upstreamExports = [...upstreamHelpers.matchAll(/export function (\w+)/g)].map((match) => match[1]).sort();
  const upstreamProperties = customProperties(upstreamCss).filter((property) => property.startsWith('--annotation-'));
  const upstreamKeyframes = [...upstreamCss.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((match) => match[1]).sort();

  assert.deepEqual(missing(upstreamSelectors, legacySelectors), [], 'local UI added undocumented legacy selectors');
  assert.deepEqual(missing(upstreamExports, legacyExports), [], 'local UI added undocumented legacy functions');
  assert.deepEqual(missing(upstreamProperties, legacyProperties), [], 'local UI added undocumented legacy variables');
  assert.deepEqual(missing(upstreamKeyframes, legacyKeyframes), [], 'local UI added undocumented legacy keyframes');

  const upstreamDeclarations = legacyDeclarationIndex(upstreamCss);
  for (const [selector, props] of upstreamDeclarations) {
    assert.deepEqual(
      missing([...props], [...(frozenDeclarations.get(selector) ?? [])]),
      [],
      `local UI added new legacy CSS declarations to ${selector}`
    );
  }
  writeLine(`Frozen UI annotation parity verified against local checkout ${upstreamRoot}.`);
} else if (requireUpstream) {
  throw new Error(`--require demands a local UI checkout with both legacy files: ${upstreamRoot}`);
} else {
  writeLine('Local UI legacy source absent; validating against immutable 0.16.3 contract, not skipping verification.');
}

const declarationCount = [...frozenDeclarations.values()]
  .reduce((count, properties) => count + properties.size, 0);
writeLine(`Historical Bronto UI ${parity.sourceSnapshot.version} contract: ${legacySelectors.length} selectors, ${declarationCount} CSS declarations, ${legacyExports.length} helpers, ${legacyKeyframes.length} keyframes.`);

function cliValue(name) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function selectors(css) {
  return [...new Set(css.match(/\.ui-annotation(?:[a-zA-Z0-9_-]*)(?:__(?:[a-zA-Z0-9_-]+)|--(?:[a-zA-Z0-9_-]+))?/g) ?? [])]
    .sort();
}

function customProperties(css) {
  return [...new Set(css.match(/--[a-zA-Z0-9_-]+/g) ?? [])]
    .sort();
}

function keyframes(css) {
  return [...css.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((match) => match[1]).sort();
}

function legacyDeclarationIndex(css) {
  const index = new Map();
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rulePattern = /([^{}@]+)\{([^{}]*)\}/g;
  let match;

  while ((match = rulePattern.exec(stripped)) !== null) {
    const selectorText = match[1]?.trim();
    const body = match[2] ?? '';

    if (!selectorText || !selectorText.includes('.ui-annotation')) {
      continue;
    }

    const selectorsForRule = selectorText
      .split(',')
      .map((selector) => selector.trim().replace(/\s+/g, ' '))
      .filter((selector) => selector.includes('.ui-annotation'));
    const properties = [...body.matchAll(/(^|;)\s*([a-zA-Z-][a-zA-Z0-9-]*)\s*:/g)]
      .map((propertyMatch) => propertyMatch[2])
      .filter(Boolean);

    for (const selector of selectorsForRule) {
      const selectorProperties = index.get(selector) ?? new Set();

      for (const property of properties) {
        selectorProperties.add(property);
      }

      index.set(selector, selectorProperties);
    }
  }

  return index;
}

function missing(required, actual) {
  const actualSet = new Set(actual);

  return required.filter((item) => !actualSet.has(item));
}
