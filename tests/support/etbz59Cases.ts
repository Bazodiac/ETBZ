/**
 * ETBZ-59 — the three drafted cases of the Anti-Boilerplate fixture rehearsal, built through the ordinary chain up
 * to the Skill input package (contract 77266967 v3, section 8; Jira ETBZ-59 comment 17034).
 *
 * The drafts are the Delivery Runner's (the drafter of ADR 0008; D-53-4 applied to the rehearsal) and are reviewed
 * by an independent instance before any reading. They reuse the ETBZ-30A/30B claims of Musterkundin A; the
 * distribution claim cites the five Wu Xing weights it describes, and one claim on the hour pillar is added (PO
 * decision D-59-2). Independent draft review round 1 (2026-10-02): FAIL on the distribution claim, which was false
 * on N's tied tally, plus a major and minors; this text is the repair.
 *
 * - source (S, Musterkundin A): the hour branch's hidden stems repeat the month branch's controlling Ten-God voice
 *   (Seven Killing); the claim is local - named in the chapter that develops the pressure motif, in no core.
 * - near (N, the hour-pillar variant): the hour branch's hidden stems repeat the month pillar's expressive Ten-God
 *   voice (Hurting Officer) instead; local in the chapter that reinforces the expression motif. Its tally ties
 *   (Feuer 3, Metall 3): N's distribution claim names two elements at the top and does not contrast with the day
 *   master, whose element is one of them.
 * - removal (S⁻): S with the hour branch's Seven Killing relation withdrawn (`withdrawFactsForEvaluation`, D-59-1);
 *   the hour claim cannot be drafted, the rest is S's.
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
import { DOMINANT, H, MONTH_TEN_GOD, MONTH_TEN_GOD_RELATION, contextFor, dayMasterClaim, dominantClaim, draftOf, recurrenceClaim, relationClaim } from './claimGraphFixture.js';
import { RehearsalError, loadRecordedRun } from './etbz58Rehearsal.js';
import { M, MONTH_HIDDEN_0_RELATION, MONTH_HIDDEN_0_TEN_GOD, PLAN_H, T, idOf, planClaims, planContextFor, pressureClaim, resourceClaim } from './metaNarrativePlanFixture.js';
import type { MutablePlanDraft } from './metaNarrativePlanFixture.js';
import { ETBZ59_DIR, sourceChart, variantChart } from './etbz59Variants.js';
import type { ReplayedChart } from './etbz59Variants.js';

export const CASE_LABELS = ['source', 'near', 'removal'] as const;
export type CaseLabel = (typeof CASE_LABELS)[number];

export const HOUR_HIDDEN_1_TEN_GOD = 'chart.natal.pillar.hour.hiddenStem.1.tenGod';
export const HOUR_HIDDEN_1_RELATION = 'chart.natal.pillar.hour.hiddenStem.1.tenGod.elementRelation';

/** S⁻: the hour branch's Seven Killing relation — the Ten-God fact and its element relation (contract 6.4 example). */
export const REMOVED_FACT_IDS = [HOUR_HIDDEN_1_TEN_GOD, HOUR_HIDDEN_1_RELATION] as const;
export const REMOVAL_REFERENCE = 'Jira ETBZ-59 comment 17034, PO decision D-59-1 (Anti-Boilerplate 77266967 v3, section 6.4)';

export const HOUR_H = { pressure: 'draft.hourPressure', expression: 'draft.hourExpression' } as const;

/** The five Wu Xing weights: the tally the distribution claims describe (contract section 3 names it a feature). */
export const WEIGHT_IDS = ['Erde', 'Feuer', 'Holz', 'Metall', 'Wasser'].map((element) => `chart.wuxing.weight.${element}`);

/**
 * S: the hour branch's hidden stems repeat the month branch's controlling Ten-God voice (Seven Killing on both, each
 * `controls_day_master`). It names no layer, Qi role or parity (review finding F4): only the recurrence.
 */
export function hourPressureClaim(): InterpretiveClaim {
  return {
    claimId: HOUR_H.pressure,
    statement: 'The controlling Ten-God voice of the month branch recurs among the hidden stems of the hour branch.',
    factRefs: [HOUR_HIDDEN_1_TEN_GOD, MONTH_HIDDEN_0_TEN_GOD, HOUR_HIDDEN_1_RELATION, MONTH_HIDDEN_0_RELATION],
    themeRefs: [],
    methodRefs: ['ten_gods', 'fact_relations', 'wu_xing_relations'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'DEVELOPS', targetClaimId: PLAN_H.pressure }],
  };
}

