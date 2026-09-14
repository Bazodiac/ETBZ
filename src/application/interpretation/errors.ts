/**
 * ETBZ-25 — the fail-closed error vocabulary of the narrative chain.
 *
 * Every code below names a REFUSAL, never a repair. Nothing in this slice
 * substitutes, defaults, normalizes or downgrades a fact: when the chain cannot
 * be proven intact, no InterpretationFeatureSet / ThemeGraph / NarrativeBrief /
 * ReportModel exists at all.
 */

/** Codes raised while deriving structure FROM the HoroscopeModel. */
export type InterpretationErrorCode =
  /** A `provisional_fields` entry ETBZ cannot map to a pillar. Uncertainty is
   *  never silently dropped, so an unmapped field fails the whole derivation. */
  | 'FEATURE_SET_PROVISIONAL_FIELD_UNMAPPED'
  /** A method declared `evaluated` carries no source fact — the scope
   *  statement would be a claim without evidence. */
  | 'FEATURE_SET_METHOD_WITHOUT_SOURCE_FACTS'
  /** Two occurrences of the same FuFirE Ten God carry different source labels. */
  | 'THEME_LABEL_CONTRADICTION';

export class InterpretationError extends Error {
  readonly code: InterpretationErrorCode;
  constructor(code: InterpretationErrorCode, message: string) {
    super(message);
    this.name = 'InterpretationError';
    this.code = code;
  }
}

/** Codes raised while validating PROVIDER output against the brief and model. */
export type ReportErrorCode =
  /** The provider output does not satisfy the structural schema. */
  | 'REPORT_PROVIDER_SCHEMA_INVALID'
  /** The brief handed to the provider does not match the HoroscopeModel it
   *  claims to describe (re-derived here, never trusted). */
  | 'REPORT_BRIEF_NOT_DERIVED_FROM_MODEL'
  /** The provider answered a different brief than the one being validated. */
  | 'REPORT_BRIEF_HASH_MISMATCH'
  /** A section names a theme the brief does not contain. */
  | 'REPORT_UNKNOWN_THEME'
  /** A section names a CANDIDATE ThemeGraph id. Candidate themes are structural
   *  nuance, not chapters: only a primary theme may become a report section. */
  | 'REPORT_CANDIDATE_THEME_NOT_NARRATABLE'
  /** The provider returned more sections than the compact-report ceiling. */
  | 'REPORT_TOO_MANY_SECTIONS'
  /** Two sections claim the same theme; the report would state it twice. */
  | 'REPORT_DUPLICATE_THEME_SECTION'
  /** A cited fact id does not exist in the brief. */
  | 'REPORT_UNKNOWN_FACT'
  /** A cited fact exists but does not belong to the section's theme. */
  | 'REPORT_FACT_NOT_IN_THEME'
  /** A cited fact value differs from the HoroscopeModel value: the provider
   *  changed a chart fact. */
  | 'REPORT_FACT_MUTATED'
  /** A section carries interpretation with no fact basis at all. */
  | 'REPORT_UNGROUNDED_INTERPRETATION'
  /** Prose names a chart symbol the section did not cite. */
  | 'REPORT_UNCITED_SYMBOL'
  /** Prose states a number the section did not cite: an invented quantity. */
  | 'REPORT_UNCITED_NUMBER'
  /** Prose invokes a BaZi method this slice does not evaluate. */
  | 'REPORT_OUT_OF_METHOD_SCOPE'
  /** A section cites a provisional fact without stating the uncertainty. */
  | 'REPORT_PROVISIONAL_WITHOUT_NOTE'
  /** The report is generic: too few sections, facts, or no synthesis. */
  | 'REPORT_INSUFFICIENT_SPECIFICITY'
  /** Two sections carry the same paragraph: boilerplate wearing two hats. */
  | 'REPORT_DUPLICATE_PROSE';

export class ReportError extends Error {
  readonly code: ReportErrorCode;
  constructor(code: ReportErrorCode, message: string) {
    super(message);
    this.name = 'ReportError';
    this.code = code;
  }
}

