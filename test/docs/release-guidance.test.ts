import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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

function currentGuidance(file: string, text: string): string {
  if (file.endsWith('release-readiness.md')) return section(text, 'Choose the matching package');
  if (file.endsWith('migration-guide.md')) return section(text, 'UI helper migration and package versions');
  const end = text.indexOf('\n## Why change the contract?');
  expect(end, 'Missing migration introduction delimiter').toBeGreaterThan(0);
  return text.slice(0, end);
}

function checkCurrentInstall(file: string, text: string): void {
  const current = currentGuidance(file, text);
  const installs = [...current.matchAll(/npm install @ponchia\/annotations@([0-9][0-9A-Za-z.+-]*)/g)]
    .map(match => match[1]);
  expect(installs.length).toBeGreaterThan(0);
  expect([...new Set(installs)]).toEqual([stable]);
  expect(current).toContain(`/blob/v${stable}/docs/`);
}

describe('current release guidance and historical scope', () => {
  it('separates the current release runbook from retained launch procedures', () => {
    const runbook = read('docs/release.md');
    expect(runbook).toContain('current maintainer runbook');
    expect(section(runbook, 'Canary / Private Registry')).toContain('**Historical bootstrap path.**');
    expect(section(runbook, 'Public Release Decisions')).toContain('**Historical launch record.**');
    expect(runbook).not.toContain('Use the GitHub Packages canary workflow before publishing');
    expect(runbook).not.toContain('source of truth for the package name');
    expect(runbook).toContain('(../GOVERNANCE.md)');
    expect(runbook).toContain('manifest and fresh audit determine readiness');
    expect(runbook).not.toContain('registry npm\nbundle still ships');
  });

  it('keeps denied channel cleanup and accepted publication distinct', () => {
    const runbook = read('docs/release.md');
    expect(runbook).toContain('disabled by default');
    expect(runbook).toContain('/issues/231');
    expect(runbook).toContain('An `E403`');
    expect(runbook).toContain('maintainer permission decision');
    expect(runbook).toContain('do not\n  rerun the npm publication step');
    expect(runbook).toContain('missing registry read alone is not proof');
    expect(runbook).toContain('/issues/78');
  });

  it.each(['docs/migration-0.7.md', 'docs/migration-guide.md', 'docs/release-readiness.md'])(
    '%s offers the confirmed stable package, not a release candidate', file => {
      checkCurrentInstall(file, read(file));
    }
  );

  it('does not accept the current install when it occurs only in historical evidence', () => {
    const file = 'docs/release-readiness.md';
    const changed = read(file).replace(`npm install @ponchia/annotations@${stable}`,
      'npm install @ponchia/annotations@0.8.1').replace(
      '## Historical 0.8.1 publication evidence',
      `## Historical 0.8.1 publication evidence\n\nnpm install @ponchia/annotations@${stable}`);
    expect(() => checkCurrentInstall(file, changed)).toThrow();
    expect(() => currentGuidance('docs/migration-0.7.md', 'Missing section')).toThrow();
  });

  it('keeps a historical display title out of current navigation', () => {
    const source = read('scripts/build-public-site.mjs');
    const start = source.indexOf('const titles =');
    const end = source.indexOf('const guideSummaries =');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    // Execute the actual pure navigation declarations, not a duplicate registry.
    const navigation = runInNewContext(`${source.slice(start, end)}; ({ titles, primaryDocs })`,
      {}, { timeout: 1000 }) as { titles: Record<string, string>; primaryDocs: string[] };
    expect(navigation.titles['e2e-plan']).toContain('Historical');
    expect(navigation.primaryDocs).not.toContain('e2e-plan');
    expect(navigation.primaryDocs).toContain('getting-started');
  });

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
    const lastStable = section(readiness, 'Historical 0.8.3 publication evidence');
    expect(lastStable).toContain('363,251-byte');
    expect(lastStable).toContain('sha512-qk4uhVBf4y6RCSAykMZP3rAsJkbSJE2CrocPBXFKnvu0pN6jvrET/2S4vC05bmre4ZEKp7BpG4C1cheST4rAGA==');
    expect(lastStable).toContain('42401260630');
    const previous = section(readiness, 'Historical 0.8.2 publication evidence');
    expect(previous).toContain('356,165-byte');
    expect(previous).toContain('sha512-+RQGrJ0fAYuzikj2mT5B2zUlBUFB1XJIttaiiqqYj0ytNycZAahnKr+GGwKYlRdFzqk0Z09Wgp+T55EylsLBlQ==');
    expect(previous).toContain('42382465752');
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
