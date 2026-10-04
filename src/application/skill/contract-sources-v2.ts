// =============================================================================
// ETBZ-77 (Canon v2, A1) - the released sources of the Interpretation Lens v2
// and the Terminology & Wording Lexicon v2, beside the unchanged 1.x sources.
//
// The Product Owner's Canon v2 decision of 2026-10-04 (Confluence 85131265)
// replaces, in content, the Lens 1.0/1.1, the Lexicon 1.0/1.1 and Rebaseline
// 62128133 section 17 as far as it concerns sentence-level safety. Two of its
// pages carry the replacing rules: C1 "Interpretationsregeln v2" (85229569)
// for what may be said and with which origin marker, and C5 "Style Guide v3"
// (85164034), to which C1 hands voice and wording. Neither page publishes a
// release identity, so ADR 0019 assigns one on each existing lineage at 2.0.0:
// a 1.x reference of the same lineage is then another version of the same
// contract, which the 2.0 context refuses by name (`canon-v2-contracts.ts`).
//
// Version beside version: this file only adds. `contract-sources.ts` (1.0.0 and
// 1.1.0) is not touched, and every run made under 1.x stays bound to exactly
// the identity, page and page version it was produced with.
//
// Like `contract-sources.ts` this file carries no rule text of the contracts
// themselves: their executable representation lives in
// `semantic-envelope-v2.ts` (C1) and `wording-boundaries-v2.ts` (C5). What it
// carries is the Canon v2 decision they hang under, quoted from the hub, and
// what each one supersedes. Page versions are strings: they identify a
// revision, nothing counts or compares them.
// =============================================================================

import type { ContractSource } from './contract-sources.js';

/**
 * The hub's precedence section, quoted as the page renders it (markdown
 * emphasis and code marks removed, characters unchanged - the same rule as in
 * `semantic-envelope-v2.ts`). Part 1 lists what Canon v2 replaces in
 * content, part 2 what stays in force, part 3 the conflict rule. It is part of
 * every v2 contract's frozen content: a changed precedence is a new contract
 * version, never an edit.
 */
export const CANON_V2_PRECEDENCE = {
  replacesInContentLead: 'Canon v2 replaces, in content:',
  replacesInContent: [
    'Rebaseline 62128133 §17 ("Safety below the surface …"), as far as it concerns sentence-level safety;',
    'Interpretation Lens v1.0/v1.1 (67371029 / 77561858);',
    'Terminology & Wording Lexicon v1.0/v1.1 (67600385 / 77529091);',
    'Cross-Reading Individuality Contract v1.1 (77266967), as far as it concerns voice;',
    'Long-Form Contract v1 (57802765), as far as it concerns chapter length;',
    'Method Profile v1 (63012866), as far as it forbids the methods approved in C2.',
  ],
  remainsInForceLead: 'Repository process and integrity rules stay in force:',
  remainsInForce: [
    'contracts are released only as new versions beside the old ones, with their own release identity, an ADR, a hash freeze and a mutation proof per gate;',
    'scripts/ci-verify.sh is the only definition of "verified";',
    'no real birth data, Golden values or chart values of real persons in commits, tests, Jira or Confluence;',
    'fail-closed at every acceptance boundary;',
    'FuFirE remains the only source of chart facts;',
    'symbol and number citation is mandatory.',
  ],
  conflictRule: 'If Canon v2 conflicts with an existing page or ticket, Canon v2 wins. If it conflicts with a red line (Zone A), the red line wins.',
  source: 'Precedence',
} as const;

/**
 * The product decision the v2 contracts hang under. Recorded like
 * `PARENT_DECISION`: by page and section, not by page version - a later status
 * edit of the hub does not re-release a contract, a changed precedence does
 * (it is quoted above and frozen with every contract).
 */
export const CANON_V2_DECISION = {
  title: 'ETBZ Canon v2 — kanonische Wahrheit (PO-Entscheidung 2026-10-04)',
  confluencePageId: '85131265',
  decisionDate: '2026-10-04',
  precedence: CANON_V2_PRECEDENCE,
} as const;
export type CanonV2Decision = typeof CANON_V2_DECISION;

/**
 * Interpretation Lens v2 = C1. It owns the domain the Lens owned in 1.x. C1
 * lists no "Normative dependencies" section; the dependency recorded is the one
 * its text states: Zone A item 7 binds every method to the Method Profile (v2,
 * C2), released by ETBZ-78.
 */
