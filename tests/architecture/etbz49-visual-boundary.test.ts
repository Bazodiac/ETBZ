// =============================================================================
// ETBZ-49 - where the visual system is allowed to sit.
//
// The module lands inside `src/application/visual` on purpose rather than as a
// new top-level layer. `dependency-direction.test.ts` already restricts the
// application layer to `zod` plus relative imports that stay inside
// application/domain, so putting the visual system there means it inherits the
// strictest existing barrier instead of opening a fresh hole beside it.
//
// This suite adds the four properties that a package allowlist cannot see:
//
//   1. it is a LEAF - no served layer imports it, and inside the application
//      layer only the ETBZ-55 presentation projection does, through the index;
//   2. it is PURE - no clock, no randomness, no process, no filesystem, which
//      is what makes a structural hash of its output meaningful;
//   3. it does NOT render - no PDF, no HTML, no headless browser;
//   4. the proof harness under `tools/` stays outside the production contract.
// =============================================================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TYPESCRIPT_EXTENSIONS, UNRESOLVABLE_DYNAMIC_IMPORT, extractImportSpecifiers } from './dependency-direction.test.js';

const REPO_ROOT = process.cwd();
const SRC_ROOT = resolve(REPO_ROOT, 'src');
const VISUAL_ROOT = join(SRC_ROOT, 'application', 'visual');
const HARNESS_ROOT = resolve(REPO_ROOT, 'tools/visual-proof-harness');
const ASSET_ROOT = resolve(REPO_ROOT, 'assets/visual-system-v1');

function listTypeScriptFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) {
        walk(entryPath);
      } else if (TYPESCRIPT_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
        found.push(entryPath);
      }
    }
  };
  walk(root);
  return found;
}

const VISUAL_FILES = listTypeScriptFiles(VISUAL_ROOT);
// An import the guard cannot resolve statically counts as a reference: the leaf check fails closed.
const referencesVisual = (specifier: string): boolean =>
  specifier === UNRESOLVABLE_DYNAMIC_IMPORT ||
  specifier.includes('application/visual') ||
  specifier.includes('/visual/') ||
  specifier.endsWith('/visual') ||
  specifier.endsWith('/visual/index.js');

// -----------------------------------------------------------------------------

