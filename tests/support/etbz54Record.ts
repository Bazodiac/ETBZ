/**
 * ETBZ-54 — the Golden run record: every identity and outcome of the run, value-free, re-derived from the private
 * archive (`npm run etbz54 -- record` writes it; `-- verify` re-derives it byte for byte; CI cannot, the archive is
 * local - as for the ETBZ-53 freeze record).
 *
 * What it may carry (D-53-1..3, D-53-6, Jira ETBZ-54 comment 17073): public identities (contract, Skill, bundle,
 * renderer and template references and their published hashes), gate outcomes, reason codes with the passage paths or
 * plan elements they cite, and digests of the archived files keyed (HMAC-SHA256) with the archive's key. Never a
 * value of the input file, a chart value, a claim statement, a reading sentence, a plain digest of a case file, or a
 * count that depends on the chart. `assertGoldenRecordPrivate` refuses a record that would.
 *
 * A stage that did not run (the run stops at a BLOCKING code, a refusal after the one repair, a PDF QA failure) is
 * recorded as NOT_RUN; the record never fills a gap.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import { acceptEditorialRevision, acceptSkillReading } from '../../src/application/skill/index.js';
import { INDIVIDUALITY_REASON_CODES } from '../../src/application/skill/individuality-contract.js';
import { ETBZ53_RECORD, GOLDEN_CASE_REF, assertRecordCarriesNoCaseValue, keyed, loadOrCreateKey, parseQuietly } from './etbz53GoldenFreeze.js';
import { ETBZ58_READBACK, readJsonFile } from './etbz58Rehearsal.js';
import type { CaseRun } from './etbz59Cases.js';
import { compareUnderDifference, provisionalityDirection, removalCheck, swapRevalidation } from './etbz59Individuality.js';
import type { Finding } from './etbz59Individuality.js';
import { passagesOf } from './etbz59Judges.js';
import {
  CONES_FILE,
  DRAFTS_FILE,
  ETBZ54_PREREGISTRATION,
  PREREGISTERED_FILES,
  GOLDEN_LABELS,
  GoldenRunError,
  NEAR_DISPLAY_NAME,
  REMOVAL_REFERENCE,
  assertPrettyCopy,
  attemptsDir,
  prettyPackageFile,
  caseFile,
  distantChart,
  loadNearRun,
  readInput,
  workPath,
} from './etbz54Golden.js';
import type { GoldenConfig } from './etbz54Golden.js';
import { loadGoldenRun } from './etbz54Run.js';
import type { GoldenRun } from './etbz54Run.js';

export const RENDER_DIR = 'render';
export const VISUAL_VERDICT_FILE = 'visual-verdict.json';
export const JUDGEMENTS_FILE = 'judgements.json';
export const DRAFT_REVIEW_FILE = 'draft-review.json';
export const PROJECTION_FILE = 'presentation-projection.json';
export const NOT_RUN = 'NOT_RUN' as const;

/** Declared, not measured: who wrote the readings and judged them (as in ETBZ-52/57/58/59/60). */
export const ETBZ54_GENERATION = {
  declared: true,
  runtime: 'one fresh Claude Code subagent instance per case, dispatched by the Delivery Runner under skill/bazodiac-interpretation-skill-v1.1/wrappers/claude.md with the ETBZ-59 run-2 invocation (length addendum) unchanged but for the paths (PO decision D2, Jira ETBZ-2 comment 16690; D-53-7)',
  model: 'claude-opus-5-5 (as each runtime reported it)',
  provider: 'the Claude runtime available to the Delivery Runner; no second provider, no paid call (D-54-1)',
  executedAt: '2026-10-02',
  noHumanEdit: 'no person edited a reading; a repair is made by the instance itself from the refusal (wrapper step 5), at most once per case',
  inputDelivery: 'first dispatch: each instance stopped at wrapper step 2 and wrote nothing - its Read tool cut the one-line package off at about 41k characters; resumed with the pretty-printed copy of the identical value (skill-input.pretty.json, re-canonicalises byte for byte). No reading existed and none was refused, so this is not a reroll',
} as const;

const sha = (bytes: Uint8Array | string): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const repoSha = (path: string, root: string): string => sha(readFileSync(resolve(root, path)));
const codesOf = (findings: readonly Finding[]): string[] => findings.map((finding) => finding.code).sort();
const classOf = (code: string): string => INDIVIDUALITY_REASON_CODES.find((entry) => entry.code === code)?.class ?? 'OUTSIDE_CONTRACT';
const directionSet = (entries: readonly { direction: string }[]): string[] => [...new Set(entries.map((entry) => entry.direction))].sort();

