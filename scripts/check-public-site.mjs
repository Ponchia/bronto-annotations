/**
 * Verify the generated GitHub Pages artifact without trusting a browser-only
 * smoke test. The checker is deliberately independent of GitHub availability.
 */
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, dirname, relative, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '_site');
const hostname = 'https://ponchia.github.io/bronto-annotations/';
const examples = [
  'index',
  'svg-basic',
  'react-basic',
  'react-incremental',
  'react-worker',
  'bronto-report',
  'dom-basic',
  'vega-basic',
  'mermaid-basic',
  'd2-basic',
  'react-flow-basic',
  'style-gallery',
];
const required = [
  'index.html',
  'docs/index.html',
  'docs/context-quickstart.html',
  'docs/getting-started.html',
  'docs/troubleshooting.html',
  'docs/core-guide.html',
  'docs/react-guide.html',
  'docs/adapter-guide.html',
  'docs/integration-recipes.html',
  'docs/api-reference.html',
  'examples/index.html',
  'favicon.svg',
  'site.css',
  'media/social.jpg',
  ...examples.map((x) => 'examples/' + x + '/index.html'),
];
const imageNames = [
  'svg-basic',
  'react-flow-basic',
  'vega-basic',
  'mermaid-basic',
];
for (const name of imageNames) required.push('media/' + name + '.jpg');
const files = [];

async function collect(folder) {
  const names = await readdir(folder, { withFileTypes: true });
  for (const item of names) {
    const p = join(folder, item.name);
    if (item.isDirectory()) await collect(p);
    if (item.isFile()) files.push(p);
  }
}
await collect(target);
const existing = new Set(
  files.map((x) => relative(target, x).split('\\').join('/')),
);
for (const name of required)
  assert(existing.has(name), 'Missing published file: ' + name);
assert(
  [...existing].filter((x) => x.startsWith('docs/') && x.endsWith('.html'))
    .length >= 25,
  'Complete static HTML documentation index required',
);
assert(
  examples.every((x) => existing.has('examples/' + x + '/index.html')),
  'All twelve actual Vite example fixtures must be published',
);