describe('ETBZ-49: the visual system is a leaf, reachable from no served path', () => {
  it('is imported by no top-level src module (the server entry, the attestation script)', () => {
    const references = (specifier: string): boolean => referencesVisual(specifier);
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

  it.each(['app', 'http', 'adapters', 'domain'])(
    'is imported by no module under src/%s',
    (directory) => {
      const offenders: string[] = [];
      const root = join(SRC_ROOT, directory);
      if (!existsSync(root)) return;
      for (const file of listTypeScriptFiles(root)) {
        for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
          if (referencesVisual(specifier)) {
            offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
          }
        }
      }
      expect(
        offenders,
        `the visual system is reachable from no served layer:\n${offenders.join('\n')}`,
      ).toEqual([]);
    },
  );

  // ETBZ-55 (ADR 0012) widens this leaf by exactly one consumer: the presentation
  // projection, and only through the module's index. Any other application
  // module, or a deep import, is still an offender.
  it('is imported by no OTHER application module than the presentation projection, and there only through its index', () => {
    const offenders: string[] = [];
    let presentationUses = 0;
    const presentationRoot = join(SRC_ROOT, 'application', 'presentation');
    for (const file of listTypeScriptFiles(join(SRC_ROOT, 'application'))) {
      if (file.startsWith(VISUAL_ROOT + sep)) continue;
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (!referencesVisual(specifier)) continue;
        // Whole path segments: a sibling such as application/presentation-x/ is not the consumer.
        if (file.startsWith(presentationRoot + sep) && specifier === '../visual/index.js') {
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
    // The same matcher applied to a synthetic violation must find it, otherwise
    // the three assertions above are green for the wrong reason.
    const synthetic = "import { PAGE_FAMILY } from '../application/visual/index.js';";
    const [specifier] = extractImportSpecifiers(synthetic);
    expect(specifier).toBe('../application/visual/index.js');
    expect(referencesVisual(specifier ?? '')).toBe(true);
    expect(referencesVisual('../application/interpretation/index.js')).toBe(false);
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49: the visual system is pure', () => {
  it('ships the declared modules', () => {
    const names = VISUAL_FILES.map((file) => relative(VISUAL_ROOT, file)).sort();
    expect(names).toEqual([
      'errors.ts',
      'fonts.ts',
      'glyphs.ts',
      'index.ts',
      'pageFamily.ts',
      'pagination.ts',
      'provenance.ts',
      'tokens.ts',
      'types.ts',
      'visualSystem.ts',
      'wordmark.ts',
    ]);
  });

  it('imports nothing but zod and its own relative modules', () => {
    const offenders: string[] = [];
    for (const file of VISUAL_FILES) {
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (specifier === 'zod') continue;
        // Own modules by resolved path, never by spelling ('./../' would otherwise pass).
        if (specifier.startsWith('.') && resolve(dirname(file), specifier).startsWith(VISUAL_ROOT + sep)) continue;
        offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(
      offenders,
      `the visual system must stay runtime-agnostic:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it.each([
    ['a clock', /\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bperformance\s*\.\s*now\b/],
    ['randomness', /\bMath\s*\.\s*random\b|\brandomUUID\b|\bcrypto\s*\.\s*getRandomValues\b/],
    ['the process', /\bprocess\s*\.\s*(env|cwd|argv|platform)\b/],
    ['the filesystem', /\breadFileSync\b|\bwriteFileSync\b|\breaddirSync\b|\bfs\s*\./],
    ['the network', /\bfetch\s*\(|\bXMLHttpRequest\b|\bhttps?:\/\/[^\s"')]*\/(?:api|v\d)\b/],
    ['a renderer', /\bpuppeteer\b|\bplaywright\b|\bchromium\b|\bPDFDocument\b|\bcanvas\b/i],
  ])('does not reach for %s', (_label, pattern) => {
    const offenders: string[] = [];
    for (const file of VISUAL_FILES) {
      const source = readFileSync(file, 'utf8');
      // Comments name the forbidden things in order to explain them; only code matters.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('//'))
        .join('\n');
      const match = pattern.exec(code);
      if (match !== null) offenders.push(`${relative(REPO_ROOT, file)}: ${match[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('detects impurity when it is present (guard self-check)', () => {
    const synthetic = 'export const stamp = Date.now();';
    expect(/\bDate\s*\.\s*now\b/.test(synthetic)).toBe(true);
  });

  it('emits no page: no HTML, no PDF, no SVG document assembly', () => {
    const offenders: string[] = [];
    for (const file of VISUAL_FILES) {
      const source = readFileSync(file, 'utf8');
      // `path` and `viewBox` are DATA the contract carries; a `<svg` OPENING TAG
      // built in code would be this layer drawing something.
      if (/<svg[\s>]/.test(source) || /<!DOCTYPE/i.test(source) || /%PDF-/.test(source)) {
        offenders.push(relative(REPO_ROOT, file));
      }
    }
    expect(offenders, `the visual system describes; it does not draw:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49: the visual system computes no astrology', () => {
  it.each([
    ['a BaZi calculation', /\bsolarTerm|\bjulianDay|\bsexagenary|\bganZhi|\bcalculatePillar/i],
    ['a Wu Xing derivation', /\bcomputeWuXing|\bderiveDominant|\bcalculateBalance|\bstrengthOf/i],
    ['an interpretation', /\bgenerateProse|\bwriteReading|\binterpretChart|\bllm|\bprompt\b/i],
    ['a FuFirE call', /\bfufire\b/i],
  ])('contains no %s', (_label, pattern) => {
    const offenders: string[] = [];
    for (const file of VISUAL_FILES) {
      const match = pattern.exec(readFileSync(file, 'utf8'));
      if (match !== null) offenders.push(`${relative(REPO_ROOT, file)}: ${match[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49: the proof harness is harness, not contract', () => {
  it('exists and is declared as such', () => {
    expect(statSync(HARNESS_ROOT).isDirectory()).toBe(true);
    const readme = readFileSync(resolve(HARNESS_ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('PROOF HARNESS');
    expect(readme).toContain('not part of the ETBZ production contract');
  });

  it('is referenced by no module under src/', () => {
    const offenders: string[] = [];
    for (const file of listTypeScriptFiles(SRC_ROOT)) {
      const source = readFileSync(file, 'utf8');
      if (/tools\/visual-proof-harness/.test(source)) {
        // A comment may cite the harness as the origin of a rule; an IMPORT may not.
        for (const specifier of extractImportSpecifiers(source, file)) {
          if (specifier.includes('tools/')) {
            offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('contributes no TypeScript and no runtime dependency', () => {
    const typescriptInHarness = listTypeScriptFiles(HARNESS_ROOT);
    expect(typescriptInHarness).toEqual([]);

    const tsconfig = JSON.parse(readFileSync(resolve(REPO_ROOT, 'tsconfig.json'), 'utf8')) as {
      include: string[];
    };
    expect(tsconfig.include.some((entry) => entry.startsWith('tools/'))).toBe(false);
  });

  it('keeps the production dependency set at exactly express and zod', () => {
    const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(['express', 'zod']);

    // The harness tools are Python and Chromium; none of them may appear here.
    const declared = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
    for (const forbidden of ['puppeteer', 'playwright', 'pdfkit', 'canvas', 'sharp', 'jsdom']) {
      expect(declared, `${forbidden} is proof tooling, not a runtime dependency`).not.toContain(
        forbidden,
      );
    }
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49: the canonical assets are data, read only by tests', () => {
  it('ships the asset tree', () => {
    expect(statSync(ASSET_ROOT).isDirectory()).toBe(true);
    for (const directory of ['glyphs', 'structures', 'fixtures', 'longform', 'brand', 'fonts']) {
      expect(statSync(resolve(ASSET_ROOT, directory)).isDirectory()).toBe(true);
    }
  });

  it('is loaded by no module under src/', () => {
    const offenders: string[] = [];
    for (const file of listTypeScriptFiles(SRC_ROOT)) {
      const source = readFileSync(file, 'utf8');
      for (const specifier of extractImportSpecifiers(source, file)) {
        if (specifier.includes('assets/visual-system-v1')) {
          offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
        }
      }
    }
    expect(
      offenders,
      'the contract travels as values; nothing in src/ reads it from disk',
    ).toEqual([]);
  });

  it('keeps contracts/ unchanged - business schemas still arrive with their slice', () => {
    expect(readdirSync(resolve(REPO_ROOT, 'contracts')).sort()).toEqual(['README.md']);
  });
});
