/**
 * ETBZ-59 — the packets the two independent qualitative judges read (contract 77266967 v3: judge A, blind attribution
 * 6.1 step 4; judge B, ablation 6.5, reuse 6.7, the prose side of removal 6.4, and N's tie). Each packet is derived
 * from committed evidence only, so the contract suite re-derives it byte for byte: what a judge read is a function of
 * the accepted readings and the validated charts, never an operator's hand copy.
 *
 * Judge A is blind: two readings without names or labels (X, Y) and three charts in a fixed mixed order (1, 2, 3).
 * The key is written beside the packets and was withheld from the judge until the verdict was in. Judge B gets the
 * labelled readings, each case's accepted claims with their cited values, the S and N charts, and the triage
 * candidates of the deterministic finders, which locate passages and decide nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { projectCustomerReading } from '../../src/application/skill/index.js';
import type { AcceptedSkillReading } from '../../src/application/skill/index.js';
import { CASE_LABELS, NEAR_CONTRADICTION_TERMS, REMOVED_FACT_IDS, RESCUE_POSITION_TERMS, RESCUE_SUBJECT_TERMS, caseFile, deriveCase } from './etbz59Cases.js';
import type { CaseLabel, CaseRun } from './etbz59Cases.js';
import { rescueCandidates, reuseCandidates, termCandidates } from './etbz59Individuality.js';
import type { Passage } from './etbz59Individuality.js';
import { ETBZ59_DIR, variantChart } from './etbz59Variants.js';

export const ETBZ59_JUDGES_DIR = `${ETBZ59_DIR}/judges`;

/** The display names a blind packet must not carry (the fixture's and the two variants'). */
const DISPLAY_NAMES = ['Musterkundin A', 'Variante N (synthetisch)', 'Variante D (synthetisch)', 'Variante N', 'Variante D'] as const;
const scrub = (text: string): string => DISPLAY_NAMES.reduce((current, name) => current.split(name).join('[Name]'), text);

const acceptedReading = (label: CaseLabel, root: string): AcceptedSkillReading =>
  JSON.parse(readFileSync(resolve(root, caseFile(label, 'accepted-reading')), 'utf8')) as AcceptedSkillReading;

/** The customer text with `[chapter.paragraph]` markers, display names replaced. */
export function readingText(reading: AcceptedSkillReading): string {
  const customer = projectCustomerReading(reading);
  const parts = [`# ${scrub(customer.title)}`];
  customer.chapters.forEach((chapter, i) => {
    parts.push(`\n## Kapitel ${String(i + 1)}: ${scrub(chapter.title)}`);
    chapter.paragraphs.forEach((paragraph, j) => parts.push(`[${String(i)}.${String(j)}] ${scrub(paragraph)}`));
  });
  parts.push('\n## Reflexionsfragen', ...customer.reflectionQuestions.map((question) => `- ${scrub(question)}`));
  return parts.join('\n');
}

export const passagesOf = (reading: AcceptedSkillReading): Passage[] =>
  reading.chapters.flatMap((chapter, i) => chapter.paragraphs.map((paragraph, j) => ({ path: `chapters[${String(i)}].paragraphs[${String(j)}]`, text: paragraph.text })));

/** Pillars, visible and hidden Ten Gods, day master and tally - the validated facts a judge attributes against. */
export function chartSheet(model: HoroscopeModel): string {
  const facts = deriveInterpretationFeatureSet(model).facts;
  const v = (id: string): string => facts.find((fact) => fact.id === id)?.value ?? '-';
  const lines: string[] = [];
  for (const pillar of ['year', 'month', 'day', 'hour'] as const) {
    const hidden = [0, 1, 2]
      .map((i) => (v(`chart.natal.pillar.${pillar}.hiddenStem.${String(i)}.stem`) === '-' ? null : `${v(`chart.natal.pillar.${pillar}.hiddenStem.${String(i)}.stem`)} (${v(`chart.natal.pillar.${pillar}.hiddenStem.${String(i)}.tenGod`)})`))
      .filter((entry) => entry !== null);
    lines.push(`${pillar}: stem ${v(`chart.pillar.${pillar}.stem`)} ${v(`chart.pillar.${pillar}.stemHanzi`)} (${v(`chart.pillar.${pillar}.stemElement`)}), branch ${v(`chart.pillar.${pillar}.branch`)} ${v(`chart.pillar.${pillar}.branchHanzi`)} (${v(`chart.pillar.${pillar}.tier`)}); visible Ten God ${v(`chart.natal.pillar.${pillar}.tenGod`)}; hidden ${hidden.join(', ')}`);
  }
  lines.push(`day master: ${v('chart.dayMaster.stem')}`);
  lines.push(`Wu Xing weights: ${['Holz', 'Feuer', 'Erde', 'Metall', 'Wasser'].map((element) => `${element} ${v(`chart.wuxing.weight.${element}`)}`).join(', ')}`);
  return lines.join('\n');
}

