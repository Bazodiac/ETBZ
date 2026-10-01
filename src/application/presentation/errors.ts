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
  /** The content payload is not the declared shape, the display name is padded or empty, or the template no longer hashes to its released identity. */
  'PRESENTATION_INPUT_INVALID',
  /** The birth time is unknown or provisional in any of the chart's three answers; the template defines no unknown-time rendering, so nothing is guessed. */
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
  /** The long-form layout broke one of its own geometric rules, or reached a state in which no layout exists (a subhead taller than a fresh continuation column). */
  'PRESENTATION_LAYOUT_FINDING',
  /** A customer string carries wording the Lexicon prohibits or a method the profile defers. */
  'PRESENTATION_CUSTOMER_TEXT_REFUSED',
  /** ETBZ-56: a displayed Earthly Branch has no animal label in the output language, or the label table is not its released identity. */
  'PRESENTATION_BRANCH_ANIMAL_UNMAPPED',
  /** ETBZ-56: the Skill reading is bound to a bundle, Skill or contract identity this projection does not present (a candidate, a superseded version, another Lexicon). */
  'PRESENTATION_SKILL_IDENTITY_REFUSED',
  /** ETBZ-56: the accepted reading, its input package and the chart do not belong together (a hash, a fact value, the subject or the slot vocabulary differs). */
  'PRESENTATION_SKILL_BINDING_MISMATCH',
  /** ETBZ-56: a visualization spec binds a slot no page draws, or cites a fact kind the slot-to-fact vocabulary does not know. */
  'PRESENTATION_VISUAL_SPEC_UNBOUND',
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