/**
 * ETBZ-25B — codes raised by the SEMANTIC Narrative QA.
 *
 * The structural codes above prove attachment; these prove the two things
 * `report-model.ts` explicitly states it cannot see (role and tone of
 * certainty), plus the three product-quality gates the Product Owner requires
 * before a reading may be offered for a sellability judgement.
 *
 * Every one of them is a REFUSAL of a Golden Reading candidate. None of them is
 * a reason to call a different provider: a semantic failure is a failure of the
 * answer, and shopping for a more convenient answer is exactly what this gate
 * exists to prevent.
 */
export type NarrativeQaErrorCode =
  /** A cited symbol is given a linguistic role its fact kind does not carry. */
  | 'QA_FACT_ROLE_MISMATCH'
  /** Prose asserts certainty in a section that rests on a provisional fact. */
  | 'QA_PROVISIONAL_CERTAINTY'
  /** The uncertainty note exists but states no uncertainty. */
  | 'QA_PROVISIONAL_NOTE_WITHOUT_UNCERTAINTY'
  /** A section's prose names none of the facts it cites: unbound generic text. */
  | 'QA_UNANCHORED_PROSE'
  /** The report as a whole names too few distinct chart terms in its prose. */
  | 'QA_INSUFFICIENT_CHART_DEPENDENCE'
  /** A canonical Barnum statement: true of nearly everyone, about no one. */
  | 'QA_BARNUM_PHRASE'
  /** No section relates several chart signals: lookup paragraphs only. */
  | 'QA_SYNTHESIS_INSUFFICIENT'
  /** A deterministic-fate, medical, legal or financial claim. */
  | 'QA_PROHIBITED_CLAIM';

export class NarrativeQaError extends Error {
  readonly code: 'NARRATIVE_QA_BLOCKED';
  /** Every blocking finding, not merely the first. */
  readonly findings: readonly NarrativeQaFindingLike[];
  constructor(findings: readonly NarrativeQaFindingLike[]) {
    super(
      `semantic Narrative QA blocked the candidate with ${String(findings.length)} finding(s): ${findings
        .map((finding) => finding.code)
        .join(', ')}`,
    );
    this.name = 'NarrativeQaError';
    this.code = 'NARRATIVE_QA_BLOCKED';
    this.findings = findings;
  }
}

/**
 * The shape `NarrativeQaError` needs from a finding.
 *
 * Declared here rather than imported from `semantic-qa.ts` so the error module
 * keeps depending on nothing: the QA module imports its codes from here, and a
 * cycle back would make the dependency direction a matter of module-loading
 * order rather than of design.
 */
export interface NarrativeQaFindingLike {
  readonly code: NarrativeQaErrorCode;
}

/** Codes raised while obtaining an answer from a REAL external provider. */
export type NarrativeProviderErrorCode =
  /** No approved route survived the no-charge eligibility check. */
  | 'PROVIDER_NO_ELIGIBLE_ROUTE'
  /** Every eligible route failed with a transient availability failure. */
  | 'PROVIDER_ALL_ROUTES_EXHAUSTED'
  /** A route failed terminally; failover is not authorised for this class. */
  | 'PROVIDER_TERMINAL_FAILURE'
  /** The provider's text is not the JSON object the prompt requires. */
  | 'PROVIDER_OUTPUT_NOT_JSON'
  /** The provider's JSON does not satisfy the narrative draft schema. */
  | 'PROVIDER_OUTPUT_SCHEMA_INVALID';

/**
 * WHY a transport attempt failed, as a closed, machine-readable set.
 *
 * The transport's own `LlmErrorCode` says which CLASS of failure happened, and
 * that is what failover decides on. It is too coarse to diagnose with: most
 * refusals share `LLM_CONTRACT_ERROR`, so a real run that ended "HTTP 200,
 * LLM_CONTRACT_ERROR" could not say whether the stream had no body, carried no
 * message content, reported an in-band error, or sent a corrupted frame. Those
 * need different responses, and only the transport knows which one it saw.
 *
 * CLOSED ON PURPOSE. A detail is one of these names and nothing else — never a
 * provider's error text, never an exception message. Free text is where raw
 * provider output and credentials leak into evidence, and a set that anyone
 * could extend with a string would stop being evidence of anything.
 *
 * Declared here, in the module that depends on nothing, so the adapter that
 * raises a detail and the evidence record that files it read the same list.
 */
