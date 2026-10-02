/**
 * ETBZ-59 — the run record of the Anti-Boilerplate fixture rehearsal: every identity of the run and the outcome of
 * each section-8 item, re-derived from the committed files (`npm run etbz59 -- record` writes it; the contract suite
 * re-derives it byte for byte). The deterministic checks are re-run here; the qualitative judgements are read from
 * `judgements.json`, which records the independent instances' verdicts with the packets they judged.
 *
 * Bound to the boundary of e5ccc94c, where ETBZ-59 merged: ETBZ-60's READING_POSITION_UNGROUNDED refuses the three
 * ETBZ-59 readings, so `record` reproduces the committed file only at that commit. The contract suite pins the file
 * and checks every file it names instead of re-deriving it.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import { acceptEditorialRevision, acceptSkillReading } from '../../src/application/skill/index.js';
import type { AcceptedSkillReading } from '../../src/application/skill/index.js';
import { CASE_LABELS, ETBZ59_CONES, REMOVED_FACT_IDS, RESCUE_POSITION_TERMS, REVIEWED_PINS, caseFile, deriveCase } from './etbz59Cases.js';
import type { CaseLabel, CaseRun } from './etbz59Cases.js';
import { INDIVIDUALITY_REASON_CODES } from '../../src/application/skill/individuality-contract.js';
import { compareUnderDifference, namedDifference, provisionalityDirection, removalCheck, swapRevalidation, termCandidates } from './etbz59Individuality.js';
import type { Finding } from './etbz59Individuality.js';
import { ETBZ59_JUDGES_DIR, passagesOf } from './etbz59Judges.js';
import { ETBZ59_DIR, VARIANT_DEFINITIONS, VARIANT_LABELS, loadVariantRun, variantChart, variantReadbackFile } from './etbz59Variants.js';

export const ETBZ59_RECORD = `${ETBZ59_DIR}/individuality-record.json`;
export const ETBZ59_JUDGEMENTS = `${ETBZ59_DIR}/judgements.json`;

interface JudgementEntry { readonly check?: string; readonly subject: string; readonly codes: readonly string[] }
interface Judgements { readonly judgements: readonly JudgementEntry[]; readonly outsideContract: readonly JudgementEntry[] }

/** Declared, not measured: who wrote the readings and how they were invoked (as in ETBZ-52/57/58). */
export const ETBZ59_GENERATION = {
  declared: true,
  runtime: 'one fresh Claude Code subagent instance per case and run, dispatched by the Delivery Runner under skill/bazodiac-interpretation-skill-v1.1/wrappers/claude.md (PO decision D2, Jira ETBZ-2 comment 16690)',
  model: 'claude-opus-5-5 (as each runtime reported it)',
  executedAt: '2026-10-02',
  inputBoundary: 'each instance read only wrappers/claude.md, SKILL.md, contract-bundle.json, reading-schema.json, MANIFEST.json and its own case package, used only Read and Write, and wrote outside the worktree (its own report; not measured)',
  invocation: {
    run1: 'the wrapper invocation only',
    run2: 'the wrapper invocation plus a length addendum: 600-900 words per chapter, aim 700-750, count before writing (sha256 of the addendum text: 924bad7ce93f5098...)',
  },
  noHumanEdit: 'no person edited a reading; each repair was made by the instance itself from the refusal (wrapper step 5)',
} as const;

const read = (path: string, root: string): Buffer => readFileSync(resolve(root, path));
const sha = (bytes: Uint8Array | string): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const fileSha = (path: string, root: string): string => sha(read(path, root));
const json = (path: string, root: string): unknown => JSON.parse(read(path, root).toString('utf8')) as unknown;
const codesOf = (findings: readonly Finding[]): string[] => findings.map((finding) => finding.code).sort();
const directions = (entries: readonly { direction: string }[]): Record<string, number> => Object.fromEntries([...new Set(entries.map((entry) => entry.direction))].sort().map((direction) => [direction, entries.filter((entry) => entry.direction === direction).length]));

function refusalOf(draft: unknown, run: CaseRun): { code: string; diagnostics: string[] } | null {
  try {
    acceptSkillReading(draft, { bundle: run.bundle, inputPackage: run.inputPackage });
    return null;
  } catch (error) {
    const typed = error as { code?: string; diagnostics?: readonly { code: string; detail?: { where?: unknown } }[] };
    return { code: typed.code ?? 'THREW', diagnostics: (typed.diagnostics ?? []).map((entry) => `${entry.code}@${String(entry.detail?.where ?? '')}`) };
  }
}

