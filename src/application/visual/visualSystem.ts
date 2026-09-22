// =============================================================================
// ETBZ-49 - the visual system as a set of refusals.
//
// This module resolves the canonical contract and, more importantly, declines
// the things Confluence 66650114 v2 excludes. It deliberately does NOT render:
// no page, no PDF, no layout engine. It answers "is this allowed, and what
// exactly does the contract say" for a renderer that lives elsewhere (ETBZ-55).
//
// Three properties hold for every function here:
//
//   * pure       - no filesystem, no clock, no randomness, no network;
//   * total      - either a value or a named VisualContractError, never silence;
//   * derives nothing - a BaZi fact goes in and comes back out unchanged.
//
// The one computation present is the Wu Xing PRESENTATION transform, which
// Confluence section 9 explicitly permits: a documented, deterministic,
// monotonic mapping from a supplied count to a bar length. It cannot change the
// count, and `presentWuXing` returns the untouched vector beside the ratios so
// that is checkable rather than asserted.
// =============================================================================

import { z } from 'zod';
import { VisualContractError } from './errors.js';
import { DISPLAY_GLYPH_MANIFEST, DISPLAY_GLYPH_SET } from './glyphs.js';
import { CUSTOMER_SURFACE_FORBIDDEN, PAGE_FAMILY, VISUAL_COMPONENTS } from './pageFamily.js';
import {
  LONG_FORM_PAGE_BUDGET,
  LONG_FORM_WORD_BUDGET,
  PAGINATION_RULES,
} from './pagination.js';
import { ATMOSPHERIC_COLOR_TOKENS, CANONICAL_COLOR_TOKENS } from './tokens.js';
import type {
  AtmosphericColorTokenName,
  CanonicalColorTokenName,
  DisplayGlyph,
  LongFormPlacement,
  Phase,
  PhasePaint,
  PhaseRegionScope,
  PillarSelectionPaint,
  SlotBinding,
  VisualComponentContract,
  WuXingPresentation,
  WuXingVector,
} from './types.js';

export const PHASES: readonly Phase[] = ['wood', 'fire', 'earth', 'metal', 'water'] as const;

const GLYPH_BY_CODEPOINT = new Map(DISPLAY_GLYPH_SET.map((glyph) => [glyph.codepoint, glyph]));
const GLYPH_BY_CHARACTER = new Map(DISPLAY_GLYPH_SET.map((glyph) => [glyph.character, glyph]));

// --- colour -------------------------------------------------------------------

const CANONICAL_BY_NAME = new Map(CANONICAL_COLOR_TOKENS.map((token) => [token.name, token]));
const ATMOSPHERIC_BY_NAME = new Map(ATMOSPHERIC_COLOR_TOKENS.map((token) => [token.name, token]));

export type ColorTheme = 'light' | 'dark';

/** The hex value of a canonical token. Unknown names are a type error, not a runtime fallback. */
export function canonicalColor(
  name: CanonicalColorTokenName,
  theme: ColorTheme = 'light',
): string {
  const token = CANONICAL_BY_NAME.get(name);
  /* c8 ignore next 6 -- unreachable while the name type and the asset agree; the
     contract test proves they do, and this keeps the function total if they ever stop. */
  if (token === undefined) {
    throw new VisualContractError('UNKNOWN_VISUAL_TYPE', `no canonical colour token "${name}"`, {
      name,
    });
  }
  return token.value[theme];
}

export function atmosphericColor(
  name: AtmosphericColorTokenName,
  theme: ColorTheme = 'light',
): string {
  const token = ATMOSPHERIC_BY_NAME.get(name);
  /* c8 ignore next 5 */
  if (token === undefined) {
    throw new VisualContractError('UNKNOWN_VISUAL_TYPE', `no atmospheric token "${name}"`, { name });
  }
  return token.value[theme];
}

// --- display glyphs -----------------------------------------------------------

/**
 * The twenty-seven-asset set is closed. A codepoint outside it is not a missing
 * asset to fall back from - it is a request that belongs to the other CJK
 * contract, so it fails rather than silently rendering in a text face.
 */
