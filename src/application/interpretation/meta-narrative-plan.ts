/**
 * ETBZ-30 C3 - MetaNarrativePlan: the ORCHESTRATION of accepted meaning, fixed
 * and hash-bound before a single sentence of the report exists.
 *
 * The semantic path of this slice is `NarrativeBrief -> InterpretiveClaimGraph
 * -> MetaNarrativePlan`, and this module implements the final arrow only. C2
 * decided WHAT is true of this chart; C3 decides HOW that truth is told - which
 * reading carries the report, which motifs recur, which tensions are faced,
 * which obligations stay open, and in what order chapters arrive.
 *
 * THE PLAN IS NOT A SECOND SOURCE OF SYMBOLIC TRUTH. Every reference it makes
 * is resolved against the ACCEPTED `InterpretiveClaimGraph`, and an
 * unresolvable one is refused by name. It cannot add a claim, and it has no
 * channel through which one could enter: there is no fact reference in a plan
 * draft at all, so the only chart facts a plan can reach are the ones already
 * accepted claims stand on. What free text it does carry - the report thesis
 * and the motif statements - is held to exactly the C2 grounding discipline,
 * against the closure its own referenced claims imply.
 *
 * SIX DECISIONS THAT ARE LOAD-BEARING, STATED SO THEY CANNOT DRIFT:
 *
 *  1. NO HIDDEN SALIENCE. Nothing here ranks. There is no score, confidence,
 *     salience, weight, rank or centrality, and no count is published as
 *     importance. A provider cannot make a motif matter more by mentioning a
 *     claim twice, because every set-like reference list is sorted and
 *     de-duplicated BEFORE it reaches an identity or the hash. The draft
 *     schema refuses such a field outright rather than ignoring it, which is
 *     the stronger property: there is no number-shaped hole to smuggle one in.
 *
 *  2. IDENTITY IS THE APPLICATION'S. `motifRef`, `threadRef` and `chapterRef`
 *     are LOCAL handles a planner uses to point its own structures at each
 *     other within one draft, and they are discarded once resolved. The
 *     accepted `motifId`, `threadId` and `chapterId` are each derived from
 *     canonical semantic content, so they cannot depend on the planner, on the
 *     handle it chose, or on where a structure sat in the draft.
 *
 *     The three derivations are deliberately acyclic: a motif id rests on
 *     claims, a thread id on claims and motif ids, a chapter id on claims,
 *     motif ids and thread ids. A thread's identity therefore EXCLUDES the
 *     chapter that closes it - deriving thread ids from the resolution while
 *     chapter ids depend on thread references would be a cycle with no fixed
 *     point. Excluding it is also the more honest rule: where an obligation is
 *     discharged is scheduling, not what the obligation IS, so two threads with
 *     the same role over the same claims and motifs collide and are refused as
 *     duplicates however they are scheduled.
 *
 *  3. CHAPTER ORDER IS SEMANTIC; EVERYTHING ELSE IS A SET. The `chapterPlan`
 *     array keeps the planner's order, because a report told in another order
 *     is a different report - so moving a chapter moves the plan's structural
 *     hash. Every reference list INSIDE a chapter is set-like and normalized,
 *     because which claims a chapter touches is a fact about the chapter and
 *     the order they were typed in is not.
 *
 *  4. TENSIONS ARE DERIVED, NEVER AUTHORED. A plan draft carries no tension
 *     field. The accepted tensions are read off the claim graph's own
 *     `CONTRASTS_WITH`, `QUALIFIES` and `ALTERNATIVE_READING` relations, so a
 *     plan can neither invent a conflict the graph does not state nor hide one
 *     it does. `SUPPORTS`, `CONTEXTUALIZES`, `DEVELOPS` and `INTEGRATES` stay
 *     ordinary relations and are not silently reclassified as tensions.
 *
 *  5. COVERAGE IS DERIVED, NEVER SUPPLIED. The draft states no coverage, and
 *     the accepted plan publishes sets rather than percentages or counts. For
 *     an accepted plan the claim coverage equals the graph's full claim set
 *     exactly: accepted meaning is not quietly dropped on the way to prose.
 *
 *  6. THE RENDERING CONSTRAINT IS ETBZ'S, NOT THE PLANNER'S. The accepted plan
 *     carries `constraints.claimScope = ACCEPTED_GRAPH_CLAIMS_ONLY`, which is
 *     the contract's required "explicit constraints against unsupported new
 *     claims during rendering": prose governed by this plan may use only the
 *     InterpretiveClaims of the graph named by `sourceClaimGraphHash`. The
 *     draft schema has no `constraints` key and refuses one, so the value is
 *     DERIVED by the application - a planner able to author its own scope could
 *     widen it, which is the one thing the constraint exists to prevent. It
 *     sits inside the structural hash, so an accepted plan's anchor commits to
 *     the scope it was accepted under. There is exactly ONE policy in C3 and no
 *     configurable second mode; this is the global floor, and refining it per
 *     chapter into an allowed-claim list is ChapterContract's work, not this
 *     module's.
 *
 * WHAT THIS MODULE DOES NOT DO. It implements no `NarrativeState` and no
 * `ChapterContract`: the motif transitions here are a PLAN of intended
 * movement, validated as a sequence, and the transactional state machine that
 * one day executes them belongs to ETBZ-31. It writes no prose, calls no
 * provider, parses no wire format and reads no clock. Whether the planned prose
 * will be good is a question for the semantic and counterfactual QA gates; a
 * structural validator cannot prove depth, and this one does not pretend to.
 */

import { z } from 'zod';
import { structuralHash } from '../../domain/structural-hash.js';
import type { HoroscopeModel } from '../horoscope-model.js';
import { findUncitedNumerals, findUncitedSymbols } from './chart-symbol-lexicon.js';
import { MetaNarrativePlanError } from './errors.js';
import type { MetaNarrativePlanErrorCode } from './errors.js';
import type { ChartFact } from './feature-set.js';
import {
  MOTIF_LIFECYCLE_STATES,
  NARRATIVE_OPERATORS,
  motifLifecycleStateSchema,
  narrativeOperatorSchema,
} from './interpretive-claim.js';
import type {
  ClaimRelationType,
  MotifLifecycleState,
  NarrativeOperator,
} from './interpretive-claim.js';
import { hashInterpretiveClaimGraph } from './interpretive-claim-graph.js';
import type {
  AcceptedInterpretiveClaim,
  InterpretiveClaimGraph,
} from './interpretive-claim-graph.js';
import { findOutOfScopeMethod } from './method-scope.js';
import { buildNarrativeChain } from './narrative-brief.js';
import type { NarrativeBrief } from './narrative-brief.js';
import type { PrimaryTheme } from './primary-theme.js';

export const META_NARRATIVE_PLAN_VERSION = 'etbz-30.meta-narrative-plan.v1' as const;

/**
 * How many primary motifs an accepted plan carries.
 *
 * A TRUTH GATE, not a target. Below the floor the accepted graph did not
 * support a long-form reading and the run is blocked; above the ceiling the
 * plan has stopped having motifs and started having a list. Neither bound is
 * ever satisfied by inventing a motif: a fabricated one fails its own grounding
 * checks, and a duplicated one collides on its anchor.
 */
