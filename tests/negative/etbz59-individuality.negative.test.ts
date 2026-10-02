/**
 * ETBZ-59 — the deterministic Anti-Boilerplate checks (tests/support/etbz59Individuality.ts) on the rehearsal's
 * drafted cases: each check passes where the contract says it should, and raises its reason code when fed the
 * case that deserves it. A check that has never failed proves nothing.
 */
import { describe, expect, it } from 'vitest';
import { PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { MetaNarrativePlanContext } from '../../src/application/interpretation/meta-narrative-plan.js';
import { contextFor, dayMasterClaim, dominantClaim, recurrenceClaim, relationClaim } from '../support/claimGraphFixture.js';
import { REMOVED_FACT_IDS, TALLY_STATEMENT, casePlanDraft, deriveCase, hourExpressionClaim, hourPressureClaim, tieClaim } from '../support/etbz59Cases.js';
import { PLAN_KNOWN, pressureClaim, resourceClaim, validPlanDraft } from '../support/metaNarrativePlanFixture.js';
import type { CaseRun } from '../support/etbz59Cases.js';
import {
  compareUnderDifference,
  dependencyCone,
  namedDifference,
  removalCheck,
  containsTerm,
  rescueCandidates,
  reuseCandidates,
  termCandidates,
  swapRevalidation,
} from '../support/etbz59Individuality.js';
import { variantChart } from '../support/etbz59Variants.js';

const codes = (findings: readonly { code: string }[]): string[] => findings.map((finding) => finding.code).sort();
const [s, n, r] = [await deriveCase('source'), await deriveCase('near'), await deriveCase('removal')];
const d = (await variantChart('distant')).model;
const delta = namedDifference(s.model, n.model);

/** The source case with one claim dropped from the graph view (an out-of-cone drift the tool must see). */
function withoutClaim(run: CaseRun, claimId: string): CaseRun {
  return { ...run, graph: { ...run.graph, claims: run.graph.claims.filter((claim) => claim.claimId !== claimId) } };
}

describe('ETBZ-59 6.2: the swap re-validation', () => {
  it('refuses the source reading on the near neighbour (the hour claim no longer holds) and on the distant foil', () => {
    expect(swapRevalidation(s, n.model, PLAN_CONTRACT_BINDINGS_V1_1)).toMatchObject({ refused: true, refusal: { stage: 'graph', code: 'CLAIM_METHOD_WITHOUT_EVIDENCE' }, findings: [] });
    expect(swapRevalidation(s, d, PLAN_CONTRACT_BINDINGS_V1_1)).toMatchObject({ refused: true, refusal: { stage: 'graph', code: 'CLAIM_UNKNOWN_FACT' }, findings: [] });
  });

  it('raises READING_VALIDATES_AGAINST_FOIL for a reading that cites nothing the foil changes (the reading against its own chart)', () => {
    const swap = swapRevalidation(s, s.model, PLAN_CONTRACT_BINDINGS_V1_1);
    expect(swap.refused).toBe(false);
    expect(codes(swap.findings)).toEqual(['READING_VALIDATES_AGAINST_FOIL']);
    expect(swap.findings[0]?.class).toBe('BLOCKING');
  });

  it('raises it for the removal case\'s reading on the source chart, whose every cited value the source shares', () => {
    expect(codes(swapRevalidation(r, s.model, PLAN_CONTRACT_BINDINGS_V1_1).findings)).toEqual(['READING_VALIDATES_AGAINST_FOIL']);
    // ... and refuses it on the near neighbour, because its distribution claim cites the tally the hour pillar feeds.
    expect(swapRevalidation(r, n.model, PLAN_CONTRACT_BINDINGS_V1_1).refused).toBe(true);
  });

  it('refuses the near neighbour\'s reading on the source (its hour claim names an identity the source does not carry)', () => {
    const swap = swapRevalidation(n, s.model, PLAN_CONTRACT_BINDINGS_V1_1);
    expect(swap).toMatchObject({ refused: true, refusal: { stage: 'graph', code: 'CLAIM_METHOD_WITHOUT_EVIDENCE' }, findings: [] });
    expect(swap.differingCitations).toHaveLength(2);
  });
});

describe('ETBZ-59 6.1 and 6.3: comparisons under the named difference', () => {
  it('names the hour pillar (and the Wu Xing weights it feeds) as the difference between S and N', () => {
    expect(delta.length).toBeGreaterThan(0);
    expect(delta.every((id) => /\.hour\./u.test(id) || id.startsWith('chart.wuxing.weight.'))).toBe(true);
  });

  it('passes S against N: the hour claim and the tally claim are recomposed, the shared claims coincide', () => {
    const result = compareUnderDifference('6.1', s, n, delta);
    expect(result.cone.claims).toHaveLength(2);
    // The one tension in the cone is the tally/day-master contrast (the builder orders tensions by claim id).
    expect(result.cone.tensions).toHaveLength(1);
    const [index] = result.cone.tensions;
    expect(s.plan.tensions[index ?? -1]?.claimRefs.map((id) => s.graph.claims.find((claim) => claim.claimId === id)?.statement).sort()).toEqual(
      [TALLY_STATEMENT, dayMasterClaim().statement].sort(),
    );
    expect(result.dependentClaims.map((claim) => claim.statementSurvives)).toEqual([false, false]);
    expect(codes(result.findings)).toEqual(['LEGITIMATE_SHARED_CLAIM']);
    expect(codes(compareUnderDifference('6.3', s, n, delta).findings)).toEqual([]);
  });

  it('raises the blocking codes when the variant is the source itself (nothing recomposed)', () => {
    const result = compareUnderDifference('6.1', s, s, delta);
    expect(codes(result.findings)).toEqual(['DEPENDENT_CLAIM_UNCHANGED_UNDER_MUTATION', 'DEPENDENT_CLAIM_UNCHANGED_UNDER_MUTATION', 'LEGITIMATE_SHARED_CLAIM', 'STYLE_VARIANCE_ONLY']);
  });

  it('raises SHARED_PRIMITIVE_THESIS and SHARED_PRIMITIVE_MOTIF when the difference reaches the thesis and a motif core and they coincide', () => {
    const pressure = s.graph.claims.find((claim) => claim.statement.startsWith('A controlling voice sits'));
    expect(pressure).toBeDefined();
    const cone = dependencyCone(s, pressure?.factRefs ?? []);
    expect(cone.thesis).toBe(true);
    expect(cone.motifs).toHaveLength(1);
    expect(codes(compareUnderDifference('6.1', s, s, pressure?.factRefs ?? []).findings)).toEqual(
      expect.arrayContaining(['SHARED_PRIMITIVE_MOTIF', 'SHARED_PRIMITIVE_THESIS']),
    );
  });

  it('raises THESIS_UNCHANGED_UNDER_CENTRAL_MUTATION when the mutated facts reach the thesis and it does not move', () => {
    const thesisFacts = s.graph.claims.filter((claim) => s.plan.reportThesis.claimRefs.includes(claim.claimId)).flatMap((claim) => claim.factRefs);
    expect(dependencyCone(s, thesisFacts).thesis).toBe(true);
    expect(codes(compareUnderDifference('6.3', s, s, thesisFacts).findings)).toContain('THESIS_UNCHANGED_UNDER_CENTRAL_MUTATION');
  });

  it('raises UNRELATED_CLAIM_DRIFTED when an out-of-cone claim is not carried by the variant', () => {
    const outOfCone = s.graph.claims.find((claim) => !dependencyCone(s, delta).claims.includes(claim.claimId));
    expect(outOfCone).toBeDefined();
    const result = compareUnderDifference('6.3', s, withoutClaim(n, outOfCone?.claimId ?? ''), delta);
    expect(codes(result.findings)).toEqual(['UNRELATED_CLAIM_DRIFTED']);
    expect(result.findings[0]?.class).toBe('ADVISORY');
  });
});

describe('ETBZ-59 6.4: the removal case', () => {
  it('passes S against S⁻: the claim citing the withdrawn relation is blocked and absent', () => {
    const result = removalCheck(s, r, REMOVED_FACT_IDS);
    expect(result.dependentClaims).toEqual([{ claimId: result.cone.claims[0], blockedCode: 'CLAIM_EXCLUDED_FACT_CITED', absent: true }]);
    expect(result.findings).toEqual([]);
  });

  it('raises EVIDENCE_REMOVED_CLAIM_SURVIVED when the "reduced" reading is the source itself', () => {
    const result = removalCheck(s, s, REMOVED_FACT_IDS);
    expect(codes(result.findings)).toEqual(['EVIDENCE_REMOVED_CLAIM_SURVIVED']);
    expect(result.dependentClaims[0]?.blockedCode).toBeNull();
  });
});

describe('ETBZ-59 candidate finders (6.4 prose, 6.7)', () => {
  const passages = [
    { path: 'chapters[0].paragraphs[0]', text: 'Im Stundenzweig wiederholt sich die Stimme der Kontrolle, wie im Monat.' },
    { path: 'chapters[1].paragraphs[0]', text: 'Die Ressource bleibt im Hintergrund und trägt leise mit.' },
  ];

  it('finds a passage only where a withdrawn subject and its position co-occur, as whole words, case-insensitively', () => {
    expect(rescueCandidates(passages, ['KONTROLLE'], ['stundenzweig']).map((passage) => passage.path)).toEqual(['chapters[0].paragraphs[0]']);
    // The subject alone is legitimate (the month keeps the same Ten God); an empty term matches nothing.
    expect(rescueCandidates(passages, ['Kontrolle'], ['Jahr'])).toEqual([]);
    expect(rescueCandidates(passages, [''], [''])).toEqual([]);
  });

  it('matches whole words only: "Wei" is not inside "Zweig" or "weitere", and a phrase matches as a phrase', () => {
    const text = [{ path: 'p', text: 'Der Erdzweig trägt weitere Zweige.' }];
    expect(termCandidates(text, ['Wei', 'Ding'])).toEqual([]);
    expect(termCandidates([{ path: 'q', text: 'Im Zweig Wei liegt Ding.' }], ['Wei']).map((passage) => passage.path)).toEqual(['q']);
    expect(termCandidates([{ path: 'r', text: 'Keine andere Wandlungsphase erhält mehr Gewicht.' }], ['mehr Gewicht']).map((passage) => passage.path)).toEqual(['r']);
    expect(containsTerm('Druck / Struktur', 'Druck / Struktur')).toBe(true);
  });

  it('finds a verbatim interpretive sentence shared by two readings, and ignores short framing', () => {
    const other = [
      { path: 'x', text: 'Ganz anders. Die Ressource bleibt im Hintergrund und trägt leise mit!' },
      { path: 'y', text: 'Kurz und gleich.' },
    ];
    const found = reuseCandidates(passages, other).verbatimSentences;
    expect(found).toEqual([{ sentence: 'die ressource bleibt im hintergrund und trägt leise mit', left: 'chapters[1].paragraphs[0]', right: 'x' }]);
    expect(reuseCandidates([{ path: 'a', text: 'Kurz und gleich.' }], other).verbatimSentences).toEqual([]);
  });
});

describe('ETBZ-59: the case plans follow the ETBZ-30B baseline (review round 2, G4)', () => {
  const ROLES: Readonly<Record<string, string>> = {
    [recurrenceClaim().statement]: 'recurrence',
    [relationClaim().statement]: 'relation',
    [dayMasterClaim().statement]: 'dayMaster',
    [dominantClaim().statement]: 'tally',
    [TALLY_STATEMENT]: 'tally',
    [tieClaim().statement]: 'tally',
    [pressureClaim().statement]: 'pressure',
    [resourceClaim().statement]: 'resource',
    [hourPressureClaim().statement]: 'hour',
    [hourExpressionClaim().statement]: 'hour',
  };
  /** A plan draft with its run bindings removed and every accepted claim id replaced by the claim's role. */
  function shape(draft: unknown, graph: InterpretiveClaimGraph): unknown {
    const roleOf = (id: string): string => ROLES[graph.claims.find((claim) => claim.claimId === id)?.statement ?? ''] ?? `UNKNOWN:${id}`;
    return JSON.parse(JSON.stringify(draft, (key, value: unknown) => {
      if (key === 'sourceBriefStructuralHash' || key === 'claimGraphStructuralHash') return undefined;
      return typeof value === 'string' && value.startsWith('claim.') ? roleOf(value) : value;
    })) as unknown;
  }
  const planContextOf = (run: CaseRun): MetaNarrativePlanContext => ({ ...contextFor(run.model), graph: run.graph, contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 });
  const baseline = shape(validPlanDraft(PLAN_KNOWN), PLAN_KNOWN.graph) as { tensions: unknown[]; chapterPlan: { narrativeOperation: string; claimRefs: string[] }[] };

  it('S⁻ is the baseline, role for role', () => {
    expect(shape(casePlanDraft('removal', planContextOf(r)), r.graph)).toEqual(baseline);
  });

  it('S is the baseline with the hour claim named in the chapter that develops the pressure motif', () => {
    const expected = structuredClone(baseline);
    expected.chapterPlan[5]?.claimRefs.push('hour');
    expect(shape(casePlanDraft('source', planContextOf(s)), s.graph)).toEqual(expected);
  });

  it('N is the baseline without the tally/day-master tension and its QUALIFY chapter, with the hour claim in the reinforcing chapter', () => {
    const expected = structuredClone(baseline);
    expected.tensions = expected.tensions.slice(0, 2);
    expected.chapterPlan[1]?.claimRefs.push('hour');
    expected.chapterPlan.splice(4, 1);
    expect(shape(casePlanDraft('near', planContextOf(n)), n.graph)).toEqual(expected);
  });
});
