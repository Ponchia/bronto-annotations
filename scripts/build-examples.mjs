import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = new URL('..', import.meta.url);
const examples = [
  'index',
  'svg-basic',
  'react-basic',
  'bronto-report',
  'dom-basic',
  'vega-basic',
  'mermaid-basic',
  'd2-basic',
  'react-flow-basic',
  'style-gallery'
];

await rm(new URL('../.tmp/examples', import.meta.url), { recursive: true, force: true });

for (const example of examples) {
  await exec(
    'npx',
    [
      'vite',
      'build',
      `examples/${example}`,
      '--outDir',
      `../../.tmp/examples/${example}`,
      '--emptyOutDir'
    ],
    { cwd: root }
  );
}
