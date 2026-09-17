/**
 * ETBZ-34 — BaZi Method Registry v1.0.0: the registry is valid, fail-closed,
 * and cannot silently drift from the ETBZ-25 method scope.
 */
import { describe, expect, it } from 'vitest';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import type { ChartFactKind } from '../../src/application/interpretation/feature-set.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  KNOWN_FACT_KINDS,
  METHOD_PROFILE_REF,
  MethodRegistryError,
  isApprovedStatus,
  methodRegistryStructuralHash,
  resolveMethodEnablement,
  validateMethodRegistry,
} from '../../src/application/interpretation/method-registry.js';
import type {
  MethodDefinition,
  MethodRegistry,
  MethodRegistryErrorCode,
} from '../../src/application/interpretation/method-registry.js';
import { knownTimeModel, unknownTimeModel } from '../support/narrativeFixture.js';
import type { ChartFact, InterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';

function mutate(change: (draft: { methods: MethodDefinition[]; enabledSets: MethodRegistry['enabledSets']; profileVersion: string; approvedDeterministicMappings: string[] }) => void): MethodRegistry {
  const draft = structuredClone(BAZI_METHOD_REGISTRY_V1) as unknown as {
    profileId: MethodRegistry['profileId'];
    profileVersion: string;
    approvedDeterministicMappings: string[];
    methods: MethodDefinition[];
    enabledSets: MethodRegistry['enabledSets'];
  };
  change(draft);
  return draft;
}

function expectRefusal(code: MethodRegistryErrorCode, registry: MethodRegistry): void {
  try {
    validateMethodRegistry(registry);
  } catch (error) {
    expect(error).toBeInstanceOf(MethodRegistryError);
    expect((error as MethodRegistryError).code).toBe(code);
    return;
  }
  expect.unreachable(`expected the registry to be refused with ${code}`);
}

function byId(id: string): MethodDefinition {
  const method = BAZI_METHOD_REGISTRY_V1.methods.find((candidate) => candidate.methodId === id);
  if (method === undefined) throw new Error(`fixture: no method ${id}`);
  return method;
}

describe('ETBZ-34 R1: the released registry is valid and versioned', () => {
  it('validates, and is bound to profile version 1.0.0', () => {
    expect(() => validateMethodRegistry(BAZI_METHOD_REGISTRY_V1)).not.toThrow();
    expect(BAZI_METHOD_REGISTRY_V1.profileVersion).toBe('1.0.0');
    expect(METHOD_PROFILE_REF).toBe('bazi-method-profile@1.0.0');
  });

  it('carries 42 methods: 14 approved, 21 deferred, 7 forbidden', () => {
    const statuses = BAZI_METHOD_REGISTRY_V1.methods.map((method) => method.status);
    expect(statuses.length).toBe(42);
    expect(statuses.filter(isApprovedStatus).length).toBe(14);
    expect(statuses.filter((status) => status.startsWith('DEFERRED')).length).toBe(21);
    expect(statuses.filter((status) => status === 'FORBIDDEN_MVP_V1').length).toBe(7);
  });

  it('has a stable structural hash (same content, same hash)', () => {
    expect(methodRegistryStructuralHash(BAZI_METHOD_REGISTRY_V1)).toBe(
      methodRegistryStructuralHash(structuredClone(BAZI_METHOD_REGISTRY_V1)),
    );
  });

  it('names only fact kinds a ChartFact can actually carry — in both directions', () => {
    const produced = new Set<ChartFactKind>(
      deriveInterpretationFeatureSet(knownTimeModel()).facts.map((fact) => fact.kind),
    );
    // Every kind the feature set produces is known to the registry vocabulary …
    for (const kind of produced) expect(KNOWN_FACT_KINDS, kind).toContain(kind);
    // … and every kind the vocabulary names is really produced (no phantom kinds).
    for (const kind of KNOWN_FACT_KINDS) expect(produced.has(kind), kind).toBe(true);
  });
});

describe('ETBZ-34 R2: scope — what is NOT available stays unavailable', () => {
  it.each([
    'day_master_strength', 'rooting', 'seasonal_strength', 'structure', 'useful_god',
    'favourable_elements_xi_shen', 'unfavourable_elements_ji_shen', 'climatic_adjustment',
    'branch_clashes', 'branch_combinations', 'transformations', 'symbolic_stars', 'twelve_life_stages',
  ])('%s is deferred, has no operation, is not claim-bearing and names its missing dependency', (id) => {
    const method = byId(id);
    expect(method.status.startsWith('DEFERRED')).toBe(true);
    expect(method.operations).toEqual([]);
    expect(method.claimBearing).toBe(false);
    expect(method.gapCodes.length).toBeGreaterThan(0);
  });

  it.each([
    'luck_pillars_da_yun', 'annual_liu_nian_transits', 'relationship_constructs',
    'western_astrology', 'fusion', 'prescriptive_remedies', 'element_health_correspondence',
  ])('%s is FORBIDDEN_MVP_V1 — never conditional', (id) => {
    expect(byId(id).status).toBe('FORBIDDEN_MVP_V1');
  });

  it('keeps Sheng/Ke in state A: wu_xing_relations reads ONLY source-supplied day-master relations', () => {
    const method = byId('wu_xing_relations');
    expect(method.operations).toEqual(['RELATE_TO_DAY_MASTER']);
    expect(method.evidence).toEqual({
      mode: 'kinds',
      kinds: ['ten_god_element_relation', 'hidden_stem_ten_god_element_relation'],
    });
  });

  it('enabled sets contain approved methods only, each exactly once', () => {
    const { minimumSellableCore, policyMethods, optionalSupportingMethods } = BAZI_METHOD_REGISTRY_V1.enabledSets;
    const all = [...minimumSellableCore, ...policyMethods, ...optionalSupportingMethods];
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(isApprovedStatus(byId(id).status), id).toBe(true);
    expect(minimumSellableCore).toEqual([
      'four_pillars', 'day_master', 'ten_gods', 'hidden_stems', 'positional_context', 'fact_relations',
    ]);
  });
});

describe('ETBZ-34 R3: a defective registry is refused, not repaired', () => {
  it('refuses a draft / candidate version', () => {
    expectRefusal('REGISTRY_VERSION_INVALID', mutate((draft) => { draft.profileVersion = '1.0.0-rc.3'; }));
  });

  it('refuses a duplicate method id', () => {
    expectRefusal('REGISTRY_DUPLICATE_METHOD_ID', mutate((draft) => { draft.methods.push(byId('rooting')); }));
  });

  it('refuses a deferred method placed in an enabled set', () => {
    expectRefusal('REGISTRY_NON_APPROVED_IN_ENABLED_SET', mutate((draft) => {
      draft.enabledSets = { ...draft.enabledSets, optionalSupportingMethods: [...draft.enabledSets.optionalSupportingMethods, 'rooting'] };
    }));
  });

  it('refuses a forbidden method placed in the core', () => {
    expectRefusal('REGISTRY_NON_APPROVED_IN_ENABLED_SET', mutate((draft) => {
      draft.enabledSets = { ...draft.enabledSets, minimumSellableCore: [...draft.enabledSets.minimumSellableCore, 'luck_pillars_da_yun'] };
    }));
  });

  it('refuses a deferred method that leaks an operation', () => {
    expectRefusal('REGISTRY_NON_APPROVED_WITH_OPERATIONS', mutate((draft) => {
      const index = draft.methods.findIndex((method) => method.methodId === 'useful_god');
      draft.methods[index] = { ...byId('useful_god'), operations: ['SELECT_USEFUL_GOD'] };
    }));
  });

  it('refuses a deferred method that names no missing dependency', () => {
    expectRefusal('REGISTRY_UNAVAILABLE_WITHOUT_GAP_CODE', mutate((draft) => {
      const index = draft.methods.findIndex((method) => method.methodId === 'na_yin');
      draft.methods[index] = { ...byId('na_yin'), gapCodes: [] };
    }));
  });

  it('refuses an approved method that is in no enabled set', () => {
    expectRefusal('REGISTRY_APPROVED_NOT_IN_EXACTLY_ONE_SET', mutate((draft) => {
      draft.enabledSets = {
        ...draft.enabledSets,
        optionalSupportingMethods: draft.enabledSets.optionalSupportingMethods.filter((id) => id !== 'month_command'),
      };
    }));
  });

  it('refuses a fact kind no ChartFact carries', () => {
    expectRefusal('REGISTRY_UNKNOWN_FACT_KIND', mutate((draft) => {
      const index = draft.methods.findIndex((method) => method.methodId === 'ten_gods');
      draft.methods[index] = { ...byId('ten_gods'), evidence: { mode: 'kinds', kinds: ['day_master_strength' as ChartFactKind] } };
    }));
  });

  it('refuses scope drift: approving a method the ETBZ-25 scope marks not_evaluated', () => {
    expectRefusal('REGISTRY_SCOPE_DRIFT', mutate((draft) => {
      const index = draft.methods.findIndex((method) => method.methodId === 'rooting');
      draft.methods[index] = {
        ...byId('hidden_stems'), methodId: 'rooting', necessity: 'SUPPORTING',
      };
      draft.enabledSets = { ...draft.enabledSets, optionalSupportingMethods: [...draft.enabledSets.optionalSupportingMethods, 'rooting'] };
    }));
  });
});

describe('ETBZ-34 R4: enablement is decided per chart', () => {
  it('enables all 14 approved methods for the known-time fixture chart', () => {
    const enablement = resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, deriveInterpretationFeatureSet(knownTimeModel()));
    const enabled = enablement.filter((entry) => entry.enabled).map((entry) => entry.methodId).sort();
    expect(enabled.length).toBe(14);
    expect(enablement.filter((entry) => !entry.enabled).every((entry) => entry.reason === 'NOT_APPROVED')).toBe(true);
  });

  it('still enables them under an unknown birth time (year/month/day carry every kind)', () => {
    const enablement = resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, deriveInterpretationFeatureSet(unknownTimeModel()));
    expect(enablement.filter((entry) => entry.enabled).length).toBe(14);
  });

  it('disables month_command when the principal-Qi identity cannot be proven (counterfactual)', () => {
    const model = knownTimeModel({ natal: { monthCommand: { principalQiStem: 'Ji', principalQiStemCn: '己', element: 'earth' } } });
    const entry = resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, deriveInterpretationFeatureSet(model))
      .find((candidate) => candidate.methodId === 'month_command');
    expect(entry?.enabled).toBe(false);
    expect(entry?.reason).toBe('MONTH_COMMAND_IDENTITY_NOT_PROVEN');
  });
});

