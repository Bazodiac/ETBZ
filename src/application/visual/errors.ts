// =============================================================================
// ETBZ-49 - the ways the visual contract refuses.
//
// Every refusal is a named code rather than a message, because the negative
// paths are the product here: "missing glyph", "whole-column tint" and "Wu Xing
// recomputation" are things a downstream renderer must be unable to do quietly.
// A code survives a stack trace, a log line and a test assertion unchanged.
// =============================================================================

export const VISUAL_CONTRACT_ERROR_CODES = [
  /** A codepoint outside the twenty-seven. InformationalCjkText is the other contract. */
  'DISPLAY_GLYPH_OUT_OF_CONTRACT',
  /** The glyph is in the set but its outline is empty or unusable. */
  'DISPLAY_GLYPH_MALFORMED',
  /** The outline leaves the common box, so it would be cut off at the asset edge. */
  'DISPLAY_GLYPH_CLIPPED',
  /** A phase colour asked to classify something larger than one fact-bearing region. */
  'PHASE_SCOPE_OUT_OF_CONTRACT',
  /** A supplied distribution that is not five plain counts. */
  'WU_XING_VECTOR_INVALID',
  /** An attempt to make the design side derive, weight or re-balance the distribution. */
  'WU_XING_RECOMPUTATION_REFUSED',
  /** Sheng/Ke is excluded from the MVP until a canonical deterministic mapping exists. */
  'SHENG_KE_NOT_SUPPORTED',
  /** A visual component id the design system does not define. */
  'UNKNOWN_VISUAL_TYPE',
  /** A slot id no page in the family declares. */
  'UNKNOWN_SLOT',
  /** Content was shortened to make it fit. */
  'SEMANTIC_TRUNCATION_REFUSED',
  /** Type was scaled below the locked scale to make it fit. */
  'SHRINK_TO_FIT_REFUSED',
  /** Content ran past its region instead of flowing to the next page. */
  'CLIPPING_REFUSED',
  /** Two regions occupy the same space. */
  'OVERLAP_REFUSED',
  /** Hashes, rule ids, fixture labels or slot chrome reached the customer surface. */
  'EVIDENCE_CHROME_IN_CUSTOMER_SURFACE',
  /** A chapter outside the 600-900 word / 2-3 page contract. */
  'LONG_FORM_BUDGET_OUT_OF_CONTRACT',
] as const;

export type VisualContractErrorCode = (typeof VISUAL_CONTRACT_ERROR_CODES)[number];

export class VisualContractError extends Error {
  readonly code: VisualContractErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(
    code: VisualContractErrorCode,
    message: string,
    detail: Readonly<Record<string, unknown>> = {},
  ) {
    super(`${code}: ${message}`);
    this.name = 'VisualContractError';
    this.code = code;
    this.detail = detail;
  }
}

export function isVisualContractError(
  error: unknown,
  code?: VisualContractErrorCode,
): error is VisualContractError {
  if (!(error instanceof VisualContractError)) return false;
  return code === undefined || error.code === code;
}