interface JudgementEntry { readonly check: string; readonly subject: string; readonly codes: readonly string[]; readonly cites: readonly string[] }
interface Judgements {
  readonly judges: Readonly<Record<string, { readonly brief: string; readonly report: string; readonly verdict: string }>>;
  readonly judgements: readonly JudgementEntry[];
  readonly outsideContract: readonly JudgementEntry[];
}
interface DraftReview { readonly rounds: readonly { readonly round: number; readonly verdict: string; readonly report: string; readonly findings: readonly { readonly id: string; readonly severity: string; readonly resolution: string }[] }[] }

function refusalOf(draft: unknown, run: CaseRun, semantic?: unknown): { code: string; diagnostics: string[] } | null {
  try {
    const context = { bundle: run.bundle, inputPackage: run.inputPackage };
    if (semantic === undefined) acceptSkillReading(draft, context);
    else acceptEditorialRevision(acceptSkillReading(semantic, context), draft, context);
    return null;
  } catch (error) {
    const typed = error as { code?: string; diagnostics?: readonly { code: string; detail?: { where?: unknown } }[] };
    if (typeof typed.code !== 'string') throw error;
    return { code: typed.code, diagnostics: (typed.diagnostics ?? []).map((entry) => `${entry.code}@${String(entry.detail?.where ?? '')}`) };
  }
}

const filesUnder = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => relative(dir, join(entry.parentPath, entry.name))).sort() : [];

