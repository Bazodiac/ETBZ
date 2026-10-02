/**
 * ETBZ-59 — the deterministic checks of the Anti-Boilerplate contract (77266967 v3, section 6) over accepted claim
 * graphs and plans: the swap re-validation (6.2) and the graph and plan comparisons of the near-neighbour (6.1),
 * fact-mutation (6.3) and fact-removal (6.4) checks, plus the candidate finder of the cross-reading reuse scan (6.7).
 *
 * Each check returns findings in the contract's closed reason-code vocabulary (`INDIVIDUALITY_REASON_CODES`, section
 * 7), each citing the claim ids or passages it rests on; never a score (IND-7). The qualitative steps - blind
 * attribution (6.1), anchor ablation (6.5), the reuse judgement (6.7) and the paraphrase side of model-memory
 * rescue (6.4) - are not decided here: an independent instance decides them and records its reason code.
 *
 * "The same claim" follows the contract (6.1 step 2): the same `statement`. A claim id differs whenever a cited
 * value differs (the id hashes it), so ids alone would let a templated claim pass as changed.
 *
 * Composes only exported builders; nothing in `src/` changes (ADR 0015's rule for evidence orchestration, ADR 0016).
 */
import { canonicalJson } from '../../src/domain/canonical-json.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { buildInterpretiveClaimGraph, claimGraphDraftOf } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { buildMetaNarrativePlan, metaNarrativePlanDraftOf } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlan, PlanContractBindings } from '../../src/application/interpretation/meta-narrative-plan.js';
import { INDIVIDUALITY_REASON_CODES } from '../../src/application/skill/index.js';
import type { ReasonCodeClass } from '../../src/application/skill/index.js';
import { contextFor } from './claimGraphFixture.js';

export interface Finding {
  readonly check: '6.1' | '6.2' | '6.3' | '6.4' | '6.7';
  readonly code: string;
  readonly class: ReasonCodeClass;
  /** The claim ids, plan elements or passages the finding rests on. */
  readonly cites: readonly string[];
  readonly detail: string;
}

export interface GraphAndPlan {
  readonly model: HoroscopeModel;
  readonly graph: InterpretiveClaimGraph;
  readonly plan: MetaNarrativePlan;
}

function finding(check: Finding['check'], code: string, cites: readonly string[], detail: string): Finding {
  const known = INDIVIDUALITY_REASON_CODES.find((entry) => entry.code === code);
  if (known === undefined || !known.checks.includes(check)) throw new Error(`etbz59: ${code} is not a reason code of check ${check}`);
  return { check, code, class: known.class, cites: [...cites], detail };
}

