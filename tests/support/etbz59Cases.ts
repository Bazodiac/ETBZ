/**
 * ETBZ-59 — the three drafted cases of the Anti-Boilerplate fixture rehearsal, built through the ordinary chain up
 * to the Skill input package (contract 77266967 v3, section 8; Jira ETBZ-59 comment 17034).
 *
 * The drafts are the Delivery Runner's (the drafter of ADR 0008; D-53-4 applied to the rehearsal) and are reviewed
 * by an independent instance before any reading. They reuse the ETBZ-30A/30B claims of Musterkundin A, whose cited
 * facts are identical on S, N and S⁻, and add one claim on the hour pillar (PO decision D-59-2):
 *
 * - source (S, Musterkundin A): the hour branch carries, the same, the controlling voice (Seven Killing) of the month
 *   branch; the claim joins the pressure motif's core and its developing chapter.
 * - near (N, the hour-pillar variant): its hour branch carries instead the expressive voice (Hurting Officer) of the
 *   month pillar; the claim joins the expression motif's core and its reinforcing chapter.
 * - removal (S⁻): S with the hour branch's Seven Killing relation withdrawn (`withdrawFactsForEvaluation`, D-59-1);
 *   the hour claim cannot be drafted and the plan is the ETBZ-30B baseline.
 *
 * Every case pins the values of the facts its claims cite (as ETBZ-58 did): a chart on which a cited value differs
 * is refused before any builder runs. A claim's statement is prose the builders cannot compare with a value.
 */
import { canonicalJson } from '../../src/domain/canonical-json.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet, withdrawFactsForEvaluation } from '../../src/application/interpretation/feature-set.js';
import { buildBazodiacInterpretationInput } from '../../src/application/interpretation/interpretation-input.js';
import type { BazodiacInterpretationInput } from '../../src/application/interpretation/interpretation-input.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { PLAN_CONTRACT_BINDINGS_V1_1, buildMetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlan, MetaNarrativePlanContext } from '../../src/application/interpretation/meta-narrative-plan.js';
import { SKILL_CONTRACT_BUNDLE_VERSION_V1_1, buildSkillContractBundle, buildSkillInputPackage } from '../../src/application/skill/index.js';
import type { SkillContractBundle, SkillInputPackage } from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import { H, MONTH_TEN_GOD, contextFor, draftOf } from './claimGraphFixture.js';
import { RehearsalError, loadRecordedRun } from './etbz58Rehearsal.js';
import { MONTH_HIDDEN_0_TEN_GOD, PLAN_H, chapter, idOf, planClaims, planContextFor, validPlanDraft } from './metaNarrativePlanFixture.js';
import type { MutablePlanDraft } from './metaNarrativePlanFixture.js';
import { sourceChart, variantChart } from './etbz59Variants.js';
import type { ReplayedChart } from './etbz59Variants.js';

export const CASE_LABELS = ['source', 'near', 'removal'] as const;
export type CaseLabel = (typeof CASE_LABELS)[number];

export const HOUR_HIDDEN_1_TEN_GOD = 'chart.natal.pillar.hour.hiddenStem.1.tenGod';
export const HOUR_HIDDEN_1_RELATION = 'chart.natal.pillar.hour.hiddenStem.1.tenGod.elementRelation';

/** S⁻: the hour branch's Seven Killing relation — the Ten-God fact and its element relation (contract 6.4 example). */
export const REMOVED_FACT_IDS = [HOUR_HIDDEN_1_TEN_GOD, HOUR_HIDDEN_1_RELATION] as const;
export const REMOVAL_REFERENCE = 'Jira ETBZ-59 comment 17034, PO decision D-59-1 (Anti-Boilerplate 77266967 v3, section 6.4)';

export const HOUR_H = { pressure: 'draft.hourPressure', expression: 'draft.hourExpression' } as const;

/** S: the hour branch repeats the month branch's controlling voice (Seven Killing on both). */
export function hourPressureClaim(): InterpretiveClaim {
  return {
    claimId: HOUR_H.pressure,
    statement: 'The controlling voice of the month branch sits, the same, inside the hour branch as well.',
    factRefs: [HOUR_HIDDEN_1_TEN_GOD, MONTH_HIDDEN_0_TEN_GOD, HOUR_HIDDEN_1_RELATION],
    themeRefs: [],
    methodRefs: ['ten_gods', 'fact_relations', 'wu_xing_relations'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'DEVELOPS', targetClaimId: PLAN_H.pressure }],
  };
}

