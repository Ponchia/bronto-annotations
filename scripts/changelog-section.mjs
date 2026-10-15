import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function extractChangelogSection(changelog, requestedVersion) {
  const version = requestedVersion.replace(/^v/, '');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(version)) {
    throw new Error('Expected an exact release version');
  }
  const lines = changelog.split('\n');
  const sections = [];
  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading) sections.push({ heading: heading[1].trim(), lines: [] });
    else if (sections.length) sections.at(-1).lines.push(line);
  }
  const parsed = sections.map((section) => {
    const named = /^(?:Unreleased\s+[-—]\s+)?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)(?:\s+[-—]\s+\d{4}-\d{2}-\d{2})?$/.exec(section.heading);
    return { heading: section.heading, version: named?.[1], body: section.lines.join('\n').trim() };
  });
  let matching = parsed.filter((section) => section.version === version);
  // Development tags may intentionally use their unreleased base-version notes.
  // An exact prerelease section always takes precedence over that fallback.
  if (!matching.length && version.includes('-')) {
    matching = parsed.filter((section) => section.version === version.split('-')[0]
      && section.heading.startsWith('Unreleased'));
  }
  if (matching.length !== 1 || !matching[0].body) {
    throw new Error(`Expected exactly one nonempty changelog section for ${version}`);
  }
  return matching[0].body + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const path = process.argv[3] ? resolve(process.argv[3]) : resolve(root, 'CHANGELOG.md');
  process.stdout.write(extractChangelogSection(readFileSync(path, 'utf8'), process.argv[2] || ''));
}