export const PROVIDER_FAILURE_DETAIL_CODES = [
  /** The request did not receive response headers before the route deadline. */
  'REQUEST_TIMEOUT',
  /** The connection failed before any response existed. */
  'NETWORK_FAILURE',
  /** The route answered with a status other than 200. */
  'HTTP_STATUS_NOT_OK',
  /** A buffered 200 whose body is not JSON. */
  'BUFFERED_BODY_NOT_JSON',
  /** A buffered 200 whose JSON is not an object. */
  'BUFFERED_BODY_NOT_OBJECT',
  /** A buffered 200 with no `choices`. */
  'BUFFERED_NO_CHOICES',
  /** A buffered 200 whose first choice carries no message content. */
  'BUFFERED_EMPTY_MESSAGE',
  /** A streamed 200 with no response body at all. */
  'STREAM_NO_BODY',
  /** A complete `data:` line that claims a chunk and is not one. */
  'MALFORMED_SSE_CHUNK',
  /** The stream closed on an unterminated `data:` line. */
  'STREAM_CLOSED_MID_FRAME',
  /** The provider reported an error frame inside a 200 stream. */
  'IN_BAND_PROVIDER_ERROR',
  /** The route deadline fired while the body was still streaming. */
  'STREAM_TIMEOUT',
  /** The stream broke part-way for a reason other than the deadline. */
  'STREAM_INTERRUPTED',
  /** The stream ended normally and carried no message content. */
  'STREAM_NO_MESSAGE_CONTENT',
] as const;

export type ProviderFailureDetailCode = (typeof PROVIDER_FAILURE_DETAIL_CODES)[number];

/**
 * One attempt against one route, in the shape the evidence record files.
 *
 * Declared here for the same reason `NarrativeQaFindingLike` is: the error
 * module must keep depending on nothing. Importing the adapter's own type would
 * make `errors -> adapters` an edge the architecture guard forbids, and
 * importing the evidence module's type would close a cycle through
 * `semantic-qa`. TypeScript's structural typing makes both real shapes satisfy
 * this one.
 *
 * It is the FULL attempt, not a narrow echo. A refusal's ledger is the only
 * record that run will ever have, so the refusal evidence is built from exactly
 * these fields — and a field the error does not carry is a field that evidence
 * would have to invent.
 */
export interface NarrativeRouteAttemptLike {
  readonly order: number;
  readonly routeId: string;
  readonly model: string;
  readonly outcome: 'accepted' | 'transient_failure' | 'terminal_failure' | 'content_rejected';
  readonly errorCode: string | null;
  /** Which closed transport failure this was. `null` when none happened. */
  readonly failureDetailCode: ProviderFailureDetailCode | null;
  readonly httpStatus: number | null;
  readonly failoverAuthorized: boolean;
  readonly usage: {
    readonly promptTokens: number | null;
    readonly completionTokens: number | null;
    readonly totalTokens: number | null;
  } | null;
  readonly responseId: string | null;
  readonly responseHash: string | null;
  readonly finishReason: string | null;
  /**
   * What the provider reported this attempt cost. `null` when it reported
   * nothing, which is not a zero. A refusal carries these out of the run, which
   * is how the cap is checked on a path where no accepted answer exists.
   */
  readonly reportedCost: {
    readonly amount: number;
    readonly currency: string | null;
    readonly source: string;
  } | null;
}

/**
 * Which prompt a run was prepared to send, by identity rather than by text.
 *
 * Carried on a refusal so its evidence names the exact prompt and brief without
 * rebuilding either after the fact — and without carrying the prompt text,
 * which evidence has no use for.
 */
