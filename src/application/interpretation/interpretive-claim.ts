/**
 * ETBZ-30 prerequisite (implemented under ETBZ-34 by PO order, 2026-09-17) —
 * `InterpretiveClaim` with `methodRefs` (PD-6), validated fail-closed.
 *
 * This module is deliberately NOT the InterpretiveClaimGraph or the
 * MetaNarrativePlan of ETBZ-30. It is the smallest contract those will stand
 * on: one claim, and the proof that the claim is traceable
 *
 *     FACT  ->  approved METHOD  ->  INTERPRETATION
 *
 * Without `methodRefs` the question "which approved method authorised this
 * interpretation?" can only be guessed from prose. With it, the rule "a method
 * that is not approved may not contribute" stops being an instruction to a
 * language model and becomes a check that fails.
 *
 * Invariants (Method Profile v1.0.0, section 9.1):
 *   I1  every methodRef is an APPROVED, claim-bearing method of the bound profile
 *   I2  every methodRef is backed by at least one cited fact of a kind it names
 *   I3  every cited fact is covered by at least one referenced method
 *   I4  every referenced method is ENABLED for this chart
 *   I5  a modifier (positional_context) never stands alone
 *   I6  methodRefs and the profile reference are part of the claim hash
 * plus PD-10 (no assumed-time-derived fact may be cited) and the monotonic
 * uncertainty law (a provisional fact makes the claim TENTATIVE).
 */
import { structuralHash } from '../../domain/structural-hash.js';
import type { ChartFact, InterpretationFeatureSet } from './feature-set.js';
import {
  METHOD_PROFILE_ID,
  isApprovedStatus,
  isIdentityPair,
  resolveMethodEnablement,
} from './method-registry.js';
import type { MethodDefinition, MethodEnablement, MethodRegistry } from './method-registry.js';

export const EPISTEMIC_CLASSES = ['SUPPORTED_INTERPRETATION', 'TENTATIVE_INTERPRETATION'] as const;
export type EpistemicClass = (typeof EPISTEMIC_CLASSES)[number];

/** The closed relation vocabulary of the Long-Form Meta-Narrative Contract v1. */
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

export interface ClaimRelation {
  readonly type: ClaimRelationType;
  readonly targetClaimId: string;
}

export interface InterpretiveClaim {
  readonly claimId: string;
  /** The semantic interpretation — not decorative prose. */
  readonly statement: string;
  readonly factRefs: readonly string[];
  readonly themeRefs: readonly string[];
  /** PD-6. At least one; unique; each a method id of the bound profile. */
  readonly methodRefs: readonly string[];
  readonly epistemicClass: EpistemicClass;
  /** Exactly the provisional subset of `factRefs` — lineage, not judgement. */
  readonly provisionalFactRefs: readonly string[];
  readonly relations: readonly ClaimRelation[];
}

export type ClaimErrorCode =
  | 'CLAIM_UNGROUNDED'
  | 'CLAIM_UNKNOWN_FACT'
  | 'CLAIM_EXCLUDED_FACT_CITED'
  | 'CLAIM_METHOD_REFS_MISSING'
  | 'CLAIM_DUPLICATE_METHOD_REF'
  | 'CLAIM_METHOD_UNKNOWN'
  | 'CLAIM_METHOD_NOT_APPROVED'
  | 'CLAIM_METHOD_NOT_CLAIM_BEARING'
  | 'CLAIM_METHOD_NOT_ENABLED'
  | 'CLAIM_METHOD_WITHOUT_EVIDENCE'
  | 'CLAIM_ORPHAN_FACT'
  | 'CLAIM_MODIFIER_ALONE'
  | 'CLAIM_UNKNOWN_EPISTEMIC_CLASS'
  | 'CLAIM_PROVISIONAL_LAUNDERED'
  | 'CLAIM_PROVISIONAL_LINEAGE_MISMATCH'
  | 'CLAIM_UNKNOWN_RELATION'
  | 'CLAIM_PROFILE_MISMATCH'
  | 'CLAIM_INSUFFICIENT_SIGNALS';

export class ClaimError extends Error {
  readonly code: ClaimErrorCode;
  constructor(code: ClaimErrorCode, message: string) {
    super(message);
    this.name = 'ClaimError';
    this.code = code;
  }
}

export interface ClaimValidationContext {
  readonly registry: MethodRegistry;
  readonly featureSet: InterpretationFeatureSet;
  /** The profile reference the claim graph declares, e.g. `bazi-method-profile@1.0.0`. */
  readonly methodProfileRef: string;
}