/** N: the hour branch's hidden stems repeat the month pillar's expressive Ten-God voice (Hurting Officer on both). */
export function hourExpressionClaim(): InterpretiveClaim {
  return {
    claimId: HOUR_H.expression,
    statement: 'The expressive Ten-God voice of the month pillar recurs among the hidden stems of the hour branch.',
    factRefs: [HOUR_HIDDEN_1_TEN_GOD, MONTH_TEN_GOD, HOUR_HIDDEN_1_RELATION, MONTH_TEN_GOD_RELATION],
    themeRefs: [],
    methodRefs: ['ten_gods', 'fact_relations', 'wu_xing_relations'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'SUPPORTS', targetClaimId: H.recurrence }],
  };
}

/**
 * S and S⁻: the ETBZ-30A distribution claim, now citing the five weights its statement is about (review finding
 * F1): "named more often than the others" is a statement about the whole tally, so the tally is pinned and in the
 * dependency cone. True on S: one maximum (Feuer 2.5).
 */
export function tallyClaim(): InterpretiveClaim {
  return dominantClaim({ statement: TALLY_STATEMENT, factRefs: [DOMINANT, ...WEIGHT_IDS] });
}

/**
 * Review round 2 (G1): the ETBZ-30A wording "named more often than the others" counts mentions, which on S tie
 * (Feuer, Erde and Holz three times each in FuFirE's ledger); the cited facts are weights, and by weight Feuer is the
 * one maximum (2.5).
 */
export const TALLY_STATEMENT = 'One element carries more weight than any other in the tally the source reports.';

/**
 * N: the tally ties (Feuer 3, Metall 3). FuFirE names one of the tied maxima dominant, which ETBZ allows; the Method
 * Profile's `wu_xing_distribution` names all tied maxima. So N's claim is a different statement over the weights,
 * without the single dominant, and without the day-master contrast: the day master's own element shares the top.
 */
