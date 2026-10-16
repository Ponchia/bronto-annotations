// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { injectReleaseNotice, siteReleaseStatus } from '../../scripts/site-release.mjs';
const record = { schemaVersion: 1 as const, stableVersion: '0.6.10', previewVersion: null };
describe('versioned public documentation', () => {
  it('distinguishes an unpublished source from the actually published stable package', () => {
    const status = siteReleaseStatus('0.7.0-rc.1', record);
    expect(status.sourcePublished).toBe(false);
    expect(status.stableInstall).toBe('npm install @ponchia/annotations@0.6.10');
    document.body.innerHTML = injectReleaseNotice('<main><h1>Guide</h1></main>', status, '../');
    expect(document.querySelectorAll('[data-release-notice]')).toHaveLength(1);
    expect(document.querySelector('main')?.firstElementChild?.tagName).toBe('ASIDE');
    expect(document.querySelector('aside')?.textContent).toContain('Publication of this source is not confirmed');
    expect(document.querySelector('a')?.getAttribute('href')).toContain('/blob/v0.6.10/');
    expect(document.querySelector('[data-release-guidance] > a:last-child')?.getAttribute('href')).toBe('../docs/migration-0.7.html');
  });
  it('keeps version identity outside a closed, native keyboard disclosure', () => {
    const status = siteReleaseStatus('0.7.0-dev.1', { ...record, previewVersion: '0.7.0-rc.1' });
    document.body.innerHTML = injectReleaseNotice('<main></main>', status);
    const notice = document.querySelector('[data-release-notice]')!;
    const details = notice.querySelector('details')!;
    const identity = notice.querySelector('[data-release-identity]')!;
    expect(details.open).toBe(false);
    expect(details.firstElementChild?.tagName).toBe('SUMMARY');
    expect(details.querySelector('summary')?.textContent).toBe('Install and version details');
    expect(details.querySelector('summary')?.hasAttribute('role')).toBe(false);
    expect(details.contains(identity)).toBe(false);
    expect(identity.textContent).toContain('0.7.0-dev.1');
    expect(identity.textContent).toContain('Stable npm: 0.6.10');
    expect(identity.textContent).toContain('development source');
    expect(identity.querySelector('a')?.getAttribute('href')).toBe(status.stableDocs);
    expect(details.textContent).toContain(status.stableInstall);
    expect(details.textContent).toContain('npm install @ponchia/annotations@0.7.0-rc.1');
    expect(details.textContent).not.toContain('npm install @ponchia/annotations@0.7.0-dev.1');
    expect(details.querySelector('[data-candidate-docs]')?.getAttribute('href'))
      .toBe('https://github.com/Ponchia/bronto-annotations/blob/v0.7.0-rc.1/docs/README.md');
  });
  it('does not advertise an unpublished candidate as installable', () => {
    const status = siteReleaseStatus('0.7.0-rc.2', { ...record, previewVersion: '0.7.0-rc.1' });
    expect(status.sourcePublished).toBe(false);
    const nextSource = injectReleaseNotice('<main></main>', status);
    expect(nextSource).toContain('Publication of this source is not confirmed');
    expect(nextSource).toContain('Published candidate: <strong>0.7.0-rc.1</strong>');
    expect(nextSource).not.toContain('npm install @ponchia/annotations@0.7.0-rc.2');
    const confirmed = siteReleaseStatus('0.7.0-rc.1', { ...record, previewVersion: '0.7.0-rc.1' });
    expect(injectReleaseNotice('<body><div id="root"></div></body>', confirmed, '../../'))
      .toContain('npm install @ponchia/annotations@0.7.0-rc.1');
    document.body.innerHTML = injectReleaseNotice('<body></body>', confirmed);
    expect(document.querySelector('[data-release-identity]')?.textContent).toContain('published candidate');
    expect(document.querySelector('[data-release-identity]')?.textContent).not.toContain('development source');
  });
  it('preserves client roots and does not inject scripts into standalone examples', () => {
    const output = injectReleaseNotice('<html><body><div id="root"></div></body></html>', siteReleaseStatus('0.7.0-dev.0', record), '../../');
    document.documentElement.innerHTML = output;
    expect(document.querySelector('aside + #root')).not.toBeNull();
    expect(document.querySelectorAll('script')).toHaveLength(0);
    expect(() => injectReleaseNotice(output, siteReleaseStatus('0.7.0-dev.0', record))).toThrow('Duplicate');
  });
  it('validates publication versions and never accepts an HTML/path injection', () => {
    expect(() => siteReleaseStatus('<script>', record)).toThrow('Invalid');
    expect(() => siteReleaseStatus('0.7.0', { ...record, stableVersion: '0.7.0-rc.1' })).toThrow('Invalid');
    expect(() => siteReleaseStatus('0.7.0', { ...record, previewVersion: '0.7.0' })).toThrow('Invalid');
    expect(() => injectReleaseNotice('<body></body>', siteReleaseStatus('0.7.0', record), '" onmouseover="')).toThrow('Invalid');
  });
  it('labels a confirmed stable build without preview wording', () => {
    const output = injectReleaseNotice('<main></main>', siteReleaseStatus('0.6.10', record));
    expect(output).not.toContain('development / preview API');
    expect(output).toContain('This version is published');
    document.body.innerHTML = output;
    expect(document.querySelector('[data-release-identity]')?.textContent).toContain('stable release');
    expect(document.querySelector('[data-release-identity]')?.textContent).not.toContain('development source');
    expect(document.querySelector('[data-candidate-docs]')).toBeNull();
    expect(() => injectReleaseNotice('<div></div>', siteReleaseStatus('0.6.10', record))).toThrow('body');
  });
});
