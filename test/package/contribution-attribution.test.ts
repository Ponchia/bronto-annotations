// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const settings = JSON.parse(read('../../.claude/settings.json'));

describe('repository contribution attribution', () => {
  it('disables automatic commit, PR and session attribution with compatible typed settings', () => {
    // Use the object form: older supported clients reject attribution: false.
    expect(settings.attribution).toEqual({ commit: '', pr: '', sessionUrl: false });
  });

  it('keeps the shared project configuration limited to attribution', () => {
    // This policy must not silently change permissions, hooks, model or identity.
    expect(Object.keys(settings)).toEqual(['attribution']);
  });

  it('preserves human credit and keeps historic rewriting separately approved', () => {
    const instructions = read('../../AGENTS.md');
    expect(instructions).toContain('retain genuine human co-author credit');
    expect(instructions).toContain('Published history and release tags require separate explicit approval');
  });
});
