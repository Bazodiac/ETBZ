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

export const CONTRACT_STATUSES = ['CURRENT', 'CANDIDATE', 'DRAFT'] as const;
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
  /**
   * CURRENT authorises a released bundle. CANDIDATE authorises only an
   * evaluation run of a bundle version listed as a candidate (ETBZ-57: a
   * revision awaiting its Human Editorial Gate); it never makes a bundle
   * released. The schema admits DRAFT solely to refuse it.
   */
  readonly status: ContractStatus;
  /**
   * The page's own "Decision date" line, `YYYY-MM-DD` - never a page-version
   * timestamp. Null exactly for a CANDIDATE page: it has no decision date yet.
   */
  readonly releasedOn: string | null;
  readonly owns: readonly ContractDomain[];
  /**
   * The contracts this page lists under "Normative dependencies", by key. A
   * page that lists none, or lists another page only as "Related", has an
   * empty list here.
   */
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
    releasedOn: '2026-09-17',
    owns: ['SYMBOLIC_OPERATIONS'],
    dependsOn: [],
  },
  {
    key: 'LONG_FORM',
    title: 'ETBZ — Long-Form Meta-Narrative Contract v1',
    identity: null,
    confluencePageId: '57802765',
    confluencePageVersion: '2',
    status: 'CURRENT',
    releasedOn: '2026-09-13',
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
 * ETBZ-57 - the contract set of bundle 1.1.0. The Interpretation Lens and the
 * Terminology & Wording Lexicon at their voice revision, the Anti-Boilerplate
 * contract at its binding-only revision (its 1.0.0 pins the Lens and Lexicon
 * at 1.0.0 and requires a new identity for a consumer-binding change). Each
 * revision is a separate page copied from the released one; the 1.0.0 pages
 * stay the binding of every run generated under them. Released 2026-10-01:
 * the ETBZ-57 Human Editorial Gate returned ACCEPTED (Jira ETBZ-57 comment
 * 16969), and the three are bound CURRENT at their released page versions.
 * Method Profile and Long-Form are unchanged.
 */
const unchangedSource = (key: ContractKey): ContractSource =>
  RELEASED_CONTRACT_SOURCES.find((source) => source.key === key) as ContractSource;

export const CONTRACT_SOURCES_V1_1: readonly ContractSource[] = [
  unchangedSource('METHOD_PROFILE'),
  unchangedSource('LONG_FORM'),
  {
    key: 'INTERPRETATION_LENS',
    title: 'ETBZ — Grounded Reflective Synthesis Interpretation Lens v1.1',
    identity: 'grounded-reflective-synthesis-lens@1.1.0',
    confluencePageId: '77561858',
    confluencePageVersion: '6',
    status: 'CURRENT',
    releasedOn: '2026-10-01',
    owns: ['SEMANTIC_ENVELOPE'],
    dependsOn: ['METHOD_PROFILE', 'LONG_FORM'],
  },
  {
    key: 'TERMINOLOGY_LEXICON',
    title: 'ETBZ — Terminology & Wording Lexicon v1.1',
    identity: 'terminology-wording-lexicon@1.1.0',
    confluencePageId: '77529091',
    confluencePageVersion: '4',
    status: 'CURRENT',
    releasedOn: '2026-10-01',
    owns: ['CUSTOMER_WORDING'],
    dependsOn: ['METHOD_PROFILE', 'LONG_FORM', 'INTERPRETATION_LENS'],
  },
  {
    key: 'ANTI_BOILERPLATE',
    title: 'ETBZ — Cross-Reading Individuality / Anti-Boilerplate Contract v1.1',
    identity: 'cross-reading-individuality-contract@1.1.0',
    confluencePageId: '77266967',
    confluencePageVersion: '3',
    status: 'CURRENT',
    releasedOn: '2026-10-01',
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
