/**
 * ETBZ-30A — InterpretiveClaimGraph: the accepted, normalised, hash-bound set of
 * `InterpretiveClaim`s of one chart.
 *
 * Positive shape, bindings, identity, determinism, counterfactuals,
 * provisionality, the consistency check and the PD-5 composition — including
 * the refusals that belong to those (G3, G5). The draft-level refusals live in
 * `tests/negative/interpretive-claim-graph.negative.test.ts`.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { structuralHash } from '../../src/domain/structural-hash.js';
import {
  ClaimGraphError,
  INTERPRETIVE_CLAIM_GRAPH_VERSION,
  assertCentralGraphClaim,
  assertInterpretiveClaimGraphIntact,
  buildInterpretiveClaimGraph,
  claimGraphDraftOf,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import type {
  AcceptedInterpretiveClaim,
  ClaimGraphContext,
  ClaimGraphErrorCode,
  InterpretiveClaimGraph,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import {
  CLAIM_RELATION_TYPES,
  ClaimError,
  interpretiveClaimStructuralHash,
  validateInterpretiveClaim,
} from '../../src/application/interpretation/interpretive-claim.js';
import type { ClaimErrorCode, InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  METHOD_PROFILE_REF,
  METHOD_PROFILE_VERSION,
  MethodRegistryError,
  methodRegistryStructuralHash,
} from '../../src/application/interpretation/method-registry.js';
import type { MethodRegistry } from '../../src/application/interpretation/method-registry.js';
import {
  DAY_HIDDEN_TEN_GOD,
  DOMINANT,
  H,
  KNOWN,
  MONTH_TEN_GOD,
  UNKNOWN,
  baselineClaims,
  contextFor,
  dayMasterClaim,
  dominantClaim,
  draftOf,
  recurrenceClaim,
  relationClaim,
  tentativeDominantClaim,
} from '../support/claimGraphFixture.js';
import { knownTimeModel } from '../support/narrativeFixture.js';
import { ALTERNATE_TEN_GOD_ROW } from '../support/natalFixture.js';

/** Themes of the fixture chart that contain the month Ten God, i.e. a fact the recurrence claim cites. */
const MONTH_THEMES = ['theme.pillar.month', 'theme.tenGod.HurtingOfficer', 'primary.self_role'] as const;
const FIRE_WEIGHT = 'chart.wuxing.weight.Feuer';

const baseline = (): InterpretiveClaimGraph => buildInterpretiveClaimGraph(draftOf(baselineClaims()), KNOWN);

/**
 * The accepted claim a draft became, found by its statement. A statement is not
 * unique inside a graph in general (identity is semantic, not textual); every
 * graph this suite looks up in holds it once, and this refuses to guess otherwise.
 */
function acceptedFor(graph: InterpretiveClaimGraph, draft: InterpretiveClaim): AcceptedInterpretiveClaim {
  const found = graph.claims.filter((claim) => claim.statement === draft.statement);
  const [only] = found;
  if (found.length !== 1 || only === undefined) {
    throw new Error(`fixture: ${String(found.length)} accepted claims carry the statement of "${draft.claimId}", expected exactly one`);
  }
  return only;
}

function expectGraphRefusal(code: ClaimGraphErrorCode, run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected the graph to be refused with ${code}`).toBeInstanceOf(ClaimGraphError);
  expect((caught as ClaimGraphError).code, (caught as ClaimGraphError).message).toBe(code);
}

function expectClaimRefusal(code: ClaimErrorCode, run: () => unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected a claim refusal with ${code}`).toBeInstanceOf(ClaimError);
  expect((caught as ClaimError).code, (caught as ClaimError).message).toBe(code);
}

function collectNumbers(value: unknown, path: string, found: string[]): void {
  if (typeof value === 'number' || typeof value === 'bigint') {
    found.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => { collectNumbers(entry, `${path}[${String(index)}]`, found); });
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      collectNumbers(entry, `${path}.${key}`, found);
    }
  }
}

