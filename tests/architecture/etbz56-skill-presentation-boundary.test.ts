// =============================================================================
// ETBZ-56 - who may build a projection under a binding.
//
// `projectPresentation(model, content, binding)` records whatever binding it is
// handed: the Lexicon release and, for a Skill reading, the reading's
// identities. That record is only as true as the checks its caller ran, so the
// function has exactly two callers - `buildPresentationProjection` (the
// fixture-first path under the released 1.0.0 Lexicon) and
// `buildSkillReadingProjection` (which accepts the reading again and binds it to
// the package and the chart first). No other source, test, script or tool may
// name it - a call, an aliased import or a namespace access all name it. This
// is a text-level guard against a mistake: a name assembled at run time is not
// seen.
// =============================================================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = process.cwd();
const ROOTS = ['src', 'tests', 'scripts', 'tools'].map((root) => resolve(REPO_ROOT, root));
const SELF = resolve(REPO_ROOT, 'tests/architecture/etbz56-skill-presentation-boundary.test.ts');

function listFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules') continue;
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) walk(entryPath);
      else if (/\.(ts|mts|cts|tsx|js|mjs|cjs|py)$/u.test(entry)) found.push(entryPath);
    }
  };
  walk(root);
  return found;
}

describe('ETBZ-56: the bound projection build has exactly two callers', () => {
  it('is called only by projection.ts and skill-presentation.ts', () => {
    const callers: string[] = [];
    for (const file of ROOTS.flatMap(listFiles)) {
      if (file === SELF) continue;
      if (/\bprojectPresentation\b/u.test(readFileSync(file, 'utf8'))) callers.push(relative(REPO_ROOT, file));
    }
    expect(callers.sort()).toEqual(['src/application/presentation/projection.ts', 'src/application/presentation/skill-presentation.ts']);
  });

  it('is reached from the Skill path only after the bundle, the package, the reading and the chart are checked', () => {
    const source = readFileSync(resolve(REPO_ROOT, 'src/application/presentation/skill-presentation.ts'), 'utf8');
    const body = source.slice(source.indexOf('export function buildSkillReadingProjection'));
    const order = ['assertPresentedBundle(bundle)', 'assertPackageIntact(inputPackage)', 'acceptAgain(input.reading', 'assertPackageIsTheChart(model, inputPackage)', 'projectPresentation('].map((step) => body.indexOf(step));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });
});
