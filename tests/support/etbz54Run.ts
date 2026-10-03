/**
 * ETBZ-54 — the run's offline stages over the private archive: the three cases, the pre-run cones (contract 6.3 step
 * 1, section 8.2), the judges' packets and the presentation of the accepted Golden reading. The procedures and sheets
 * are ETBZ-59's (D-53-7): `dependencyCone`, `namedDifference`, the candidate finders, `readingText`, `chartSheet`,
 * `claimSheet`, `passagesOf`. Every file written from here goes into the archive.
 */
import { readFileSync } from 'node:fs';
import { buildSkillReadingProjection } from '../../src/application/presentation/index.js';
import type { PresentationProjection } from '../../src/application/presentation/index.js';
import { acceptEditorialRevision, acceptSkillReading } from '../../src/application/skill/index.js';
import type { AcceptedSkillReading } from '../../src/application/skill/index.js';
import { GOLDEN_CASE_REF, parseQuietly } from './etbz53GoldenFreeze.js';
import type { CaseLabel, CaseRun } from './etbz59Cases.js';
import { dependencyCone, namedDifference, rescueCandidates, reuseCandidates } from './etbz59Individuality.js';
import type { Cone } from './etbz59Individuality.js';
import { chartSheet, claimSheet, passagesOf, readingText } from './etbz59Judges.js';
import {
  GOLDEN_LABELS,
  assertHourDifference,
  caseFile,
  deriveGoldenCase,
  distantChart,
  goldenCharts,
  loadGoldenDrafts,
} from './etbz54Golden.js';
import type { GoldenCharts, GoldenConfig, GoldenDrafts } from './etbz54Golden.js';
import { findPositionStatement } from '../../src/application/skill/index.js';

export interface GoldenRun {
  readonly drafts: GoldenDrafts;
  readonly charts: GoldenCharts;
  readonly runs: Readonly<Record<CaseLabel, CaseRun>>;
  /** Δ: the facts S and N answer differently - the hour pillar and what it feeds (asserted). */
  readonly delta: readonly string[];
}

export async function loadGoldenRun(config: GoldenConfig): Promise<GoldenRun> {
  const drafts = loadGoldenDrafts(config);
  const charts = await goldenCharts(config, drafts);
  const delta = namedDifference(charts.source.model, charts.near.model);
  assertHourDifference(delta);
  const runs = Object.fromEntries(GOLDEN_LABELS.map((label) => [label, deriveGoldenCase(label, charts, drafts)])) as Record<CaseLabel, CaseRun>;
  return { drafts, charts, runs, delta };
}

const describe = (cone: Cone, run: CaseRun): Record<string, unknown> => ({
  ...cone,
  claimStatements: cone.claims.map((id) => run.graph.claims.find((claim) => claim.claimId === id)?.statement ?? null),
});

/** Contract 6.3 step 1 and section 8.2: written before any reading of the three cases exists. */
export async function deriveGoldenCones(config: GoldenConfig): Promise<Record<string, unknown>> {
  const { drafts, runs, delta } = await loadGoldenRun(config);
  return {
    recordVersion: 'etbz54-pre-run-cones.v1',
    caseRef: GOLDEN_CASE_REF,
    note: 'written before any reading of the three cases exists; the readings are judged against these cones (contract 77266967 v3, 6.3 step 1 and 8.2)',
    nearNeighbourDifference: { variant: 'near', factIds: [...delta] },
    nearNeighbourAndMutationCone: describe(dependencyCone(runs.source, delta), runs.source),
    removal: { factIds: [...drafts.removal.factIds], cone: describe(dependencyCone(runs.source, drafts.removal.factIds), runs.source) },
    rescueTerms: drafts.rescueTerms,
    graphs: Object.fromEntries(GOLDEN_LABELS.map((label) => [label, runs[label].graph.structuralHash])),
    plans: Object.fromEntries(GOLDEN_LABELS.map((label) => [label, runs[label].plan.structuralHash])),
    packages: Object.fromEntries(GOLDEN_LABELS.map((label) => [label, runs[label].inputPackage.structuralHash])),
  };
}

export const acceptedReadingOf = (config: GoldenConfig, label: CaseLabel): AcceptedSkillReading =>
  parseQuietly(readFileSync(caseFile(config, label, 'accepted-reading'), 'utf8'), 'an accepted reading') as AcceptedSkillReading;

/** The display names a blind packet must not carry: the case reference and the variants'. */
const GOLDEN_DISPLAY_NAMES = [GOLDEN_CASE_REF] as const;
export const scrubGolden = (text: string): string => GOLDEN_DISPLAY_NAMES.reduce((current, name) => current.split(name).join('[Name]'), text);

