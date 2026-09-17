/**
 * ETBZ-34 / ETBZ-30 prerequisite — BaZi Method Registry v1.0.0.
 *
 * The registry is the machine-readable half of `ETBZ — BaZi Method Profile v1`
 * (Confluence ETBZ). It answers exactly one question and refuses to answer any
 * other: WHICH interpretive methods may contribute to a customer reading, FROM
 * WHICH addressable fact kinds.
 *
 * It is not a rules engine and it computes no astrology. It contains no lookup
 * table of stems, branches, elements or interactions. A method that would need
 * such a table (branch clashes, Sheng/Ke between two non-day-master elements,
 * rooting, strength …) is present here ONLY as a deferred or forbidden entry,
 * so that "the model happens to know this" can never become an approval.
 *
 * Product decisions locked for MVP v1 (Product Owner, 2026-09-17):
 *   PD-3  recurrence of grounded occurrences may be described; no salience score
 *   PD-4  positional context may qualify a reading; no literal-kin claims
 *   PD-5  central thesis / primary motif: >=2 fact kinds, >=2 method contributions
 *   PD-6  InterpretiveClaim.methodRefs, fail-closed (see interpretive-claim.ts)
 *   PD-7  FuFirE Ten-God labels are evidence; customer wording is the Lexicon's
 *   PD-9  day boundary = midnight, sent explicitly
 *   PD-10 assumed-time-derived hour facts are excluded when birth_time_known=false
 *
 * Still NOT enabled (no decision exists): PD-2 state B — Sheng/Ke relations
 * between two non-day-master elements. Only relations FuFirE itself supplies
 * (`ten_god.element_relation`) may be read.
 */
import { structuralHash } from '../../domain/structural-hash.js';
import type { ChartFact, ChartFactKind, InterpretationFeatureSet } from './feature-set.js';
import { EVALUATED_METHODS, NOT_EVALUATED_METHODS } from './method-scope.js';

export const METHOD_PROFILE_ID = 'bazi-method-profile' as const;
export const METHOD_PROFILE_VERSION = '1.0.0' as const;
/** The string a claim graph binds to. */
export const METHOD_PROFILE_REF = `${METHOD_PROFILE_ID}@${METHOD_PROFILE_VERSION}` as const;

export const METHOD_STATUSES = [
  'APPROVED_MVP_V1',
  'APPROVED_CONDITIONAL',
  'DEFERRED_NEEDS_DETERMINISTIC_SUPPORT',
  'DEFERRED_PRODUCT_DECISION',
  'FORBIDDEN_MVP_V1',
] as const;
export type MethodStatus = (typeof METHOD_STATUSES)[number];

export const GAP_CODES = [
  'MISSING_FACT',
  'MISSING_DETERMINISTIC_RULE',
  'SCHOOL_POLICY_UNRESOLVED',
  'SOURCE_CONFLICT',
  'PRODUCT_DECISION_NEEDED',
  'IMPLEMENTATION_NOT_PRESENT',
  'FUFIRE_CAPABILITY_MISSING',
  'OUT_OF_PRODUCT_SCOPE',
] as const;
export type GapCode = (typeof GAP_CODES)[number];

export type MethodNecessity = 'CORE' | 'POLICY' | 'SUPPORTING';

/**
 * Which facts may stand as evidence for a method.
 *  - `kinds`: a closed list of fact kinds;
 *  - `ANY_FACT_WITH_PILLAR`: the positional MODIFIER — any fact that sits in a pillar;
 *  - `ANY_TWO_FACTS`: identity relations between accepted facts (recurrence);
 *  - `NONE`: policy methods, which never ground a claim.
 */
export type MethodEvidence =
  | Readonly<{ mode: 'kinds'; kinds: readonly ChartFactKind[] }>
  | Readonly<{ mode: 'ANY_FACT_WITH_PILLAR' }>
  | Readonly<{ mode: 'ANY_TWO_FACTS' }>
  | Readonly<{ mode: 'NONE' }>;

