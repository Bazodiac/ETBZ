/**
 * ETBZ-34 / ETBZ-30 prerequisite — InterpretiveClaim.methodRefs (PD-6), the
 * assumed-hour exclusion (PD-10), the Wu-Xing unknown-time guard (F-1) and the
 * multi-signal floor (PD-5). Positive, negative and counterfactual.
 */
import { describe, expect, it } from 'vitest';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import {
  ClaimError,
  assertCentralClaimSignals,
  interpretiveClaimStructuralHash,
  validateInterpretiveClaim,
} from '../../src/application/interpretation/interpretive-claim.js';
import type {
  ClaimErrorCode,
  ClaimValidationContext,
  InterpretiveClaim,
} from '../../src/application/interpretation/interpretive-claim.js';
import { BAZI_METHOD_REGISTRY_V1, METHOD_PROFILE_REF } from '../../src/application/interpretation/method-registry.js';
import { knownTimeModel, unknownTimeModel } from '../support/narrativeFixture.js';

const KNOWN: ClaimValidationContext = {
  registry: BAZI_METHOD_REGISTRY_V1,
  featureSet: deriveInterpretationFeatureSet(knownTimeModel()),
  methodProfileRef: METHOD_PROFILE_REF,
};
const UNKNOWN: ClaimValidationContext = {
  registry: BAZI_METHOD_REGISTRY_V1,
  featureSet: deriveInterpretationFeatureSet(unknownTimeModel()),
  methodProfileRef: METHOD_PROFILE_REF,
};

const MONTH_TEN_GOD = 'chart.natal.pillar.month.tenGod'; // HurtingOfficer, visible
const DAY_HIDDEN_TEN_GOD = 'chart.natal.pillar.day.hiddenStem.0.tenGod'; // HurtingOfficer, hidden
const YEAR_HIDDEN_TEN_GOD = 'chart.natal.pillar.year.hiddenStem.0.tenGod'; // SevenKilling
const HOUR_TEN_GOD = 'chart.natal.pillar.hour.tenGod';
const DOMINANT = 'chart.wuxing.dominant';