/** N: the hour branch repeats the month pillar's expressive voice (Hurting Officer on both). */
export function hourExpressionClaim(): InterpretiveClaim {
  return {
    claimId: HOUR_H.expression,
    statement: 'The expressive voice of the month pillar sits, the same, inside the hour branch as well.',
    factRefs: [HOUR_HIDDEN_1_TEN_GOD, MONTH_TEN_GOD, HOUR_HIDDEN_1_RELATION],
    themeRefs: [],
    methodRefs: ['ten_gods', 'fact_relations', 'wu_xing_relations'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'DEVELOPS', targetClaimId: H.recurrence }],
  };
}

export function caseClaims(label: CaseLabel, model: HoroscopeModel): InterpretiveClaim[] {
  const base = planClaims(contextFor(model));
  if (label === 'source') return [...base, hourPressureClaim()];
  if (label === 'near') return [...base, hourExpressionClaim()];
  return base;
}

/** The plan draft of a case: the ETBZ-30B baseline, with the hour claim placed in its motif and chapter. */
export function casePlanDraft(label: CaseLabel, planContext: MetaNarrativePlanContext): MutablePlanDraft {
  const draft = validPlanDraft(planContext);
  const motif = (id: string): MutablePlanDraft['primaryMotifs'][number] => {
    const found = draft.primaryMotifs.find((candidate) => candidate.motifId === id);
    if (found === undefined) throw new Error(`etbz59: the baseline plan has no motif ${id}`);
    return found;
  };
  if (label === 'source') {
    const hour = idOf(hourPressureClaim(), planContext.graph);
    motif('motif.pressure').coreClaimRefs.push(hour);
    chapter(draft, 5).claimRefs.push(hour);
  }
  if (label === 'near') {
    const hour = idOf(hourExpressionClaim(), planContext.graph);
    motif('motif.expression').coreClaimRefs.push(hour);
    chapter(draft, 1).claimRefs.push(hour);
  }
  return draft;
}

/** The value of every fact the case's claims cite, read from the chart the drafts were written for. */
export function casePins(label: CaseLabel, model: HoroscopeModel): ReadonlyMap<string, string> {
  const values = new Map(deriveInterpretationFeatureSet(model).facts.map((fact) => [fact.id, canonicalJson(fact.value)]));
  const ids = [...new Set(caseClaims(label, model).flatMap((claim) => claim.factRefs))].sort();
  return new Map(ids.map((id) => [id, values.get(id) ?? 'MISSING']));
}

/**
 * The values the drafts were reviewed against: Musterkundin A's live chart for S and S⁻ (S⁻ cites a subset of S),
 * N's live chart for N. Recorded in the run record; a chart on which one differs is refused.
 */
export const REVIEWED_PINS: Readonly<Record<CaseLabel, Readonly<Record<string, string>>>> = {
  source: {
    'chart.dayMaster.stem': '"Xin"',
    'chart.natal.pillar.day.hiddenStem.0.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.hour.hiddenStem.1.tenGod': '"SevenKilling"',
    'chart.natal.pillar.hour.hiddenStem.1.tenGod.elementRelation': '"controls_day_master"',
    'chart.natal.pillar.month.hiddenStem.0.tenGod': '"SevenKilling"',
    'chart.natal.pillar.month.hiddenStem.0.tenGod.elementRelation': '"controls_day_master"',
    'chart.natal.pillar.month.hiddenStem.1.tenGod': '"IndirectRes"',
    'chart.natal.pillar.month.hiddenStem.1.tenGod.elementRelation': '"produces_day_master"',
    'chart.natal.pillar.month.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.month.tenGod.elementRelation': '"produced_by_day_master"',
    'chart.natal.pillar.year.hiddenStem.0.tenGod': '"SevenKilling"',
    'chart.natal.pillar.year.hiddenStem.1.tenGod': '"IndirectRes"',
    'chart.wuxing.dominant': '"Feuer"',
  },
  near: {
    'chart.dayMaster.stem': '"Xin"',
    'chart.natal.pillar.day.hiddenStem.0.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.hour.hiddenStem.1.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.hour.hiddenStem.1.tenGod.elementRelation': '"produced_by_day_master"',
    'chart.natal.pillar.month.hiddenStem.0.tenGod': '"SevenKilling"',
    'chart.natal.pillar.month.hiddenStem.0.tenGod.elementRelation': '"controls_day_master"',
    'chart.natal.pillar.month.hiddenStem.1.tenGod': '"IndirectRes"',
    'chart.natal.pillar.month.hiddenStem.1.tenGod.elementRelation': '"produces_day_master"',
    'chart.natal.pillar.month.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.month.tenGod.elementRelation': '"produced_by_day_master"',
    'chart.natal.pillar.year.hiddenStem.0.tenGod': '"SevenKilling"',
    'chart.natal.pillar.year.hiddenStem.1.tenGod': '"IndirectRes"',
    'chart.wuxing.dominant': '"Feuer"',
  },
  removal: {
    'chart.dayMaster.stem': '"Xin"',
    'chart.natal.pillar.day.hiddenStem.0.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.month.hiddenStem.0.tenGod': '"SevenKilling"',
    'chart.natal.pillar.month.hiddenStem.0.tenGod.elementRelation': '"controls_day_master"',
    'chart.natal.pillar.month.hiddenStem.1.tenGod': '"IndirectRes"',
    'chart.natal.pillar.month.hiddenStem.1.tenGod.elementRelation': '"produces_day_master"',
    'chart.natal.pillar.month.tenGod': '"HurtingOfficer"',
    'chart.natal.pillar.month.tenGod.elementRelation': '"produced_by_day_master"',
    'chart.natal.pillar.year.hiddenStem.0.tenGod': '"SevenKilling"',
    'chart.natal.pillar.year.hiddenStem.1.tenGod': '"IndirectRes"',
    'chart.wuxing.dominant': '"Feuer"',
  },
};

