// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

const source = readFileSync(new NodeURL('../../site/docs.js', import.meta.url), 'utf8');
let lifecycle: EventTarget;
// Execute the classic script with an isolated pageshow target for each page.
const start = () => new Function('document', 'window', source)(document, lifecycle);
let search: HTMLInputElement;

function filter(value: string) {
  search.value = value;
  search.dispatchEvent(new Event('input', { bubbles: true }));
}
const visibleCards = () => [...document.querySelectorAll<HTMLElement>('[data-doc-card]')]
  .filter((card) => !card.hidden).map((card) => card.textContent);
const status = () => document.querySelector('#docs-filter-status')!;

beforeEach(() => {
  lifecycle = new EventTarget();
  document.body.innerHTML = `
    <label for="docs-filter">Filter guides</label>
    <input type="search" id="docs-filter">
    <p id="docs-filter-status" role="status" aria-atomic="true"></p>
    <section data-doc-group>
      <article data-doc-card data-search="react rendering editing">React</article>
      <article data-doc-card data-search="troubleshooting missing notes wrapping">Troubleshooting</article>
    </section>
    <section data-doc-group>
      <article data-doc-card data-search="historical rendering evidence">Historical evidence</article>
    </section>
  `;
  search = document.querySelector<HTMLInputElement>('#docs-filter')!;
});

describe('documentation guide filtering', () => {
  it('reports all guides on entry and matches across both groups without moving focus', () => {
    start();
    expect(status().textContent).toBe('Showing all 3 guides.');
    search.focus();
    filter('rendering');
    expect(visibleCards()).toEqual(['React', 'Historical evidence']);
    expect(status().textContent).toBe('2 guides match “rendering”.');
    expect(document.activeElement).toBe(search);
  });

  it('matches all words regardless of case or spacing and hides empty groups', () => {
    start();
    filter('  WRAPPING    missing  ');
    expect(visibleCards()).toEqual(['Troubleshooting']);
    expect(status().textContent).toBe('1 guide matches “WRAPPING    missing”.');
    expect([...document.querySelectorAll<HTMLElement>('[data-doc-group]')]
      .map((group) => group.hidden)).toEqual([false, true]);
  });

  it('updates the same live region for no results and clearing the search', () => {
    start();
    const region = status();
    filter('no-such-guide');
    expect(visibleCards()).toEqual([]);
    expect(region.textContent).toBe('No guides match “no-such-guide”. Try another title or topic, or clear the search.');
    expect([...document.querySelectorAll<HTMLElement>('[data-doc-group]')]
      .every((group) => group.hidden)).toBe(true);
    expect(region.hidden).toBe(false);
    filter('   ');
    expect(visibleCards()).toHaveLength(3);
    expect(status()).toBe(region);
    expect(region.textContent).toBe('Showing all 3 guides.');
    expect([...document.querySelectorAll<HTMLElement>('[data-doc-group]')]
      .every((group) => !group.hidden)).toBe(true);
  });

  it('synchronizes the visible guides and status with restored browser search values', () => {
    search.value = 'editing';
    start();
    expect(visibleCards()).toEqual(['React']);
    expect(status().textContent).toBe('1 guide matches “editing”.');
    search.value = 'evidence';
    lifecycle.dispatchEvent(new Event('pageshow'));
    expect(visibleCards()).toEqual(['Historical evidence']);
    expect(status().textContent).toBe('1 guide matches “evidence”.');
  });

  it('renders the query as text and distinguishes queries with the same result count', () => {
    start();
    filter('<img src=x onerror=alert(1)>');
    expect(status().textContent).toContain('<img src=x onerror=alert(1)>');
    expect(status().querySelector('img')).toBeNull();
    filter('another missing title');
    expect(status().textContent).toContain('another missing title');
    expect(status().textContent).not.toContain('<img');
  });

  it('leaves pages without the docs filter alone', () => {
    document.body.innerHTML = '<p>Guide content</p>';
    expect(() => start()).not.toThrow();
    expect(document.body.textContent).toBe('Guide content');
  });
});
