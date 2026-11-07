/** Public-site chrome only: call after Vite compiles a catalog example. */
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function injectDemoNavigation(html, example, prefix = '../../') {
  if (!example || typeof example.title !== 'string' || !example.title.trim()
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(example.guide ?? '')) {
    throw new Error('Demo navigation requires catalog title and guide');
  }
  if (!/^(?:\.\/|(?:\.\.\/)+)$/.test(prefix)) throw new Error('Invalid site-relative prefix');
  if (html.includes('data-demo-navigation')) throw new Error('Duplicate demo navigation');
  if (!html.includes('</head>') || !/<body\b[^>]*>/.test(html)) {
    throw new Error('Compiled demo is missing head or body');
  }
  const navigation = `<nav class="demo-navigation" data-demo-navigation aria-label="Demo navigation">
<span class="demo-navigation-title">${escape(example.title)}</span>
<div class="demo-navigation-links">
<a href="${prefix}#playground">Playground</a>
<a href="${prefix}examples/">All examples</a>
<a href="${prefix}docs/${example.guide}.html">Integration guide</a>
</div>
</nav>`;
  // Preserve the compiled document and keep chrome outside client-owned roots.
  return html.replace('</head>', `<link rel="stylesheet" href="${prefix}demo-navigation.css"></head>`)
    .replace(/<body\b[^>]*>/, (tag) => tag + navigation);
}
