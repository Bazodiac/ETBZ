// =============================================================================
// ETBZ-51 - where the Skill Contract Bundle is allowed to sit.
//
// The bundle lands inside `src/application/skill` rather than as a file under
// `contracts/` or a JSON asset: `dependency-direction.test.ts` already limits
// the application layer to `zod` plus relative imports inside
// application/domain, so the bundle inherits that barrier, and the value form
// is what a structural hash freezes. This suite adds what an allowlist cannot
// see:
//
//   1. it is a LEAF - no served layer imports it, and inside the application
//      layer only the ETBZ-55 presentation projection does, through the index;
//   2. it is PURE - no clock, randomness, process, filesystem or network;
//   3. it binds, it does not execute - no model call, no prose generation, no
//      astrology;
//   4. its only outward imports are the interpretation modules it binds to and
//      the domain hashing primitives.
// =============================================================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TYPESCRIPT_EXTENSIONS, UNRESOLVABLE_DYNAMIC_IMPORT, extractImportSpecifiers } from './dependency-direction.test.js';

const REPO_ROOT = process.cwd();
const SRC_ROOT = resolve(REPO_ROOT, 'src');
const SKILL_ROOT = join(SRC_ROOT, 'application', 'skill');

function listFiles(root: string, extension: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) {
        walk(entryPath);
      } else if (entry.endsWith(extension)) {
        found.push(entryPath);
      }
    }
  };
  walk(root);
  return found;
}

const SKILL_FILES = listFiles(SKILL_ROOT, '.ts');
// An import the guard cannot resolve statically counts as a reference: the leaf check fails closed.
const referencesSkill = (specifier: string): boolean =>
  specifier === UNRESOLVABLE_DYNAMIC_IMPORT ||
  specifier.includes('application/skill') ||
  specifier.includes('/skill/') ||
  specifier.endsWith('/skill') ||
  specifier.endsWith('/skill/index.js');

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

// -----------------------------------------------------------------------------

