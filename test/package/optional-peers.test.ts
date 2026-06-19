import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('optional peer boundaries', () => {
  it('marks every adapter and renderer peer as optional package metadata', async () => {
    const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    const peers = Object.keys(pkg.peerDependencies ?? {});

    expect(peers.sort()).toEqual([
      '@terrastruct/d2',
      '@xyflow/react',
      'mermaid',
      'react',
      'react-dom',
      'vega'
    ]);
    expect(Object.keys(pkg.peerDependenciesMeta ?? {}).sort()).toEqual(peers.sort());

    for (const peer of peers) {
      expect(pkg.peerDependenciesMeta?.[peer]?.optional).toBe(true);
    }
  });

  it('keeps the root import free of optional renderer and adapter packages', async () => {
    const root = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8');

    expect(root).not.toMatch(/react|vega|mermaid|@xyflow|@terrastruct|@ponchia\/ui/);
  });

  it('keeps adapter modules duck-typed without top-level optional peer imports', async () => {
    const files = await Promise.all([
      readFile(new URL('../../src/adapters/vega.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../src/adapters/mermaid.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../src/adapters/d2.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../src/adapters/react-flow.ts', import.meta.url), 'utf8')
    ]);

    for (const file of files) {
      expect(file).not.toMatch(/from ['"](?:vega|mermaid|@xyflow\/react|@terrastruct\/d2|@ponchia\/ui)['"]/);
    }
  });
});
