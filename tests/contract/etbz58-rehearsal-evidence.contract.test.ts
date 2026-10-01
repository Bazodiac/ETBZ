/**
 * ETBZ-58 — the committed evidence of the Pre-Golden rehearsal is what the chain produces.
 *
 * What CI can check without the network or the browser: the live stage's recorded response bodies (as the client
 * read them, after HTTP content decoding) against the digests of their readback; the Skill input package from those bytes (replayed through the real client and use case); the
 * runtime's readings accepted again - the refused first REALISE attempt refused, its one repair accepted, the
 * EDIT revision accepted - and the accepted reading and the projection byte for byte; the ArtifactManifest
 * against the committed PDF, drawn by the renderer sources whose canary record is ETBZ-55's; the QA report, the
 * committed page renders and the visual verdict; and the run record. Not re-derivable here: the live answers
 * themselves (the readback records them, the attestation pins the runtime), which model wrote the readings (a
 * declaration), the renders of the pages not committed.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { evaluateRuntimeAttestation } from '../../src/application/attestation/runtime-attestation.js';
import { RELEASED_TEMPLATE_HASHES } from '../../src/application/presentation/index.js';
import { RELEASED_BUNDLE_HASHES, SkillRunError, acceptSkillReading } from '../../src/application/skill/index.js';
import {
  ETBZ57_ACCEPTED_READING_HASH,
  ETBZ58_ACCEPTED_READING,
  ETBZ58_PROJECTION,
  ETBZ58_RECORD,
  ETBZ58_REFUSED_REALISE,
  ETBZ58_SEMANTIC_READING,
  ETBZ58_SKILL_INPUT,
  ETBZ58_SKILL_READING,
  EXCHANGE_LABELS,
  assembleRehearsal,
  deriveRehearsalInput,
  deriveRehearsalRecord,
  loadRecordedRun,
  readJsonFile,
  renderJson,
  responseFileOf,
} from '../support/etbz58Rehearsal.js';
import { KNOWN_BIRTH } from '../support/narrativeFixture.js';

vi.setConfig({ testTimeout: 60_000 });

const ROOT = process.cwd();
const EVIDENCE = resolve(ROOT, 'docs/evidence/etbz-58');
const ETBZ55 = resolve(ROOT, 'docs/evidence/etbz-55');
const RENDERER = resolve(ROOT, 'tools/pdf-renderer');
const sha256Of = (buffer: Buffer | string): string => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const read = (path: string): Buffer => readFileSync(resolve(ROOT, path));
const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const isAncestor = (rev: string): boolean => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', rev, 'HEAD']);
    return true;
  } catch {
    return false;
  }
};

interface Manifest {
  artifactId: string;
  state: string;
  mimeType: string;
  sha256: string;
  byteLength: number;
  pageCount: number;
  contactSheetSha256: string;
  input: Record<string, unknown> & { skill?: Record<string, unknown> };
  presentation: { projectionVersion: string; structuralHash: string; fileSha256: string };
  template: Record<string, unknown>;
  renderer: { ref: string; sourceSha256: string };
  fonts: unknown[];
  qa: { status: string; state: string; checks: { id: string; result: string; detail?: Record<string, unknown> }[] };
  generation: { declared: boolean; executedAt: string; repositoryHead: string };
}

const manifest = json<Manifest>(resolve(EVIDENCE, 'artifact-manifest.json'));
const manifest55 = json<Manifest>(resolve(ETBZ55, 'artifact-manifest.json'));
const report = json<{ status: string; projectionStructuralHash: string; pages: { pageId: string; pageLabel: string; findings: unknown[]; pngSha256: string }[] }>(
  resolve(EVIDENCE, 'qa-report.json'),
);

async function chain() {
  const { readback, responses } = loadRecordedRun();
  const rehearsal = await deriveRehearsalInput(readback, responses);
  const assembled = assembleRehearsal(rehearsal, readJsonFile(ETBZ58_SEMANTIC_READING), readJsonFile(ETBZ58_SKILL_READING));
  return { readback, rehearsal, ...assembled };
}

describe('ETBZ-58: the evidence folder', () => {
  it('holds exactly the declared files', () => {
    expect(readdirSync(EVIDENCE).sort()).toEqual([
      'README.md',
      'artifact-manifest.json',
      'bazodiac-reading.pdf',
      'contact-sheet.png',
      'pages',
      'presentation-projection.json',
      'qa-report.json',
      'rehearsal-record.json',
      'run',
      'visual-verdict.json',
    ]);
    expect(readdirSync(resolve(EVIDENCE, 'run')).sort()).toEqual([
      'accepted-reading.json',
      'fufire',
      'realise-attempt-1.refused.json',
      'runtime-readback.json',
      'semantic-reading.json',
      'skill-input.json',
      'skill-reading.json',
    ]);
    expect(readdirSync(resolve(EVIDENCE, 'run', 'fufire')).sort()).toEqual(['bazi.response.json', 'natal.response.json', 'wuxing.response.json']);
  });
});

describe('ETBZ-58: the live stage, as recorded (AC 1, AC 5)', () => {
  it('records an attested runtime, ready, refusing calls without credentials, on a head of this history', () => {
    const { readback } = loadRecordedRun();
    const verdict = readback.attestation;
    expect(verdict.status).toBe('PASS');
    const { expectation, observation } = verdict;
    expect(evaluateRuntimeAttestation({ openapiSha256: expectation.openapiSha256 ?? undefined, sourceRevision: expectation.sourceRevision ?? undefined }, observation).status).toBe('PASS');
    expect(readback.runtime.openapiSha256).toBe(expectation.openapiSha256);
    expect(readback.runtime.runtimeImage).toBe(`fufire-api-lunar@${String(expectation.sourceRevision)}`);
    expect(readback.probes.health.status).toBe(200);
    expect(readback.probes.ready.status).toBe(200);
    expect(readback.probes.unauthorised).toMatchObject({ status: 401, refused: true });
    expect(isAncestor(readback.repositoryHead)).toBe(true);
    expect(readback.birthInput.ref).toBe('tests/support/narrativeFixture.ts#KNOWN_BIRTH');
    expect(readback.birthInput.canonicalSha256).toBe(sha256Of(canonicalJson(KNOWN_BIRTH)));
  });

  it('commits every response body, as the client read it, with the digest the readback recorded', () => {
    const { readback } = loadRecordedRun();
    expect(readback.exchanges.map((exchange) => exchange.label)).toEqual([...EXCHANGE_LABELS]);
    for (const exchange of readback.exchanges) {
      const bytes = read(responseFileOf(exchange.label));
      expect(exchange.status, exchange.label).toBe(200);
      expect(exchange.responseFile).toBe(responseFileOf(exchange.label));
      expect(sha256Of(bytes), exchange.label).toBe(exchange.responseSha256);
      expect(bytes.length, exchange.label).toBe(exchange.byteLength);
    }
  });

  it('re-derives the Skill input package from the recorded bytes, production-eligible, under the released bundle', async () => {
    const { rehearsal } = await chain();
    expect(read(ETBZ58_SKILL_INPUT).toString('utf8')).toBe(renderJson(rehearsal.inputPackage));
    expect(rehearsal.input.productionEligibility).toEqual({ eligible: true, blockers: [] });
    expect(rehearsal.bundle.structuralHash).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
  });
});

describe('ETBZ-58: the runtime readings, accepted by the boundary (AC 1, AC 2)', () => {
  it('refuses the first REALISE attempt, and its one repair changes exactly that word', async () => {
    const { rehearsal } = await chain();
    const refused = readJsonFile(ETBZ58_REFUSED_REALISE);
    let code = 'ACCEPTED';
    try {
      acceptSkillReading(refused, { bundle: rehearsal.bundle, inputPackage: rehearsal.inputPackage });
    } catch (error) {
      if (!(error instanceof SkillRunError)) throw error;
      code = error.code;
    }
    expect(code).toBe('READING_UNSUPPORTED_METHOD_LANGUAGE');
    const leaves = (value: unknown, path = ''): [string, unknown][] =>
      value !== null && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => leaves(child, `${path}.${key}`)) : [[path, value]];
    const before = new Map(leaves(refused));
    const after = new Map(leaves(readJsonFile(ETBZ58_SEMANTIC_READING)));
    // Both directions: a leaf added, removed or changed by the repair counts.
    const paths = [...new Set([...before.keys(), ...after.keys()])].filter((path) => !after.has(path) || !before.has(path) || before.get(path) !== after.get(path));
    expect(paths).toEqual(['.chapters.2.paragraphs.3.text']);
    const changed = [...after].filter(([path]) => paths.includes(path));
    const [[, repaired]] = changed as [[string, string]];
    expect(String(before.get('.chapters.2.paragraphs.3.text')).replace('noch ehe ein', 'noch bevor ein')).toBe(repaired);
  });

  it('accepts REALISE and EDIT and regenerates the accepted reading and the projection byte for byte', async () => {
    const { accepted, projection } = await chain();
    expect(read(ETBZ58_ACCEPTED_READING).toString('utf8')).toBe(renderJson(accepted));
    expect(read(ETBZ58_PROJECTION).toString('utf8')).toBe(renderJson(projection));
  });

  it('is a new reading of this run, not the ETBZ-57 reading', async () => {
    const { accepted } = await chain();
    expect(accepted.structuralHash).not.toBe(ETBZ57_ACCEPTED_READING_HASH);
    expect(json<{ structuralHash: string }>(resolve(ROOT, 'docs/evidence/etbz-57/fixture/accepted-reading.json')).structuralHash).toBe(ETBZ57_ACCEPTED_READING_HASH);
  });
});

describe('ETBZ-58: the ArtifactManifest, the renderer and the visual evidence (AC 3, AC 4, AC 5)', () => {
  it('is ARTIFACT_READY with QA_PASSED, every check PASS, bound to the committed PDF', async () => {
    const { projection } = await chain();
    expect(manifest.state).toBe('ARTIFACT_READY');
    expect(manifest.qa).toMatchObject({ status: 'PASSED', state: 'QA_PASSED' });
    expect(manifest.qa.checks.map((check) => check.id)).toEqual(manifest55.qa.checks.map((check) => check.id));
    for (const check of manifest.qa.checks) expect(check.result, check.id).toBe('PASS');
    const pdf = read('docs/evidence/etbz-58/bazodiac-reading.pdf');
    expect(manifest.mimeType).toBe('application/pdf');
    expect(pdf.toString('latin1').startsWith('%PDF-')).toBe(true);
    expect(manifest.sha256).toBe(sha256Of(pdf));
    expect(manifest.byteLength).toBe(pdf.length);
    expect(manifest.artifactId).toBe(`bazodiac-reading-${manifest.sha256.slice(7, 23)}`);
    expect(manifest.pageCount).toBe(projection.pageCount);
    expect(manifest.contactSheetSha256).toBe(sha256Of(read('docs/evidence/etbz-58/contact-sheet.png')));
    const identity = manifest.qa.checks.find((check) => check.id === 'PROJECTION_IDENTITY')?.detail;
    expect(identity).toEqual({ projection: projection.structuralHash, template: RELEASED_TEMPLATE_HASHES['1.0.0'] });
  });

  it('records the projection sources and this run’s Skill identities', async () => {
    const { projection, accepted } = await chain();
    expect(manifest.input).toEqual(projection.sources);
    expect(manifest.presentation).toEqual({ projectionVersion: projection.projectionVersion, structuralHash: projection.structuralHash, fileSha256: sha256Of(read(ETBZ58_PROJECTION)) });
    expect(manifest.input.skill?.['readingStructuralHash']).toBe(accepted.structuralHash);
    expect(manifest.input.skill?.['bundleStructuralHash']).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
    expect(manifest.generation.declared).toBe(true);
    expect(isAncestor(manifest.generation.repositoryHead)).toBe(true);
  });

  it('is drawn by the same renderer sources and template as ETBZ-55 and ETBZ-56, whose canary record covers them', () => {
    const hash = createHash('sha256');
    for (const name of readdirSync(RENDERER).sort()) {
      if (!name.endsWith('.py') && !name.endsWith('.css')) continue;
      hash.update(Buffer.concat([Buffer.from(name), Buffer.from([0]), readFileSync(join(RENDERER, name)), Buffer.from([0])]));
    }
    expect(manifest.renderer.sourceSha256).toBe(`sha256:${hash.digest('hex')}`);
    expect(manifest.renderer).toEqual(manifest55.renderer);
    expect(manifest.template).toEqual(manifest55.template);
    expect(manifest.fonts).toEqual(manifest55.fonts);
    const record = json<{ renderer: { ref: string; sourceSha256: string }; summary: { canaries: number; blockedAsExpected: number; controls: number; passedAsExpected: number } }>(
      resolve(ETBZ55, 'renderer-canaries.json'),
    );
    expect(record.renderer).toEqual({ ref: manifest.renderer.ref, sourceSha256: manifest.renderer.sourceSha256 });
    expect(record.summary.blockedAsExpected).toBe(record.summary.canaries);
    expect(record.summary.passedAsExpected).toBe(record.summary.controls);
  });

  it('reports every page clean and commits the representative renders the QA report hashed', async () => {
    const { projection } = await chain();
    expect(report.status).toBe('PASSED');
    expect(report.projectionStructuralHash).toBe(projection.structuralHash);
    expect(report.pages.map((page) => page.pageId)).toEqual(projection.pages.map((page) => page.pageId));
    for (const page of report.pages) expect(page.findings, page.pageId).toEqual([]);
    const files = readdirSync(resolve(EVIDENCE, 'pages')).sort();
    for (const file of files) {
      const page = report.pages.find((entry) => entry.pageLabel === file.slice(0, 2));
      expect(file).toBe(`${page?.pageLabel ?? ''}-${page?.pageId ?? ''}.png`);
      expect(sha256Of(readFileSync(resolve(EVIDENCE, 'pages', file))), file).toBe(page?.pngSha256);
    }
    // Jira ETBZ-58 step 4 and Rebaseline section 18 name these.
    for (const required of ['cover', 'four-pillars', 'wu-xing-distribution', 'hidden-stems', 'ten-gods', 'chapter-01-p1', 'chapter-01-p2', 'reflection', 'summary', 'method-note']) {
      expect(files.map((file) => file.slice(3, -4)), required).toContain(required);
    }
  });

  it('binds the visual verdict to this artifact and these renders (AC 4)', () => {
    const verdict = json<{ verdict: string; artifact: unknown; checks: { check: string; result: string }[]; defects: unknown[]; pages: { file: string; pngSha256: string }[] }>(
      resolve(EVIDENCE, 'visual-verdict.json'),
    );
    expect(verdict.verdict).toBe('VISUALLY_FIT_FOR_GOLDEN');
    expect(verdict.defects).toEqual([]);
    for (const check of verdict.checks) expect(check.result, check.check).toBe('PASS');
    expect(verdict.artifact).toEqual({ artifactId: manifest.artifactId, pdfSha256: manifest.sha256, contactSheetSha256: manifest.contactSheetSha256, pageCount: manifest.pageCount });
    expect(verdict.pages.map((page) => page.file)).toEqual(readdirSync(resolve(EVIDENCE, 'pages')).sort().map((file) => `pages/${file}`));
    for (const page of verdict.pages) expect(page.pngSha256, page.file).toBe(sha256Of(readFileSync(resolve(EVIDENCE, page.file))));
  });
});

describe('ETBZ-58: the run record', () => {
  it('is re-derived byte for byte from the committed run', async () => {
    expect(read(ETBZ58_RECORD).toString('utf8')).toBe(renderJson(await deriveRehearsalRecord()));
  });
});
