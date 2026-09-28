/**
 * ETBZ-55 — the committed evidence is what the chain produces.
 *
 * CI cannot run the local renderer, so it verifies everything that does not need
 * a browser: the projection regenerates byte for byte from the fixtures; the
 * metrics module regenerates byte for byte from the committed Inter binaries;
 * and every hash the ArtifactManifest states is re-derived here - the PDF, the
 * contact sheet, the projection file, the template, the renderer sources, the
 * fonts. A manifest that claims what the files do not carry fails this suite.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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
  template: { ref: string; structuralHash: string };
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
    expect(manifest.qa.checks.map((check) => check.id)).toEqual(['PROJECTION_VERSION', 'FONT_PINS', 'GLYPHS_AND_CJK', 'PAGE_QA', 'PDF_READBACK', 'DETERMINISM']);
    for (const check of manifest.qa.checks) expect(check.result, check.id).toBe('PASS');
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
    expect(manifest.template.ref).toBe('bazodiac-final-template@1.0.0');
    expect(manifest.template.structuralHash).toBe(templateBinding().structuralHash);
    expect(manifest.template.structuralHash).toBe(RELEASED_TEMPLATE_HASHES['1.0.0']);
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
  });

  it('records the generation as a declaration, never as proof', () => {
    expect(manifest.generation.declared).toBe(true);
    expect(manifest.generation.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(manifest.generation.repositoryHead).toMatch(/^[0-9a-f]{40}$/u);
  });
});

describe('ETBZ-55: the QA report', () => {
  it('reports every page of the projection clean', () => {
    const report = json('qa-report.json') as { status: string; projectionStructuralHash: string; pages: { pageId: string; findings: unknown[]; platformFonts: string[] }[] };
    expect(report.status).toBe('PASSED');
    expect(report.projectionStructuralHash).toBe(projection.structuralHash);
    expect(report.pages.map((page) => page.pageId)).toEqual(projection.pages.map((page) => page.pageId));
    for (const page of report.pages) {
      expect(page.findings, page.pageId).toEqual([]);
      for (const face of page.platformFonts) expect(face.split('|')[1], `${page.pageId}: ${face}`).toMatch(/^(Inter-|InterDisplay-|NotoSansCJKsc-)/u);
    }
  });
});
