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
  'All ten actual Vite example fixtures must be published',
);

const pages = [...existing].filter((x) => extname(x) === '.html');
let links = 0;
for (const rel of pages) {
  const doc = new JSDOM(await readFile(join(target, rel), 'utf8'));
  const html = doc.window.document;
  assert(
    html.querySelector('html[lang="en"]'),
    'Missing document language: ' + rel,
  );
  assert(html.querySelector('title')?.textContent, 'Missing title: ' + rel);
  // Actual example fixtures have their own layout contract, and source links
  // are on the editorial pages rather than the test fixture itself.
  // Authored Markdown may contain HTML snippets. The static docs renderer
  // must never ship active HTML (inline script/event handlers). Search UI JS
  // is independently authored and allowed only on the docs index.
  if (rel.startsWith('docs/') && rel !== 'docs/index.html') {
    assert.equal(
      html.querySelectorAll('script,iframe,object,embed,form').length,
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
      raw.startsWith('#') ||
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
    links++;
  }
  doc.window.close();
}
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
assert(
  home.window.document.querySelector('meta[property="og:image"]'),
  'Public social preview missing',
);
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
    ' internal links, ten compiled examples, docs search, social assets and a live engine playground.',
);
