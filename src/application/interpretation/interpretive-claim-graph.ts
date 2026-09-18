/**
 * ETBZ-30A — InterpretiveClaimGraph: the accepted claims of ONE chart, as a
 * closed, normalised, hash-bound graph.
 *
 *     NarrativeBrief + InterpretiveClaim drafts
 *       -> validation -> normalisation -> InterpretiveClaimGraph
 *
 * This module is an acceptance boundary. It writes no prose, calls no provider,
 * derives no chart fact and knows no astrology: every judgement about a single
 * claim is made by `validateInterpretiveClaim` (grounding, PD-6 / I1–I5, PD-10,
 * provisional lineage, the closed relation vocabulary, the released profile),
 * and the PD-5 floor is `assertCentralClaimSignals`. The graph COMPOSES those
 * gates and adds only what no single claim can see:
 *
 *   - the binding to the exact brief, feature set and released method profile;
 *   - relation targets that resolve to ACCEPTED claims of the same graph;
 *   - one canonical order, so input order is never meaning;
 *   - refusal of every duplicate, so repetition is never importance.
 *
 * Identity. A draft's `claimId` is a handle: unique inside the draft, the thing
 * `relations[].targetClaimId` points at, and nothing more. The accepted
 * `claimId` is derived from the claim's semantic content — the profile
 * reference, the statement, every cited fact WITH ITS VALUE, themeRefs,
 * methodRefs, epistemic class and provisional lineage — so the same meaning has
 * the same identity whoever drafted it, under whatever handle, in whatever
 * order, and a claim about a fact that changed is not the same claim. Relations
 * are not part of that identity (two claims may contrast with each other; an
 * identity that contained its own targets could not be computed for a cycle);
 * they are inside each claim's I6 hash and therefore inside the graph hash.
 *
 * One statement, one claim. Inside a graph a statement may occur once: the same
 * sentence under a second handle is the same interpretation again, whatever
 * label — epistemic class, theme, method set, grounding — was changed to tell
 * the two apart. For that to mean anything a statement must be in canonical
 * form (NFC; U+0020 as the only white space, single and not at the ends; no
 * control, format or otherwise invisible character); one that is not is
 * refused, never repaired. That closes spelling, spacing and invisible marks —
 * not look-alike letters. Identity stays STRUCTURAL beyond that: two
 * differently worded statements are two claims — `ALTERNATIVE_READING` needs
 * exactly that — and judging paraphrase is not this slice's business.
 *
 * Nothing here is a number. There is no salience, rank, weight, count,
 * confidence or score on the graph, on a claim or on a relation, and an input
 * that carries one is refused rather than ignored.
 *
 * Fail-closed: the first violation throws, and no partial graph exists.
 */
import { z } from 'zod';
import { structuralHash } from '../../domain/structural-hash.js';
import type { HoroscopeModel } from '../horoscope-model.js';
import type { ChartFact } from './feature-set.js';
import {
  ClaimError,
  assertCentralClaimSignals,
  interpretiveClaimStructuralHash,
  validateInterpretiveClaim,
} from './interpretive-claim.js';
import type { ClaimRelation, ClaimValidationContext, InterpretiveClaim } from './interpretive-claim.js';
import { methodRegistryStructuralHash } from './method-registry.js';
import type { MethodRegistry } from './method-registry.js';
import { buildNarrativeChain } from './narrative-brief.js';
import type { NarrativeBrief } from './narrative-brief.js';

export const INTERPRETIVE_CLAIM_GRAPH_VERSION = 'etbz-30.interpretive-claim-graph.v1' as const;

/** An accepted claim: the claim itself plus the I6 hash the graph stores for it. */
export interface AcceptedInterpretiveClaim extends InterpretiveClaim {
  readonly structuralHash: string;
}

