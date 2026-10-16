// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnnotatedPoint } from './react-example.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('executable first-use documentation', () => {
  it('pins install choices to the recorded publications rather than installing stable for a source tutorial', () => {
    const record = JSON.parse(read('../../site/release-status.json'));
    for (const path of ['../../README.md', '../../docs/getting-started.md']) {
      const source = read(path);
      expect(source).toContain(`npm install @ponchia/annotations@${record.stableVersion}`);
      if (record.previewVersion) {
        expect(source).toContain(`npm install @ponchia/annotations@${record.previewVersion}`);
        expect(source).toContain(`/blob/v${record.previewVersion}/docs/`);
      }
      expect(source).not.toMatch(/^npm install @ponchia\/annotations$/m);
    }
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
    expect(read('../../docs/getting-started.md')).toContain(`\`\`\`html\n${entry}\n\`\`\``);
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