describe('ETBZ-51: the skill contract bundle is a leaf, reachable from no served path', () => {
  it('is imported by no top-level src module (the server entry, the attestation script)', () => {
    const references = (specifier: string): boolean => referencesSkill(specifier);
    const roots = readdirSync(SRC_ROOT).filter((entry) => !statSync(join(SRC_ROOT, entry)).isDirectory() && TYPESCRIPT_EXTENSIONS.some((extension) => entry.endsWith(extension)));
    expect(roots.length, 'top-level src modules exist').toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const entry of roots) {
      const path = join(SRC_ROOT, entry);
      for (const specifier of extractImportSpecifiers(readFileSync(path, 'utf8'), path)) if (references(specifier)) offenders.push(`src/${entry} -> ${specifier}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('scans every src directory there is (a new directory must join the scans below)', () => {
    const directories = readdirSync(SRC_ROOT).filter((entry) => statSync(join(SRC_ROOT, entry)).isDirectory()).sort();
    expect(directories).toEqual(['adapters', 'app', 'application', 'domain', 'http']);
  });

  it.each(['app', 'http', 'adapters', 'domain'])('is imported by no module under src/%s', (directory) => {
    const offenders: string[] = [];
    const root = join(SRC_ROOT, directory);
    // Every layer this guard covers exists; a missing one would make the check vacuous.
    expect(existsSync(root), `src/${directory} exists`).toBe(true);
    for (const file of TYPESCRIPT_EXTENSIONS.flatMap((extension) => listFiles(root, extension))) {
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (referencesSkill(specifier)) offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(
      offenders,
      `the bundle is reachable from no served layer:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // ETBZ-55 (ADR 0012) widens this leaf by exactly one consumer: the presentation
  // projection reads the released Lexicon wording and the wording gates, and
  // only through the module's index. Any other application module, or a deep
  // import, is still an offender.
  it('is imported by no OTHER application module than the presentation projection, and there only through its index', () => {
    const offenders: string[] = [];
    let presentationUses = 0;
    const presentationRoot = join(SRC_ROOT, 'application', 'presentation');
    for (const file of TYPESCRIPT_EXTENSIONS.flatMap((extension) => listFiles(join(SRC_ROOT, 'application'), extension))) {
      if (file.startsWith(SKILL_ROOT + sep)) continue;
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (!referencesSkill(specifier)) continue;
        // Whole path segments: a sibling such as application/presentation-x/ is not the consumer.
        if (file.startsWith(presentationRoot + sep) && specifier === '../skill/index.js') {
          presentationUses += 1;
          continue;
        }
        offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
    // The allowance is used - otherwise it is a hole, not a decision.
    expect(presentationUses).toBeGreaterThan(0);
  });

  it('detects the import it forbids (guard self-check)', () => {
    const synthetic = "import { buildSkillContractBundle } from '../application/skill/index.js';";
    const [specifier] = extractImportSpecifiers(synthetic);
    expect(specifier).toBe('../application/skill/index.js');
    expect(referencesSkill(specifier ?? '')).toBe(true);
    expect(referencesSkill('../application/interpretation/index.js')).toBe(false);
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-51: the skill contract bundle is pure and binds rather than executes', () => {
  it('ships the declared modules', () => {
    const names = SKILL_FILES.map((file) => relative(SKILL_ROOT, file)).sort();
    expect(names).toEqual([
      'canon-v2-contracts.ts',
      'contract-sources-v2.ts',
      'contract-sources.ts',
      'deep-freeze.ts',
      'errors.ts',
      'index.ts',
      'individuality-contract.ts',
      'semantic-envelope-v1-1.ts',
      'semantic-envelope-v2.ts',
      'semantic-envelope.ts',
      'skill-contract-bundle.ts',
      'skill-package.ts',
      'skill-reading.ts',
      'skill-run-errors.ts',
      'wording-boundaries-v1-1.ts',
      'wording-boundaries-v2.ts',
      'wording-boundaries.ts',
    ]);
  });

  it('imports nothing but zod, its own modules, the interpretation modules it binds and the domain hashing primitives', () => {
    const offenders: string[] = [];
    for (const file of SKILL_FILES) {
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (specifier === 'zod') continue;
        // Decided by resolved path, never by spelling ('./../' would otherwise pass).
        const target = specifier.startsWith('.') ? resolve(dirname(file), specifier) : null;
        if (target !== null && target.startsWith(SKILL_ROOT + sep)) continue;
        if (target !== null && target.startsWith(join(SRC_ROOT, 'application', 'interpretation') + sep)) continue;
        if (target === join(SRC_ROOT, 'domain', 'structural-hash.js') || target === join(SRC_ROOT, 'domain', 'canonical-json.js')) continue;
        offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(offenders, `the bundle binds contracts; it reaches nothing else:\n${offenders.join('\n')}`).toEqual([]);
  });

  it.each([
    ['a clock', /\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bperformance\s*\.\s*now\b/],
    ['randomness', /\bMath\s*\.\s*random\b|\brandomUUID\b|\bcrypto\s*\.\s*getRandomValues\b/],
    ['the process', /\bprocess\s*\.\s*(env|cwd|argv|platform)\b/],
    ['the filesystem', /\breadFileSync\b|\bwriteFileSync\b|\breaddirSync\b|\bfs\s*\./],
    ['the network', /\bfetch\s*\(|\bXMLHttpRequest\b|\bhttps?:\/\/[^\s"')]*\/(?:api|v\d)\b/],
    ['a model call', /\bopenai\b|\banthropic\b|\bchat\.completions\b|\bmessages\.create\b|\bcreateCompletion\b|\bgenerateText\b/i],
    ['prose generation', /\bgenerateProse\b|\bwriteReading\b|\brenderChapter\b|\bcomposeNarrative\b/i],
  ])('does not reach for %s', (_label, pattern) => {
    const offenders: string[] = [];
    for (const file of SKILL_FILES) {
      const match = pattern.exec(codeOnly(readFileSync(file, 'utf8')));
      if (match !== null) offenders.push(`${relative(REPO_ROOT, file)}: ${match[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('detects impurity when it is present (guard self-check)', () => {
    expect(/\bDate\s*\.\s*now\b/.test('export const stamp = Date.now();')).toBe(true);
    expect(/\breadFileSync\b/.test("readFileSync('bundle.json')")).toBe(true);
  });

  it.each([
    ['a BaZi calculation', /\bsolarTerm|\bjulianDay|\bsexagenary|\bganZhi|\bcalculatePillar/i],
    ['a Wu Xing derivation', /\bcomputeWuXing|\bderiveDominant|\bcalculateBalance|\bstrengthOf/i],
    ['a Ten-God derivation', /\bderiveTenGod|\bcomputeTenGod|\bresolveTenGod/i],
  ])('computes no astrology: contains no %s', (_label, pattern) => {
    const offenders: string[] = [];
    for (const file of SKILL_FILES) {
      const match = pattern.exec(codeOnly(readFileSync(file, 'utf8')));
      if (match !== null) offenders.push(`${relative(REPO_ROOT, file)}: ${match[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('ships as values: no JSON, YAML or data file beside the modules', () => {
    const nonTypeScript = readdirSync(SKILL_ROOT).filter((entry) => !entry.endsWith('.ts'));
    expect(nonTypeScript).toEqual([]);
  });

  it('keeps contracts/ unchanged - business schemas still arrive with their slice', () => {
    expect(readdirSync(resolve(REPO_ROOT, 'contracts')).sort()).toEqual(['README.md']);
  });

  it('keeps the production dependency set at exactly express and zod', () => {
    const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(['express', 'zod']);
  });
});
