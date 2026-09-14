/**
 * ETBZ-30 C2 - InterpretiveClaimGraph: accepted interpretive MEANING, persisted
 * as a grounded deterministic structure before any of it becomes prose.
 *
 * This is the semantic counterpart of `report-model.ts`. That module validates
 * SENTENCES against the chart; this one validates CLAIMS - and it exists
 * because the canonical contract (Confluence `ETBZ - Long-Form Meta-Narrative
 * Contract v1`, section 4.4) states that prose is a rendering of accepted
 * claims and is NOT the persistence layer for meaning. A long-form report that
 * recovered its own coherence by re-reading its earlier paragraphs would be
 * deriving meaning from text nobody validated; this graph is what makes that
 * unnecessary.
 *
 * WHAT IS TRUSTED, AND WHAT IS NOT. The synthesis output is untrusted input in
 * exactly the sense a narrative provider's answer is. The brief handed
 * alongside it is untrusted too: it is RE-DERIVED from the HoroscopeModel here
 * and the supplied one is only ever compared against that, never believed. A
 * tampered brief would otherwise validate a tampered graph - the same reason
 * `buildReportModel` re-derives the chain rather than reading the brief it was
 * given.
 *
 * SYMBOLIC CHART TRUTH IS NEVER PRODUCED HERE. FuFirE and the approved
 * deterministic mappings remain the only source of chart facts. Nothing in this
 * module adds, repairs, recalculates or overwrites one: a `factRef` is a
 * reference-and-echo pair, the echo is compared against the chart, and a claim
 * that could only be grounded by inventing a fact is a blocked run rather than
 * a new fact.
 *
 * THREE DECISIONS THAT ARE LOAD-BEARING, STATED SO THEY CANNOT DRIFT:
 *
 *  1. `providerId` IS NOT MEANING. It never reaches the accepted graph - not as
 *     a field, not through `claimId`, not through `structuralHash`. Which
 *     provider answered is provenance, and provenance belongs to the generation
 *     manifest, not to the semantic identity of an interpretation. Changing
 *     only `providerId` on otherwise identical input therefore produces a
 *     byte-equivalent graph, which the unit tests measure rather than assume.
 *
 *  2. IDENTITY IS THE APPLICATION'S, NOT THE PROVIDER'S. A `draftRef` is a
 *     local handle a provider uses to point its own relations at its own
 *     claims, and it is discarded once those relations are resolved. The
 *     accepted `claimId` is derived from the claim's CANONICAL SEMANTIC
 *     IDENTITY - statement, normalized accepted fact refs, normalized accepted
 *     theme refs, epistemic class - so it cannot depend on the provider, on the
 *     handle it chose, on where the claim sat in the answer, or on how many
 *     times it repeated a reference. Two drafts that mean the same thing
 *     therefore collide by construction and are refused as duplicate content,
 *     rather than becoming two weighted copies of one claim.
 *
 *  3. RELATIONS CARRY NO EPISTEMIC WEIGHT. A relation records THAT two accepted
 *     claims interact and HOW. It references no fact, carries no certainty, no
 *     provisionality and no salience, and it does not participate in grounding:
 *     provisionality travels with the FACT and with the approved themes a claim
 *     rests on, and nothing else. Adding, removing or reordering relations
 *     therefore cannot move a claim's `provisionalFactIds`, `provisionalLineage`
 *     or `epistemicClass` - asserted from the outside in the unit tests. There
 *     is no relation-lineage table, and NO ACYCLICITY REQUIREMENT: the canonical
 *     contract states none, and inventing one here would refuse legitimate
 *     readings on a rule nobody approved.
 *
 * WHAT THIS MODULE DOES NOT DO. It builds no `MetaNarrativePlan`, no chapter
 * plan, no motif lifecycle and no prose. It also parses no provider wire
 * format: `interpretiveClaimSynthesisOutputSchema` is the application port's
 * output contract, and a narrower model-wire schema belongs with the adapter
 * that one day reads a real answer.
 */

import { structuralHash } from '../../domain/structural-hash.js';
import type { HoroscopeModel } from '../horoscope-model.js';
import { interpretiveClaimSynthesisOutputSchema } from '../ports/interpretive-claim-provider.js';
import type { InterpretiveClaimDraft } from '../ports/interpretive-claim-provider.js';
import { findUncitedNumerals, findUncitedSymbols } from './chart-symbol-lexicon.js';
import { InterpretiveClaimError } from './errors.js';
import type { ChartFact } from './feature-set.js';
import type {
  ClaimRelationType,
  InterpretiveClaimEpistemicClass,
} from './interpretive-claim.js';
import { findOutOfScopeMethod } from './method-scope.js';
import { buildNarrativeChain } from './narrative-brief.js';
import type { NarrativeBrief } from './narrative-brief.js';
import type { PrimaryTheme } from './primary-theme.js';

