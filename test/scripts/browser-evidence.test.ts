import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  captureBrowserEvidence,
  evidenceError,
  evidenceName,
  writeBrowserEvidence
} from '../../scripts/browser-evidence.mjs';

const temporaryDirectories: string[] = [];
function evidenceDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'annotations-browser-evidence-'));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('portable cross-browser evidence', () => {
  it('keeps evidence filenames stable and rejects arbitrary traversal or unsupported labels', () => {
    expect(evidenceName('firefox/desktop/react-flow'))
      .toBe('firefox-desktop-react-flow.png');
    expect(evidenceName('webkit/mobile/dom-measure'))
      .toBe('webkit-mobile-dom-measure.png');
    expect(() => evidenceName('firefox/../secret')).toThrow('Unexpected browser');
    expect(() => evidenceName('safari/desktop/worker')).toThrow('Unexpected browser');
  });

  it('writes one reproducible viewport PNG and structured JSON summary', async () => {
    const folder = evidenceDirectory();
    const screenshot = vi.fn(async (options: { path: string }) => {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(options.path, 'png stub');
    });
    const result = await captureBrowserEvidence(
      { screenshot } as never, folder, 'firefox/mobile/incremental');
    expect(result).toEqual({ screenshot: 'firefox-mobile-incremental.png' });
    expect(screenshot).toHaveBeenCalledWith(expect.objectContaining({
      fullPage: false, animations: 'disabled', type: 'png'
    }));
    expect(readFileSync(join(folder, result.screenshot!), 'utf8')).toBe('png stub');

    await writeBrowserEvidence(folder, {
      kind: 'annotation-browser-interactions',
      passed: true, verified: 1,
      cases: [{ label: 'firefox/mobile/incremental', outcome: 'passed', ...result }]
    });
    expect(JSON.parse(readFileSync(join(folder, 'results.json'), 'utf8'))).toEqual({
      schema: 1, kind: 'annotation-browser-interactions',
      passed: true, verified: 1,
      cases: [{ label: 'firefox/mobile/incremental', outcome: 'passed', ...result }]
    });
  });

  it('preserves original failure context when a screenshot cannot be captured', async () => {
    const screenshot = vi.fn(async () => { throw new Error('renderer unavailable'); });
    const result = await captureBrowserEvidence(
      { screenshot } as never, evidenceDirectory(), 'webkit/desktop/worker');
    expect(result).not.toHaveProperty('screenshot');
    expect(result.screenshotError).toContain('renderer unavailable');
    expect(evidenceError(new Error('test failed'))).toContain('test failed');
  });

  it('does not capture or create a report without explicit evidence opt-in', async () => {
    const screenshot = vi.fn();
    expect(await captureBrowserEvidence(
      { screenshot } as never, undefined, 'firefox/desktop/worker')).toEqual({});
    expect(screenshot).not.toHaveBeenCalled();
    await writeBrowserEvidence(undefined, { passed: true });
  });
});
