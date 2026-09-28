// =============================================================================
// ETBZ-49 - the committed type faces, resolved or refused.
//
// The visual system ships five Inter binaries (`FONT_FACES`) and names its type
// families (`TYPE_FAMILIES`). A renderer that asks for a face outside that set -
// an unknown family, or a weight no committed binary carries - is refused under
// its own code rather than handed a browser fallback. "Unknown font" is a
// required negative path of ETBZ-49 (AC 3: no unknown fallback as final), and a
// silent substitute would move every metric the pagination proof was measured
// against.
//
// Informational CJK text is the one deliberate exception and is named as such:
// `TYPE_FAMILIES['cjk-text']` is a family chain the harness resolves on the host
// (Confluence 66650114 v2 section 3, `InformationalCjkText`). This resolver does
// not pretend to own it; it answers only for the committed binaries.
// =============================================================================

import { VisualContractError } from './errors.js';
import { FONT_FACES } from './tokens.js';

export type FontFace = (typeof FONT_FACES)[number];

/** True when a committed binary carries exactly this family and CSS weight. */
export function hasFontFace(family: string, weight: string | number): boolean {
  const wanted = String(weight);
  return FONT_FACES.some(
    (candidate) => candidate.family === family && candidate.weight === wanted,
  );
}

/**
 * Resolves a committed face by family and CSS weight, or refuses. The refusal
 * names what was asked for and what is committed; it never picks "the closest"
 * face, because closeness is exactly the judgement a fallback makes silently.
 */
export function resolveFontFace(family: string, weight: string | number): FontFace {
  const wanted = String(weight);
  const face = FONT_FACES.find(
    (candidate) => candidate.family === family && candidate.weight === wanted,
  );
  if (face === undefined) {
    throw new VisualContractError(
      'UNKNOWN_FONT',
      'only a committed face may be rendered; no fallback face is substituted',
      {
        family,
        weight: wanted,
        committed: FONT_FACES.map((candidate) => `${candidate.family} ${candidate.weight}`),
      },
    );
  }
  return face;
}
