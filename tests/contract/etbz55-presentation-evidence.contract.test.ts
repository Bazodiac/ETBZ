/**
 * ETBZ-55 — the committed evidence is what the chain produces.
 *
 * CI cannot run the local renderer, so it verifies everything that does not need
 * a browser: the projection regenerates byte for byte from the fixtures; the
 * metrics module regenerates byte for byte from the committed Inter binaries;
 * every digest the ArtifactManifest states for a committed file is re-derived
 * here - the PDF, the contact sheet, the projection file, the template and its
 * four drawing assets, the renderer sources, the Inter faces; and the committed
 * canary record proves that every renderer gate has failed once, on the same
 * renderer sources. Not re-derivable in CI, and stated as such: the
 * informational CJK face (a pinned literal - the TTC is a host font, not
 * committed), the per-page image digests of the QA report (the page images are
 * not committed), and the engine versions (a declaration).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { FONT_METRICS, RELEASED_TEMPLATE_HASHES, templateBinding } from '../../src/application/presentation/index.js';
import { PRESENTATION_PROJECTION_EVIDENCE, presentationFixture } from '../support/presentationFixture.js';

const ROOT = process.cwd();
const EVIDENCE = resolve(ROOT, 'docs/evidence/etbz-55');
const RENDERER = resolve(ROOT, 'tools/pdf-renderer');
const sha256Of = (buffer: Buffer): string => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const evidence = (name: string): Buffer => readFileSync(resolve(EVIDENCE, name));
const json = (name: string): Record<string, unknown> => JSON.parse(evidence(name).toString('utf8')) as Record<string, unknown>;

interface Manifest {
  manifestVersion: string;
  artifactId: string;
  state: string;
  mimeType: string;
  sha256: string;
  byteLength: number;
  pageCount: number;
  contactSheetSha256: string;
  input: Record<string, unknown>;
  presentation: { projectionVersion: string; structuralHash: string; fileSha256: string };
  template: Record<string, unknown>;
  renderer: { ref: string; sourceSha256: string; engine: Record<string, unknown> };
  fonts: { role: string; family: string; file: string; sha256: string; licence: string }[];
  qa: { status: string; state: string; checks: { id: string; result: string }[] };
  generation: { declared: boolean; executedAt: string; repositoryHead: string };
}

const manifest = json('artifact-manifest.json') as unknown as Manifest;
const { projection } = presentationFixture();

describe('ETBZ-55: the evidence folder', () => {
  it('holds exactly the declared files', () => {
    expect(readdirSync(EVIDENCE).sort()).toEqual([
      'README.md',
      'artifact-manifest.json',
      'bazodiac-reading.pdf',
      'contact-sheet.png',
      'presentation-projection.json',
      'qa-report.json',
      'renderer-canaries.json',
    ]);
  });

  it('regenerates the projection byte for byte from the fixtures', () => {
    expect(evidence('presentation-projection.json').toString('utf8')).toBe(`${canonicalJson(projection)}\n`);
    expect(PRESENTATION_PROJECTION_EVIDENCE).toBe('docs/evidence/etbz-55/presentation-projection.json');
  });

  it('regenerates the font metrics byte for byte from the committed Inter binaries, whose digests the asset index states', () => {
    const out = mkdtempSync(join(tmpdir(), 'etbz55-metrics-'));
    try {
      execFileSync('node', [resolve(ROOT, 'scripts/etbz55-generate-font-metrics.mjs'), '--out', out], { encoding: 'utf8' });
      expect(readFileSync(join(out, 'font-metrics.ts'), 'utf8')).toBe(readFileSync(resolve(ROOT, 'src/application/presentation/font-metrics.ts'), 'utf8'));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    const index = JSON.parse(readFileSync(resolve(ROOT, 'assets/visual-system-v1/ASSET-INTEGRITY.json'), 'utf8')) as { files: { path: string; sha256: string }[] };
    for (const face of Object.values(FONT_METRICS)) {
      expect(index.files.find((entry) => entry.path === face.file)?.sha256, face.file).toBe(face.sha256);
    }
  });
});

describe('ETBZ-55: the ArtifactManifest states what the files carry', () => {
  it('is ARTIFACT_READY with QA_PASSED, every check PASS', () => {
    expect(manifest.manifestVersion).toBe('bazodiac-artifact-manifest.v1');
    expect(manifest.state).toBe('ARTIFACT_READY');
    expect(manifest.qa.status).toBe('PASSED');
    expect(manifest.qa.state).toBe('QA_PASSED');
    expect(manifest.qa.checks.map((check) => check.id)).toEqual([
      'PROJECTION_VERSION',
      'PROJECTION_IDENTITY',
      'FONT_PINS',
      'TEMPLATE_ASSET_PINS',
      'GLYPHS_AND_CJK',
      'PAGE_STRINGS',
      'PAGE_QA',
      'PDF_READBACK',
      'DETERMINISM',
    ]);
    for (const check of manifest.qa.checks) expect(check.result, check.id).toBe('PASS');
  });

  it('agrees with the QA report and with its own check details', () => {
    const report = json('qa-report.json') as { checks: unknown[] };
    expect(report.checks).toEqual(manifest.qa.checks);
    const detail = (id: string): Record<string, unknown> => (manifest.qa.checks.find((check) => check.id === id) as unknown as { detail: Record<string, unknown> }).detail;
    expect(detail('DETERMINISM')['pdfSha256']).toBe(manifest.sha256);
    expect(detail('PDF_READBACK')['pages']).toBe(manifest.pageCount);
    expect(detail('PAGE_STRINGS')['pages']).toBe(manifest.pageCount);
    expect(detail('PROJECTION_IDENTITY')).toEqual({ projection: projection.structuralHash, template: RELEASED_TEMPLATE_HASHES['1.0.0'] });
  });

  it('binds the PDF: MIME, digest, length, page count - read back from the committed bytes', () => {
    const pdf = evidence('bazodiac-reading.pdf');
    const text = pdf.toString('latin1');
    expect(manifest.mimeType).toBe('application/pdf');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(manifest.sha256).toBe(sha256Of(pdf));
    expect(manifest.byteLength).toBe(pdf.length);
    expect(manifest.artifactId).toBe(`bazodiac-reading-${manifest.sha256.slice(7, 23)}`);
    expect(text.match(/\/Type\s*\/Page(?!s)/gu)?.length).toBe(projection.pageCount);
    expect(manifest.pageCount).toBe(projection.pageCount);
    expect(manifest.contactSheetSha256).toBe(sha256Of(evidence('contact-sheet.png')));
  });

  it('binds the input, the presentation and the template to what this repository computes', () => {
    expect(manifest.input).toEqual(projection.sources);
    expect(manifest.presentation).toEqual({
      projectionVersion: projection.projectionVersion,
      structuralHash: projection.structuralHash,
      fileSha256: sha256Of(evidence('presentation-projection.json')),
    });
    const binding = templateBinding();
    const index = JSON.parse(readFileSync(resolve(ROOT, 'assets/visual-system-v1/ASSET-INTEGRITY.json'), 'utf8')) as { files: { path: string; sha256: string }[] };
    const assets = ['tokens.css', 'glyphs/sprite.svg', 'brand/wordmark.svg', 'glyphs/manifest.json'].map((path) => {
      const sha256 = sha256Of(readFileSync(resolve(ROOT, 'assets/visual-system-v1', path)));
      expect(index.files.find((entry) => entry.path === path)?.sha256, path).toBe(sha256);
      return { path: `assets/visual-system-v1/${path}`, sha256 };
    });
    expect(manifest.template).toEqual({
      ref: 'bazodiac-final-template@1.0.0',
      structuralHash: RELEASED_TEMPLATE_HASHES['1.0.0'],
      designSystem: binding.designSystem,
      decisionSource: binding.decisionSource,
      glyphManifestSha256: binding.glyphManifestSha256,
      wordmarkSha256: binding.wordmarkSha256,
      assets,
    });
    expect(binding.structuralHash).toBe(RELEASED_TEMPLATE_HASHES['1.0.0']);
  });

  it('pins the released template identity in the renderer, which refuses any other', () => {
    const source = readFileSync(join(RENDERER, 'render_pdf.py'), 'utf8');
    expect(/^TEMPLATE_STRUCTURAL_HASH = "(sha256:[0-9a-f]{64})"$/mu.exec(source)?.[1]).toBe(RELEASED_TEMPLATE_HASHES['1.0.0']);
  });

  it('binds the renderer sources it was produced by', () => {
    const hash = createHash('sha256');
    for (const name of readdirSync(RENDERER).sort()) {
      if (!name.endsWith('.py') && !name.endsWith('.css')) continue;
      hash.update(Buffer.concat([Buffer.from(name), Buffer.from([0]), readFileSync(join(RENDERER, name)), Buffer.from([0])]));
    }
    expect(manifest.renderer.ref).toBe('bazodiac-pdf-renderer@1.0.0');
    expect(manifest.renderer.sourceSha256).toBe(`sha256:${hash.digest('hex')}`);
    expect(manifest.renderer.engine).toMatchObject({ browser: 'chromium' });
  });

  it('binds the fonts: the five committed Inter faces by digest and the pinned informational CJK face', () => {
    const text = manifest.fonts.filter((font) => font.role === 'text');
    expect(text).toHaveLength(5);
    for (const font of text) expect(font.sha256, font.file).toBe(sha256Of(readFileSync(resolve(ROOT, font.file))));
    const cjk = manifest.fonts.filter((font) => font.role === 'informational-cjk');
    expect(cjk).toEqual([
      expect.objectContaining({
        family: 'Noto Sans CJK SC',
        file: 'NotoSansCJK-Regular.ttc',
        sha256: 'sha256:b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a',
        licence: 'SIL Open Font License 1.1',
      }),
    ]);
    for (const font of manifest.fonts) expect(font.licence).toBe('SIL Open Font License 1.1');
    for (const font of manifest.fonts as unknown as { licenceFile: string }[]) expect(existsSync(resolve(ROOT, font.licenceFile)), font.licenceFile).toBe(true);
    expect(text.map((font) => font.family).sort()).toEqual(['Inter', 'Inter', 'Inter', 'Inter Display', 'Inter Display']);
  });

  it('records the generation as a declaration, on a head of this history', () => {
    expect(manifest.generation.declared).toBe(true);
    expect(manifest.generation.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(manifest.generation.repositoryHead).toMatch(/^[0-9a-f]{40}$/u);
    // CI checks out the full history (fetch-depth 0), so the declared head must be an ancestor of the tested commit.
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', manifest.generation.repositoryHead, 'HEAD'])).not.toThrow();
  });
});

describe('ETBZ-55: the QA report', () => {
  it('reports every page of the projection clean', () => {
    const report = json('qa-report.json') as { status: string; projectionStructuralHash: string; pages: { pageId: string; findings: unknown[]; platformFonts: string[] }[] };
    expect(report.status).toBe('PASSED');
    expect(report.projectionStructuralHash).toBe(projection.structuralHash);
    expect(report.pages.map((page) => page.pageId)).toEqual(projection.pages.map((page) => page.pageId));
    const pinned = ['Inter-Regular', 'Inter-Medium', 'Inter-SemiBold', 'InterDisplay-Light', 'InterDisplay-Regular', 'NotoSansCJKsc-Regular'];
    for (const page of report.pages) {
      expect(page.findings, page.pageId).toEqual([]);
      for (const face of page.platformFonts) expect(pinned, `${page.pageId}: ${face}`).toContain(face.split('|')[1]);
    }
  });
});

describe('ETBZ-55: every renderer gate has failed once, on these renderer sources', () => {
  // The canary contract, pinned here rather than read from the record: which check and finding each canary must end at.
  const EXPECTED: readonly (readonly [string, string, string | null])[] = [
    ['projection-version', 'PROJECTION_VERSION', null],
    ['projection-hash', 'PROJECTION_HASH', null],
    ['template-hash', 'TEMPLATE_HASH', null],
    ['font-pin', 'FONT_PIN', null],
    ['template-asset-pin', 'TEMPLATE_ASSET_PIN', null],
    ['cjk-face-pin', 'CJK_FACE_PIN', null],
    ['cjk-face-ambiguous', 'CJK_FACE_AMBIGUOUS', null],
    ['glyph-out-of-contract', 'GLYPH_OUT_OF_CONTRACT', null],
    ['cjk-uncovered', 'CJK_GLYPH_UNCOVERED', null],
    ['page-strings', 'PAGE_STRINGS', null],
    ['page-build', 'PAGE_BUILD', null],
    ['text-injected', 'PAGE_QA', 'TEXT_NOT_IN_PROJECTION'],
    ['text-dropped', 'PAGE_QA', 'TEXT_MISSING_FROM_PAGE'],
    ['glyph-not-in-projection', 'PAGE_QA', 'GLYPH_NOT_IN_PROJECTION'],
    ['generated-content', 'PAGE_QA', 'PSEUDO_CONTENT'],
    ['invisible-text', 'PAGE_QA', 'TEXT_INVISIBLE'],
    ['clipped-by-ancestor', 'PAGE_QA', 'CLIPPED_BY_ANCESTOR'],
    ['overflows-container', 'PAGE_QA', 'OVERFLOWS_CONTAINER'],
    ['outside-sheet', 'PAGE_QA', 'OUTSIDE_SHEET'],
    ['line-exceeds-measure', 'PAGE_QA', 'LINE_EXCEEDS_MEASURE'],
    ['overlap', 'PAGE_QA', 'OVERLAP'],
    ['wu-xing-medallion', 'PAGE_QA', 'WX_DISC_INTRUDES'],
    ['unpinned-face', 'PAGE_QA', 'TEXT_SET_IN_UNPINNED_FACE'],
    ['font-load-failed', 'PAGE_QA', 'FONT_LOAD_FAILED'],
    ['wrong-key', 'PAGE_QA', 'TEXT_OUT_OF_SLOT'],
    ['drop-copy', 'PAGE_QA', 'TEXT_MISSING_FROM_PAGE'],
    ['wu-xing-swap', 'PAGE_QA', 'TEXT_OUT_OF_SLOT'],
    ['glyph-wrong-slot', 'PAGE_QA', 'GLYPH_OUT_OF_SLOT'],
    ['hidden-display-none', 'PAGE_QA', 'TEXT_INVISIBLE'],
    ['hidden-clip-path', 'PAGE_QA', 'TEXT_INVISIBLE'],
    ['prefix-face', 'PAGE_QA', 'TEXT_SET_IN_UNPINNED_FACE'],
    ['latin-in-cjk-face', 'PAGE_QA', 'LATIN_SET_IN_CJK_FACE'],
    ['group-wrapped', 'PAGE_QA', 'GROUP_WRAPPED'],
    ['occluded-text', 'PAGE_QA', 'TEXT_OCCLUDED'],
    ['low-contrast', 'PAGE_QA', 'TEXT_LOW_CONTRAST'],
    ['forbidden-element', 'PAGE_QA', 'FORBIDDEN_ELEMENT'],
    ['text-too-small', 'PAGE_QA', 'TEXT_TOO_SMALL'],
    ['pdf-page-count', 'PDF_READBACK', 'PDF_PAGE_COUNT'],
    ['determinism', 'DETERMINISM', null],
  ];
  interface Canary {
    id: string;
    expectedCheck: string;
    expectedCode: string | null;
    observed: { exitCode: number; status: string; check: string; codes: string[] };
    pdfWritten: boolean;
    manifestWritten: boolean;
    verdict: string;
  }
  const record = json('renderer-canaries.json') as {
    canaryVersion: string;
    canarySourceSha256: string;
    canonicalJsonMirror: { numbers: number; strings: number; keys: number; nodeExitCode: number; equal: boolean; sha256: string };
    renderer: { ref: string; sourceSha256: string };
    projectionStructuralHash: string;
    summary: { canaries: number; blockedAsExpected: number };
    canaries: Canary[];
  };

  it('ran against the renderer and the projection the manifest binds, from the committed canary source', () => {
    expect(record.canaryVersion).toBe('bazodiac-renderer-canaries.v1');
    expect(record.renderer).toEqual({ ref: manifest.renderer.ref, sourceSha256: manifest.renderer.sourceSha256 });
    expect(record.projectionStructuralHash).toBe(projection.structuralHash);
    expect(record.canarySourceSha256).toBe(sha256Of(readFileSync(join(RENDERER, 'qa', 'run_canaries.py'))));
  });

  it('recorded the renderer hash mirror equal to the TypeScript canonicalJson on a fixed value set', () => {
    expect(record.canonicalJsonMirror.nodeExitCode).toBe(0);
    expect(record.canonicalJsonMirror.equal).toBe(true);
    expect(record.canonicalJsonMirror.numbers).toBeGreaterThanOrEqual(700);
  });

  it('covers every gate: identity, pins, glyphs, CJK, page build, page QA, PDF readback, determinism', () => {
    expect(record.canaries.map((canary) => [canary.id, canary.expectedCheck, canary.expectedCode])).toEqual(EXPECTED.map((entry) => [...entry]));
    // Each check of a passing render, and the refusals that prove it can fail.
    const provenBy: Readonly<Record<string, readonly string[]>> = {
      PROJECTION_VERSION: ['PROJECTION_VERSION'],
      PROJECTION_IDENTITY: ['PROJECTION_HASH', 'TEMPLATE_HASH'],
      FONT_PINS: ['FONT_PIN', 'CJK_FACE_PIN', 'CJK_FACE_AMBIGUOUS'],
      TEMPLATE_ASSET_PINS: ['TEMPLATE_ASSET_PIN'],
      GLYPHS_AND_CJK: ['GLYPH_OUT_OF_CONTRACT', 'CJK_GLYPH_UNCOVERED'],
      PAGE_STRINGS: ['PAGE_STRINGS'],
      PAGE_QA: ['PAGE_BUILD', 'PAGE_QA'],
      PDF_READBACK: ['PDF_READBACK'],
      DETERMINISM: ['DETERMINISM'],
    };
    expect(Object.keys(provenBy)).toEqual(manifest.qa.checks.map((entry) => entry.id));
    const refusals = new Set(record.canaries.map((canary) => canary.expectedCheck));
    for (const [check, ids] of Object.entries(provenBy)) for (const id of ids) expect(refusals, `${check} <- ${id}`).toContain(id);
  });

  it('blocked every canary at the expected check, with the expected finding, exit 1, and no PDF or manifest', () => {
    for (const canary of record.canaries) {
      expect(canary.verdict, canary.id).toBe('BLOCKED_AS_EXPECTED');
      expect(canary.observed.exitCode, canary.id).toBe(1);
      expect(canary.observed.status, canary.id).toBe('BLOCKED');
      expect(canary.observed.check, canary.id).toBe(canary.expectedCheck);
      if (canary.expectedCode !== null) expect(canary.observed.codes, canary.id).toContain(canary.expectedCode);
      expect(canary.pdfWritten, canary.id).toBe(false);
      expect(canary.manifestWritten, canary.id).toBe(false);
    }
    expect(record.summary).toEqual({ canaries: record.canaries.length, blockedAsExpected: record.canaries.length });
  });
});