function runsOf(label: CaseLabel, run: CaseRun, root: string): unknown[] {
  const dir = `${ETBZ59_DIR}/cases/${label}`;
  return readdirSync(resolve(root, dir)).filter((name) => /^run-\d+$/u.test(name)).sort().map((name) => ({
    run: name,
    attempts: readdirSync(resolve(root, dir, name)).sort().map((file) => {
      const path = `${dir}/${name}/${file}`;
      return { file: path, sha256: fileSha(path, root), refusal: refusalOf(json(path, root), run) };
    }),
  }));
}

function accepted(label: CaseLabel, run: CaseRun, root: string): { semantic: AcceptedSkillReading; edited: AcceptedSkillReading } {
  const context = { bundle: run.bundle, inputPackage: run.inputPackage };
  const semantic = acceptSkillReading(json(caseFile(label, 'semantic-reading'), root), context);
  const edited = acceptEditorialRevision(semantic, json(caseFile(label, 'skill-reading'), root), context);
  return { semantic, edited };
}

export async function deriveIndividualityRecord(root: string = process.cwd()): Promise<Record<string, unknown>> {
  const runs = Object.fromEntries(await Promise.all(CASE_LABELS.map(async (label) => [label, await deriveCase(label, root)] as const))) as Record<CaseLabel, CaseRun>;
  const s = runs.source;
  const n = runs.near;
  const r = runs.removal;
  const d = (await variantChart('distant', root)).model;
  const delta = namedDifference(s.model, n.model);
  const swapNear = swapRevalidation(s, n.model, PLAN_CONTRACT_BINDINGS_V1_1);
  const swapDistant = swapRevalidation(s, d, PLAN_CONTRACT_BINDINGS_V1_1);
  const nearNeighbour = compareUnderDifference('6.1', s, n, delta);
  const mutation = compareUnderDifference('6.3', s, n, delta);
  const removal = removalCheck(s, r, REMOVED_FACT_IDS);
  const judgements: Judgements = existsSync(resolve(root, ETBZ59_JUDGEMENTS)) ? (json(ETBZ59_JUDGEMENTS, root) as Judgements) : { judgements: [], outsideContract: [] };
  const judged = (check: string): string[] => judgements.judgements.filter((entry) => entry.check === check).flatMap((entry) => entry.codes);
  const classOf = (code: string): string => INDIVIDUALITY_REASON_CODES.find((entry) => entry.code === code)?.class ?? 'OUTSIDE_CONTRACT';
  const raised = [...codesOf([...swapNear.findings, ...swapDistant.findings, ...nearNeighbour.findings, ...mutation.findings, ...removal.findings]), ...judgements.judgements.flatMap((entry) => entry.codes)];
  const judgeFiles = readdirSync(resolve(root, ETBZ59_JUDGES_DIR), { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => relative(resolve(root, ETBZ59_JUDGES_DIR), join(entry.parentPath, entry.name))).sort();
  const readingOf = (label: CaseLabel): AcceptedSkillReading => json(caseFile(label, 'accepted-reading'), root) as AcceptedSkillReading;

  return {
    recordVersion: 'etbz59-individuality-record.v1',
    contract: { contractRef: 'cross-reading-individuality-contract@1.1.0', confluencePageId: '77266967', confluencePageVersion: '3' },
    decisions: 'Jira ETBZ-53 comment 17031 (D-53-6, D-53-7); Jira ETBZ-59 comments 17034 (D-59-1, D-59-2), 17037 (D-59-3), 17038 (D-59-4)',
    variants: Object.fromEntries(VARIANT_LABELS.map((label) => {
      const { readback } = loadVariantRun(label, root);
      return [label, {
        ...VARIANT_DEFINITIONS[label],
        readbackFileSha256: fileSha(variantReadbackFile(label), root),
        attestation: readback.attestation.status,
        probes: { health: readback.probes.health.status, ready: readback.probes.ready.status, withoutCredentialsRefused: readback.probes.unauthorised.refused },
        exchanges: readback.exchanges.map(({ label: exchange, status, responseSha256 }) => ({ exchange, status, responseSha256 })),
        synthetic: true,
      }];
    })),
    cases: Object.fromEntries(CASE_LABELS.map((label) => {
      const run = runs[label];
      const reading = accepted(label, run, root);
      return [label, {
        displayName: run.model.displayName,
        evaluationWithdrawal: run.model.evaluationWithdrawal ?? null,
        interpretationInput: { structuralHash: run.input.structuralHash, productionEligible: run.input.productionEligibility.eligible, blockers: run.input.productionEligibility.blockers },
        claimGraphStructuralHash: run.graph.structuralHash,
        planStructuralHash: run.plan.structuralHash,
        reviewedPins: REVIEWED_PINS[label],
        skillInput: { structuralHash: run.inputPackage.structuralHash, fileSha256: fileSha(caseFile(label, 'skill-input'), root) },
        runsNote: 'each archived attempt re-run through the current boundary: its code is the one it was refused with; the diagnostics are what the boundary reports since D-59-3 and D-59-4',
        runs: runsOf(label, run, root),
        accepted: {
          semanticFileSha256: fileSha(caseFile(label, 'semantic-reading'), root),
          semanticStructuralHash: reading.semantic.structuralHash,
          editFileSha256: fileSha(caseFile(label, 'skill-reading'), root),
          acceptedStructuralHash: reading.edited.structuralHash,
          acceptedFileSha256: fileSha(caseFile(label, 'accepted-reading'), root),
        },
      }];
    })),
    preRunCones: { file: ETBZ59_CONES, sha256: fileSha(ETBZ59_CONES, root) },
    deterministic: {
      namedDifference: { factCount: delta.length },
      swap: {
        near: { refused: swapNear.refused, refusal: swapNear.refusal, findings: codesOf(swapNear.findings) },
        distant: { refused: swapDistant.refused, refusal: swapDistant.refusal, findings: codesOf(swapDistant.findings) },
      },
      nearNeighbour: { coneClaims: nearNeighbour.cone.claims.length, coneTensions: nearNeighbour.cone.tensions.length, statementsSurvived: nearNeighbour.dependentClaims.filter((claim) => claim.statementSurvives).length, findings: codesOf(nearNeighbour.findings) },
      mutation: { coneClaims: mutation.cone.claims.length, thesisInCone: mutation.cone.thesis, findings: codesOf(mutation.findings) },
      removal: { coneClaims: removal.cone.claims.length, dependent: removal.dependentClaims.map(({ blockedCode, absent }) => ({ blockedCode, absent })), findings: codesOf(removal.findings) },
      provisionality: { mutation: directions(provisionalityDirection(s, n)), removal: directions(provisionalityDirection(s, r)) },
    },
    judgements: {
      file: existsSync(resolve(root, ETBZ59_JUDGEMENTS)) ? { path: ETBZ59_JUDGEMENTS, sha256: fileSha(ETBZ59_JUDGEMENTS, root) } : null,
      judgeFiles: Object.fromEntries(judgeFiles.map((file) => [file, fileSha(`${ETBZ59_JUDGES_DIR}/${file}`, root)])),
    },
    rescueTriage: {
      note: 'locates passages, decides nothing; the pre-registered co-occurrence lists are in judges/B/candidates.json; this position-only list was added after judge B found the positive control missing source chapters[5].paragraphs[2]',
      positionOnly: { removal: termCandidates(passagesOf(readingOf('removal')), RESCUE_POSITION_TERMS).map((passage) => passage.path), sourcePositiveControl: termCandidates(passagesOf(readingOf('source')), RESCUE_POSITION_TERMS).map((passage) => passage.path) },
    },
    goldenRunMinimum: {
      '8.1': { checks: ['6.1'], deterministic: codesOf(nearNeighbour.findings), judged: judged('6.1') },
      '8.2': { checks: ['6.3', '6.4'], deterministic: [...codesOf(mutation.findings), ...codesOf(removal.findings)], judged: judged('6.4') },
      '8.3': { checks: ['6.5'], judged: judged('6.5') },
      '8.4': { checks: ['6.2'], deterministic: [...codesOf(swapNear.findings), ...codesOf(swapDistant.findings)] },
      '8.5': { checks: ['6.7'], judged: judged('6.7') },
      '8.6': {
        raised: [...new Set(raised)].sort().map((code) => ({ code, class: classOf(code), count: raised.filter((entry) => entry === code).length })),
        outsideContract: judgements.outsideContract.flatMap((entry) => entry.codes),
        note: 'every code is listed in judgements.json with the passages or claim ids it cites; the BLOCKING code carries its proposed smallest repair, not applied',
      },
    },
    generation: ETBZ59_GENERATION,
  };
}