export function resolveDisplayGlyph(codepointOrCharacter: string): DisplayGlyph {
  const glyph =
    GLYPH_BY_CODEPOINT.get(codepointOrCharacter) ??
    GLYPH_BY_CHARACTER.get(codepointOrCharacter);
  if (glyph === undefined) {
    throw new VisualContractError(
      'DISPLAY_GLYPH_OUT_OF_CONTRACT',
      `"${codepointOrCharacter}" is not one of the ${DISPLAY_GLYPH_SET.length} BazodiacDisplayGlyphSet assets; ` +
        'arbitrary Chinese text belongs to InformationalCjkText',
      { requested: codepointOrCharacter },
    );
  }
  return glyph;
}

export function hasDisplayGlyph(codepointOrCharacter: string): boolean {
  return (
    GLYPH_BY_CODEPOINT.has(codepointOrCharacter) || GLYPH_BY_CHARACTER.has(codepointOrCharacter)
  );
}

/**
 * Structural integrity of one asset: a usable outline that stays inside the
 * common box. Byte integrity (the SHA-256 of the SVG file) is proven by the
 * contract test, which may read the filesystem; this layer may not.
 */
export function assertDisplayGlyphIntegrity(glyph: DisplayGlyph): void {
  if (glyph.path.trim() === '' || !glyph.path.trimStart().startsWith('M')) {
    throw new VisualContractError(
      'DISPLAY_GLYPH_MALFORMED',
      `glyph ${glyph.codepoint} (${glyph.slug}) carries no usable outline`,
      { codepoint: glyph.codepoint, pathLength: glyph.path.length },
    );
  }

  // The ink pass strokes the outline, so the painted extent is the bbox grown by
  // half the stroke width on every side. Testing the bare bbox would call a
  // glyph safe whose stroke is already over the edge; this is the same rule the
  // extractor applies (`inside()` in tools/visual-proof-harness/build/extract_glyphs.py),
  // margin and strict inequality included.
  const [vx, vy, vw, vh] = DISPLAY_GLYPH_MANIFEST.viewBox;
  const [xMin, yMin, xMax, yMax] = glyph.bbox;
  const margin = DISPLAY_GLYPH_MANIFEST.inkPass.strokeUnits / 2;
  const inside =
    xMin - margin > vx &&
    yMin - margin > vy &&
    xMax + margin < vx + vw &&
    yMax + margin < vy + vh &&
    xMax > xMin &&
    yMax > yMin;
  if (!inside) {
    throw new VisualContractError(
      'DISPLAY_GLYPH_CLIPPED',
      `glyph ${glyph.codepoint} (${glyph.slug}) leaves the common box and would be cut off`,
      {
        codepoint: glyph.codepoint,
        bbox: glyph.bbox,
        viewBox: DISPLAY_GLYPH_MANIFEST.viewBox,
        inkMargin: margin,
      },
    );
  }
}

// --- phase colour, region-scoped ----------------------------------------------

const PHASE_SCOPES: readonly PhaseRegionScope[] = ['stem', 'branch', 'hiddenStem'] as const;

/**
 * A phase classifies exactly one fact-bearing region. The refusal here is the
 * "whole-column phase tint" of the hard exclusions: tinting a pillar, a column
 * or a page asserts that every fact inside it shares that phase, which is false
 * the moment a Stem and its Branch differ.
 */
export function resolvePhasePaint(scope: string, phase: Phase): PhasePaint {
  if (!(PHASE_SCOPES as readonly string[]).includes(scope)) {
    throw new VisualContractError(
      'PHASE_SCOPE_OUT_OF_CONTRACT',
      `a phase colour may classify ${PHASE_SCOPES.join(', ')} - never "${scope}"`,
      { scope, allowed: PHASE_SCOPES },
    );
  }
  if (!PHASES.includes(phase)) {
    throw new VisualContractError('UNKNOWN_VISUAL_TYPE', `"${phase}" is not one of the five phases`, {
      phase,
    });
  }
  return {
    scope: scope as PhaseRegionScope,
    phase,
    field: `phase-${phase}-field` as CanonicalColorTokenName,
    mark: `phase-${phase}-mark` as CanonicalColorTokenName,
  };
}

/**
 * The selected (Day) pillar. Neutral ground plus a restrained gold edge:
 * selection is a state, not a sixth phase, so it never reaches for a phase
 * token.
 */