const pages = [...existing].filter((x) => extname(x) === '.html');
let links = 0;
const anchors = new Map();
const fragmentLinks = [];
for (const rel of pages) {
  const doc = new JSDOM(await readFile(join(target, rel), 'utf8'));
  const html = doc.window.document;
  anchors.set(rel, new Set([...html.querySelectorAll('[id]')].map((node) => node.id)));
  assert(
    html.querySelector('html[lang="en"]'),
    'Missing document language: ' + rel,
  );
  assert(html.querySelector('title')?.textContent, 'Missing title: ' + rel);
  const published = JSON.parse(await readFile(join(target, 'release-status.json'), 'utf8'));
  const notices = html.querySelectorAll('[data-release-notice]');
  assert.equal(notices.length, 1, 'Every direct entry needs a version notice: ' + rel);
  assert.equal(notices[0].getAttribute('data-source-version'), published.sourceVersion);
  assert.equal(notices[0].getAttribute('data-stable-version'), published.stableVersion);
  assert(notices[0].textContent.includes(published.stableVersion));
  const identity = notices[0].querySelector('[data-release-identity]');
  const disclosure = notices[0].querySelector('details');
  assert(identity && disclosure, 'Version identity and install disclosure required: ' + rel);
  assert(!disclosure.contains(identity), 'Source/stable identity must stay visible when collapsed: ' + rel);
  assert(!disclosure.hasAttribute('open'), 'Version guidance must start collapsed: ' + rel);
  assert.equal(disclosure.firstElementChild?.tagName, 'SUMMARY');
  assert.equal(identity.querySelector('a')?.getAttribute('href'), published.stableDocs);
  assert(disclosure.textContent.includes(published.stableInstall), 'Exact stable install missing: ' + rel);
  if (published.previewVersion) {
    assert(disclosure.textContent.includes('npm install @ponchia/annotations@' + published.previewVersion));
    assert.equal(disclosure.querySelector('[data-candidate-docs]')?.getAttribute('href'),
      `https://github.com/Ponchia/bronto-annotations/blob/v${published.previewVersion}/docs/README.md`);
  }
  if (!published.sourcePublished) {
    assert(disclosure.textContent.includes('Publication of this source is not confirmed'));
    assert(!disclosure.textContent.includes('npm install @ponchia/annotations@' + published.sourceVersion));
  }
  // Only the public editorial site is instrumented; package and independent
  // interactive example fixtures must not inherit website analytics.
  const editorial = rel === 'index.html' || rel.startsWith('docs/') || rel === 'examples/index.html';
  const beacons = [...html.querySelectorAll('script')].filter((node) =>
    node.textContent.includes('static.cloudflareinsights.com/beacon.min.js'),
  );
  assert.equal(beacons.length, Number(editorial), 'Unexpected analytics script in ' + rel);
  if (editorial) {
    assert.match(beacons[0].textContent, /window\.location\.hostname === 'ponchia\.github\.io'/);
    assert.match(beacons[0].textContent, /window\.location\.pathname\.startsWith\('\/bronto-annotations\/\'\)/);
    assert.match(beacons[0].textContent, /beacon\.setAttribute\('data-cf-beacon'/);
  }

  // Actual example fixtures have their own layout contract, and source links
  // are on the editorial pages rather than the test fixture itself.
  // Authored Markdown may contain HTML snippets. The static docs renderer
  // must never ship active HTML (inline script/event handlers). Search UI JS
  // is independently authored and allowed only on the docs index.
  if (rel.startsWith('docs/') && rel !== 'docs/index.html') {
    assert.equal(
      html.querySelectorAll('script').length, 1,
      'Generated Markdown must not add scripts beyond the approved analytics loader: ' + rel,
    );
    assert.equal(
      html.querySelectorAll('iframe,object,embed,form').length,
      0,
      'Unsafe active HTML in generated documentation: ' + rel,
    );
    for (const el of html.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) {
        assert(!/^on/i.test(attr.name), 'Inline handler in ' + rel);
      }
    }
  }
  if (rel === 'index.html' || rel.startsWith('docs/')) {
    assert(
      html.querySelector('main'),
      'Editorial page has no main landmark: ' + rel,
    );
  }
  for (const node of html.querySelectorAll('[href],[src]')) {
    const raw = node.getAttribute('href') ?? node.getAttribute('src');
    if (
      !raw ||
      raw.startsWith('data:') ||
      raw.startsWith('mailto:')
    )
      continue;
    const url = new URL(raw, new URL(rel, hostname));
    if (
      url.origin !== new URL(hostname).origin ||
      !url.pathname.startsWith('/bronto-annotations/')
    )
      continue;
    const location = decodeURIComponent(url.pathname).replace(
      /^\/bronto-annotations\/?/,
      '',
    );
    let resolved =
      location === ''
        ? 'index.html'
        : location.endsWith('/')
          ? location + 'index.html'
          : location;
    if (!existing.has(resolved) && existing.has(resolved + '/index.html'))
      resolved += '/index.html';
    assert(
      existing.has(resolved),
      'Broken published link from ' + rel + ': ' + raw + ' -> ' + resolved,
    );
    if (url.hash && extname(resolved) === '.html') {
      fragmentLinks.push({ source: rel, target: resolved, id: decodeURIComponent(url.hash.slice(1)), raw });
    }
    links++;
  }
  doc.window.close();
}
for (const link of fragmentLinks) {
  assert(anchors.get(link.target)?.has(link.id),
    `Broken published section link from ${link.source}: ${link.raw}`);
}
const firstGuide = new JSDOM(await readFile(join(target, 'docs/getting-started.html'), 'utf8'));
const sectionLinks = firstGuide.window.document.querySelectorAll('details.docs-contents nav a[href^="#"]');
assert(sectionLinks.length >= 5, 'First-use guide must offer derived in-page section links');
firstGuide.window.close();
const homepage = await readFile(join(target, 'index.html'), 'utf8');
const home = new JSDOM(homepage);
assert(
  home.window.document.querySelector(
    '#annotation-controls input[type="range"]',
  ),
  'Product site needs live functional layout controls',
);
assert(
  home.window.document.querySelectorAll('.example-card a[href*="examples/"]')
    .length >= 4,
  'Real example links should be part of the editorial surface',
);
const strategyControl = home.window.document.querySelector('#placement-mode');
assert(strategyControl?.tagName === 'SELECT'
  && strategyControl.options.length === 2
  && strategyControl.options[0].value === 'automatic'
  && strategyControl.options[1].value === 'fixed',
  'Published playground must expose a labeled automatic/fixed baseline comparison');
assert(home.window.document.querySelector('#obstacle-overlap-count'),
  'Published placement comparison must report real obstacle overlap');
for (const [path, action] of [
  ['react-incremental', 'Try the editor'],
  ['react-worker', 'Try the Worker demo'],
]) {
  const link = home.window.document.querySelector(
    `.editing-lab a[href="./examples/${path}/"]`,
  );
  assert(link?.textContent?.includes(action),
    `Published interactive editing feature is missing: ${path}`);
}
assert(
  home.window.document.querySelector('meta[property="og:image"]'),
  'Public social preview missing',
);
assert(home.window.document.querySelector('a[href="./docs/getting-started.html"]'),
  'Homepage must lead to the complete first-annotation guide');
for (const destination of ['https://ko-fi.com/ponchia', 'https://brontolotto.observer/']) {
  assert(home.window.document.querySelector(`footer a[href="${destination}"]`),
    `Homepage footer must expose the existing support/maintainer destination: ${destination}`);
}
const chooser = new JSDOM(await readFile(join(target, 'docs/context-quickstart.html'), 'utf8'));
assert(chooser.window.document.querySelector('a[href="../examples/react-incremental/"]'),
  'Guide example links must open the live demonstration, not a GitHub blob directory');
chooser.window.close();
const catalog = new JSDOM(await readFile(join(target, 'examples/index.html'), 'utf8'));
assert.equal(catalog.window.document.querySelectorAll('.doc-card a[href^="https://github.com/Ponchia/bronto-annotations/tree/main/examples/"]').length, 11,
  'Every demo card must provide its source and setup instructions');
catalog.window.close();
home.window.close();
const index = new JSDOM(
  await readFile(join(target, 'docs/index.html'), 'utf8'),
);
assert(
  index.window.document.querySelectorAll('[data-doc-card]').length >= 25,
  'Documentation index should link to all authored docs',
);
assert(
  index.window.document
    .querySelector('[data-doc-card] h2')
    ?.textContent?.includes('Start here'),
  'Maintained first-user guides must lead the documentation index',
);
index.window.close();
const sitemap = await readFile(join(target, 'sitemap.xml'), 'utf8');
assert(sitemap.includes(hostname + 'docs/context-quickstart.html'));
assert(sitemap.includes(hostname + 'examples/svg-basic/'));
for (const name of imageNames) {
  const s = await stat(join(target, 'media', name + '.jpg'));
  assert(s.size > 10_000, 'Example image unexpectedly small: ' + name);
}
console.log(
  'Public Pages verified: ' +
    pages.length +
    ' HTML pages, ' +
    links +
    ' internal links (' + fragmentLinks.length + ' checked fragments), twelve compiled examples, docs search, social assets and a live engine playground.',
);
