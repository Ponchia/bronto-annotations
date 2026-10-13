import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCorpus } from './placement-quality-corpus.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let outputDir = resolve(root, '.tmp/placement-quality');
try {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--output-dir' && argv[i + 1]) outputDir = resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  const report = JSON.parse(await readFile(join(outputDir, 'results.json'), 'utf8'));
  const verified = await verifyCorpus(report);
  process.stdout.write(`${JSON.stringify({ ...verified, outputDir, passed: true })}\n`);
} catch (error) {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
}