function driftedRegistry(): MethodRegistry {
  // A VALID edit under the released version: still a contradiction with the profile.
  const drifted = structuredClone(BAZI_METHOD_REGISTRY_V1) as unknown as { methods: { methodId: string; operations: string[] }[] };
  const tenGods = drifted.methods.find((method) => method.methodId === 'ten_gods');
  if (tenGods === undefined) {
    throw new Error('fixture: the registry has no ten_gods method');
  }
  tenGods.operations.push('RANK_BY_IMPORTANCE');
  return drifted as unknown as MethodRegistry;
}

describe('ETBZ-30A G1: a valid graph is versioned and bound to its brief and its method profile', () => {
  it('carries exactly the contract fields and nothing else', () => {
    expect(Object.keys(baseline()).sort()).toEqual([
      'claims',
      'featureSetStructuralHash',
      'graphVersion',
      'methodProfileRef',
      'methodProfileVersion',
      'methodRegistryStructuralHash',
      'sourceBriefStructuralHash',
      'structuralHash',
    ]);
  });

  it('declares its version and binds the exact brief, feature set and released profile', () => {
    const graph = baseline();
    expect(graph.graphVersion).toBe(INTERPRETIVE_CLAIM_GRAPH_VERSION);
    expect(graph.graphVersion).toBe('etbz-30.interpretive-claim-graph.v1');
    expect(graph.sourceBriefStructuralHash).toBe(KNOWN.brief.structuralHash);
    expect(graph.featureSetStructuralHash).toBe(KNOWN.brief.featureSetStructuralHash);
    expect(graph.methodProfileRef).toBe(METHOD_PROFILE_REF);
    expect(graph.methodProfileVersion).toBe(METHOD_PROFILE_VERSION);
    expect(graph.methodRegistryStructuralHash).toBe(methodRegistryStructuralHash(BAZI_METHOD_REGISTRY_V1));
  });

  it('keeps every accepted claim an InterpretiveClaim, plus the I6 hash the graph stores', () => {
    const graph = baseline();
    expect(graph.claims).toHaveLength(baselineClaims().length);
    const drafts = claimGraphDraftOf(graph).claims;
    graph.claims.forEach((claim, index) => {
      expect(Object.keys(claim).sort()).toEqual([
        'claimId', 'epistemicClass', 'factRefs', 'methodRefs', 'provisionalFactRefs', 'relations', 'statement', 'structuralHash', 'themeRefs',
      ]);
      const draft = drafts[index];
      if (draft === undefined) {
        throw new Error('fixture: the draft projection lost a claim');
      }
      expect(Object.keys(draft).sort()).toEqual([
        'claimId', 'epistemicClass', 'factRefs', 'methodRefs', 'provisionalFactRefs', 'relations', 'statement', 'themeRefs',
      ]);
      expect(claim.structuralHash).toBe(interpretiveClaimStructuralHash(draft, METHOD_PROFILE_REF));
    });
  });

  it('holds only claims that still pass the current claim validator as accepted', () => {
    const context = {
      registry: KNOWN.registry,
      featureSet: deriveInterpretationFeatureSet(KNOWN.model),
      methodProfileRef: METHOD_PROFILE_REF,
    };
    const drafts = claimGraphDraftOf(baseline()).claims;
    expect(drafts).toHaveLength(4);
    for (const claim of drafts) {
      expect(() => validateInterpretiveClaim(claim, context)).not.toThrow();
    }
  });

  it('preserves every methodRef of every claim (PD-6): none added, none dropped', () => {
    const graph = baseline();
    for (const draft of baselineClaims()) {
      expect(acceptedFor(graph, draft).methodRefs).toEqual([...draft.methodRefs].sort());
    }
  });

  it('exposes no number anywhere: no salience, rank, weight, count, confidence or score', () => {
    const found: string[] = [];
    collectNumbers(baseline(), 'graph', found);
    expect(found).toEqual([]);
  });

  it('knows exactly the seven relations of the Long-Form contract, accepts each, and accepts a cycle', () => {
    const vocabulary = ['SUPPORTS', 'QUALIFIES', 'CONTRASTS_WITH', 'CONTEXTUALIZES', 'DEVELOPS', 'INTEGRATES', 'ALTERNATIVE_READING'] as const;
    expect([...CLAIM_RELATION_TYPES]).toEqual([...vocabulary]);
    for (const type of vocabulary) {
      const graph = buildInterpretiveClaimGraph(draftOf([
        recurrenceClaim({ relations: [{ type, targetClaimId: H.relation }] }),
        relationClaim(),
      ]), KNOWN);
      const recurrence = acceptedFor(graph, recurrenceClaim());
      const relation = acceptedFor(graph, relationClaim());
      expect(recurrence.relations).toEqual([{ type, targetClaimId: relation.claimId }]);
      expect(relation.relations).toEqual([{ type: 'SUPPORTS', targetClaimId: recurrence.claimId }]);
    }
  });

  it('accepts themes of the bound brief that contain a fact the claim cites, as supplementary structure', () => {
    const graph = buildInterpretiveClaimGraph(draftOf([recurrenceClaim({ themeRefs: [...MONTH_THEMES] })]), KNOWN);
    expect(graph.claims[0]?.themeRefs).toEqual([...MONTH_THEMES].sort());
  });
});