/** Each accepted claim with the values it cites, the thesis and the motif cores; S⁻ marks its withdrawal. */
export function claimSheet(label: CaseLabel, run: CaseRun): string {
  const values = new Map(deriveInterpretationFeatureSet(run.model).facts.map((fact) => [fact.id, `${fact.value}${fact.interpretable ? '' : ' [WITHDRAWN]'}`]));
  const statementOf = (id: string): string | undefined => run.graph.claims.find((claim) => claim.claimId === id)?.statement;
  const lines = run.graph.claims.map((claim) => `- ${claim.statement}\n    cites: ${claim.factRefs.map((id) => `${id.replace('chart.', '')}=${values.get(id) ?? '?'}`).join('; ')}`);
  const thesis = run.plan.reportThesis.claimRefs.map(statementOf);
  const motifs = run.plan.primaryMotifs.map((motif) => `  motif: ${motif.coreClaimRefs.map(statementOf).join(' + ')}`);
  return `${label} claims:\n${lines.join('\n')}\nthesis: ${thesis.join(' | ')}\n${motifs.join('\n')}\n${label === 'removal' ? `withdrawn facts: ${REMOVED_FACT_IDS.join(', ')}\n` : ''}`;
}

/** Every packet file, keyed by its path below `ETBZ59_JUDGES_DIR`. */
export async function deriveJudgePackets(root: string = process.cwd()): Promise<Record<string, string>> {
  const runs = Object.fromEntries(await Promise.all(CASE_LABELS.map(async (label) => [label, await deriveCase(label, root)] as const))) as Record<CaseLabel, CaseRun>;
  const distant = (await variantChart('distant', root)).model;
  const readings = Object.fromEntries(CASE_LABELS.map((label) => [label, acceptedReading(label, root)])) as Record<CaseLabel, AcceptedSkillReading>;
  const files: Record<string, string> = {};

  // Judge A: blind, in an order fixed here.
  files['A/reading-X.md'] = readingText(readings.near);
  files['A/reading-Y.md'] = readingText(readings.source);
  files['A/chart-1.txt'] = chartSheet(distant);
  files['A/chart-2.txt'] = chartSheet(runs.source.model);
  files['A/chart-3.txt'] = chartSheet(runs.near.model);
  files['KEY-operator-only.json'] = JSON.stringify({ X: 'near (R(N))', Y: 'source (R(S))', 1: 'distant D', 2: 'source S', 3: 'near N' }, null, 1);

  // Judge B: labelled.
  for (const label of CASE_LABELS) {
    files[`B/reading-${label}.md`] = readingText(readings[label]);
    files[`B/claims-${label}.txt`] = claimSheet(label, runs[label]);
  }
  files['B/chart-source.txt'] = files['A/chart-2.txt'];
  files['B/chart-near.txt'] = files['A/chart-3.txt'];
  const source = passagesOf(readings.source);
  files['B/candidates.json'] = JSON.stringify({
    reuseVerbatimSentences: reuseCandidates(source, passagesOf(readings.near)).verbatimSentences,
    nearSingleLeaderCandidates: termCandidates(passagesOf(readings.near), NEAR_CONTRADICTION_TERMS).map((passage) => passage.path),
    removalRescueCandidates: rescueCandidates(passagesOf(readings.removal), RESCUE_SUBJECT_TERMS, RESCUE_POSITION_TERMS).map((passage) => passage.path),
    sourceRescueCandidatesPositiveControl: rescueCandidates(source, RESCUE_SUBJECT_TERMS, RESCUE_POSITION_TERMS).map((passage) => passage.path),
  }, null, 1);
  return files;
}