/** S⁻'s claim sheet: ETBZ-59's, with the withdrawn facts of this run (its last line names the fixture's). */
export function removalClaimSheet(run: CaseRun, removed: readonly string[]): string {
  const sheet = claimSheet('removal', run);
  const withdrawn = /withdrawn facts: [^\n]*\n$/u;
  if (!withdrawn.test(sheet)) throw new Error('etbz54: the removal claim sheet has no withdrawn-facts line');
  return sheet.replace(withdrawn, `withdrawn facts: ${removed.join(', ')}\n`);
}

/**
 * The packets of the independent judges, as in ETBZ-59: A is blind (two readings X, Y; three charts in a fixed mixed
 * order; the key is withheld until the verdict), B is labelled (6.4 prose side, 6.5, 6.7). C reads the Golden reading
 * with its claims and chart for overreach and safety (AC 3; the Lens owns OVERREACH, contract section 5) - reported
 * beside the contract's codes, never merged with them.
 */
export async function deriveGoldenJudgePackets(config: GoldenConfig): Promise<Record<string, string>> {
  const { drafts, charts, runs } = await loadGoldenRun(config);
  const distant = (await distantChart()).model;
  const readings = Object.fromEntries(GOLDEN_LABELS.map((label) => [label, acceptedReadingOf(config, label)])) as Record<CaseLabel, AcceptedSkillReading>;
  const text = (label: CaseLabel): string => scrubGolden(readingText(readings[label]));
  const files: Record<string, string> = {};

  files['A/reading-X.md'] = text('near');
  files['A/reading-Y.md'] = text('source');
  files['A/chart-1.txt'] = chartSheet(distant);
  files['A/chart-2.txt'] = chartSheet(charts.source.model);
  files['A/chart-3.txt'] = chartSheet(charts.near.model);
  files['KEY-operator-only.json'] = JSON.stringify({ X: 'near (R(N))', Y: 'source (R(S), the Golden reading)', 1: 'distant D (Musterkundin A)', 2: 'source S (GOLDEN-KT-01)', 3: 'near N' }, null, 1);

  files['B/reading-source.md'] = text('source');
  files['B/reading-near.md'] = text('near');
  files['B/reading-removal.md'] = text('removal');
  files['B/claims-source.txt'] = claimSheet('source', runs.source);
  files['B/claims-near.txt'] = claimSheet('near', runs.near);
  files['B/claims-removal.txt'] = removalClaimSheet(runs.removal, drafts.removal.factIds);
  files['B/chart-source.txt'] = files['A/chart-2.txt'];
  files['B/chart-near.txt'] = files['A/chart-3.txt'];
  const source = passagesOf(readings.source);
  files['B/candidates.json'] = JSON.stringify({
    reuseVerbatimSentences: reuseCandidates(source, passagesOf(readings.near)).verbatimSentences,
    removalRescueCandidates: rescueCandidates(passagesOf(readings.removal), drafts.rescueTerms.subjectTerms, drafts.rescueTerms.positionTerms).map((passage) => passage.path),
    sourceRescueCandidatesPositiveControl: rescueCandidates(source, drafts.rescueTerms.subjectTerms, drafts.rescueTerms.positionTerms).map((passage) => passage.path),
    positionStatements: (['source', 'near'] as const).flatMap((label) => passagesOf(readings[label]).filter((passage) => findPositionStatement(passage.text) !== null).map((passage) => `${label} ${passage.path}`)),
  }, null, 1);

  files['C/reading-source.md'] = text('source');
  files['C/claims-source.txt'] = files['B/claims-source.txt'];
  files['C/chart-source.txt'] = files['A/chart-2.txt'];
  return files;
}

export interface GoldenAssembly {
  readonly semantic: AcceptedSkillReading;
  readonly accepted: AcceptedSkillReading;
  readonly projection: PresentationProjection;
}

/** The Golden reading through the boundary again, then the one presentation path (as ETBZ-58's `assembleRehearsal`). */
export async function assembleGolden(config: GoldenConfig): Promise<GoldenAssembly> {
  const { runs, charts } = await loadGoldenRun(config);
  const run = runs.source;
  const context = { bundle: run.bundle, inputPackage: run.inputPackage };
  const read = (file: 'semantic-reading' | 'skill-reading'): unknown => parseQuietly(readFileSync(caseFile(config, 'source', file), 'utf8'), `the ${file}`);
  const semantic = acceptSkillReading(read('semantic-reading'), context);
  const accepted = acceptEditorialRevision(semantic, read('skill-reading'), context);
  const projection = buildSkillReadingProjection({ model: charts.source.model, reading: accepted, bundle: run.bundle, inputPackage: run.inputPackage });
  return { semantic, accepted, projection };
}
