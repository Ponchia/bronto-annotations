// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { injectDemoNavigation } from '../../scripts/demo-navigation.mjs';

const catalog = JSON.parse(readFileSync(resolve('examples/catalog.json'), 'utf8'));
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('compiled public demo navigation', () => {
  it.each(Object.keys(catalog))('preserves %s source and landmarks while using its catalog guide', (name) => {
    const source = readFileSync(resolve(`examples/${name}/index.html`), 'utf8');
    expect(source).not.toContain('data-demo-navigation');
    const original = parse(source);
    const document = parse(injectDemoNavigation(source, catalog[name]));
    const navigation = document.querySelector('nav[data-demo-navigation]')!;
    expect(navigation.parentElement).toBe(document.body);
    expect(navigation.getAttribute('aria-label')).toBe('Demo navigation');
    expect(navigation.querySelector('.demo-navigation-title')!.textContent).toBe(catalog[name].title);
    expect([...navigation.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      '../../#playground', '../../examples/', `../../docs/${catalog[name].guide}.html`,
    ]);
    expect(navigation.querySelectorAll('[tabindex],script,button')).toHaveLength(0);
    expect(document.querySelectorAll('main,header,footer')).toHaveLength(
      original.querySelectorAll('main,header,footer').length,
    );
    const stylesheet = document.querySelector('link[href="../../demo-navigation.css"]')!;
    stylesheet.remove();
    navigation.remove();
    expect(document.documentElement.outerHTML).toBe(original.documentElement.outerHTML);
  });

  it.each(['/', '/bronto-annotations/'])('keeps every destination under the hosting prefix %s', (base) => {
    for (const [name, example] of Object.entries(catalog)) {
      const document = parse(injectDemoNavigation('<html><head></head><body></body></html>', example));
      const links = [...document.querySelectorAll('a')].map((link) =>
        new URL(link.getAttribute('href')!, `https://example.test${base}examples/${name}/`));
      expect(links.map((link) => link.pathname)).toEqual([
        base, `${base}examples/`, `${base}docs/${catalog[name].guide}.html`,
      ]);
      expect(links[0]!.hash).toBe('#playground');
    }
  });

  it('escapes catalog text and refuses missing metadata or repeated injection', () => {
    const source = '<html><head></head><body><div id="root"></div></body></html>';
    const example = { title: '<img src=x onerror="alert(1)"> & demo', guide: 'react-guide' };
    const html = injectDemoNavigation(source, example);
    const document = parse(html);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('.demo-navigation-title')!.textContent).toBe(example.title);
    expect(() => injectDemoNavigation(html, example)).toThrow('Duplicate');
    expect(() => injectDemoNavigation(source, { title: 'Demo' })).toThrow('catalog');
    expect(() => injectDemoNavigation(source, { ...example, guide: '../wrong' })).toThrow('catalog');
    expect(() => injectDemoNavigation(source, example, '/')).toThrow('prefix');
    expect(() => injectDemoNavigation('<div></div>', example)).toThrow('head or body');
  });
});
