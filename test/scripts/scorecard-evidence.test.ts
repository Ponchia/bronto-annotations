import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = readFileSync(`${root}.github/workflows/scorecard.yml`, 'utf8');
const step = (name: string): string => {
  const marker = `      - name: ${name}\n`;
  const start = workflow.indexOf(marker);
  expect(start, `Missing ${name} step`).toBeGreaterThanOrEqual(0);
  const end = workflow.indexOf('\n      - ', start + marker.length);
  return workflow.slice(start, end < 0 ? undefined : end);
};

describe('Scorecard evidence retention', () => {
  it('retains both scan formats after failed publication without broad upload globs', () => {
    const upload = step('Retain Scorecard evidence');
    expect(upload).toContain('if: always()');
    expect(upload).toMatch(/uses: actions\/upload-artifact@[a-f0-9]{40}(?:\s|$)/);
    expect(upload).toContain('name: scorecard-evidence-${{ github.run_id }}-${{ github.run_attempt }}');
    expect(upload).toContain('path: |\n            scorecard.sarif\n            results.json\n');
    expect(upload).toContain('retention-days: 30');
    expect(upload).toContain('if-no-files-found: warn');
    expect(upload).not.toMatch(/path:.*(?:\*|\.\.)/);
  });

  it('submits an existing SARIF even after publication fails, without masking the original failure', () => {
    expect(step('Upload Scorecard SARIF')).toContain("if: always() && hashFiles('scorecard.sarif') != ''");
    expect(step('Run Scorecard')).toContain('publish_results: true');
    expect(workflow).not.toContain('continue-on-error: true');
  });

  it('keeps the publishing job inside the upstream approved-actions boundary', () => {
    expect(workflow).not.toMatch(/^\s+(?:-\s*)?run:/m);
    expect(workflow).not.toMatch(/^\s+(?:env|defaults|container|services):/m);
    const allowed = new Set(['actions/checkout', 'actions/upload-artifact',
      'ossf/scorecard-action', 'github/codeql-action/upload-sarif']);
    const actions = [...workflow.matchAll(/^\s+(?:-\s*)?uses:\s*([^@\s]+)@([a-f0-9]{40})(?:\s|$)/gm)];
    expect(actions).toHaveLength(4);
    for (const match of actions) expect(allowed.has(match[1]!)).toBe(true);
    expect(workflow).toContain('persist-credentials: false');
  });
});


describe('larger property campaign boundaries', () => {
  const campaign = readFileSync(`${root}.github/workflows/property-tests.yml`, 'utf8');
  it('supplements normal tests without adding write credentials or PR duplication', () => {
    expect(campaign).toContain('schedule:');
    expect(campaign).toContain('workflow_dispatch:');
    expect(campaign).not.toMatch(/^\s+pull_request(?:_target)?:/m);
    expect(campaign).toContain('permissions:\n  contents: read');
    expect(campaign).not.toMatch(/(?:id-token|contents|packages|actions): write/);
    expect(campaign).not.toContain('secrets.');
    expect(campaign).toContain('persist-credentials: false');
    expect(campaign).toContain('npm ci --ignore-scripts');
    expect(campaign).toContain('npm run test:property');
  });
  it('bounds the input budget and retains replay metadata on failure', () => {
    expect(campaign).toContain('timeout-minutes: 15');
    expect(campaign).toContain('5000, 1, 10000');
    expect(campaign).toContain('configuration.json');
    expect(campaign).toContain('results.json');
    expect(campaign).toContain('if: always()');
    expect(campaign).toContain('retention-days: 30');
    expect(campaign).toContain('REQUESTED_SEED: ${{ inputs.seed }}');
    expect(campaign).not.toMatch(/run:.*\$\{\{\s*inputs\./);
  });
});
