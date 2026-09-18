/**
 * ETBZ-30A — every required refusal of the InterpretiveClaimGraph.
 *
 * Pattern: the baseline is proven green first, then each test applies exactly
 * ONE change to it. A refusal that comes from the claim contract must surface as
 * the claim validator's own `ClaimError` — the graph composes that gate, it does
 * not re-word it. A refusal that only a graph can see is a `ClaimGraphError`.
 * In both cases nothing partial is returned.
 */
import { describe, expect, it } from 'vitest';
import {
  ClaimGraphError,
  buildInterpretiveClaimGraph,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import type {
  ClaimGraphContext,
  ClaimGraphErrorCode,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import { ClaimError } from '../../src/application/interpretation/interpretive-claim.js';
import type { ClaimErrorCode, InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { BAZI_METHOD_REGISTRY_V1, MethodRegistryError } from '../../src/application/interpretation/method-registry.js';
import type { MethodRegistry } from '../../src/application/interpretation/method-registry.js';
import {
  DAY_HIDDEN_TEN_GOD,
  DOMINANT,
  H,
  HOUR_TEN_GOD,
  KNOWN,
  MONTH_TEN_GOD,
  UNKNOWN,
  baselineClaims,
  dayMasterClaim,
  dominantClaim,
  draftOf,
  recurrenceClaim,
  relationClaim,
  tentativeDominantClaim,
} from '../support/claimGraphFixture.js';

function expectClaimRefusal(code: ClaimErrorCode, claims: readonly InterpretiveClaim[], context: ClaimGraphContext = KNOWN): void {
  try {
    buildInterpretiveClaimGraph(draftOf(claims, context), context);
  } catch (error) {
    expect(error).toBeInstanceOf(ClaimError);
    expect((error as ClaimError).code, (error as ClaimError).message).toBe(code);
    return;
  }
  expect.unreachable(`expected the graph to be refused with ${code}`);
}

function expectGraphRefusal(code: ClaimGraphErrorCode, run: () => unknown): ClaimGraphError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ClaimGraphError);
    expect((error as ClaimGraphError).code, (error as ClaimGraphError).message).toBe(code);
    return error as ClaimGraphError;
  }
  return expect.unreachable(`expected the graph to be refused with ${code}`);
}

/** The baseline with ONE claim replaced — every other claim stays valid. */
function withRecurrence(overrides: Partial<InterpretiveClaim>): InterpretiveClaim[] {
  return [recurrenceClaim(overrides), relationClaim(), dayMasterClaim(), dominantClaim()];
}

describe('ETBZ-30A N0: the baseline every refusal below mutates is accepted', () => {
  it('builds on the known-time and on the unknown-time chart', () => {
    expect(buildInterpretiveClaimGraph(draftOf(baselineClaims()), KNOWN).claims).toHaveLength(4);
    const unknown = [recurrenceClaim(), relationClaim(), dayMasterClaim(), tentativeDominantClaim()];
    expect(buildInterpretiveClaimGraph(draftOf(unknown, UNKNOWN), UNKNOWN).claims).toHaveLength(4);
  });
});