const sortStrings = (values: Iterable<string>): string[] => [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

function factValues(model: HoroscopeModel): Map<string, string> {
  return new Map(deriveInterpretationFeatureSet(model).facts.map((fact) => [fact.id, canonicalJson(fact.value)]));
}

/** The named difference Δ between two charts: every fact id whose value differs, or that only one chart carries. */
export function namedDifference(left: HoroscopeModel, right: HoroscopeModel): string[] {
  const a = factValues(left);
  const b = factValues(right);
  return sortStrings(new Set([...a.keys(), ...b.keys()].filter((id) => a.get(id) !== b.get(id))));
}

const statementOf = (graph: InterpretiveClaimGraph, claimId: string): string => {
  const claim = graph.claims.find((candidate) => candidate.claimId === claimId);
  if (claim === undefined) throw new Error(`etbz59: claim ${claimId} is not in the graph`);
  return claim.statement;
};
const statementsOf = (graph: InterpretiveClaimGraph, claimIds: readonly string[]): string[] => sortStrings(claimIds.map((id) => statementOf(graph, id)));
const sameStatements = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((value, index) => value === b[index]);

// ---------------------------------------------------------------------------------------------------------------
// 6.2 — swap re-validation
// ---------------------------------------------------------------------------------------------------------------

export interface SwapResult {
  readonly refused: boolean;
  /** Where the ordinary builders refused, and with which code; null when they accepted. */
  readonly refusal: Readonly<{ stage: 'graph' | 'plan'; code: string }> | null;
  /** Diagnosis: the cited facts whose value differs on the foil (or that the foil lacks), per source claim. */
  readonly differingCitations: readonly Readonly<{ claimId: string; factIds: readonly string[] }>[];
  readonly findings: readonly Finding[];
}

const codeOf = (error: unknown): string => (typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : `THREW:${error instanceof Error ? error.name : typeof error}`);

/**
 * Re-validates the source's accepted graph and plan against the foil's chart through the ordinary builders, as if
 * they had been drafted for it. Only the run bindings are rebound (the brief hash in the graph draft; the brief and
 * graph hashes in the plan draft): they differ for any two charts and would make the check pass by construction
 * (contract 6.2). The plan draft keeps the source's ACCEPTED claim ids, which hash the cited values, so a claim
 * whose cited value differs on the foil is not a claim of the re-built graph (`PLAN_UNKNOWN_CLAIM`).
 */
export function swapRevalidation(source: GraphAndPlan, foil: HoroscopeModel, contractBindings: PlanContractBindings): SwapResult {
  const foilValues = factValues(foil);
  const sourceValues = factValues(source.model);
  const differingCitations = source.graph.claims
    .map((claim) => ({ claimId: claim.claimId, factIds: claim.factRefs.filter((id) => foilValues.get(id) !== sourceValues.get(id)) }))
    .filter((entry) => entry.factIds.length > 0);
  const context = contextFor(foil);
  let graph: InterpretiveClaimGraph;
  try {
    graph = buildInterpretiveClaimGraph({ ...claimGraphDraftOf(source.graph), sourceBriefStructuralHash: context.brief.structuralHash }, context);
  } catch (error) {
    return { refused: true, refusal: { stage: 'graph', code: codeOf(error) }, differingCitations, findings: [] };
  }
  try {
    buildMetaNarrativePlan(
      { ...metaNarrativePlanDraftOf(source.plan), sourceBriefStructuralHash: context.brief.structuralHash, claimGraphStructuralHash: graph.structuralHash },
      { ...context, graph, contractBindings },
    );
  } catch (error) {
    return { refused: true, refusal: { stage: 'plan', code: codeOf(error) }, differingCitations, findings: [] };
  }
  return {
    refused: false,
    refusal: null,
    differingCitations,
    findings: [finding('6.2', 'READING_VALIDATES_AGAINST_FOIL', source.graph.claims.map((claim) => claim.claimId), 'the claim graph and plan re-validate against the foil\'s facts')],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 6.1 / 6.3 — the claims and plan elements that depend on a set of facts
// ---------------------------------------------------------------------------------------------------------------

export interface Cone {
  readonly facts: readonly string[];
  readonly claims: readonly string[];
  readonly motifs: readonly string[];
  readonly tensions: readonly number[];
  readonly threads: readonly string[];
  readonly thesis: boolean;
}

/** The dependency cone of a fact set (contract section 3): claims citing it, and the plan elements naming those. */
export function dependencyCone(source: GraphAndPlan, facts: readonly string[]): Cone {
  const set = new Set(facts);
  const claims = sortStrings(source.graph.claims.filter((claim) => claim.factRefs.some((id) => set.has(id))).map((claim) => claim.claimId));
  const inCone = new Set(claims);
  const touches = (refs: readonly string[]): boolean => refs.some((id) => inCone.has(id));
  return {
    facts: sortStrings(set),
    claims,
    motifs: sortStrings(source.plan.primaryMotifs.filter((motif) => touches(motif.coreClaimRefs)).map((motif) => motif.motifId)),
    tensions: source.plan.tensions.flatMap((tension, index) => (touches(tension.claimRefs) ? [index] : [])),
    threads: sortStrings(source.plan.openThreads.filter((thread) => touches(thread.claimRefs)).map((thread) => thread.threadId)),
    thesis: touches(source.plan.reportThesis.claimRefs),
  };
}

export interface ComparisonResult {
  readonly cone: Cone;
  /** In-cone claims of the source, each with whether the variant still carries its statement. */
  readonly dependentClaims: readonly Readonly<{ claimId: string; statementSurvives: boolean }>[];
  /** Out-of-cone claims of the source, each with whether the variant carries it unchanged (same id). */
  readonly sharedClaims: readonly Readonly<{ claimId: string; carried: boolean }>[];
  readonly findings: readonly Finding[];
}

/**
 * The graph and plan comparison of 6.1 (near-neighbour, Δ) and of 6.3 (mutation, F -> F′); the variant's reading
 * was produced under identical conditions. In-cone claims must change, disappear or be recomposed; out-of-cone
 * claims coincide (6.1: `LEGITIMATE_SHARED_CLAIM`) or stay stable (6.3: else `UNRELATED_CLAIM_DRIFTED`).
 */
export function compareUnderDifference(check: '6.1' | '6.3', source: GraphAndPlan, variant: GraphAndPlan, facts: readonly string[]): ComparisonResult {
  const cone = dependencyCone(source, facts);
  const inCone = new Set(cone.claims);
  const variantStatements = new Set(variant.graph.claims.map((claim) => claim.statement));
  const variantIds = new Set(variant.graph.claims.map((claim) => claim.claimId));
  const findings: Finding[] = [];

  const dependentClaims = cone.claims.map((claimId) => ({ claimId, statementSurvives: variantStatements.has(statementOf(source.graph, claimId)) }));
  for (const claim of dependentClaims.filter((entry) => entry.statementSurvives)) {
    findings.push(finding(check, 'DEPENDENT_CLAIM_UNCHANGED_UNDER_MUTATION', [claim.claimId], 'a claim that cites the changed facts survives with the same statement'));
  }

  const sharedClaims = source.graph.claims
    .filter((claim) => !inCone.has(claim.claimId))
    .map((claim) => ({ claimId: claim.claimId, carried: variantIds.has(claim.claimId) }));
  if (check === '6.1') {
    const carried = sharedClaims.filter((entry) => entry.carried).map((entry) => entry.claimId);
    if (carried.length > 0) findings.push(finding('6.1', 'LEGITIMATE_SHARED_CLAIM', carried, 'claims grounded only in shared facts coincide'));
  } else {
    for (const drifted of sharedClaims.filter((entry) => !entry.carried)) {
      findings.push(finding('6.3', 'UNRELATED_CLAIM_DRIFTED', [drifted.claimId], 'an out-of-cone claim is not carried unchanged by the variant'));
    }
  }

  const sourceThesis = statementsOf(source.graph, source.plan.reportThesis.claimRefs);
  const variantThesis = statementsOf(variant.graph, variant.plan.reportThesis.claimRefs);
  if (cone.thesis && sameStatements(sourceThesis, variantThesis)) {
    findings.push(check === '6.1'
      ? finding('6.1', 'SHARED_PRIMITIVE_THESIS', source.plan.reportThesis.claimRefs, 'the thesis depends on the difference and coincides')
      : finding('6.3', 'THESIS_UNCHANGED_UNDER_CENTRAL_MUTATION', source.plan.reportThesis.claimRefs, 'the mutation reaches the thesis and the thesis did not move'));
  }
  if (check === '6.1') {
    const variantCores = variant.plan.primaryMotifs.map((motif) => statementsOf(variant.graph, motif.coreClaimRefs));
    for (const motif of source.plan.primaryMotifs.filter((candidate) => cone.motifs.includes(candidate.motifId))) {
      const core = statementsOf(source.graph, motif.coreClaimRefs);
      if (variantCores.some((other) => sameStatements(core, other))) {
        findings.push(finding('6.1', 'SHARED_PRIMITIVE_MOTIF', motif.coreClaimRefs, `the core of ${motif.motifId} depends on the difference and coincides`));
      }
    }
    const sourceAll = sortStrings(source.graph.claims.map((claim) => claim.statement));
    const variantAll = sortStrings(variant.graph.claims.map((claim) => claim.statement));
    if (facts.length > 0 && sameStatements(sourceAll, variantAll)) {
      findings.push(finding('6.1', 'STYLE_VARIANCE_ONLY', [], 'the claim graphs carry the same statements although the charts differ'));
    }
  }
  return { cone, dependentClaims, sharedClaims, findings };
}

// ---------------------------------------------------------------------------------------------------------------
// 6.4 — fact removal
// ---------------------------------------------------------------------------------------------------------------

export interface RemovalResult {
  readonly cone: Cone;
  /** Each in-cone claim: blocked when re-drafted against the reduced chart, and absent from the reduced reading. */
  readonly dependentClaims: readonly Readonly<{ claimId: string; blockedCode: string | null; absent: boolean }>[];
  readonly findings: readonly Finding[];
}

/**
 * Every claim of the source that cited the removed evidence must be BLOCKED (the ordinary builder refuses it on the
 * reduced chart) and absent from the reduced reading's graph, by id and by statement (contract 6.4). The prose side
 * (no reading carries the removed content) is `rescueCandidates` plus the independent judgement.
 */
export function removalCheck(source: GraphAndPlan, reduced: GraphAndPlan, removed: readonly string[]): RemovalResult {
  const cone = dependencyCone(source, removed);
  const context = contextFor(reduced.model);
  const draft = claimGraphDraftOf(source.graph);
  const reducedStatements = new Set(reduced.graph.claims.map((claim) => claim.statement));
  const reducedIds = new Set(reduced.graph.claims.map((claim) => claim.claimId));
  const findings: Finding[] = [];
  const dependentClaims = cone.claims.map((claimId) => {
    const claim = draft.claims.find((candidate) => candidate.claimId === claimId);
    let blockedCode: string | null = null;
    try {
      buildInterpretiveClaimGraph({ sourceBriefStructuralHash: context.brief.structuralHash, methodProfileRef: draft.methodProfileRef, claims: claim === undefined ? [] : [{ ...claim, relations: [] }] }, context);
    } catch (error) {
      blockedCode = codeOf(error);
    }
    const absent = !reducedIds.has(claimId) && !reducedStatements.has(statementOf(source.graph, claimId));
    return { claimId, blockedCode, absent };
  });
  for (const claim of dependentClaims.filter((entry) => entry.blockedCode === null || !entry.absent)) {
    findings.push(finding('6.4', 'EVIDENCE_REMOVED_CLAIM_SURVIVED', [claim.claimId], claim.blockedCode === null ? 'the builder still accepts the claim on the reduced chart' : 'the reduced reading still carries the claim'));
  }
  return { cone, dependentClaims, findings };
}

/** A paragraph of customer text with its address in the reading. */
export interface Passage {
  readonly path: string;
  readonly text: string;
}

/**
 * Candidate passages for model-memory rescue (6.4): a passage of the reduced reading that names a removed fact's
 * value or source label. Not a verdict - the symbol rule of the acceptance boundary proves a symbol was cited, not
 * its role (chart-symbol-lexicon.ts), and paraphrases escape any string scan - so every candidate goes to the
 * independent judgement, which decides `MODEL_MEMORY_RESCUE`.
 */
export function rescueCandidates(passages: readonly Passage[], terms: readonly string[]): Passage[] {
  const needles = terms.map((term) => term.toLowerCase()).filter((term) => term.length > 0);
  return passages.filter((passage) => needles.some((needle) => passage.text.toLowerCase().includes(needle)));
}

// ---------------------------------------------------------------------------------------------------------------
// 6.7 — cross-reading reuse scan: candidates only
// ---------------------------------------------------------------------------------------------------------------

const normalise = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/gu, ' ').trim();
const sentencesOf = (text: string): string[] => text.split(/(?<=[.!?…])\s+/u).map(normalise).filter((sentence) => sentence.split(' ').length >= 6);

export interface ReuseCandidates {
  /** Sentences (normalised, at least six words) that occur verbatim in both readings, with their passages. */
  readonly verbatimSentences: readonly Readonly<{ sentence: string; left: string; right: string }>[];
}

/**
 * Finds verbatim interpretive sentences shared by two readings (normalised text). The contract allows text-overlap
 * detection to FIND candidates only (6.7); whether a recurrence is a legitimate shared claim, the product's fixed
 * framing or `STOCK_PARAGRAPH_REUSE` / `TEMPLATE_SENTENCE_REUSE` is the independent judgement's.
 */
export function reuseCandidates(left: readonly Passage[], right: readonly Passage[]): ReuseCandidates {
  const index = new Map<string, string>();
  for (const passage of right) for (const sentence of sentencesOf(passage.text)) if (!index.has(sentence)) index.set(sentence, passage.path);
  const found: { sentence: string; left: string; right: string }[] = [];
  for (const passage of left) {
    for (const sentence of sentencesOf(passage.text)) {
      const match = index.get(sentence);
      if (match !== undefined) found.push({ sentence, left: passage.path, right: match });
    }
  }
  return { verbatimSentences: found };
}