export const PRIMARY_MOTIF_COUNT = { minimum: 3, maximum: 5 } as const;

/**
 * The operators a THREAD may carry.
 *
 * A strict subset of the C1 narrative operators rather than a second
 * vocabulary: `satisfies` makes the membership a compile-time property, and the
 * runtime agreement check below makes it a measured one. A thread declares an
 * unresolved obligation, so `ESTABLISH` and `REINFORCE` are absent - neither
 * leaves anything owing.
 */
export const THREAD_NARRATIVE_ROLES = [
  'QUALIFY',
  'CONTRAST',
  'CONTEXTUALIZE',
  'INTEGRATE',
] as const satisfies readonly NarrativeOperator[];

export type ThreadNarrativeRole = (typeof THREAD_NARRATIVE_ROLES)[number];

/**
 * The claim relations that ARE tensions.
 *
 * Read off C1's closed relation set; `SUPPORTS`, `CONTEXTUALIZES`, `DEVELOPS`
 * and `INTEGRATES` are deliberately absent, because a plan that treated every
 * relation as a conflict would manufacture drama the chart never stated.
 */
export const TENSION_RELATION_TYPES = [
  'ALTERNATIVE_READING',
  'CONTRASTS_WITH',
  'QUALIFIES',
] as const satisfies readonly ClaimRelationType[];

export type TensionRelationType = (typeof TENSION_RELATION_TYPES)[number];

/**
 * Which chapter operation discharges which tension.
 *
 * `ALTERNATIVE_READING` maps to `CONTRAST` because an alternative reading is
 * faced by setting it against the reading it competes with; there is no
 * separate operator for it and inventing one would widen an approved closed set.
 */
const TENSION_CHAPTER_OPERATOR: Readonly<Record<TensionRelationType, NarrativeOperator>> = {
  ALTERNATIVE_READING: 'CONTRAST',
  CONTRASTS_WITH: 'CONTRAST',
  QUALIFIES: 'QUALIFY',
};

/**
 * The approved lifecycle as positions, derived from the C1 array so the two
 * cannot disagree. C1 declares the states as a closed SET and leaves which
 * transitions are legal to the commit that implements the plan - this is that
 * commit, and the rule is: strictly forward, skipping allowed, never back, and
 * never to `UNSEEN`, which is the implicit pre-plan state rather than a
 * destination.
 */
const LIFECYCLE_ORDER: ReadonlyMap<MotifLifecycleState, number> = new Map(
  MOTIF_LIFECYCLE_STATES.map((state, index) => [state, index] as const),
);

/** The states a motif may legitimately rest in once the plan ends. */
const TERMINAL_MOTIF_STATES: ReadonlySet<MotifLifecycleState> = new Set<MotifLifecycleState>([
  'INTEGRATED',
  'CLOSED',
]);

// Agreement check, at module load rather than in a comment: a thread role that
// stopped being a narrative operator would otherwise be a silent second
// vocabulary. The compile-time `satisfies` above cannot see a future edit that
// changes NARRATIVE_OPERATORS itself.
for (const role of THREAD_NARRATIVE_ROLES) {
  if (!(NARRATIVE_OPERATORS as readonly string[]).includes(role)) {
    throw new RangeError(
      `meta-narrative-plan: thread role "${role}" is not an approved narrative operator`,
    );
  }
}
// The lifecycle rule below reads UNSEEN as the pre-plan floor rather than as a
// state a chapter may target, which is only sound while it really is first.
if (LIFECYCLE_ORDER.get('UNSEEN') !== 0) {
  throw new RangeError(
    'meta-narrative-plan: UNSEEN must be the first state of the approved motif lifecycle',
  );
}

// ---------------------------------------------------------------------------
// The untrusted draft
// ---------------------------------------------------------------------------

/**
 * STRUCTURAL schemas only, `strictObject` at every level.
 *
 * An extra key is a planner inventing a channel the application never agreed to
 * read, and this is where the contract's refusals become structural rather than
 * semantic: an accepted `motifId`, `threadId` or `chapterId`, a supplied
 * `coverage`, `tensions` or `structuralHash`, any provider/model/route stamp,
 * and any `salience`/`confidence`/`rank`/`weight` field are each simply an
 * unrecognized key. Refusing them here is stronger than validating them away,
 * because there is no field for such a value to sit in at all.
 *
 * What the schema deliberately does NOT answer: whether a claimRef names a
 * claim of THIS graph, whether an anchor is inside its own motif, whether a
 * thread closes in a later chapter, whether every accepted claim is covered, or
 * whether a statement outruns its grounding. Every one of those is a SEMANTIC
 * question about one specific graph, and each is refused by name below.
 */
export const planReportThesisDraftSchema = z.strictObject({
  statement: z.string().min(1),
  claimRefs: z.array(z.string().min(1)),
});

export const primaryMotifDraftSchema = z.strictObject({
  motifRef: z.string().min(1),
  statement: z.string().min(1),
  anchorClaimRef: z.string().min(1),
  claimRefs: z.array(z.string().min(1)),
});

export const threadResolutionDraftSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('CLOSE_IN_CHAPTER'), chapterRef: z.string().min(1) }),
  z.strictObject({ mode: z.literal('EXPLICITLY_LEFT_OPEN') }),
]);

export const openThreadDraftSchema = z.strictObject({
  threadRef: z.string().min(1),
  narrativeRole: z.enum(THREAD_NARRATIVE_ROLES),
  claimRefs: z.array(z.string().min(1)),
  motifRefs: z.array(z.string().min(1)),
  resolution: threadResolutionDraftSchema,
});

export const motifTransitionDraftSchema = z.strictObject({
  motifRef: z.string().min(1),
  targetState: motifLifecycleStateSchema,
});

export const plannedChapterDraftSchema = z.strictObject({
  chapterRef: z.string().min(1),
  narrativeRole: narrativeOperatorSchema,
  claimRefs: z.array(z.string().min(1)),
  motifRefs: z.array(z.string().min(1)),
  motifTransitions: z.array(motifTransitionDraftSchema),
  openThreadRefs: z.array(z.string().min(1)),
  closeThreadRefs: z.array(z.string().min(1)),
});

export const metaNarrativePlanDraftSchema = z.strictObject({
  sourceBriefHash: z.string().min(1),
  sourceClaimGraphHash: z.string().min(1),
  reportThesis: planReportThesisDraftSchema,
  primaryMotifs: z.array(primaryMotifDraftSchema),
  openThreads: z.array(openThreadDraftSchema),
  chapterPlan: z.array(plannedChapterDraftSchema),
});

export type MetaNarrativePlanDraft = z.infer<typeof metaNarrativePlanDraftSchema>;

// ---------------------------------------------------------------------------
// The accepted plan
// ---------------------------------------------------------------------------

/**
 * The report's single governing reading.
 *
 * A SYNTHESIS OF accepted claims and never a new one: it receives no claim id
 * of its own, precisely so nothing downstream can cite the thesis as though it
 * were an independently grounded interpretation. Two distinct claims are the
 * floor because a "synthesis" of one claim is that claim restated.
 */
export interface AcceptedReportThesis {
  readonly statement: string;
  /** Accepted claim ids, sorted and de-duplicated. */
  readonly claimRefs: readonly string[];
}