export interface InterpretiveClaimGraph {
  readonly graphVersion: typeof INTERPRETIVE_CLAIM_GRAPH_VERSION;
  /** `structuralHash` of the exact NarrativeBrief these claims were accepted against. */
  readonly sourceBriefStructuralHash: string;
  /** The feature set every `factRef` was resolved in (the brief's own lineage). */
  readonly featureSetStructuralHash: string;
  /** e.g. `bazi-method-profile@1.0.0` — the reference inside every claim hash (I6). */
  readonly methodProfileRef: string;
  readonly methodProfileVersion: string;
  /** Content hash of the RELEASED registry that authorised every `methodRef`. */
  readonly methodRegistryStructuralHash: string;
  /** Sorted by `claimId`. Refs and relations inside each claim are sorted too. */
  readonly claims: readonly AcceptedInterpretiveClaim[];
  readonly structuralHash: string;
}

/** What a drafter hands in. Untrusted; see `claimGraphDraftSchema`. */
export interface InterpretiveClaimGraphDraft {
  /** The brief the claims were written for. Compared, never trusted. */
  readonly sourceBriefStructuralHash: string;
  readonly methodProfileRef: string;
  readonly claims: readonly InterpretiveClaim[];
}

export interface ClaimGraphContext {
  readonly model: HoroscopeModel;
  /** Verified against `model`, never trusted. */
  readonly brief: NarrativeBrief;
  readonly registry: MethodRegistry;
}

export type ClaimGraphErrorCode =
  | 'CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL'
  | 'CLAIM_GRAPH_SCHEMA_INVALID'
  | 'CLAIM_GRAPH_BRIEF_HASH_MISMATCH'
  | 'CLAIM_GRAPH_EMPTY'
  | 'CLAIM_GRAPH_DUPLICATE_CLAIM_ID'
  | 'CLAIM_GRAPH_STATEMENT_NOT_CANONICAL'
  | 'CLAIM_GRAPH_DUPLICATE_REF'
  | 'CLAIM_GRAPH_UNKNOWN_THEME'
  | 'CLAIM_GRAPH_THEME_NOT_GROUNDED'
  | 'CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT'
  | 'CLAIM_GRAPH_DANGLING_RELATION'
  | 'CLAIM_GRAPH_SELF_RELATION'
  | 'CLAIM_GRAPH_NOT_INTACT'
  | 'CLAIM_GRAPH_UNKNOWN_CLAIM';

export class ClaimGraphError extends Error {
  readonly code: ClaimGraphErrorCode;
  constructor(code: ClaimGraphErrorCode, message: string) {
    super(message);
    this.name = 'ClaimGraphError';
    this.code = code;
  }
}

/**
 * An id-like string. Bounded, because refusals further down NAME the offending
 * id — the identifier is the finding — and an unbounded one would turn an error
 * message into a channel for untrusted bulk. The bound is per string: the NUMBER
 * of refs is not limited here (the Method Profile sets no maximum), and the
 * claim validator's lineage refusal lists what a claim declared.
 */
const idLike = z.string().min(1).max(256);

/**
 * The closed SHAPE of a draft. `strictObject` throughout: a field this contract
 * does not name — a salience, a confidence, a provider or run id — is a refusal,
 * not something to drop quietly. Vocabulary (`epistemicClass`, relation `type`)
 * is deliberately left to the claim validator, which owns those refusals.
 */
const claimGraphDraftSchema = z.strictObject({
  sourceBriefStructuralHash: idLike,
  methodProfileRef: idLike,
  claims: z.array(z.strictObject({
    claimId: idLike,
    statement: z.string(),
    factRefs: z.array(idLike),
    themeRefs: z.array(idLike),
    methodRefs: z.array(idLike),
    epistemicClass: idLike,
    provisionalFactRefs: z.array(idLike),
    relations: z.array(z.strictObject({
      type: idLike,
      targetClaimId: idLike,
    })),
  })),
});

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function relationKey(relation: ClaimRelation): string {
  return `${relation.type} -> ${relation.targetClaimId}`;
}

function refuseRepeated(claimId: string, what: string, values: readonly string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new ClaimGraphError(
        'CLAIM_GRAPH_DUPLICATE_REF',
        `claim "${claimId}" names ${what} "${value}" more than once; saying a thing twice does not make it weigh more`,
      );
    }
    seen.add(value);
  }
}

/** Every white-space character except U+0020: tabs, line breaks, no-break, thin, ideographic space, U+2028... */
const FOREIGN_SPACE = /[^\S ]/u;

