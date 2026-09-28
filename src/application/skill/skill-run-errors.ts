// =============================================================================
// ETBZ-52 - the ways a Skill run refuses: the input package it is handed and
// the reading it hands back.
//
// A Skill is an execution host, never a second astrology engine. The package
// it receives may carry only validated contract input, and the reading it
// returns may carry only what the accepted claim graph and plan authorise -
// so every way of smuggling something past that boundary is a named code.
// =============================================================================

export const SKILL_RUN_ERROR_CODES = [
  // --- the input package ------------------------------------------------------
  /** The graph, plan, input and bundle handed in do not describe one chart under one released contract set. */
  'PACKAGE_BINDING_MISMATCH',
  /** A slot id list, subject or fact set that is not the declared shape. */
  'PACKAGE_SCHEMA_INVALID',
  // --- the reading: shape and binding -------------------------------------------
  /** The reading is not the declared shape (path and code only, never the value). */
  'READING_SCHEMA_INVALID',
  /** The reading names another Skill identity. */
  'READING_SKILL_MISMATCH',
  /** The reading names another bundle identity or bundle hash than the package it was produced from. */
  'READING_BUNDLE_MISMATCH',
  /** The reading names another input package, claim graph or plan than the one it was produced from. */
  'READING_PACKAGE_MISMATCH',
  // --- the reading: structure --------------------------------------------------------
  /** The chapters are not exactly the plan's chapter sequence: same ids, same order, same operation. */
  'READING_CHAPTER_PLAN_MISMATCH',
  /** A claim reference the accepted graph does not carry. */
  'READING_CLAIM_UNKNOWN',
  /** A claim the plan does not place in this chapter, or does not plan at all. */
  'READING_CLAIM_NOT_PLANNED_HERE',
  /** A claim the plan places in this chapter that no paragraph renders. */
  'READING_CHAPTER_CLAIM_UNRENDERED',
  /** A fact reference the validated chart does not carry. */
  'READING_FACT_UNKNOWN',
  /** A fact the input excludes from interpretation (assumed-time-derived). */
  'READING_FACT_EXCLUDED',
  /** An interpretive paragraph cites a fact none of its claims is grounded in. */
  'READING_FACT_NOT_GROUNDED',
  /** A paragraph without the references its kind requires. */
  'READING_PARAGRAPH_UNGROUNDED',
  /** A posture that does not fit the paragraph kind, or a FACT paragraph that cites a claim. */
  'READING_POSTURE_INVALID',
  /** A paragraph sounds more certain than the claims or facts it cites. */
  'READING_PROVISIONALITY_LAUNDERED',
  // --- the reading: text -------------------------------------------------------------
  /** A chart symbol named in prose that no cited fact of that paragraph carries. */
  'READING_UNCITED_SYMBOL',
  /** A number in prose that no cited fact of that paragraph carries. */
  'READING_UNCITED_NUMERAL',
  /** Wording the Lexicon prohibits (determinism, unsupported strength, clinical, gender, mystification, advice). */
  'READING_PROHIBITED_WORDING',
  /** Vocabulary of a method the released profile defers or forbids. */
  'READING_UNSUPPORTED_METHOD_LANGUAGE',
  /** Hashes, ids, states or fixture labels on the customer surface. */
  'READING_EVIDENCE_CHROME',
  /** A chapter outside the long-form word budget. */
  'READING_CHAPTER_LENGTH_OUT_OF_CONTRACT',
  // --- the reading: narrative discipline ------------------------------------------------
  /** An interpretive chapter that declares no semantic delta. */
  'READING_NO_SEMANTIC_DELTA',
  /** A declared delta over a claim the chapter does not render. */
  'READING_DELTA_CLAIM_NOT_RENDERED',
  /** NEW_CLAIM declared for a claim an earlier chapter already rendered. */
  'READING_NEW_CLAIM_ALREADY_RENDERED',
  /** A claim rendered for the first time without a declared NEW_CLAIM delta. */
  'READING_NEW_CLAIM_UNDECLARED',
  /** A claim rendered again without a declared callback delta. */
  'READING_CALLBACK_WITHOUT_DELTA',
  /** A callback declared for a claim no earlier chapter rendered, or this chapter does not render. */
  'READING_CALLBACK_NOT_PRIOR',
  /** A thesis claim no chapter renders. */
  'READING_THESIS_UNRENDERED',
  /** The method note does not carry the source warnings verbatim. */
  'READING_WARNINGS_NOT_VERBATIM',
  // --- the reading: visual bindings ----------------------------------------------------
  /** A slot id the presentation contract does not declare. */
  'READING_VISUAL_SLOT_UNKNOWN',
  /** A visualization spec referencing an unknown or excluded fact, or an unplanned claim. */
  'READING_VISUAL_REF_INVALID',
  /** Two specs with one id. */
  'READING_VISUAL_SPEC_DUPLICATE',
] as const;

export type SkillRunErrorCode = (typeof SKILL_RUN_ERROR_CODES)[number];

export class SkillRunError extends Error {
  readonly code: SkillRunErrorCode;
  readonly detail: Readonly<Record<string, unknown>>;

  constructor(code: SkillRunErrorCode, message: string, detail: Readonly<Record<string, unknown>> = {}) {
    super(`${code}: ${message}`);
    this.name = 'SkillRunError';
    this.code = code;
    this.detail = detail;
  }
}

export function isSkillRunError(error: unknown, code?: SkillRunErrorCode): error is SkillRunError {
  if (!(error instanceof SkillRunError)) return false;
  return code === undefined || error.code === code;
}