export interface NarrativePromptIdentity {
  readonly briefStructuralHash: string;
  readonly promptStructuralHash: string;
  readonly promptVersion: string;
  readonly policyVersion: string;
}

export class NarrativeProviderError extends Error {
  readonly code: NarrativeProviderErrorCode;
  /**
   * Every attempt made before the run ended, including the one that failed.
   *
   * Carried ON THE ERROR because the contract requires "attempt order and
   * eligible fallback reason" in the evidence of a run — and a run that ends in
   * a refusal is exactly the run whose attempt history a reviewer needs. An
   * error that discarded it would leave the failing case as the only one with
   * no evidence.
   */
  readonly attempts: readonly NarrativeRouteAttemptLike[];
  /**
   * The prompt the run was prepared to send. `null` only for a refusal raised
   * outside the provider adapter — the draft parser, for one — which has no
   * prompt of its own; the adapter re-raises those with the identity attached.
   */
  readonly prompt: NarrativePromptIdentity | null;
  constructor(
    code: NarrativeProviderErrorCode,
    message: string,
    attempts: readonly NarrativeRouteAttemptLike[] = [],
    prompt: NarrativePromptIdentity | null = null,
  ) {
    super(message);
    this.name = 'NarrativeProviderError';
    this.code = code;
    this.attempts = attempts;
    this.prompt = prompt;
  }
}

/**
 * ETBZ-30 — codes raised while validating an InterpretiveClaimSynthesisOutput
 * into an accepted `InterpretiveClaimGraph`.
 *
 * The division of labour is the same one `report-model.ts` already draws
 * against `narrative-provider.ts`: the port's schema proves SHAPE, and every
 * code below answers a SEMANTIC question about one specific brief — is this
 * fact a fact of THIS chart, is this theme approved for narration, does this
 * statement stay inside the evaluated method scope, did provisionality survive.
 *
 * Every one of them is a REFUSAL. Nothing here repairs, trims, re-labels,
 * downgrades or re-classifies a draft: a synthesis answer that fails any check
 * produces NO graph at all, and the run is blocked rather than narrowed.
 *
 * `CLAIM_UNGROUNDED_INTERPRETATION` deliberately covers two shapes, exactly as
 * `REPORT_UNGROUNDED_INTERPRETATION` does: a claim whose statement carries no
 * meaning, and a claim that names neither a fact nor an approved theme. Both
 * are the same product failure — an interpretation with nothing under it — and
 * splitting them would add a code no consumer could act on differently.
 *
 * There is NO code here for an unsupported relation type. The closed C1 schema
 * refuses one structurally before any of this runs, and a second guard for it
 * could never fail — which is not a guard.
 */
export type InterpretiveClaimErrorCode =
  /** The synthesis output does not satisfy the port's structural schema. */
  | 'CLAIM_SYNTHESIS_SCHEMA_INVALID'
  /** The supplied brief is not the brief this HoroscopeModel produces. */
  | 'CLAIM_BRIEF_NOT_DERIVED_FROM_MODEL'
  /** The provider answered a different brief than the one being validated. */
  | 'CLAIM_BRIEF_HASH_MISMATCH'
  /** A claim carries no meaning, or rests on neither a fact nor a theme. */
  | 'CLAIM_UNGROUNDED_INTERPRETATION'
  /** A referenced fact id is not an allowed fact of this chart. */
  | 'CLAIM_UNKNOWN_FACT'
  /** An echoed fact value differs from the value the chart carries. */
  | 'CLAIM_FACT_MUTATED'
  /** A themeRef names a CANDIDATE ThemeGraph id. Candidate themes are
   *  structural nuance and are never semantic authorization for a claim. */
  | 'CLAIM_CANDIDATE_THEME_NOT_APPROVED'
  /** A themeRef names neither an approved nor a candidate theme. */
  | 'CLAIM_UNKNOWN_THEME'
  /** A statement names a chart symbol its accepted grounding does not cover. */
  | 'CLAIM_UNCITED_SYMBOL'
  /** A statement states a number its accepted grounding does not cover. */
  | 'CLAIM_UNCITED_NUMBER'
  /** A statement invokes a BaZi method this slice does not evaluate. */
  | 'CLAIM_OUT_OF_METHOD_SCOPE'
  /** A claim grounded in provisional facts declares itself supported: the
   *  source's uncertainty would be laundered into a firmer epistemic class. */
  | 'CLAIM_PROVISIONAL_LINEAGE_LAUNDERED'
  /** Two drafts share one draftRef; a relation could not name either of them. */
  | 'CLAIM_DUPLICATE_DRAFT_REF'
  /** Two drafts carry the same accepted semantic identity. Accepting both
   *  would publish one claim twice and weight it as if it were two. */
  | 'CLAIM_DUPLICATE_CLAIM_CONTENT'
  /** A relation names a draftRef this answer does not contain. */
  | 'CLAIM_RELATION_UNKNOWN_ENDPOINT'
  /** A relation points a claim at itself. */
  | 'CLAIM_RELATION_SELF_REFERENCE';

