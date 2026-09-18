/**
 * ETBZ-30A — InterpretiveClaimGraph: the accepted, normalised, hash-bound set of
 * `InterpretiveClaim`s of one chart.
 *
 * Positive shape, bindings, identity, determinism, counterfactuals,
 * provisionality and the PD-5 composition. The refusals live in
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
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import type {
  AcceptedInterpretiveClaim,
  ClaimGraphErrorCode,
  InterpretiveClaimGraph,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import {
  CLAIM_RELATION_TYPES,
  ClaimError,
  interpretiveClaimStructuralHash,
  validateInterpretiveClaim,
} from '../../src/application/interpretation/interpretive-claim.js';
import type { InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import {
  BAZI_METHOD_REGISTRY_V1,
  METHOD_PROFILE_REF,
  METHOD_PROFILE_VERSION,
  methodRegistryStructuralHash,
} from '../../src/application/interpretation/method-registry.js';
import {
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

const baseline = (): InterpretiveClaimGraph => buildInterpretiveClaimGraph(draftOf(baselineClaims()), KNOWN);

/** The accepted claim a draft handle became, found by its (unique) statement. */
function acceptedFor(graph: InterpretiveClaimGraph, draft: InterpretiveClaim): AcceptedInterpretiveClaim {
  const found = graph.claims.find((claim) => claim.statement === draft.statement);
  if (found === undefined) {
    throw new Error(`fixture: no accepted claim carries the statement of "${draft.claimId}"`);
  }
  return found;
}

function withoutHash(claim: AcceptedInterpretiveClaim): InterpretiveClaim {
  return {
    claimId: claim.claimId,
    statement: claim.statement,
    factRefs: claim.factRefs,
    themeRefs: claim.themeRefs,
    methodRefs: claim.methodRefs,
    epistemicClass: claim.epistemicClass,
    provisionalFactRefs: claim.provisionalFactRefs,
    relations: claim.relations,
  };
}