describe('ETBZ-30A G2: claim identity is semantic, and the graph is a pure function of meaning', () => {
  it('derives each claimId from the claim content and the cited fact VALUES, re-derivable from outside', () => {
    const graph = baseline();
    const draft = recurrenceClaim();
    const accepted = acceptedFor(graph, draft);
    const citedFacts = [...draft.factRefs].sort().map((id) => {
      const fact = KNOWN.brief.facts.find((candidate) => candidate.id === id);
      if (fact === undefined) {
        throw new Error(`fixture: fact ${id} is not in the brief`);
      }
      return { id, value: fact.value };
    });
    expect(citedFacts.map((fact) => fact.value)).toEqual(['HurtingOfficer', 'HurtingOfficer']);
    expect(accepted.claimId).toBe(`claim.${structuralHash({
      methodProfileRef: METHOD_PROFILE_REF,
      statement: draft.statement,
      citedFacts,
      methodRefs: [...draft.methodRefs].sort(),
      epistemicClass: draft.epistemicClass,
      provisionalFactRefs: [],
    })}`);
    expect(accepted.claimId.startsWith('claim.sha256:')).toBe(true);
    expect(graph.claims.map((claim) => claim.claimId)).not.toContain(H.recurrence);
  });

  it('publishes a graph hash anyone can re-derive with plain SHA-256 over the canonical JSON', () => {
    const { structuralHash: published, ...core } = baseline();
    const independent = `sha256:${createHash('sha256').update(canonicalJson(core), 'utf8').digest('hex')}`;
    expect(published).toBe(independent);
  });

  it('is byte-identical for identical input', () => {
    expect(canonicalJson(baseline())).toBe(canonicalJson(baseline()));
  });

  it('does not let a draft handle enter identity: renaming every handle changes nothing', () => {
    const rename = (handle: string): string => `renamed/${handle}/by-another-run`;
    const renamed = baselineClaims().map((claim) => ({
      ...claim,
      claimId: rename(claim.claimId),
      relations: claim.relations.map((relation) => ({ ...relation, targetClaimId: rename(relation.targetClaimId) })),
    }));
    expect(canonicalJson(buildInterpretiveClaimGraph(draftOf(renamed), KNOWN))).toBe(canonicalJson(baseline()));
  });

  it('does not let claim input order create a difference', () => {
    const reversed = buildInterpretiveClaimGraph(draftOf([...baselineClaims()].reverse()), KNOWN);
    expect(canonicalJson(reversed)).toBe(canonicalJson(baseline()));
    const rotated = baselineClaims();
    rotated.push(...rotated.splice(0, 2));
    expect(canonicalJson(buildInterpretiveClaimGraph(draftOf(rotated), KNOWN))).toBe(canonicalJson(baseline()));
  });

  it('does not let factRef, themeRef, methodRef or relation order create a difference, and stores one canonical order', () => {
    const forward = [
      recurrenceClaim({
        themeRefs: [...MONTH_THEMES],
        // Two relations of the SAME type: their order can only come from the target.
        relations: [
          { type: 'DEVELOPS', targetClaimId: H.relation },
          { type: 'DEVELOPS', targetClaimId: H.dayMaster },
          { type: 'CONTEXTUALIZES', targetClaimId: H.dayMaster },
        ],
      }),
      relationClaim(),
      dayMasterClaim(),
    ];
    const backward = forward.map((claim) => ({
      ...claim,
      factRefs: [...claim.factRefs].reverse(),
      themeRefs: [...claim.themeRefs].reverse(),
      methodRefs: [...claim.methodRefs].reverse(),
      relations: [...claim.relations].reverse(),
    }));
    const left = buildInterpretiveClaimGraph(draftOf(forward), KNOWN);
    const right = buildInterpretiveClaimGraph(draftOf(backward), KNOWN);
    expect(right.claims.map((claim) => claim.claimId)).toEqual(left.claims.map((claim) => claim.claimId));
    expect(canonicalJson(right)).toBe(canonicalJson(left));

    const ids = right.claims.map((claim) => claim.claimId);
    expect(ids).toEqual([...ids].sort());
    const recurrence = acceptedFor(right, recurrenceClaim());
    expect(recurrence.factRefs).toEqual([DAY_HIDDEN_TEN_GOD, MONTH_TEN_GOD]);
    expect(recurrence.themeRefs).toEqual([...MONTH_THEMES].sort());
    expect(recurrence.methodRefs).toEqual(['fact_relations', 'positional_context', 'ten_gods']);
    expect(recurrence.relations.map((relation) => relation.type)).toEqual(['CONTEXTUALIZES', 'DEVELOPS', 'DEVELOPS']);
    const developed = recurrence.relations.filter((relation) => relation.type === 'DEVELOPS').map((relation) => relation.targetClaimId);
    expect(developed).toEqual([...developed].sort());
    expect(new Set(developed).size).toBe(2);
  });

  it('does not let the order of provisional lineage create a difference', () => {
    const lineage = (provisionalFactRefs: string[]): InterpretiveClaim => tentativeDominantClaim({
      factRefs: [DOMINANT, FIRE_WEIGHT],
      provisionalFactRefs,
      relations: [],
    });
    const left = buildInterpretiveClaimGraph(draftOf([lineage([DOMINANT, FIRE_WEIGHT])], UNKNOWN), UNKNOWN);
    const right = buildInterpretiveClaimGraph(draftOf([lineage([FIRE_WEIGHT, DOMINANT])], UNKNOWN), UNKNOWN);
    expect(left.claims[0]?.provisionalFactRefs).toEqual([DOMINANT, FIRE_WEIGHT]);
    expect(right.claims[0]?.claimId).toBe(left.claims[0]?.claimId);
    expect(canonicalJson(right)).toBe(canonicalJson(left));
  });

  it('makes provisional lineage part of identity: the same words over the same values, certain here and provisional there', () => {
    const value = (context: ClaimGraphContext): string | undefined => context.brief.facts.find((fact) => fact.id === DOMINANT)?.value;
    expect(value(KNOWN)).toBeDefined();
    expect(value(UNKNOWN)).toBe(value(KNOWN));
    const certain = buildInterpretiveClaimGraph(draftOf([dominantClaim({ epistemicClass: 'TENTATIVE_INTERPRETATION', relations: [] })], KNOWN), KNOWN);
    const provisional = buildInterpretiveClaimGraph(draftOf([tentativeDominantClaim({ relations: [] })], UNKNOWN), UNKNOWN);
    expect(certain.claims[0]?.provisionalFactRefs).toEqual([]);
    expect(provisional.claims[0]?.provisionalFactRefs).toEqual([DOMINANT]);
    expect(provisional.claims[0]?.claimId).not.toBe(certain.claims[0]?.claimId);
  });

  it('is idempotent on the draft projection of its own output', () => {
    const graph = baseline();
    const again = buildInterpretiveClaimGraph(claimGraphDraftOf(graph), KNOWN);
    expect(canonicalJson(again)).toBe(canonicalJson(graph));
    expect(() => { assertInterpretiveClaimGraphIntact(graph, KNOWN); }).not.toThrow();
  });

  it('gives genuinely different semantic content a different identity', () => {
    const base = acceptedFor(baseline(), recurrenceClaim()).claimId;
    const variants: InterpretiveClaim[] = [
      recurrenceClaim({ statement: 'The same two facts, read as a different interpretation.' }),
      recurrenceClaim({ methodRefs: ['ten_gods', 'fact_relations'] }),
      recurrenceClaim({ epistemicClass: 'TENTATIVE_INTERPRETATION' }),
      recurrenceClaim({ factRefs: [MONTH_TEN_GOD, 'chart.natal.pillar.year.tenGod'], methodRefs: ['ten_gods', 'positional_context'] }),
    ];
    const seen = new Set([base]);
    for (const variant of variants) {
      const id = buildInterpretiveClaimGraph(draftOf([variant]), KNOWN).claims[0]?.claimId;
      expect(id).toBeDefined();
      expect(seen.has(id ?? '')).toBe(false);
      seen.add(id ?? '');
    }
    expect(seen.size).toBe(variants.length + 1);
  });

  it('keeps a supplementary theme out of semantic identity and inside the structural hashes (PO 2026-09-19)', () => {
    const build = (themeRefs: string[]): InterpretiveClaimGraph => buildInterpretiveClaimGraph(draftOf([recurrenceClaim({ themeRefs })]), KNOWN);
    const bare = build([]);
    const underMonth = build(['theme.pillar.month']);
    const underRole = build(['theme.tenGod.HurtingOfficer', 'primary.self_role']);
    const none = acceptedFor(bare, recurrenceClaim());
    const month = acceptedFor(underMonth, recurrenceClaim());
    const role = acceptedFor(underRole, recurrenceClaim());
    // One interpretation: an annotation does not multiply meaning.
    expect(month.claimId).toBe(none.claimId);
    expect(role.claimId).toBe(none.claimId);
    // ...and it stays auditable: on the accepted claim, inside its I6 hash, inside the graph hash.
    expect(none.themeRefs).toEqual([]);
    expect(month.themeRefs).toEqual(['theme.pillar.month']);
    expect(role.themeRefs).toEqual(['primary.self_role', 'theme.tenGod.HurtingOfficer']);
    expect(new Set([none.structuralHash, month.structuralHash, role.structuralHash]).size).toBe(3);
    expect(new Set([bare.structuralHash, underMonth.structuralHash, underRole.structuralHash]).size).toBe(3);
    // Each is an intact graph of its own; the id does not move with a theme, so the
    // hashes are what sees a theme swapped on an accepted graph.
    expect(() => { assertInterpretiveClaimGraphIntact(underMonth, KNOWN); }).not.toThrow();
    expect(() => { assertInterpretiveClaimGraphIntact(underRole, KNOWN); }).not.toThrow();
    expectGraphRefusal('CLAIM_GRAPH_NOT_INTACT', () => {
      assertInterpretiveClaimGraphIntact({ ...underMonth, claims: [{ ...month, themeRefs: role.themeRefs }] }, KNOWN);
    });
  });

  it('moves the graph hash when a relation is added or removed, without moving any claim identity', () => {
    const withRelation = baseline();
    const without = buildInterpretiveClaimGraph(draftOf([
      recurrenceClaim(), relationClaim({ relations: [] }), dayMasterClaim(), dominantClaim(),
    ]), KNOWN);
    expect(without.claims.map((claim) => claim.claimId)).toEqual(withRelation.claims.map((claim) => claim.claimId));
    expect(without.structuralHash).not.toBe(withRelation.structuralHash);
    expect(acceptedFor(without, relationClaim()).structuralHash).not.toBe(acceptedFor(withRelation, relationClaim()).structuralHash);
    expect(acceptedFor(without, recurrenceClaim()).structuralHash).toBe(acceptedFor(withRelation, recurrenceClaim()).structuralHash);
  });
});