export const INTERPRETIVE_CLAIM_GRAPH_VERSION = 'etbz-30.interpretive-claim-graph.v1' as const;

/**
 * One accepted unit of interpretive meaning.
 *
 * It carries NO number: no score, no rank, no weight, no confidence, no
 * salience and no cardinality - the same discipline `PrimaryTheme` and `Theme`
 * already hold. A numeric field beside a claim is read as importance by
 * whatever consumes it next, and no chart fact supports such a number.
 */
export interface AcceptedInterpretiveClaim {
  /** Derived from the claim's semantic identity. Never provider-supplied. */
  readonly claimId: string;
  readonly statement: string;
  /** Accepted fact ids, sorted and de-duplicated. No echoed values. */
  readonly factRefs: readonly string[];
  /** Accepted narratable theme ids, sorted and de-duplicated. */
  readonly themeRefs: readonly string[];
  readonly epistemicClass: InterpretiveClaimEpistemicClass;
  /** The provisional facts inside this claim's own grounding closure. */
  readonly provisionalFactIds: readonly string[];
  readonly provisionalLineage: boolean;
}

/** Two accepted claim identities and the relation between them. Nothing else. */
export interface AcceptedClaimRelation {
  readonly from: string;
  readonly type: ClaimRelationType;
  readonly to: string;
}

export interface InterpretiveClaimGraph {
  readonly graphVersion: typeof INTERPRETIVE_CLAIM_GRAPH_VERSION;
  /**
   * The brief this graph was accepted against.
   *
   * One binding, not five. The brief hash already commits to the feature set,
   * the theme graph, the primary projection and the chart's own canonical text,
   * because each of those hashes is inside the brief that produced it. Copying
   * the whole chain in here would publish four values that can never
   * independently disagree with this one.
   */
  readonly sourceBriefHash: string;
  readonly claims: readonly AcceptedInterpretiveClaim[];
  readonly relations: readonly AcceptedClaimRelation[];
  readonly structuralHash: string;
}

export interface BuildInterpretiveClaimGraphInput {
  readonly model: HoroscopeModel;
  /** The brief the provider was handed. Verified against `model`, never trusted. */
  readonly brief: NarrativeBrief;
  /** Raw synthesis output. Untrusted: schema-checked before anything reads it. */
  readonly synthesisOutput: unknown;
}

/** The canonical semantic identity a `claimId` is derived from. */
export interface InterpretiveClaimIdentity {
  readonly statement: string;
  readonly factRefs: readonly string[];
  readonly themeRefs: readonly string[];
  readonly epistemicClass: InterpretiveClaimEpistemicClass;
}