function expectGraphRefusal(code: ClaimGraphErrorCode, run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ClaimGraphError);
    expect((error as ClaimGraphError).code, (error as ClaimGraphError).message).toBe(code);
    return;
  }
  expect.unreachable(`expected the graph to be refused with ${code}`);
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
    for (const claim of graph.claims) {
      expect(Object.keys(claim).sort()).toEqual([
        'claimId', 'epistemicClass', 'factRefs', 'methodRefs', 'provisionalFactRefs', 'relations', 'statement', 'structuralHash', 'themeRefs',
      ]);
      expect(claim.structuralHash).toBe(interpretiveClaimStructuralHash(withoutHash(claim), METHOD_PROFILE_REF));
    }
  });

  it('accepts only claims the current claim validator accepts — and they still pass it as accepted', () => {
    const context = {
      registry: KNOWN.registry,
      featureSet: deriveInterpretationFeatureSet(KNOWN.model),
      methodProfileRef: METHOD_PROFILE_REF,
    };
    for (const claim of baseline().claims) {
      expect(() => validateInterpretiveClaim(withoutHash(claim), context)).not.toThrow();
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

  it('accepts every relation of the closed vocabulary, and a cycle between two claims', () => {
    for (const type of CLAIM_RELATION_TYPES) {
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

  it('accepts a theme of the bound brief as supplementary structure', () => {
    const themeId = KNOWN.brief.constraints.candidateThemeIds[0];
    const primaryId = KNOWN.brief.constraints.narratableThemeIds[0];
    if (themeId === undefined || primaryId === undefined) {
      throw new Error('fixture: the known-time brief has no themes');
    }
    const graph = buildInterpretiveClaimGraph(draftOf([recurrenceClaim({ themeRefs: [themeId, primaryId] })]), KNOWN);
    expect(graph.claims[0]?.themeRefs).toEqual([themeId, primaryId].sort());
  });
});

describe('ETBZ-30A G2: claim identity is semantic, and the graph is a pure function of meaning', () => {
  it('derives each claimId from the claim content, re-derivable from outside', () => {
    const graph = baseline();
    const draft = recurrenceClaim();
    const accepted = acceptedFor(graph, draft);
    expect(accepted.claimId).toBe(`claim.${structuralHash({
      methodProfileRef: METHOD_PROFILE_REF,
      statement: draft.statement,
      factRefs: [...draft.factRefs].sort(),
      themeRefs: [],
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

  it('does not let factRef, themeRef, methodRef, lineage or relation order create a difference', () => {
    const themes = KNOWN.brief.constraints.candidateThemeIds.slice(0, 2);
    expect(themes).toHaveLength(2);
    const forward = [
      recurrenceClaim({
        themeRefs: themes,
        relations: [{ type: 'DEVELOPS', targetClaimId: H.relation }, { type: 'CONTEXTUALIZES', targetClaimId: H.dayMaster }],
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
  });

  it('stores claims, refs and relations in one canonical order', () => {
    const graph = baseline();
    const ids = graph.claims.map((claim) => claim.claimId);
    expect(ids).toEqual([...ids].sort());
    for (const claim of graph.claims) {
      expect(claim.factRefs).toEqual([...claim.factRefs].sort());
      expect(claim.methodRefs).toEqual([...claim.methodRefs].sort());
    }
  });

  it('is idempotent: its own accepted claims, fed back as a draft, rebuild the same graph', () => {
    const graph = baseline();
    const again = buildInterpretiveClaimGraph(draftOf(graph.claims.map(withoutHash)), KNOWN);
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
      const graph = buildInterpretiveClaimGraph(draftOf([variant]), KNOWN);
      const id = graph.claims[0]?.claimId;
      expect(id).toBeDefined();
      expect(seen.has(id ?? '')).toBe(false);
      seen.add(id ?? '');
    }
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

  it('binds the same claims to a different chart as a different graph', () => {
    const other = buildInterpretiveClaimGraph(draftOf(baselineClaims(), hourChanged), hourChanged);
    expect(other.claims.map((claim) => claim.claimId)).toEqual(baseline().claims.map((claim) => claim.claimId));
    expect(other.sourceBriefStructuralHash).not.toBe(baseline().sourceBriefStructuralHash);
    expect(other.structuralHash).not.toBe(baseline().structuralHash);
  });

  it('loses the dependent claim when the fact it rests on materially changes', () => {
    // The month Ten God no longer equals the day's hidden one: the recurrence the
    // claim states is gone, so the claim is refused instead of surviving as prose.
    try {
      buildInterpretiveClaimGraph(draftOf(baselineClaims(), monthChanged), monthChanged);
      expect.unreachable('the recurrence claim must not survive the changed month Ten God');
    } catch (error) {
      expect(error).toBeInstanceOf(ClaimError);
      expect((error as ClaimError).code).toBe('CLAIM_METHOD_WITHOUT_EVIDENCE');
      expect((error as ClaimError).message).toContain(H.recurrence);
    }
    // Control: the claims that never depended on that identity still build.
    const independent = buildInterpretiveClaimGraph(draftOf([
      dayMasterClaim({ relations: [] }), dominantClaim(),
    ], monthChanged), monthChanged);
    expect(independent.claims).toHaveLength(2);
  });

  it('refuses a brief that is not the brief this model produces', () => {
    expectGraphRefusal('CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL', () => buildInterpretiveClaimGraph(
      draftOf(baselineClaims(), hourChanged),
      { ...KNOWN, brief: hourChanged.brief },
    ));
  });

  it('detects an accepted graph that was edited after acceptance', () => {
    const graph = baseline();
    const edited: InterpretiveClaimGraph = {
      ...graph,
      claims: graph.claims.map((claim, index) => (index === 0 ? { ...claim, epistemicClass: 'TENTATIVE_INTERPRETATION' as const } : claim)),
    };
    expectGraphRefusal('CLAIM_GRAPH_NOT_INTACT', () => { assertInterpretiveClaimGraphIntact(edited, KNOWN); });
    expectGraphRefusal('CLAIM_GRAPH_NOT_INTACT', () => { assertInterpretiveClaimGraphIntact({ ...graph, structuralHash: `${graph.structuralHash}0` }, KNOWN); });
    expectGraphRefusal('CLAIM_GRAPH_NOT_INTACT', () => { assertInterpretiveClaimGraphIntact(graph, hourChanged); });
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

  it('lets no relation upgrade certainty: relating a supported claim to a tentative one changes neither', () => {
    const graph = buildInterpretiveClaimGraph(draftOf([
      recurrenceClaim({ relations: [{ type: 'INTEGRATES', targetClaimId: H.dominant }, { type: 'SUPPORTS', targetClaimId: H.dominant }] }),
      tentativeDominantClaim({ relations: [] }),
    ], UNKNOWN), UNKNOWN);
    expect(acceptedFor(graph, dominantClaim()).epistemicClass).toBe('TENTATIVE_INTERPRETATION');
    expect(acceptedFor(graph, dominantClaim()).provisionalFactRefs).toEqual([DOMINANT]);
  });
});

describe('ETBZ-30A G5: PD-5 is composed, not re-implemented, for a claim that becomes central', () => {
  it('accepts a central claim with >= 2 fact kinds and >= 2 method contributions', () => {
    const graph = baseline();
    expect(() => { assertCentralGraphClaim(graph, acceptedFor(graph, recurrenceClaim()).claimId, KNOWN); }).not.toThrow();
    expect(() => { assertCentralGraphClaim(graph, acceptedFor(graph, relationClaim()).claimId, KNOWN); }).not.toThrow();
  });

  it('refuses a central claim below the floor — also when it is tentative and merely qualifies', () => {
    for (const draft of [dayMasterClaim(), dayMasterClaim({ epistemicClass: 'TENTATIVE_INTERPRETATION', relations: [{ type: 'ALTERNATIVE_READING', targetClaimId: H.recurrence }] })]) {
      const graph = buildInterpretiveClaimGraph(draftOf([recurrenceClaim(), draft]), KNOWN);
      try {
        assertCentralGraphClaim(graph, acceptedFor(graph, draft).claimId, KNOWN);
        expect.unreachable('a single shared primitive must not carry a thesis');
      } catch (error) {
        expect(error).toBeInstanceOf(ClaimError);
        expect((error as ClaimError).code).toBe('CLAIM_INSUFFICIENT_SIGNALS');
      }
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
      try {
        assertCentralGraphClaim(graph, acceptedFor(graph, draft).claimId, KNOWN);
        expect.unreachable(`"${draft.claimId}" satisfies only one half of PD-5`);
      } catch (error) {
        expect(error).toBeInstanceOf(ClaimError);
        expect((error as ClaimError).code).toBe('CLAIM_INSUFFICIENT_SIGNALS');
      }
    }
  });

  it('has no caller-controlled bypass and refuses a claim the graph does not contain', () => {
    expect(assertCentralGraphClaim.length).toBe(3);
    expectGraphRefusal('CLAIM_GRAPH_UNKNOWN_CLAIM', () => { assertCentralGraphClaim(baseline(), H.recurrence, KNOWN); });
  });

  it('refuses to certify a claim of a graph that is not intact', () => {
    const graph = baseline();
    const target = acceptedFor(graph, recurrenceClaim()).claimId;
    expectGraphRefusal('CLAIM_GRAPH_NOT_INTACT', () => { assertCentralGraphClaim({ ...graph, structuralHash: `${graph.structuralHash}0` }, target, KNOWN); });
  });
});
