/**
 * ETBZ-60 — the re-reading of R(S) and R(N) under the boundary that refuses ungrounded position statements
 * (READING_POSITION_UNGROUNDED; PO decisions D-59-5, D-59-6), the packet of the independent judge who rules on 6.7
 * again, and the run record. The cases, their drafts and their Skill input packages are ETBZ-59's, unchanged
 * (`deriveCase`); Skill 1.1.0 and bundle 1.1.0 are unchanged. Everything is re-derived from the committed files.
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

export const ETBZ60_DIR = 'docs/evidence/etbz-60';
export const ETBZ60_JUDGE_DIR = `${ETBZ60_DIR}/judge`;
export const ETBZ60_RECORD = `${ETBZ60_DIR}/rereading-record.json`;
export const ETBZ60_JUDGEMENTS = `${ETBZ60_DIR}/judgements.json`;
export const ETBZ60_LABELS = ['source', 'near'] as const;
export type Etbz60Label = (typeof ETBZ60_LABELS)[number];

export type ReadingFile = 'semantic-reading' | 'skill-reading' | 'accepted-reading';
export const caseFile = (label: Etbz60Label, file: ReadingFile): string => `${ETBZ60_DIR}/cases/${label}/${file}.json`;

const read = (path: string, root: string): Buffer => readFileSync(resolve(root, path));
const json = (path: string, root: string): unknown => JSON.parse(read(path, root).toString('utf8')) as unknown;
const fileSha = (path: string, root: string): string => `sha256:${createHash('sha256').update(read(path, root)).digest('hex')}`;

/** REALISE, then EDIT when present - the boundary's verdict on a case's committed reading files. */
export function acceptCase(label: Etbz60Label, run: CaseRun, root: string = process.cwd()): { semantic: AcceptedSkillReading; edited: AcceptedSkillReading | null } {
  const context = { bundle: run.bundle, inputPackage: run.inputPackage };
  const semantic = acceptSkillReading(json(caseFile(label, 'semantic-reading'), root), context);
  const edited = existsSync(resolve(root, caseFile(label, 'skill-reading'))) ? acceptEditorialRevision(semantic, json(caseFile(label, 'skill-reading'), root), context) : null;
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

/** The judge's packet (6.7 over the new R(S) and R(N)): readings, claims, charts and the triage candidates. */
export async function deriveJudgePacket(root: string = process.cwd()): Promise<Record<string, string>> {
  const runs = { source: await deriveCase('source', root), near: await deriveCase('near', root) };
  const readings = Object.fromEntries(ETBZ60_LABELS.map((label) => [label, json(caseFile(label, 'accepted-reading'), root) as AcceptedSkillReading])) as Record<Etbz60Label, AcceptedSkillReading>;
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

function runsOf(label: Etbz60Label, run: CaseRun, root: string): unknown[] {
  const dir = `${ETBZ60_DIR}/cases/${label}`;
  if (!existsSync(resolve(root, dir))) return [];
  return readdirSync(resolve(root, dir)).filter((name) => /^run-\d+$/u.test(name)).sort().map((name) => ({
    run: name,
    attempts: readdirSync(resolve(root, dir, name)).sort().map((file) => {
      const path = `${dir}/${name}/${file}`;
      return { file: path, sha256: fileSha(path, root), refusal: refusalOf(json(path, root), run) };
    }),
  }));
}

export async function deriveRereadingRecord(root: string = process.cwd()): Promise<Record<string, unknown>> {
  const cases: Record<string, unknown> = {};
  for (const label of ETBZ60_LABELS) {
    const run = await deriveCase(label, root);
    const { semantic, edited } = acceptCase(label, run, root);
    cases[label] = {
      skillInput: { file: etbz59CaseFile(label, 'skill-input'), structuralHash: run.inputPackage.structuralHash, fileSha256: fileSha(etbz59CaseFile(label, 'skill-input'), root) },
      claimGraphStructuralHash: run.graph.structuralHash,
      planStructuralHash: run.plan.structuralHash,
      runs: runsOf(label, run, root),
      accepted: {
        semanticFileSha256: fileSha(caseFile(label, 'semantic-reading'), root),
        semanticStructuralHash: semantic.structuralHash,
        editFileSha256: fileSha(caseFile(label, 'skill-reading'), root),
        acceptedStructuralHash: edited?.structuralHash ?? null,
        acceptedFileSha256: fileSha(caseFile(label, 'accepted-reading'), root),
      },
    };
  }
  const judgeDir = resolve(root, ETBZ60_JUDGE_DIR);
  const judgeFiles = existsSync(judgeDir) ? readdirSync(judgeDir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => relative(judgeDir, join(entry.parentPath, entry.name))).sort() : [];
  const run = await deriveCase('source', root);
  return {
    recordVersion: 'etbz60-rereading-record.v1',
    decisions: 'Jira ETBZ-59 comment 17045 (D-59-5); Jira ETBZ-60 comments 17046 (D-59-6) and 17047 (measurement, AC1 corrected)',
    boundary: { code: 'READING_POSITION_UNGROUNDED', rule: 'a sentence that states something of the chart\'s positions as a whole needs a cited fact of every pillar' },
    identities: { skillRef: run.inputPackage.skillRef, bundleRef: run.bundle.bundleRef, bundleStructuralHash: run.bundle.structuralHash, unchanged: 'skill/ has no change against e5ccc94c (D-59-6)' },
    generation: {
      declared: true,
      runtime: 'one fresh Claude Code subagent instance per case, dispatched by the Delivery Runner under skill/bazodiac-interpretation-skill-v1.1/wrappers/claude.md with the ETBZ-59 run-2 invocation (length target) unchanged but for the paths; no hint of the new check',
      model: 'claude-opus-5-5 (as each runtime reported it)',
      executedAt: '2026-10-02',
    },
    cases,
    judgement: {
      file: existsSync(resolve(root, ETBZ60_JUDGEMENTS)) ? { path: ETBZ60_JUDGEMENTS, sha256: fileSha(ETBZ60_JUDGEMENTS, root) } : null,
      judgeFiles: Object.fromEntries(judgeFiles.map((file) => [file, fileSha(`${ETBZ60_JUDGE_DIR}/${file}`, root)])),
    },
  };
}