export function resolvePillarSelectionPaint(): PillarSelectionPaint {
  return { container: 'paper-200', edge: 'gold-500', edgeWidthMm: 0.35, isPhase: false };
}

export interface PillarFacts {
  readonly position: 'year' | 'month' | 'day' | 'hour';
  readonly stemPhase: Phase;
  readonly branchPhase: Phase;
  readonly hiddenStemPhases: readonly Phase[];
  readonly isDayMaster: boolean;
}

export interface PillarPaint {
  readonly position: PillarFacts['position'];
  readonly container: CanonicalColorTokenName;
  readonly selection: PillarSelectionPaint | null;
  readonly regions: readonly PhasePaint[];
}

/**
 * Four Pillars colour, region by region. The container itself is always neutral
 * - `paper-100`, or `paper-200` when selected - so no phase ever spans a whole
 * pillar.
 */
export function resolvePillarPaint(pillar: PillarFacts): PillarPaint {
  const regions: PhasePaint[] = [
    resolvePhasePaint('stem', pillar.stemPhase),
    resolvePhasePaint('branch', pillar.branchPhase),
    ...pillar.hiddenStemPhases.map((phase) => resolvePhasePaint('hiddenStem', phase)),
  ];
  return {
    position: pillar.position,
    container: pillar.isDayMaster ? 'paper-200' : 'paper-100',
    selection: pillar.isDayMaster ? resolvePillarSelectionPaint() : null,
    regions,
  };
}

// --- Wu Xing ------------------------------------------------------------------

/** Names a caller would use if it were handing over a derived quantity rather than a count. */
const DERIVED_WU_XING_KEYS = [
  'dominant',
  'dominance',
  'strength',
  'strengths',
  'balance',
  'balanced',
  'deficiency',
  'deficient',
  'excess',
  'weighted',
  'weights',
  'normalized',
  'normalised',
  'score',
  'scores',
  'percent',
  'percentage',
  'favourable',
  'favorable',
  'useful_god',
  'usefulGod',
  'shengKe',
  'sheng_ke',
] as const;

const WU_XING_COUNT = z.number().int().nonnegative().finite();

const WuXingVectorSchema = z
  .object({
    wood: WU_XING_COUNT,
    fire: WU_XING_COUNT,
    earth: WU_XING_COUNT,
    metal: WU_XING_COUNT,
    water: WU_XING_COUNT,
  })
  .strict();

/**
 * A supplied distribution, accepted verbatim or refused. The design side never
 * computes, weights or re-balances a Wu Xing vector - Confluence section 9 -
 * so an input that carries a DERIVED quantity is rejected under its own code
 * rather than being quietly ignored by a permissive parse.
 */
