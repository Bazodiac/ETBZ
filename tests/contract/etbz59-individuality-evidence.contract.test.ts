/**
 * ETBZ-59 — the committed evidence of the Anti-Boilerplate fixture rehearsal (contract 77266967 v3, section 8).
 *
 * The variants were computed live by FuFirE through the ETBZ-58 live stage (`npm run etbz59:variants`); the suite
 * replays the recorded bytes offline and checks what the run claims: the attested runtime of ETBZ-58, readiness, the
 * call without credentials refused, and that each variant differs from Musterkundin A exactly as defined. The run
 * record, the judges' packets and the judgements are re-derived from the committed files, and every quote a judgement
 * rests on is checked verbatim against the accepted reading at its path.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import type { HoroscopeModel, PillarName } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { INDIVIDUALITY_REASON_CODES } from '../../src/application/skill/index.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import { loadRecordedRun } from '../support/etbz58Rehearsal.js';
import { caseFile, deriveCase } from '../support/etbz59Cases.js';
import type { CaseLabel } from '../support/etbz59Cases.js';
import { ETBZ59_JUDGES_DIR, deriveJudgePackets } from '../support/etbz59Judges.js';
import { ETBZ59_JUDGEMENTS, ETBZ59_RECORD } from '../support/etbz59Record.js';
import { VARIANT_BIRTH_INPUTS, VARIANT_DEFINITIONS, VARIANT_LABELS, loadVariantRun, sourceChart, variantChart, variantReadbackFile } from '../support/etbz59Variants.js';

const read = (path: string): Buffer => readFileSync(resolve(process.cwd(), path));
const sha256Of = (bytes: Uint8Array | string): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const PILLARS: readonly PillarName[] = ['year', 'month', 'day', 'hour'];
const pillarOf = (model: HoroscopeModel, name: PillarName): string => `${model.pillars[name].stem}-${model.pillars[name].branch}`;

describe('ETBZ-59: the synthetic variants, computed by the attested runtime', () => {
  const { readback: source } = loadRecordedRun();

  it.each(VARIANT_LABELS)('%s: attested as in ETBZ-58, ready, credentials enforced, the case it names', (label) => {
    const { readback } = loadVariantRun(label);
    expect(readback.attestation.status).toBe('PASS');
    expect(readback.attestation.expectation).toEqual(source.attestation.expectation);
    expect(readback.runtime).toEqual(source.runtime);
    expect([readback.probes.health.status, readback.probes.ready.status]).toEqual([200, 200]);
    expect(readback.probes.unauthorised.refused).toBe(true);
    expect(readback.exchanges.map((exchange) => [exchange.label, exchange.status])).toEqual([['bazi', 200], ['wuxing', 200], ['natal', 200]]);
    expect(readback.birthInput).toEqual({ ref: VARIANT_DEFINITIONS[label].ref, canonicalSha256: sha256Of(canonicalJson(VARIANT_BIRTH_INPUTS[label])) });
    expect(() => execFileSync('git', ['merge-base', '--is-ancestor', readback.repositoryHead, 'HEAD'])).not.toThrow();
  });

  it('N differs from Musterkundin A in the hour pillar and nothing else of the pillars', async () => {
    const [s, n] = [await sourceChart(), await variantChart('near')];
    expect(PILLARS.filter((name) => pillarOf(s.model, name) !== pillarOf(n.model, name))).toEqual(['hour']);
    expect(n.input.productionEligibility.eligible).toBe(true);
    expect(n.model.displayName).toBe('Variante N (synthetisch)');
  });

  it('D shares no stem and no branch with Musterkundin A but the hour branch (same clock time)', async () => {
    const [s, d] = [await sourceChart(), await variantChart('distant')];
    const shared = PILLARS.flatMap((name) => [
      ...(s.model.pillars[name].stem === d.model.pillars[name].stem ? [`${name}.stem`] : []),
      ...(s.model.pillars[name].branch === d.model.pillars[name].branch ? [`${name}.branch`] : []),
    ]);
    expect(shared).toEqual(['hour.branch']);
    expect(d.model.dayMaster.stem).not.toBe(s.model.dayMaster.stem);
    expect(d.input.productionEligibility.eligible).toBe(true);
    expect(d.model.displayName).toBe('Variante D (synthetisch)');
  });
});

describe('ETBZ-59: the secret-scanner exemptions (.gitleaksignore bar C)', () => {
  // Exempted from gitleaks' generic-api-key rule by a whole-line fingerprint (one-line JSON). Safe only while these
  // bytes are exactly these, and the only credential-shaped pair is the public OpenAPI digest the attestation pinned.
  const PINNED: Readonly<Record<string, string>> = {
    [variantReadbackFile('near')]: 'sha256:092a6e41f9d35399e18edf966b0be4e3abd616e669c87984dc0794895a56a1af',
    [variantReadbackFile('distant')]: 'sha256:5c56659fa14a5036203d199ce4b0948361ad31c98f6056ad1577cec1da4c917a',
  };

  it('pins the exempted files byte for byte and names them in .gitleaksignore', () => {
    const ignore = read('.gitleaksignore').toString('utf8').split('\n');
    for (const [path, digest] of Object.entries(PINNED)) {
      expect(sha256Of(read(path)), path).toBe(digest);
      expect(ignore, path).toContain(`${path}:generic-api-key:1`);
    }
  });

  it('holds no credential-shaped pair in them but the attested OpenAPI digest', () => {
    const attested = loadRecordedRun().readback.attestation.expectation.openapiSha256;
    expect(attested).toMatch(/^[0-9a-f]{64}$/u);
    for (const path of Object.keys(PINNED)) {
      const text = read(path).toString('utf8');
      const pairs = [...text.matchAll(/"([^"]*(?:api|key|token|secret|passw|auth|credential)[^"]*)":"([^"]{10,})"/giu)].map((match) => [match[1], match[2]]);
      expect(pairs.length, path).toBeGreaterThan(0);
      for (const [key, value] of pairs) expect([key, value], path).toEqual(['openapiSha256', attested]);
    }
  });
});

interface Quote { readonly case: CaseLabel; readonly path: string; readonly text: string }
interface Judgement { readonly check?: string; readonly subject: string; readonly verdict: string; readonly codes: readonly string[]; readonly quotes: readonly Quote[]; readonly smallestRepair?: { readonly fixture: string; readonly skill: string; readonly applied: boolean } }
interface Judgements { readonly judges: readonly { judge: string; packet: readonly string[]; toolCalls: string }[]; readonly judgements: readonly Judgement[]; readonly outsideContract: readonly Judgement[] }

describe('ETBZ-59: the run record, the judges\' packets and the judgements', () => {
  const judgements = JSON.parse(read(ETBZ59_JUDGEMENTS).toString('utf8')) as Judgements;
  const paragraph = (quote: Quote): string => {
    const match = /^chapters\[(\d+)\]\.paragraphs\[(\d+)\]$/u.exec(quote.path);
    if (match === null) throw new Error(`not a paragraph path: ${quote.path}`);
    const reading = JSON.parse(read(caseFile(quote.case, 'accepted-reading')).toString('utf8')) as { chapters: { paragraphs: { text: string }[] }[] };
    return reading.chapters[Number(match[1])]?.paragraphs[Number(match[2])]?.text ?? '';
  };

  // ETBZ-60 (D-59-6) added READING_POSITION_UNGROUNDED to the boundary, which refuses the three ETBZ-59 readings at
  // their position statements (tests/negative/etbz60-position-statements.negative.test.ts). The record was made under
  // the boundary of e5ccc94c and stays as merged there: pinned byte for byte, every file it names checked against the
  // committed bytes, and every accepted hash recomputed from the reading itself - nothing here re-runs the boundary.
  it('keeps the run record as merged at e5ccc94c, byte for byte', () => {
    expect(sha256Of(read(ETBZ59_RECORD))).toBe('sha256:f5a3e2e46bc5286da5e5c06fa548e9cc5046a0bc4fe2c888a37730ee5a8ac672');
  });

  it('finds every file the run record names at the hash it records, and every accepted hash in the reading itself', () => {
    type Attempt = { file: string; sha256: string };
    type CaseEntry = { skillInput: { fileSha256: string }; runs: { attempts: Attempt[] }[]; accepted: { semanticFileSha256: string; semanticStructuralHash: string; editFileSha256: string; acceptedStructuralHash: string; acceptedFileSha256: string } };
    const record = JSON.parse(read(ETBZ59_RECORD).toString('utf8')) as { cases: Record<CaseLabel, CaseEntry>; variants: Record<string, { readbackFileSha256: string }>; preRunCones: Attempt; judgements: { file: { path: string; sha256: string }; judgeFiles: Record<string, string> } };
    const named: [string, string][] = [
      ...Object.entries(record.variants).map(([label, entry]): [string, string] => [variantReadbackFile(label as (typeof VARIANT_LABELS)[number]), entry.readbackFileSha256]),
      [record.preRunCones.file, record.preRunCones.sha256],
      [record.judgements.file.path, record.judgements.file.sha256],
      ...Object.entries(record.judgements.judgeFiles).map(([file, digest]): [string, string] => [`${ETBZ59_JUDGES_DIR}/${file}`, digest]),
    ];
    for (const [label, entry] of Object.entries(record.cases) as [CaseLabel, CaseEntry][]) {
      named.push([caseFile(label, 'skill-input'), entry.skillInput.fileSha256], [caseFile(label, 'semantic-reading'), entry.accepted.semanticFileSha256], [caseFile(label, 'skill-reading'), entry.accepted.editFileSha256], [caseFile(label, 'accepted-reading'), entry.accepted.acceptedFileSha256]);
      for (const attempt of entry.runs.flatMap((run) => run.attempts)) named.push([attempt.file, attempt.sha256]);
      const hashOf = (file: string): string => structuralHash(JSON.parse(read(file).toString('utf8')) as unknown);
      expect(hashOf(caseFile(label, 'semantic-reading')), label).toBe(entry.accepted.semanticStructuralHash);
      expect(hashOf(caseFile(label, 'skill-reading')), label).toBe(entry.accepted.acceptedStructuralHash);
    }
    expect(named.length).toBeGreaterThan(40);
    for (const [file, digest] of named) expect(sha256Of(read(file)), file).toBe(digest);
  });

  it('re-derives every file each judge read, byte for byte, from the accepted readings and the validated charts', async () => {
    const packets = await deriveJudgePackets();
    expect(Object.keys(packets)).toHaveLength(15);
    for (const [path, content] of Object.entries(packets)) expect(read(`${ETBZ59_JUDGES_DIR}/${path}`).toString('utf8'), path).toBe(content);
  }, 60_000);

  it('shows each judge reading its own packet and nothing else, with the Read tool only', () => {
    for (const judge of judgements.judges) {
      const calls = read(`docs/evidence/etbz-59/${judge.toolCalls}`).toString('utf8').trim().split('\n');
      expect(calls.map((call) => call.split(' ')[0]), judge.judge).toEqual(judge.packet.map(() => 'Read'));
      expect(calls.map((call) => `judges/${call.split('/judges/')[1] ?? ''}`).sort(), judge.judge).toEqual([...judge.packet].sort());
    }
  });

  it('finds every quote of every judgement verbatim at its path in the accepted reading', () => {
    const quotes = [...judgements.judgements, ...judgements.outsideContract].flatMap((entry) => entry.quotes);
    expect(quotes.length).toBeGreaterThan(30);
    for (const quote of quotes) expect(paragraph(quote), `${quote.case} ${quote.path}`).toContain(quote.text);
  });

  it('uses only reason codes of the judged check, and records the BLOCKING code with its smallest repair, not applied', () => {
    for (const entry of judgements.judgements) {
      for (const code of entry.codes) expect(INDIVIDUALITY_REASON_CODES.find((known) => known.code === code)?.checks, `${entry.check ?? ''} ${code}`).toContain(entry.check);
      expect(entry.verdict === 'PASS', entry.subject).toBe(entry.codes.length === 0);
    }
    const blocking = judgements.judgements.filter((entry) => entry.codes.some((code) => INDIVIDUALITY_REASON_CODES.find((known) => known.code === code)?.class === 'BLOCKING'));
    expect(blocking.map((entry) => entry.codes)).toEqual([['STOCK_PARAGRAPH_REUSE']]);
    expect(blocking[0]?.smallestRepair?.applied).toBe(false);
  });

  it('holds the facts the BLOCKING verdict rests on: N shows a controlling stem on its hour surface, S none, and no claim of either cites it', async () => {
    const visible = async (label: CaseLabel): Promise<string[]> => {
      const facts = deriveInterpretationFeatureSet((await deriveCase(label)).model).facts;
      const value = (id: string): string => String(facts.find((fact) => fact.id === id)?.value ?? '-');
      return (['year', 'month', 'day', 'hour'] as const).filter((pillar) => value(`chart.natal.pillar.${pillar}.tenGod.elementRelation`) === 'controls_day_master').map((pillar) => `${pillar}:${value(`chart.natal.pillar.${pillar}.tenGod`)}`);
    };
    expect(await visible('near')).toEqual(['hour:DirectOfficer']);
    expect(await visible('source')).toEqual([]);
    for (const label of ['source', 'near'] as const) {
      const cited = (await deriveCase(label)).graph.claims.flatMap((claim) => claim.factRefs).filter((id) => /^chart\.natal\.pillar\.[a-z]+\.tenGod$/u.test(id));
      expect([...new Set(cited)], label).toEqual(['chart.natal.pillar.month.tenGod']);
    }
  }, 60_000);
});