describe('ETBZ-30A G3: counterfactual and ablation — the graph depends on the chart it is bound to', () => {
  const hourChanged = contextFor(knownTimeModel({ natal: { pillars: { hour: { tenGod: ALTERNATE_TEN_GOD_ROW } } } }));
  const monthChanged = contextFor(knownTimeModel({ natal: { pillars: { month: { tenGod: ALTERNATE_TEN_GOD_ROW } } } }));

  it('refuses a draft written for another brief', () => {
    expect(hourChanged.brief.structuralHash).not.toBe(KNOWN.brief.structuralHash);
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_HASH_MISMATCH', () => buildInterpretiveClaimGraph(draftOf(baselineClaims(), KNOWN), hourChanged));
  });

  it('binds claims that do not touch the changed fact to a different chart as a different graph with the same claims', () => {
    const other = buildInterpretiveClaimGraph(draftOf(baselineClaims(), hourChanged), hourChanged);
    expect(other.claims.map((claim) => claim.claimId)).toEqual(baseline().claims.map((claim) => claim.claimId));
    expect(other.sourceBriefStructuralHash).not.toBe(baseline().sourceBriefStructuralHash);
    expect(other.structuralHash).not.toBe(baseline().structuralHash);
  });

  it('loses the dependent claim when the identity it rests on is gone', () => {
    // The month Ten God no longer equals the day's hidden one: the recurrence the
    // claim states is gone, so the claim is refused instead of surviving as prose.
    expectClaimRefusal('CLAIM_METHOD_WITHOUT_EVIDENCE', () => buildInterpretiveClaimGraph(draftOf(baselineClaims(), monthChanged), monthChanged));
  });

  it('changes the identity of a claim whose cited fact VALUE changed, and of no other claim', () => {
    const survivors = [relationClaim({ relations: [] }), dayMasterClaim({ relations: [] }), dominantClaim()];
    const before = buildInterpretiveClaimGraph(draftOf(survivors, KNOWN), KNOWN);
    const after = buildInterpretiveClaimGraph(draftOf(survivors, monthChanged), monthChanged);
    // Same draft, same fact ids — but the month Ten God is now a different fact.
    expect(acceptedFor(after, relationClaim()).claimId).not.toBe(acceptedFor(before, relationClaim()).claimId);
    expect(acceptedFor(after, dayMasterClaim()).claimId).toBe(acceptedFor(before, dayMasterClaim()).claimId);
    expect(acceptedFor(after, dominantClaim()).claimId).toBe(acceptedFor(before, dominantClaim()).claimId);
  });

  it('refuses a brief that is not the brief this model produces', () => {
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL', () => buildInterpretiveClaimGraph(
      draftOf(baselineClaims(), hourChanged),
      { ...KNOWN, brief: hourChanged.brief },
    ));
    // The draft names the RIGHT brief; only the supplied brief object is foreign.
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL', () => buildInterpretiveClaimGraph(
      draftOf(baselineClaims(), KNOWN),
      { ...KNOWN, brief: hourChanged.brief },
    ));
  });

  it('compares the whole brief, not the hash it prints on itself', () => {
    const forged = { ...KNOWN.brief, facts: KNOWN.brief.facts.slice(1) };
    expect(forged.structuralHash).toBe(KNOWN.brief.structuralHash);
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL', () => buildInterpretiveClaimGraph(draftOf(baselineClaims()), { ...KNOWN, brief: forged }));
    // A brief that cannot even be canonicalised is not this model's brief either.
    const unhashable = { ...KNOWN.brief, weight: 10n } as unknown as ClaimGraphContext['brief'];
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL', () => buildInterpretiveClaimGraph(draftOf(baselineClaims()), { ...KNOWN, brief: unhashable }));
  });

  it('refuses a graph that is not exactly what its own claims produce for this chart', () => {
    const graph = baseline();
    const first = graph.claims[0];
    if (first === undefined) {
      throw new Error('fixture: the baseline graph has no claim');
    }
    const forgeries: [string, InterpretiveClaimGraph, ClaimGraphContext][] = [
      ['an edited claim', { ...graph, claims: [{ ...first, epistemicClass: 'TENTATIVE_INTERPRETATION' }, ...graph.claims.slice(1)] }, KNOWN],
      ['an edited graph hash', { ...graph, structuralHash: `${graph.structuralHash}0` }, KNOWN],
      ['another chart', graph, hourChanged],
      ['a number smuggled onto a claim', { ...graph, claims: [{ ...first, salience: 0.9 } as AcceptedInterpretiveClaim, ...graph.claims.slice(1)] }, KNOWN],
      ['a number smuggled onto the graph', { ...graph, rank: 1 } as InterpretiveClaimGraph, KNOWN],
      ['a value that cannot be canonicalised', { ...graph, weight: 10n } as unknown as InterpretiveClaimGraph, KNOWN],
      ['claims out of canonical order', { ...graph, claims: [...graph.claims].reverse() }, KNOWN],
      ['a claim edited into one the claim contract refuses', { ...graph, claims: [{ ...first, factRefs: [...first.factRefs, 'chart.natal.pillar.month.luck'] }, ...graph.claims.slice(1)] }, KNOWN],
      ['no claims at all', { ...graph, claims: null } as unknown as InterpretiveClaimGraph, KNOWN],
      ['a claim slot that is not a claim', { ...graph, claims: [null, ...graph.claims.slice(1)] } as unknown as InterpretiveClaimGraph, KNOWN],
      ['not a graph', null as unknown as InterpretiveClaimGraph, KNOWN],
    ];
    for (const [what, forged, context] of forgeries) {
      let caught: unknown;
      try {
        assertInterpretiveClaimGraphIntact(forged, context);
      } catch (error) {
        caught = error;
      }
      expect(caught, what).toBeInstanceOf(ClaimGraphError);
      expect((caught as ClaimGraphError).code, what).toBe('CLAIM_GRAPH_NOT_INTACT');
    }
  });

  it('does not re-label a contradiction with the released profile as a damaged graph', () => {
    let caught: unknown;
    try {
      assertInterpretiveClaimGraphIntact(baseline(), { ...KNOWN, registry: driftedRegistry() });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MethodRegistryError);
    expect((caught as MethodRegistryError).code).toBe('REGISTRY_NOT_RELEASED');
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL', () => { assertInterpretiveClaimGraphIntact(baseline(), { ...KNOWN, brief: hourChanged.brief }); });
  });
});

