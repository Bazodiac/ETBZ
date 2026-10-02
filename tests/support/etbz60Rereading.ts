/**
 * ETBZ-60 — the re-readings of R(S) and R(N) and the independent 6.7 judgement of each round, re-derived from the
 * committed files.
 *
 * - round-1 (PO decision D-59-6): ETBZ-59's drafts and packages, under the boundary that refuses ungrounded position
 *   statements (READING_POSITION_UNGROUNDED). The judge found STOCK_PARAGRAPH_REUSE again, in a paraphrase.
 * - round-2 (PO decision D-60-1): the drafts with the distribution claim over every pillar's surface
 *   (`etbz60Cases.ts`), their own packages and pre-run cones, under the same boundary.
 *
 * Skill 1.1.0 and bundle 1.1.0 are unchanged throughout.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { acceptEditorialRevision, acceptSkillReading, findPositionStatement } from '../../src/application/skill/index.js';
import type { AcceptedSkillReading } from '../../src/application/skill/index.js';
import { caseFile as etbz59CaseFile, deriveCase } from './etbz59Cases.js';
import type { CaseRun } from './etbz59Cases.js';
import { reuseCandidates } from './etbz59Individuality.js';
import { chartSheet, claimSheet, passagesOf, readingText } from './etbz59Judges.js';
import { deriveRound2Case } from './etbz60Cases.js';

export const ETBZ60_DIR = 'docs/evidence/etbz-60';
export const ETBZ60_RECORD = `${ETBZ60_DIR}/rereading-record.json`;
export const ETBZ60_ROUNDS = ['round-1', 'round-2'] as const;
export type Etbz60Round = (typeof ETBZ60_ROUNDS)[number];
export const ETBZ60_LABELS = ['source', 'near'] as const;
export type Etbz60Label = (typeof ETBZ60_LABELS)[number];

export type ReadingFile = 'skill-input' | 'semantic-reading' | 'skill-reading' | 'accepted-reading';
export const roundDir = (round: Etbz60Round): string => `${ETBZ60_DIR}/${round}`;
export const judgeDir = (round: Etbz60Round): string => `${roundDir(round)}/judge`;
export const judgementsFile = (round: Etbz60Round): string => `${roundDir(round)}/judgements.json`;
export const ROUND2_CONES = `${roundDir('round-2')}/pre-run-cones.json`;

/** Round 1 read ETBZ-59's packages; round 2 has its own. */
export const caseFile = (round: Etbz60Round, label: Etbz60Label, file: ReadingFile): string =>
  round === 'round-1' && file === 'skill-input' ? etbz59CaseFile(label, 'skill-input') : `${roundDir(round)}/cases/${label}/${file}.json`;

export const deriveRoundCase = (round: Etbz60Round, label: Etbz60Label, root: string = process.cwd()): Promise<CaseRun> =>
  round === 'round-1' ? deriveCase(label, root) : deriveRound2Case(label, root);

const read = (path: string, root: string): Buffer => readFileSync(resolve(root, path));
const json = (path: string, root: string): unknown => JSON.parse(read(path, root).toString('utf8')) as unknown;
const fileSha = (path: string, root: string): string => `sha256:${createHash('sha256').update(read(path, root)).digest('hex')}`;

/** REALISE, then EDIT when present - the boundary's verdict on a case's committed reading files. */
export function acceptCase(round: Etbz60Round, label: Etbz60Label, run: CaseRun, root: string = process.cwd()): { semantic: AcceptedSkillReading; edited: AcceptedSkillReading | null } {
  const context = { bundle: run.bundle, inputPackage: run.inputPackage };
  const semantic = acceptSkillReading(json(caseFile(round, label, 'semantic-reading'), root), context);
  const edited = existsSync(resolve(root, caseFile(round, label, 'skill-reading'))) ? acceptEditorialRevision(semantic, json(caseFile(round, label, 'skill-reading'), root), context) : null;
  return { semantic, edited };
}

function refusalOf(draft: unknown, run: CaseRun): { code: string; diagnostics: string[] } | null {
  try {
    acceptSkillReading(draft, { bundle: run.bundle, inputPackage: run.inputPackage });
    return null;
  } catch (error) {
    const typed = error as { code?: string; diagnostics?: readonly { code: string; detail?: { where?: unknown } }[] };
    return { code: typed.code ?? 'THREW', diagnostics: (typed.diagnostics ?? []).map((entry) => `${entry.code}@${String(entry.detail?.where ?? '')}`) };
  }
}

