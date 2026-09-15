/**
 * ETBZ-30 — the InterpretiveClaimProvider port.
 *
 * The application owns this boundary. It is the smallest explicit opening
 * through which structured interpretive-claim drafts can later enter ETBZ-30
 * validation, and declaring it is the whole of C1: there is no adapter behind
 * it, no network, no credential, no cost path and no provider implementation
 * anywhere in `src/`. A port with nothing behind it is the honest state of this
 * commit — the alternative, a deterministic stand-in written only so tests have
 * something to call, would assert a capability the service does not have and
 * would have to be deleted by the commit that adds the real one.
 *
 * WHY IT EXISTS ALONGSIDE `NarrativeProvider` RATHER THAN REPLACING IT. The two
 * ports answer different questions and fail in different ways.
 * `NarrativeProvider` asks for PROSE bound to citations — the answer is text,
 * and `report-model.ts` re-checks every sentence against the HoroscopeModel.
 * `InterpretiveClaimProvider` asks for MEANING as structure — the answer is a
 * set of claims and the relations between them, and it is validated as a graph
 * before any of it becomes a sentence. The canonical contract (Confluence
 * `ETBZ — Long-Form Meta-Narrative Contract v1`, section 4.4) states the reason
 * directly: prose is a rendering of accepted claims and is NOT the persistence
 * layer for meaning. Recovering a long-form report's coherence by re-reading
 * its own earlier prose is precisely what this port exists to avoid, so
 * `NarrativeProvider` keeps its slice and is not deprecated, narrowed or
 * re-pointed by this commit.
 *
 * EVERYTHING THAT ARRIVES HERE IS UNTRUSTED. The schemas below prove SHAPE and
 * nothing else: that the object has the declared fields, that its relation
 * types and epistemic classes are members of the closed vocabularies, and that
 * it invented no key. They deliberately do not answer whether a `factRef` names
 * a fact of THIS chart, whether its echoed `value` matches, whether a
 * `themeRef` is narratable, whether a relation's endpoints exist, or whether
 * provisional lineage was preserved. Every one of
 * those is a SEMANTIC question about a specific brief, application validation
 * owns the answer, and each will be refused by name in a later commit. Keeping
 * them out of the schema is what stops a structural guard from looking like a
 * grounding guard while proving none of it — the same division of labour
 * `narrative-provider.ts` already draws against `report-model.ts`.
 *
 * SYMBOLIC CHART TRUTH STAYS OUTSIDE THIS PORT. A provider sees the
 * `NarrativeBrief` and only the brief: it never receives the HoroscopeModel and
 * has no channel through which an unlisted chart value could enter. `factRefs`
 * is a reference-and-echo pair exactly as `NarrativeCitation` is — the provider
 * quotes a fact the brief already stated, so it can cite a fact but cannot add,
 * amend or recalculate one. FuFirE and the approved deterministic mappings
 * remain the only source of chart facts, and an interpretive claim that could
 * only be grounded by inventing one is a blocked run, not a new fact.
 *
 * WHY `draftRef` AND NOT `claimId`. The identity of an accepted claim is
 * ETBZ's bookkeeping, not the provider's: a stable `claimId` is derived by the
 * application in a later commit, alongside the graph's structural hash. What a
 * provider supplies is a LOCAL handle it uses to point its own relations at its
 * own claims within one answer. Naming it `draftRef` keeps the two apart at the
 * type level, so a provider-chosen string can never be mistaken downstream for
 * an identity the application assigned.
 *
 * SCOPE OF `interpretiveClaimSynthesisOutputSchema`. This is the PORT's output
 * contract, the counterpart of `narrativeProviderOutputSchema`, and it carries
 * `providerId` and `briefStructuralHash` for the same reason that one does:
 * they record which provider answered and which brief it answered about. As in
 * ETBZ-25B they are ETBZ's own stamps rather than anything a model is asked
 * for. The narrower wire schema — what a model may literally put on the wire,
 * with both stamps refused outright, mirroring `narrative-draft.ts` — belongs
 * with the parser that reads a real answer, and arrives with it.
 */