export function tieClaim(): InterpretiveClaim {
  return {
    claimId: H.dominant,
    statement: 'Two elements share the highest weight in the tally the source reports.',
    factRefs: [...WEIGHT_IDS],
    themeRefs: [],
    methodRefs: ['wu_xing_distribution'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [],
  };
}

export function caseClaims(label: CaseLabel, model: HoroscopeModel): InterpretiveClaim[] {
  const base = planClaims(contextFor(model)).map((claim) => (claim.claimId === H.dominant ? (label === 'near' ? tieClaim() : tallyClaim()) : claim));
  if (label === 'source') return [...base, hourPressureClaim()];
  if (label === 'near') return [...base, hourExpressionClaim()];
  return base;
}

/**
 * The plan draft of a case: the ETBZ-30B baseline (`validPlanDraft`: thesis, three motifs, threads, seven chapters),
 * written out here because the distribution claim differs per case. The hour claim stays local - it is named in one
 * chapter and in no motif core or thesis (review finding F2: it carries no central weight). N's tie claim does not
 * contrast with the day master, so N drops that tension.
 */
export function casePlanDraft(label: CaseLabel, planContext: MetaNarrativePlanContext): MutablePlanDraft {
  const graph = planContext.graph;
  const c = {
    recurrence: idOf(recurrenceClaim(), graph),
    relation: idOf(relationClaim(), graph),
    dayMaster: idOf(dayMasterClaim(), graph),
    tally: idOf(label === 'near' ? tieClaim() : tallyClaim(), graph),
    pressure: idOf(pressureClaim(), graph),
    resource: idOf(resourceClaim(), graph),
  };
  const hour = label === 'source' ? [idOf(hourPressureClaim(), graph)] : label === 'near' ? [idOf(hourExpressionClaim(), graph)] : [];
  return {
    sourceBriefStructuralHash: planContext.brief.structuralHash,
    claimGraphStructuralHash: graph.structuralHash,
    reportThesis: { claimRefs: [c.recurrence, c.pressure] },
    primaryMotifs: [
      { motifId: M.expression, coreClaimRefs: [c.recurrence, c.relation] },
      { motifId: M.pressure, coreClaimRefs: [c.pressure] },
      { motifId: M.resource, coreClaimRefs: [c.resource] },
    ],
    tensions: [
      { claimRefs: [c.pressure, c.recurrence] },
      { claimRefs: [c.pressure, c.resource] },
      ...(label === 'near' ? [] : [{ claimRefs: [c.tally, c.dayMaster] }]),
    ],
    openThreads: [
      { threadId: T.pressure, claimRefs: [c.pressure, c.recurrence], resolution: 'CLOSE' },
      { threadId: T.resource, claimRefs: [c.resource], resolution: 'LEAVE_OPEN' },
    ],
    chapterPlan: [
      { narrativeOperation: 'ESTABLISH', claimRefs: [c.dayMaster, c.recurrence], motifTransitions: [{ motifRef: M.expression, toState: 'SEEDED' }], opensThreadRefs: [], closesThreadRefs: [] },
      { narrativeOperation: 'REINFORCE', claimRefs: [c.relation, ...(label === 'near' ? hour : [])], motifTransitions: [{ motifRef: M.expression, toState: 'DEVELOPED' }], opensThreadRefs: [], closesThreadRefs: [] },
      {
        narrativeOperation: 'CONTRAST',
        claimRefs: [c.pressure, c.recurrence],
        motifTransitions: [{ motifRef: M.pressure, toState: 'SEEDED' }, { motifRef: M.expression, toState: 'COMPLICATED' }],
        opensThreadRefs: [T.pressure],
        closesThreadRefs: [],
      },
      { narrativeOperation: 'CONTEXTUALIZE', claimRefs: [c.tally, c.resource], motifTransitions: [{ motifRef: M.resource, toState: 'SEEDED' }], opensThreadRefs: [T.resource], closesThreadRefs: [] },
      // Review round 2 (G2): on N the tally and the day master share no stated relation, so a QUALIFY chapter over
      // them could only repeat itself or invent a link; N's plan has no such chapter.
      ...(label === 'near' ? [] : [{ narrativeOperation: 'QUALIFY' as const, claimRefs: [c.dayMaster, c.tally], motifTransitions: [], opensThreadRefs: [], closesThreadRefs: [] }]),
      {
        narrativeOperation: 'CONTRAST',
        claimRefs: [c.pressure, c.resource, ...(label === 'source' ? hour : [])],
        motifTransitions: [{ motifRef: M.pressure, toState: 'DEVELOPED' }, { motifRef: M.resource, toState: 'DEVELOPED' }],
        opensThreadRefs: [],
        closesThreadRefs: [],
      },
      {
        narrativeOperation: 'INTEGRATE',
        claimRefs: [c.pressure, c.recurrence, c.relation],
        motifTransitions: [{ motifRef: M.expression, toState: 'INTEGRATED' }, { motifRef: M.pressure, toState: 'INTEGRATED' }],
        opensThreadRefs: [],
        closesThreadRefs: [T.pressure],
      },
    ],
  };
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
    'chart.wuxing.weight.Erde': '"2"',
    'chart.wuxing.weight.Feuer': '"2.5"',
    'chart.wuxing.weight.Holz': '"1.8"',
    'chart.wuxing.weight.Metall': '"2"',
    'chart.wuxing.weight.Wasser': '"2"',
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
    'chart.wuxing.weight.Erde': '"1.3"',
    'chart.wuxing.weight.Feuer': '"3"',
    'chart.wuxing.weight.Holz': '"0.5"',
    'chart.wuxing.weight.Metall': '"3"',
    'chart.wuxing.weight.Wasser': '"2.5"',
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
    'chart.wuxing.weight.Erde': '"2"',
    'chart.wuxing.weight.Feuer': '"2.5"',
    'chart.wuxing.weight.Holz': '"1.8"',
    'chart.wuxing.weight.Metall': '"2"',
    'chart.wuxing.weight.Wasser': '"2"',
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

export const caseFile = (label: CaseLabel, name: 'skill-input' | 'semantic-reading' | 'skill-reading' | 'accepted-reading'): string => `${ETBZ59_DIR}/cases/${label}/${name}.json`;

export const ETBZ59_CONES = `${ETBZ59_DIR}/pre-run-cones.json`;

/**
 * Terms whose presence in the removal reading makes a passage a model-memory-rescue CANDIDATE (contract 6.4): the
 * withdrawn relation's values and labels, and the hour position, through which the residual facts of the same
 * hidden stem (Ding, fire, central Qi - still interpretable) offer a re-derivation path. Candidates only; the
 * independent judgement decides `MODEL_MEMORY_RESCUE`.
 */
export const RESCUE_SUBJECT_TERMS = ['SevenKilling', 'Seven Killing', 'Druck / Struktur', 'Druck', 'Qi Sha', '七杀', 'Ding', '丁', 'kontrollierend', 'kontrollierende', 'Kontrolle'] as const;
/** The withdrawn relation's position: the hour branch (draft review round 3, H1: co-occurrence, whole words). */
export const RESCUE_POSITION_TERMS = ['Stunde', 'Stunden', 'Stundenzweig', 'Stundensäule', 'Stundenpfeiler', 'Wei', '未', 'wèi', 'Ziege'] as const;
export const RESCUE_TERMS_WHY = 'withdrawn: chart.natal.pillar.hour.hiddenStem.1.tenGod (SevenKilling, label "Druck / Struktur") and its element relation (controls_day_master); residual and interpretable: the same hidden stem Ding (fire, central Qi) in the hour branch Wei - the re-derivation path the draft review named (F7). A candidate names a subject term together with a position term, each as a whole word; the month and year branches legitimately keep the same Ten God.';

/** Terms that, in N's reading, would name one leading element although N's tally ties (review round 2, G3). */
export const NEAR_CONTRADICTION_TERMS = ['Feuer dominiert', 'dominierende', 'dominante', 'vorherrschend', 'führende Wandlungsphase', 'führende Phase', 'führt Feuer', 'Feuer führt', 'überwiegt', 'mehr Gewicht', 'am meisten Raum', 'am deutlichsten vertreten', 'Keine andere Wandlungsphase'] as const;
