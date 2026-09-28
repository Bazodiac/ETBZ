// =============================================================================
// ETBZ-51 - the Cross-Reading Individuality / Anti-Boilerplate Contract as values.
//
// `ETBZ — Cross-Reading Individuality / Anti-Boilerplate Contract v1`
// (`cross-reading-individuality-contract@1.0.0`, Confluence 72056833, page
// version 1, released under PO delegation 2026-09-28) owns how ETBZ tells a
// chart-bound reading from a templated one across customers. This module
// carries its closed vocabularies: the individuality law, the checks, the
// reason codes with their class, and the Golden-Run minimum. It executes no
// check - the checks compare accepted artefacts a Skill run produces, and that
// run is ETBZ-52 / ETBZ-54. Every reason code is qualitative: none carries a
// number, and the bundle refuses any threshold.
// =============================================================================

export interface IndividualitySection {
  readonly contract: 'ANTI_BOILERPLATE';
  readonly section: string;
}
const contract = (section: string): IndividualitySection => ({ contract: 'ANTI_BOILERPLATE', section });

/** Section 4: the individuality law. */
export const INDIVIDUALITY_RULES = [
  { ruleId: 'IND-1', title: 'Chart dependence' },
  { ruleId: 'IND-2', title: 'One shared primitive proves nothing' },
  { ruleId: 'IND-3', title: 'No stock personality blocks' },
  { ruleId: 'IND-4', title: 'Legitimate sharing is not a defect' },
  { ruleId: 'IND-5', title: 'Wording variance is not individuality' },
  { ruleId: 'IND-6', title: 'Within-reading rules stay in force' },
  { ruleId: 'IND-7', title: 'Qualitative, not numeric' },
  { ruleId: 'IND-8', title: 'Provisionality is preserved across variants' },
] as const;
export const INDIVIDUALITY_RULES_SOURCE = contract('4');

/** Section 5: three Lens dimensions plus INTERPRETIVE_DEPTH, which subdivides two of them and adds no axis. */
export const INDIVIDUALITY_DIMENSIONS = ['GROUNDING', 'SPECIFICITY', 'INTERPRETIVE_DEPTH', 'NARRATIVE_QUALITY'] as const;
export const INDIVIDUALITY_DIMENSIONS_SOURCE = contract('5');

export const CHECK_KINDS = ['GRAPH', 'PROSE', 'GRAPH_AND_PROSE'] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];

export interface IndividualityCheck {
  readonly checkId: string;
  readonly name: string;
  /** GRAPH steps are deterministic re-validations or comparisons; PROSE steps end in a qualitative judgement. */
  readonly kind: CheckKind;
}

/** Section 6: the operational checks. */
export const INDIVIDUALITY_CHECKS: readonly IndividualityCheck[] = [
  { checkId: '6.1', name: 'Near-neighbour check', kind: 'GRAPH_AND_PROSE' },
  { checkId: '6.2', name: 'Swap check (foil re-validation)', kind: 'GRAPH' },
  { checkId: '6.3', name: 'Fact-mutation check (counterfactual)', kind: 'GRAPH' },
  { checkId: '6.4', name: 'Fact-removal check (evidence removal)', kind: 'GRAPH' },
  { checkId: '6.5', name: 'Anchor ablation (Barnum residue)', kind: 'PROSE' },
  { checkId: '6.6', name: 'Shared-primitive false-positive block', kind: 'GRAPH' },
  { checkId: '6.7', name: 'Cross-reading reuse scan', kind: 'PROSE' },
];
export const INDIVIDUALITY_CHECKS_SOURCE = contract('6');

export const REASON_CODE_CLASSES = ['BLOCKING', 'ADVISORY', 'INFORMATIONAL'] as const;
export type ReasonCodeClass = (typeof REASON_CODE_CLASSES)[number];

export interface IndividualityReasonCode {
  readonly code: string;
  readonly checks: readonly string[];
  readonly class: ReasonCodeClass;
}