import { z } from 'zod';
import {
  claimRelationTypeSchema,
  interpretiveClaimEpistemicClassSchema,
} from '../interpretation/interpretive-claim.js';
import type {
  ClaimRelationType,
  InterpretiveClaimEpistemicClass,
} from '../interpretation/interpretive-claim.js';
import type { NarrativeBrief } from '../interpretation/narrative-brief.js';

/**
 * One chart fact a claim rests on, echoed back verbatim.
 *
 * The echo is load-bearing in the same way `NarrativeCitation`'s is: a provider
 * cannot quietly restate a chart fact as something else without either changing
 * this value — caught by comparison against the brief — or leaving it correct.
 */
export interface InterpretiveClaimFactRef {
  readonly factId: string;
  /** The fact's value, exactly as the brief stated it. */
  readonly value: string;
}

/**
 * One proposed unit of interpretive meaning, before any of it is accepted.
 *
 * `statement` is the interpretation itself and is required to be non-empty: a
 * claim with nothing to say is not a claim, and admitting one would put an
 * empty node into a graph whose whole purpose is to carry meaning.
 */
export interface InterpretiveClaimDraft {
  /** The provider's own handle for this claim, used by its own relations. */
  readonly draftRef: string;
  /** The semantic interpretation, not decorative prose. */
  readonly statement: string;
  readonly factRefs: readonly InterpretiveClaimFactRef[];
  readonly themeRefs: readonly string[];
  readonly epistemicClass: InterpretiveClaimEpistemicClass;
}

/**
 * A proposed relation between two of the provider's own claim drafts.
 *
 * Three fields, and no fourth. See `interpretive-claim.ts` for why a relation
 * carries no certainty, provisionality, salience, evidence weight or narrative
 * priority, and why there is no lineage table over the relation types.
 */
export interface ClaimRelationDraft {
  /** A `draftRef` from the same answer. */
  readonly from: string;
  readonly type: ClaimRelationType;
  /** A `draftRef` from the same answer. */
  readonly to: string;
}

export interface InterpretiveClaimSynthesisOutput {
  readonly providerId: string;
  /** Binds the answer to one specific brief. */
  readonly briefStructuralHash: string;
  readonly claims: readonly InterpretiveClaimDraft[];
  readonly relations: readonly ClaimRelationDraft[];
}

export interface InterpretiveClaimProvider {
  readonly id: string;
  synthesize(brief: NarrativeBrief): Promise<InterpretiveClaimSynthesisOutput>;
}

/**
 * STRUCTURAL schemas only.
 *
 * `strictObject` at every level: an extra key is a provider inventing a channel
 * the application never agreed to read, and there is no field in this contract
 * whose absence ETBZ would fill in for it. The empty-string floors are the one
 * place emptiness is refused structurally, because an empty `draftRef` cannot
 * be pointed at, an empty `statement` carries no meaning and an empty
 * `themeRef` or `factId` names nothing.
 *
 * `value` carries no floor: it is the brief's own fact value echoed back, and
 * whether it matches is a comparison against the brief rather than a length.
 */
export const interpretiveClaimFactRefSchema = z.strictObject({
  factId: z.string().min(1),
  value: z.string(),
});

export const interpretiveClaimDraftSchema = z.strictObject({
  draftRef: z.string().min(1),
  statement: z.string().min(1),
  factRefs: z.array(interpretiveClaimFactRefSchema),
  themeRefs: z.array(z.string().min(1)),
  epistemicClass: interpretiveClaimEpistemicClassSchema,
});

export const claimRelationDraftSchema = z.strictObject({
  from: z.string().min(1),
  type: claimRelationTypeSchema,
  to: z.string().min(1),
});

export const interpretiveClaimSynthesisOutputSchema = z.strictObject({
  providerId: z.string().min(1),
  briefStructuralHash: z.string().min(1),
  claims: z.array(interpretiveClaimDraftSchema),
  relations: z.array(claimRelationDraftSchema),
});