describe('ETBZ-30A N1: grounding — one ungrounded claim blocks the whole graph', () => {
  it('refuses a claim without factRefs, and a claim grounded by themes alone', () => {
    expectClaimRefusal('CLAIM_UNGROUNDED', withRecurrence({ factRefs: [], methodRefs: ['ten_gods'] }));
    const themeId = KNOWN.brief.constraints.candidateThemeIds[0];
    if (themeId === undefined) {
      throw new Error('fixture: the known-time brief has no candidate theme');
    }
    expectClaimRefusal('CLAIM_UNGROUNDED', withRecurrence({ factRefs: [], themeRefs: [themeId] }));
  });

  it('refuses an unknown factRef', () => {
    expectClaimRefusal('CLAIM_UNKNOWN_FACT', withRecurrence({ factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, 'chart.natal.pillar.month.luck'] }));
  });

  it('refuses raw producer paths and model paths as factRefs', () => {
    const monthTenGod = KNOWN.brief.facts.find((fact) => fact.id === MONTH_TEN_GOD);
    if (monthTenGod === undefined || monthTenGod.path === monthTenGod.id) {
      throw new Error('fixture: the month Ten God fact must have a model path distinct from its id');
    }
    for (const rawPath of [
      'fufire.baziRaw.payload.pillars.year.stamm',
      'fufire.wuxingRaw.payload.wu_xing_vector.Feuer',
      'fufire.natalRaw.payload.month_command.branch',
      'validatedChart.facts.0',
      monthTenGod.path,
    ]) {
      expectClaimRefusal('CLAIM_UNKNOWN_FACT', withRecurrence({ factRefs: [rawPath, MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD] }));
    }
  });

  it('refuses an assumed-hour fact under an unknown birth time — also as a tentative claim', () => {
    const hour: InterpretiveClaim = {
      claimId: 'draft.hour',
      statement: 'The hour pillar adds a further voice.',
      factRefs: [HOUR_TEN_GOD],
      themeRefs: [],
      methodRefs: ['ten_gods'],
      epistemicClass: 'TENTATIVE_INTERPRETATION',
      provisionalFactRefs: [HOUR_TEN_GOD],
      relations: [],
    };
    expectClaimRefusal('CLAIM_EXCLUDED_FACT_CITED', [recurrenceClaim(), hour], UNKNOWN);
    // Control: with a known birth time the same fact is citable, and certain.
    const known = { ...hour, epistemicClass: 'SUPPORTED_INTERPRETATION' as const, provisionalFactRefs: [] };
    expect(buildInterpretiveClaimGraph(draftOf([recurrenceClaim(), known]), KNOWN).claims).toHaveLength(2);
  });

  it('refuses a themeRef the bound brief does not contain', () => {
    expectGraphRefusal('CLAIM_GRAPH_UNKNOWN_THEME', () => buildInterpretiveClaimGraph(draftOf(withRecurrence({ themeRefs: ['theme.tenGod.Invented'] })), KNOWN));
  });
});

describe('ETBZ-30A N2: method attribution (PD-6, I1–I5) stays fail-closed inside a graph', () => {
  it('refuses a claim without methodRefs', () => {
    expectClaimRefusal('CLAIM_METHOD_REFS_MISSING', withRecurrence({ methodRefs: [] }));
  });

  it('refuses an unknown methodRef, and every deferred or forbidden one', () => {
    expectClaimRefusal('CLAIM_METHOD_UNKNOWN', withRecurrence({ methodRefs: ['ten_gods', 'general_bazi_knowledge'] }));
    const unavailable = BAZI_METHOD_REGISTRY_V1.methods.filter((method) => !method.status.startsWith('APPROVED'));
    expect(unavailable.length).toBeGreaterThan(0);
    for (const method of unavailable) {
      expectClaimRefusal('CLAIM_METHOD_NOT_APPROVED', withRecurrence({ methodRefs: ['ten_gods', method.methodId] }));
    }
  });

  it('refuses a method without matching evidence', () => {
    expectClaimRefusal('CLAIM_METHOD_WITHOUT_EVIDENCE', withRecurrence({ methodRefs: ['ten_gods', 'fact_relations', 'wu_xing_distribution'] }));
  });

  it('refuses a fact no non-modifier method covers', () => {
    expectClaimRefusal('CLAIM_ORPHAN_FACT', withRecurrence({ factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, DOMINANT] }));
  });

  it('refuses a modifier-only claim', () => {
    expectClaimRefusal('CLAIM_MODIFIER_ALONE', withRecurrence({ methodRefs: ['positional_context'] }));
  });

  it('refuses a draft bound to another profile version', () => {
    try {
      buildInterpretiveClaimGraph(draftOf(baselineClaims(), KNOWN, { methodProfileRef: 'bazi-method-profile@0.9.0' }), KNOWN);
      expect.unreachable('a draft bound to another profile version must be refused');
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimError);
      expect((error as ClaimError).code).toBe('CLAIM_PROFILE_MISMATCH');
    }
  });

  it('refuses a registry that is not the released one', () => {
    // A VALID edit under the released version: still a contradiction with the profile.
    const drifted = structuredClone(BAZI_METHOD_REGISTRY_V1) as unknown as { methods: { methodId: string; operations: string[] }[] };
    const tenGods = drifted.methods.find((method) => method.methodId === 'ten_gods');
    if (tenGods === undefined) {
      throw new Error('fixture: the registry has no ten_gods method');
    }
    tenGods.operations.push('RANK_BY_IMPORTANCE');
    try {
      buildInterpretiveClaimGraph(draftOf(baselineClaims()), { ...KNOWN, registry: drifted as unknown as MethodRegistry });
      expect.unreachable('an unreleased registry must not authorise a graph');
    } catch (error) {
      expect(error).toBeInstanceOf(MethodRegistryError);
      expect((error as MethodRegistryError).code).toBe('REGISTRY_NOT_RELEASED');
    }
  });
});