export class InterpretiveClaimError extends Error {
  readonly code: InterpretiveClaimErrorCode;
  constructor(code: InterpretiveClaimErrorCode, message: string) {
    super(message);
    this.name = 'InterpretiveClaimError';
    this.code = code;
  }
}

/**
 * ETBZ-30 C3 — codes raised while validating a MetaNarrativePlan draft into an
 * accepted `MetaNarrativePlan`.
 *
 * The plan is ORCHESTRATION OVER ACCEPTED MEANING, and every code below exists
 * to keep it that. A plan may arrange, sequence, foreground and defer the
 * claims an `InterpretiveClaimGraph` already carries; it may not add one,
 * re-weight one, or say something the accepted grounding does not support.
 * There is therefore no code here for "a new claim" — a plan has no channel
 * through which one could enter, because every reference it makes is resolved
 * against the accepted graph and an unresolvable reference is refused by name.
 *
 * Every one of them is a REFUSAL. Nothing repairs, pads, reorders or downgrades
 * a draft: a plan that fails any check produces NO plan at all. In particular
 * `PLAN_MOTIF_COUNT_INVALID` is a truth gate and not an instruction to invent a
 * third motif — if the accepted graph cannot support three distinct grounded
 * motifs, the run is blocked rather than filled.
 *
 * WHAT IS DELIBERATELY ABSENT. There is no code for an unapproved narrative
 * operator, motif lifecycle state or thread role: all three vocabularies are
 * the closed C1 sets, the draft schema refuses a non-member structurally, and a
 * second semantic guard for it could never fail — which is not a guard. There
 * is likewise no salience, confidence, rank or weight code, because the draft
 * carries no such field for one to be raised about: `strictObject` refuses the
 * key outright, which is the stronger property.
 *
 * `PLAN_MOTIF_UNGROUNDED`, `PLAN_THREAD_UNGROUNDED` and
 * `PLAN_DUPLICATE_CHAPTER_REF` extend the contract's stated minimum rather than
 * renaming part of it. A motif whose statement carries no meaning, a thread
 * that is about neither a claim nor a motif, and two chapters sharing one local
 * handle are each a distinct product failure that the listed codes would
 * otherwise have to describe as something they are not.
 */