/** A round's judge packet (6.7 over that round's R(S) and R(N)): readings, claims, charts and the triage candidates. */
export async function deriveJudgePacket(round: Etbz60Round, root: string = process.cwd()): Promise<Record<string, string>> {
  const runs = { source: await deriveRoundCase(round, 'source', root), near: await deriveRoundCase(round, 'near', root) };
  const readings = Object.fromEntries(ETBZ60_LABELS.map((label) => [label, json(caseFile(round, label, 'accepted-reading'), root) as AcceptedSkillReading])) as Record<Etbz60Label, AcceptedSkillReading>;
  const files: Record<string, string> = {};
  for (const label of ETBZ60_LABELS) {
    files[`reading-${label}.md`] = readingText(readings[label]);
    files[`claims-${label}.txt`] = claimSheet(label, runs[label]);
    files[`chart-${label}.txt`] = chartSheet(runs[label].model);
  }
  const passages = { source: passagesOf(readings.source), near: passagesOf(readings.near) };
  files['candidates.json'] = JSON.stringify({
    reuseVerbatimSentences: reuseCandidates(passages.source, passages.near).verbatimSentences,
    positionStatements: ETBZ60_LABELS.flatMap((label) => passages[label].filter((passage) => findPositionStatement(passage.text) !== null).map((passage) => `${label} ${passage.path}`)),
  }, null, 1);
  return files;
}

function runsOf(round: Etbz60Round, label: Etbz60Label, run: CaseRun, root: string): unknown[] {
  const dir = `${roundDir(round)}/cases/${label}`;
  if (!existsSync(resolve(root, dir))) return [];
  return readdirSync(resolve(root, dir)).filter((name) => /^run-\d+$/u.test(name)).sort().map((name) => ({
    run: name,
    attempts: readdirSync(resolve(root, dir, name)).sort().map((file) => {
      const path = `${dir}/${name}/${file}`;
      return { file: path, sha256: fileSha(path, root), refusal: refusalOf(json(path, root), run) };
    }),
  }));
}

const filesUnder = (dir: string, root: string): string[] => {
  const absolute = resolve(root, dir);
  return existsSync(absolute) ? readdirSync(absolute, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => relative(absolute, join(entry.parentPath, entry.name))).sort() : [];
};

async function roundRecord(round: Etbz60Round, root: string): Promise<Record<string, unknown>> {
  const cases: Record<string, unknown> = {};
  for (const label of ETBZ60_LABELS) {
    const run = await deriveRoundCase(round, label, root);
    const { semantic, edited } = acceptCase(round, label, run, root);
    cases[label] = {
      skillInput: { file: caseFile(round, label, 'skill-input'), structuralHash: run.inputPackage.structuralHash, fileSha256: fileSha(caseFile(round, label, 'skill-input'), root) },
      claimGraphStructuralHash: run.graph.structuralHash,
      planStructuralHash: run.plan.structuralHash,
      runs: runsOf(round, label, run, root),
      accepted: {
        semanticFileSha256: fileSha(caseFile(round, label, 'semantic-reading'), root),
        semanticStructuralHash: semantic.structuralHash,
        editFileSha256: fileSha(caseFile(round, label, 'skill-reading'), root),
        acceptedStructuralHash: edited?.structuralHash ?? null,
        acceptedFileSha256: fileSha(caseFile(round, label, 'accepted-reading'), root),
      },
    };
  }
  const judgements = judgementsFile(round);
  return {
    cases,
    ...(round === 'round-2' && existsSync(resolve(root, ROUND2_CONES)) ? { preRunCones: { file: ROUND2_CONES, sha256: fileSha(ROUND2_CONES, root) } } : {}),
    judgement: {
      file: existsSync(resolve(root, judgements)) ? { path: judgements, sha256: fileSha(judgements, root) } : null,
      judgeFiles: Object.fromEntries(filesUnder(judgeDir(round), root).map((file) => [file, fileSha(`${judgeDir(round)}/${file}`, root)])),
    },
  };
}

export async function deriveRereadingRecord(root: string = process.cwd()): Promise<Record<string, unknown>> {
  const run = await deriveCase('source', root);
  const rounds: Record<string, unknown> = {};
  for (const round of ETBZ60_ROUNDS) if (existsSync(resolve(root, roundDir(round)))) rounds[round] = await roundRecord(round, root);
  return {
    recordVersion: 'etbz60-rereading-record.v1',
    decisions: 'Jira ETBZ-59 comment 17045 (D-59-5); Jira ETBZ-60 comments 17046 (D-59-6), 17047 (measurement, AC1 corrected), 17050 (D-60-1)',
    boundary: { code: 'READING_POSITION_UNGROUNDED', rule: 'a sentence that states something of the chart\'s positions as a whole needs a cited fact of every pillar' },
    identities: { skillRef: run.inputPackage.skillRef, bundleRef: run.bundle.bundleRef, bundleStructuralHash: run.bundle.structuralHash, unchanged: 'skill/ has no change against e5ccc94c (D-59-6)' },
    generation: {
      declared: true,
      runtime: 'one fresh Claude Code subagent instance per case and round, dispatched by the Delivery Runner under skill/bazodiac-interpretation-skill-v1.1/wrappers/claude.md with the ETBZ-59 run-2 invocation (length target) unchanged but for the paths; no hint of the new check',
      model: 'claude-opus-5-5 (as each runtime reported it)',
      executedAt: '2026-10-02',
    },
    rounds,
  };
}
