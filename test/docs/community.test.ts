import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { marked } from 'marked';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new NodeURL('../../', import.meta.url));
const read = (file: string): string => readFileSync(resolve(root, file), 'utf8');
const documents = ['CODE_OF_CONDUCT.md', 'GOVERNANCE.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md'];

function unpackagedSupportLinks(text: string): string[] {
  const pkg = JSON.parse(read('package.json')) as { files: string[] };
  const packed = ['package.json', 'README.md', 'LICENSE', ...pkg.files];
  const missing: string[] = [];
  marked.walkTokens(marked.lexer(text), (token) => {
    if (token.type !== 'link' || !('href' in token) || typeof token.href !== 'string') return;
    if (/^[a-z][a-z0-9+.-]*:/i.test(token.href) || token.href.startsWith('//')) return;
    const path = decodeURIComponent(token.href.split('#')[0]!.split('?')[0]!);
    if (!path) return;
    const target = relative(root, resolve(root, path)).split(sep).join('/');
    if (!packed.some(entry => target === entry || target.startsWith(`${entry}/`))) missing.push(path);
  });
  return missing.sort();
}

describe('public contribution and community routes', () => {
  it('keeps shipped support links valid without shipping contributor-only files', () => {
    expect(unpackagedSupportLinks(read('SUPPORT.md'))).toEqual([]);
  });

  it('detects a repository-only security link accidentally restored in packaged support', () => {
    const changed = read('SUPPORT.md').replace(
      'https://github.com/Ponchia/bronto-annotations/blob/main/SECURITY.md', 'SECURITY.md');
    expect(unpackagedSupportLinks(changed)).toContain('SECURITY.md');
  });

  it('distinguishes runtime compatibility from upstream security support', () => {
    const compatibility = read('docs/compatibility.md');
    expect(compatibility).toContain('Compatibility is not a security-support promise');
    expect(compatibility).toContain('Node 20 is end-of-life');
    expect(compatibility).toContain('https://nodejs.org/en/about/eol');
    expect(compatibility).toContain('https://nodejs.org/en/about/previous-releases');
    expect(compatibility).toContain('latest patched release of a maintained Node.js LTS line');
    expect(read('CONTRIBUTING.md')).toContain('maintained Node.js LTS');
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.engines.node).toBe('>=20.19.0');
    expect(read('.github/workflows/ci.yml')).toContain('- 20');
  });


  it.each(documents)('publishes %s without unfinished template contacts', (file) => {
    const text = read(file);
    expect(text).not.toMatch(/\[INSERT[^\]]*\]|\bTODO\b|your[- ]?email|example@/i);
    expect(text).toMatch(/^# /);
  });

  it('distinguishes public moderation, private platform reports and vulnerability reports', () => {
    const conduct = read('CODE_OF_CONDUCT.md');
    expect(conduct).toContain('https://github.com/Ponchia');
    expect(conduct).toContain('https://support.github.com/contact/report-abuse');
    expect(conduct).toContain('GitHub Support, not to the project maintainer');
    expect(conduct).toContain('**Report abuse to GitHub Support**');
    expect(conduct).toContain('**Report to repository admins**');
    expect(conduct).toContain('route to the project maintainers, not an independent report to GitHub Support');
    expect(conduct).toContain('no dedicated confidential project mailbox');
    expect(conduct).not.toContain('/security/advisories/new');
    const security = read('SECURITY.md');
    expect(security).toContain('https://github.com/Ponchia/bronto-annotations/security/advisories/new');
    expect(security).toContain('without exploit details');
    expect(security).toContain('coordinated disclosure');
  });

  it('states the real maintainer and distinguishes automated checks from independent approval', () => {
    const governance = read('GOVERNANCE.md');
    expect(governance).toContain('Zeno Trevisan');
    expect(governance).toContain('https://github.com/Ponchia');
    expect(governance).toContain('single-maintainer');
    expect(governance).toContain('independent human approval');
    expect(governance).toContain('do not count');
    expect(governance).toContain('docs/release.md');
    expect(governance).not.toMatch(/has (?:earned|achieved).*badge/i);
  });

  it('links the contribution routes to the actual policies', () => {
    const contribution = read('CONTRIBUTING.md');
    expect(contribution).toContain('(CODE_OF_CONDUCT.md)');
    expect(contribution).toContain('(GOVERNANCE.md)');
    expect(contribution).toContain('(SECURITY.md)');
    expect(read('SUPPORT.md')).toContain('/blob/main/CODE_OF_CONDUCT.md)');
    expect(read('.github/pull_request_template.md')).toContain('npm run check');
  });

  it('keeps documented npm checks attached to real scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    for (const file of documents) {
      for (const match of read(file).matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) {
        expect(Object.hasOwn(pkg.scripts, match[1]!), `${file}: unknown script ${match[1]}`).toBe(true);
      }
    }
  });

  it('keeps local policy links inside the repository and attached to existing files', () => {
    for (const file of documents) {
      marked.walkTokens(marked.lexer(read(file)), (token) => {
        if (token.type !== 'link' || !('href' in token) || typeof token.href !== 'string') return;
        if (/^[a-z][a-z0-9+.-]*:/i.test(token.href) || token.href.startsWith('//')) return;
        const path = token.href.split('#')[0]!.split('?')[0]!;
        if (!path) return;
        const target = resolve(dirname(resolve(root, file)), decodeURIComponent(path));
        const within = relative(root, target);
        expect(within === '..' || within.startsWith(`..${sep}`), `${file}: ${token.href}`).toBe(false);
        expect(existsSync(target), `${file}: ${token.href}`).toBe(true);
      });
    }
  });

  it('offers documentation reports without demanding a code reproduction', () => {
    const form = read('.github/ISSUE_TEMPLATE/documentation.yml');
    expect(form).toMatch(/^name: .+/m);
    expect(form).toMatch(/^description: .+/m);
    expect(form).toContain('id: page');
    expect(form).toContain('id: problem');
    expect(form).not.toContain('render: ts');
    expect(form).toContain('label: Page or guide');
    const ids = [...form.matchAll(/^    id: (.+)$/gm)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(read('.github/ISSUE_TEMPLATE/bug_report.yml')).toContain('id: environment');
    const feature = read('.github/ISSUE_TEMPLATE/feature_request.yml');
    const proposal = feature.split('id: proposal')[1]?.split('  - type:')[0];
    expect(proposal).toBeDefined();
    expect(proposal).not.toMatch(/required:\s*true/);
  });
});