export const INTERPRETATION_LENS_V2_SOURCE: ContractSource = {
  key: 'INTERPRETATION_LENS',
  title: 'ETBZ — C1 Interpretationsregeln v2',
  identity: 'grounded-reflective-synthesis-lens@2.0.0',
  confluencePageId: '85229569',
  confluencePageVersion: '1',
  status: 'CURRENT',
  releasedOn: '2026-10-04',
  owns: ['SEMANTIC_ENVELOPE'],
  dependsOn: ['METHOD_PROFILE'],
};

/**
 * Terminology & Wording Lexicon v2 = C5, the only admissible voice ("Stimme
 * und Formulierung regelt verbindlich: C5", C1). It owns the domain the Lexicon
 * owned in 1.x. C5 lists no "Normative dependencies" section; the dependency
 * recorded is the one its header states: the red lines of C1 take precedence.
 */
export const TERMINOLOGY_LEXICON_V2_SOURCE: ContractSource = {
  key: 'TERMINOLOGY_LEXICON',
  title: 'ETBZ — Style Guide v3 (kanonisch, einzige zulässige Stimme)',
  identity: 'terminology-wording-lexicon@2.0.0',
  confluencePageId: '85164034',
  confluencePageVersion: '1',
  status: 'CURRENT',
  releasedOn: '2026-10-04',
  owns: ['CUSTOMER_WORDING'],
  dependsOn: ['INTERPRETATION_LENS'],
};

/** The two contracts the 2.0 line releases so far; Method Profile, Long-Form and Anti-Boilerplate v2 follow (ETBZ-78..80). */
export const CANON_V2_CONTRACT_SOURCES: readonly ContractSource[] = [
  INTERPRETATION_LENS_V2_SOURCE,
  TERMINOLOGY_LEXICON_V2_SOURCE,
];

/** The Rebaseline section C1 supersedes, and how far. */
export interface RebaselineSupersession {
  readonly confluencePageId: string;
  readonly section: string;
  readonly title: string;
  /** C1's own limiting clause, quoted. */
  readonly scope: string;
}

/** What one v2 contract supersedes: released 1.x identities of its own lineage, and Rebaseline sections. */
export interface CanonV2Supersession {
  /** C1's replacement sentence, quoted (C1 header; the hub's precedence part 1 says the same). */
  readonly statement: string;
  /** Every released 1.x identity of the lineage. Each stays resolvable for the runs made under it. */
  readonly contractRefs: readonly string[];
  readonly rebaselineSections: readonly RebaselineSupersession[];
}

const C1_REPLACEMENT_STATEMENT =
  'Ersetzt hinsichtlich Stimme und Satzebene: Interpretation Lens v1.0/v1.1, Terminology & Wording Lexicon v1.0/v1.1, Rebaseline §17 („Safety below the surface …"), soweit es um Sicherheit auf Satzebene geht.';

/**
 * Rebaseline section 17 is carried by the Lens line: the Lens 1.1 is where its
 * five voice invariants became values (`VOICE_INVARIANTS`). Section 17 is
 * superseded only as far as sentence-level safety goes - ADR 0019 records what
 * of it stays in force.
 */
export const REBASELINE_SECTION_17: RebaselineSupersession = {
  confluencePageId: '62128133',
  section: '17',
  title: 'Pre-Golden Product Decision — Safety below the surface, clarity on the surface — 2026-09-30',
  scope: 'soweit es um Sicherheit auf Satzebene geht',
};

export const CANON_V2_SUPERSESSIONS: Readonly<Record<'INTERPRETATION_LENS' | 'TERMINOLOGY_LEXICON', CanonV2Supersession>> = {
  INTERPRETATION_LENS: {
    statement: C1_REPLACEMENT_STATEMENT,
    contractRefs: ['grounded-reflective-synthesis-lens@1.0.0', 'grounded-reflective-synthesis-lens@1.1.0'],
    rebaselineSections: [REBASELINE_SECTION_17],
  },
  TERMINOLOGY_LEXICON: {
    statement: C1_REPLACEMENT_STATEMENT,
    contractRefs: ['terminology-wording-lexicon@1.0.0', 'terminology-wording-lexicon@1.1.0'],
    rebaselineSections: [],
  },
};
