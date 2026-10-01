/**
 * ETBZ-56 — the committed evidence of the accepted Skill reading is what the chain produces.
 *
 * CI cannot run the local renderer, so it verifies what does not need a browser,
 * as for ETBZ-55: the projection regenerates byte for byte from the accepted
 * reading, its input package and the chart; the ArtifactManifest states the
 * committed PDF, contact sheet and projection file and the Skill, bundle,
 * contract and reading identities (AC 4, AC 7); the PDF is drawn by the same
 * renderer sources and the same template as the ETBZ-55 evidence (AC 1, AC-V1),
 * whose committed canary record proves every renderer gate has failed once on
 * those sources; every page is QA-clean; the committed page renders are the ones
 * the QA report hashed, and the visual verdict (AC-V2) is bound to the same
 * artifact. Not re-derivable in CI, as for ETBZ-55: the informational CJK face,
 * the engine versions, and the renders of the pages not committed.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { RELEASED_TEMPLATE_HASHES } from '../../src/application/presentation/index.js';
import { RELEASED_BUNDLE_HASHES } from '../../src/application/skill/index.js';
import { ACCEPTED_SKILL_READING, SKILL_PROJECTION_EVIDENCE, skillPresentationFixture } from '../support/skillPresentationFixture.js';

const ROOT = process.cwd();
const EVIDENCE = resolve(ROOT, 'docs/evidence/etbz-56');
const ETBZ55 = resolve(ROOT, 'docs/evidence/etbz-55');
const RENDERER = resolve(ROOT, 'tools/pdf-renderer');
const sha256Of = (buffer: Buffer): string => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const evidence = (name: string): Buffer => readFileSync(resolve(EVIDENCE, name));
const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

interface Manifest {
  manifestVersion: string;
  artifactId: string;
  state: string;
  mimeType: string;
  sha256: string;
  byteLength: number;
  pageCount: number;
  contactSheetSha256: string;
  input: Record<string, unknown> & { skill?: Record<string, unknown>; lexicon?: Record<string, unknown> };
  presentation: { projectionVersion: string; structuralHash: string; fileSha256: string };
  template: Record<string, unknown>;
  renderer: { ref: string; sourceSha256: string; engine: Record<string, unknown> };
  fonts: unknown[];
  qa: { status: string; state: string; checks: { id: string; result: string; detail?: Record<string, unknown> }[] };
  generation: { declared: boolean; executedAt: string; repositoryHead: string };
}

interface QaReport {
  status: string;
  projectionStructuralHash: string;
  checks: unknown[];
  pages: { pageId: string; pageLabel: string; findings: unknown[]; pngSha256: string }[];
}

const manifest = json<Manifest>(resolve(EVIDENCE, 'artifact-manifest.json'));
const manifest55 = json<Manifest>(resolve(ETBZ55, 'artifact-manifest.json'));
const report = json<QaReport>(resolve(EVIDENCE, 'qa-report.json'));
const { projection, reading } = skillPresentationFixture();

describe('ETBZ-56: the evidence folder', () => {
  it('holds exactly the declared files', () => {
    expect(readdirSync(EVIDENCE).sort()).toEqual([
      'README.md',
      'artifact-manifest.json',
      'bazodiac-reading.pdf',
      'contact-sheet.png',
      'pages',
      'presentation-projection.json',
      'qa-report.json',
      'visual-verdict.json',
    ]);
  });

  it('regenerates the projection byte for byte from the accepted reading, its package and the chart', () => {
    expect(evidence('presentation-projection.json').toString('utf8')).toBe(`${canonicalJson(projection)}\n`);
    expect(SKILL_PROJECTION_EVIDENCE).toBe('docs/evidence/etbz-56/presentation-projection.json');
  });
});

describe('ETBZ-56: the ArtifactManifest states the file and the Skill identities', () => {
  it('is ARTIFACT_READY with QA_PASSED, every check PASS, and agrees with the QA report', () => {
    expect(manifest.manifestVersion).toBe('bazodiac-artifact-manifest.v1');
    expect(manifest.state).toBe('ARTIFACT_READY');
    expect(manifest.qa.status).toBe('PASSED');
    expect(manifest.qa.state).toBe('QA_PASSED');
    expect(manifest.qa.checks.map((check) => check.id)).toEqual(manifest55.qa.checks.map((check) => check.id));
    for (const check of manifest.qa.checks) expect(check.result, check.id).toBe('PASS');
    expect(report.checks).toEqual(manifest.qa.checks);
    const detail = (id: string): Record<string, unknown> => manifest.qa.checks.find((check) => check.id === id)?.detail ?? {};
    expect(detail('DETERMINISM')['pdfSha256']).toBe(manifest.sha256);
    expect(detail('PDF_TEXT_LAYER')['pages']).toBe(manifest.pageCount);
    expect(detail('PDF_TEXT_LAYER')['printedStrings']).toBe(detail('PAGE_QA')['textNodes']);
    expect(detail('PDF_TEXT_LAYER')['clippedUnits']).toBe(0);
    expect(detail('PDF_VECTOR_LAYER')['displayGlyphs']).toBe(detail('PAGE_QA')['displayGlyphs']);
    expect(detail('PROJECTION_IDENTITY')).toEqual({ projection: projection.structuralHash, template: RELEASED_TEMPLATE_HASHES['1.0.0'] });
  });

  it('binds the PDF: MIME, digest, length, page count - read back from the committed bytes', () => {
    const pdf = evidence('bazodiac-reading.pdf');
    const text = pdf.toString('latin1');
    expect(manifest.mimeType).toBe('application/pdf');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(manifest.sha256).toBe(sha256Of(pdf));
    expect(manifest.byteLength).toBe(pdf.length);
    expect(manifest.artifactId).toBe(`bazodiac-reading-${manifest.sha256.slice(7, 23)}`);
    expect(text.match(/\/Type\s*\/Page(?!s)/gu)?.length).toBe(projection.pageCount);
    expect(manifest.pageCount).toBe(projection.pageCount);
    expect(manifest.contactSheetSha256).toBe(sha256Of(evidence('contact-sheet.png')));
  });

  it('records the projection sources: the chart, the content, Lexicon 1.1.0, the animal table and the Skill identities (AC 4, AC 7)', () => {
    expect(manifest.input).toEqual(projection.sources);
    expect(manifest.presentation).toEqual({
      projectionVersion: projection.projectionVersion,
      structuralHash: projection.structuralHash,
      fileSha256: sha256Of(evidence('presentation-projection.json')),
    });
    expect(manifest.input.lexicon).toEqual({ contractRef: 'terminology-wording-lexicon@1.1.0', confluencePageId: '77529091', confluencePageVersion: '4' });
    const skill = manifest.input.skill ?? {};
    expect(skill['skillRef']).toBe('bazodiac-interpretation-skill@1.1.0');
    expect(skill['bundleRef']).toBe('bazodiac-skill-contract-bundle@1.1.0');
    expect(skill['bundleStructuralHash']).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
    // The reading the Human Editorial Gate accepted (Jira ETBZ-57 comment 16969), as committed by ETBZ-57.
    expect(skill['readingStructuralHash']).toBe(reading['structuralHash']);
    expect(skill['readingStructuralHash']).toBe(json<{ structuralHash: string }>(resolve(ROOT, ACCEPTED_SKILL_READING)).structuralHash);
  });

  it('is drawn by the same renderer sources and the same template as the ETBZ-55 evidence - no second path (AC 1, AC-V1)', () => {
    const hash = createHash('sha256');
    for (const name of readdirSync(RENDERER).sort()) {
      if (!name.endsWith('.py') && !name.endsWith('.css')) continue;
      hash.update(Buffer.concat([Buffer.from(name), Buffer.from([0]), readFileSync(join(RENDERER, name)), Buffer.from([0])]));
    }
    expect(manifest.renderer.sourceSha256).toBe(`sha256:${hash.digest('hex')}`);
    expect(manifest.renderer).toEqual(manifest55.renderer);
    expect(manifest.template).toEqual(manifest55.template);
    expect(manifest.fonts).toEqual(manifest55.fonts);
    // The canary record that proves every gate of these renderer sources has failed once is the ETBZ-55 one.
    const record = json<{ renderer: { ref: string; sourceSha256: string }; summary: { canaries: number; blockedAsExpected: number; controls: number; passedAsExpected: number } }>(
      resolve(ETBZ55, 'renderer-canaries.json'),
    );
    expect(record.renderer).toEqual({ ref: manifest.renderer.ref, sourceSha256: manifest.renderer.sourceSha256 });
    expect(record.summary.blockedAsExpected).toBe(record.summary.canaries);
    expect(record.summary.passedAsExpected).toBe(record.summary.controls);
  });

  it('records the generation as a declaration, on a head of this history', () => {
    expect(manifest.generation.declared).toBe(true);
    expect(manifest.generation.executedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', manifest.generation.repositoryHead, 'HEAD'])).not.toThrow();
  });
});

describe('ETBZ-56: the QA report and the visual evidence', () => {
  it('reports every page of the projection clean', () => {
    expect(report.status).toBe('PASSED');
    expect(report.projectionStructuralHash).toBe(projection.structuralHash);
    expect(report.pages.map((page) => page.pageId)).toEqual(projection.pages.map((page) => page.pageId));
    for (const page of report.pages) expect(page.findings, page.pageId).toEqual([]);
  });

  it('commits the representative full-size renders the QA report hashed, covering the pages the verdict must inspect', () => {
    const files = readdirSync(resolve(EVIDENCE, 'pages')).sort();
    for (const file of files) {
      const page = report.pages.find((entry) => entry.pageLabel === file.slice(0, 2));
      expect(page, file).toBeDefined();
      expect(file).toBe(`${page?.pageLabel ?? ''}-${page?.pageId ?? ''}.png`);
      expect(sha256Of(readFileSync(resolve(EVIDENCE, 'pages', file))), file).toBe(page?.pngSha256);
    }
    const ids = files.map((file) => file.slice(3, -4));
    // Rebaseline section 18 names these; the AC 8 pages (every page that displays a branch) are committed too.
    for (const required of ['cover', 'identity', 'glance', 'four-pillars', 'foundation', 'day-master', 'wu-xing-distribution', 'five-phases', 'hidden-stems', 'ten-gods', 'chapter-01-p1', 'chapter-01-p2', 'reflection', 'summary', 'method-note']) {
      expect(ids, required).toContain(required);
    }
  });

  it('binds the visual verdict to this artifact and these renders (AC-V2)', () => {
    const verdict = json<{
      verdict: string;
      artifact: { artifactId: string; pdfSha256: string; contactSheetSha256: string; pageCount: number };
      checks: { check: string; result: string }[];
      defects: unknown[];
      pages: { file: string; pngSha256: string }[];
    }>(resolve(EVIDENCE, 'visual-verdict.json'));
    expect(['VISUALLY_FIT_FOR_GOLDEN', 'BLOCKED_BY_PRESENTATION_DEFECT']).toContain(verdict.verdict);
    expect(verdict.verdict === 'VISUALLY_FIT_FOR_GOLDEN').toBe(verdict.defects.length === 0);
    expect(verdict.artifact).toEqual({ artifactId: manifest.artifactId, pdfSha256: manifest.sha256, contactSheetSha256: manifest.contactSheetSha256, pageCount: manifest.pageCount });
    // A fit verdict passes every check; a blocked one names its defects (the checks may then carry any result).
    if (verdict.verdict === 'VISUALLY_FIT_FOR_GOLDEN') for (const check of verdict.checks) expect(check.result, check.check).toBe('PASS');
    expect(verdict.pages.map((page) => page.file)).toEqual(readdirSync(resolve(EVIDENCE, 'pages')).sort().map((file) => `pages/${file}`));
    for (const page of verdict.pages) expect(page.pngSha256, page.file).toBe(sha256Of(readFileSync(resolve(EVIDENCE, page.file))));
  });
});
