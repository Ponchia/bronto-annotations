import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('site/first-annotation.html', root), 'utf8');
const document = new JSDOM(html).window.document;
describe('single-file first annotation', () => {
  it('uses one verified release for the module, stylesheet and install command', () => {
    const version = document.querySelector('main')?.getAttribute('data-package-version');
    expect(version).toBe('0.9.2');
    expect(html).toContain(`annotations@${version}/dist/index.js`);
    expect(html).toContain(`annotations@${version}/dist/bronto.css`);
    expect(html).toContain(`npm install @ponchia/annotations@${version}`);
    expect(html).not.toMatch(/cloudflareinsights|api[_-]?key\s*[:=]|eval\(/i);
  });
  it('keeps controls hidden until initialization and retains a readable no-script route', () => {
    expect(document.querySelector('#controls')?.hasAttribute('hidden')).toBe(true);
    expect(document.querySelector('noscript')?.textContent).toContain('first-annotation guide');
    expect(document.querySelector('#status')?.getAttribute('role')).toBe('status');
    expect(document.querySelector('#note-title')?.getAttribute('maxlength')).toBe('28');
    expect(document.querySelector('#save-example')?.getAttribute('download')).toBe('first-annotation.html');
    expect(document.querySelector('#toggle')?.getAttribute('aria-pressed')).toBe('true');
    expect(html).toContain('could not load');
    expect(html).toContain('internet connection');
  });
  it('retains a genuine screenshot with reproducible package identity', () => {
    const evidence = JSON.parse(readFileSync(new URL('site/media/first-note.json', root), 'utf8'));
    const bytes = readFileSync(new URL('site/media/first-note.png', root));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(evidence.sha256);
    expect(evidence.package).toBe('@ponchia/annotations');
    expect(evidence.version).toBe('0.9.2');
    expect(evidence.capture).toContain('synthetic');
  });
});