function featureSetWith(select: (fact: ChartFact) => ChartFact | null): InterpretationFeatureSet {
  const base = deriveInterpretationFeatureSet(knownTimeModel());
  const facts = base.facts.map(select).filter((fact): fact is ChartFact => fact !== null);
  return { ...base, facts, factIds: facts.map((fact) => fact.id) };
}

function entryOf(featureSet: InterpretationFeatureSet, methodId: string): ReturnType<typeof resolveMethodEnablement>[number] {
  const entry = resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, featureSet).find((candidate) => candidate.methodId === methodId);
  if (entry === undefined) throw new Error(`no enablement for ${methodId}`);
  return entry;
}

describe('ETBZ-34 R5: season operations need a mapping nobody delivered (finding C)', () => {
  it('v1.0.0 declares no season operation and approves no deterministic mapping', () => {
    expect(BAZI_METHOD_REGISTRY_V1.approvedDeterministicMappings).toEqual([]);
    const operations = BAZI_METHOD_REGISTRY_V1.methods.flatMap((method) => method.operations);
    expect(operations.filter((operation) => /season/iu.test(operation))).toEqual([]);
  });

  it.each([
    ['earthly_branches', 'MARK_SEASON'],
    ['month_command', 'CONTEXTUALIZE_SEASON'],
    ['month_command', 'NOTE_SEASONAL_TONE'],
  ])('refuses %s re-gaining %s without an approved mapping', (methodId, operation) => {
    expectRefusal('REGISTRY_OPERATION_NEEDS_UNAPPROVED_MAPPING', mutate((draft) => {
      const index = draft.methods.findIndex((method) => method.methodId === methodId);
      draft.methods[index] = { ...byId(methodId), operations: [...byId(methodId).operations, operation] };
    }));
  });

  it('would accept it only with the versioned mapping delivered — never from model memory (counterfactual)', () => {
    const registry = mutate((draft) => {
      const index = draft.methods.findIndex((method) => method.methodId === 'earthly_branches');
      draft.methods[index] = { ...byId('earthly_branches'), operations: [...byId('earthly_branches').operations, 'MARK_SEASON'] };
      draft.approvedDeterministicMappings = ['branch_to_season'];
    });
    expect(() => validateMethodRegistry(registry)).not.toThrow();
  });

  it('no fact kind carries a season, so nothing the skill may cite says one', () => {
    const facts = deriveInterpretationFeatureSet(knownTimeModel()).facts;
    expect(facts.filter((fact) => /season|spring|summer|autumn|winter|frühling|sommer|herbst/iu.test(`${fact.kind} ${fact.value}`))).toEqual([]);
  });
});