export type MetaNarrativePlanErrorCode =
  /** The plan draft does not satisfy the strict structural schema. */
  | 'PLAN_DRAFT_SCHEMA_INVALID'
  /** The supplied brief is not the brief this HoroscopeModel produces. */
  | 'PLAN_BRIEF_NOT_DERIVED_FROM_MODEL'
  /** The claim graph was accepted against a DIFFERENT brief than this one. */
  | 'PLAN_GRAPH_BRIEF_MISMATCH'
  /** The claim graph's published hash is not the hash of its own content. */
  | 'PLAN_GRAPH_HASH_INVALID'
  /** The draft names a different brief than the one being validated. */
  | 'PLAN_BRIEF_HASH_MISMATCH'
  /** The draft names a different claim graph than the one being validated. */
  | 'PLAN_GRAPH_HASH_MISMATCH'
  /** A reference names a claim the accepted graph does not contain. */
  | 'PLAN_UNKNOWN_CLAIM_REF'
  /** The report thesis carries no meaning, or rests on fewer than two claims. */
  | 'PLAN_THESIS_UNGROUNDED'
  /** The thesis names a chart symbol its accepted grounding does not cover. */
  | 'PLAN_THESIS_UNCITED_SYMBOL'
  /** The thesis states a number its accepted grounding does not cover. */
  | 'PLAN_THESIS_UNCITED_NUMBER'
  /** The thesis invokes a BaZi method this slice does not evaluate. */
  | 'PLAN_THESIS_OUT_OF_METHOD_SCOPE'
  /** Fewer than three or more than five primary motifs. A truth gate: the
   *  accepted graph either supports three distinct grounded motifs or it does
   *  not, and padding one is exactly what this refusal prevents. */
  | 'PLAN_MOTIF_COUNT_INVALID'
  /** A motif carries no meaning, or rests on no accepted claim at all. */
  | 'PLAN_MOTIF_UNGROUNDED'
  /** A motif's anchor is absent from its own claimRefs, or two motifs claim
   *  the same anchor: one claim cannot anchor two distinct motifs. */
  | 'PLAN_MOTIF_ANCHOR_INVALID'
  /** Two motifs share one local handle, or carry the same accepted identity. */
  | 'PLAN_DUPLICATE_MOTIF'
  /** A motif statement names a chart symbol its grounding does not cover. */
  | 'PLAN_MOTIF_UNCITED_SYMBOL'
  /** A motif statement states a number its grounding does not cover. */
  | 'PLAN_MOTIF_UNCITED_NUMBER'
  /** A motif statement invokes a method this slice does not evaluate. */
  | 'PLAN_MOTIF_OUT_OF_METHOD_SCOPE'
  /** A reference names a motif this plan does not declare as primary. */
  | 'PLAN_UNKNOWN_MOTIF_REF'
  /** A thread is about neither an accepted claim nor an accepted motif. */
  | 'PLAN_THREAD_UNGROUNDED'
  /** Two threads share one local handle, or carry the same accepted identity. */
  | 'PLAN_DUPLICATE_THREAD'
  /** A reference names a thread this plan does not declare. */
  | 'PLAN_UNKNOWN_THREAD_REF'
  /** A thread's resolution does not resolve: it closes in a chapter that does
   *  not exist, does not come later, or does not itself close it — or it is
   *  declared explicitly left open while a chapter closes it anyway. */
  | 'PLAN_THREAD_RESOLUTION_INVALID'
  /** Two chapters share one local handle; a resolution could name neither. */
  | 'PLAN_DUPLICATE_CHAPTER_REF'
  /** A planned chapter references no accepted claim. */
  | 'PLAN_CHAPTER_UNGROUNDED'
  /** An accepted claim of the graph appears in no chapter: accepted meaning
   *  would be silently discarded between the graph and the plan. */
  | 'PLAN_CLAIM_COVERAGE_INCOMPLETE'
  /** No chapter integrates, or a chapter declares INTEGRATE without the
   *  substance of one (two distinct claims and two distinct motifs). */
  | 'PLAN_NO_INTEGRATION'
  /** A tension the claim graph states is addressed by no chapter. */
  | 'PLAN_TENSION_UNADDRESSED'
  /** A planned motif transition targets UNSEEN, repeats the current state, or
   *  moves a motif backwards through the approved lifecycle. */
  | 'PLAN_MOTIF_TRANSITION_INVALID'
  /** A primary motif is never advanced, or ends neither INTEGRATED nor CLOSED
   *  while no accepted thread declares it explicitly left open. */
  | 'PLAN_MOTIF_SILENTLY_DROPPED';

export class MetaNarrativePlanError extends Error {
  readonly code: MetaNarrativePlanErrorCode;
  constructor(code: MetaNarrativePlanErrorCode, message: string) {
    super(message);
    this.name = 'MetaNarrativePlanError';
    this.code = code;
  }
}
