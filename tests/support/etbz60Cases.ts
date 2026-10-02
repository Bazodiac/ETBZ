/**
 * ETBZ-60 — the round-2 drafts of S and N (PO decision D-60-1, Jira ETBZ-60 comment 17050): ETBZ-59's drafts plus one
 * distribution claim over what the four pillars show on their surface.
 *
 * Why: the plan's thesis rests on a surface/interior contrast (the expressive voice on the month stem, the
 * controlling voice in the branches), but its claims cite the surface of the month pillar only. Round 1 showed the
 * Skill summarising that contrast over the whole chart ("Was nach außen erscheint, ist der Ausdruck"): its control
 * half held for S and failed for N, whose hour stem (DirectOfficer) controls the day master, and its expression half
 * held for neither (the year and hour stems show other voices) - no claim cited any of it, so the reading could not
 * respond to the named difference. The distribution claim cites every pillar's visible Ten-God
 * fact and its relation to the day master (Lens section 14: visible-vs-hidden distribution is an authorised
 * feature), so the surface the contrast speaks of is grounded and differs where the charts differ.
 *
 * The ETBZ-59 drafts (`etbz59Cases.ts`) are unchanged: they are the evidence of the ETBZ-59 runs and of round 1.
 */
import { canonicalJson } from '../../src/domain/canonical-json.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { PLAN_CONTRACT_BINDINGS_V1_1, buildMetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlanContext } from '../../src/application/interpretation/meta-narrative-plan.js';
import { SKILL_CONTRACT_BUNDLE_VERSION_V1_1, buildSkillContractBundle, buildSkillInputPackage } from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { contextFor, draftOf } from './claimGraphFixture.js';
import { RehearsalError } from './etbz58Rehearsal.js';
import { REVIEWED_PINS, caseChart, caseClaims, casePlanDraft } from './etbz59Cases.js';
import type { CaseRun } from './etbz59Cases.js';
import { PLAN_H, idOf, planContextFor } from './metaNarrativePlanFixture.js';
import type { MutablePlanDraft } from './metaNarrativePlanFixture.js';

export const ROUND2_LABELS = ['source', 'near'] as const;
export type Round2Label = (typeof ROUND2_LABELS)[number];

export const SURFACE_CLAIM_ID = 'draft.surface';

/** Every pillar's visible surface: the year, month and hour stems' Ten-God voices with their relations, and the day stem, which is the day master. */
export const SURFACE_FACT_IDS = [
  'chart.natal.pillar.year.tenGod',
  'chart.natal.pillar.year.tenGod.elementRelation',
  'chart.natal.pillar.month.tenGod',
  'chart.natal.pillar.month.tenGod.elementRelation',
  'chart.dayMaster.stem',
  'chart.natal.pillar.hour.tenGod',
  'chart.natal.pillar.hour.tenGod.elementRelation',
] as const;

/**
 * What the surface shows, pillar by pillar (draft review round 1, F1: a statement over the controlling voice alone
 * left "what shows outside is the expression" ungrounded - the year and hour stems show other voices). S has no
 * visible stem that controls the day master; N has one, the hour stem.
 */
export const SURFACE_STATEMENTS: Readonly<Record<Round2Label, string>> = {
  source: 'On the surface of the four pillars the year stem carries a voice of the same element as the day master, the month stem the expressive voice the day master produces, the day stem is the day master itself, and the hour stem a voice the day master controls; no visible stem controls the day master.',
  near: 'On the surface of the four pillars the year stem carries a voice of the same element as the day master, the month stem the expressive voice the day master produces, the day stem is the day master itself, and the hour stem a voice that controls the day master; it is the only visible stem that does.',
};

export function surfaceClaim(label: Round2Label): InterpretiveClaim {
  return {
    claimId: SURFACE_CLAIM_ID,
    statement: SURFACE_STATEMENTS[label],
    factRefs: [...SURFACE_FACT_IDS],
    themeRefs: [],
    methodRefs: ['day_master', 'ten_gods', 'wu_xing_relations'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'CONTEXTUALIZES', targetClaimId: PLAN_H.pressure }],
  };
}

export function round2Claims(label: Round2Label, model: HoroscopeModel): InterpretiveClaim[] {
  return [...caseClaims(label, model), surfaceClaim(label)];
}

