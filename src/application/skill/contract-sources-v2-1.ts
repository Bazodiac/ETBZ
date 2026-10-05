// =============================================================================
// ETBZ-117 (Canon v2, R0) - the released sources of the Interpretation Lens
// 2.1.0 and the Terminology & Wording Lexicon 2.1.0: the forward fix of the
// 2.0.0 pair to the current Canon v2 pages, released beside 2.0.0.
//
// On 2026-10-05 the Product Owner revised C1 (85229569) and C5 (85164034) to
// page version 2 (Jira ETBZ-117 / ETBZ-116, hub 85131265 "Pre-A2 reconcile
// decision"): the reflection question stays, as a non-interactive text
// impulse, and the mandatory Ja / Nein / Teilweise answer is gone. C1 version 2
// says how that is released: the 2.0.0 identities stay bound to the previous
// page versions and are not changed in place; the updated rule is released as a
// new immutable contract identity before ETBZ-78. ADR 0020 assigns 2.1.0 on
// both lineages: a changed rule of a released contract is a new minor version,
// as Lens and Lexicon 1.1.0 were (ADR 0013), and the pair moves together
// because each binds the other's page version (ADR 0019).
//
// Version beside version: this file only adds. `contract-sources-v2.ts`
// (2.0.0) and `contract-sources.ts` (1.0.0, 1.1.0) are not touched. Page
// versions are strings: they identify a revision, nothing counts them.
// =============================================================================

import type { ContractSource } from './contract-sources.js';
import { CANON_V2_SUPERSESSIONS, INTERPRETATION_LENS_V2_SOURCE, TERMINOLOGY_LEXICON_V2_SOURCE } from './contract-sources-v2.js';
import type { CanonV2Supersession } from './contract-sources-v2.js';
import { deepFreeze } from './deep-freeze.js';

/** Interpretation Lens 2.1.0 = C1 at page version 2. Title, domain and dependency are 2.0.0's. */
export const INTERPRETATION_LENS_V2_1_SOURCE: ContractSource = {
  ...INTERPRETATION_LENS_V2_SOURCE,
  identity: 'grounded-reflective-synthesis-lens@2.1.0',
  confluencePageVersion: '2',
  releasedOn: '2026-10-05',
};

/** Terminology & Wording Lexicon 2.1.0 = C5 at page version 2. Title, domain and dependency are 2.0.0's. */
export const TERMINOLOGY_LEXICON_V2_1_SOURCE: ContractSource = {
  ...TERMINOLOGY_LEXICON_V2_SOURCE,
  identity: 'terminology-wording-lexicon@2.1.0',
  confluencePageVersion: '2',
  releasedOn: '2026-10-05',
};

/** The two contracts the 2.1 line releases: the same two keys as the 2.0 line, nothing more (Method Profile v2 is ETBZ-78). */
export const CANON_V2_1_CONTRACT_SOURCES: readonly ContractSource[] = [
  INTERPRETATION_LENS_V2_1_SOURCE,
  TERMINOLOGY_LEXICON_V2_1_SOURCE,
];

/** What a 2.1.0 contract supersedes beyond the 1.x identities: the earlier Canon v2 identity of its lineage. */
export interface CanonV2PriorVersions {
  /** C1 page version 2's PO-Reconcile sentences on the 2.0.0 identities, quoted. */
  readonly statement: string;
  /** The earlier 2.x identities of the lineage. Each stays resolvable, in its own context only. */
  readonly contractRefs: readonly string[];
}

/** The supersession record of a 2.1.0 contract: 2.0.0's record of the 1.x identities, and the 2.0.0 identity it moves forward. */
export interface CanonV2_1Supersession extends CanonV2Supersession {
  readonly priorCanonVersions: CanonV2PriorVersions;
}

const C1_V2_RECONCILE_STATEMENT =
  'Die unter ETBZ-77 bereits released Lens/Lexicon-Identitäten 2.0.0 bleiben an die vorherige C1/C5-Quellversion gebunden und werden nicht in place verändert. Die aktualisierte Regel wird über eine neue immutable Contract-Identity vor ETBZ-78 released.';

export const CANON_V2_1_SUPERSESSIONS: Readonly<Record<'INTERPRETATION_LENS' | 'TERMINOLOGY_LEXICON', CanonV2_1Supersession>> = {
  INTERPRETATION_LENS: {
    ...CANON_V2_SUPERSESSIONS.INTERPRETATION_LENS,
    priorCanonVersions: {
      statement: C1_V2_RECONCILE_STATEMENT,
      contractRefs: ['grounded-reflective-synthesis-lens@2.0.0'],
    },
  },
  TERMINOLOGY_LEXICON: {
    ...CANON_V2_SUPERSESSIONS.TERMINOLOGY_LEXICON,
    priorCanonVersions: {
      statement: C1_V2_RECONCILE_STATEMENT,
      contractRefs: ['terminology-wording-lexicon@2.0.0'],
    },
  },
};

// Handed out by reference: frozen where defined (see deep-freeze.ts).
deepFreeze(CANON_V2_1_CONTRACT_SOURCES);
deepFreeze(CANON_V2_1_SUPERSESSIONS);
