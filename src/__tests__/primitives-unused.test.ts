/**
 * Phase 4 guardrail: Verifies that new primitives shipped in plan 04-05 are NOT yet
 * consumed by any app code. They exist as foundation only until Phase 5 wires them in.
 *
 * DELETE THIS FILE when starting Phase 5 (UI Application). Phase 5's first plan should
 * remove this test as part of the initial wiring work.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve, basename } from 'path';

const primitives = ['Card', 'AppHeader', 'DegreeChipStrip', 'BottomTabBar', 'LabeledSelect'];
const srcDir = resolve(__dirname, '..');

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    if (!/\.(tsx?|jsx?)$/.test(e.name)) return [];
    return [p];
  });
}

describe('Phase 4 primitive isolation', () => {
  const files = walk(srcDir);

  for (const primitive of primitives) {
    it(`${primitive} is defined but not yet consumed by app code`, () => {
      const importPattern = new RegExp(
        `(from\\s+['"][^'"]*\\b${primitive}['"]|import\\s+.*\\b${primitive}\\b.*from)`
      );
      const consumers = files.filter((f) => {
        const name = basename(f);
        if (name === `${primitive}.tsx` || name === `${primitive}.test.tsx`) return false;
        if (name === 'index.tsx' && f.includes(`/${primitive}/`)) return false;
        const content = readFileSync(f, 'utf8');
        return importPattern.test(content);
      });
      expect(consumers, `${primitive} imported by: ${consumers.join(', ')}`).toEqual([]);
    });
  }
});
