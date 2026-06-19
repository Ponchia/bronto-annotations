import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (process.argv[2] || '').replace(/^v/, '');
const base = raw.split('-')[0];
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
const lines = changelog.split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^##\s/.test(lines[i]) && base && lines[i].includes(base)) {
    start = i;
    break;
  }
}

if (start === -1) {
  process.stdout.write(
    `Release ${process.argv[2] || ''}. See [CHANGELOG.md](https://github.com/Ponchia/bronto-annotations/blob/main/CHANGELOG.md).\n`
  );
  process.exit(0);
}

let end = lines.length;
for (let i = start + 1; i < lines.length; i++) {
  if (/^##\s/.test(lines[i])) {
    end = i;
    break;
  }
}

const body = lines
  .slice(start + 1, end)
  .join('\n')
  .trim();

process.stdout.write(`${body}\n`);
