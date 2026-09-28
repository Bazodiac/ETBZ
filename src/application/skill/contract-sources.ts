// =============================================================================
// ETBZ-51 - the released contract sources a Skill run is held to.
//
// Confluence owns each contract; this table records WHICH page, WHICH released
// version and WHICH identity the repository binds - nothing else. It carries
// no rule text: the executable representation of each contract lives in the
// sibling modules (`semantic-envelope.ts`, `wording-boundaries.ts`,
// `individuality-contract.ts`) and in the Method Registry, and every entry
// there names the section it represents.
//
// Precedence is DOMAIN-SCOPED, because the pages define it that way: the Lens
// yields to a released terminology contract on wording, the Lexicon yields to
// the Lens on semantic permission, and both yield to the Method Profile and the
// Long-Form Contract on everything. A single total order would misstate two of
// the three precedence clauses, so the bundle records tiers and owned domains
// and refuses a domain with two owners.
//
// Page versions are strings on purpose (see `meta-narrative-plan.ts`): a page
// version identifies a revision, nothing here counts or compares it.
// =============================================================================

export const CONTRACT_KEYS = [
  'METHOD_PROFILE',
  'LONG_FORM',
  'INTERPRETATION_LENS',
  'TERMINOLOGY_LEXICON',
  'ANTI_BOILERPLATE',
] as const;
export type ContractKey = (typeof CONTRACT_KEYS)[number];

/** What a contract may decide. Each domain has exactly one owner (checked). */
export const CONTRACT_DOMAINS = [
  /** which interpretive operations are permitted on accepted facts, with which certainty */
  'SYMBOLIC_OPERATIONS',
  /** claims, relations, plan, chapters, semantic delta, callback, contradiction, projections */
  'NARRATIVE_STRUCTURE',
  /** epistemic levels, Ten-God semantic envelope, depth operators, reflection, anti-Barnum */
  'SEMANTIC_ENVELOPE',
  /** customer terminology, uncertainty language, prohibited wording */
  'CUSTOMER_WORDING',
  /** how a chart-bound reading is told from a templated one across customers */
  'CROSS_READING_INDIVIDUALITY',
] as const;
export type ContractDomain = (typeof CONTRACT_DOMAINS)[number];

export const CONTRACT_STATUSES = ['CURRENT', 'DRAFT'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface ContractSource {
  readonly key: ContractKey;
  /** The page title as released. */
  readonly title: string;
  /** The released identity `<name>@<semver>`, or null where the page publishes none. */
  readonly identity: string | null;
  readonly confluencePageId: string;
  /** The page version the repository binds. A later revision is an explicit re-binding. */
  readonly confluencePageVersion: string;
  /** Only CURRENT authorises anything; the schema admits DRAFT solely to refuse it. */
  readonly status: ContractStatus;
  /** Decision / release date as the page states it. */
  readonly releasedOn: string;
  readonly owns: readonly ContractDomain[];
  /** The contracts this page names as its own normative dependencies, by key. */
  readonly dependsOn: readonly ContractKey[];
}

/**
 * The reference a run's evidence uses for a bound contract: the released
 * identity where one exists, otherwise the page pinned by version. The second
 * form is a repository address, not a claim that the page released an identity.
 */
export function contractBindingRef(source: Pick<ContractSource, 'identity' | 'confluencePageId' | 'confluencePageVersion'>): string {
  return source.identity ?? `confluence:${source.confluencePageId}@${source.confluencePageVersion}`;
}

export const RELEASED_CONTRACT_SOURCES: readonly ContractSource[] = [
  {
    key: 'METHOD_PROFILE',
    title: 'ETBZ — BaZi Method Profile v1',
    identity: 'bazi-method-profile@1.0.0',
    confluencePageId: '63012866',
    confluencePageVersion: '5',
    status: 'CURRENT',
    releasedOn: '2026-09-18',
    owns: ['SYMBOLIC_OPERATIONS'],
    dependsOn: ['LONG_FORM'],
  },
  {
    key: 'LONG_FORM',
    title: 'ETBZ — Long-Form Meta-Narrative Contract v1',
    identity: null,
    confluencePageId: '57802765',
    confluencePageVersion: '2',
    status: 'CURRENT',
    releasedOn: '2026-09-18',
    owns: ['NARRATIVE_STRUCTURE'],
    dependsOn: [],
  },
  {
    key: 'INTERPRETATION_LENS',
    title: 'ETBZ — Grounded Reflective Synthesis Interpretation Lens v1',
    identity: 'grounded-reflective-synthesis-lens@1.0.0',
    confluencePageId: '67371029',
    confluencePageVersion: '1',
    status: 'CURRENT',
    releasedOn: '2026-09-21',
    owns: ['SEMANTIC_ENVELOPE'],
    dependsOn: ['METHOD_PROFILE', 'LONG_FORM'],
  },
  {
    key: 'TERMINOLOGY_LEXICON',
    title: 'ETBZ — Terminology & Wording Lexicon v1',
    identity: 'terminology-wording-lexicon@1.0.0',
    confluencePageId: '67600385',
    confluencePageVersion: '1',
    status: 'CURRENT',
    releasedOn: '2026-09-21',
    owns: ['CUSTOMER_WORDING'],
    dependsOn: ['METHOD_PROFILE', 'LONG_FORM', 'INTERPRETATION_LENS'],
  },
  {
    key: 'ANTI_BOILERPLATE',
    title: 'ETBZ — Cross-Reading Individuality / Anti-Boilerplate Contract v1',
    identity: 'cross-reading-individuality-contract@1.0.0',
    confluencePageId: '72056833',
    confluencePageVersion: '1',
    status: 'CURRENT',
    releasedOn: '2026-09-28',
    owns: ['CROSS_READING_INDIVIDUALITY'],
    dependsOn: ['METHOD_PROFILE', 'LONG_FORM', 'INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON'],
  },
];

/**
 * Tiers, highest authority first. A tier with one member decides over every
 * lower tier outright; inside a tier with several members each contract
 * decides only within the domains it owns, which must not overlap. FuFirE's
 * validated facts stand above the first tier and are not a contract: no page
 * may contradict a validated fact, and no bundle entry can carry one.
 */
export const PRECEDENCE_TIERS: readonly (readonly ContractKey[])[] = [
  ['METHOD_PROFILE'],
  ['LONG_FORM'],
  ['INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON', 'ANTI_BOILERPLATE'],
];

/** The parent product decision the contracts hang under. Recorded, not asserted per version. */
export const PARENT_DECISION = {
  title: 'Bazodiac Interpretation Model & Skill-driven Concierge MVP Rebaseline v1',
  confluencePageId: '62128133',
  section: '4',
} as const;
