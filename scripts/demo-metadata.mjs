import { JSDOM } from 'jsdom';

/** Metadata for compiled public demos; independent example sources stay portable. */
export function injectDemoMetadata(html, example, canonical) {
  if (!example || typeof example.title !== 'string' || !example.title.trim()
    || typeof example.summary !== 'string' || !example.summary.trim()) {
    throw new Error('Demo metadata requires a catalog title and summary');
  }
  let url;
  try { url = new URL(canonical); } catch { throw new Error('Invalid demo canonical URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Demo canonical must be an absolute HTTPS URL without credentials, query or fragment');
  }
  if (!/<head(?:\s[^>]*)?>/i.test(html) || !/<\/head\s*>/i.test(html)) {
    throw new Error('Compiled demo is missing its head');
  }
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const replace = (selector, tag) => {
    const matches = [...document.head.querySelectorAll(selector)];
    const element = matches.shift() ?? document.createElement(tag);
    for (const duplicate of matches) duplicate.remove();
    if (!element.parentNode) document.head.append(element);
    return element;
  };
  replace('title', 'title').textContent = `${example.title.trim()} — Bronto Annotations`;
  const description = replace('meta[name="description" i]', 'meta');
  description.setAttribute('name', 'description');
  description.setAttribute('content', example.summary.trim());
  const link = replace('link[rel~="canonical" i]', 'link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', url.href);
  const output = dom.serialize();
  dom.window.close();
  return output;
}