/** Refuses a chart on which a fact the case's drafts cite has another value than the one they were reviewed against. */
export function assertCasePinsHold(label: CaseLabel, model: HoroscopeModel): void {
  const live = casePins(label, model);
  const reviewed = REVIEWED_PINS[label];
  const keys = [...new Set([...live.keys(), ...Object.keys(reviewed)])].sort();
  const drifted = keys.filter((id) => live.get(id) !== reviewed[id]).map((id) => `${id}: reviewed ${reviewed[id] ?? 'absent'}, live ${live.get(id) ?? 'not cited'}`);
  if (drifted.length > 0) {
    throw new RehearsalError('REHEARSAL_DRAFT_FACTS_DRIFTED', `the ${label} drafts cite facts the chart answers differently: ${drifted.join('; ')}`);
  }
}

export interface CaseRun {
  readonly label: CaseLabel;
  readonly model: HoroscopeModel;
  readonly input: BazodiacInterpretationInput;
  readonly graph: InterpretiveClaimGraph;
  readonly plan: MetaNarrativePlan;
  readonly bundle: SkillContractBundle;
  readonly inputPackage: SkillInputPackage;
}

/** The chart of a case: S and N replayed from their live records; S⁻ withdrawn from S (D-59-1). */
export async function caseChart(label: CaseLabel, root: string = process.cwd()): Promise<ReplayedChart> {
  if (label === 'near') return variantChart('near', root);
  const source = await sourceChart(root);
  if (label === 'source') return source;
  const model = withdrawFactsForEvaluation(source.model, REMOVED_FACT_IDS, REMOVAL_REFERENCE);
  const input = buildBazodiacInterpretationInput(model, source.source, { mapper: fufireResponseMapper, attestation: loadRecordedRun(root).readback.attestation });
  return { model, input, source: source.source };
}

/** Offline and deterministic: the case's chart, claim graph, plan, the 1.1.0 bundle and the Skill input package. */
export async function deriveCase(label: CaseLabel, root: string = process.cwd()): Promise<CaseRun> {
  const { model, input } = await caseChart(label, root);
  assertCasePinsHold(label, model);
  const context = contextFor(model);
  const graph = buildInterpretiveClaimGraph(draftOf(caseClaims(label, model), context), context);
  const planContext: MetaNarrativePlanContext = { ...planContextFor(context, graph), contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 };
  const plan = buildMetaNarrativePlan(casePlanDraft(label, planContext), planContext);
  const bundle = buildSkillContractBundle(undefined, SKILL_CONTRACT_BUNDLE_VERSION_V1_1);
  const inputPackage = buildSkillInputPackage({
    bundle,
    input,
    graph,
    plan,
    subject: { displayName: model.displayName, birthTimeKnown: model.precision.birthTimeKnown },
    allowedSlotIds: listSlotIds(),
  });
  return { label, model, input, graph, plan, bundle, inputPackage };
}