export async function deriveGoldenRecord(config: GoldenConfig, root: string = process.cwd()): Promise<Record<string, unknown>> {
  const raw = readInput(config);
  const key = loadOrCreateKey(config.archiveDir, false);
  const k = (data: string | Uint8Array): string => keyed(key, data);
  const file = (path: string): string => k(readFileSync(path));
  const run: GoldenRun = await loadGoldenRun(config);
  const { runs, charts, drafts, delta } = run;
  const s = runs.source;
  const n = runs.near;
  const r = runs.removal;
  const d: HoroscopeModel = (await distantChart(root)).model;
  const freeze = readJsonFile(ETBZ53_RECORD, root) as { digests: { keyFingerprint: string; files: Record<string, string> } };
  const nearRun = loadNearRun(config);
  const skillManifest = readJsonFile('skill/bazodiac-interpretation-skill-v1.1/MANIFEST.json', root) as { packageStructuralHash: string };
  const json = (path: string): unknown => parseQuietly(readFileSync(path, 'utf8'), 'an archive file');

  const swapNear = swapRevalidation(s, n.model, PLAN_CONTRACT_BINDINGS_V1_1);
  const swapDistant = swapRevalidation(s, d, PLAN_CONTRACT_BINDINGS_V1_1);
  const nearNeighbour = compareUnderDifference('6.1', s, n, delta);
  const mutation = compareUnderDifference('6.3', s, n, delta);
  const removal = removalCheck(s, r, drafts.removal.factIds);

  const cases = Object.fromEntries(GOLDEN_LABELS.map((label) => {
    const caseRun = runs[label];
    const attempts = filesUnder(attemptsDir(config, label));
    const realise = (name: string): unknown => json(join(attemptsDir(config, label), name));
    const accepted = existsSync(caseFile(config, label, 'accepted-reading'));
    return [label, {
      claimGraph: k(caseRun.graph.structuralHash),
      plan: k(caseRun.plan.structuralHash),
      inputPackage: { structuralHash: k(caseRun.inputPackage.structuralHash), file: file(caseFile(config, label, 'skill-input')), prettyCopySameValue: ((): boolean => { assertPrettyCopy(readFileSync(caseFile(config, label, 'skill-input'), 'utf8'), readFileSync(prettyPackageFile(config, label), 'utf8')); return true; })() },
      productionEligible: caseRun.input.productionEligibility.eligible,
      attempts: attempts.map((name) => ({
        attempt: name.replace(/\.json$/u, ''),
        file: file(join(attemptsDir(config, label), name)),
        refusal: name.startsWith('edit-') ? refusalOf(realise(name), caseRun, json(caseFile(config, label, 'semantic-reading'))) : refusalOf(realise(name), caseRun),
      })),
      accepted: accepted ? {
        semantic: file(caseFile(config, label, 'semantic-reading')),
        edit: file(caseFile(config, label, 'skill-reading')),
        reading: file(caseFile(config, label, 'accepted-reading')),
      } : NOT_RUN,
    }];
  }));

  const judgementsPath = workPath(config, JUDGEMENTS_FILE);
  const judgements: Judgements | null = existsSync(judgementsPath) ? (json(judgementsPath) as Judgements) : null;
  const judged = (check: string): string[] | typeof NOT_RUN => (judgements === null ? NOT_RUN : judgements.judgements.filter((entry) => entry.check === check).flatMap((entry) => entry.codes));
  const deterministic = [...codesOf(swapNear.findings), ...codesOf(swapDistant.findings), ...codesOf(nearNeighbour.findings), ...codesOf(mutation.findings), ...codesOf(removal.findings)];
  const raised = [...deterministic, ...(judgements?.judgements.flatMap((entry) => entry.codes) ?? [])];
  const reviewPath = workPath(config, DRAFT_REVIEW_FILE);
  const review: DraftReview | null = existsSync(reviewPath) ? (json(reviewPath) as DraftReview) : null;

  const renderDir = workPath(config, RENDER_DIR);
  const manifestPath = join(renderDir, 'artifact-manifest.json');
  const manifest = existsSync(manifestPath) ? (json(manifestPath) as {
    state: string; mimeType: string; renderer: { ref: string; sourceSha256: string }; template: { ref: string; structuralHash: string };
    qa: { state: string; status: string; checks: readonly { id: string; result: string }[] };
  }) : null;
  const verdictPath = workPath(config, VISUAL_VERDICT_FILE);
  const verdict = existsSync(verdictPath) ? (json(verdictPath) as { verdict: string; defects: readonly { page: string; code: string }[] }) : null;
  const projectionPath = workPath(config, PROJECTION_FILE);

  const record = {
    recordVersion: 'etbz54-golden-run-record.v1',
    runId: 'etbz54-golden-run-GOLDEN-KT-01-2026-10-02',
    caseRef: GOLDEN_CASE_REF,
    authorization: 'Jira ETBZ-54 comment 17073 (D-54-1): run with the frozen GOLDEN-KT-01 per Jira ETBZ-54 and Rebaseline 62128133 v21; stop and present the evidence for the Product Owner decision SELLABLE | NOT_SELLABLE',
    decisions: 'D-53-4, D-53-6, D-53-7, D-53-8 (Jira ETBZ-53 17030/17031, ETBZ-54 17032); D-59-1, D-59-2 (ETBZ-59 17034, ETBZ-54 17035); D-60-1 (ETBZ-60 17050, ETBZ-54 17065)',
    privacy: {
      archive: `${config.archiveDir}/etbz54 (outside every repository; folders 700, files 600)`,
      digests: 'HMAC-SHA256 keyed with the ETBZ-53 archive key; public identities are plain SHA-256',
      keyFingerprint: k('etbz53-golden-freeze-key-fingerprint'),
      sameKeyAsFreezeRecord: k('etbz53-golden-freeze-key-fingerprint') === freeze.digests.keyFingerprint,
    },
    frozenInput: {
      freezeRecordFileSha256: repoSha(ETBZ53_RECORD, root),
      interpretationInputUnchanged: k(charts.source.input.structuralHash) === freeze.digests.files['interpretationInput.structuralHash'],
      archivedInputReDerived: true,
      productionEligible: charts.source.input.productionEligibility.eligible,
    },
    identities: {
      skillRef: s.inputPackage.skillRef,
      skillPackageStructuralHash: skillManifest.packageStructuralHash,
      bundleRef: s.bundle.bundleRef,
      bundleStructuralHash: s.bundle.structuralHash,
      contracts: s.inputPackage.contracts,
      individualityContract: { contractRef: 'cross-reading-individuality-contract@1.1.0', confluencePageId: '77266967', confluencePageVersion: '3' },
    },
    variants: {
      near: {
        definition: `the frozen input with the birth time moved to the neighbouring two-hour block (direction withheld) and the display name "${NEAR_DISPLAY_NAME}"; computed live by FuFirE (D-53-6)`,
        synthetic: true,
        attestation: nearRun.readback.attestation.status,
        probes: { health: nearRun.readback.probes.health.status, ready: nearRun.readback.probes.ready.status, withoutCredentialsRefused: nearRun.readback.probes.unauthorised.refused },
        exchanges: nearRun.readback.exchanges.map(({ label, status }) => ({ label, status, response: k(nearRun.responses[label]) })),
        readback: file(join(workPath(config, 'variants', 'near'), 'runtime-readback.json')),
        repositoryHead: (nearRun.readback).repositoryHead,
        namedDifferenceIsHourPillar: true,
      },
      distant: { case: 'Musterkundin A (D-53-6), chart only', readbackFileSha256: repoSha(ETBZ58_READBACK, root) },
      removal: { withdrawal: 'one Ten-God relation of S: the Ten-God fact and its element relation (fact ids withheld)', reference: REMOVAL_REFERENCE, factIds: k(JSON.stringify(drafts.removal.factIds)) },
    },
    drafting: {
      drafter: 'the Delivery Runner, from the frozen chart facts alone (D-53-4); D-59-2 and D-60-1 applied',
      drafts: file(workPath(config, DRAFTS_FILE)),
      review: review === null ? NOT_RUN : review.rounds.map((round) => ({ round: round.round, verdict: round.verdict, report: file(workPath(config, round.report)), findings: round.findings.map(({ id, severity, resolution }) => ({ id, severity, resolution })) })),
    },
    preRunCones: existsSync(workPath(config, CONES_FILE)) ? { file: file(workPath(config, CONES_FILE)) } : NOT_RUN,
    preRegistration: existsSync(resolve(root, ETBZ54_PREREGISTRATION)) ? {
      fileSha256: repoSha(ETBZ54_PREREGISTRATION, root),
      archiveUnchanged: PREREGISTERED_FILES.every((name) => (readJsonFile(ETBZ54_PREREGISTRATION, root) as { files: Record<string, string> }).files[name] === file(workPath(config, name))),
    } : NOT_RUN,
    cases,
    deterministic: {
      swap: {
        near: { refused: swapNear.refused, refusal: swapNear.refusal, findings: codesOf(swapNear.findings) },
        distant: { refused: swapDistant.refused, refusal: swapDistant.refusal, findings: codesOf(swapDistant.findings) },
      },
      nearNeighbour: { thesisInCone: nearNeighbour.cone.thesis, findings: codesOf(nearNeighbour.findings) },
      mutation: { variant: 'N (D-53-6)', thesisInCone: mutation.cone.thesis, findings: codesOf(mutation.findings) },
      removal: { everyDependentClaimBlockedAndAbsent: removal.dependentClaims.every((claim) => claim.blockedCode !== null && claim.absent), blockedCodes: [...new Set(removal.dependentClaims.map((claim) => claim.blockedCode ?? 'NOT_BLOCKED'))].sort(), findings: codesOf(removal.findings) },
      provisionality: { near: directionSet(provisionalityDirection(s, n)), removal: directionSet(provisionalityDirection(s, r)) },
    },
    judgements: judgements === null ? NOT_RUN : {
      file: file(judgementsPath),
      judges: Object.fromEntries(Object.entries(judgements.judges).map(([name, judge]) => [name, { brief: k(judge.brief), report: k(judge.report), verdict: judge.verdict }])),
      entries: judgements.judgements.map(({ check, subject, codes, cites }) => ({ check, subject, codes: [...codes], cites: [...cites] })),
      outsideContract: judgements.outsideContract.map(({ check, subject, codes, cites }) => ({ check, subject, codes: [...codes], cites: [...cites] })),
      judgeFiles: Object.fromEntries(filesUnder(workPath(config, 'judges')).map((name) => [name, file(workPath(config, 'judges', name))])),
    },
    goldenRunMinimum: {
      '8.1': { checks: ['6.1'], deterministic: codesOf(nearNeighbour.findings), judged: judged('6.1') },
      '8.2': { checks: ['6.3', '6.4'], deterministic: [...codesOf(mutation.findings), ...codesOf(removal.findings)], judged: judged('6.4') },
      '8.3': { checks: ['6.5'], judged: judged('6.5') },
      '8.4': { checks: ['6.2'], deterministic: [...codesOf(swapNear.findings), ...codesOf(swapDistant.findings)] },
      '8.5': { checks: ['6.7'], judged: judged('6.7') },
      '8.6': { raised: [...new Set(raised)].sort().map((code) => ({ code, class: classOf(code), count: raised.filter((entry) => entry === code).length })), outsideContract: judgements?.outsideContract.flatMap((entry) => entry.codes) ?? NOT_RUN },
    },
    presentation: existsSync(projectionPath) ? { projection: file(projectionPath), sourceReading: 'the accepted EDIT revision of R(S)' } : NOT_RUN,
    artifact: manifest === null ? NOT_RUN : {
      state: manifest.state,
      mimeType: manifest.mimeType,
      qa: { state: manifest.qa.state, status: manifest.qa.status, checks: manifest.qa.checks.map(({ id, result }) => ({ id, result })) },
      renderer: { ref: manifest.renderer.ref, sourceSha256: manifest.renderer.sourceSha256 },
      template: { ref: manifest.template.ref, structuralHash: manifest.template.structuralHash },
      files: Object.fromEntries(filesUnder(renderDir).map((name) => [name, file(join(renderDir, name))])),
    },
    visualVerdict: verdict === null ? NOT_RUN : { verdict: verdict.verdict, defects: verdict.defects.map(({ page, code }) => ({ page, code })), file: file(verdictPath) },
    generation: ETBZ54_GENERATION,
    humanVerdict: 'PENDING: the Product Owner decides SELLABLE | NOT_SELLABLE; the Delivery Runner never assigns SELLABLE (D-54-1)',
  };
  const readings = GOLDEN_LABELS.filter((label) => existsSync(caseFile(config, label, 'accepted-reading'))).map((label) => parseQuietly(readFileSync(caseFile(config, label, 'accepted-reading'), 'utf8'), 'a reading'));
  assertGoldenRecordPrivate(record, raw, [charts.source.model, charts.near.model], run, readings, root);
  return record;
}