/**
 * ETBZ-59's plan with the distribution claim placed where the surface/interior contrast is rendered: the CONTRAST
 * chapter that renders both thesis claims (it seeds the pressure motif against the expressive voice), and the
 * INTEGRATE chapter that closes it. Chosen by content, not by position (draft review round 1, F4); a plan without
 * either chapter is refused, never silently left without the claim.
 */
export function round2PlanDraft(label: Round2Label, planContext: MetaNarrativePlanContext): MutablePlanDraft {
  const base = casePlanDraft(label, planContext);
  const surface = idOf(surfaceClaim(label), planContext.graph);
  const thesis = base.reportThesis.claimRefs;
  const contrastIndex = base.chapterPlan.findIndex((chapter) => chapter.narrativeOperation === 'CONTRAST' && thesis.every((id) => chapter.claimRefs.includes(id)));
  const integrateIndex = base.chapterPlan.findIndex((chapter) => chapter.narrativeOperation === 'INTEGRATE');
  if (contrastIndex < 0 || integrateIndex < 0) throw new RehearsalError('REHEARSAL_DRAFT_PLAN_SHAPE', `the round-2 ${label} plan has no CONTRAST chapter over the thesis or no INTEGRATE chapter for the surface claim`);
  return {
    ...base,
    chapterPlan: base.chapterPlan.map((chapter, index) => (index === contrastIndex || index === integrateIndex ? { ...chapter, claimRefs: [...chapter.claimRefs, surface] } : chapter)),
  };
}

/** ETBZ-59's reviewed pins plus the surface facts, at the values the round-2 drafts were reviewed against. */
export const ROUND2_PINS: Readonly<Record<Round2Label, Readonly<Record<string, string>>>> = {
  source: {
    ...REVIEWED_PINS.source,
    'chart.natal.pillar.year.tenGod': '"RobWealth"',
    'chart.natal.pillar.year.tenGod.elementRelation': '"same_element"',
    'chart.natal.pillar.hour.tenGod': '"IndirectWealth"',
    'chart.natal.pillar.hour.tenGod.elementRelation': '"controlled_by_day_master"',
  },
  near: {
    ...REVIEWED_PINS.near,
    'chart.natal.pillar.year.tenGod': '"RobWealth"',
    'chart.natal.pillar.year.tenGod.elementRelation': '"same_element"',
    'chart.natal.pillar.hour.tenGod': '"DirectOfficer"',
    'chart.natal.pillar.hour.tenGod.elementRelation': '"controls_day_master"',
  },
};

export function assertRound2PinsHold(label: Round2Label, model: HoroscopeModel): void {
  const values = new Map(deriveInterpretationFeatureSet(model).facts.map((fact) => [fact.id, canonicalJson(fact.value)]));
  const cited = [...new Set(round2Claims(label, model).flatMap((claim) => claim.factRefs))].sort();
  const reviewed = ROUND2_PINS[label];
  const keys = [...new Set([...cited, ...Object.keys(reviewed)])].sort();
  const drifted = keys.filter((id) => (cited.includes(id) ? values.get(id) : undefined) !== reviewed[id]).map((id) => `${id}: reviewed ${reviewed[id] ?? 'absent'}, live ${values.get(id) ?? 'not cited'}`);
  if (drifted.length > 0) throw new RehearsalError('REHEARSAL_DRAFT_FACTS_DRIFTED', `the round-2 ${label} drafts cite facts the chart answers differently: ${drifted.join('; ')}`);
}

/** Offline and deterministic: the round-2 case through the ordinary chain to the Skill input package. */
export async function deriveRound2Case(label: Round2Label, root: string = process.cwd()): Promise<CaseRun> {
  const { model, input } = await caseChart(label, root);
  assertRound2PinsHold(label, model);
  const context = contextFor(model);
  const graph = buildInterpretiveClaimGraph(draftOf(round2Claims(label, model), context), context);
  const planContext: MetaNarrativePlanContext = { ...planContextFor(context, graph), contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 };
  const plan = buildMetaNarrativePlan(round2PlanDraft(label, planContext), planContext);
  const bundle = buildSkillContractBundle(undefined, SKILL_CONTRACT_BUNDLE_VERSION_V1_1);
  const inputPackage = buildSkillInputPackage({ bundle, input, graph, plan, subject: { displayName: model.displayName, birthTimeKnown: model.precision.birthTimeKnown }, allowedSlotIds: listSlotIds() });
  return { label, model, input, graph, plan, bundle, inputPackage };
}