function claim(overrides: Partial<InterpretiveClaim> = {}): InterpretiveClaim {
  return {
    claimId: 'claim.test',
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

function expectRefusal(code: ClaimErrorCode, candidate: InterpretiveClaim, context = KNOWN): void {
  try {
    validateInterpretiveClaim(candidate, context);
  } catch (error) {
    expect(error).toBeInstanceOf(ClaimError);
    expect((error as ClaimError).code, (error as ClaimError).message).toBe(code);
    return;
  }
  expect.unreachable(`expected the claim to be refused with ${code}`);
}

describe('ETBZ-34 M1: fact -> approved method -> interpretation is traceable', () => {
  it('accepts a claim whose every fact and every method are accounted for', () => {
    const cited = validateInterpretiveClaim(claim(), KNOWN);
    expect(cited.map((fact) => fact.id).sort()).toEqual([DAY_HIDDEN_TEN_GOD, MONTH_TEN_GOD].sort());
  });

  it('accepts a source-supplied day-master relation (Sheng/Ke state A)', () => {
    validateInterpretiveClaim(claim({
      factRefs: [MONTH_TEN_GOD, 'chart.natal.pillar.month.tenGod.elementRelation'],
      methodRefs: ['ten_gods', 'wu_xing_relations'],
    }), KNOWN);
  });

  it('puts methodRefs and the profile reference inside the claim hash (I6)', () => {
    const base = interpretiveClaimStructuralHash(claim(), METHOD_PROFILE_REF);
    expect(interpretiveClaimStructuralHash(claim(), METHOD_PROFILE_REF)).toBe(base);
    expect(interpretiveClaimStructuralHash(claim({ methodRefs: ['ten_gods', 'fact_relations'] }), METHOD_PROFILE_REF)).not.toBe(base);
    expect(interpretiveClaimStructuralHash(claim(), 'bazi-method-profile@9.9.9')).not.toBe(base);
    // Order is not meaning.
    expect(interpretiveClaimStructuralHash(claim({ methodRefs: ['positional_context', 'fact_relations', 'ten_gods'] }), METHOD_PROFILE_REF)).toBe(base);
  });
});

describe('ETBZ-34 M2: methodRefs fail closed (I1–I5)', () => {
  it('refuses a claim with no method', () => {
    expectRefusal('CLAIM_METHOD_REFS_MISSING', claim({ methodRefs: [] }));
  });
  it('refuses a duplicate method reference', () => {
    expectRefusal('CLAIM_DUPLICATE_METHOD_REF', claim({ methodRefs: ['ten_gods', 'ten_gods'] }));
  });
  it('refuses a method the profile does not know', () => {
    expectRefusal('CLAIM_METHOD_UNKNOWN', claim({ methodRefs: ['general_bazi_knowledge'] }));
  });
  it.each(['day_master_strength', 'rooting', 'useful_god', 'branch_clashes', 'luck_pillars_da_yun', 'western_astrology', 'fusion'])(
    'refuses a claim that relies on %s — existing is not being available', (methodId) => {
      expectRefusal('CLAIM_METHOD_NOT_APPROVED', claim({ methodRefs: ['ten_gods', methodId] }));
    },
  );
  it('refuses a policy / carrier method as claim ground', () => {
    expectRefusal('CLAIM_METHOD_NOT_CLAIM_BEARING', claim({ methodRefs: ['ten_gods', 'four_pillars'] }));
  });
  it('refuses a method named without any fact it may read (I2)', () => {
    expectRefusal('CLAIM_METHOD_WITHOUT_EVIDENCE', claim({ methodRefs: ['ten_gods', 'wu_xing_distribution'] }));
  });
  it('refuses a cited fact none of the methods may read (I3)', () => {
    expectRefusal('CLAIM_ORPHAN_FACT', claim({ factRefs: [MONTH_TEN_GOD, DOMINANT], methodRefs: ['ten_gods'] }));
  });
  it('does not let the positional modifier legitimise an orphan fact (I3)', () => {
    expectRefusal('CLAIM_ORPHAN_FACT', claim({
      factRefs: [MONTH_TEN_GOD, 'chart.pillar.year.stem'],
      methodRefs: ['ten_gods', 'positional_context'],
    }));
  });
  it('refuses fact_relations when no two cited facts are identical (I2)', () => {
    expectRefusal('CLAIM_METHOD_WITHOUT_EVIDENCE', claim({
      factRefs: [MONTH_TEN_GOD, 'chart.pillar.year.stem'],
      methodRefs: ['ten_gods', 'fact_relations'],
    }));
  });
  it('does not let fact_relations legitimise a third, non-identical fact (I3)', () => {
    expectRefusal('CLAIM_ORPHAN_FACT', claim({
      factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, 'chart.pillar.year.stem'],
      methodRefs: ['ten_gods', 'fact_relations'],
    }));
  });
  it('refuses a claim resting on a modifier alone (I5)', () => {
    expectRefusal('CLAIM_MODIFIER_ALONE', claim({ methodRefs: ['positional_context'] }));
  });
  it('refuses a raw payload path used as factRef (AF-1)', () => {
    expectRefusal('CLAIM_UNKNOWN_FACT', claim({ factRefs: ['fufire.natal_raw.pillars.month.ten_god.element_relation'] }));
  });
  it('refuses a claim grounded by themeRefs only', () => {
    expectRefusal('CLAIM_UNGROUNDED', claim({ factRefs: [], themeRefs: ['theme.tenGod.HurtingOfficer'] }));
  });
  it('refuses a relation outside the closed vocabulary', () => {
    expectRefusal('CLAIM_UNKNOWN_RELATION', claim({
      relations: [{ type: 'CLASHES_WITH' as never, targetClaimId: 'claim.other' }],
    }));
  });
  it('refuses validation against a different profile version', () => {
    expectRefusal('CLAIM_PROFILE_MISMATCH', claim(), { ...KNOWN, methodProfileRef: 'bazi-method-profile@1.0.0-rc.3' });
  });
  it('refuses a method that is not enabled for THIS chart (I4, counterfactual)', () => {
    const drifted: ClaimValidationContext = {
      ...KNOWN,
      featureSet: deriveInterpretationFeatureSet(
        knownTimeModel({ natal: { monthCommand: { principalQiStem: 'Ji', principalQiStemCn: '己', element: 'earth' } } }),
      ),
    };
    const monthClaim = claim({
      factRefs: ['chart.natal.monthCommand.branch', 'chart.natal.monthCommand.principalQiStem'],
      methodRefs: ['month_command'],
    });
    validateInterpretiveClaim(monthClaim, KNOWN);
    expectRefusal('CLAIM_METHOD_NOT_ENABLED', monthClaim, drifted);
  });
});

describe('ETBZ-34 M3: unknown birth time — PD-10 exclusion and F-1 Wu-Xing guard', () => {
  it('accepts an hour-pillar claim when the birth time is KNOWN', () => {
    validateInterpretiveClaim(claim({ factRefs: [HOUR_TEN_GOD], methodRefs: ['ten_gods'] }), KNOWN);
  });

  it('refuses the SAME claim when the birth time is unknown — not even as TENTATIVE (counterfactual)', () => {
    const hourClaim = claim({
      factRefs: [HOUR_TEN_GOD],
      methodRefs: ['ten_gods'],
      epistemicClass: 'TENTATIVE_INTERPRETATION',
      provisionalFactRefs: [HOUR_TEN_GOD],
    });
    expectRefusal('CLAIM_EXCLUDED_FACT_CITED', hourClaim, UNKNOWN);
  });

  it('keeps year / month / day claims SUPPORTED under unknown time (boundary=midnight, UT-7)', () => {
    const cited = validateInterpretiveClaim(claim(), UNKNOWN);
    expect(cited.every((fact) => !fact.provisional)).toBe(true);
  });

  it('accepts a Wu-Xing claim as SUPPORTED when the time is known', () => {
    validateInterpretiveClaim(claim({ factRefs: [DOMINANT], methodRefs: ['wu_xing_distribution'] }), KNOWN);
  });

  it('refuses the SAME Wu-Xing claim as SUPPORTED when the time is unknown (F-1)', () => {
    expectRefusal('CLAIM_PROVISIONAL_LAUNDERED', claim({
      factRefs: [DOMINANT], methodRefs: ['wu_xing_distribution'], provisionalFactRefs: [DOMINANT],
    }), UNKNOWN);
  });

  it('accepts it as TENTATIVE with its lineage declared', () => {
    validateInterpretiveClaim(claim({
      factRefs: [DOMINANT], methodRefs: ['wu_xing_distribution'],
      epistemicClass: 'TENTATIVE_INTERPRETATION', provisionalFactRefs: [DOMINANT],
    }), UNKNOWN);
  });

  it('refuses a claim that hides its provisional lineage', () => {
    expectRefusal('CLAIM_PROVISIONAL_LINEAGE_MISMATCH', claim({
      factRefs: [DOMINANT], methodRefs: ['wu_xing_distribution'],
      epistemicClass: 'TENTATIVE_INTERPRETATION', provisionalFactRefs: [],
    }), UNKNOWN);
  });
});

describe('ETBZ-34 M4: PD-5 — a shared single primitive must not carry a thesis', () => {
  it('accepts a central claim with >=2 fact kinds and >=2 methods', () => {
    expect(() => assertCentralClaimSignals(claim(), KNOWN)).not.toThrow();
  });

  it('refuses a thesis resting on the Day Master alone', () => {
    try {
      assertCentralClaimSignals(claim({ factRefs: ['chart.dayMaster.stem'], methodRefs: ['day_master'] }), KNOWN);
      expect.unreachable('a single primitive must not carry a thesis');
    } catch (error) {
      expect((error as ClaimError).code).toBe('CLAIM_INSUFFICIENT_SIGNALS');
    }
  });

  it('refuses two methods over ONE fact kind (kinds and methods are both required)', () => {
    try {
      assertCentralClaimSignals(claim({ factRefs: [YEAR_HIDDEN_TEN_GOD, 'chart.natal.pillar.month.hiddenStem.0.tenGod'], methodRefs: ['ten_gods', 'fact_relations'] }), KNOWN);
      expect.unreachable('one fact kind is one signal');
    } catch (error) {
      expect((error as ClaimError).code).toBe('CLAIM_INSUFFICIENT_SIGNALS');
    }
  });

  it('allows a DECLARED distinctive single configuration only as tentative and qualified', () => {
    const single = claim({
      factRefs: ['chart.dayMaster.stem'], methodRefs: ['day_master'],
      epistemicClass: 'TENTATIVE_INTERPRETATION',
      relations: [{ type: 'ALTERNATIVE_READING', targetClaimId: 'claim.other' }],
    });
    expect(() => assertCentralClaimSignals(single, KNOWN, { declaredDistinctiveSingleConfiguration: true })).not.toThrow();
    expect(() => assertCentralClaimSignals(single, KNOWN)).toThrow(ClaimError);
    expect(() => assertCentralClaimSignals({ ...single, relations: [] }, KNOWN, { declaredDistinctiveSingleConfiguration: true })).toThrow(ClaimError);
  });
});