/**
 * One motif the report carries throughout.
 *
 * Carries NO number - no weight, no prominence, no order index. Its position in
 * the published list is its id's, which is a property of its meaning.
 */
export interface AcceptedPrimaryMotif {
  /** Derived from the motif's semantic identity. Never planner-supplied. */
  readonly motifId: string;
  readonly statement: string;
  /** The one accepted claim this motif is anchored in. Unique across motifs. */
  readonly anchorClaimRef: string;
  /** Accepted claim ids, sorted and de-duplicated. Includes the anchor. */
  readonly claimRefs: readonly string[];
}

/** Two accepted claim identities and the graph relation between them. */
export interface DerivedNarrativeTension {
  readonly from: string;
  readonly type: TensionRelationType;
  readonly to: string;
}

/**
 * How an obligation ends: discharged in a later chapter, or left open in the
 * open. There is no third mode, and in particular no silent one.
 */
export type AcceptedThreadResolution =
  | { readonly mode: 'CLOSE_IN_CHAPTER'; readonly chapterId: string }
  | { readonly mode: 'EXPLICITLY_LEFT_OPEN' };

export interface AcceptedOpenThread {
  /** Derived from the thread's semantic identity. Never planner-supplied. */
  readonly threadId: string;
  readonly narrativeRole: ThreadNarrativeRole;
  /** Accepted claim ids, sorted and de-duplicated. */
  readonly claimRefs: readonly string[];
  /** Accepted motif ids, sorted and de-duplicated. */
  readonly motifRefs: readonly string[];
  readonly resolution: AcceptedThreadResolution;
}

/** One motif's intended movement in one chapter. A PLAN, not a state change. */
export interface AcceptedMotifTransition {
  /** An accepted motif id. */
  readonly motifRef: string;
  readonly targetState: MotifLifecycleState;
}

export interface AcceptedPlannedChapter {
  /** Derived from the chapter's semantic identity. Never planner-supplied. */
  readonly chapterId: string;
  readonly narrativeRole: NarrativeOperator;
  /** Accepted claim ids, sorted and de-duplicated. At least one. */
  readonly claimRefs: readonly string[];
  /** Accepted motif ids, sorted and de-duplicated. */
  readonly motifRefs: readonly string[];
  /** Sorted by motif id; one target per motif per chapter. */
  readonly motifTransitions: readonly AcceptedMotifTransition[];
  /** Accepted thread ids, sorted and de-duplicated. */
  readonly openThreadRefs: readonly string[];
  readonly closeThreadRefs: readonly string[];
}

/**
 * What the plan actually reaches, derived by ETBZ from the chapter plan.
 *
 * Sets, never percentages, counts or scores. A percentage would be exactly the
 * invented number this slice refuses everywhere else, and a count of covered
 * claims says nothing a reader could act on that the ids do not say better.
 */
export interface MetaNarrativePlanCoverage {
  readonly claimRefs: readonly string[];
  readonly themeRefs: readonly string[];
  readonly factRefs: readonly string[];
}

/**
 * The single claim-scope policy an accepted plan is rendered under.
 *
 * Rendering governed by the plan may use ONLY InterpretiveClaims belonging to
 * the graph identified by `sourceClaimGraphHash`. It is deliberately NOT a
 * per-chapter allowed-claim list: this is the global floor every chapter
 * inherits, which `ChapterContract` refines downward later. One policy, no
 * second mode - a configurable scope would be the channel for widening exactly
 * what this constraint closes.
 */
export const PLAN_CLAIM_SCOPE = 'ACCEPTED_GRAPH_CLAIMS_ONLY' as const;

/**
 * The contract's "explicit constraints against unsupported new claims during
 * rendering", persisted on the accepted plan.
 *
 * ETBZ-OWNED. The draft schema carries no `constraints` key and refuses one, so
 * a planner can neither supply, widen nor reinterpret this; the application
 * derives it and the structural hash commits to it.
 */
export interface MetaNarrativePlanConstraints {
  readonly claimScope: typeof PLAN_CLAIM_SCOPE;
}

export interface MetaNarrativePlan {
  readonly planVersion: typeof META_NARRATIVE_PLAN_VERSION;
  /** The brief the whole chain was accepted against. */
  readonly sourceBriefHash: string;
  /** The accepted claim graph this plan orchestrates. */
  readonly sourceClaimGraphHash: string;
  readonly reportThesis: AcceptedReportThesis;
  /** Published in deterministic motif-id order. */
  readonly primaryMotifs: readonly AcceptedPrimaryMotif[];
  /** Derived from the graph's relations. Never planner-authored. */
  readonly tensions: readonly DerivedNarrativeTension[];
  /** Published in deterministic thread-id order. */
  readonly openThreads: readonly AcceptedOpenThread[];
  readonly coverage: MetaNarrativePlanCoverage;
  /** ORDER IS SEMANTIC. The one list in this artefact that is not sorted. */
  readonly chapterPlan: readonly AcceptedPlannedChapter[];
  /** ETBZ-derived rendering constraints. Never planner-supplied. */
  readonly constraints: MetaNarrativePlanConstraints;
  readonly structuralHash: string;
}

