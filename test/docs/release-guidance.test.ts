import { readFileSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new NodeURL('../../', import.meta.url));
const read = (file: string): string => readFileSync(`${root}${file}`, 'utf8');
const stable = JSON.parse(read('site/release-status.json')).stableVersion as string;
const section = (text: string, title: string): string => {
  const marker = `## ${title}\n`;
  const start = text.indexOf(marker);
  expect(start, `Missing section ${title}`).toBeGreaterThanOrEqual(0);
  const end = text.indexOf('\n## ', start + marker.length);
  return text.slice(start, end < 0 ? undefined : end);
};

describe('current release guidance and historical scope', () => {
  it.each(['docs/migration-0.7.md', 'docs/migration-guide.md', 'docs/release-readiness.md'])(
    '%s offers the confirmed stable package, not a release candidate', file => {
      const text = read(file);
      const current = file.endsWith('migration-guide.md')
        ? section(text, 'UI helper migration and package versions')
        : text.slice(0, text.indexOf('\n## Automated acceptance') > 0
          ? text.indexOf('\n## Automated acceptance') : text.indexOf('\n## Why change'));
      expect(current).toContain(`npm install @ponchia/annotations@${stable}`);
      expect(current).not.toMatch(/(?:npm install|Install\s+`)\s*@ponchia\/annotations@\d+\.\d+\.\d+-rc\./);
      expect(current).toContain(`/blob/v${stable}/docs/`);
    }
  );

  it('describes the released API while retaining its established contract headings and manifest', () => {
    const stability = read('docs/api-stability.md');
    expect(stability).not.toMatch(/development preview|unpublished breaking minor|Once 0\.7 is published/);
    expect(stability).toContain('## Stable for `0.7.x`');
    expect(stability).toContain('## Experimental During `0.x`');
    expect(stability).toContain('0.8');
    expect(JSON.parse(read('docs/api-stability.manifest.json')).policy).toBe('0.7.x');
  });

  it('keeps earlier archive proof explicitly historical rather than relabeling its bytes', () => {
    const readiness = read('docs/release-readiness.md');
    expect(readiness).toContain(`confirmed stable release is **${stable}**`);
    const historical = section(readiness, 'Historical 0.8.1 publication evidence');
    expect(historical).toContain('352,202 bytes');
    expect(historical).toContain('sha512-R70T9q1R96sAwQOEomC72DnpLVZj5F+wI6RwgmqlxCaYuXBPlXumO/L8FbJfpnBSdvky+6/eMRhOdVsFGAjyUQ==');
    expect(historical).toContain('40943672445');
    expect(read('docs/migration-guide.md')).toContain('Historical RC2 evidence');
  });

  it('labels a historical direct-entry page before its old inventory', () => {
    const plan = read('docs/e2e-plan.md');
    const introduction = plan.slice(0, plan.indexOf('\n## Completed Scope'));
    expect(introduction).toContain('Historical verification record');
    expect(introduction).toContain('(api-reference.md)');
    expect(introduction).toContain('(../examples/README.md)');
    expect(introduction).not.toContain('current public package surface');
    const site = read('scripts/build-public-site.mjs');
    expect(site).toContain("'release-readiness': 'Release readiness'");
    expect(site).toContain("'e2e-plan': 'Historical end-to-end verification plan'");
  });
});
