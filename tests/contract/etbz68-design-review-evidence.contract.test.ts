/**
 * ETBZ-68 — the committed design-review evidence is what the fixture produces.
 *
 * A synthetic 30-page design-review document for the Product Owner's visual
 * acceptance, not a customer artifact. CI cannot render, so it re-derives
 * everything that needs no browser:
 * - the composed content from the placeholder corpus;
 * - the projection from the chart and the content;
 * - the page behaviour map from the projection;
 * - every digest the manifest states for a committed file;
 * - the page count and page size from the PDF bytes;
 * - every committed page image against the digest the QA report hashed;
 * - the run record against the manifest.
 *
 * The page count of 30 is an assertion about this fixture only. No production
 * module reads it; the paginator, budgets, template and renderer are the
 * released ones, and the identities are required equal to the ETBZ-55 evidence.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { RELEASED_TEMPLATE_HASHES } from '../../src/application/presentation/index.js';
import {
  DESIGN_REVIEW_BEHAVIOUR_MAP,
  DESIGN_REVIEW_CONTENT,
  DESIGN_REVIEW_PROJECTION_EVIDENCE,
  composeDesignReviewContent,
  designReviewFixture,
  loadPlaceholderCorpus,
  pageBehaviourMap,
} from '../support/designReviewFixture.js';

const ROOT = process.cwd();
const EVIDENCE = resolve(ROOT, 'docs/evidence/etbz-68');
const RENDERER = resolve(ROOT, 'tools/pdf-renderer');
const sha256Of = (buffer: Buffer): string => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const evidence = (name: string): Buffer => readFileSync(resolve(EVIDENCE, name));
const json = <T>(path: string): T => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T;

interface Manifest {
  artifactId: string;
  state: string;
  mimeType: string;
  sha256: string;
  byteLength: number;
  pageCount: number;
  contactSheetSha256: string;
  input: Record<string, unknown> & { chartModelStructuralHash: string; contentStructuralHash: string };
  presentation: { projectionVersion: string; structuralHash: string; fileSha256: string };
  template: { ref: string; structuralHash: string } & Record<string, unknown>;
  renderer: { ref: string; sourceSha256: string; engine: Record<string, unknown> };
  qa: { status: string; state: string; checks: { id: string; result: string; detail: unknown }[] };
  generation: { declared: boolean; executedAt: string; repositoryHead: string };
}

interface QaReport {
  status: string;
  projectionStructuralHash: string;
  checks: unknown[];
  pages: { pageId: string; pageLabel: string; findings: unknown[]; pngSha256: string }[];
}

const manifest = json<Manifest>('docs/evidence/etbz-68/artifact-manifest.json');
const etbz55 = json<Manifest>('docs/evidence/etbz-55/artifact-manifest.json');
const report = json<QaReport>('docs/evidence/etbz-68/qa-report.json');
const { content, projection } = designReviewFixture();
const behaviourMap = pageBehaviourMap(projection, content);

/** The customer page sequence the PO brief fixes for the review document. */
const PAGE_SEQUENCE = [
  'cover', 'identity', 'contents', 'glance', 'four-pillars', 'foundation', 'day-master', 'wu-xing-distribution',
  'five-phases', 'ten-gods', 'hidden-stems',
  'chapter-01-p1', 'chapter-01-p2', 'chapter-01-p3',
  'chapter-02-p1', 'chapter-02-p2', 'chapter-03-p1', 'chapter-03-p2', 'chapter-04-p1', 'chapter-04-p2',
  'chapter-05-p1', 'chapter-05-p2', 'chapter-06-p1', 'chapter-06-p2', 'chapter-07-p1', 'chapter-07-p2',
  'reflection', 'summary', 'closing', 'method-note',
];

/** Every long-form behaviour the brief requires pages 12-26 to exercise. */
const REQUIRED_BEHAVIOURS = [
  'opener', 'continuation', 'two-column', 'one-column', 'column-split', 'continues-across-page',
  'continued-from-previous-page', 'orphan-widow-boundary', 'paragraph-moved-whole', 'short-paragraph',
  'long-paragraph', 'dense-with-sidebar', 'sparse-with-reference-panel',
];

