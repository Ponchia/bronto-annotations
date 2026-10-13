import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as core from '../../src/index.js';
import * as d3 from '../../src/d3/index.js';

function runtimeSourceGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  function visit(path: string): void {
    if (seen.has(path)) return;
    seen.add(path);
    const parsed = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of parsed.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) continue;
      if (ts.isExportDeclaration(node) && node.isTypeOnly) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      const specifier = node.moduleSpecifier.text;
      if (!specifier.startsWith('.') || !specifier.endsWith('.js')) continue;
      visit(resolve(dirname(path), specifier.replace(/\.js$/, '.ts')));
    }
  }
  visit(resolve(entry));
  return seen;
}

describe('0.7 entry point boundaries', () => {
  it('keeps migration helpers out of root while retaining the explicit bridge', () => {
    expect(Object.keys(core).filter((name) => /d3/i.test(name))).toEqual([]);
    expect(Object.hasOwn(core, 'refineAnnotationLayout')).toBe(false);
    expect(typeof d3.annotationFromD3Style).toBe('function');
    expect(typeof d3.createD3StyleAnnotationBuilder).toBe('function');
    expect(core.pointCallout({ id: 'normal', point: { x: 1, y: 2 }, note: { title: 'Normal' } }).id).toBe('normal');
  });
  it('does not pull the D3 migration implementation into the root module graph', () => {
    const dependencies = [...runtimeSourceGraph('src/index.ts')];
    expect(dependencies.some(path => /\/(?:d3\/|presets\/(?:index|d3-))/.test(path))).toBe(false);
    expect(dependencies.some(path => path.endsWith('/presets/basic.ts'))).toBe(true);
  });
});
