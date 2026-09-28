// =============================================================================
// ETBZ-55 - the refusals of the PresentationProjection.
//
// A projection that cannot show a chart value exactly as the validated chart
// states it does not show something else instead: it refuses, names the code,
// and no partial projection exists. Refusals the ETBZ-49 visual contract
// already owns (a glyph outside the 27, a derived Wu Xing quantity, a long-form
// chapter outside its budget, evidence chrome) surface unchanged as
// `VisualContractError`; the codes below are the ones only a projection can see.
// =============================================================================

export const PRESENTATION_ERROR_CODES = [
  /** The content payload or the projection options are not the declared shape. */
  'PRESENTATION_INPUT_INVALID',
  /** The birth time is unknown; the template defines no unknown-time rendering, so nothing is guessed. */
  'PRESENTATION_UNKNOWN_TIME_UNSUPPORTED',
  /** A value the template must show is absent from the validated chart. */
  'PRESENTATION_FACT_MISSING',
  /** Two sources of the same chart value disagree (e.g. the chart's phase and the glyph contract's phase). */
  'PRESENTATION_FACT_MISMATCH',
  /** A supplied Ten-God relation is bound to no Lexicon entry, or to more than one. */
  'PRESENTATION_TEN_GOD_UNBOUND',
  /** A character is neither in the pinned Inter tables nor a CJK ideograph; its width is unknown. */
  'PRESENTATION_TEXT_UNMEASURABLE',
  /** One word is wider than the measure it must be set in. */
  'PRESENTATION_WORD_EXCEEDS_MEASURE',
  /** The long-form layout broke one of its own geometric rules. */
  'PRESENTATION_LAYOUT_FINDING',
  /** A customer string carries wording the Lexicon prohibits or a method the profile defers. */
  'PRESENTATION_CUSTOMER_TEXT_REFUSED',
] as const;

export type PresentationErrorCode = (typeof PRESENTATION_ERROR_CODES)[number];

export class PresentationError extends Error {
  readonly code: PresentationErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(code: PresentationErrorCode, message: string, detail: Readonly<Record<string, unknown>> = {}) {
    super(`${code}: ${message}`);
    this.name = 'PresentationError';
    this.code = code;
    this.detail = detail;
  }
}

export function isPresentationError(error: unknown, code?: PresentationErrorCode): error is PresentationError {
  if (!(error instanceof PresentationError)) return false;
  return code === undefined || error.code === code;
}
