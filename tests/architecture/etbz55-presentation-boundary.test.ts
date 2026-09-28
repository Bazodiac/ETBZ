// =============================================================================
// ETBZ-55 - where the PresentationProjection and the PDF renderer may sit.
//
// The projection lands in `src/application/presentation`: pure, reachable from
// no served path, importing only zod, its own modules, the two contracts it
// consumes (the ETBZ-49 visual system and the released Lexicon wording of the
// skill module, each through its index), the chart model's types and the
// domain primitives. It computes a page model; it emits no document.
//
// The renderer lands in `tools/pdf-renderer/` (ADR 0012): local-only Python
// behind the projection, never imported by `src/`, never an npm dependency,
// never run in CI - the Canonical Rebaseline section 8 allows concierge
// rendering to be local "provided the same deterministic template/versioning/
// CJK/readback/ArtifactManifest gates are met". The production dependency set
// stays express + zod and every forbidden renderer package stays forbidden.
// =============================================================================

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractImportSpecifiers } from './dependency-direction.test.js';

const REPO_ROOT = process.cwd();
const SRC_ROOT = resolve(REPO_ROOT, 'src');
const PRESENTATION_ROOT = join(SRC_ROOT, 'application', 'presentation');
const RENDERER_ROOT = resolve(REPO_ROOT, 'tools', 'pdf-renderer');

function listFiles(root: string, extension: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) walk(entryPath);
      else if (entry.endsWith(extension)) found.push(entryPath);
    }
  };
  walk(root);
  return found;
}

function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

const PRESENTATION_FILES = listFiles(PRESENTATION_ROOT, '.ts');
const referencesPresentation = (specifier: string): boolean =>
  specifier.includes('application/presentation') || specifier.includes('/presentation/') || specifier.endsWith('/presentation');

const ALLOWED_IMPORTS = new Set([
  'zod',
  '../visual/index.js',
  '../skill/index.js',
  '../horoscope-model.js',
  '../ports/fufire-gateway.js',
  '../../domain/structural-hash.js',
  '../../domain/sizhu.js',
]);

describe('ETBZ-55: the presentation projection is a pure leaf', () => {
  it('ships the declared modules', () => {
    expect(PRESENTATION_FILES.map((file) => relative(PRESENTATION_ROOT, file)).sort()).toEqual([
      'errors.ts',
      'font-metrics.ts',
      'index.ts',
      'long-form.ts',
      'projection.ts',
      'template.ts',
      'text-measure.ts',
    ]);
  });

  it('imports nothing but zod, its own modules, the two contracts it consumes, the chart model types and the domain primitives', () => {
    const offenders: string[] = [];
    for (const file of PRESENTATION_FILES) {
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (specifier.startsWith('./') || ALLOWED_IMPORTS.has(specifier)) continue;
        offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it.each(['app', 'http', 'adapters', 'domain'])('is imported by no module under src/%s', (directory) => {
    const root = join(SRC_ROOT, directory);
    expect(existsSync(root), `src/${directory} exists`).toBe(true);
    const offenders: string[] = [];
    for (const file of listFiles(root, '.ts')) {
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (referencesPresentation(specifier)) offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('is imported by no other application module', () => {
    const offenders: string[] = [];
    for (const file of listFiles(join(SRC_ROOT, 'application'), '.ts')) {
      if (file.startsWith(PRESENTATION_ROOT)) continue;
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (referencesPresentation(specifier)) offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each([
    ['a clock', /\bDate\s*\.\s*now\b|\bnew\s+Date\b|\bperformance\s*\.\s*now\b/],
    ['randomness', /\bMath\s*\.\s*random\b|\brandomUUID\b|\bcrypto\s*\.\s*getRandomValues\b/],
    ['the process', /\bprocess\s*\.\s*(env|cwd|argv|platform)\b/],
    ['the filesystem', /\breadFileSync\b|\bwriteFileSync\b|\breaddirSync\b|\bfs\s*\./],
    ['the network', /\bfetch\s*\(|\bXMLHttpRequest\b/],
    ['a browser or PDF library', /\bpuppeteer\b|\bplaywright\b|\bchromium\b|\bPDFDocument\b|\bpdfkit\b/i],
    ['a document', /<svg[\s>]|<!DOCTYPE|%PDF-|<html/i],
    ['a model call', /\bopenai\b|\banthropic\b|\bchat\.completions\b|\bmessages\.create\b/i],
  ])('does not reach for %s', (_label, pattern) => {
    const offenders: string[] = [];
    for (const file of PRESENTATION_FILES) {
      const match = pattern.exec(codeOnly(readFileSync(file, 'utf8')));
      if (match !== null) offenders.push(`${relative(REPO_ROOT, file)}: ${match[0]}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('computes no astrology: no Wu Xing weighting, no dominance, no Ten-God derivation', () => {
    const pattern = /\bderiveDominant|\bcalculateBalance|\bstrengthOf|\bcomputeTenGod|\bderiveTenGod|\bwuxing\.dominant\b/i;
    const offenders = PRESENTATION_FILES.filter((file) => pattern.test(codeOnly(readFileSync(file, 'utf8')))).map((file) => relative(REPO_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('detects impurity and a document when present (guard self-check)', () => {
    expect(/\bDate\s*\.\s*now\b/.test('const stamp = Date.now();')).toBe(true);
    expect(/<svg[\s>]|<!DOCTYPE|%PDF-|<html/i.test("const page = '<!doctype html>';")).toBe(true);
    expect(referencesPresentation('../application/presentation/index.js')).toBe(true);
  });
});

describe('ETBZ-55: the renderer is local tooling behind the projection', () => {
  it('lives in tools/pdf-renderer with its README declaring it local-only and outside CI', () => {
    const readme = readFileSync(join(RENDERER_ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('bazodiac-pdf-renderer@1.0.0');
    expect(readme).toContain('Local only');
    expect(readme).toContain('Nothing here runs in CI');
  });

  it('contains no TypeScript, and tsconfig includes no tools/ path', () => {
    expect(readdirSync(RENDERER_ROOT).filter((entry) => entry.endsWith('.ts'))).toEqual([]);
    const tsconfig = JSON.parse(readFileSync(resolve(REPO_ROOT, 'tsconfig.json'), 'utf8')) as { include?: string[] };
    expect((tsconfig.include ?? []).filter((entry) => entry.startsWith('tools'))).toEqual([]);
  });

  it('is imported by nothing under src/', () => {
    const offenders: string[] = [];
    for (const file of listFiles(SRC_ROOT, '.ts')) {
      for (const specifier of extractImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        if (specifier.includes('tools/')) offenders.push(`${relative(REPO_ROOT, file)} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('adds no npm dependency: express and zod only, no renderer package in either list', () => {
    const manifest = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(['express', 'zod']);
    const all = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    for (const forbidden of ['puppeteer', 'puppeteer-core', 'playwright', 'pdfkit', 'pdf-lib', 'jspdf', 'canvas', 'sharp', 'jsdom']) {
      expect(all, forbidden).not.toContain(forbidden);
    }
  });

  it('carries its customer text only from the projection: the page builders print through one escaping helper', () => {
    const pages = readFileSync(join(RENDERER_ROOT, 'pages.py'), 'utf8');
    // Every visible string goes through t(...) or esc(...); the only literal text the builders emit is the separator.
    expect(pages).toContain('SEP = \'<span class="sep">·</span>\'');
    expect(pages).not.toMatch(/Your chart|General education|Chapter reference|Day Master ·|Personalized BaZi/u);
  });
});
