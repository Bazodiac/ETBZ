// =============================================================================
// ETBZ-117 (Canon v2, R0) - the Interpretation Lens 2.1.0 as values.
//
// `grounded-reflective-synthesis-lens@2.1.0` is Confluence 85229569 "ETBZ — C1
// Interpretationsregeln v2", page version 2 (Product Owner reconcile of
// 2026-10-05, ETBZ-117 / ETBZ-116). Version 2 changes three places of the page
// and nothing else:
//   - the header gains the PO-Reconcile paragraph (this page version is the one
//     new Canon v2 work binds; 2.0.0 stays bound to version 1);
//   - Zone B: a Vorstoß carries a non-interactive reflection question;
//   - the Vorstoß contract, part 5: a reflection question as a rhetorical text
//     impulse, without a mandatory answer format or answer options (the
//     Ja / Nein / Teilweise answer of version 1 is gone).
// Every other block is page version 1's and is taken from the 2.0.0 module
// unchanged - that module is not touched: 2.0.0 stays bound to page version 1
// (ADR 0019, ADR 0020). The text rules of `semantic-envelope-v2.ts` hold here
// too: C1's text as the page renders it, characters unchanged, markdown
// emphasis and code marks removed; identifiers are this module's labels.
//
// It carries no method reference, no fact and no number.
// =============================================================================

import { deepFreeze } from './deep-freeze.js';
import type { LensSection } from './semantic-envelope.js';
import {
  ORIGIN_MARKERS,
  PAGE_RULES_V2,
  SEMANTIC_ENVELOPE_V2,
  VOICE_AUTHORITY,
  VORSTOSS_CONTRACT,
} from './semantic-envelope-v2.js';

const c1 = (section: string): LensSection => ({ contract: 'INTERPRETATION_LENS', section });

/**
 * The header of page version 2: version 1's rules and status, and the
 * PO-Reconcile paragraph it adds, quoted whole (its label included).
 */
export const PAGE_RULES_V2_1 = {
  ...PAGE_RULES_V2,
  poReconcile: 'PO-Reconcile 2026-10-05 (ETBZ-117 / ETBZ-116): Diese Seitenversion gilt für neue Canon-v2-Arbeit. Die unter ETBZ-77 bereits released Lens/Lexicon-Identitäten 2.0.0 bleiben an die vorherige C1/C5-Quellversion gebunden und werden nicht in place verändert. Die aktualisierte Regel wird über eine neue immutable Contract-Identity vor ETBZ-78 released.',
  source: c1('(Kopf)'),
} as const;

/** Zone B of page version 2: the Vorstoß row changes, the other four are version 1's. */
export const ORIGIN_MARKERS_V2_1 = {
  ...ORIGIN_MARKERS,
  statementTypes: ORIGIN_MARKERS.statementTypes.map((entry) =>
    entry.statementType === 'Vorstoß'
      ? { statementType: 'Vorstoß', form: 'pointiert, widerlegbar, mit nicht-interaktiver Reflexionsfrage' }
      : entry,
  ),
} as const;

/** The Vorstoß contract of page version 2: part 5 is a reflection question as a text impulse; the other parts and the frequency are version 1's. */
export const VORSTOSS_CONTRACT_V2_1 = {
  ...VORSTOSS_CONTRACT,
  parts: VORSTOSS_CONTRACT.parts.map((part) =>
    part.partId === 'PRUEFFRAGE'
      ? { partId: 'REFLEXIONSFRAGE', text: 'eine Reflexionsfrage als rhetorischen Textimpuls, ohne verpflichtendes Antwortformat oder Antwortoptionen.' }
      : part,
  ),
} as const;

/** C1 still hands voice and wording to C5; the binding names the Lexicon released with this Lens, C5 at page version 2. */
export const VOICE_AUTHORITY_V2_1 = {
  ...VOICE_AUTHORITY,
  binding: {
    contractRef: 'terminology-wording-lexicon@2.1.0',
    confluencePageId: '85164034',
    confluencePageVersion: '2',
  },
} as const;

/** Everything the Lens 2.1.0 assembles - the content its release hash freezes. */
export const SEMANTIC_ENVELOPE_V2_1 = {
  ...SEMANTIC_ENVELOPE_V2,
  pageRules: PAGE_RULES_V2_1,
  originMarkers: ORIGIN_MARKERS_V2_1,
  vorstossContract: VORSTOSS_CONTRACT_V2_1,
  voiceAuthority: VOICE_AUTHORITY_V2_1,
} as const;
export type SemanticEnvelopeV2_1 = typeof SEMANTIC_ENVELOPE_V2_1;

// Handed out by reference: frozen where defined (see deep-freeze.ts).
deepFreeze(SEMANTIC_ENVELOPE_V2_1);
