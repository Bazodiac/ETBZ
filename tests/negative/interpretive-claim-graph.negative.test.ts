/**
 * ETBZ-30A — the draft-level refusals of the InterpretiveClaimGraph, and the
 * controls that pin what the graph deliberately does NOT refuse (a statement's
 * typography, a supplementary theme, a repeated statement text under another
 * semantic identity — PO clarification 2026-09-19). The binding,
 * consistency-check and central-claim refusals are in the unit suite (G3, G5).
 *
 * Pattern: the baseline is proven green first, then each test changes as little
 * of it as the refusal needs. A refusal that comes from the claim contract must surface as
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
  InterpretiveClaimGraphDraft,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { ClaimError, validateInterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import type { ClaimErrorCode, InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { BAZI_METHOD_REGISTRY_V1, METHOD_PROFILE_REF, MethodRegistryError } from '../../src/application/interpretation/method-registry.js';
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

function refusalOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

function expectClaimRefusal(code: ClaimErrorCode, claims: readonly InterpretiveClaim[], context: ClaimGraphContext = KNOWN, draft: Partial<InterpretiveClaimGraphDraft> = {}): void {
  const caught = refusalOf(() => buildInterpretiveClaimGraph(draftOf(claims, context, draft), context));
  expect(caught, `expected the graph to be refused with ${code}`).toBeInstanceOf(ClaimError);
  expect((caught as ClaimError).code, (caught as ClaimError).message).toBe(code);
}

function expectGraphRefusal(code: ClaimGraphErrorCode, run: () => unknown): ClaimGraphError {
  const caught = refusalOf(run);
  expect(caught, `expected the graph to be refused with ${code}`).toBeInstanceOf(ClaimGraphError);
  expect((caught as ClaimGraphError).code, (caught as ClaimGraphError).message).toBe(code);
  return caught as ClaimGraphError;
}

function expectDraftRefusal(code: ClaimGraphErrorCode, claims: readonly InterpretiveClaim[], context: ClaimGraphContext = KNOWN): void {
  expectGraphRefusal(code, () => buildInterpretiveClaimGraph(draftOf(claims, context), context));
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
    expectDraftRefusal('CLAIM_GRAPH_UNKNOWN_THEME', withRecurrence({ themeRefs: ['theme.tenGod.Invented'] }));
  });

  it('accepts a themeRef of the bound brief that shares no cited fact: supplementary structure, never grounding (PO 2026-09-19)', () => {
    const expectDisjoint = (context: ClaimGraphContext, themeId: string, claim: InterpretiveClaim): void => {
      const theme = [...context.brief.primaryThemes, ...context.brief.candidateThemes].find((candidate) => candidate.id === themeId);
      expect(theme, themeId).toBeDefined();
      expect(theme?.factIds.some((factId) => claim.factRefs.includes(factId)), themeId).toBe(false);
    };
    // Under an unknown birth time: a certain claim filed under a provisional theme.
    const underProvisional = recurrenceClaim({ themeRefs: ['theme.wuXing.Feuer'] });
    expectDisjoint(UNKNOWN, 'theme.wuXing.Feuer', underProvisional);
    expect(UNKNOWN.brief.candidateThemes.find((theme) => theme.id === 'theme.wuXing.Feuer')?.containsProvisionalFacts).toBe(true);
    const graph = buildInterpretiveClaimGraph(draftOf([underProvisional], UNKNOWN), UNKNOWN);
    // The theme is carried, and moves nothing: the claim's certainty is its own facts'.
    expect(graph.claims[0]?.themeRefs).toEqual(['theme.wuXing.Feuer']);
    expect(graph.claims[0]?.epistemicClass).toBe('SUPPORTED_INTERPRETATION');
    expect(graph.claims[0]?.provisionalFactRefs).toEqual([]);
    // A primary theme without overlap next to one with overlap.
    const mixed = recurrenceClaim({ themeRefs: ['theme.pillar.month', 'primary.elemental_profile'] });
    expectDisjoint(KNOWN, 'primary.elemental_profile', mixed);
    expect(buildInterpretiveClaimGraph(draftOf([mixed, relationClaim(), dayMasterClaim(), dominantClaim()]), KNOWN).claims).toHaveLength(4);
  });

  it('keeps direct facts mandatory: a theme of the bound brief never stands in for a factRef', () => {
    for (const themeRef of ['theme.pillar.month', 'primary.elemental_profile']) {
      expectClaimRefusal('CLAIM_UNGROUNDED', withRecurrence({ factRefs: [], themeRefs: [themeRef] }));
    }
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
    // The modifier `positional_context` may read this pillar fact; no reading method does.
    expectClaimRefusal('CLAIM_ORPHAN_FACT', withRecurrence({ factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, 'chart.pillar.year.stem'] }));
    expectClaimRefusal('CLAIM_ORPHAN_FACT', withRecurrence({ factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, DOMINANT] }));
  });

  it('refuses a modifier-only claim', () => {
    expectClaimRefusal('CLAIM_MODIFIER_ALONE', withRecurrence({ methodRefs: ['positional_context'] }));
  });

  it('refuses a draft bound to another profile version', () => {
    expectClaimRefusal('CLAIM_PROFILE_MISMATCH', baselineClaims(), KNOWN, { methodProfileRef: 'bazi-method-profile@0.9.0' });
  });

  it('refuses a registry that is not the released one', () => {
    // A VALID edit under the released version: still a contradiction with the profile.
    const drifted = structuredClone(BAZI_METHOD_REGISTRY_V1) as unknown as { methods: { methodId: string; operations: string[] }[] };
    const tenGods = drifted.methods.find((method) => method.methodId === 'ten_gods');
    if (tenGods === undefined) {
      throw new Error('fixture: the registry has no ten_gods method');
    }
    tenGods.operations.push('RANK_BY_IMPORTANCE');
    const caught = refusalOf(() => buildInterpretiveClaimGraph(draftOf(baselineClaims()), { ...KNOWN, registry: drifted as unknown as MethodRegistry }));
    expect(caught, 'an unreleased registry must not authorise a graph').toBeInstanceOf(MethodRegistryError);
    expect((caught as MethodRegistryError).code).toBe('REGISTRY_NOT_RELEASED');
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
  it('refuses two claims under one handle — also when they say different things', () => {
    expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_ID', [...baselineClaims(), recurrenceClaim()]);
    // Without this refusal the second claim would take over the handle, and every
    // relation to it would silently point at a claim its author never meant.
    expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_ID', [
      ...baselineClaims(),
      dayMasterClaim({ claimId: H.recurrence, statement: 'A reading nobody else in this draft makes.', relations: [] }),
    ]);
  });

  it('refuses the same full semantic identity submitted twice under two handles — reordered refs do not disguise it', () => {
    const twin = recurrenceClaim({
      claimId: 'draft.recurrenceAgain',
      factRefs: [DAY_HIDDEN_TEN_GOD, MONTH_TEN_GOD],
      methodRefs: ['positional_context', 'fact_relations', 'ten_gods'],
      relations: [],
    });
    expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT', [...baselineClaims(), twin]);
    // ...and neither does a twin that "supports" the original.
    expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT', [...baselineClaims(), { ...twin, relations: [{ type: 'SUPPORTS', targetClaimId: H.recurrence }] }]);
    // Control: a genuinely different reading of the same facts is a second claim.
    const alternative = recurrenceClaim({
      claimId: 'draft.alternative',
      statement: 'The repetition may equally be read as one voice heard in two rooms.',
      relations: [{ type: 'ALTERNATIVE_READING', targetClaimId: H.recurrence }],
    });
    expect(buildInterpretiveClaimGraph(draftOf([...baselineClaims(), alternative]), KNOWN).claims).toHaveLength(5);
  });

  it('accepts one statement made twice when the semantic identity differs: the statement text alone decides nothing (PO 2026-09-19)', () => {
    const differentIdentity: [string, Partial<InterpretiveClaim>][] = [
      ['other grounding', { factRefs: [MONTH_TEN_GOD, 'chart.natal.pillar.year.tenGod'], methodRefs: ['ten_gods', 'positional_context'] }],
      ['other method set', { methodRefs: ['ten_gods', 'fact_relations'] }],
      ['other epistemic class', { epistemicClass: 'TENTATIVE_INTERPRETATION' }],
    ];
    for (const [what, overrides] of differentIdentity) {
      const again = recurrenceClaim({ claimId: 'draft.again', ...overrides });
      const graph = buildInterpretiveClaimGraph(draftOf([...baselineClaims(), again]), KNOWN);
      expect(graph.claims, what).toHaveLength(5);
      const sameText = graph.claims.filter((claim) => claim.statement === again.statement);
      expect(sameText, what).toHaveLength(2);
      expect(new Set(sameText.map((claim) => claim.claimId)).size, what).toBe(2);
    }
  });

  it('refuses two drafts that differ only in their themeRefs: a supplementary theme is annotation, never a second interpretation (PO 2026-09-19)', () => {
    const themed = (claimId: string, themeRefs: string[]): InterpretiveClaim => recurrenceClaim({ claimId, themeRefs });
    // Next to the baseline's own recurrence claim, which names no theme...
    expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT', [...baselineClaims(), themed('draft.again', ['theme.pillar.month'])]);
    // ...and next to each other, under two different valid theme assignments.
    expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT', [
      themed('draft.month', ['theme.pillar.month']),
      themed('draft.role', ['primary.self_role']),
    ]);
    // Control: each is acceptable on its own, and each resolves to the identity of the claim without a theme.
    const idOf = (claim: InterpretiveClaim): string | undefined => buildInterpretiveClaimGraph(draftOf([claim]), KNOWN).claims[0]?.claimId;
    const base = idOf(recurrenceClaim());
    expect(base).toBeDefined();
    expect(idOf(themed('draft.month', ['theme.pillar.month']))).toBe(base);
    expect(idOf(themed('draft.role', ['primary.self_role']))).toBe(base);
  });

  it('adds no statement rule of its own: the claim validator decides about a statement, and the graph stores it byte for byte', () => {
    const statement = recurrenceClaim().statement;
    const validation = { registry: KNOWN.registry, featureSet: deriveInterpretationFeatureSet(KNOWN.model), methodProfileRef: METHOD_PROFILE_REF };
    // Otherwise valid statements that differ only in presentation. ETBZ-30A has
    // no Unicode / typography policy (PO 2026-09-19): none is refused, none is rewritten.
    const presentational: [string, string][] = [
      ['no-break space', statement.replace(' ', '\u00a0')],
      ['zero-width joiner', statement.replace('month', 'mo\u200dnth')],
      ['emoji ZWJ sequence', `${statement} \u{1F469}\u200d\u{1F4BB}`],
      ['NFD instead of NFC', 'Re\u0301sume\u0301 of the month pillar.'],
      ['NFC', 'R\u00e9sum\u00e9 of the month pillar — \u6708.'],
      ['doubled space', statement.replace(' ', '  ')],
      ['trailing space', `${statement} `],
      ['leading space', ` ${statement}`],
      ['line feed', statement.replace(' ', '\n')],
      ['tab', statement.replace(' ', '\t')],
      ['thin space', statement.replace(' ', '\u2009')],
      ['ideographic space', statement.replace(' ', '\u3000')],
      ['line separator', statement.replace(' ', '\u2028')],
      ['zero-width space appended', `${statement}\u200b`],
      ['variation selector appended', `${statement}\ufe0f`],
    ];
    for (const [what, variant] of presentational) {
      expect(refusalOf(() => validateInterpretiveClaim(recurrenceClaim({ statement: variant }), validation)), what).toBeUndefined();
      const graph = buildInterpretiveClaimGraph(draftOf(withRecurrence({ statement: variant })), KNOWN);
      expect(graph.claims.map((claim) => claim.statement), what).toContain(variant);
    }
    // No silent normalisation: the sentence with ONE no-break space is another string,
    // hence another identity, and both are kept exactly as written.
    const nbsp = recurrenceClaim({ claimId: 'draft.nbsp', statement: statement.replace(' ', '\u00a0') });
    const both = buildInterpretiveClaimGraph(draftOf([...baselineClaims(), nbsp]), KNOWN);
    expect(both.claims).toHaveLength(5);
    expect(both.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([statement, nbsp.statement]));
    // A blank statement stays refused — by the claim validator, whose refusal the graph surfaces unchanged.
    for (const blank of ['   ', '\u00a0', '\n\t']) {
      expectClaimRefusal('CLAIM_UNGROUNDED', withRecurrence({ statement: blank }));
    }
    // Invisible-only statements: whatever the claim validator decides is the graph's decision.
    for (const invisible of ['\u200b', '\u3164', '\u2800']) {
      const byValidator = refusalOf(() => validateInterpretiveClaim(recurrenceClaim({ statement: invisible }), validation));
      const byGraph = refusalOf(() => buildInterpretiveClaimGraph(draftOf(withRecurrence({ statement: invisible })), KNOWN));
      expect(byGraph === undefined, JSON.stringify(invisible)).toBe(byValidator === undefined);
      if (byValidator !== undefined) {
        expect((byGraph as ClaimError).code).toBe((byValidator as ClaimError).code);
      }
    }
  });

  it('refuses a repeated factRef, themeRef or relation instead of counting it', () => {
    const repeated: Partial<InterpretiveClaim>[] = [
      { factRefs: [MONTH_TEN_GOD, DAY_HIDDEN_TEN_GOD, MONTH_TEN_GOD] },
      { themeRefs: ['theme.pillar.month', 'theme.pillar.month'] },
      { relations: [{ type: 'DEVELOPS', targetClaimId: H.relation }, { type: 'DEVELOPS', targetClaimId: H.relation }] },
    ];
    for (const overrides of repeated) {
      expectDraftRefusal('CLAIM_GRAPH_DUPLICATE_REF', withRecurrence(overrides));
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
      // Valid in every other respect, so that ONLY the unknown relation field can refuse it.
      { ...valid(), claims: [{ ...recurrenceClaim(), relations: [{ type: 'DEVELOPS', targetClaimId: H.relation, weight: marker }] }, relationClaim()] },
      { ...valid(), sourceBriefStructuralHash: undefined },
      { ...valid(), [marker]: 'x' },
      { ...valid(), claims: [{ ...recurrenceClaim(), [marker]: 1 }] },
      { ...valid(), claims: [{ ...recurrenceClaim(), themeRefs: [marker.repeat(40)] }] },
      { ...valid(), claims: [{ ...recurrenceClaim(), claimId: marker.repeat(40) }] },
      { ...valid(), claims: [{ ...recurrenceClaim(), relations: [{ type: 'SUPPORTS', targetClaimId: marker.repeat(40) }] }] },
    ];
    for (const draft of malformed) {
      const error = expectGraphRefusal('CLAIM_GRAPH_SCHEMA_INVALID', () => buildInterpretiveClaimGraph(draft, KNOWN));
      expect(error.message).not.toContain(marker);
    }
  });
});