export interface BuildMetaNarrativePlanInput {
  readonly model: HoroscopeModel;
  /** The brief the chain was built from. Verified against `model`, never trusted. */
  readonly brief: NarrativeBrief;
  /** The accepted graph. Its published hash is recomputed, never trusted. */
  readonly claimGraph: InterpretiveClaimGraph;
  /** Raw plan draft. Untrusted: schema-checked before anything reads it. */
  readonly planDraft: unknown;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** The canonical semantic identity a `motifId` is derived from. */
export interface PrimaryMotifIdentity {
  readonly statement: string;
  readonly anchorClaimRef: string;
  readonly claimRefs: readonly string[];
}

/** The canonical semantic identity a `threadId` is derived from. */
export interface OpenThreadIdentity {
  readonly narrativeRole: ThreadNarrativeRole;
  readonly claimRefs: readonly string[];
  readonly motifRefs: readonly string[];
}

/** The canonical semantic identity a `chapterId` is derived from. */
export interface PlannedChapterIdentity {
  readonly narrativeRole: NarrativeOperator;
  readonly claimRefs: readonly string[];
  readonly motifRefs: readonly string[];
  readonly motifTransitions: readonly AcceptedMotifTransition[];
  readonly openThreadRefs: readonly string[];
  readonly closeThreadRefs: readonly string[];
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
 * Exported so that "the id is a pure function of the accepted meaning" is a
 * property a test can re-derive from outside. Every reference list reaching
 * these is already sorted and de-duplicated by the caller, so neither draft
 * order nor a repeated reference can reach a digest.
 */
export function derivePrimaryMotifId(identity: PrimaryMotifIdentity): string {
  return `motif.${structuralHash({
    statement: identity.statement,
    anchorClaimRef: identity.anchorClaimRef,
    claimRefs: identity.claimRefs,
  })}`;
}

export function deriveOpenThreadId(identity: OpenThreadIdentity): string {
  // The resolution is deliberately absent; see decision 2 in the file docblock.
  return `thread.${structuralHash({
    narrativeRole: identity.narrativeRole,
    claimRefs: identity.claimRefs,
    motifRefs: identity.motifRefs,
  })}`;
}

export function deriveChapterId(identity: PlannedChapterIdentity): string {
  // Position is absent on purpose: a chapter's identity is what it does, and
  // WHERE it does it is the chapter plan's ordering rather than the chapter's
  // own property. Moving it still moves the plan hash, because the chapter plan
  // is hashed as an ordered array.
  return `chapter.${structuralHash({
    narrativeRole: identity.narrativeRole,
    claimRefs: identity.claimRefs,
    motifRefs: identity.motifRefs,
    motifTransitions: identity.motifTransitions,
    openThreadRefs: identity.openThreadRefs,
    closeThreadRefs: identity.closeThreadRefs,
  })}`;
}

/**
 * The plan's structural anchor, re-derivable from the plan itself.
 *
 * Every field that describes WHAT WAS PLANNED is inside it, and nothing else
 * is: no provider, no model, no route, no clock, no candidate revision. Those
 * belong to the generation manifest and the evidence projection, which record
 * how one particular run was executed - a different question from what the plan
 * means.
 */
export function hashMetaNarrativePlan(
  plan: Omit<MetaNarrativePlan, 'structuralHash'>,
): string {
  return structuralHash({
    planVersion: plan.planVersion,
    sourceBriefHash: plan.sourceBriefHash,
    sourceClaimGraphHash: plan.sourceClaimGraphHash,
    reportThesis: plan.reportThesis,
    primaryMotifs: plan.primaryMotifs,
    tensions: plan.tensions,
    openThreads: plan.openThreads,
    coverage: plan.coverage,
    chapterPlan: plan.chapterPlan,
    // Inside the core on purpose: an accepted plan's anchor commits to the
    // claim scope it was accepted under, so the same chapters re-published
    // under a wider scope are a different plan and the hash has to say so.
    constraints: plan.constraints,
  });
}

// ---------------------------------------------------------------------------
// Grounding
// ---------------------------------------------------------------------------

interface PlanGrounding {
  readonly factsById: ReadonlyMap<string, ChartFact>;
  readonly themesById: ReadonlyMap<string, PrimaryTheme>;
}

/**
 * What a set of accepted claims lets a plan surface say.
 *
 * THE SAME CLOSURE C2 USES: the claims' direct fact references, plus every fact
 * owned by the approved primary themes those claims rest on. A plan surface is
 * held to the grounding of the claims it cites and to nothing wider - citing
 * one claim does not license the whole chart.
 */
function coveredTermsOf(
  claims: readonly AcceptedInterpretiveClaim[],
  grounding: PlanGrounding,
): ReadonlySet<string> {
  const groundingFactIds = new Set<string>();
  for (const claim of claims) {
    for (const factId of claim.factRefs) {
      groundingFactIds.add(factId);
    }
    for (const themeId of claim.themeRefs) {
      const theme = grounding.themesById.get(themeId);
      if (theme !== undefined) {
        for (const factId of theme.factIds) {
          groundingFactIds.add(factId);
        }
      }
    }
  }

  const covered = new Set<string>();
  for (const factId of groundingFactIds) {
    const fact = grounding.factsById.get(factId);
    if (fact === undefined) {
      continue;
    }
    covered.add(fact.value);
    if (fact.sourceLabel !== null) {
      covered.add(fact.sourceLabel);
    }
  }
  return covered;
}

/** The three refusals a free-text plan surface is subject to. */
interface TextRefusalCodes {
  readonly method: MetaNarrativePlanErrorCode;
  readonly symbol: MetaNarrativePlanErrorCode;
  readonly number: MetaNarrativePlanErrorCode;
}

/**
 * Applies the C2/C25 grounding discipline to one free-text plan surface.
 *
 * The three matchers are IMPORTED, never re-implemented: the chart symbol
 * lexicon and the not-evaluated method vocabulary each have exactly one owner,
 * and a second copy here would let a term be invisible to the plan gate while
 * the report gate still sees it - the drift that `narrative-qa-policy.ts` was
 * created to end.
 *
 * The offending TEXT is never echoed, only the matched terms. A refusal that
 * quoted untrusted prose back is how raw provider output reaches a log.
 */
function refuseUngroundedText(
  text: string,
  claims: readonly AcceptedInterpretiveClaim[],
  grounding: PlanGrounding,
  context: string,
  codes: TextRefusalCodes,
): void {
  const outOfScope = findOutOfScopeMethod(text);
  if (outOfScope !== null) {
    throw new MetaNarrativePlanError(
      codes.method,
      `${context} invokes "${outOfScope.term}"; method "${outOfScope.methodId}" is not_evaluated in this slice (insufficient_method_scope)`,
    );
  }

  const covered = coveredTermsOf(claims, grounding);

  const uncitedSymbols = findUncitedSymbols(text, covered);
  if (uncitedSymbols.length > 0) {
    throw new MetaNarrativePlanError(
      codes.symbol,
      `${context} names chart symbols its accepted grounding does not cover: ${uncitedSymbols.join(', ')}`,
    );
  }

  const uncitedNumbers = findUncitedNumerals(text, covered);
  if (uncitedNumbers.length > 0) {
    throw new MetaNarrativePlanError(
      codes.number,
      `${context} states numbers its accepted grounding does not cover: ${uncitedNumbers.join(', ')}; a quantity is a chart fact`,
    );
  }
}

function resolveClaimRefs(
  refs: readonly string[],
  claimsById: ReadonlyMap<string, AcceptedInterpretiveClaim>,
  context: string,
): readonly AcceptedInterpretiveClaim[] {
  const resolved: AcceptedInterpretiveClaim[] = [];
  for (const ref of refs) {
    const claim = claimsById.get(ref);
    if (claim === undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_UNKNOWN_CLAIM_REF',
        `${context} references claim "${ref}", which the accepted InterpretiveClaimGraph does not contain`,
      );
    }
    resolved.push(claim);
  }
  return resolved;
}

function resolveMotifRefs(
  refs: readonly string[],
  motifIdByRef: ReadonlyMap<string, string>,
  context: string,
): readonly string[] {
  const resolved: string[] = [];
  for (const ref of refs) {
    const motifId = motifIdByRef.get(ref);
    if (motifId === undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_UNKNOWN_MOTIF_REF',
        `${context} references motif "${ref}", which this plan does not declare as a primary motif`,
      );
    }
    resolved.push(motifId);
  }
  return resolved;
}

function resolveThreadRefs(
  refs: readonly string[],
  threadIdByRef: ReadonlyMap<string, string>,
  context: string,
): readonly string[] {
  const resolved: string[] = [];
  for (const ref of refs) {
    const threadId = threadIdByRef.get(ref);
    if (threadId === undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_UNKNOWN_THREAD_REF',
        `${context} references thread "${ref}", which this plan does not declare`,
      );
    }
    resolved.push(threadId);
  }
  return resolved;
}

function lifecyclePosition(state: MotifLifecycleState): number {
  const position = LIFECYCLE_ORDER.get(state);
  if (position === undefined) {
    // Unreachable for any member of the closed C1 set; present so a future
    // edit that adds a state cannot make it silently unordered.
    throw new RangeError(`meta-narrative-plan: motif lifecycle state "${state}" has no position`);
  }
  return position;
}

// ---------------------------------------------------------------------------
// Per-structure validation
// ---------------------------------------------------------------------------

