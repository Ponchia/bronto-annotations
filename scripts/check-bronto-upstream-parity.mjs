import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const upstreamRoot = resolve(
  cliValue('--ui-root')
  ?? process.env.PONCHIA_UI_ROOT
  ?? resolve(root, '..', 'bronto-ui')
);
const requireUpstream = process.argv.includes('--require') || process.env.PONCHIA_REQUIRE_UPSTREAM_UI === '1';

if (!await exists(upstreamRoot)) {
  const message = `Skipped upstream Bronto UI parity: ${upstreamRoot} does not exist. Set PONCHIA_UI_ROOT or pass --ui-root to compare a local @ponchia/ui checkout.`;

  if (requireUpstream) {
    throw new Error(message);
  }

  console.log(message);
  process.exit(0);
}

const parity = JSON.parse(await readFile(new URL('../docs/bronto-ui-annotation-parity.json', import.meta.url), 'utf8'));
const bridgeCss = await readFile(new URL('../src/styles/bronto.css', import.meta.url), 'utf8');
const upstreamCss = await readFile(resolve(upstreamRoot, 'css/annotations.css'), 'utf8');
const upstreamHelpers = await readFile(resolve(upstreamRoot, 'annotations/index.js'), 'utf8');
const core = await import('@ponchia/annotations');

const upstreamSelectors = selectors(upstreamCss);
const upstreamExports = [...upstreamHelpers.matchAll(/export function (\w+)/g)].map((match) => match[1]).sort();
const upstreamProperties = customProperties(upstreamCss).filter((property) => property.startsWith('--annotation-'));
const upstreamKeyframes = [...upstreamCss.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)].map((match) => match[1]).sort();
const upstreamDeclarationIndex = legacyDeclarationIndex(upstreamCss);
const bridgeDeclarationIndex = legacyDeclarationIndex(bridgeCss);

assert.deepEqual(
  missing(upstreamSelectors, parity.legacySelectors),
  [],
  'docs/bronto-ui-annotation-parity.json is missing upstream .ui-annotation selectors'
);
assert.deepEqual(
  missing(upstreamSelectors, selectors(bridgeCss)),
  [],
  'src/styles/bronto.css is missing upstream .ui-annotation selectors'
);
assert.deepEqual(
  missing(upstreamExports, parity.helperExports),
  [],
  'docs/bronto-ui-annotation-parity.json is missing upstream annotation helpers'
);
assert.deepEqual(
  upstreamExports.filter((helper) => typeof core[helper] !== 'function'),
  [],
  'root package export is missing upstream annotation helper functions'
);
assert.deepEqual(
  missing(upstreamProperties, customProperties(bridgeCss)),
  [],
  'src/styles/bronto.css is missing upstream annotation custom properties'
);
assert.deepEqual(
  missing(upstreamKeyframes, parity.keyframes),
  [],
  'docs/bronto-ui-annotation-parity.json is missing upstream annotation keyframes'
);
assert.deepEqual(
  missing(upstreamKeyframes, keyframes(bridgeCss)),
  [],
  'src/styles/bronto.css is missing upstream annotation keyframes'
);

const missingDeclarations = [];

for (const [selector, properties] of upstreamDeclarationIndex) {
  const bridgeProperties = bridgeDeclarationIndex.get(selector) ?? new Set();

  for (const property of properties) {
    if (!bridgeProperties.has(property)) {
      missingDeclarations.push(`${selector} { ${property} }`);
    }
  }
}

assert.deepEqual(
  missingDeclarations,
  [],
  'src/styles/bronto.css is missing upstream legacy annotation CSS declarations'
);

const declarationCount = [...upstreamDeclarationIndex.values()]
  .reduce((count, properties) => count + properties.size, 0);

console.log(`Upstream Bronto UI parity verified: ${upstreamSelectors.length} selectors, ${declarationCount} legacy CSS declarations, ${upstreamExports.length} helpers, ${upstreamKeyframes.length} keyframes from ${upstreamRoot}.`);

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
