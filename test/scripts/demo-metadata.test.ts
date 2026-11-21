// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { injectDemoMetadata } from '../../scripts/demo-metadata.mjs';

const catalog = JSON.parse(readFileSync(resolve('examples/catalog.json'), 'utf8'));
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const canonical = (name: string) => `https://ponchia.github.io/bronto-annotations/examples/${name}/`;

describe('compiled demo search metadata', () => {
  it.each(Object.keys(catalog))('describes %s without changing its app or assets', name => {
    const source = readFileSync(resolve(`examples/${name}/index.html`), 'utf8');
    const before = parse(source);
    const document = parse(injectDemoMetadata(source, catalog[name], canonical(name)));
    expect(document.title).toBe(`${catalog[name].title} — Bronto Annotations`);
    expect(document.head.querySelectorAll('title')).toHaveLength(1);
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(catalog[name].summary);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical(name));
    expect(document.body.outerHTML).toBe(before.body.outerHTML);
    const assets = (head: HTMLHeadElement) => [...head.querySelectorAll('script,style,link:not([rel="canonical"])')]
      .map(node => node.outerHTML);
    expect(assets(document.head)).toEqual(assets(before.head));
  });

  it('replaces stale or duplicate metadata and remains idempotent', () => {
    const source = '<!doctype html><html><head><title>Old</title><title>Duplicate</title>'
      + '<meta name="Description" content="Old"><meta name="description" content="Duplicate">'
      + '<link rel="Canonical" href="https://old.example/"><link rel="canonical" href="https://duplicate.example/">'
      + '</head><body><main id="root"><svg><title>Chart label</title></svg></main></body></html>';
    const output = injectDemoMetadata(source, catalog['svg-basic'], canonical('svg-basic'));
    const document = parse(output);
    expect(document.head.querySelectorAll('title')).toHaveLength(1);
    expect(document.querySelector('svg title')?.textContent).toBe('Chart label');
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical('svg-basic'));
    expect(injectDemoMetadata(output, catalog['svg-basic'], canonical('svg-basic'))).toBe(output);
  });

  it('keeps catalog text inert in the head', () => {
    const example = { title: '</title><script>bad()</script>', summary: '\"><img src=x onerror="bad()"> & notes' };
    const document = parse(injectDemoMetadata('<html><head></head><body></body></html>', example, canonical('svg-basic')));
    expect(document.title).toBe(`${example.title} — Bronto Annotations`);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(example.summary);
    expect(document.querySelectorAll('script,img')).toHaveLength(0);
  });

  it.each(['/relative/', 'http://example.test/', 'javascript:bad()', 'https://example.test/?q=demo',
    'https://example.test/#demo', 'https://user:password@example.test/'])(
    'rejects an invalid public canonical %s', url => {
      expect(() => injectDemoMetadata('<html><head></head><body></body></html>', catalog['svg-basic'], url))
        .toThrow(/canonical/i);
    });

  it('requires complete catalog metadata and a compiled document', () => {
    for (const value of [null, {}, { title: 'Demo' }, { title: '', summary: 'Description' }]) {
      expect(() => injectDemoMetadata('<html><head></head><body></body></html>', value, canonical('svg-basic')))
        .toThrow(/catalog/);
    }
    expect(() => injectDemoMetadata('<main>Demo</main>', catalog['svg-basic'], canonical('svg-basic')))
      .toThrow(/head/);
  });
});
