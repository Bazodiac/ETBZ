// =============================================================================
// ETBZ-117 (Canon v2, R0) - the Terminology & Wording Lexicon 2.1.0 as values.
//
// `terminology-wording-lexicon@2.1.0` is Confluence 85164034 "ETBZ — Style
// Guide v3 (kanonisch, einzige zulässige Stimme)", page version 2 (Product
// Owner reconcile of 2026-10-05, ETBZ-117 / ETBZ-116). Version 2 changes two
// blocks of the style guide and nothing else: REFLEXIONSFRAGE (the question
// stays as a rhetorical text impulse; no answer format, no Ja/Nein/Teilweise
// options, no answer affordance) and ZIEL. Every other block, the header and
// the closing paragraph are page version 1's, so they are taken from the 2.0.0
// module unchanged - that module is not touched: 2.0.0 stays bound to page
// version 1 (ADR 0019, ADR 0020).
//
// As in 2.0.0 the text is carried whole, block by block and line by line, as
// the page's code block holds it; `styleGuideV3Text(STYLE_GUIDE_V3_BLOCKS_V2_1)`
// joins it back into those bytes. No method reference, no fact, no number.
// =============================================================================

import { deepFreeze } from './deep-freeze.js';
import {
  STYLE_GUIDE_AUTHORITY,
  STYLE_GUIDE_BINDING,
  STYLE_GUIDE_V3_BLOCKS,
  WORDING_BOUNDARIES_V2,
} from './wording-boundaries-v2.js';
import type { StyleGuideBlock } from './wording-boundaries-v2.js';

/**
 * The header of page version 2 is page version 1's. Only the binding changes:
 * the red lines are conceded to the Lens released with this Lexicon, C1 at
 * page version 2.
 */
export const STYLE_GUIDE_AUTHORITY_V2_1 = {
  ...STYLE_GUIDE_AUTHORITY,
  redLinesBinding: {
    contractRef: 'grounded-reflective-synthesis-lens@2.1.0',
    confluencePageId: '85229569',
    confluencePageVersion: '2',
  },
} as const;

/** The two blocks page version 2 rewrites, as its code block holds them. */
const REWRITTEN_BLOCKS: Readonly<Record<string, StyleGuideBlock>> = {
  REFLEXIONSFRAGE: {
    block: 'REFLEXIONSFRAGE',
    lines: [
      'Direkt, als rhetorischer Textimpuls auf eine erinnerbare Lage der letzten Wochen bezogen und ohne BaZi-Wissen verständlich. Kein verpflichtendes Antwortformat, keine Ja/Nein/Teilweise-Optionen und keine Antwort-Affordance. Keine zwei Fragen mit gleichem Satzanfang, keine semantischen Dubletten.',
    ],
  },
  ZIEL: {
    block: 'ZIEL',
    lines: [
      'Der Text soll klare Resonanz oder klaren Widerspruch auslösen. Beides ist Erfolg. Lauwarm ist Misserfolg.',
    ],
  },
};

/** The code block of page version 2: page version 1's blocks, in page order, with the two rewritten ones in their place. */
export const STYLE_GUIDE_V3_BLOCKS_V2_1: readonly StyleGuideBlock[] = STYLE_GUIDE_V3_BLOCKS.map(
  (entry) => REWRITTEN_BLOCKS[entry.block] ?? entry,
);

/** Everything the Lexicon 2.1.0 assembles - the content its release hash freezes. */
export const WORDING_BOUNDARIES_V2_1 = {
  ...WORDING_BOUNDARIES_V2,
  authority: STYLE_GUIDE_AUTHORITY_V2_1,
  styleGuide: {
    ...WORDING_BOUNDARIES_V2.styleGuide,
    blocks: STYLE_GUIDE_V3_BLOCKS_V2_1,
  },
  binding: STYLE_GUIDE_BINDING,
} as const;
export type WordingBoundariesV2_1 = typeof WORDING_BOUNDARIES_V2_1;

// Handed out by reference: frozen where defined (see deep-freeze.ts).
deepFreeze(WORDING_BOUNDARIES_V2_1);
