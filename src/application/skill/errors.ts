// =============================================================================
// ETBZ-51 - the ways the Skill Contract Bundle refuses.
//
// The bundle exists so that a Skill runtime cannot interpret from model memory
// or from a stale copy of a contract. Every refusal is therefore a named code:
// "unknown contract", "wrong page version", "draft override" are the product
// here, and a code survives a log line, a stack trace and a test unchanged.
// =============================================================================

export const SKILL_CONTRACT_ERROR_CODES = [
  /** A contract the bundle must carry (profile, lens, lexicon, long-form, anti-boilerplate) is absent. */
  'REQUIRED_CONTRACT_MISSING',
  /** A released identity or page reference no released contract carries. */
  'UNKNOWN_CONTRACT_IDENTITY',
  /** The identity is released, but the page id or page version is not the released one. */
  'CONTRACT_SOURCE_MISMATCH',
  /** A run's evidence binds another bundle or another version of a bound contract. */
  'CONTRACT_DRIFT',
  /** A contract entry whose status is not CURRENT: a draft authorises nothing. */
  'DRAFT_CONTRACT_REFUSED',
  /** A portable copy differs from what the repository binds; a copy is a carrier, never an authority. */
  'CONTRACT_OVERRIDE_REFUSED',
  /** Two contracts claim one domain, a contract sits in no tier or two tiers, or a domain has no owner. */
  'PRECEDENCE_CONFLICT',
  /** A bundle core, a portable copy or a run-evidence record that is not the declared shape (path and code only, never the value). */
  'BUNDLE_SCHEMA_INVALID',
  /** The bundle content is not the hash frozen for its version. */
  'BUNDLE_NOT_RELEASED',
  /** The bundle disagrees with a binding the repository already carries (plan bindings, version markers, registry). */
  'BUNDLE_BINDING_MISMATCH',
  /** Contract data names a method the released Method Profile does not approve. */
  'METHOD_REF_OUT_OF_PROFILE',
  /** Contract data tries to carry facts, methods, operations or mappings - symbolic authority it may not hold. */
  'SYMBOLIC_AUTHORITY_REFUSED',
] as const;

export type SkillContractErrorCode = (typeof SKILL_CONTRACT_ERROR_CODES)[number];

export class SkillContractError extends Error {
  readonly code: SkillContractErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(
    code: SkillContractErrorCode,
    message: string,
    detail: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${code}: ${message}`);
    this.name = 'SkillContractError';
    this.code = code;
    this.detail = detail;
  }
}

export function isSkillContractError(
  error: unknown,
  code?: SkillContractErrorCode,
): error is SkillContractError {
  if (!(error instanceof SkillContractError)) return false;
  return code === undefined || error.code === code;
}
