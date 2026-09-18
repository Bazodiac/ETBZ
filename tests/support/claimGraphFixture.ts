/**
 * ETBZ-30A — shared fixture for the InterpretiveClaimGraph suites.
 *
 * Every chart comes from the real `buildHoroscopeModel` fixtures and every brief
 * from the real `buildNarrativeChain`, so nothing here can drift from the chain
 * the graph is bound to. The draft claims are hand-written against the known
 * fixture chart; each one passes `validateInterpretiveClaim` on its own. Their
 * relations resolve only inside a draft that also contains the claim they name.
 *
 * `claimId` in a DRAFT is a handle: it only has to be unique inside the draft
 * and is what `relations[].targetClaimId` points at. The graph replaces it.
 */
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import type { ClaimGraphContext, InterpretiveClaimGraphDraft } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { BAZI_METHOD_REGISTRY_V1, METHOD_PROFILE_REF } from '../../src/application/interpretation/method-registry.js';
import { buildNarrativeChain } from '../../src/application/interpretation/narrative-brief.js';
import { knownTimeModel, unknownTimeModel } from './narrativeFixture.js';

export const MONTH_TEN_GOD = 'chart.natal.pillar.month.tenGod'; // HurtingOfficer, visible
export const MONTH_TEN_GOD_RELATION = 'chart.natal.pillar.month.tenGod.elementRelation';
export const DAY_HIDDEN_TEN_GOD = 'chart.natal.pillar.day.hiddenStem.0.tenGod'; // HurtingOfficer, hidden
export const DAY_MASTER_STEM = 'chart.dayMaster.stem';
export const HOUR_TEN_GOD = 'chart.natal.pillar.hour.tenGod';
export const DOMINANT = 'chart.wuxing.dominant';

export function contextFor(model: HoroscopeModel): ClaimGraphContext {
  return { model, brief: buildNarrativeChain(model).brief, registry: BAZI_METHOD_REGISTRY_V1 };
}

export const KNOWN = contextFor(knownTimeModel());
export const UNKNOWN = contextFor(unknownTimeModel());

export const H = {
  recurrence: 'draft.recurrence',
  relation: 'draft.relation',
  dayMaster: 'draft.dayMaster',
  dominant: 'draft.dominant',
} as const;

/** Two fact kinds, three methods: satisfies PD-5. */
export function recurrenceClaim(overrides: Partial<InterpretiveClaim> = {}): InterpretiveClaim {
  return {
    claimId: H.recurrence,
    statement: 'Expression shows on the surface of the month pillar and again inside the day branch.',
    factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD],
    themeRefs: [],
    methodRefs: ['ten_gods', 'fact_relations', 'positional_context'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [],
    ...overrides,
  };
}

/** Two fact kinds, two methods: satisfies PD-5. */
export function relationClaim(overrides: Partial<InterpretiveClaim> = {}): InterpretiveClaim {
  return {
    claimId: H.relation,
    statement: 'What the month pillar expresses is something the day master gives rise to.',
    factRefs: [MONTH_TEN_GOD, MONTH_TEN_GOD_RELATION],
    themeRefs: [],
    methodRefs: ['ten_gods', 'wu_xing_relations'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'SUPPORTS', targetClaimId: H.recurrence }],
    ...overrides,
  };
}

/** A valid claim on ONE fact kind and ONE method: below the PD-5 floor. */
export function dayMasterClaim(overrides: Partial<InterpretiveClaim> = {}): InterpretiveClaim {
  return {
    claimId: H.dayMaster,
    statement: 'The day master names the vantage point the rest of the chart is read from.',
    factRefs: [DAY_MASTER_STEM],
    themeRefs: [],
    methodRefs: ['day_master'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'QUALIFIES', targetClaimId: H.recurrence }],
    ...overrides,
  };
}

/** Certain on the known-time chart; its only fact is provisional under an unknown time. */
export function dominantClaim(overrides: Partial<InterpretiveClaim> = {}): InterpretiveClaim {
  return {
    claimId: H.dominant,
    statement: 'One element is named more often than the others in the tally the source reports.',
    factRefs: [DOMINANT],
    themeRefs: [],
    methodRefs: ['wu_xing_distribution'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [{ type: 'CONTRASTS_WITH', targetClaimId: H.dayMaster }],
    ...overrides,
  };
}

/** The same claim as it must be declared when the birth time is unknown. */
export function tentativeDominantClaim(overrides: Partial<InterpretiveClaim> = {}): InterpretiveClaim {
  return dominantClaim({
    epistemicClass: 'TENTATIVE_INTERPRETATION',
    provisionalFactRefs: [DOMINANT],
    ...overrides,
  });
}

export function baselineClaims(): InterpretiveClaim[] {
  return [recurrenceClaim(), relationClaim(), dayMasterClaim(), dominantClaim()];
}

export function draftOf(
  claims: readonly InterpretiveClaim[],
  context: ClaimGraphContext = KNOWN,
  overrides: Partial<InterpretiveClaimGraphDraft> = {},
): InterpretiveClaimGraphDraft {
  return {
    sourceBriefStructuralHash: context.brief.structuralHash,
    methodProfileRef: METHOD_PROFILE_REF,
    claims,
    ...overrides,
  };
}