describe('ETBZ-30A N3: provisionality may not be laundered through a graph', () => {
  it('refuses a provisional source represented as a supported claim', () => {
    expectClaimRefusal('CLAIM_PROVISIONAL_LAUNDERED', [recurrenceClaim(), dominantClaim({ relations: [], provisionalFactRefs: [DOMINANT] })], UNKNOWN);
  });

  it('refuses a claim that hides or invents provisional lineage', () => {
    expectClaimRefusal('CLAIM_PROVISIONAL_LINEAGE_MISMATCH', [recurrenceClaim(), tentativeDominantClaim({ relations: [], provisionalFactRefs: [] })], UNKNOWN);
    expectClaimRefusal('CLAIM_PROVISIONAL_LINEAGE_MISMATCH', withRecurrence({ provisionalFactRefs: [MONTH_TEN_GOD] }));
  });

  it('does not let a relation to a certain claim rescue a laundered one', () => {
    expectClaimRefusal('CLAIM_PROVISIONAL_LAUNDERED', [
      recurrenceClaim(),
      dominantClaim({ provisionalFactRefs: [DOMINANT], relations: [{ type: 'SUPPORTS', targetClaimId: H.recurrence }] }),
    ], UNKNOWN);
  });
});

describe('ETBZ-30A N4: relations are closed and resolve inside the graph', () => {
  it('refuses a relation outside the vocabulary', () => {
    expectClaimRefusal('CLAIM_UNKNOWN_RELATION', withRecurrence({
      relations: [{ type: 'CLASHES_WITH' as unknown as 'SUPPORTS', targetClaimId: H.relation }],
    }));
  });

  it('refuses a relation to a claim that does not exist', () => {
    expectGraphRefusal('CLAIM_GRAPH_DANGLING_RELATION', () => buildInterpretiveClaimGraph(draftOf(withRecurrence({
      relations: [{ type: 'DEVELOPS', targetClaimId: 'draft.neverWritten' }],
    })), KNOWN));
  });

  it('refuses a graph from which a related claim was removed (ablation)', () => {
    const ablated = baselineClaims().filter((claim) => claim.claimId !== H.recurrence);
    expectGraphRefusal('CLAIM_GRAPH_DANGLING_RELATION', () => buildInterpretiveClaimGraph(draftOf(ablated), KNOWN));
  });

  it('does not let a relation keep an invalid claim: the target must be ACCEPTED, not merely present', () => {
    expectClaimRefusal('CLAIM_MODIFIER_ALONE', [
      recurrenceClaim({ methodRefs: ['positional_context'] }),
      relationClaim(),
    ]);
  });

  it('refuses a claim related to itself', () => {
    expectGraphRefusal('CLAIM_GRAPH_SELF_RELATION', () => buildInterpretiveClaimGraph(draftOf(withRecurrence({
      relations: [{ type: 'QUALIFIES', targetClaimId: H.recurrence }],
    })), KNOWN));
  });
});