/**
 * Characters that render as nothing: controls, format characters (zero-width
 * space and joiners, soft hyphen, directional marks), everything Unicode calls
 * default-ignorable (variation selectors, grapheme joiner, Hangul fillers) and
 * the blank Braille pattern.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\u2800]/u;

/**
 * One sentence, one spelling, one kind of space, nothing unseen — otherwise a
 * trailing space, a no-break space or a zero-width mark would make a second
 * claim out of the same sentence. Look-alike letters of another script are NOT
 * caught here; that would need a confusables table nobody approved.
 */
function isCanonicalStatement(statement: string): boolean {
  return statement === statement.normalize('NFC')
    && statement === statement.trim()
    && !statement.includes('  ')
    && !FOREIGN_SPACE.test(statement)
    && !INVISIBLE.test(statement);
}

/**
 * The semantic identity of a claim. No handle, no relation, no order — and the
 * VALUE of every cited fact, so that the same words about a fact that changed
 * are a different claim. The value is hashed, never published.
 */
function deriveClaimId(claim: InterpretiveClaim, cited: readonly ChartFact[], methodProfileRef: string): string {
  return `claim.${structuralHash({
    methodProfileRef,
    statement: claim.statement,
    citedFacts: cited
      .map((fact) => ({ id: fact.id, value: fact.value }))
      .sort((left, right) => (left.id < right.id ? -1 : 1)),
    themeRefs: sorted(claim.themeRefs),
    methodRefs: sorted(claim.methodRefs),
    epistemicClass: claim.epistemicClass,
    provisionalFactRefs: sorted(claim.provisionalFactRefs),
  })}`;
}

/**
 * Validates a draft against the chart it claims to interpret and assembles the
 * graph. Refuses with `ClaimGraphError`, or with the claim validator's own
 * `ClaimError` / `MethodRegistryError` unchanged, and returns nothing partial.
 * (A model the narrative chain itself cannot derive fails as that chain fails.)
 */