interface ValidatedMotif {
  readonly motifRef: string;
  readonly motif: AcceptedPrimaryMotif;
}

function validateMotif(
  draft: z.infer<typeof primaryMotifDraftSchema>,
  claimsById: ReadonlyMap<string, AcceptedInterpretiveClaim>,
  grounding: PlanGrounding,
): AcceptedPrimaryMotif {
  const context = `motif "${draft.motifRef}"`;

  if (isBlank(draft.statement)) {
    // The schema's `min(1)` floor accepts a whitespace-only statement; it still
    // says nothing, and ETBZ does not author the meaning a planner omitted.
    throw new MetaNarrativePlanError(
      'PLAN_MOTIF_UNGROUNDED',
      `${context} carries a statement with no meaning; an empty motif is not a motif`,
    );
  }

  const motifClaims = resolveClaimRefs(draft.claimRefs, claimsById, context);
  const claimRefs = sortedUnique(motifClaims.map((claim) => claim.claimId));
  if (claimRefs.length === 0) {
    throw new MetaNarrativePlanError(
      'PLAN_MOTIF_UNGROUNDED',
      `${context} rests on no accepted claim; a motif is a recurring reading of accepted meaning`,
    );
  }

  const anchor = claimsById.get(draft.anchorClaimRef);
  if (anchor === undefined) {
    throw new MetaNarrativePlanError(
      'PLAN_UNKNOWN_CLAIM_REF',
      `${context} anchors in claim "${draft.anchorClaimRef}", which the accepted InterpretiveClaimGraph does not contain`,
    );
  }
  if (!claimRefs.includes(anchor.claimId)) {
    throw new MetaNarrativePlanError(
      'PLAN_MOTIF_ANCHOR_INVALID',
      `${context} anchors in a claim it does not itself reference; the anchor is the motif's own centre, not an outside pointer`,
    );
  }

  refuseUngroundedText(draft.statement, motifClaims, grounding, context, {
    method: 'PLAN_MOTIF_OUT_OF_METHOD_SCOPE',
    symbol: 'PLAN_MOTIF_UNCITED_SYMBOL',
    number: 'PLAN_MOTIF_UNCITED_NUMBER',
  });

  return {
    motifId: derivePrimaryMotifId({
      statement: draft.statement,
      anchorClaimRef: anchor.claimId,
      claimRefs,
    }),
    statement: draft.statement,
    anchorClaimRef: anchor.claimId,
    claimRefs,
  };
}

interface ValidatedThread {
  readonly threadRef: string;
  readonly threadId: string;
  readonly narrativeRole: ThreadNarrativeRole;
  readonly claimRefs: readonly string[];
  readonly motifRefs: readonly string[];
  readonly resolutionDraft: z.infer<typeof threadResolutionDraftSchema>;
}

function validateThread(
  draft: z.infer<typeof openThreadDraftSchema>,
  claimsById: ReadonlyMap<string, AcceptedInterpretiveClaim>,
  motifIdByRef: ReadonlyMap<string, string>,
): ValidatedThread {
  const context = `thread "${draft.threadRef}"`;

  const threadClaims = resolveClaimRefs(draft.claimRefs, claimsById, context);
  const claimRefs = sortedUnique(threadClaims.map((claim) => claim.claimId));
  const motifRefs = sortedUnique(resolveMotifRefs(draft.motifRefs, motifIdByRef, context));

  if (claimRefs.length === 0 && motifRefs.length === 0) {
    throw new MetaNarrativePlanError(
      'PLAN_THREAD_UNGROUNDED',
      `${context} is about neither an accepted claim nor an accepted motif; an obligation with no subject cannot be discharged`,
    );
  }

  return {
    threadRef: draft.threadRef,
    threadId: deriveOpenThreadId({ narrativeRole: draft.narrativeRole, claimRefs, motifRefs }),
    narrativeRole: draft.narrativeRole,
    claimRefs,
    motifRefs,
    resolutionDraft: draft.resolution,
  };
}

function validateChapter(
  draft: z.infer<typeof plannedChapterDraftSchema>,
  claimsById: ReadonlyMap<string, AcceptedInterpretiveClaim>,
  motifIdByRef: ReadonlyMap<string, string>,
  threadIdByRef: ReadonlyMap<string, string>,
): AcceptedPlannedChapter {
  const context = `chapter "${draft.chapterRef}"`;

  const chapterClaims = resolveClaimRefs(draft.claimRefs, claimsById, context);
  const claimRefs = sortedUnique(chapterClaims.map((claim) => claim.claimId));
  if (claimRefs.length === 0) {
    throw new MetaNarrativePlanError(
      'PLAN_CHAPTER_UNGROUNDED',
      `${context} references no accepted claim; a chapter with no meaning under it is prose looking for a subject`,
    );
  }

  const motifRefs = sortedUnique(resolveMotifRefs(draft.motifRefs, motifIdByRef, context));
  const openThreadRefs = sortedUnique(
    resolveThreadRefs(draft.openThreadRefs, threadIdByRef, context),
  );
  const closeThreadRefs = sortedUnique(
    resolveThreadRefs(draft.closeThreadRefs, threadIdByRef, context),
  );

  // One target per motif per chapter. Two different targets for one motif in
  // one chapter is a contradiction rather than a sequence, and picking either
  // would be ETBZ authoring the planner's intent.
  const targetByMotifId = new Map<string, MotifLifecycleState>();
  for (const transition of draft.motifTransitions) {
    const motifId = motifIdByRef.get(transition.motifRef);
    if (motifId === undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_UNKNOWN_MOTIF_REF',
        `${context} transitions motif "${transition.motifRef}", which this plan does not declare as a primary motif`,
      );
    }
    if (transition.targetState === 'UNSEEN') {
      throw new MetaNarrativePlanError(
        'PLAN_MOTIF_TRANSITION_INVALID',
        `${context} transitions a motif to UNSEEN; UNSEEN is the implicit pre-plan state and is never a destination`,
      );
    }
    const existing = targetByMotifId.get(motifId);
    if (existing !== undefined && existing !== transition.targetState) {
      throw new MetaNarrativePlanError(
        'PLAN_MOTIF_TRANSITION_INVALID',
        `${context} moves one motif to both ${existing} and ${transition.targetState}; a chapter advances a motif once`,
      );
    }
    targetByMotifId.set(motifId, transition.targetState);
  }

  const motifTransitions: AcceptedMotifTransition[] = [...targetByMotifId.entries()]
    .map(([motifRef, targetState]) => ({ motifRef, targetState }))
    .sort((left, right) => (left.motifRef < right.motifRef ? -1 : left.motifRef > right.motifRef ? 1 : 0));

  const identity: PlannedChapterIdentity = {
    narrativeRole: draft.narrativeRole,
    claimRefs,
    motifRefs,
    motifTransitions,
    openThreadRefs,
    closeThreadRefs,
  };

  return { chapterId: deriveChapterId(identity), ...identity };
}

// ---------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------

/**
 * Validates a plan draft against a trusted brief and an accepted claim graph,
 * and assembles the accepted plan. Throws `MetaNarrativePlanError` and returns
 * nothing partial.
 *
 * Pure: no clock, no randomness, no network, no provider. The same model, brief,
 * graph and draft produce a byte-identical plan, including its structural hash.
 */