/** Section 7: closed vocabulary; each code names WHY a reading is not individual, none carries a number. */
export const INDIVIDUALITY_REASON_CODES: readonly IndividualityReasonCode[] = [
  { code: 'READING_VALIDATES_AGAINST_FOIL', checks: ['6.2'], class: 'BLOCKING' },
  { code: 'DEPENDENT_CLAIM_UNCHANGED_UNDER_MUTATION', checks: ['6.1', '6.3'], class: 'BLOCKING' },
  { code: 'THESIS_UNCHANGED_UNDER_CENTRAL_MUTATION', checks: ['6.3'], class: 'BLOCKING' },
  { code: 'EVIDENCE_REMOVED_CLAIM_SURVIVED', checks: ['6.4'], class: 'BLOCKING' },
  { code: 'MODEL_MEMORY_RESCUE', checks: ['6.4'], class: 'BLOCKING' },
  { code: 'SHARED_PRIMITIVE_THESIS', checks: ['6.1', '6.6'], class: 'BLOCKING' },
  { code: 'SHARED_PRIMITIVE_MOTIF', checks: ['6.1', '6.6'], class: 'BLOCKING' },
  { code: 'STOCK_PARAGRAPH_REUSE', checks: ['6.7'], class: 'BLOCKING' },
  { code: 'NEAR_NEIGHBOUR_INDISTINGUISHABLE', checks: ['6.1'], class: 'ADVISORY' },
  { code: 'BARNUM_RESIDUE', checks: ['6.5'], class: 'ADVISORY' },
  { code: 'FIXED_METAPHOR_REUSE', checks: ['6.7'], class: 'ADVISORY' },
  { code: 'TEMPLATE_SENTENCE_REUSE', checks: ['6.7'], class: 'ADVISORY' },
  { code: 'STYLE_VARIANCE_ONLY', checks: ['6.1'], class: 'ADVISORY' },
  { code: 'UNRELATED_CLAIM_DRIFTED', checks: ['6.3'], class: 'ADVISORY' },
  { code: 'LEGITIMATE_SHARED_CLAIM', checks: ['6.1', '6.6'], class: 'INFORMATIONAL' },
];
export const INDIVIDUALITY_REASON_CODES_SOURCE = contract('7');

export interface GoldenRunMinimumItem {
  readonly itemId: string;
  readonly checkIds: readonly string[];
  readonly requirement: string;
}

/** Section 8: what a Golden Product Proof must record to be bound to this contract. */
export const GOLDEN_RUN_MINIMUM: readonly GoldenRunMinimumItem[] = [
  { itemId: '8.1', checkIds: ['6.1'], requirement: 'one near-neighbour case with Δ named, one distant foil named, the claim-graph and plan differences by claim id and plan element, and the blind-attribution outcome against both foils' },
  { itemId: '8.2', checkIds: ['6.3', '6.4'], requirement: 'one fact-mutation case and one fact-removal case, each with the cone listed before the run and the in-cone / out-of-cone outcome after it, including the provisionality direction' },
  { itemId: '8.3', checkIds: ['6.5'], requirement: 'one anchor-ablation reading of at least one central-motif passage, quoting the residue' },
  { itemId: '8.4', checkIds: ['6.2'], requirement: 'the swap re-validation of the Golden Reading against the near-neighbour chart and the distant foil' },
  { itemId: '8.5', checkIds: ['6.7'], requirement: 'the cross-reading reuse scan over the Golden Reading and the near-neighbour reading' },
  { itemId: '8.6', checkIds: [], requirement: 'every reason code raised, with the passages or claim ids it cites, and - for BLOCKING codes - the proposed smallest repair' },
];
export const GOLDEN_RUN_MINIMUM_SOURCE = contract('8');

/** Section 11: stop, do not weaken. */
export const INDIVIDUALITY_STOP_CONDITIONS = [
  'a check could only pass by enabling a deferred or forbidden method, a new mapping or a new fact kind',
  'a numeric personality, originality, validity or specificity score would have to be invented to state a result',
  'a check would require editing an accepted reading, a claim graph or a plan instead of producing a variant through the validated path',
  'a BLOCKING code is raised in a Golden Run - the run ends and records; no reroll, no second model, no prompt tuning against the Golden input',
  'this page and a higher-authority contract are found to conflict - reconcile first',
] as const;
export const INDIVIDUALITY_STOP_SOURCE = contract('11');

/** Everything the individuality contract assembles into the bundle. */
export const INDIVIDUALITY_CONTRACT = {
  rules: INDIVIDUALITY_RULES,
  rulesSource: INDIVIDUALITY_RULES_SOURCE,
  dimensions: INDIVIDUALITY_DIMENSIONS,
  dimensionsSource: INDIVIDUALITY_DIMENSIONS_SOURCE,
  checks: INDIVIDUALITY_CHECKS,
  checksSource: INDIVIDUALITY_CHECKS_SOURCE,
  reasonCodes: INDIVIDUALITY_REASON_CODES,
  reasonCodesSource: INDIVIDUALITY_REASON_CODES_SOURCE,
  goldenRunMinimum: GOLDEN_RUN_MINIMUM,
  goldenRunMinimumSource: GOLDEN_RUN_MINIMUM_SOURCE,
  stopConditions: INDIVIDUALITY_STOP_CONDITIONS,
  stopSource: INDIVIDUALITY_STOP_SOURCE,
} as const;
export type IndividualityContract = typeof INDIVIDUALITY_CONTRACT;