describe('ETBZ-30A G4: provisional lineage passes through the graph unchanged', () => {
  it('keeps a tentative claim tentative, with exactly its declared lineage', () => {
    const graph = buildInterpretiveClaimGraph(draftOf([
      recurrenceClaim(), tentativeDominantClaim({ relations: [{ type: 'CONTRASTS_WITH', targetClaimId: H.recurrence }] }),
    ], UNKNOWN), UNKNOWN);
    const dominant = acceptedFor(graph, dominantClaim());
    expect(dominant.epistemicClass).toBe('TENTATIVE_INTERPRETATION');
    expect(dominant.provisionalFactRefs).toEqual([DOMINANT]);
    const recurrence = acceptedFor(graph, recurrenceClaim());
    expect(recurrence.epistemicClass).toBe('SUPPORTED_INTERPRETATION');
    expect(recurrence.provisionalFactRefs).toEqual([]);
  });

  it('is per claim and per chart: the same claim is certain where the source is certain', () => {
    const known = buildInterpretiveClaimGraph(draftOf([dominantClaim({ relations: [] })]), KNOWN);
    expect(known.claims[0]?.epistemicClass).toBe('SUPPORTED_INTERPRETATION');
    expect(known.claims[0]?.provisionalFactRefs).toEqual([]);
  });

  it('lets no relation move certainty in either direction: source and target both stay what their own facts make them', () => {
    const graph = buildInterpretiveClaimGraph(draftOf([
      recurrenceClaim({ relations: [{ type: 'INTEGRATES', targetClaimId: H.dominant }, { type: 'SUPPORTS', targetClaimId: H.dominant }] }),
      tentativeDominantClaim({ relations: [] }),
    ], UNKNOWN), UNKNOWN);
    expect(acceptedFor(graph, dominantClaim()).epistemicClass).toBe('TENTATIVE_INTERPRETATION');
    expect(acceptedFor(graph, dominantClaim()).provisionalFactRefs).toEqual([DOMINANT]);
    expect(acceptedFor(graph, recurrenceClaim()).epistemicClass).toBe('SUPPORTED_INTERPRETATION');
    expect(acceptedFor(graph, recurrenceClaim()).provisionalFactRefs).toEqual([]);
  });
});