export function buildMetaNarrativePlan(input: BuildMetaNarrativePlanInput): MetaNarrativePlan {
  const { model, brief, claimGraph, planDraft } = input;

  // The chain is RE-DERIVED from the model, exactly as `buildReportModel` and
  // `buildInterpretiveClaimGraph` do. The supplied brief is compared against it
  // and is never the authority.
  const rederived = buildNarrativeChain(model);
  if (brief.structuralHash !== rederived.brief.structuralHash) {
    throw new MetaNarrativePlanError(
      'PLAN_BRIEF_NOT_DERIVED_FROM_MODEL',
      'the supplied brief is not the brief this HoroscopeModel produces; a plan is never accepted against an unverified brief',
    );
  }
  const trusted = rederived.brief;

  if (claimGraph.sourceBriefHash !== trusted.structuralHash) {
    throw new MetaNarrativePlanError(
      'PLAN_GRAPH_BRIEF_MISMATCH',
      'the accepted claim graph was built against a different brief than the one being validated',
    );
  }

  // The graph's own published hash is RECOMPUTED rather than believed: a graph
  // whose content no longer matches the hash it advertises is not the artefact
  // C2 accepted, and binding a plan to it would bind it to nothing.
  const recomputedGraphHash = hashInterpretiveClaimGraph({
    graphVersion: claimGraph.graphVersion,
    sourceBriefHash: claimGraph.sourceBriefHash,
    claims: claimGraph.claims,
    relations: claimGraph.relations,
  });
  if (recomputedGraphHash !== claimGraph.structuralHash) {
    throw new MetaNarrativePlanError(
      'PLAN_GRAPH_HASH_INVALID',
      'the accepted claim graph does not hash to its own published structuralHash; its content and its anchor disagree',
    );
  }

  const parsed = metaNarrativePlanDraftSchema.safeParse(planDraft);
  if (!parsed.success) {
    // Path + code only. A shape violation says nothing useful about the value,
    // and the value is the part most likely to be untrusted bulk. The semantic
    // refusals below DO name the offending handle, because there the identifier
    // is the finding.
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.code}`)
      .join('; ');
    throw new MetaNarrativePlanError(
      'PLAN_DRAFT_SCHEMA_INVALID',
      `plan draft does not satisfy the meta narrative plan schema (${issues})`,
    );
  }
  const draft = parsed.data;

  if (draft.sourceBriefHash !== trusted.structuralHash) {
    throw new MetaNarrativePlanError(
      'PLAN_BRIEF_HASH_MISMATCH',
      'the plan draft names a different brief than the one being validated',
    );
  }
  if (draft.sourceClaimGraphHash !== claimGraph.structuralHash) {
    throw new MetaNarrativePlanError(
      'PLAN_GRAPH_HASH_MISMATCH',
      'the plan draft names a different claim graph than the one being validated; a stale plan is never accepted against changed semantic inputs',
    );
  }

  // The brief's own allowlists ARE the domains of these maps, exactly as in C2,
  // so a fact or theme outside them cannot be looked up at all.
  const allowedFactIds = new Set<string>(trusted.constraints.allowedFactIds);
  const factsById = new Map<string, ChartFact>(
    trusted.facts.filter((fact) => allowedFactIds.has(fact.id)).map((fact) => [fact.id, fact]),
  );
  const narratableThemeIds = new Set<string>(trusted.constraints.narratableThemeIds);
  const themesById = new Map<string, PrimaryTheme>(
    trusted.primaryThemes
      .filter((theme) => narratableThemeIds.has(theme.id))
      .map((theme) => [theme.id, theme]),
  );
  const grounding: PlanGrounding = { factsById, themesById };

  const claimsById = new Map<string, AcceptedInterpretiveClaim>(
    claimGraph.claims.map((claim) => [claim.claimId, claim]),
  );

  // --- the report thesis ---------------------------------------------------
  if (isBlank(draft.reportThesis.statement)) {
    throw new MetaNarrativePlanError(
      'PLAN_THESIS_UNGROUNDED',
      'the report thesis carries a statement with no meaning',
    );
  }
  const thesisClaims = resolveClaimRefs(
    draft.reportThesis.claimRefs,
    claimsById,
    'the report thesis',
  );
  const thesisClaimRefs = sortedUnique(thesisClaims.map((claim) => claim.claimId));
  if (thesisClaimRefs.length < 2) {
    // De-duplicated FIRST, so citing one claim twice cannot buy a second.
    throw new MetaNarrativePlanError(
      'PLAN_THESIS_UNGROUNDED',
      'the report thesis rests on fewer than two distinct accepted claims; a synthesis of one claim is that claim restated',
    );
  }
  refuseUngroundedText(
    draft.reportThesis.statement,
    thesisClaims,
    grounding,
    'the report thesis',
    {
      method: 'PLAN_THESIS_OUT_OF_METHOD_SCOPE',
      symbol: 'PLAN_THESIS_UNCITED_SYMBOL',
      number: 'PLAN_THESIS_UNCITED_NUMBER',
    },
  );
  const reportThesis: AcceptedReportThesis = {
    statement: draft.reportThesis.statement,
    claimRefs: thesisClaimRefs,
  };

  // --- the primary motifs --------------------------------------------------
  if (
    draft.primaryMotifs.length < PRIMARY_MOTIF_COUNT.minimum ||
    draft.primaryMotifs.length > PRIMARY_MOTIF_COUNT.maximum
  ) {
    throw new MetaNarrativePlanError(
      'PLAN_MOTIF_COUNT_INVALID',
      `an accepted plan carries between ${String(PRIMARY_MOTIF_COUNT.minimum)} and ${String(PRIMARY_MOTIF_COUNT.maximum)} primary motifs; this draft carries ${String(draft.primaryMotifs.length)}. This is a truth gate: if the accepted graph cannot support the floor, the run is blocked rather than padded`,
    );
  }

  const validatedMotifs: ValidatedMotif[] = [];
  const seenMotifRefs = new Set<string>();
  for (const motifDraft of draft.primaryMotifs) {
    if (seenMotifRefs.has(motifDraft.motifRef)) {
      throw new MetaNarrativePlanError(
        'PLAN_DUPLICATE_MOTIF',
        `motifRef "${motifDraft.motifRef}" is used by two motifs; a chapter could not say which of them it means`,
      );
    }
    seenMotifRefs.add(motifDraft.motifRef);
    validatedMotifs.push({
      motifRef: motifDraft.motifRef,
      motif: validateMotif(motifDraft, claimsById, grounding),
    });
  }

  // Duplicate CONTENT is checked before duplicate ANCHOR, and the order is
  // load-bearing. Two motifs meaning exactly the same thing necessarily share
  // an anchor, so checking anchors first would report every duplicate as an
  // anchor collision and leave the duplicate-content guard unreachable - a
  // guard that can never fire is not a guard.
  const motifIdByRef = new Map<string, string>();
  const acceptedMotifById = new Map<string, AcceptedPrimaryMotif>();
  for (const entry of validatedMotifs) {
    if (acceptedMotifById.has(entry.motif.motifId)) {
      throw new MetaNarrativePlanError(
        'PLAN_DUPLICATE_MOTIF',
        `motif "${entry.motifRef}" carries the same accepted semantic identity as an earlier motif; one recurring reading is not two`,
      );
    }
    acceptedMotifById.set(entry.motif.motifId, entry.motif);
    motifIdByRef.set(entry.motifRef, entry.motif.motifId);
  }

  const anchorOwner = new Map<string, string>();
  for (const entry of validatedMotifs) {
    const existing = anchorOwner.get(entry.motif.anchorClaimRef);
    if (existing !== undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_MOTIF_ANCHOR_INVALID',
        `motifs "${existing}" and "${entry.motifRef}" are anchored in the same accepted claim; one claim cannot be the centre of two distinct motifs`,
      );
    }
    anchorOwner.set(entry.motif.anchorClaimRef, entry.motifRef);
  }

  const primaryMotifs = [...acceptedMotifById.values()].sort((left, right) =>
    left.motifId < right.motifId ? -1 : left.motifId > right.motifId ? 1 : 0,
  );

  // --- the open threads ----------------------------------------------------
  const validatedThreads: ValidatedThread[] = [];
  const threadIdByRef = new Map<string, string>();
  const seenThreadIds = new Set<string>();
  const seenThreadRefs = new Set<string>();
  for (const threadDraft of draft.openThreads) {
    if (seenThreadRefs.has(threadDraft.threadRef)) {
      throw new MetaNarrativePlanError(
        'PLAN_DUPLICATE_THREAD',
        `threadRef "${threadDraft.threadRef}" is used by two threads; a chapter could not say which of them it means`,
      );
    }
    seenThreadRefs.add(threadDraft.threadRef);

    const thread = validateThread(threadDraft, claimsById, motifIdByRef);
    if (seenThreadIds.has(thread.threadId)) {
      throw new MetaNarrativePlanError(
        'PLAN_DUPLICATE_THREAD',
        `thread "${thread.threadRef}" carries the same accepted semantic identity as an earlier thread; one obligation is not two`,
      );
    }
    seenThreadIds.add(thread.threadId);
    threadIdByRef.set(thread.threadRef, thread.threadId);
    validatedThreads.push(thread);
  }

  // --- the chapter plan ----------------------------------------------------
  const chapterIndexByRef = new Map<string, number>();
  draft.chapterPlan.forEach((chapterDraft, index) => {
    if (chapterIndexByRef.has(chapterDraft.chapterRef)) {
      throw new MetaNarrativePlanError(
        'PLAN_DUPLICATE_CHAPTER_REF',
        `chapterRef "${chapterDraft.chapterRef}" is used by two chapters; a thread resolution could name neither of them`,
      );
    }
    chapterIndexByRef.set(chapterDraft.chapterRef, index);
  });

  // ORDER PRESERVED: this is the one list in the artefact that is not sorted.
  const validatedChapters = draft.chapterPlan.map((chapterDraft) => ({
    chapterRef: chapterDraft.chapterRef,
    chapter: validateChapter(chapterDraft, claimsById, motifIdByRef, threadIdByRef),
  }));
  const chapterPlan = validatedChapters.map((entry) => entry.chapter);

  // Accepted chapter identity must be UNIQUE WITHIN ONE PLAN, and this runs
  // before the thread resolutions and the lifecycle walk on purpose. Two
  // chapters that normalize to one `chapterId` necessarily repeat their motif
  // transitions, so a later check would report the collision as a lifecycle
  // violation and leave this guard unreachable - the same ordering argument the
  // duplicate-motif checks above are built on.
  //
  // Uniqueness is validated HERE rather than folded into `chapterId`. Position
  // stays out of the identity (see `deriveChapterId`), so a repeated semantic
  // chapter is refused rather than quietly made unique by where it sits - and
  // `CLOSE_IN_CHAPTER` keeps resolving to exactly one accepted chapter.
  const chapterRefByChapterId = new Map<string, string>();
  for (const entry of validatedChapters) {
    const existing = chapterRefByChapterId.get(entry.chapter.chapterId);
    if (existing !== undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_DUPLICATE_CHAPTER_CONTENT',
        `chapters "${existing}" and "${entry.chapterRef}" carry the same accepted semantic identity; a repeated semantic chapter is not two chapters, and a CLOSE_IN_CHAPTER resolution naming that chapterId could not say which of them it means`,
      );
    }
    chapterRefByChapterId.set(entry.chapter.chapterId, entry.chapterRef);
  }

  // --- thread resolutions, against the real chapter sequence ---------------
  const openedAtIndex = new Map<string, number>();
  const closedAtIndices = new Map<string, number[]>();
  chapterPlan.forEach((chapter, index) => {
    for (const threadId of chapter.openThreadRefs) {
      if (!openedAtIndex.has(threadId)) {
        openedAtIndex.set(threadId, index);
      }
    }
    for (const threadId of chapter.closeThreadRefs) {
      const existing = closedAtIndices.get(threadId) ?? [];
      existing.push(index);
      closedAtIndices.set(threadId, existing);
    }
  });

  const openThreads: AcceptedOpenThread[] = [];
  for (const thread of validatedThreads) {
    const context = `thread "${thread.threadRef}"`;
    const openedAt = openedAtIndex.get(thread.threadId);
    if (openedAt === undefined) {
      throw new MetaNarrativePlanError(
        'PLAN_THREAD_RESOLUTION_INVALID',
        `${context} is declared but no chapter opens it; an obligation nobody raises cannot be discharged or left open`,
      );
    }
    const closures = closedAtIndices.get(thread.threadId) ?? [];

    let resolution: AcceptedThreadResolution;
    if (thread.resolutionDraft.mode === 'CLOSE_IN_CHAPTER') {
      const closingRef = thread.resolutionDraft.chapterRef;
      const closingIndex = chapterIndexByRef.get(closingRef);
      if (closingIndex === undefined) {
        throw new MetaNarrativePlanError(
          'PLAN_THREAD_RESOLUTION_INVALID',
          `${context} closes in chapter "${closingRef}", which this plan does not contain`,
        );
      }
      if (closingIndex <= openedAt) {
        throw new MetaNarrativePlanError(
          'PLAN_THREAD_RESOLUTION_INVALID',
          `${context} closes in a chapter that does not come after the chapter opening it; an obligation cannot be discharged before it is raised`,
        );
      }
      if (!closures.includes(closingIndex)) {
        throw new MetaNarrativePlanError(
          'PLAN_THREAD_RESOLUTION_INVALID',
          `${context} names a closing chapter that does not itself close it; the thread's resolution and the chapter plan disagree`,
        );
      }
      const closingChapter = chapterPlan[closingIndex];
      if (closingChapter === undefined) {
        throw new RangeError(`meta-narrative-plan: chapter index ${String(closingIndex)} is outside the plan`);
      }
      resolution = { mode: 'CLOSE_IN_CHAPTER', chapterId: closingChapter.chapterId };
    } else {
      if (closures.length > 0) {
        throw new MetaNarrativePlanError(
          'PLAN_THREAD_RESOLUTION_INVALID',
          `${context} is declared explicitly left open while a chapter closes it; an open thread that is quietly closed is exactly the disappearance this rule prevents`,
        );
      }
      resolution = { mode: 'EXPLICITLY_LEFT_OPEN' };
    }

    openThreads.push({
      threadId: thread.threadId,
      narrativeRole: thread.narrativeRole,
      claimRefs: thread.claimRefs,
      motifRefs: thread.motifRefs,
      resolution,
    });
  }
  openThreads.sort((left, right) =>
    left.threadId < right.threadId ? -1 : left.threadId > right.threadId ? 1 : 0,
  );

  // --- complete claim coverage ---------------------------------------------
  const coveredClaimIds = new Set<string>(chapterPlan.flatMap((chapter) => chapter.claimRefs));
  for (const claim of claimGraph.claims) {
    if (!coveredClaimIds.has(claim.claimId)) {
      throw new MetaNarrativePlanError(
        'PLAN_CLAIM_COVERAGE_INCOMPLETE',
        `accepted claim "${claim.claimId}" appears in no planned chapter; accepted meaning is not silently discarded between the graph and the plan`,
      );
    }
  }

  // --- real integration ----------------------------------------------------
  const integrations = chapterPlan.filter((chapter) => chapter.narrativeRole === 'INTEGRATE');
  if (integrations.length === 0) {
    throw new MetaNarrativePlanError(
      'PLAN_NO_INTEGRATION',
      'no chapter integrates; a plan that only establishes is a sequence of lookups rather than a reading',
    );
  }
  for (const chapter of integrations) {
    if (chapter.claimRefs.length < 2 || chapter.motifRefs.length < 2) {
      throw new MetaNarrativePlanError(
        'PLAN_NO_INTEGRATION',
        `chapter "${chapter.chapterId}" declares INTEGRATE while relating fewer than two distinct claims or fewer than two distinct motifs; an integration that joins nothing is a label`,
      );
    }
  }

  // --- derived tensions, and the obligation to face them -------------------
  const tensionTypes = new Set<string>(TENSION_RELATION_TYPES);
  const tensionByKey = new Map<string, DerivedNarrativeTension>();
  for (const relation of claimGraph.relations) {
    if (!tensionTypes.has(relation.type)) {
      continue;
    }
    // The cast is safe by the guard above and is what keeps the tension type a
    // strict subset of the relation vocabulary rather than a parallel one.
    const type = relation.type as TensionRelationType;
    tensionByKey.set(`${relation.from} -> ${type} -> ${relation.to}`, {
      from: relation.from,
      type,
      to: relation.to,
    });
  }
  const tensions = [...tensionByKey.values()].sort((left, right) => {
    if (left.from !== right.from) return left.from < right.from ? -1 : 1;
    if (left.type !== right.type) return left.type < right.type ? -1 : 1;
    if (left.to !== right.to) return left.to < right.to ? -1 : 1;
    return 0;
  });

  for (const tension of tensions) {
    const operator = TENSION_CHAPTER_OPERATOR[tension.type];
    const addressed = chapterPlan.some(
      (chapter) =>
        chapter.narrativeRole === operator &&
        chapter.claimRefs.includes(tension.from) &&
        chapter.claimRefs.includes(tension.to),
    );
    if (!addressed) {
      throw new MetaNarrativePlanError(
        'PLAN_TENSION_UNADDRESSED',
        `the claim graph states ${tension.type} between "${tension.from}" and "${tension.to}", and no ${operator} chapter relates both; a tension the chart carries is not quietly omitted`,
      );
    }
  }

  // --- the planned motif lifecycle -----------------------------------------
  const stateByMotifId = new Map<string, MotifLifecycleState>(
    primaryMotifs.map((motif) => [motif.motifId, 'UNSEEN'] as const),
  );
  const advancedMotifIds = new Set<string>();
  for (const chapter of chapterPlan) {
    for (const transition of chapter.motifTransitions) {
      const current = stateByMotifId.get(transition.motifRef);
      if (current === undefined) {
        throw new RangeError(
          `meta-narrative-plan: motif "${transition.motifRef}" has no tracked lifecycle state`,
        );
      }
      const currentPosition = lifecyclePosition(current);
      const targetPosition = lifecyclePosition(transition.targetState);
      if (targetPosition <= currentPosition) {
        throw new MetaNarrativePlanError(
          'PLAN_MOTIF_TRANSITION_INVALID',
          `chapter "${chapter.chapterId}" moves a motif from ${current} to ${transition.targetState}; the approved lifecycle runs forward only, and skipping ahead is allowed while standing still or regressing is not`,
        );
      }
      stateByMotifId.set(transition.motifRef, transition.targetState);
      advancedMotifIds.add(transition.motifRef);
    }
  }

  const explicitlyLeftOpenMotifIds = new Set<string>(
    openThreads
      .filter((thread) => thread.resolution.mode === 'EXPLICITLY_LEFT_OPEN')
      .flatMap((thread) => thread.motifRefs),
  );
  for (const motif of primaryMotifs) {
    if (!advancedMotifIds.has(motif.motifId)) {
      throw new MetaNarrativePlanError(
        'PLAN_MOTIF_SILENTLY_DROPPED',
        `motif "${motif.motifId}" is declared primary and no chapter advances it; a central motif is not introduced and then forgotten`,
      );
    }
    const finalState = stateByMotifId.get(motif.motifId);
    if (finalState === undefined) {
      throw new RangeError(`meta-narrative-plan: motif "${motif.motifId}" has no final state`);
    }
    if (!TERMINAL_MOTIF_STATES.has(finalState) && !explicitlyLeftOpenMotifIds.has(motif.motifId)) {
      throw new MetaNarrativePlanError(
        'PLAN_MOTIF_SILENTLY_DROPPED',
        `motif "${motif.motifId}" ends at ${finalState} with no thread declaring it explicitly left open; an unfinished motif is stated as unfinished or it is not accepted`,
      );
    }
  }

  // --- derived coverage ----------------------------------------------------
  const coverageThemeIds = new Set<string>();
  const coverageFactIds = new Set<string>();
  for (const claimId of coveredClaimIds) {
    const claim = claimsById.get(claimId);
    if (claim === undefined) {
      throw new RangeError(`meta-narrative-plan: covered claim "${claimId}" is not in the graph`);
    }
    for (const factId of claim.factRefs) {
      coverageFactIds.add(factId);
    }
    for (const themeId of claim.themeRefs) {
      coverageThemeIds.add(themeId);
      const theme = themesById.get(themeId);
      if (theme !== undefined) {
        for (const factId of theme.factIds) {
          coverageFactIds.add(factId);
        }
      }
    }
  }

  const coverage: MetaNarrativePlanCoverage = {
    claimRefs: sortedUnique([...coveredClaimIds]),
    themeRefs: sortedUnique([...coverageThemeIds]),
    factRefs: sortedUnique([...coverageFactIds]),
  };

  const core = {
    planVersion: META_NARRATIVE_PLAN_VERSION,
    sourceBriefHash: trusted.structuralHash,
    sourceClaimGraphHash: claimGraph.structuralHash,
    reportThesis,
    primaryMotifs,
    tensions,
    openThreads,
    coverage,
    chapterPlan,
    // DERIVED, never read from the draft: the schema has no such key at all.
    constraints: { claimScope: PLAN_CLAIM_SCOPE },
  };

  return { ...core, structuralHash: hashMetaNarrativePlan(core) };
}