export function buildInterpretiveClaimGraph(draft: unknown, context: ClaimGraphContext): InterpretiveClaimGraph {
  // The chain is RE-DERIVED from the model. The supplied brief is only ever
  // compared against this one; it is never the authority.
  const rederived = buildNarrativeChain(context.model);
  let supplied: string | null;
  try {
    supplied = structuralHash(context.brief);
  } catch {
    supplied = null; // not even JSON-representable: certainly not what the chain produces
  }
  if (supplied !== structuralHash(rederived.brief)) {
    throw new ClaimGraphError(
      'CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL',
      'the supplied brief is not the brief this HoroscopeModel produces; claims are never accepted against an unverified brief',
    );
  }
  const brief = rederived.brief;

  const parsed = claimGraphDraftSchema.safeParse(draft);
  if (!parsed.success) {
    // Path + code only: the value is the part most likely to be untrusted bulk.
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || '<root>'}: ${issue.code}`)
      .join('; ');
    throw new ClaimGraphError('CLAIM_GRAPH_SCHEMA_INVALID', `the claim draft does not satisfy the draft schema (${issues})`);
  }
  const { sourceBriefStructuralHash, methodProfileRef } = parsed.data;
  // Shape is proven; `epistemicClass` and relation `type` are still arbitrary
  // strings here, and `validateInterpretiveClaim` is what refuses a foreign one.
  const drafts = parsed.data.claims as readonly InterpretiveClaim[];

  if (sourceBriefStructuralHash !== brief.structuralHash) {
    throw new ClaimGraphError('CLAIM_GRAPH_BRIEF_HASH_MISMATCH', 'the claims were drafted for a different brief than the one they are being accepted against');
  }
  if (drafts.length === 0) {
    throw new ClaimGraphError('CLAIM_GRAPH_EMPTY', 'the draft contains no claim; an empty graph accepts nothing and grounds nothing');
  }

  const validation: ClaimValidationContext = {
    registry: context.registry,
    featureSet: rederived.featureSet,
    methodProfileRef,
  };
  // A theme's `factIds` are its entire evidence, at both levels of the brief.
  const themeFactIds = new Map<string, ReadonlySet<string>>(
    [...brief.primaryThemes, ...brief.candidateThemes].map((theme) => [theme.id, new Set(theme.factIds)]),
  );

  const acceptedIdByHandle = new Map<string, string>();
  const handleByStatement = new Map<string, string>();
  for (const claim of drafts) {
    if (acceptedIdByHandle.has(claim.claimId)) {
      throw new ClaimGraphError('CLAIM_GRAPH_DUPLICATE_CLAIM_ID', `two claims share the id "${claim.claimId}"; a relation to it would be ambiguous`);
    }
    const cited = validateInterpretiveClaim(claim, validation);

    if (!isCanonicalStatement(claim.statement)) {
      throw new ClaimGraphError(
        'CLAIM_GRAPH_STATEMENT_NOT_CANONICAL',
        `the statement of claim "${claim.claimId}" is not in canonical form (NFC, U+0020 as the only white space, single and not at the ends, no invisible characters)`,
      );
    }
    refuseRepeated(claim.claimId, 'fact', claim.factRefs);
    refuseRepeated(claim.claimId, 'theme', claim.themeRefs);
    refuseRepeated(claim.claimId, 'relation', claim.relations.map(relationKey));
    for (const themeRef of claim.themeRefs) {
      const evidence = themeFactIds.get(themeRef);
      if (evidence === undefined) {
        throw new ClaimGraphError('CLAIM_GRAPH_UNKNOWN_THEME', `claim "${claim.claimId}" names theme "${themeRef}", which the bound brief does not contain`);
      }
      if (!claim.factRefs.some((factRef) => evidence.has(factRef))) {
        throw new ClaimGraphError('CLAIM_GRAPH_THEME_NOT_GROUNDED', `claim "${claim.claimId}" names theme "${themeRef}" but cites none of that theme's facts; a theme is a grouping of evidence, not a label to borrow`);
      }
    }

    const twin = handleByStatement.get(claim.statement);
    if (twin !== undefined) {
      throw new ClaimGraphError(
        'CLAIM_GRAPH_DUPLICATE_CLAIM_CONTENT',
        `claims "${twin}" and "${claim.claimId}" make the same statement; submitting an interpretation twice does not make it two claims, whatever label was changed`,
      );
    }
    handleByStatement.set(claim.statement, claim.claimId);
    acceptedIdByHandle.set(claim.claimId, deriveClaimId(claim, cited, methodProfileRef));
  }

  // Every claim above is ACCEPTED, so resolving a target here means resolving it
  // to an accepted claim — a relation can never keep an invalid claim alive.
  const claims = drafts.map((claim): AcceptedInterpretiveClaim => {
    const claimId = acceptedIdByHandle.get(claim.claimId);
    if (claimId === undefined) {
      throw new ClaimGraphError('CLAIM_GRAPH_UNKNOWN_CLAIM', `claim "${claim.claimId}" was not accepted`);
    }
    const relations = claim.relations.map((relation): ClaimRelation => {
      const targetClaimId = acceptedIdByHandle.get(relation.targetClaimId);
      if (targetClaimId === undefined) {
        throw new ClaimGraphError('CLAIM_GRAPH_DANGLING_RELATION', `claim "${claim.claimId}" ${relation.type} "${relation.targetClaimId}", which is not a claim of this graph`);
      }
      if (targetClaimId === claimId) {
        throw new ClaimGraphError('CLAIM_GRAPH_SELF_RELATION', `claim "${claim.claimId}" ${relation.type} itself; a relation says how two interpretations interact`);
      }
      return { type: relation.type, targetClaimId };
    });
    const accepted: InterpretiveClaim = {
      claimId,
      statement: claim.statement,
      factRefs: sorted(claim.factRefs),
      themeRefs: sorted(claim.themeRefs),
      methodRefs: sorted(claim.methodRefs),
      epistemicClass: claim.epistemicClass,
      provisionalFactRefs: sorted(claim.provisionalFactRefs),
      relations: relations.sort((left, right) => (relationKey(left) < relationKey(right) ? -1 : 1)),
    };
    return { ...accepted, structuralHash: interpretiveClaimStructuralHash(accepted, methodProfileRef) };
  });

  const core = {
    graphVersion: INTERPRETIVE_CLAIM_GRAPH_VERSION,
    sourceBriefStructuralHash: brief.structuralHash,
    featureSetStructuralHash: rederived.featureSet.structuralHash,
    methodProfileRef,
    methodProfileVersion: context.registry.profileVersion,
    methodRegistryStructuralHash: methodRegistryStructuralHash(context.registry),
    claims: claims.sort((left, right) => (left.claimId < right.claimId ? -1 : 1)),
  };
  return { ...core, structuralHash: structuralHash(core) };
}

