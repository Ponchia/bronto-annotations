/**
 * GitHub Pages static distribution.
 * Compile the actual application examples, then add an editorial entry point
 * and navigable HTML documentation. The npm package excludes site assets.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  cp,
  copyFile,
  rm,
} from 'node:fs/promises';
import { resolve, join, relative, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const exampleCatalog = JSON.parse(await readFile(join(root, 'examples/catalog.json'), 'utf8'));
const exampleNames = Object.keys(exampleCatalog);
const titles = {
  'getting-started': 'Start here: your first annotation',
  'context-quickstart': 'Choose your host',
  'core-guide': 'Core layout and geometry',
  'presets-guide': 'Presets and d3-style migration',
  'react-guide': 'React rendering and editing',
  'adapter-guide': 'DOM and generated-surface adapters',
  'styling-guide': 'Styling annotations',
  troubleshooting: 'Troubleshooting',
  'worker-layout': 'Experimental Worker recipe',
  'integration-recipes': 'Integration recipes',
  'api-reference': 'API reference',
  accessibility: 'Accessible annotations',
  compatibility: 'Compatibility and environments',
  'api-stability': 'API stability and versioning',
  'migration-guide': 'Migrating existing annotations',
  'migration-0.7': 'Upgrading to the 0.7 API',
  performance: 'Performance and stress testing',
  'placement-quality': 'Placement quality and evidence',
  'upstream-consumers': 'Upstream consumer validation',
  'security-automation': 'Security and development',
  release: 'Releases and publishing',
};
const maintainerDocs = new Set(['security-automation', 'release']);
const primaryDocs = Object.keys(titles).filter((name) => !maintainerDocs.has(name));
const guideSummaries = {
  'getting-started': 'Install the package, run a complete example, and render your first note in SVG or React.',
  'context-quickstart': 'Choose the entry point that matches the chart, diagram, or DOM content you already render.',
  'core-guide': 'Automatic and manual placement, coordinate geometry, connector options, and layout diagnostics.',
  'presets-guide': 'Callout types and the migration bridge for d3-style annotation inputs.',
  'react-guide': 'Render SVG layers, measure notes, and commit host-owned editing changes.',
  'adapter-guide': 'Attach notes to measured DOM, Vega, Mermaid, D2, and React Flow geometry.',
  'styling-guide': 'Style notes and connectors with optional CSS, classes, and custom properties.',
  troubleshooting: 'Diagnose missing notes, coordinate offsets, wrapping, overlap, and slow edits.',
  'worker-layout': 'An advanced host-owned experiment: revisions, cancellation, and off-main-thread layouts.',
  'integration-recipes': 'Complete patterns for attaching the annotation layer to generated host surfaces.',
  'api-reference': 'Look up public types, helpers, renderer options, and adapter entry points.',
  accessibility: 'Keyboard access, screen-reader summaries, and host-owned accessible note lists.',
  compatibility: 'Tested browser, runtime, compiler, and optional peer environments.',
  'api-stability': 'Understand stable and experimental exports before choosing an integration path.',
  'migration-guide': 'Move existing d3-style and BrontoUI annotation usage onto the standalone package.',
  'migration-0.7': 'Lean layouts, opt-in diagnostics and a single source of truth for React.',
  performance: 'Read workload-specific measurements and the limits of full and incremental layouts.',
  'placement-quality': 'Reproduce geometric quality budgets and inspect complete annotated host fixtures.',
  'upstream-consumers': 'Render pinned upstream inputs and verify real browser geometry and interactions.',
  'security-automation': 'Maintainer reference for security checks and public runner safeguards.',
  release: 'Maintainer reference for tags, verification, publication, and recovery.',
};
const baseUrl = 'https://ponchia.github.io/bronto-annotations/';
// Host-and-path-limited analytics for public GitHub Pages only. The npm
// package, Vite example fixtures, local builds and other Ponchia sites remain
// uninstrumented. Cloudflare Web Analytics uses no visitor tracking cookies.
const publicAnalyticsBeacon = `<script>
  if (window.location.hostname === 'ponchia.github.io' && window.location.pathname.startsWith('/bronto-annotations/')) {
    const beacon = document.createElement('script');
    beacon.type = 'module';
    beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    beacon.setAttribute('data-cf-beacon', '{\"token\":\"a112ce8d5a06497fba89e7c9067f9b6d\",\"spa\":false}');
    document.body.appendChild(beacon);
  }
</script>`;

// Site content comes from tracked Markdown. Sanitize inline HTML as well as
// Markdown output so authored guides cannot inject active markup into Pages.
const sanitizer = createDOMPurify(new JSDOM('').window);
const esc = (input) =>
  String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const web = (pathname) => pathname.split(sep).join('/');

async function run(file, args) {
  const result = await exec(file, args, {
    cwd: root,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.stderr && /error:/i.test(result.stderr))
    console.error(result.stderr);
}

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...(await collect(file)));
    else if (entry.isFile() && extname(entry.name) === '.md')
      results.push(file);
  }
  return results.sort();
}

function rewriteMarkdownLinks(html, file) {
  return html.replace(/href="([^"]+)"/g, (_, raw) => {
    const url = raw.replaceAll('&amp;', '&');
    if (/^(?:https?:|mailto:|#|data:)/i.test(url))
      return 'href="' + esc(url) + '"';
    const match = /^([^?#]*)([?#].*)?$/.exec(url);
    const fragment = match?.[2] ?? '';
    const path = match?.[1] ?? url;
    const actual = resolve(dirname(file), path);
    // Example-directory links in guides mean runnable demos. Source-file links
    // still lead to GitHub; do not send readers to a blob URL for a directory.
    const repositoryPath = web(relative(root, actual));
    const exampleMatch = /^examples(?:\/([^/]+))?$/.exec(repositoryPath);
    if (exampleMatch && (!exampleMatch[1] || exampleNames.includes(exampleMatch[1]))) {
      return 'href="' + esc(web(relative(dirname(file), actual)) + '/' + fragment) + '"';
    }
    const rootDocs = join(root, 'docs') + sep;
    if (actual === join(root, 'README.md') || !actual.startsWith(rootDocs)) {
      const githubPath = web(relative(root, actual));
      return (
        'href="' +
        esc(
          'https://github.com/Ponchia/bronto-annotations/blob/main/' +
            githubPath +
            fragment,
        ) +
        '"'
      );
    }
    const sourceRel = web(relative(join(root, 'docs'), actual));
    const destination = sourceRel.endsWith('.md')
      ? sourceRel.slice(0, -3) + '.html'
      : sourceRel;
    const sourceDirectory = web(dirname(relative(join(root, 'docs'), file)));
    const href = web(relative(sourceDirectory, destination)) + fragment;
    return 'href="' + esc(href) + '"';
  });
}

function namedHeadings(html) {
  const fragment = JSDOM.fragment(html);
  const seen = new Map();
  for (const heading of fragment.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    // DOM textContent is a real HTML extraction, unlike stripping tags with a
    // regex (which can leave active fragments and triggered CodeQL alerts).
    const text = heading.textContent ?? '';
    const stem =
      text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .trim()
        .replace(/\s+/g, '-') || 'section';
    const count = seen.get(stem) ?? 0;
    seen.set(stem, count + 1);
    heading.id = stem + (count ? '-' + count : '');
  }
  const wrapper = fragment.ownerDocument.createElement('div');
  wrapper.append(fragment);
  return wrapper.innerHTML;
}

function header(prefix) {
  return (
    '<a class="skip-link" href="#main">Skip to content</a>' +
    '<header class="site-header"><a class="brand" href="' +
    prefix +
    '" aria-label="Bronto Annotations home"><svg aria-hidden="true" viewBox="0 0 36 36">' +
    '<path d="M5 29L15 13L25 19L31 5" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
    '<circle cx="15" cy="13" r="3"/><circle cx="31" cy="5" r="3"/></svg>' +
    '<span>bronto<span class="accent">/</span>annotations</span></a><nav aria-label="Main navigation">' +
    '<a href="' +
    prefix +
    '#playground">Playground</a><a href="' +
    prefix +
    '#examples">Examples</a><a href="' +
    prefix +
    'docs/">Documentation</a>' +
    '<a href="https://github.com/Ponchia/bronto-annotations">GitHub ↗</a></nav></header>'
  );
}
function footer(prefix) {
  return (
    '<footer class="site-footer container"><div><a href="' +
    prefix +
    '" class="footer-brand">bronto<span class="accent">/</span>annotations</a>' +
    '<p>Annotations for the interfaces you already build.</p></div>' +
    '<nav aria-label="Footer links"><a href="' +
    prefix +
    'docs/">Docs</a>' +
    '<a href="' +
    prefix +
    'examples/index/">Lab</a>' +
    '<a href="https://github.com/Ponchia/bronto-annotations">GitHub</a>' +
    '<a href="https://www.npmjs.com/package/@ponchia/annotations">npm</a>' +
    '<a href="https://brontolotto.observer/">Maintainer</a>' +
    '<a href="https://ko-fi.com/ponchia">Support on Ko-fi</a></nav>' +
    '<small>MIT licensed</small></footer>'
  );
}
function shell({
  title,
  description,
  canonical,
  prefix,
  body,
  searchScript = false,
}) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<meta name="theme-color" content="#f6f7f6"/>' +
    '<title>' +
    esc(title) +
    ' — Bronto Annotations</title>' +
    '<meta name="description" content="' +
    esc(description) +
    '"/>' +
    '<link rel="canonical" href="' +
    esc(canonical) +
    '"/>' +
    '<link rel="icon" type="image/svg+xml" href="' +
    prefix +
    'favicon.svg"/>' +
    '<link rel="stylesheet" href="' +
    prefix +
    'site.css"/>' +
    '</head><body>' +
    header(prefix) +
    '<main id="main">' +
    body +
    '</main>' +
    footer(prefix) +
    publicAnalyticsBeacon +
    (searchScript
      ? '<script src="' + prefix + 'docs.js" defer></script>'
      : '') +
    '</body></html>'
  );
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await run('npx', [
  'vite',
  'build',
  'site',
  '--base=./',
  '--outDir=../_site',
  '--emptyOutDir',
]);
// The landing page is compiled from site/index.html by Vite. Inject the same
// inert-until-public beacon into that finished HTML, not into the app source.
const landingPath = join(out, 'index.html');
const landingHtml = await readFile(landingPath, 'utf8');
if (!landingHtml.includes('</body>'))
  throw new Error('Vite landing page is missing closing body tag');
await writeFile(landingPath, landingHtml.replace('</body>', publicAnalyticsBeacon + '</body>'));

await copyFile(join(root, 'site/site.css'), join(out, 'site.css'));
await copyFile(join(root, 'site/favicon.svg'), join(out, 'favicon.svg'));
await cp(join(root, 'site/media'), join(out, 'media'), { recursive: true });
await copyFile(join(root, 'site/docs.js'), join(out, 'docs.js'));

const pages = [];
for (const name of exampleNames) {
  await run('npx', [
    'vite',
    'build',
    'examples/' + name,
    '--base=./',
    '--outDir',
    '../../_site/examples/' + name,
    '--emptyOutDir',
  ]);
  pages.push('examples/' + name + '/');
}

const docsRoot = join(root, 'docs');
const docsFiles = await collect(docsRoot);
for (const file of docsFiles) {
  const source = await readFile(file, 'utf8');
  const rel = web(relative(docsRoot, file));
  const slug = rel.slice(0, -3);
  const directoryDepth = slug.split('/').length;
  const prefix = '../'.repeat(directoryDepth);
  const text = source.match(/^#\s+([^\n]+)/m)?.[1] ?? slug.replaceAll('-', ' ');
  const heading = titles[slug] ?? text;
  let parsed = sanitizer.sanitize(String(marked.parse(source)), {
    USE_PROFILES: { html: true },
  });
  // Preserve keyboard scrolling for code fences that overflow on narrow screens.
  parsed = parsed.replace(/<pre(?:\s+[^>]*)?>/g, (tag) =>
    tag.replace(
      /<pre/,
      '<pre tabindex="0" aria-label="Scrollable code example"',
    ),
  );
  parsed = parsed.replace(
    /<table>/g,
    '<table tabindex="0" aria-label="Scrollable reference table">',
  );
  parsed = rewriteMarkdownLinks(parsed, file);
  parsed = namedHeadings(parsed);
  // Native disclosure keeps longer guides navigable without a new JS runtime.
  // Derive links from the actual rendered headings, never a duplicated list.
  const fragment = JSDOM.fragment(parsed);
  const sections = [...fragment.querySelectorAll('h2')];
  if (sections.length >= 2) {
    const contents = fragment.ownerDocument.createElement('details');
    contents.className = 'docs-contents';
    const summary = fragment.ownerDocument.createElement('summary');
    summary.textContent = 'On this page';
    contents.append(summary);
    const nav = fragment.ownerDocument.createElement('nav');
    nav.setAttribute('aria-label', 'On this page');
    const list = fragment.ownerDocument.createElement('ul');
    for (const heading of sections) {
      const item = fragment.ownerDocument.createElement('li');
      const link = fragment.ownerDocument.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent;
      item.append(link);
      list.append(item);
    }
    nav.append(list);
    contents.append(nav);
    const title = fragment.querySelector('h1');
    if (title) title.after(contents);
    const wrapper = fragment.ownerDocument.createElement('div');
    wrapper.append(fragment);
    parsed = wrapper.innerHTML;
  }
  const sidebar =
    '<aside class="docs-sidebar" aria-label="Documentation topics">' +
    '<h2>Documentation</h2><a class="sidebar-index" href="' +
    prefix +
    'docs/">← All docs</a>' +
    primaryDocs
      .map((key) => {
        const href = prefix + 'docs/' + key + '.html';
        const current = key === slug ? ' aria-current="page"' : '';
        return (
          '<a href="' + href + '"' + current + '>' + esc(titles[key]) + '</a>'
        );
      })
      .join('') +
    '</aside>';
  const body =
    '<div class="container docs-hero"><p class="eyebrow">DOCUMENTATION / ' +
    esc(slug.toUpperCase()) +
    '</p></div><div class="container docs-layout"><article class="docs-prose">' +
    parsed +
    '<div class="docs-source"><a href="https://github.com/Ponchia/bronto-annotations/blob/main/docs/' +
    esc(rel) +
    '">Edit Markdown source ↗</a><a href="' +
    prefix +
    'docs/">All docs ↗</a></div></article>' +
    sidebar +
    '</div>';
  const location = join(out, 'docs', slug + '.html');
  await mkdir(dirname(location), { recursive: true });
  await writeFile(
    location,
    shell({
      title: heading,
      description: 'Bronto Annotations: ' + heading,
      canonical: baseUrl + 'docs/' + slug + '.html',
      prefix,
      body,
    }),
  );
  pages.push('docs/' + slug + '.html');
}
// The reference JSON resources remain linkable from Markdown pages without
// silently changing source documents or rewriting their technical examples.
async function copyReferenceJson(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) await copyReferenceJson(source);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      const destination = join(out, 'docs', relative(docsRoot, source));
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
  }
}
await copyReferenceJson(docsRoot);
// Put the current guides before historical audits and archived evidence.
const orderedDocsFiles = [...docsFiles].sort((a, b) => {
  const key = (file) => web(relative(docsRoot, file)).slice(0, -3);
  const rank = (file) => primaryDocs.indexOf(key(file));
  const left = rank(a) < 0 ? 1000 : rank(a);
  const right = rank(b) < 0 ? 1000 : rank(b);
  return left - right || key(a).localeCompare(key(b));
});
// Authored docs link to their ADR directory. Publish an actual directory
// index rather than silently turning the link into a broken page.
const adrFiles = docsFiles.filter((file) =>
  web(relative(docsRoot, file)).startsWith('adr/'),
);
const adrItems = adrFiles
  .map((file) => {
    const rel = web(relative(docsRoot, file));
    const title = rel
      .split('/')
      .at(-1)
      .replace(/\.md$/, '')
      .replaceAll('-', ' ');
    return (
      '<li><a href="./' +
      esc(rel.split('/').at(-1).replace(/\.md$/, '.html')) +
      '">' +
      esc(title) +
      '</a></li>'
    );
  })
  .join('');
await writeFile(
  join(out, 'docs/adr/index.html'),
  shell({
    title: 'Architecture decisions',
    description:
      'Why the annotation engine is independent from BrontoUI and how its public API is organized.',
    canonical: baseUrl + 'docs/adr/',
    prefix: '../../',
    body:
      '<div class="container docs-hero"><p class="eyebrow">DESIGN DECISIONS</p>' +
      '<h1>Architecture decisions.</h1><p>Accepted public design decisions behind the annotation package.</p>' +
      '<ul>' +
      adrItems +
      '</ul></div>',
  }),
);
pages.push('docs/adr/');
const listing = orderedDocsFiles.map((file) => {
  const rel = web(relative(docsRoot, file));
  const slug = rel.slice(0, -3);
  const sourceName = slug.split('/').at(-1).replaceAll('-', ' ');
  const title =
    titles[slug] ?? sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
  return {
    slug,
    title,
    summary:
      guideSummaries[slug] ?? 'Maintainer reference, accepted decisions, or historical verification evidence; check the recorded scope.',
  };
});
const renderCards = (items) => items
  .map(
    ({ slug, title, summary }) =>
      '<article class="doc-card" data-doc-card data-search="' +
      esc(
        (
          title +
          ' ' +
          slug.replaceAll('-', ' ').replaceAll('/', ' ') + ' ' + summary
        ).toLowerCase(),
      ) +
      '"><h2>' +
      esc(title) +
      '</h2><p>' +
      esc(summary) +
      '</p><a href="./' +
      esc(slug) +
      '.html">Read guide ↗</a></article>',
  )
  .join('');
const docsHome =
  '<section class="container docs-hero"><p class="eyebrow">DOCUMENTATION / START HERE</p>' +
  '<h1>Add your first annotation.<br/>Then choose your host.</h1>' +
  '<p>Choose the host you already use. Start with a short complete example, then open the API reference and specialized adapter guides as needed.</p>' +
  '<label for="docs-filter" class="eyebrow">SEARCH THE REFERENCE</label>' +
  '<input type="search" id="docs-filter" class="docs-search" placeholder="Find a guide, adapter, or integration..." autocomplete="off"/>' +
  '<p class="docs-filter-empty" id="docs-filter-empty" role="status">No documentation pages match that search.</p>' +
  '</section><section class="container" data-doc-group aria-label="Current package guides"><h2>Using the package</h2>' +
  '<div class="docs-card-grid" id="docs-results">' +
  renderCards(listing.filter(({ slug }) => primaryDocs.includes(slug))) +
  '</div></section><section class="container" data-doc-group aria-label="Reference and historical evidence">' +
  '<h2>Maintainer reference and historical evidence</h2>' +
  '<p>These documents retain design decisions, verification records, and earlier plans. ' +
  'They are not the starting point for a new integration or a guarantee for every consumer.</p>' +
  '<div class="docs-card-grid">' +
  renderCards(listing.filter(({ slug }) => !primaryDocs.includes(slug))) +
  '</div></section>';
await writeFile(
  join(out, 'docs/index.html'),
  shell({
    title: 'Documentation',
    description: 'Guides, recipes and API reference for Bronto Annotations.',
    canonical: baseUrl + 'docs/',
    prefix: '../',
    body: docsHome,
    searchScript: true,
  }),
);
pages.push('docs/');
const exampleRows = exampleNames
  .filter((name) => name !== 'index')
  .map((name) => {
    const example = exampleCatalog[name];
    return '<article class="doc-card"><h2>' + esc(example.title) +
      '</h2><p>' + esc(example.summary) + '</p><a href="./' + name +
      '/">Open demo ↗</a> · <a href="https://github.com/Ponchia/bronto-annotations/tree/main/examples/' +
      name + '">Source and setup ↗</a></article>';
  }).join('');
await writeFile(
  join(out, 'examples/index.html'),
  shell({
    title: 'Examples and the laboratory',
    description:
      'Runnable examples of Bronto Annotations across SVG, reports, DOM, React, Vega, Mermaid, D2, and React Flow.',
    canonical: baseUrl + 'examples/',
    prefix: '../',
    body:
      '<section class="container docs-hero"><p class="eyebrow">THE LABORATORY</p>' +
      '<h1>Actual renderers.<br/>Real annotations.</h1><p>Start with SVG figure or React annotation layer. Each demo includes source and setup instructions. The editor and Worker are advanced host-owned recipes.</p>' +
      '<p><a href="../docs/getting-started.html">First annotation guide ↗</a> · ' +
      '<a href="https://github.com/Ponchia/bronto-annotations/blob/main/examples/README.md">Run the examples locally ↗</a></p></section>' +
      '<section class="container"><div class="docs-card-grid">' +
      exampleRows +
      '</div><p><a href="./index/">Open the annotated visual index ↗</a></p></section>',
  }),
);
pages.push('examples/');
await writeFile(
  join(out, 'robots.txt'),
  'User-agent: *\nAllow: /\nSitemap: ' + baseUrl + 'sitemap.xml\n',
);
const paths = ['', ...pages];
await writeFile(
  join(out, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    paths
      .map((p) => '<url><loc>' + esc(baseUrl + p) + '</loc></url>')
      .join('') +
    '</urlset>\n',
);
console.log(
  'Public site built: ' +
    docsFiles.length +
    ' documentation pages, ' +
    exampleNames.length +
    ' actual Vite examples and an interactive product homepage.',
);
