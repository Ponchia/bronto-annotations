import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const includeRoots = ['src', 'examples', 'docs', 'scripts', 'test', '.github'];
const includeFiles = [
  'README.md',
  'LICENSE',
  'package.json',
  'CHANGELOG.md',
  'CONTRIBUTING.md',
  'SECURITY.md'
];
const privateNames = [
  ['home', 'tolotto'],
  ['agent', '-', 'world'],
  ['pol', 'po'],
  ['par', 'quet'],
  ['vps', '-', 'infra'],
  ['vault', 'warden']
].map((parts) => parts.join(''));
const forbiddenText = privateNames.map((name) => name.toLowerCase());
const forbiddenPatterns = [
  /\/Users\//,
  /SECRET_[A-Z0-9_]+/,
  /password\s*[:=]\s*['"][^'"]+['"]/i,
  /https?:\/\/(?!127\.0\.0\.1|localhost|vega\.github\.io)[^\s"'<>]+internal[^\s"'<>]*/i
];

const files = [
  ...includeFiles.map((file) => join(root, file)),
  ...(await collectFiles(includeRoots.map((dir) => join(root, dir))))
];
const failures = [];

for (const file of files) {
  const text = await readFile(file, 'utf8');
  const normalizedText = text.toLowerCase();

  for (const pattern of forbiddenPatterns) {
    assert(pattern.global === false, 'Forbidden patterns must not be global.');

    if (pattern.test(text)) {
      failures.push(`${relative(root, file)} matched ${pattern}`);
    }
  }

  for (const value of forbiddenText) {
    if (normalizedText.includes(value)) {
      failures.push(`${relative(root, file)} contained private marker "${value}"`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Public hygiene scan failed:\\n${failures.join('\\n')}`);
}

async function collectFiles(paths) {
  const result = [];

  for (const path of paths) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const fullPath = join(path, entry.name);

      if (entry.isDirectory()) {
        result.push(...await collectFiles([fullPath]));
    } else if (/\.(css|html|js|jsx|mjs|ts|tsx|md|json|ya?ml)$/.test(entry.name)) {
      result.push(fullPath);
    }
    }
  }

  return result;
}