function sortStrings(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return sortStrings([...new Set(values)]);
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * The claim's stable identity.
 *
 * Exported so that "the id is a pure function of the accepted meaning" is a
 * property a test can re-derive from outside, rather than an assertion in a
 * comment. Every input is already normalized by the caller: the fact and theme
 * refs are sorted and de-duplicated, so neither input order nor a repeated
 * reference can reach the digest.
 */
export function deriveInterpretiveClaimId(identity: InterpretiveClaimIdentity): string {
  return `claim.${structuralHash({
    statement: identity.statement,
    factRefs: identity.factRefs,
    themeRefs: identity.themeRefs,
    epistemicClass: identity.epistemicClass,
  })}`;
}

/**
 * The graph's structural anchor, re-derivable from the graph itself.
 *
 * Every field that describes WHAT WAS ACCEPTED is inside it, and nothing else
 * is: no provider, no model, no route, no clock. The unit suite re-derives the
 * published value with `node:crypto` over the canonical text, so this is
 * measured rather than claimed.
 */
export function hashInterpretiveClaimGraph(
  graph: Omit<InterpretiveClaimGraph, 'structuralHash'>,
): string {
  return structuralHash({
    graphVersion: graph.graphVersion,
    sourceBriefHash: graph.sourceBriefHash,
    claims: graph.claims,
    relations: graph.relations,
  });
}

interface ValidatedClaim {
  readonly draftRef: string;
  readonly claim: AcceptedInterpretiveClaim;
}

/**
 * Validates ONE draft against the trusted brief.
 *
 * The order of the checks is the order in which a failure is most specific:
 * meaning, then grounding existence, then each reference, then the closure the
 * references imply, then what the statement is allowed to say given that
 * closure. Every branch below is reachable from a real synthesis answer.
 */
function validateClaim(
  draft: InterpretiveClaimDraft,
  factsById: ReadonlyMap<string, ChartFact>,
  primaryThemesById: ReadonlyMap<string, PrimaryTheme>,
  candidateThemeIds: ReadonlySet<string>,
): AcceptedInterpretiveClaim {
  if (isBlank(draft.statement)) {
    // The port's schema already refuses an EMPTY statement; a whitespace-only
    // one satisfies that floor and still says nothing. Nothing is repaired
    // here: ETBZ does not author the meaning a provider failed to supply.
    throw new InterpretiveClaimError(
      'CLAIM_UNGROUNDED_INTERPRETATION',
      `claim "${draft.draftRef}" carries a statement with no meaning; an empty interpretation is not a claim`,
    );
  }

  if (draft.factRefs.length === 0 && draft.themeRefs.length === 0) {
    throw new InterpretiveClaimError(
      'CLAIM_UNGROUNDED_INTERPRETATION',
      `claim "${draft.draftRef}" references neither a chart fact nor an approved theme; interpretation without grounding is refused`,
    );
  }

  // EVERY OCCURRENCE is validated BEFORE de-duplication. A pair consisting of
  // one correct echo and one mutated echo of the same fact would otherwise
  // collapse to whichever came first, and the mutation would be accepted by
  // being written twice - the cheapest way to smuggle a changed chart fact.
  const acceptedFactIds: string[] = [];
  for (const reference of draft.factRefs) {
    const fact = factsById.get(reference.factId);
    if (fact === undefined) {
      // `factsById` is the brief's OWN allowlist (see
      // `buildInterpretiveClaimGraph`), so "absent from this map" and "not in
      // allowedFactIds" are one condition rather than two checks, one of which
      // could never fail.
      throw new InterpretiveClaimError(
        'CLAIM_UNKNOWN_FACT',
        `claim "${draft.draftRef}" references fact "${reference.factId}", which is not an allowed fact of this chart`,
      );
    }
    if (reference.value !== fact.value) {
      throw new InterpretiveClaimError(
        'CLAIM_FACT_MUTATED',
        `claim "${draft.draftRef}" restates fact "${fact.id}" (${fact.path}) with a value the HoroscopeModel does not carry; a provider may not change a chart fact`,
      );
    }
    acceptedFactIds.push(fact.id);
  }

  const acceptedThemes: PrimaryTheme[] = [];
  for (const themeRef of draft.themeRefs) {
    const theme = primaryThemesById.get(themeRef);
    if (theme === undefined) {
      // A candidate id is a DIFFERENT mistake from an invented one. The
      // candidate theme genuinely exists and is readable in the brief as
      // structural nuance - it is simply not semantic authorization for a
      // claim, and saying so is the difference between a one-step fix and a
      // guess.
      if (candidateThemeIds.has(themeRef)) {
        throw new InterpretiveClaimError(
          'CLAIM_CANDIDATE_THEME_NOT_APPROVED',
          `claim "${draft.draftRef}" references candidate theme "${themeRef}"; candidate themes are structural nuance and never authorize an interpretive claim`,
        );
      }
      throw new InterpretiveClaimError(
        'CLAIM_UNKNOWN_THEME',
        `claim "${draft.draftRef}" references theme "${themeRef}", which this brief does not contain`,
      );
    }
    acceptedThemes.push(theme);
  }

  const factRefs = sortedUnique(acceptedFactIds);
  const themeRefs = sortedUnique(acceptedThemes.map((theme) => theme.id));

  // THE GROUNDING CLOSURE: the facts referenced directly, plus every fact owned
  // by an approved theme the claim rests on. This is what the claim actually
  // stands on, and therefore the only correct basis for both its provisional
  // lineage and what its statement is allowed to name.
  const groundingFactIds = new Set<string>(factRefs);
  for (const theme of acceptedThemes) {
    for (const factId of theme.factIds) {
      groundingFactIds.add(factId);
    }
  }

  const groundingFacts: ChartFact[] = [];
  for (const factId of groundingFactIds) {
    const fact = factsById.get(factId);
    if (fact !== undefined) {
      groundingFacts.push(fact);
    }
  }

  // Provisionality derives from the claim's OWN accepted grounding and from
  // nothing else. No relation contributes to it, in either direction.
  const provisionalFactIds = sortStrings(
    groundingFacts.filter((fact) => fact.provisional).map((fact) => fact.id),
  );
  const provisionalLineage = provisionalFactIds.length > 0;

  if (provisionalLineage && draft.epistemicClass === 'SUPPORTED_INTERPRETATION') {
    throw new InterpretiveClaimError(
      'CLAIM_PROVISIONAL_LINEAGE_LAUNDERED',
      `claim "${draft.draftRef}" rests on provisional facts (${provisionalFactIds.join(', ')}) and declares itself SUPPORTED_INTERPRETATION; the source's uncertainty must not be upgraded by restating it more firmly`,
    );
  }

  // What the statement may name: the values and source labels of the facts the
  // claim is actually grounded in. The same two lexicons the report gate uses,
  // deliberately NOT duplicated here.
  const covered = new Set<string>();
  for (const fact of groundingFacts) {
    covered.add(fact.value);
    if (fact.sourceLabel !== null) {
      covered.add(fact.sourceLabel);
    }
  }

  const outOfScope = findOutOfScopeMethod(draft.statement);
  if (outOfScope !== null) {
    throw new InterpretiveClaimError(
      'CLAIM_OUT_OF_METHOD_SCOPE',
      `claim "${draft.draftRef}" invokes "${outOfScope.term}"; method "${outOfScope.methodId}" is not_evaluated in this slice (insufficient_method_scope)`,
    );
  }

  const uncitedSymbols = findUncitedSymbols(draft.statement, covered);
  if (uncitedSymbols.length > 0) {
    throw new InterpretiveClaimError(
      'CLAIM_UNCITED_SYMBOL',
      `claim "${draft.draftRef}" names chart symbols its grounding does not cover: ${uncitedSymbols.join(', ')}`,
    );
  }

  const uncitedNumbers = findUncitedNumerals(draft.statement, covered);
  if (uncitedNumbers.length > 0) {
    throw new InterpretiveClaimError(
      'CLAIM_UNCITED_NUMBER',
      `claim "${draft.draftRef}" states numbers its grounding does not cover: ${uncitedNumbers.join(', ')}; a quantity is a chart fact`,
    );
  }

  return {
    claimId: deriveInterpretiveClaimId({
      statement: draft.statement,
      factRefs,
      themeRefs,
      epistemicClass: draft.epistemicClass,
    }),
    statement: draft.statement,
    factRefs,
    themeRefs,
    epistemicClass: draft.epistemicClass,
    provisionalFactIds,
    provisionalLineage,
  };
}

/** A relation exactly as the port's parsed output supplies it. */
interface ResolvableRelation {
  readonly from: string;
  readonly type: ClaimRelationType;
  readonly to: string;
}

/**
 * Resolves the provider's own relation drafts onto accepted claim identities,
 * then normalizes them.
 *
 * Normalization is what stops input shape from becoming narrative weight: an
 * identical relation repeated ten times is one relation, and the published
 * order is lexicographic rather than the order the provider happened to write.
 */
function resolveRelations(
  relations: readonly ResolvableRelation[],
  claimIdByDraftRef: ReadonlyMap<string, string>,
): readonly AcceptedClaimRelation[] {
  const resolved = new Map<string, AcceptedClaimRelation>();
  for (const relation of relations) {
    const from = claimIdByDraftRef.get(relation.from);
    const to = claimIdByDraftRef.get(relation.to);
    if (from === undefined || to === undefined) {
      // Endpoint existence is checked before self-reference: a relation naming
      // a handle this answer does not contain is the more fundamental failure,
      // and reporting it as a self relation would name a symptom.
      const missing = from === undefined ? relation.from : relation.to;
      throw new InterpretiveClaimError(
        'CLAIM_RELATION_UNKNOWN_ENDPOINT',
        `relation "${relation.from}" ${relation.type} "${relation.to}" names "${missing}", which is not a claim of this answer`,
      );
    }
    if (relation.from === relation.to) {
      throw new InterpretiveClaimError(
        'CLAIM_RELATION_SELF_REFERENCE',
        `relation "${relation.from}" ${relation.type} "${relation.to}" points a claim at itself; a claim does not relate to itself`,
      );
    }
    // Keyed on the ACCEPTED triple, so two relations written with different
    // draft handles that resolve to the same pair collapse to one. The
    // separator cannot occur inside a claim id or a relation type.
    resolved.set(`${from} -> ${relation.type} -> ${to}`, { from, type: relation.type, to });
  }
  return [...resolved.values()].sort((left, right) => {
    if (left.from !== right.from) return left.from < right.from ? -1 : 1;
    if (left.type !== right.type) return left.type < right.type ? -1 : 1;
    if (left.to !== right.to) return left.to < right.to ? -1 : 1;
    return 0;
  });
}

/**
 * Validates a synthesis answer and assembles the accepted graph. Throws
 * `InterpretiveClaimError` and returns nothing partial.
 *
 * Pure: no clock, no randomness, no network, no provider. The same model, brief
 * and answer produce a byte-identical graph, including its structural hash.
 */
export function buildInterpretiveClaimGraph(
  input: BuildInterpretiveClaimGraphInput,
): InterpretiveClaimGraph {
  const { model, brief, synthesisOutput } = input;

  // The chain is RE-DERIVED from the model, exactly as `buildReportModel` does.
  // The supplied brief is compared against it and is never the authority.
  const rederived = buildNarrativeChain(model);
  if (brief.structuralHash !== rederived.brief.structuralHash) {
    throw new InterpretiveClaimError(
      'CLAIM_BRIEF_NOT_DERIVED_FROM_MODEL',
      'the supplied brief is not the brief this HoroscopeModel produces; a claim graph is never accepted against an unverified brief',
    );
  }
  const trusted = rederived.brief;

  const parsed = interpretiveClaimSynthesisOutputSchema.safeParse(synthesisOutput);
  if (!parsed.success) {
    // Path + code only. A shape violation says nothing useful about the value,
    // and the value is the part most likely to be untrusted bulk. The semantic
    // refusals above DO name the offending fact, theme or handle, because there
    // the identifier is the finding.
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.code}`)
      .join('; ');
    throw new InterpretiveClaimError(
      'CLAIM_SYNTHESIS_SCHEMA_INVALID',
      `synthesis output does not satisfy the interpretive claim schema (${issues})`,
    );
  }
  const output = parsed.data;

  if (output.briefStructuralHash !== trusted.structuralHash) {
    throw new InterpretiveClaimError(
      'CLAIM_BRIEF_HASH_MISMATCH',
      'the synthesis answer names a different brief than the one being validated',
    );
  }

  // The brief's own allowlist IS the domain of this map, so a fact outside it
  // cannot be looked up at all.
  const allowedFactIds = new Set<string>(trusted.constraints.allowedFactIds);
  const factsById = new Map<string, ChartFact>(
    trusted.facts.filter((fact) => allowedFactIds.has(fact.id)).map((fact) => [fact.id, fact]),
  );
  // Only the NARRATABLE (primary) themes authorize a claim. The candidate ids
  // are kept separately so a candidate reference gets its own refusal.
  const narratableThemeIds = new Set<string>(trusted.constraints.narratableThemeIds);
  const primaryThemesById = new Map<string, PrimaryTheme>(
    trusted.primaryThemes
      .filter((theme) => narratableThemeIds.has(theme.id))
      .map((theme) => [theme.id, theme]),
  );
  const candidateThemeIds = new Set<string>(trusted.constraints.candidateThemeIds);

  const validated: ValidatedClaim[] = [];
  const seenDraftRefs = new Set<string>();
  for (const draft of output.claims) {
    if (seenDraftRefs.has(draft.draftRef)) {
      throw new InterpretiveClaimError(
        'CLAIM_DUPLICATE_DRAFT_REF',
        `draftRef "${draft.draftRef}" is used by two claims; a relation could not say which of them it means`,
      );
    }
    seenDraftRefs.add(draft.draftRef);
    validated.push({
      draftRef: draft.draftRef,
      claim: validateClaim(draft, factsById, primaryThemesById, candidateThemeIds),
    });
  }

  const claimIdByDraftRef = new Map<string, string>();
  const acceptedById = new Map<string, AcceptedInterpretiveClaim>();
  for (const entry of validated) {
    if (acceptedById.has(entry.claim.claimId)) {
      // Two handles, one meaning. Accepting both would put the same claim into
      // the graph twice and let a later stage read the repetition as emphasis.
      throw new InterpretiveClaimError(
        'CLAIM_DUPLICATE_CLAIM_CONTENT',
        `claim "${entry.draftRef}" carries the same accepted semantic identity as an earlier claim in this answer; one interpretation is not two`,
      );
    }
    acceptedById.set(entry.claim.claimId, entry.claim);
    claimIdByDraftRef.set(entry.draftRef, entry.claim.claimId);
  }

  const relations = resolveRelations(output.relations, claimIdByDraftRef);

  // Sorted by identity: position in the published list is a property of the
  // accepted meaning, never of where a provider happened to write it.
  const claims = [...acceptedById.values()].sort((left, right) =>
    left.claimId < right.claimId ? -1 : left.claimId > right.claimId ? 1 : 0,
  );

  const core = {
    graphVersion: INTERPRETIVE_CLAIM_GRAPH_VERSION,
    sourceBriefHash: trusted.structuralHash,
    claims,
    relations,
  };

  return { ...core, structuralHash: hashInterpretiveClaimGraph(core) };
}
