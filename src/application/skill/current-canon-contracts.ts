// =============================================================================
// ETBZ-117 (Canon v2, R0) - the current Canon v2 context: the one entry point
// new Canon v2 work binds its Lens and Lexicon through (ETBZ-78 onward).
//
// The Canon v2 contract line has two released contexts (`canon-v2-contracts.ts`,
// ADR 0019 and ADR 0020): 2.0.0 binds C1 and C5 at page version 1 and is the
// historical A1 release (ETBZ-77); 2.1.0 binds them at page version 2, the
// pages the Product Owner's reconcile of 2026-10-05 made current. The functions
// of `canon-v2-contracts.ts` keep answering for 2.0.0 when no version is named,
// because that is what 2.0.0 released. A caller that means "the current Canon"
// therefore uses this module, which names no version at its call site and
// cannot be handed one: every function here is fixed to
// `CURRENT_CANON_V2_VERSION`.
//
// In the current context only the 2.1.0 identities at their page version 2
// resolve and bind; the A1 2.0.0 pair, a 1.x identity, a wrong page or page
// version, the other lineage, a missing, unknown or malformed reference are
// refused with a coded SkillContractError (codes as in ADR 0019 section 4).
//
// What this module does NOT do: it adds no contract, no rule and no method; a
// later current version (ETBZ-78..81) moves `CURRENT_CANON_V2_VERSION` in its
// own slice, with its own ADR and evidence.
// =============================================================================

import type { PlanContractBindings } from '../interpretation/meta-narrative-plan.js';
import {
  CANON_V2_1_CONTRACT_VERSION,
  assertCanonV2ContractBindings,
  assertCanonV2ContractSet,
  releasedCanonV2Contract,
  resolveCanonV2Contract,
} from './canon-v2-contracts.js';
import type { CanonV2Contract, CanonV2ContractSet, CanonV2LineVersion } from './canon-v2-contracts.js';
import type { ContractSource } from './contract-sources.js';

/** The released Canon v2 version new work binds: C1 85229569 and C5 85164034 at page version 2. */
export const CURRENT_CANON_V2_VERSION: CanonV2LineVersion = CANON_V2_1_CONTRACT_VERSION;

/** Accepts the Lexicon/Lens pair of the current Canon v2 context, or refuses it; returns the repository's frozen pair, never the input. */
export function assertCurrentCanonContractBindings(input: unknown): PlanContractBindings {
  return assertCanonV2ContractBindings(input, CURRENT_CANON_V2_VERSION);
}

/** The current Canon v2 contract a reference names; any other reference is refused. */
export function resolveCurrentCanonContract(ref: string): ContractSource {
  return resolveCanonV2Contract(ref, CURRENT_CANON_V2_VERSION);
}

/** The released current Canon v2 contract of a key: built, validated and checked against its frozen hash. */
export function releasedCurrentCanonContract(key: string): CanonV2Contract {
  return releasedCanonV2Contract(key, CURRENT_CANON_V2_VERSION);
}

/** The whole current Canon v2 line, held to itself. */
export function assertCurrentCanonContractSet(): CanonV2ContractSet {
  return assertCanonV2ContractSet(CURRENT_CANON_V2_VERSION);
}