export interface MethodDefinition {
  readonly methodId: string;
  readonly methodName: string;
  readonly status: MethodStatus;
  /** Set for approved methods only. */
  readonly necessity: MethodNecessity | null;
  /** May this method appear in `InterpretiveClaim.methodRefs`? */
  readonly claimBearing: boolean;
  /** A modifier never stands alone in a claim (I5). */
  readonly modifier: boolean;
  readonly evidence: MethodEvidence;
  /** Stable operation ids. Empty for every non-approved method. */
  readonly operations: readonly string[];
  /** Why a non-approved method is not available. Empty for approved methods. */
  readonly gapCodes: readonly GapCode[];
  /** The id the ETBZ-25 method-scope module uses for the same method, if it differs. */
  readonly legacyScopeId?: string;
}

export interface MethodRegistry {
  readonly profileId: typeof METHOD_PROFILE_ID;
  readonly profileVersion: string;
  readonly methods: readonly MethodDefinition[];
  readonly enabledSets: Readonly<{
    minimumSellableCore: readonly string[];
    policyMethods: readonly string[];
    optionalSupportingMethods: readonly string[];
  }>;
}

const kinds = (...list: ChartFactKind[]): MethodEvidence => ({ mode: 'kinds', kinds: list });

function approved(
  methodId: string,
  methodName: string,
  status: 'APPROVED_MVP_V1' | 'APPROVED_CONDITIONAL',
  necessity: MethodNecessity,
  evidence: MethodEvidence,
  operations: readonly string[],
  flags: Readonly<{ claimBearing?: boolean; modifier?: boolean }> = {},
): MethodDefinition {
  return {
    methodId,
    methodName,
    status,
    necessity,
    claimBearing: flags.claimBearing ?? true,
    modifier: flags.modifier ?? false,
    evidence,
    operations,
    gapCodes: [],
  };
}

function unavailable(
  methodId: string,
  methodName: string,
  status: Exclude<MethodStatus, 'APPROVED_MVP_V1' | 'APPROVED_CONDITIONAL'>,
  gapCodes: readonly GapCode[],
  legacyScopeId?: string,
): MethodDefinition {
  return {
    methodId,
    methodName,
    status,
    necessity: null,
    claimBearing: false,
    modifier: false,
    evidence: { mode: 'NONE' },
    operations: [],
    gapCodes,
    ...(legacyScopeId === undefined ? {} : { legacyScopeId }),
  };
}

const NEEDS = 'DEFERRED_NEEDS_DETERMINISTIC_SUPPORT' as const;