describe('ETBZ-68: the evidence folder', () => {
  it('holds exactly the declared files', () => {
    expect(readdirSync(EVIDENCE).sort()).toEqual([
      'README.md',
      'artifact-manifest.json',
      'contact-sheet.png',
      'fixture',
      'page-behaviour-map.json',
      'pages',
      'presentation-projection.json',
      'qa-report.json',
      'run-record.json',
      'synthetic-design-review.pdf',
      'visual-review-checklist.md',
    ]);
    expect(readdirSync(join(EVIDENCE, 'fixture')).sort()).toEqual(['design-review-content.json', 'placeholder-corpus.v1.json']);
    expect(readdirSync(join(EVIDENCE, 'pages')).sort()).toEqual(PAGE_SEQUENCE.map((id, index) => `${String(index + 1).padStart(2, '0')}-${id}.png`));
  });

  it('regenerates the content, the projection and the behaviour map byte for byte', () => {
    expect(readFileSync(resolve(ROOT, DESIGN_REVIEW_CONTENT), 'utf8')).toBe(`${canonicalJson(content)}\n`);
    expect(readFileSync(resolve(ROOT, DESIGN_REVIEW_PROJECTION_EVIDENCE), 'utf8')).toBe(`${canonicalJson(projection)}\n`);
    expect(readFileSync(resolve(ROOT, DESIGN_REVIEW_BEHAVIOUR_MAP), 'utf8')).toBe(`${canonicalJson(behaviourMap)}\n`);
  });

  it('composes the same content from the same corpus every time', () => {
    const corpus = loadPlaceholderCorpus();
    expect(canonicalJson(composeDesignReviewContent(corpus))).toBe(canonicalJson(composeDesignReviewContent(loadPlaceholderCorpus())));
  });

  it('hand-authors no symbolic value: the corpus carries no CJK character, the chart is the ETBZ-55 fixture chart', () => {
    const corpusText = readFileSync(resolve(ROOT, 'docs/evidence/etbz-68/fixture/placeholder-corpus.v1.json'), 'utf8');
    expect(corpusText.match(/[\u3400-\u9fff]/gu)).toBeNull();
    expect(manifest.input.chartModelStructuralHash).toBe(etbz55.input.chartModelStructuralHash);
  });
});

describe('ETBZ-68: the review document is 30 pages, by content alone', () => {
  it('lays the fixture out on exactly the 30 pages of the brief, in order', () => {
    expect(projection.pageCount).toBe(30);
    expect(projection.pages.map((page) => page.pageId)).toEqual(PAGE_SEQUENCE);
  });

  it('sets chapter 1 on three pages and chapters 2-7 on two pages each', () => {
    const perChapter = new Map<number, number>();
    for (const page of behaviourMap) if (page.chapter !== null) perChapter.set(page.chapter, (perChapter.get(page.chapter) ?? 0) + 1);
    expect([...perChapter.entries()]).toEqual([[1, 3], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2]]);
  });

  it('exercises every required long-form behaviour on pages 12-26, read from the projection', () => {
    const longForm = behaviourMap.filter((page) => page.kind === 'longForm');
    expect(longForm.map((page) => page.pageNumber)).toEqual(Array.from({ length: 15 }, (_, index) => index + 12));
    const seen = new Set(longForm.flatMap((page) => page.behaviours));
    for (const behaviour of REQUIRED_BEHAVIOURS) expect(seen.has(behaviour), behaviour).toBe(true);
  });

  it('uses the released template and renderer, identical to the ETBZ-55 evidence', () => {
    expect(manifest.template.ref).toBe('bazodiac-final-template@1.0.0');
    expect(manifest.template.structuralHash).toBe(RELEASED_TEMPLATE_HASHES['1.0.0']);
    expect(manifest.template).toEqual(etbz55.template);
    const hash = createHash('sha256');
    for (const name of readdirSync(RENDERER).sort()) {
      if (!name.endsWith('.py') && !name.endsWith('.css')) continue;
      hash.update(Buffer.concat([Buffer.from(name), Buffer.from([0]), readFileSync(join(RENDERER, name)), Buffer.from([0])]));
    }
    expect(manifest.renderer.ref).toBe('bazodiac-pdf-renderer@1.0.0');
    expect(manifest.renderer.sourceSha256).toBe(`sha256:${hash.digest('hex')}`);
    expect(manifest.renderer.sourceSha256).toBe(etbz55.renderer.sourceSha256);
  });
});

