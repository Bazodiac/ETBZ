/**
 * ETBZ-30 — the closed vocabularies of the long-form meta-narrative contract.
 *
 * This module owns four vocabularies and nothing else. Each one is fixed by the
 * canonical contract (Confluence `ETBZ — Long-Form Meta-Narrative Contract v1`,
 * sections 5 to 8) rather than chosen here, so this file is a transcription of
 * an approved decision and not a place where new interpretive categories may be
 * invented. Adding a member is a contract change, not a refactor.
 *
 * WHY A VOCABULARY MODULE AT ALL. The vocabularies are read from two sides that
 * must never import each other: the untrusted synthesis boundary in
 * `src/application/ports/interpretive-claim-provider.ts`, and — in a later
 * commit — the deterministic validation that decides which drafts become
 * accepted claims. The same shape already went wrong once in this slice: the
 * prompt and the QA gate each kept their own copy of five numbers and drifted,
 * which is why `narrative-qa-policy.ts` exists and why the architecture guard
 * pins it as a module that imports nothing. This module follows that precedent:
 * it imports `zod` and nothing else, so either side can read it without
 * dragging the other side's graph along.
 *
 * EACH VOCABULARY IS DECLARED ONCE. The runtime array is the single source of
 * truth; the TypeScript union is DERIVED from it with `(typeof X)[number]` and
 * the zod schema is built FROM it. A union and an array that are written out
 * twice can disagree while both look correct — here they cannot, because there
 * is only one list. `tests/unit/interpretive-claim.test.ts` still measures the
 * agreement from outside, so the derivation is proven rather than trusted.
 *
 * WHAT A RELATION DELIBERATELY DOES NOT CARRY. A `ClaimRelation` records THAT
 * two interpretations interact and HOW, and carries no certainty, no
 * provisionality, no salience, no evidence weight and no narrative priority.
 * Anti-drift law 7 of the contract refuses invented numerical
 * confidence/salience scores outright, and a weight on a relation is exactly
 * that score wearing a different name: it would let a model assert that one
 * grounded reading matters more than another without any chart fact saying so.
 * Provisionality has an owner already — it travels with the FACT through the
 * brief's `provisionalFactIds` and must propagate into dependent claims (Jira
 * AC2) — so a second provisionality channel on the relation would be a place
 * for the two to disagree. There is likewise NO `RELATION_LINEAGE` table: the
 * relation types are a flat closed set, and any ordering, grouping or implied
 * hierarchy over them would be an ETBZ-authored ranking the contract does not
 * state.
 *
 * THE TWO NAMES THAT ARE ABSENT ON PURPOSE. `FACT` is not an epistemic class of
 * an interpretive claim: contract section 5 keeps `FACT` outside this structure
 * entirely, owned by the deterministic chart model, and admitting it here would
 * turn an untrusted synthesis boundary into a second chart-fact source — the
 * precise failure the whole layer exists to prevent. `REFLECTION` is not one
 * either: section 5 makes it a downstream customer interaction DERIVED from
 * accepted claims (section 17), so a draft that classified itself as a
 * reflection would be claiming an output role it cannot occupy. Both absences
 * are asserted as refusals in the unit tests, because an absence that nobody
 * measures is indistinguishable from an oversight.
 *
 * DECLARED HERE, NOT IMPLEMENTED HERE. The motif lifecycle and the narrative
 * operators are stated because the contract fixes them and because pinning the
 * spelling early is what stops two later commits from inventing two different
 * ones. C1 implements NO motif state transition and NO `ChapterContract`
 * behaviour: which motif may move from `SEEDED` to `DEVELOPED`, and which
 * operator a chapter is allowed to carry, are decisions that belong to the
 * commits that build the plan and the chapter contract.
 */

import { z } from 'zod';

/**
 * The relations an `InterpretiveClaimGraph` may carry (contract section 6).
 *
 * The order is the contract's own and is preserved so that a reader comparing
 * the two documents can do it line by line. Nothing reads meaning INTO the
 * order: it is not a precedence, a strength or a lifecycle.
 */
export const CLAIM_RELATION_TYPES = [
  'SUPPORTS',
  'QUALIFIES',
  'CONTRASTS_WITH',
  'CONTEXTUALIZES',
  'DEVELOPS',
  'INTEGRATES',
  'ALTERNATIVE_READING',
] as const;

export type ClaimRelationType = (typeof CLAIM_RELATION_TYPES)[number];

/** Closed at runtime. An unlisted relation is refused, never coerced. */
export const claimRelationTypeSchema = z.enum(CLAIM_RELATION_TYPES);

/**
 * The epistemic classes an `InterpretiveClaim` may declare (contract section 5).
 *
 * Two classes, and the distinction between them is about the GROUNDING a claim
 * rests on, not about how confident its prose sounds. `FACT` and `REFLECTION`
 * are deliberately absent; see this file's docblock for why each one would
 * break a boundary rather than merely widen a list.
 */
export const INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES = [
  'SUPPORTED_INTERPRETATION',
  'TENTATIVE_INTERPRETATION',
] as const;

export type InterpretiveClaimEpistemicClass =
  (typeof INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES)[number];

export const interpretiveClaimEpistemicClassSchema = z.enum(
  INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES,
);

/**
 * The motif lifecycle of the meta-narrative plan (contract section 8).
 *
 * Written in the contract as a progression, and that progression is exactly
 * what this constant does NOT encode: the contract states that not every motif
 * must visit every intermediate state, so a transition table derived from this
 * order would be stricter than the decision it claims to implement. The states
 * are declared as a closed SET here; which transitions are legal is owned by
 * the commit that implements the plan.
 */
export const MOTIF_LIFECYCLE_STATES = [
  'UNSEEN',
  'SEEDED',
  'DEVELOPED',
  'COMPLICATED',
  'INTEGRATED',
  'CLOSED',
] as const;

export type MotifLifecycleState = (typeof MOTIF_LIFECYCLE_STATES)[number];

export const motifLifecycleStateSchema = z.enum(MOTIF_LIFECYCLE_STATES);

/**
 * The narrative operators a chapter may carry as its primary operation
 * (contract section 7).
 *
 * Declared, not applied. The contract's rule that a report dominated by
 * repeated `ESTABLISH` is lookup-style and fails the intended product behaviour
 * is a judgement over a whole plan, and it is enforced where the plan exists —
 * not here, where there is only the vocabulary.
 */
export const NARRATIVE_OPERATORS = [
  'ESTABLISH',
  'REINFORCE',
  'QUALIFY',
  'CONTRAST',
  'CONTEXTUALIZE',
  'INTEGRATE',
] as const;

export type NarrativeOperator = (typeof NARRATIVE_OPERATORS)[number];

export const narrativeOperatorSchema = z.enum(NARRATIVE_OPERATORS);