export function acceptWuXingVector(supplied: unknown): WuXingVector {
  if (typeof supplied !== 'object' || supplied === null || Array.isArray(supplied)) {
    throw new VisualContractError(
      'WU_XING_VECTOR_INVALID',
      'a Wu Xing distribution is an object of five non-negative integer counts',
      { received: supplied === null ? 'null' : typeof supplied },
    );
  }

  const derived = Object.keys(supplied).filter((key) =>
    (DERIVED_WU_XING_KEYS as readonly string[]).includes(key),
  );
  if (derived.length > 0) {
    throw new VisualContractError(
      'WU_XING_RECOMPUTATION_REFUSED',
      `the visual system renders supplied counts and derives nothing; refused: ${derived.join(', ')}`,
      { derivedKeys: derived },
    );
  }

  const parsed = WuXingVectorSchema.safeParse(supplied);
  if (!parsed.success) {
    throw new VisualContractError(
      'WU_XING_VECTOR_INVALID',
      'exactly the five phases, each a non-negative integer count',
      { issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.code}`) },
    );
  }
  return parsed.data;
}

/**
 * `pt.linear-max-v1` - the registered presentation transform. It maps a count to
 * a ratio of the largest count, which is monotonic and loses nothing: the
 * untouched vector travels alongside so a consumer can print the real numbers.
 *
 * Zero means zero in THIS distribution and nothing else. It is never a
 * deficiency, so it is reported as a phase to label rather than a phase to hide.
 */
export function presentWuXing(supplied: unknown): WuXingPresentation {
  const vector = acceptWuXingVector(supplied);
  const counts = PHASES.map((phase) => vector[phase]);
  const max = Math.max(...counts);
  const ratio = Object.fromEntries(
    PHASES.map((phase) => [phase, max === 0 ? 0 : vector[phase] / max]),
  ) as Record<Phase, number>;

  return {
    transformId: 'pt.linear-max-v1',
    vector,
    max,
    ratio,
    zeroPhases: PHASES.filter((phase) => vector[phase] === 0),
  };
}

/**
 * Sheng/Ke has no customer graphic in the MVP. Confluence section 10 and the
 * hard exclusions both say so, and there is no canonical deterministic mapping
 * to draw one from - which is exactly why this is a refusal and not a TODO.
 */
export function resolveShengKeRelation(from: Phase, to: Phase): never {
  throw new VisualContractError(
    'SHENG_KE_NOT_SUPPORTED',
    'no general Sheng/Ke relation graphic exists in the MVP visual contract',
    { from, to },
  );
}

// --- components and slots -----------------------------------------------------

export function resolveVisualComponent(id: string): VisualComponentContract {
  const component = Object.prototype.hasOwnProperty.call(VISUAL_COMPONENTS, id)
    ? VISUAL_COMPONENTS[id]
    : undefined;
  if (component === undefined) {
    throw new VisualContractError(
      'UNKNOWN_VISUAL_TYPE',
      `"${id}" is not a component of the canonical visual system`,
      { requested: id, known: Object.keys(VISUAL_COMPONENTS) },
    );
  }
  return component;
}

const SLOT_INDEX = new Map<string, { readonly pageId: string; readonly binding: SlotBinding }>(
  PAGE_FAMILY.flatMap((page) =>
    page.bindings.map(
      (binding) => [binding.slotId, { pageId: page.id, binding }] as const,
    ),
  ),
);

export interface ResolvedSlot {
  readonly pageId: string;
  readonly binding: SlotBinding;
}

export function resolveSlot(slotId: string): ResolvedSlot {
  const found = SLOT_INDEX.get(slotId);
  if (found === undefined) {
    throw new VisualContractError('UNKNOWN_SLOT', `no page declares a slot "${slotId}"`, {
      requested: slotId,
      known: [...SLOT_INDEX.keys()],
    });
  }
  return found;
}

export function listSlotIds(): readonly string[] {
  return [...SLOT_INDEX.keys()];
}

// --- the customer surface -----------------------------------------------------

/**
 * Evidence chrome that must never reach a customer page. The patterns match the
 * SHAPE of engineering output, not a blocklist of known strings, so a new rule
 * id or a new fixture name is caught without anyone remembering to add it.
 */
const EVIDENCE_CHROME_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'hash', pattern: /\bsha256[:=]|\b[0-9a-f]{40,}\b/i },
  { label: 'blocked state', pattern: /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/ },
  { label: 'rule id', pattern: /\bpt\.[a-z0-9-]+-v\d+\b/i },
  { label: 'fixture label', pattern: /\bfixture\b/i },
  { label: 'slot chrome', pattern: /\bINTERPRETIVE SLOT\b|\bMAX \d+ CHARS\b|\bslotId\b/i },
  { label: 'sample chrome', pattern: /\bSAMPLE(?:\s*·\s*NOT CUSTOMER DATA|\s+DATA)\b/i },
];

export interface CustomerSurfaceFinding {
  readonly label: string;
  readonly match: string;
}

export function findEvidenceChrome(text: string): readonly CustomerSurfaceFinding[] {
  const findings: CustomerSurfaceFinding[] = [];
  for (const { label, pattern } of EVIDENCE_CHROME_PATTERNS) {
    const match = pattern.exec(text);
    if (match !== null) findings.push({ label, match: match[0] });
  }
  return findings;
}

export function assertCustomerSurfaceClean(text: string): void {
  const findings = findEvidenceChrome(text);
  if (findings.length > 0) {
    throw new VisualContractError(
      'EVIDENCE_CHROME_IN_CUSTOMER_SURFACE',
      `the customer surface carries ${findings.map((f) => f.label).join(', ')}`,
      { findings, forbidden: CUSTOMER_SURFACE_FORBIDDEN },
    );
  }
}

// --- long form ----------------------------------------------------------------

const WORD_PATTERN = /[^\s]+/g;

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

/**
 * Judges a laid-out chapter the renderer handed back. Every check is a refusal
 * the design contract already states; none of them repairs anything, because a
 * layout that needs repairing is the defect.
 */
export function validateLongFormPlacement(placement: LongFormPlacement): void {
  if (
    placement.wordCount < LONG_FORM_WORD_BUDGET.min ||
    placement.wordCount > LONG_FORM_WORD_BUDGET.max
  ) {
    throw new VisualContractError(
      'LONG_FORM_BUDGET_OUT_OF_CONTRACT',
      `a chapter is ${LONG_FORM_WORD_BUDGET.min}-${LONG_FORM_WORD_BUDGET.max} words; got ${placement.wordCount}`,
      { wordCount: placement.wordCount, budget: LONG_FORM_WORD_BUDGET },
    );
  }
  if (
    placement.pages.length < LONG_FORM_PAGE_BUDGET.min ||
    placement.pages.length > LONG_FORM_PAGE_BUDGET.max
  ) {
    throw new VisualContractError(
      'LONG_FORM_BUDGET_OUT_OF_CONTRACT',
      `a chapter occupies ${LONG_FORM_PAGE_BUDGET.min}-${LONG_FORM_PAGE_BUDGET.max} pages; got ${placement.pages.length}`,
      { pages: placement.pages.length, budget: LONG_FORM_PAGE_BUDGET },
    );
  }
  if (placement.shrinkToFitApplied === true) {
    throw new VisualContractError(
      'SHRINK_TO_FIT_REFUSED',
      `the type scale is locked at ${PAGINATION_RULES.shrinkToFit === false ? '1.0' : 'n/a'}; content flows, it does not shrink`,
      { fixtureId: placement.fixtureId },
    );
  }
  if ((placement.clippedRegions?.length ?? 0) > 0) {
    throw new VisualContractError(
      'CLIPPING_REFUSED',
      `content was cut off in ${placement.clippedRegions?.join(', ')}`,
      { clippedRegions: placement.clippedRegions },
    );
  }
  if ((placement.overlappingRegions?.length ?? 0) > 0) {
    throw new VisualContractError(
      'OVERLAP_REFUSED',
      `regions overlap: ${placement.overlappingRegions?.join(', ')}`,
      { overlappingRegions: placement.overlappingRegions },
    );
  }
  if ((placement.droppedWords?.length ?? 0) > 0) {
    throw new VisualContractError(
      'SEMANTIC_TRUNCATION_REFUSED',
      `${placement.droppedWords?.length} word(s) were dropped to make the text fit`,
      { droppedWords: placement.droppedWords },
    );
  }

  for (const page of placement.pages) {
    if (page.lines.length > 0 && page.lines.length < PAGINATION_RULES.orphanMinLines) {
      throw new VisualContractError(
        'LONG_FORM_BUDGET_OUT_OF_CONTRACT',
        `page ${page.pageNumber} carries ${page.lines.length} line(s); the orphan/widow minimum is ${PAGINATION_RULES.orphanMinLines}`,
        { pageNumber: page.pageNumber, lines: page.lines.length },
      );
    }
  }
}

/**
 * Every word of the source, in order, present in the placed lines. This is the
 * check that catches a silent deletion: a layout can satisfy every geometric
 * rule above and still have quietly lost a sentence.
 */
export function assertEveryWordPlaced(source: string, placement: LongFormPlacement): void {
  const sourceWords = source.match(WORD_PATTERN) ?? [];
  const placedWords = placement.pages
    .flatMap((page) => page.lines)
    .join(' ')
    .match(WORD_PATTERN) ?? [];

  if (sourceWords.length !== placedWords.length) {
    throw new VisualContractError(
      'SEMANTIC_TRUNCATION_REFUSED',
      `the source carries ${sourceWords.length} words, the layout placed ${placedWords.length}`,
      { sourceWords: sourceWords.length, placedWords: placedWords.length },
    );
  }
  for (let index = 0; index < sourceWords.length; index += 1) {
    if (sourceWords[index] !== placedWords[index]) {
      throw new VisualContractError(
        'SEMANTIC_TRUNCATION_REFUSED',
        `word ${index + 1} of the layout is "${placedWords[index]}", the source says "${sourceWords[index]}"`,
        { index, expected: sourceWords[index], actual: placedWords[index] },
      );
    }
  }
}