const PUBLIC_DIGEST_FILES = [ETBZ53_RECORD, ETBZ58_READBACK] as const;
/** The renderer and template identities the committed ETBZ-58 manifest publishes: the Golden render must use the same. */
const PUBLIC_MANIFEST = 'docs/evidence/etbz-58/artifact-manifest.json';

/**
 * Refuses a record that carries case data: a value of the input file (named by field and path, never by value), a
 * plain SHA-256 that is not a public identity, a chart value as a whole word, a claim statement, or a sentence of a
 * reading.
 */
export function assertGoldenRecordPrivate(record: unknown, raw: unknown, models: readonly HoroscopeModel[], run: Pick<GoldenRun, 'runs' | 'drafts'>, readings: readonly unknown[], root: string = process.cwd()): void {
  assertRecordCarriesNoCaseValue(record, raw);
  const text = JSON.stringify(record);
  const s = run.runs.source;
  const publicDigests = new Set<string>([
    ...PUBLIC_DIGEST_FILES.map((path) => repoSha(path, root)),
    s.bundle.structuralHash,
    (readJsonFile('skill/bazodiac-interpretation-skill-v1.1/MANIFEST.json', root) as { packageStructuralHash: string }).packageStructuralHash,
    ...s.inputPackage.contracts.flatMap((contract) => Object.values(contract).filter((value): value is string => typeof value === 'string' && value.startsWith('sha256:'))),
    ...((): string[] => {
      const published = readJsonFile(PUBLIC_MANIFEST, root) as { renderer: { sourceSha256: string }; template: { structuralHash: string } };
      return [published.renderer.sourceSha256, published.template.structuralHash];
    })(),
  ]);
  const plain = [...text.matchAll(/(?<!hmac-)sha256:[0-9a-f]{64}/gu)].map((match) => match[0]).filter((digest) => !publicDigests.has(digest));
  const leaks: string[] = plain.map(() => 'a plain SHA-256 that is not a public identity');
  const generic = new Set(['true', 'false', 'yang', 'yin', 'principal', 'central', 'residual']);
  const values = new Set(models.flatMap((model) => deriveInterpretationFeatureSet(model).facts.map((fact) => String(fact.value))).filter((value) => value.length >= 3 && !generic.has(value.toLowerCase())));
  for (const value of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text)) leaks.push('a chart value');
  }
  for (const label of GOLDEN_LABELS) for (const claim of run.drafts.cases[label].claims) if (text.includes(claim.statement.slice(0, 40))) leaks.push('a claim statement');
  for (const reading of readings) {
    for (const passage of passagesOf(reading as Parameters<typeof passagesOf>[0])) {
      for (const sentence of passage.text.split(/(?<=[.!?])\s+/u).filter((part) => part.length >= 30)) if (text.includes(sentence)) leaks.push('a reading sentence');
    }
  }
  if (leaks.length > 0) throw new GoldenRunError('GOLDEN_RECORD_LEAKS_CASE_DATA', `the record would carry case data: ${[...new Set(leaks)].join('; ')} (${String(leaks.length)} hit(s); content not shown)`);
}

