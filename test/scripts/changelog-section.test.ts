import { describe, expect, it } from 'vitest';
import { extractChangelogSection } from '../../scripts/changelog-section.mjs';
describe('exact immutable release notes', () => {
  it('does not confuse patch versions with matching prefixes', () => {
    const text = '## 0.6.10 - 2026-10-13\n\nWrong.\n\n## 0.6.1 - 2026-10-10\n\nCorrect.\n';
    expect(extractChangelogSection(text, 'v0.6.1')).toBe('Correct.\n');
    expect(extractChangelogSection(text, '0.6.10')).toBe('Wrong.\n');
  });
  it('prefers an exact candidate over an earlier base heading', () => {
    const text = '## Unreleased - 0.7.0\n\nBase.\n\n## 0.7.0-rc.1 - 2026-10-15\n\nCandidate.\n';
    expect(extractChangelogSection(text, 'v0.7.0-rc.1')).toBe('Candidate.\n');
    expect(extractChangelogSection(text, '0.7.0-dev.0')).toBe('Base.\n');
  });
  it('rejects missing, duplicate and empty sections before publication', () => {
    expect(() => extractChangelogSection('## 0.6.10\nOther\n', '0.6.1')).toThrow('exactly one');
    expect(() => extractChangelogSection('## 0.7.0\n', '0.7.0')).toThrow('nonempty');
    expect(() => extractChangelogSection('## 0.7.0\nOne\n## 0.7.0\nTwo\n', '0.7.0')).toThrow('exactly one');
    expect(() => extractChangelogSection('', 'latest')).toThrow('exact release');
  });
  it('does not stop at lower-level headings or borrow published stable notes for a candidate', () => {
    expect(extractChangelogSection('# Log\n## 1.0.0 — 2026-10-15\n### Fixed\nKept.\n', '1.0.0')).toBe('### Fixed\nKept.\n');
    expect(() => extractChangelogSection('## 1.0.0 - 2026-10-15\nStable.\n', '1.0.0-rc.1')).toThrow('exactly one');
  });
});