/**
 * The draft a graph is the acceptance of: its bindings and its claims, without
 * anything the builder computes. Building it again yields the same graph.
 */
export function claimGraphDraftOf(graph: InterpretiveClaimGraph): InterpretiveClaimGraphDraft {
  return {
    sourceBriefStructuralHash: graph.sourceBriefStructuralHash,
    methodProfileRef: graph.methodProfileRef,
    claims: graph.claims.map((claim) => ({
      claimId: claim.claimId,
      statement: claim.statement,
      factRefs: claim.factRefs,
      themeRefs: claim.themeRefs,
      methodRefs: claim.methodRefs,
      epistemicClass: claim.epistemicClass,
      provisionalFactRefs: claim.provisionalFactRefs,
      relations: claim.relations,
    })),
  };
}

/**
 * Proves that `graph` is, byte for byte, the graph the builder produces from
 * the graph's own claims for this chart, this brief and this released profile.
 * Anything else — an edited claim, an added field, another chart — is refused.
 *
 * This is a consistency proof, not tamper evidence: the hashes are plain
 * SHA-256, so whoever can edit a graph can re-hash it, and an edit that is
 * itself acceptable yields an intact, DIFFERENT graph. Whoever needs to know
 * that a graph is still the one they accepted pins its `structuralHash`.
 *
 * A wrong context is not a damaged graph: an unreleased registry and a brief
 * that does not belong to the model surface as what they are.
 */
export function assertInterpretiveClaimGraphIntact(graph: InterpretiveClaimGraph, context: ClaimGraphContext): void {
  let presented: string;
  let draft: InterpretiveClaimGraphDraft;
  try {
    presented = structuralHash(graph);
    draft = claimGraphDraftOf(graph);
  } catch {
    throw new ClaimGraphError('CLAIM_GRAPH_NOT_INTACT', 'the value does not have the shape of an accepted graph');
  }
  let rebuilt: InterpretiveClaimGraph;
  try {
    rebuilt = buildInterpretiveClaimGraph(draft, context);
  } catch (error) {
    const refusedClaims = error instanceof ClaimError
      || (error instanceof ClaimGraphError && error.code !== 'CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL');
    if (!refusedClaims) {
      throw error;
    }
    throw new ClaimGraphError('CLAIM_GRAPH_NOT_INTACT', `the graph is not acceptable for this chart (${error.message})`);
  }
  if (presented !== structuralHash(rebuilt)) {
    throw new ClaimGraphError('CLAIM_GRAPH_NOT_INTACT', 'the graph differs from the graph its own claims produce for this chart');
  }
}

/**
 * PD-5 for a claim of an accepted graph that is about to carry a report thesis
 * or the core of a primary motif. The floor itself is `assertCentralClaimSignals`
 * and nothing else; this only makes sure the claim it is asked about really is
 * an accepted claim of an intact graph. No option, no flag, no exception.
 */
export function assertCentralGraphClaim(graph: InterpretiveClaimGraph, claimId: string, context: ClaimGraphContext): void {
  assertInterpretiveClaimGraphIntact(graph, context);
  const claim = graph.claims.find((candidate) => candidate.claimId === claimId);
  if (claim === undefined) {
    throw new ClaimGraphError('CLAIM_GRAPH_UNKNOWN_CLAIM', `"${claimId}" is not a claim of this graph`);
  }
  assertCentralClaimSignals(claim, {
    registry: context.registry,
    featureSet: buildNarrativeChain(context.model).featureSet,
    methodProfileRef: graph.methodProfileRef,
  });
}