const METHODS: readonly MethodDefinition[] = [
  // ---- MINIMUM_SELLABLE_CORE -------------------------------------------------
  approved(
    'four_pillars',
    'Four Pillars / pillar structure',
    'APPROVED_MVP_V1',
    'CORE',
    kinds(
      'pillar_stem', 'pillar_stem_hanzi', 'pillar_stem_pinyin',
      'pillar_branch', 'pillar_branch_hanzi', 'pillar_branch_pinyin',
      'pillar_stem_element', 'pillar_branch_tier',
    ),
    ['PRESENT', 'ADDRESS'],
    // The carrier of every other method; it never grounds a claim by itself.
    { claimBearing: false },
  ),
  approved(
    'day_master', 'Day Master', 'APPROVED_MVP_V1', 'CORE',
    kinds('day_master', 'day_master_hanzi', 'day_master_pinyin', 'day_master_element', 'day_master_polarity'),
    ['ORIENT', 'ANCHOR', 'PAIR_WITH_OTHER_METHODS'],
  ),
  approved(
    'ten_gods', 'Ten Gods', 'APPROVED_MVP_V1', 'CORE',
    kinds('ten_god', 'hidden_stem_ten_god', 'ten_god_element_relation', 'hidden_stem_ten_god_element_relation'),
    ['INTERPRET_ROLE', 'GROUP_RELATION_FAMILIES', 'DISTINGUISH_VARIANT', 'SYNTHESIZE_OCCURRENCES', 'OBSERVE_ABSENCE'],
  ),
  approved(
    'hidden_stems', 'Hidden Stems', 'APPROVED_MVP_V1', 'CORE',
    kinds('hidden_stem', 'hidden_stem_element', 'hidden_stem_qi_role', 'hidden_stem_ten_god'),
    ['DESCRIBE_LAYERS', 'CONTRAST_SURFACE_INTERIOR', 'OBSERVE_IDENTITY'],
  ),
  approved(
    'positional_context', 'Positional / contextual interpretation', 'APPROVED_CONDITIONAL', 'CORE',
    { mode: 'ANY_FACT_WITH_PILLAR' },
    ['CONTEXTUALIZE_BY_POSITION', 'CONTRAST_ACROSS_POSITIONS', 'DISTINGUISH_OUTWARD_INWARD'],
    { modifier: true },
  ),
  approved(
    'fact_relations', 'Relations among accepted facts (recurrence, surface/interior, family presence)',
    'APPROVED_CONDITIONAL', 'CORE',
    { mode: 'ANY_TWO_FACTS' },
    ['OBSERVE_RECURRENCE', 'OBSERVE_SURFACE_INTERIOR', 'OBSERVE_FAMILY_PRESENCE', 'SYNTHESIZE_TENSION_OR_REINFORCEMENT'],
  ),
  // ---- POLICY_METHODS ---------------------------------------------------------
  approved('source_warnings', 'Source warnings (policy)', 'APPROVED_MVP_V1', 'POLICY',
    { mode: 'NONE' }, ['PRESERVE', 'SURFACE_NEUTRALLY'], { claimBearing: false }),
  approved('provisionality_unknown_time', 'Provisional / unknown-time handling (policy)', 'APPROVED_MVP_V1', 'POLICY',
    { mode: 'NONE' }, ['MARK_TENTATIVE', 'EXCLUDE_ASSUMED_TIME_DERIVED', 'STATE_EFFECT_OF_MISSING_TIME'], { claimBearing: false }),
  // ---- OPTIONAL_SUPPORTING_METHODS ---------------------------------------------
  approved('month_command', 'Month Command (Yue Ling) — contextual use only', 'APPROVED_CONDITIONAL', 'SUPPORTING',
    kinds('month_command_branch', 'month_command_principal_qi_stem', 'month_command_element'),
    ['CONTEXTUALIZE_SEASON', 'RELATE_PRINCIPAL_QI_TO_DAY_MASTER', 'QUALIFY_WITH_BACKDROP']),
  approved('yin_yang_polarity', 'Yin / Yang polarity', 'APPROVED_MVP_V1', 'SUPPORTING',
    kinds('day_master_polarity', 'pillar_stem_polarity'),
    ['DESCRIBE_MODE', 'OBSERVE_POLARITY_COMPOSITION', 'EXPLAIN_VARIANT']),
  approved('heavenly_stems', 'Heavenly Stems — visible stems', 'APPROVED_MVP_V1', 'SUPPORTING',
    kinds('pillar_stem', 'pillar_stem_element', 'pillar_stem_polarity'),
    ['DESCRIBE_SURFACE', 'COMPARE_VISIBLE_STEMS']),
  approved('earthly_branches', 'Earthly Branches', 'APPROVED_CONDITIONAL', 'SUPPORTING',
    kinds('pillar_branch', 'pillar_branch_tier'),
    ['NAME_BRANCH', 'HAND_OFF_TO_HIDDEN_STEMS', 'MARK_SEASON']),
  approved('wu_xing_relations', 'Wu Xing relations — state A: day-master-relative, source-supplied only',
    'APPROVED_CONDITIONAL', 'SUPPORTING',
    kinds('ten_god_element_relation', 'hidden_stem_ten_god_element_relation'),
    ['RELATE_TO_DAY_MASTER']),
  approved('wu_xing_distribution', 'BaZi structural Wu Xing distribution (tally, never strength)',
    'APPROVED_CONDITIONAL', 'SUPPORTING',
    kinds('wu_xing_weight', 'wu_xing_dominant'),
    ['DESCRIBE_TALLY_SHAPE', 'COMPARE_WITH_OTHER_THEMES', 'OBSERVE_LOW_ENTRY', 'NAME_ALL_TIED_MAXIMA']),
  // ---- DEFERRED ------------------------------------------------------------------
  unavailable('day_master_strength', 'Day Master strength (Wang/Shuai)', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('rooting', 'Rooting (Tong Gen)', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('seasonal_strength', 'Seasonal strength (Wang/Xiang/Xiu/Qiu/Si)', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'MISSING_DETERMINISTIC_RULE']),
  unavailable('structure', 'Ge Ju / structure classification', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('useful_god', 'Yong Shen / Useful God', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'SCHOOL_POLICY_UNRESOLVED', 'SOURCE_CONFLICT']),
  unavailable('favourable_elements_xi_shen', 'Xi Shen / favourable elements', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('unfavourable_elements_ji_shen', 'Ji Shen / unfavourable elements', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('climatic_adjustment', 'Tiao Hou / climatic adjustment', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('stem_combinations', 'Heavenly Stem combinations', NEEDS,
    ['MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('stem_clashes', 'Heavenly Stem clashes', 'DEFERRED_PRODUCT_DECISION',
    ['SCHOOL_POLICY_UNRESOLVED', 'PRODUCT_DECISION_NEEDED']),
  unavailable('branch_combinations', 'Branch combinations', NEEDS,
    ['MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('branch_clashes', 'Branch clashes', NEEDS, ['MISSING_DETERMINISTIC_RULE', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('branch_harms', 'Branch harms', NEEDS, ['MISSING_DETERMINISTIC_RULE', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('branch_punishments', 'Branch punishments', NEEDS,
    ['MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('branch_destructions', 'Branch destructions / breaks', NEEDS,
    ['MISSING_DETERMINISTIC_RULE', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('transformations', 'Transformations (He Hua)', NEEDS,
    ['MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED', 'SOURCE_CONFLICT']),
  unavailable('full_interaction_registry', 'Full interaction registry', NEEDS,
    ['MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('symbolic_stars', 'Shen Sha / symbolic stars', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'MISSING_DETERMINISTIC_RULE', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('twelve_life_stages', 'Twelve Life Stages', NEEDS,
    ['FUFIRE_CAPABILITY_MISSING', 'SOURCE_CONFLICT', 'SCHOOL_POLICY_UNRESOLVED']),
  unavailable('na_yin', 'Na Yin', NEEDS, ['MISSING_FACT', 'IMPLEMENTATION_NOT_PRESENT']),
  unavailable('kong_wang', 'Kong Wang / emptiness', NEEDS, ['MISSING_FACT', 'SCHOOL_POLICY_UNRESOLVED']),
  // ---- FORBIDDEN -------------------------------------------------------------------
  unavailable('luck_pillars_da_yun', 'Da Yun / luck pillars', 'FORBIDDEN_MVP_V1',
    ['OUT_OF_PRODUCT_SCOPE', 'IMPLEMENTATION_NOT_PRESENT'], 'luck_pillars'),
  unavailable('annual_liu_nian_transits', 'Liu Nian / annual and transit interpretation', 'FORBIDDEN_MVP_V1',
    ['OUT_OF_PRODUCT_SCOPE'], 'luck_pillars'),
  unavailable('relationship_constructs', 'Relationship constructs', 'FORBIDDEN_MVP_V1', ['OUT_OF_PRODUCT_SCOPE']),
  unavailable('western_astrology', 'Western astrology', 'FORBIDDEN_MVP_V1', ['OUT_OF_PRODUCT_SCOPE']),
  unavailable('fusion', 'Bazodiac Fusion', 'FORBIDDEN_MVP_V1', ['OUT_OF_PRODUCT_SCOPE']),
  unavailable('prescriptive_remedies', 'Remedies and prescriptions', 'FORBIDDEN_MVP_V1', ['OUT_OF_PRODUCT_SCOPE']),
  unavailable('element_health_correspondence', 'Element–organ / health correspondences', 'FORBIDDEN_MVP_V1',
    ['OUT_OF_PRODUCT_SCOPE']),
];

export const BAZI_METHOD_REGISTRY_V1: MethodRegistry = {
  profileId: METHOD_PROFILE_ID,
  profileVersion: METHOD_PROFILE_VERSION,
  methods: METHODS,
  enabledSets: {
    minimumSellableCore: ['four_pillars', 'day_master', 'ten_gods', 'hidden_stems', 'positional_context', 'fact_relations'],
    policyMethods: ['source_warnings', 'provisionality_unknown_time'],
    optionalSupportingMethods: [
      'month_command', 'yin_yang_polarity', 'heavenly_stems', 'earthly_branches',
      'wu_xing_relations', 'wu_xing_distribution',
    ],
  },
};

// =============================================================================
// Validation — fail closed.
// =============================================================================

export type MethodRegistryErrorCode =
  | 'REGISTRY_VERSION_INVALID'
  | 'REGISTRY_DUPLICATE_METHOD_ID'
  | 'REGISTRY_UNKNOWN_STATUS'
  | 'REGISTRY_UNKNOWN_GAP_CODE'
  | 'REGISTRY_UNKNOWN_FACT_KIND'
  | 'REGISTRY_NON_APPROVED_IN_ENABLED_SET'
  | 'REGISTRY_APPROVED_NOT_IN_EXACTLY_ONE_SET'
  | 'REGISTRY_NECESSITY_SET_MISMATCH'
  | 'REGISTRY_NON_APPROVED_WITH_OPERATIONS'
  | 'REGISTRY_NON_APPROVED_CLAIM_BEARING'
  | 'REGISTRY_UNAVAILABLE_WITHOUT_GAP_CODE'
  | 'REGISTRY_APPROVED_WITHOUT_OPERATIONS'
  | 'REGISTRY_CLAIM_BEARING_WITHOUT_EVIDENCE'
  | 'REGISTRY_MODIFIER_NOT_CLAIM_BEARING'
  | 'REGISTRY_SCOPE_DRIFT';

export class MethodRegistryError extends Error {
  readonly code: MethodRegistryErrorCode;
  constructor(code: MethodRegistryErrorCode, message: string) {
    super(message);
    this.name = 'MethodRegistryError';
    this.code = code;
  }
}

export function isApprovedStatus(status: MethodStatus): boolean {
  return status === 'APPROVED_MVP_V1' || status === 'APPROVED_CONDITIONAL';
}

/** The closed set of fact kinds a registry may name. Kept in lockstep by a test. */
export const KNOWN_FACT_KINDS: readonly ChartFactKind[] = [
  'pillar_stem', 'pillar_stem_hanzi', 'pillar_stem_pinyin',
  'pillar_branch', 'pillar_branch_hanzi', 'pillar_branch_pinyin',
  'pillar_stem_element', 'pillar_branch_tier',
  'day_master', 'day_master_hanzi', 'day_master_pinyin', 'day_master_element', 'day_master_polarity',
  'wu_xing_weight', 'wu_xing_dominant',
  'ten_god', 'hidden_stem', 'hidden_stem_element', 'hidden_stem_ten_god',
  'month_command_branch', 'month_command_principal_qi_stem',
  'pillar_stem_polarity', 'ten_god_element_relation', 'hidden_stem_qi_role',
  'hidden_stem_ten_god_element_relation', 'month_command_element',
];

/**
 * Validates a registry. Throws on the FIRST violation: a registry that is wrong
 * in one place is not trusted in any other.
 */
export function validateMethodRegistry(registry: MethodRegistry): void {
  if (!/^\d+\.\d+\.\d+$/u.test(registry.profileVersion)) {
    throw new MethodRegistryError(
      'REGISTRY_VERSION_INVALID',
      `profileVersion "${registry.profileVersion}" is not a released semantic version; a draft or candidate registry may not authorise a reading`,
    );
  }
  const seen = new Set<string>();
  const statusVocabulary = new Set<string>(METHOD_STATUSES);
  const gapVocabulary = new Set<string>(GAP_CODES);
  const kindVocabulary = new Set<string>(KNOWN_FACT_KINDS);

  for (const method of registry.methods) {
    if (seen.has(method.methodId)) {
      throw new MethodRegistryError('REGISTRY_DUPLICATE_METHOD_ID', `method id "${method.methodId}" occurs twice`);
    }
    seen.add(method.methodId);
    if (!statusVocabulary.has(method.status)) {
      throw new MethodRegistryError('REGISTRY_UNKNOWN_STATUS', `method "${method.methodId}" has status "${String(method.status)}"`);
    }
    for (const code of method.gapCodes) {
      if (!gapVocabulary.has(code)) {
        throw new MethodRegistryError('REGISTRY_UNKNOWN_GAP_CODE', `method "${method.methodId}" names gap code "${String(code)}"`);
      }
    }
    if (method.evidence.mode === 'kinds') {
      for (const kind of method.evidence.kinds) {
        if (!kindVocabulary.has(kind)) {
          throw new MethodRegistryError('REGISTRY_UNKNOWN_FACT_KIND', `method "${method.methodId}" names fact kind "${String(kind)}", which no ChartFact carries`);
        }
      }
    }
    if (isApprovedStatus(method.status)) {
      if (method.operations.length === 0) {
        throw new MethodRegistryError('REGISTRY_APPROVED_WITHOUT_OPERATIONS', `approved method "${method.methodId}" declares no operation`);
      }
      if (method.claimBearing && (method.evidence.mode === 'NONE' || (method.evidence.mode === 'kinds' && method.evidence.kinds.length === 0))) {
        throw new MethodRegistryError('REGISTRY_CLAIM_BEARING_WITHOUT_EVIDENCE', `claim-bearing method "${method.methodId}" names no evidence; it could never satisfy methodRefs invariant I2`);
      }
      if (method.modifier && !method.claimBearing) {
        throw new MethodRegistryError('REGISTRY_MODIFIER_NOT_CLAIM_BEARING', `modifier "${method.methodId}" must be claim-bearing to be referenced at all`);
      }
    } else {
      if (method.operations.length > 0) {
        throw new MethodRegistryError('REGISTRY_NON_APPROVED_WITH_OPERATIONS', `method "${method.methodId}" is ${method.status} but declares operations; a deferred method may not leak capability`);
      }
      if (method.claimBearing) {
        throw new MethodRegistryError('REGISTRY_NON_APPROVED_CLAIM_BEARING', `method "${method.methodId}" is ${method.status} but claim-bearing`);
      }
      if (method.gapCodes.length === 0) {
        throw new MethodRegistryError('REGISTRY_UNAVAILABLE_WITHOUT_GAP_CODE', `method "${method.methodId}" is ${method.status} and names no missing dependency`);
      }
    }
  }

  const byId = new Map(registry.methods.map((method) => [method.methodId, method]));
  const sets: readonly (readonly [MethodNecessity, readonly string[]])[] = [
    ['CORE', registry.enabledSets.minimumSellableCore],
    ['POLICY', registry.enabledSets.policyMethods],
    ['SUPPORTING', registry.enabledSets.optionalSupportingMethods],
  ];
  const membership = new Map<string, number>();
  for (const [necessity, ids] of sets) {
    for (const id of ids) {
      const method = byId.get(id);
      if (method === undefined || !isApprovedStatus(method.status)) {
        throw new MethodRegistryError(
          'REGISTRY_NON_APPROVED_IN_ENABLED_SET',
          `enabled set ${necessity} lists "${id}", which is ${method === undefined ? 'unknown' : method.status}`,
        );
      }
      if (method.necessity !== necessity) {
        throw new MethodRegistryError('REGISTRY_NECESSITY_SET_MISMATCH', `method "${id}" is ${String(method.necessity)} but listed under ${necessity}`);
      }
      membership.set(id, (membership.get(id) ?? 0) + 1);
    }
  }
  for (const method of registry.methods) {
    if (isApprovedStatus(method.status) && membership.get(method.methodId) !== 1) {
      throw new MethodRegistryError('REGISTRY_APPROVED_NOT_IN_EXACTLY_ONE_SET', `approved method "${method.methodId}" is in ${String(membership.get(method.methodId) ?? 0)} enabled sets`);
    }
  }

  // The ETBZ-25 method-scope module and the registry may never disagree about
  // what is evaluated: a method narrated as "evaluated" that the registry does
  // not approve — or the reverse — is exactly the drift this file exists to stop.
  for (const evaluated of EVALUATED_METHODS) {
    const method = byId.get(evaluated.methodId);
    if (method === undefined || !isApprovedStatus(method.status)) {
      throw new MethodRegistryError('REGISTRY_SCOPE_DRIFT', `method-scope evaluates "${evaluated.methodId}", which the registry does not approve`);
    }
  }
  for (const notEvaluated of NOT_EVALUATED_METHODS) {
    const matches = registry.methods.filter(
      (method) => method.methodId === notEvaluated.methodId || method.legacyScopeId === notEvaluated.methodId,
    );
    if (matches.length === 0 || matches.some((method) => isApprovedStatus(method.status))) {
      throw new MethodRegistryError('REGISTRY_SCOPE_DRIFT', `method-scope marks "${notEvaluated.methodId}" not_evaluated, but the registry ${matches.length === 0 ? 'does not know it' : 'approves it'}`);
    }
  }
}

// =============================================================================
// Per-chart enablement.
// =============================================================================

export interface MethodEnablement {
  readonly methodId: string;
  readonly enabled: boolean;
  readonly reason:
    | 'PRECONDITIONS_MET'
    | 'NOT_APPROVED'
    | 'REQUIRED_FACT_KIND_MISSING'
    | 'MONTH_COMMAND_IDENTITY_NOT_PROVEN';
  readonly detail: string | null;
}

function interpretable(facts: readonly ChartFact[]): readonly ChartFact[] {
  return facts.filter((fact) => fact.interpretable);
}

/**
 * Decides, for ONE chart, which approved methods may actually be used.
 *
 * A method is enabled only when every fact kind it names is present among the
 * INTERPRETABLE facts of this chart. `month_command` additionally requires the
 * identity `month hiddenStem[0].stem === monthCommand.principalQiStem`: the
 * month-command claim cites the principal hidden stem's Ten God, and that is
 * only the same thing if the two accepted facts are literally identical. This
 * is an identity comparison of two accepted values — no table is consulted.
 */
export function resolveMethodEnablement(
  registry: MethodRegistry,
  featureSet: InterpretationFeatureSet,
): readonly MethodEnablement[] {
  validateMethodRegistry(registry);
  const facts = interpretable(featureSet.facts);
  const presentKinds = new Set(facts.map((fact) => fact.kind));
  const valueOf = (id: string): string | null => facts.find((fact) => fact.id === id)?.value ?? null;

  return registry.methods.map((method): MethodEnablement => {
    if (!isApprovedStatus(method.status)) {
      return { methodId: method.methodId, enabled: false, reason: 'NOT_APPROVED', detail: method.status };
    }
    if (method.evidence.mode === 'kinds') {
      const missing = method.evidence.kinds.filter((kind) => !presentKinds.has(kind));
      if (missing.length > 0) {
        return { methodId: method.methodId, enabled: false, reason: 'REQUIRED_FACT_KIND_MISSING', detail: missing.join(', ') };
      }
    }
    if (method.methodId === 'month_command') {
      const principal = valueOf('chart.natal.monthCommand.principalQiStem');
      const hidden = valueOf('chart.natal.pillar.month.hiddenStem.0.stem');
      if (principal === null || hidden === null || principal !== hidden) {
        return {
          methodId: method.methodId,
          enabled: false,
          reason: 'MONTH_COMMAND_IDENTITY_NOT_PROVEN',
          detail: `principalQiStem=${String(principal)} month.hiddenStem.0.stem=${String(hidden)}`,
        };
      }
    }
    return { methodId: method.methodId, enabled: true, reason: 'PRECONDITIONS_MET', detail: null };
  });
}

/** Hash of the registry content — what a run records to prove WHICH profile authorised it. */
export function methodRegistryStructuralHash(registry: MethodRegistry): string {
  return structuralHash(registry);
}
