// @vitest-environment jsdom

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { marked } from 'marked';
import { describe, expect, it } from 'vitest';

// Use the Node constructor so Vite does not rewrite this filesystem path as a browser asset URL.
const root = fileURLToPath(new NodeURL('../../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const catalog = JSON.parse(read('examples/catalog.json')) as Record<string, {
  title: string; summary: string; try: string; boundary: string; guide: string;
}>;
const guideNames = [
  'getting-started', 'context-quickstart', 'core-guide', 'presets-guide',
  'react-guide', 'adapter-guide', 'styling-guide', 'troubleshooting', 'verification'
];

function markdownLinks(source: string): string[] {
  const links: string[] = [];
  marked.walkTokens(marked.lexer(source), (token) => {
    if ((token.type === 'link' || token.type === 'image')
      && 'href' in token && typeof token.href === 'string') links.push(token.href);
  });
  return links;
}

function headingIds(source: string): Set<string> {
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  marked.walkTokens(marked.lexer(source), (token) => {
    if (token.type !== 'heading' || !('text' in token)) return;
    const parsed = new DOMParser().parseFromString(marked.parseInline(String(token.text), { async: false }), 'text/html');
    const plain = parsed.body.textContent ?? '';
    const stem = plain.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
    const count = counts.get(stem) ?? 0;
    ids.add(stem + (count ? `-${count}` : ''));
    counts.set(stem, count + 1);
  });
  for (const match of source.matchAll(/<a\s+id="([^"]+)"/g)) ids.add(match[1]!);
  return ids;
}

describe('public onboarding and repository navigation', () => {
  it('keeps GitHub, npm, README, and funding guide on the existing Ko-fi destination', () => {
    const pkg = JSON.parse(read('package.json'));
    const lock = JSON.parse(read('package-lock.json'));
    expect(read('.github/FUNDING.yml').trim()).toBe('ko_fi: ponchia');
    expect(pkg.funding).toEqual({ type: 'ko-fi', url: 'https://ko-fi.com/ponchia' });
    expect(lock.packages[''].funding).toEqual(pkg.funding);
    for (const name of ['README.md', 'FUNDING.md']) {
      expect(read(name)).toContain('https://ko-fi.com/ponchia');
    }
    expect(pkg.files).toEqual(expect.arrayContaining(['FUNDING.md', 'SUPPORT.md']));
    expect(read('FUNDING.md')).toContain('does not purchase a feature');
    expect(pkg.scripts.example).toBe('npm run build && vite');
  });

  it('documents every runnable example and keeps catalog routes attached to real source', () => {
    const runnable = readdirSync(join(root, 'examples'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory()
        && ['main.ts', 'main.tsx'].some((name) => existsSync(join(root, 'examples', entry.name, name))))
      .map((entry) => entry.name).sort();
    expect(Object.keys(catalog).sort()).toEqual(runnable);
    for (const [name, example] of Object.entries(catalog)) {
      expect(example.title.length).toBeGreaterThan(3);
      expect(example.summary.length).toBeGreaterThan(20);
      expect(example.boundary.length).toBeGreaterThan(20);
      const doc = read(`examples/${name}/README.md`);
      expect(doc).toContain(`npm run example -- examples/${name}`);
      expect(doc).toContain('## What to try');
      expect(doc).toContain('## Host and package boundary');
      expect(doc).toContain(example.boundary);
      expect(existsSync(join(root, 'docs', `${example.guide}.md`))).toBe(true);
      expect(read('examples/README.md')).toContain(`(${name}/README.md)`);
    }
  });

  it('keeps current guides discoverable without growing the README into the API manual', () => {
    expect(read('README.md').split('\n').length).toBeLessThan(250);
    for (const name of guideNames) {
      expect(existsSync(join(root, 'docs', `${name}.md`))).toBe(true);
      expect(read('docs/README.md')).toContain(`(${name}.md)`);
    }
    expect(read('README.md')).toContain('(docs/verification.md)');
    expect(read('AGENTS.md')).toContain('docs/README.md');
  });

  it('resolves local files and Markdown anchors from maintained entry points and example READMEs', () => {
    const files = [
      'README.md', 'FUNDING.md', 'SUPPORT.md', 'CONTRIBUTING.md', 'AGENTS.md',
      'docs/README.md', 'examples/README.md',
      ...guideNames.map((name) => `docs/${name}.md`),
      ...Object.keys(catalog).map((name) => `examples/${name}/README.md`)
    ];
    for (const file of files) {
      for (const href of markdownLinks(read(file))) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue;
        const [path = '', fragment] = href.split('#');
        const target = path
          ? resolve(dirname(join(root, file)), decodeURIComponent(path.split('?')[0]!))
          : join(root, file);
        const targetRelative = relative(root, target);
        expect(targetRelative === '..' || targetRelative.startsWith(`..${sep}`), `${file}: ${href}`).toBe(false);
        expect(existsSync(target), `${file}: broken local link ${href}`).toBe(true);
        if (fragment && target.endsWith('.md')) {
          expect(headingIds(readFileSync(target, 'utf8')).has(decodeURIComponent(fragment)),
            `${file}: missing anchor in ${href}`).toBe(true);
        }
      }
    }
  });
});
