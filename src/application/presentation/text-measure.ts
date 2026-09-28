// =============================================================================
// ETBZ-55 - measuring and wrapping a line in integer centipoints.
//
// Port of the ETBZ-49 canonical paginator's measurer
// (tools/visual-proof-harness/build/paginate.py `text_width` / `wrap`), with one
// deliberate difference: a character the pinned face does not carry is refused
// (`PRESENTATION_TEXT_UNMEASURABLE`) instead of being measured as '?'. A CJK
// ideograph inside Latin text is set in the informational CJK face, whose
// ideographs are all one em wide; the renderer's QA re-proves that advance on
// the pinned Noto Sans CJK SC face before it renders a page.
//
// Kerning and ligatures are off on both sides: the renderer sets every line with
// `font-kerning: none` and ligatures disabled, so the width measured here is the
// width set there, up to the tolerance a line keeps free.
// =============================================================================

import { GEOMETRY_CENTIPOINTS } from '../visual/index.js';
import { FONT_METRICS } from './font-metrics.js';
import type { FaceId } from './font-metrics.js';
import { PresentationError } from './errors.js';

/** One baseline step - 5 mm - in centipoints. */
export const BASELINE_CP = GEOMETRY_CENTIPOINTS.baseline;
/** Kept free at the end of every line so a renderer's rounding never widens it past its measure. */
export const LINE_TOLERANCE_CP = 300;
/** Every CJK ideograph of the informational face is one em wide. */
export const CJK_IDEOGRAPH_ADVANCE_EM = 1;

export type TextStyleId = 'kicker' | 'sectionTitle' | 'standfirst' | 'subhead' | 'body' | 'pullQuote' | 'panelTitle' | 'panelBody';

export interface TextStyle {
  readonly face: FaceId;
  /** Font size in centipoints (1050 = 10.5 pt). */
  readonly sizeCp: number;
  readonly leadingCp: number;
  /** Letter spacing in em, applied after every character (CSS `letter-spacing`). */
  readonly trackingEm: number;
}

/** The long-form styles of the ETBZ-49 paginator, unchanged. */
export const TEXT_STYLES: Readonly<Record<TextStyleId, TextStyle>> = {
  kicker: { face: 'medium', sizeCp: 900, leadingCp: BASELINE_CP, trackingEm: 0.16 },
  sectionTitle: { face: 'displayLight', sizeCp: 2600, leadingCp: 2 * BASELINE_CP, trackingEm: -0.015 },
  standfirst: { face: 'regular', sizeCp: 1250, leadingCp: 1700, trackingEm: 0 },
  subhead: { face: 'medium', sizeCp: 1300, leadingCp: BASELINE_CP, trackingEm: -0.005 },
  body: { face: 'regular', sizeCp: 1050, leadingCp: BASELINE_CP, trackingEm: 0 },
  pullQuote: { face: 'displayLight', sizeCp: 1500, leadingCp: 2000, trackingEm: -0.01 },
  panelTitle: { face: 'medium', sizeCp: 900, leadingCp: 1200, trackingEm: 0.16 },
  panelBody: { face: 'regular', sizeCp: 950, leadingCp: 1350, trackingEm: 0 },
};

/**
 * Python's `round()` - nearest integer, ties to even. The canonical paginator
 * is Python; reproducing its rounding is what lets the port be proven against
 * the layout the ETBZ-49 build measured, line for line.
 */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const difference = value - floor;
  if (difference > 0.5) return floor + 1;
  if (difference < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

const advanceTables = new Map<FaceId, ReadonlyMap<number, number>>();

function advancesOf(face: FaceId): ReadonlyMap<number, number> {
  const cached = advanceTables.get(face);
  if (cached !== undefined) return cached;
  const table = new Map<number, number>();
  for (const [first, advances] of FONT_METRICS[face].advanceRuns) {
    advances.forEach((advance, index) => table.set(first + index, advance));
  }
  advanceTables.set(face, table);
  return table;
}

/** CJK Unified Ideographs and Extension A - the characters the informational face sets in running text. */
export function isCjkIdeograph(codepoint: number): boolean {
  return (codepoint >= 0x4e00 && codepoint <= 0x9fff) || (codepoint >= 0x3400 && codepoint <= 0x4dbf);
}

/** Width of `text` in centipoints, rounded once at the end (paginate.py `text_width`). */
export function textWidth(text: string, styleId: TextStyleId): number {
  const style = TEXT_STYLES[styleId];
  const metrics = FONT_METRICS[style.face];
  const table = advancesOf(style.face);
  let units = 0;
  let characters = 0;
  for (const character of text) {
    const codepoint = character.codePointAt(0) ?? 0;
    characters += 1;
    const advance = table.get(codepoint);
    if (advance !== undefined) {
      units += advance;
      continue;
    }
    if (isCjkIdeograph(codepoint)) {
      units += CJK_IDEOGRAPH_ADVANCE_EM * metrics.unitsPerEm;
      continue;
    }
    throw new PresentationError(
      'PRESENTATION_TEXT_UNMEASURABLE',
      `U+${codepoint.toString(16).toUpperCase().padStart(4, '0')} is not in the pinned ${metrics.family} ${String(metrics.weight)} tables and is not a CJK ideograph`,
      { codepoint: `U+${codepoint.toString(16).toUpperCase().padStart(4, '0')}`, face: style.face },
    );
  }
  return roundHalfEven((units * style.sizeCp) / metrics.unitsPerEm + style.trackingEm * style.sizeCp * characters);
}

/**
 * Greedy line breaking on single spaces (paginate.py `wrap`). A word wider than
 * the measure is refused: there is no hyphenation and no shrinking.
 */
export function wrap(text: string, styleId: TextStyleId, measureCp: number): readonly string[] {
  const limit = measureCp - LINE_TOLERANCE_CP;
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (textWidth(candidate, styleId) <= limit) {
      current = candidate;
      continue;
    }
    if (current !== '') lines.push(current);
    if (textWidth(word, styleId) > limit) {
      throw new PresentationError('PRESENTATION_WORD_EXCEEDS_MEASURE', `a word is wider than its ${String(measureCp)} cp measure`, {
        word,
        measureCp,
        styleId,
      });
    }
    current = word;
  }
  if (current !== '') lines.push(current);
  return lines;
}

/** Distance from a line box's top to its baseline (paginate.py `first_baseline`). */
export function firstBaseline(styleId: TextStyleId): number {
  const style = TEXT_STYLES[styleId];
  const metrics = FONT_METRICS[style.face];
  const ascent = roundHalfEven((metrics.ascender * style.sizeCp) / metrics.unitsPerEm);
  const descent = roundHalfEven((Math.abs(metrics.descender) * style.sizeCp) / metrics.unitsPerEm);
  return ascent + roundHalfEven((style.leadingCp - ascent - descent) / 2);
}

/** Ascent of a style in centipoints - the renderer positions a line box at `baseline - ascent`. */
export function ascentOf(styleId: TextStyleId): number {
  const style = TEXT_STYLES[styleId];
  const metrics = FONT_METRICS[style.face];
  return roundHalfEven((metrics.ascender * style.sizeCp) / metrics.unitsPerEm);
}

export function ceilToBaseline(valueCp: number): number {
  return Math.ceil(valueCp / BASELINE_CP) * BASELINE_CP;
}