describe('ETBZ-30A G5: PD-5 is composed, not re-implemented, for a claim that becomes central', () => {
  it('accepts a central claim with >= 2 fact kinds and >= 2 non-modifier method contributions', () => {
    const graph = baseline();
    expect(() => { assertCentralGraphClaim(graph, acceptedFor(graph, recurrenceClaim()).claimId, KNOWN); }).not.toThrow();
    expect(() => { assertCentralGraphClaim(graph, acceptedFor(graph, relationClaim()).claimId, KNOWN); }).not.toThrow();
  });

  it('refuses a central claim below the floor — also when it is tentative and merely qualifies', () => {
    for (const draft of [dayMasterClaim(), dayMasterClaim({ epistemicClass: 'TENTATIVE_INTERPRETATION', relations: [{ type: 'ALTERNATIVE_READING', targetClaimId: H.recurrence }] })]) {
      const graph = buildInterpretiveClaimGraph(draftOf([recurrenceClaim(), draft]), KNOWN);
      const claimId = acceptedFor(graph, draft).claimId;
      expectClaimRefusal('CLAIM_INSUFFICIENT_SIGNALS', () => { assertCentralGraphClaim(graph, claimId, KNOWN); });
    }
  });

  it('requires BOTH halves of the floor: two methods over one fact kind, or two kinds under one method, stay refused', () => {
    const oneKindTwoMethods: InterpretiveClaim = {
      claimId: 'draft.oneKind',
      statement: 'The same hidden voice sits inside the year branch and inside the month branch.',
      factRefs: ['chart.natal.pillar.year.hiddenStem.0.tenGod', 'chart.natal.pillar.month.hiddenStem.0.tenGod'],
      themeRefs: [],
      methodRefs: ['ten_gods', 'fact_relations'],
      epistemicClass: 'SUPPORTED_INTERPRETATION',
      provisionalFactRefs: [],
      relations: [],
    };
    const twoKindsOneMethod = relationClaim({ claimId: 'draft.oneMethod', methodRefs: ['ten_gods'], relations: [] });
    for (const draft of [oneKindTwoMethods, twoKindsOneMethod]) {
      const graph = buildInterpretiveClaimGraph(draftOf([draft]), KNOWN);
      const claimId = acceptedFor(graph, draft).claimId;
      expectClaimRefusal('CLAIM_INSUFFICIENT_SIGNALS', () => { assertCentralGraphClaim(graph, claimId, KNOWN); });
    }
  });

  it('does not count the modifier as a contribution: two kinds under one method plus positional_context stay refused (PO 2026-09-19)', () => {
    const qualified = recurrenceClaim({ methodRefs: ['ten_gods', 'positional_context'] });
    // The claim itself is valid and accepted into the graph; it only cannot be central.
    const graph = buildInterpretiveClaimGraph(draftOf([qualified]), KNOWN);
    const accepted = acceptedFor(graph, qualified);
    expect(accepted.methodRefs).toEqual(['positional_context', 'ten_gods']);
    expectClaimRefusal('CLAIM_INSUFFICIENT_SIGNALS', () => { assertCentralGraphClaim(graph, accepted.claimId, KNOWN); });
    // Counterfactual: a second reading method next to the modifier makes it central.
    const read = recurrenceClaim();
    const readGraph = buildInterpretiveClaimGraph(draftOf([read]), KNOWN);
    expect(() => { assertCentralGraphClaim(readGraph, acceptedFor(readGraph, read).claimId, KNOWN); }).not.toThrow();
  });

  it('has no caller-controlled bypass: three parameters, and a fourth argument changes nothing', () => {
    expect(assertCentralGraphClaim.length).toBe(3);
    const graph = buildInterpretiveClaimGraph(draftOf([recurrenceClaim(), dayMasterClaim()]), KNOWN);
    const claimId = acceptedFor(graph, dayMasterClaim()).claimId;
    const withFlag = assertCentralGraphClaim as (...args: unknown[]) => void;
    expectClaimRefusal('CLAIM_INSUFFICIENT_SIGNALS', () => { withFlag(graph, claimId, KNOWN, { declaredDistinctiveSingleConfiguration: true }); });
  });

  it('refuses a claim the graph does not contain — a draft handle is not an accepted claim', () => {
    expectGraphRefusal('CLAIM_GRAPH_UNKNOWN_CLAIM', () => { assertCentralGraphClaim(baseline(), H.recurrence, KNOWN); });
  });

  it('refuses to certify a claim of a graph that is not intact', () => {
    const graph = baseline();
    const target = acceptedFor(graph, recurrenceClaim()).claimId;
    expectGraphRefusal('CLAIM_GRAPH_NOT_INTACT', () => { assertCentralGraphClaim({ ...graph, structuralHash: `${graph.structuralHash}0` }, target, KNOWN); });
  });
});
