/**
 * ETBZ-34 (finding E) — provisionality is propagated GENERICALLY.
 *
 * Today FuFirE states `provisional_fields: ["hour"]` for an unknown birth time.
 * That is a statement about today's producer, not a law: FuFirE compares the
 * exact chart-local datetime with the Jie and Li-Chun boundaries, so on a
 * transition day the Month or Year Pillar also depends on the time of birth
 * (FUF-164 / FUF-165, amendment 2026-09-18). ETBZ must carry every pillar the
 * producer names — and must never decide on its own which day is a transition
 * day. These tests feed producer statements ETBZ has not seen yet.
 */
import { describe, expect, it } from 'vitest';
import { composeDeterministicNarrative } from '../../src/application/interpretation/deterministic-narrative-provider.js';
import { InterpretationError } from '../../src/application/interpretation/errors.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import type { InterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import {
  ClaimError,
  validateInterpretiveClaim,
} from '../../src/application/interpretation/interpretive-claim.js';
import type { ClaimValidationContext, InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { BAZI_METHOD_REGISTRY_V1, METHOD_PROFILE_REF } from '../../src/application/interpretation/method-registry.js';
import { buildNarrativeChain } from '../../src/application/interpretation/narrative-brief.js';
import { unknownTimeModel } from '../support/narrativeFixture.js';
import type { HoroscopeModel, PillarName } from '../../src/application/horoscope-model.js';

function modelWith(fields: readonly string[]): HoroscopeModel {
  return unknownTimeModel({
    bazi: { precision: { birthTimeKnown: false, provisionalFields: [...fields] } },
    natal: { precision: { birthTimeKnown: false, provisionalFields: [...fields] } },
    wuxing: { precision: { birthTimeKnown: false, provisionalFields: [...fields] } },
  });
}

function provisionalPillarsOf(featureSet: InterpretationFeatureSet): readonly (PillarName | null)[] {
  return [...new Set(featureSet.facts.filter((fact) => fact.provisional && fact.pillar !== null).map((fact) => fact.pillar))].sort();
}

function context(featureSet: InterpretationFeatureSet): ClaimValidationContext {
  return { registry: BAZI_METHOD_REGISTRY_V1, featureSet, methodProfileRef: METHOD_PROFILE_REF };
}

function claim(overrides: Partial<InterpretiveClaim>): InterpretiveClaim {
  return {
    claimId: 'claim.provisionality',
    statement: 'A grounded statement about this pillar.',
    factRefs: [],
    themeRefs: [],
    methodRefs: ['ten_gods'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    provisionalFactRefs: [],
    relations: [],
    ...overrides,
  };
}

describe('ETBZ-34 E1: the normal, non-transition fixture', () => {
  const featureSet = deriveInterpretationFeatureSet(modelWith(['hour']));

  it('marks ONLY the hour pillar provisional (plus Wu Xing, which sums all four pillars)', () => {
    expect(provisionalPillarsOf(featureSet)).toEqual(['hour']);
    expect(featureSet.provisionalPillars).toEqual(['hour']);
    const others = featureSet.facts.filter((fact) => fact.provisional && fact.pillar === null);
    expect(others.every((fact) => fact.kind === 'wu_xing_weight' || fact.kind === 'wu_xing_dominant')).toBe(true);
  });
});

describe.each([
  ['month', ['hour', 'month'], 'chart.natal.pillar.month.tenGod', 'chart.natal.pillar.year.tenGod'],
  ['year', ['hour', 'year'], 'chart.natal.pillar.year.tenGod', 'chart.natal.pillar.month.tenGod'],
] as const)('ETBZ-34 E2: a future producer marks %s provisional', (pillar, fields, affectedTenGod, unaffectedTenGod) => {
  const model = modelWith(fields);
  const featureSet = deriveInterpretationFeatureSet(model);

  it('makes EVERY fact derived from that pillar provisional, and keeps it interpretable', () => {
    const derived = featureSet.facts.filter((fact) => fact.pillar === pillar);
    expect(derived.length).toBeGreaterThan(8);
    expect(derived.every((fact) => fact.provisional)).toBe(true);
    // Provisional is not excluded: only the ASSUMED hour is non-interpretable.
    expect(derived.every((fact) => fact.interpretable && fact.exclusionReason === null)).toBe(true);
    expect(provisionalPillarsOf(featureSet)).toEqual([...fields].sort());
    expect(featureSet.provisionalFields).toEqual({ bazi: [...fields], natal: [...fields], wuxing: [...fields] });
  });

  it('leaves the pillars the producer did not name certain', () => {
    const untouched = featureSet.facts.filter((fact) => fact.pillar !== null && !(fields as readonly string[]).includes(fact.pillar));
    expect(untouched.length).toBeGreaterThan(0);
    expect(untouched.some((fact) => fact.provisional)).toBe(false);
  });

  if (pillar === 'month') {
    it('carries it into the month command, whose lineage is the month pillar', () => {
      const monthCommand = featureSet.facts.filter((fact) => fact.id.startsWith('chart.natal.monthCommand.'));
      expect(monthCommand.length).toBe(3);
      expect(monthCommand.every((fact) => fact.provisional)).toBe(true);
    });
  }

  it('keeps the assumed hour non-interpretable regardless', () => {
    const hour = featureSet.facts.filter((fact) => fact.pillar === 'hour');
    expect(hour.every((fact) => !fact.interpretable && fact.exclusionReason === 'ASSUMED_TIME_DERIVED' && fact.provisional)).toBe(true);
  });

  it('keeps Wu Xing provisional', () => {
    const wuxing = featureSet.facts.filter((fact) => fact.id.startsWith('chart.wuxing.'));
    expect(wuxing.length).toBe(6);
    expect(wuxing.every((fact) => fact.provisional)).toBe(true);
  });

  it('propagates into themes: every theme citing such a fact is flagged provisional', () => {
    const chain = buildNarrativeChain(model);
    const provisionalIds = new Set(featureSet.provisionalFactIds);
    const themes = [...chain.brief.candidateThemes, ...chain.brief.primaryThemes];
    const touching = themes.filter((theme) => theme.factIds.some((id) => provisionalIds.has(id)));
    expect(touching.some((theme) => theme.factIds.some((id) => id.includes(`.${pillar}.`)))).toBe(true);
    for (const theme of touching) {
      expect(theme.containsProvisionalFacts, theme.id).toBe(true);
      expect(theme.provisionalFactIds).toEqual(theme.factIds.filter((id) => provisionalIds.has(id)).sort());
    }
    // …and into the sections: a section over such a theme states the uncertainty.
    const output = composeDeterministicNarrative(chain.brief);
    for (const section of output.sections) {
      if (section.citedFacts.some((fact) => provisionalIds.has(fact.factId))) {
        expect(section.uncertaintyNotes.length, section.themeId).toBeGreaterThan(0);
      }
    }
  });

  it('propagates into claims: a claim on that pillar must be TENTATIVE with exact lineage', () => {
    const laundered = claim({ factRefs: [affectedTenGod], provisionalFactRefs: [affectedTenGod] });
    expect(() => validateInterpretiveClaim(laundered, context(featureSet))).toThrowError(ClaimError);
    try {
      validateInterpretiveClaim(laundered, context(featureSet));
    } catch (error) {
      expect((error as ClaimError).code).toBe('CLAIM_PROVISIONAL_LAUNDERED');
    }
    try {
      validateInterpretiveClaim(claim({ factRefs: [affectedTenGod], epistemicClass: 'TENTATIVE_INTERPRETATION' }), context(featureSet));
      expect.unreachable('lineage must be declared');
    } catch (error) {
      expect((error as ClaimError).code).toBe('CLAIM_PROVISIONAL_LINEAGE_MISMATCH');
    }
    expect(() =>
      validateInterpretiveClaim(
        claim({ factRefs: [affectedTenGod], provisionalFactRefs: [affectedTenGod], epistemicClass: 'TENTATIVE_INTERPRETATION' }),
        context(featureSet),
      ),
    ).not.toThrow();
  });

  it('leaves a claim on an unnamed pillar SUPPORTED (counterfactual)', () => {
    expect(() => validateInterpretiveClaim(claim({ factRefs: [unaffectedTenGod] }), context(featureSet))).not.toThrow();
  });
});

describe('ETBZ-34 E3: what ETBZ does not understand, it does not drop', () => {
  it('refuses a provisional field it cannot map to a pillar', () => {
    try {
      deriveInterpretationFeatureSet(modelWith(['hour', 'ascendant']));
      expect.unreachable('an unmapped provisional field must fail closed');
    } catch (error) {
      expect(error).toBeInstanceOf(InterpretationError);
      expect((error as InterpretationError).code).toBe('FEATURE_SET_PROVISIONAL_FIELD_UNMAPPED');
    }
  });

  it('takes the UNION when BaZi and Natal disagree — never the narrower statement', () => {
    const model = unknownTimeModel({
      bazi: { precision: { birthTimeKnown: false, provisionalFields: ['hour', 'month'] } },
    });
    const featureSet = deriveInterpretationFeatureSet(model);
    expect(featureSet.provisionalPillars).toEqual(['month', 'hour']);
    expect(featureSet.provisionalFields).toEqual({ bazi: ['hour', 'month'], natal: ['hour'], wuxing: ['hour'] });
  });

  it("understands the Wu-Xing endpoint's OWN statement: a pillar only IT names still propagates", () => {
    const model = unknownTimeModel({
      wuxing: { precision: { birthTimeKnown: false, provisionalFields: ['hour', 'year'] } },
    });
    const featureSet = deriveInterpretationFeatureSet(model);
    expect(featureSet.provisionalPillars).toEqual(['year', 'hour']);
    expect(featureSet.facts.filter((fact) => fact.pillar === 'year').every((fact) => fact.provisional)).toBe(true);
    expect(featureSet.facts.filter((fact) => fact.pillar === 'month').some((fact) => fact.provisional)).toBe(false);
  });
});