describe('ETBZ-30A N5: duplication and order never become importance', () => {
  it('refuses two claims under one handle', () => {
    expectGraphRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_ID', () => buildInterpretiveClaimGraph(draftOf([...baselineClaims(), recurrenceClaim()]), KNOWN));
    expectGraphRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_ID', () => buildInterpretiveClaimGraph(draftOf([
      ...baselineClaims(), dayMasterClaim({ claimId: H.recurrence, relations: [] }),
    ]), KNOWN));
  });

  it('refuses the same meaning submitted twice under two handles — reordered refs do not disguise it', () => {
    const twin = recurrenceClaim({
      claimId: 'draft.recurrenceAgain',
      factRefs: [DAY_HIDDEN_TEN_GOD, MONTH_TEN_GOD],
      methodRefs: ['positional_context', 'fact_relations', 'ten_gods'],
      relations: [{ type: 'SUPPORTS', targetClaimId: H.recurrence }],
    });
    expectGraphRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT', () => buildInterpretiveClaimGraph(draftOf([...baselineClaims(), twin]), KNOWN));
    // Control: a genuinely different reading of the same facts is a second claim.
    const alternative = recurrenceClaim({
      claimId: 'draft.alternative',
      statement: 'The repetition may equally be read as one voice heard in two rooms.',
      relations: [{ type: 'ALTERNATIVE_READING', targetClaimId: H.recurrence }],
    });
    expect(buildInterpretiveClaimGraph(draftOf([...baselineClaims(), alternative]), KNOWN).claims).toHaveLength(5);
  });

  it('refuses a repeated factRef, themeRef or relation instead of counting it', () => {
    const themeId = KNOWN.brief.constraints.candidateThemeIds[0];
    if (themeId === undefined) {
      throw new Error('fixture: the known-time brief has no candidate theme');
    }
    const repeated: Partial<InterpretiveClaim>[] = [
      { factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, MONTH_TEN_GOD] },
      { themeRefs: [themeId, themeId] },
      { relations: [{ type: 'DEVELOPS', targetClaimId: H.relation }, { type: 'DEVELOPS', targetClaimId: H.relation }] },
    ];
    for (const overrides of repeated) {
      expectGraphRefusal('CLAIM_GRAPH_DUPLICATE_REF', () => buildInterpretiveClaimGraph(draftOf(withRecurrence(overrides)), KNOWN));
    }
    expectClaimRefusal('CLAIM_DUPLICATE_METHOD_REF', withRecurrence({ methodRefs: ['ten_gods', 'fact_relations', 'ten_gods'] }));
  });

  it('refuses an empty claim set: a graph with nothing in it accepts nothing', () => {
    expectGraphRefusal('CLAIM_GRAPH_EMPTY', () => buildInterpretiveClaimGraph(draftOf([]), KNOWN));
  });
});

describe('ETBZ-30A N6: the draft is untrusted input with a closed shape', () => {
  const valid = (): Record<string, unknown> => structuredClone(draftOf(baselineClaims())) as unknown as Record<string, unknown>;

  it('refuses a salience, confidence or rank smuggled onto a claim or onto the draft', () => {
    for (const [key, value] of [['salience', 0.9], ['confidence', 87], ['rank', 1], ['personalityScore', 'high']] as const) {
      const onClaim = valid();
      (onClaim['claims'] as Record<string, unknown>[])[0] = { ...recurrenceClaim(), [key]: value };
      expectGraphRefusal('CLAIM_GRAPH_SCHEMA_INVALID', () => buildInterpretiveClaimGraph(onClaim, KNOWN));
      expectGraphRefusal('CLAIM_GRAPH_SCHEMA_INVALID', () => buildInterpretiveClaimGraph({ ...valid(), [key]: value }, KNOWN));
    }
  });

  it('refuses provider, model and run identifiers: no such field exists to enter identity', () => {
    for (const key of ['providerId', 'model', 'runId', 'generatedAt']) {
      expectGraphRefusal('CLAIM_GRAPH_SCHEMA_INVALID', () => buildInterpretiveClaimGraph({ ...valid(), [key]: 'x' }, KNOWN));
    }
  });

  it('refuses a malformed draft without echoing what it received', () => {
    const marker = 'UNTRUSTED-BULK-VALUE';
    const malformed: unknown[] = [
      null,
      'a string',
      { ...valid(), claims: 'not an array' },
      { ...valid(), claims: [{ ...recurrenceClaim(), factRefs: [marker, 7] }] },
      { ...valid(), claims: [{ ...recurrenceClaim(), claimId: '' }] },
      { ...valid(), claims: [{ ...recurrenceClaim(), relations: [{ type: 'SUPPORTS', targetClaimId: H.relation, weight: marker }] }] },
      { ...valid(), sourceBriefStructuralHash: undefined },
    ];
    for (const draft of malformed) {
      const error = expectGraphRefusal('CLAIM_GRAPH_SCHEMA_INVALID', () => buildInterpretiveClaimGraph(draft, KNOWN));
      expect(error.message).not.toContain(marker);
    }
  });
});
