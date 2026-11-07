// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnnotatedPoint } from './react-example.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

interface PublicationRecord { stableVersion: string; previewVersion: string | null; }

// README is frozen inside published archives; the current first-use guide is
// updated only after registry verification. Keep these two policies distinct.
function publicationGuidanceProblems(readme: string, guide: string, record: PublicationRecord): string[] {
  const problems: string[] = [];
  const installs = (source: string): string[] => [...source.matchAll(
    /\bnpm\s+(?:install|i|add)\s+[^\n`]*?(@ponchia\/annotations(?:@[^\s`]+)?)/g
  )].map(match => match[1]!);
  const readmeInstalls = installs(readme);
  const guideInstalls = installs(guide);
  if (!readmeInstalls.length || readmeInstalls.some(spec => spec !== '@ponchia/annotations')) {
    problems.push('README install commands must not freeze a package version');
  }
  if (!readme.includes('latest published stable release')
      || !readme.includes('docs/getting-started.md#choose-your-version')) {
    problems.push('README must name the stable default and route exact-version choices');
  }
  if (!readme.includes('they can be ahead of npm')) {
    problems.push('README must distinguish main-source guides from published packages');
  }
  const confirmed = new Set([`@ponchia/annotations@${record.stableVersion}`,
    ...(record.previewVersion ? [`@ponchia/annotations@${record.previewVersion}`] : []),
    '@ponchia/annotations@0.7.0']); // Explicit previous stable line remains documented.
  if (!guideInstalls.length || guideInstalls.some(spec => !confirmed.has(spec))) {
    problems.push('The current guide must pin every annotation install command');
  }
  if (!guideInstalls.includes(`@ponchia/annotations@${record.stableVersion}`)) {
    problems.push('The current guide must include the confirmed stable install');
  }
  if (record.previewVersion && (!guideInstalls.includes(`@ponchia/annotations@${record.previewVersion}`)
      || !guide.includes(`/blob/v${record.previewVersion}/docs/`))) {
    problems.push('The current guide must keep preview installs and matching guides together');
  }
  return problems;
}

describe('executable first-use documentation', () => {
  it('keeps packaged README guidance durable and the current guide version-pinned', () => {
    const record = JSON.parse(read('../../site/release-status.json'));
    expect(publicationGuidanceProblems(read('../../README.md'), read('../../docs/getting-started.md'), record)).toEqual([]);
  });

  it('rejects a stale README install pin even if another command is current', () => {
    const record = JSON.parse(read('../../site/release-status.json'));
    const readme = read('../../README.md').replace('npm install @ponchia/annotations\n',
      'npm install @ponchia/annotations@0.8.1\n');
    expect(publicationGuidanceProblems(readme, read('../../docs/getting-started.md'), record))
      .toContain('README install commands must not freeze a package version');
  });

  it('rejects an unpinned guide command even if another command is pinned', () => {
    const record = JSON.parse(read('../../site/release-status.json'));
    const guide = read('../../docs/getting-started.md').replace(
      `npm install @ponchia/annotations@${record.stableVersion}`,
      'npm install @ponchia/annotations');
    expect(publicationGuidanceProblems(read('../../README.md'), guide, record))
      .toContain('The current guide must pin every annotation install command');
  });

  it('rejects an unsupported source/publication equivalence claim', () => {
    const record = JSON.parse(read('../../site/release-status.json'));
    const readme = read('../../README.md').replace('they can be ahead of npm', 'they always match npm');
    expect(publicationGuidanceProblems(readme, read('../../docs/getting-started.md'), record))
      .toContain('README must distinguish main-source guides from published packages');
  });

  it('runs the exact browser example printed in the README and first-use guide', async () => {
    const fixture = read('./readme-example.ts').trim();
    const fenced = `\`\`\`ts\n${fixture}\n\`\`\``;
    expect(read('../../README.md')).toContain(fenced);
    expect(read('../../docs/getting-started.md')).toContain(fenced);
    document.body.innerHTML = '';
    await import('./readme-example.js');
    expect(document.querySelectorAll('svg')).toHaveLength(1);
    expect(document.querySelectorAll('.pa-annotation')).toHaveLength(1);
    expect(document.querySelector('.pa-annotation__title')?.textContent).toBe('Peak response');
    expect(document.querySelector('.pa-annotation__connector')).not.toBeNull();
    expect(document.body.textContent).toContain('An explanation attached to this point.');
  });

  it('keeps the standalone Vite HTML entry synchronized with the executable consumer', () => {
    const entry = read('./browser-entry.html').trim();
    for (const path of ['../../README.md', '../../docs/getting-started.md']) {
      expect(read(path)).toContain(`\`\`\`html\n${entry}\n\`\`\``);
    }
    expect(entry).toContain('name="viewport"');
    expect(entry).toContain('src="/main.ts"');
  });

  it('server-renders the exact React component printed in the first-use guide', () => {
    const fixture = read('./react-example.tsx').trim();
    expect(read('../../docs/getting-started.md')).toContain(`\`\`\`tsx\n${fixture}\n\`\`\``);
    const output = renderToStaticMarkup(createElement(AnnotatedPoint));
    expect(output).toContain('An annotated point');
    expect(output).toContain('Peak response');
    expect(output).toContain('pa-annotation__connector');
  });
});