describe('ETBZ-68: the ArtifactManifest and the QA report', () => {
  it('is ARTIFACT_READY with QA_PASSED, all eleven checks PASS', () => {
    expect(manifest.state).toBe('ARTIFACT_READY');
    expect(manifest.qa.status).toBe('PASSED');
    expect(manifest.qa.state).toBe('QA_PASSED');
    expect(manifest.qa.checks).toHaveLength(11);
    for (const check of manifest.qa.checks) expect(check.result, check.id).toBe('PASS');
    expect(report.checks).toEqual(manifest.qa.checks);
  });

  it('binds the PDF: digest, length, 30 A4 pages - read back from the committed bytes', () => {
    const pdf = evidence('synthetic-design-review.pdf');
    const text = pdf.toString('latin1');
    expect(manifest.mimeType).toBe('application/pdf');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(manifest.sha256).toBe(sha256Of(pdf));
    expect(manifest.byteLength).toBe(pdf.length);
    expect(manifest.artifactId).toBe(`bazodiac-reading-${manifest.sha256.slice(7, 23)}`);
    expect(text.match(/\/Type\s*\/Page(?!s)/gu)?.length).toBe(30);
    expect(manifest.pageCount).toBe(30);
    const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/gu)];
    expect(boxes).toHaveLength(30);
    // A4 is 595.28 x 841.89 pt; the renderer's readback tolerance is 0.6 pt.
    for (const [, width, height] of boxes) {
      expect(Math.abs(Number(width) - 595.28)).toBeLessThan(0.6);
      expect(Math.abs(Number(height) - 841.89)).toBeLessThan(0.6);
    }
    expect(manifest.contactSheetSha256).toBe(sha256Of(evidence('contact-sheet.png')));
  });

  it('binds the input and the presentation to what this repository computes', () => {
    expect(manifest.input).toEqual(projection.sources);
    expect(manifest.presentation).toEqual({
      projectionVersion: projection.projectionVersion,
      structuralHash: projection.structuralHash,
      fileSha256: sha256Of(evidence('presentation-projection.json')),
    });
  });

  it('reports every page clean, and every committed page image is the one the QA report hashed', () => {
    expect(report.status).toBe('PASSED');
    expect(report.projectionStructuralHash).toBe(projection.structuralHash);
    expect(report.pages.map((page) => page.pageId)).toEqual(PAGE_SEQUENCE);
    for (const page of report.pages) {
      expect(page.findings, page.pageId).toEqual([]);
      expect(sha256Of(evidence(`pages/${page.pageLabel}-${page.pageId}.png`)), page.pageId).toBe(page.pngSha256);
    }
  });

  it('records the generation as a declaration, on a head of this history', () => {
    expect(manifest.generation.declared).toBe(true);
    expect(manifest.generation.repositoryHead).toMatch(/^[0-9a-f]{40}$/u);
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', manifest.generation.repositoryHead, 'HEAD'])).not.toThrow();
  });
});

describe('ETBZ-68: the run record and the review checklist', () => {
  interface RunRecord {
    nature: string;
    notACustomerArtifact: boolean;
    repositoryHead: string;
    fixture: { corpusFileSha256: string; contentStructuralHash: string; chartModelStructuralHash: string; projectionStructuralHash: string };
    output: { pdfSha256: string; pageCount: number; contactSheetSha256: string; pageImages: number };
    determinism: Record<string, unknown>;
    notRendered: { component: string }[];
  }
  const record = json<RunRecord>('docs/evidence/etbz-68/run-record.json');

  it('labels the document synthetic and agrees with the manifest', () => {
    expect(record.nature).toBe('SYNTHETIC_DESIGN_REVIEW_FIXTURE');
    expect(record.notACustomerArtifact).toBe(true);
    expect(record.repositoryHead).toBe(manifest.generation.repositoryHead);
    expect(record.fixture.corpusFileSha256).toBe(sha256Of(evidence('fixture/placeholder-corpus.v1.json')));
    expect(record.fixture.contentStructuralHash).toBe(manifest.input.contentStructuralHash);
    expect(record.fixture.chartModelStructuralHash).toBe(manifest.input.chartModelStructuralHash);
    expect(record.fixture.projectionStructuralHash).toBe(projection.structuralHash);
    expect(record.output).toMatchObject({ pdfSha256: manifest.sha256, pageCount: 30, contactSheetSha256: manifest.contactSheetSha256, pageImages: 30 });
  });

  it('records two render processes with identical output, every page image included', () => {
    expect(record.determinism).toMatchObject({
      pdfIdentical: true,
      contactSheetIdentical: true,
      qaReportIdentical: true,
      manifestIdentical: true,
      pageImagesIdentical: 30,
      pageImagesCompared: 30,
    });
  });

  it('names the four components this fixture does not render', () => {
    expect(record.notRendered.map((entry) => entry.component)).toEqual(['ChapterDivider', 'ChartMotifSummary', 'KeyInsightPanel', 'pull quote']);
  });

  it('lists pages 1-30 against their committed renders and leaves the verdict to the Product Owner', () => {
    const checklist = evidence('visual-review-checklist.md').toString('utf8');
    PAGE_SEQUENCE.forEach((id, index) => {
      expect(checklist).toContain(`| ${String(index + 1)} | \`pages/${String(index + 1).padStart(2, '0')}-${id}.png\` |`);
    });
    expect(checklist).toContain('`VISUAL_DESIGN_ACCEPTED_FOR_CONTENT_REVIEW`');
    expect(checklist).toContain('`CHANGES_REQUIRED`');
    expect(checklist).toContain('Verdict: _pending_');
  });
});