describe('ETBZ-34 R6: enabled means usable on THIS chart (finding D)', () => {
  it('disables fact_relations when no identity pair exists', () => {
    const seen = new Set<string>();
    const featureSet = featureSetWith((fact) => {
      // Keep at most one fact per value: no value can then occur twice.
      if (seen.has(fact.value)) return null;
      seen.add(fact.value);
      return fact;
    });
    const entry = entryOf(featureSet, 'fact_relations');
    expect(entry.enabled).toBe(false);
    expect(entry.reason).toBe('NO_IDENTITY_PAIR');
  });

  it('does not count trivially identical facts as a pair (day master = day stem; Hanzi/Pinyin spellings)', () => {
    const keep = new Set(['chart.dayMaster.stem', 'chart.pillar.day.stem', 'chart.pillar.day.stemPinyin', 'chart.natal.monthCommand.branch', 'chart.pillar.month.branch']);
    const entry = entryOf(featureSetWith((fact) => (keep.has(fact.id) ? fact : null)), 'fact_relations');
    expect(entry.enabled).toBe(false);
  });

  it('does not pair an excluded (assumed-hour) fact', () => {
    const featureSet = deriveInterpretationFeatureSet(unknownTimeModel());
    const hourTenGod = featureSet.facts.find((fact) => fact.id === 'chart.natal.pillar.hour.tenGod');
    expect(hourTenGod?.interpretable).toBe(false);
    const only = featureSetWith((fact) => fact).facts.filter((fact) => fact.kind === 'ten_god' && fact.pillar === 'year');
    const year = only[0];
    if (year === undefined || hourTenGod === undefined) throw new Error('fixture');
    const pairOnly: InterpretationFeatureSet = { ...featureSet, facts: [{ ...year, value: hourTenGod.value }, hourTenGod] };
    expect(entryOf(pairOnly, 'fact_relations').enabled).toBe(false);
  });

  it('is independent of fact order and of duplicated facts', () => {
    const base = deriveInterpretationFeatureSet(knownTimeModel());
    const shuffled = { ...base, facts: [...base.facts].reverse() };
    const duplicated = { ...base, facts: [...base.facts, ...base.facts] };
    const reference = resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, base);
    expect(resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, shuffled)).toEqual(reference);
    expect(resolveMethodEnablement(BAZI_METHOD_REGISTRY_V1, duplicated)).toEqual(reference);
    // A lone fact duplicated is still one occurrence, not a recurrence.
    const lone = base.facts.find((fact) => fact.id === 'chart.natal.pillar.year.tenGod');
    if (lone === undefined) throw new Error('fixture');
    expect(entryOf({ ...base, facts: [lone, lone] }, 'fact_relations').enabled).toBe(false);
  });

  it('disables positional_context when no pillar fact is readable by an enabled carrier', () => {
    const noPillar = featureSetWith((fact) => (fact.pillar === null ? fact : null));
    const entry = entryOf(noPillar, 'positional_context');
    expect(entry.enabled).toBe(false);
    expect(entry.reason).toBe('NO_ELIGIBLE_PILLAR_FACT');
    // Pillar facts exist, but only of kinds whose carrier method is itself disabled.
    const onlyHanzi = featureSetWith((fact) => (fact.kind === 'pillar_stem_hanzi' ? fact : null));
    expect(entryOf(onlyHanzi, 'positional_context').enabled).toBe(false);
  });

  it('keeps both enabled on the full fixture chart (positive control)', () => {
    const featureSet = deriveInterpretationFeatureSet(knownTimeModel());
    expect(entryOf(featureSet, 'fact_relations').enabled).toBe(true);
    expect(entryOf(featureSet, 'positional_context').enabled).toBe(true);
  });
});