function methodCoversFact(
  method: MethodDefinition,
  fact: ChartFact,
  cited: readonly ChartFact[],
): boolean {
  switch (method.evidence.mode) {
    case 'kinds':
      return method.evidence.kinds.includes(fact.kind);
    case 'ANY_FACT_WITH_PILLAR':
      return fact.pillar !== null;
    case 'ANY_TWO_FACTS':
      // An identity relation needs two things that ARE identical: the fact is
      // covered only if ANOTHER cited fact carries the very same value. Without
      // this, naming `fact_relations` would legitimise any fact whatsoever.
      // "Identical" is decided by ONE rule, shared with per-chart enablement.
      return cited.some((other) => isIdentityPair(fact, other));
    case 'NONE':
      return false;
  }
}

function isBlank(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * Validates ONE claim. Throws on the first violation.
 *
 * Returns the facts the claim cites, so a caller (the future claim graph) does
 * not have to look them up a second time.
 */
export function validateInterpretiveClaim(
  claim: InterpretiveClaim,
  context: ClaimValidationContext,
): readonly ChartFact[] {
  const { registry, featureSet } = context;
  const expectedRef = `${METHOD_PROFILE_ID}@${registry.profileVersion}`;
  if (context.methodProfileRef !== expectedRef) {
    throw new ClaimError(
      'CLAIM_PROFILE_MISMATCH',
      `the claim set is bound to "${context.methodProfileRef}" but is being validated against "${expectedRef}"`,
    );
  }

  if (isBlank(claim.statement) || (claim.factRefs.length === 0 && claim.themeRefs.length === 0)) {
    throw new ClaimError('CLAIM_UNGROUNDED', `claim "${claim.claimId}" has no statement or no grounding`);
  }
  // A claim grounded by themes alone would escape I2/I3 entirely. v1.0.0 demands
  // facts; themeRefs are additional structure, never a substitute.
  if (claim.factRefs.length === 0) {
    throw new ClaimError('CLAIM_UNGROUNDED', `claim "${claim.claimId}" cites no chart fact; themeRefs alone do not ground a claim`);
  }

  const factsById = new Map(featureSet.facts.map((fact) => [fact.id, fact]));
  const cited: ChartFact[] = [];
  for (const factRef of claim.factRefs) {
    const fact = factsById.get(factRef);
    if (fact === undefined) {
      throw new ClaimError('CLAIM_UNKNOWN_FACT', `claim "${claim.claimId}" cites "${factRef}", which is not an addressable fact of this chart (a raw payload path is not a factRef)`);
    }
    if (!fact.interpretable) {
      throw new ClaimError(
        'CLAIM_EXCLUDED_FACT_CITED',
        `claim "${claim.claimId}" cites "${fact.id}", which is excluded from interpretation (${fact.exclusionReason ?? 'excluded'}); an assumed time of day is not the customer's birth`,
      );
    }
    cited.push(fact);
  }

  if (claim.methodRefs.length === 0) {
    throw new ClaimError('CLAIM_METHOD_REFS_MISSING', `claim "${claim.claimId}" names no method; an interpretation no approved method authorised is refused`);
  }
  if (new Set(claim.methodRefs).size !== claim.methodRefs.length) {
    throw new ClaimError('CLAIM_DUPLICATE_METHOD_REF', `claim "${claim.claimId}" names a method twice`);
  }

  const methodsById = new Map(registry.methods.map((method) => [method.methodId, method]));
  const enablement = new Map<string, MethodEnablement>(
    resolveMethodEnablement(registry, featureSet).map((entry) => [entry.methodId, entry]),
  );
  const methods: MethodDefinition[] = [];
  for (const methodRef of claim.methodRefs) {
    const method = methodsById.get(methodRef);
    if (method === undefined) {
      throw new ClaimError('CLAIM_METHOD_UNKNOWN', `claim "${claim.claimId}" names method "${methodRef}", which the profile does not know`);
    }
    if (!isApprovedStatus(method.status)) {
      throw new ClaimError('CLAIM_METHOD_NOT_APPROVED', `claim "${claim.claimId}" relies on "${methodRef}" (${method.status}); that the method exists does not make it available`);
    }
    if (!method.claimBearing) {
      throw new ClaimError('CLAIM_METHOD_NOT_CLAIM_BEARING', `claim "${claim.claimId}" names "${methodRef}", which never grounds a claim`);
    }
    const state = enablement.get(methodRef);
    if (state === undefined || !state.enabled) {
      throw new ClaimError('CLAIM_METHOD_NOT_ENABLED', `claim "${claim.claimId}" relies on "${methodRef}", which is not enabled for this chart (${state?.reason ?? 'unknown'}: ${state?.detail ?? ''})`);
    }
    methods.push(method);
  }

  // I5
  if (methods.every((method) => method.modifier)) {
    throw new ClaimError('CLAIM_MODIFIER_ALONE', `claim "${claim.claimId}" rests on a modifier only; position qualifies a reading, it is not one`);
  }
  // I2
  for (const method of methods) {
    if (!cited.some((fact) => methodCoversFact(method, fact, cited))) {
      throw new ClaimError('CLAIM_METHOD_WITHOUT_EVIDENCE', `claim "${claim.claimId}" names "${method.methodId}" but cites no fact that method may read`);
    }
  }
  // I3 — a modifier does not count as cover: otherwise `positional_context`
  // would legitimise any fact that happens to sit in a pillar.
  const covering = methods.filter((method) => !method.modifier);
  for (const fact of cited) {
    if (!covering.some((method) => methodCoversFact(method, fact, cited))) {
      throw new ClaimError('CLAIM_ORPHAN_FACT', `claim "${claim.claimId}" cites "${fact.id}" (${fact.kind}), which none of its methods may read`);
    }
  }

  if (!(EPISTEMIC_CLASSES as readonly string[]).includes(claim.epistemicClass)) {
    throw new ClaimError('CLAIM_UNKNOWN_EPISTEMIC_CLASS', `claim "${claim.claimId}" has epistemic class "${String(claim.epistemicClass)}"`);
  }
  const provisional = cited.filter((fact) => fact.provisional).map((fact) => fact.id).sort();
  const declared = [...claim.provisionalFactRefs].sort();
  if (provisional.length !== declared.length || provisional.some((id, index) => id !== declared[index])) {
    throw new ClaimError('CLAIM_PROVISIONAL_LINEAGE_MISMATCH', `claim "${claim.claimId}" declares provisional lineage [${declared.join(', ')}] but cites [${provisional.join(', ')}]`);
  }
  if (provisional.length > 0 && claim.epistemicClass !== 'TENTATIVE_INTERPRETATION') {
    throw new ClaimError('CLAIM_PROVISIONAL_LAUNDERED', `claim "${claim.claimId}" cites provisional facts (${provisional.join(', ')}) but calls itself ${claim.epistemicClass}; uncertainty may not disappear downstream`);
  }

  const relationVocabulary = new Set<string>(CLAIM_RELATION_TYPES);
  for (const relation of claim.relations) {
    if (!relationVocabulary.has(relation.type)) {
      throw new ClaimError('CLAIM_UNKNOWN_RELATION', `claim "${claim.claimId}" uses relation "${String(relation.type)}"; "combines", "clashes" or "transforms" are astrological interactions, not claim relations`);
    }
  }
  return cited;
}

/**
 * PD-5 — the multi-signal floor for a claim that carries the report thesis or
 * the core of a primary motif.
 *
 * MVP v1, WITHOUT EXCEPTION: >= 2 distinct fact kinds AND >= 2 approved method
 * contributions. There is no "distinctive single configuration" escape and no
 * caller-controlled option of any kind: a flag the caller sets is not evidence.
 * The signature takes the claim and its validation context and nothing else.
 *
 * This is a structural grounding floor. It is not, and must never be turned
 * into, a confidence or salience score.
 */
export function assertCentralClaimSignals(
  claim: InterpretiveClaim,
  context: ClaimValidationContext,
): void {
  const cited = validateInterpretiveClaim(claim, context);
  const kinds = new Set(cited.map((fact) => fact.kind));
  // `methodRefs` is already proven duplicate-free, approved, claim-bearing,
  // enabled and evidence-backed (I1, I2, I4) by the validation above.
  if (kinds.size >= 2 && claim.methodRefs.length >= 2) {
    return;
  }
  throw new ClaimError(
    'CLAIM_INSUFFICIENT_SIGNALS',
    `claim "${claim.claimId}" would carry a thesis or primary motif on ${String(kinds.size)} fact kind(s) and ${String(claim.methodRefs.length)} method(s); a shared single primitive must not decide a reading`,
  );
}

/** I6 — the hash a claim graph stores. Method attribution is inside it. */
export function interpretiveClaimStructuralHash(claim: InterpretiveClaim, methodProfileRef: string): string {
  return structuralHash({
    methodProfileRef,
    claimId: claim.claimId,
    statement: claim.statement,
    factRefs: [...claim.factRefs].sort(),
    themeRefs: [...claim.themeRefs].sort(),
    methodRefs: [...claim.methodRefs].sort(),
    epistemicClass: claim.epistemicClass,
    provisionalFactRefs: [...claim.provisionalFactRefs].sort(),
    relations: [...claim.relations]
      .map((relation) => ({ type: relation.type, targetClaimId: relation.targetClaimId }))
      .sort((left, right) => (`${left.type}:${left.targetClaimId}` < `${right.type}:${right.targetClaimId}` ? -1 : 1)),
  });
}
