// =============================================================================
// ETBZ-49 - the shapes of the canonical visual contract.
//
// Hand-written; the VALUES beside them are generated. Keeping the types here
// rather than inferring them from the generated literals is deliberate: a typo
// in an asset would otherwise widen the type instead of failing the build.
// =============================================================================

/** Confluence 66650114 v2 section 2. Nineteen tokens, named individually so a missing one is a type error. */
export type CanonicalColorTokenName =
  | 'paper-000'
  | 'paper-100'
  | 'paper-200'
  | 'ink-900'
  | 'ink-600'
  | 'ink-400'
  | 'rule-200'
  | 'gold-500'
  | 'gold-700'
  | 'phase-wood-field'
  | 'phase-fire-field'
  | 'phase-earth-field'
  | 'phase-metal-field'
  | 'phase-water-field'
  | 'phase-wood-mark'
  | 'phase-fire-mark'
  | 'phase-earth-mark'
  | 'phase-metal-mark'
  | 'phase-water-mark';

export type AtmosphericColorTokenName =
  | 'atmos-wood'
  | 'atmos-fire'
  | 'atmos-earth'
  | 'atmos-metal'
  | 'atmos-water';

export type Phase = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export interface ColorToken<TName extends string = string> {
  readonly name: TName;
  readonly value: { readonly light: string; readonly dark: string };
  readonly usage: string;
}

export interface VisualSystemMeta {
  readonly source: string;
  readonly textFloorPt: number;
  readonly scaleLock: number;
  readonly orphanMinLines: number;
  readonly widowMinLines: number;
  readonly regionPolicy: string;
}

export interface TypeStyle {
  readonly name: string;
  readonly fontSize: string;
  readonly lineHeight: string;
  readonly fontWeight: number;
  readonly letterSpacing: string;
  readonly fontFamily: string;
  readonly textTransform?: string;
}

export interface SpacingToken {
  readonly name: string;
  readonly value: string;
  readonly usage: string;
}
export type RadiusToken = SpacingToken;
export type GeometryToken = SpacingToken;

export interface GeometryCentipoints {
  readonly pageW: number;
  readonly pageH: number;
  readonly marginTop: number;
  readonly marginSide: number;
  readonly marginBottom: number;
  readonly contentW: number;
  readonly contentH: number;
  readonly baseline: number;
  readonly gutter: number;
  readonly bodySizeCp: number;
  readonly bodyLeadingCp: number;
  readonly textFloorCp: number;
  readonly linesPerPage: number;
}

// --- glyphs -------------------------------------------------------------------

export type DisplayGlyphRole = 'heavenly_stem' | 'earthly_branch' | 'wu_xing';

export interface DisplayGlyph {
  readonly ordinal: number;
  readonly character: string;
  /** `U+XXXX`. The identity of the glyph; the set is closed over these. */
  readonly codepoint: string;
  readonly unicodeName: string;
  readonly slug: string;
  readonly pinyin: string;
  readonly role: DisplayGlyphRole;
  readonly phase: Phase;
  readonly polarity: 'yang' | 'yin' | null;
  readonly animalLabel: string | null;
  readonly sourceGlyphName: string;
  readonly asset: string;
  /** `[xMin, yMin, xMax, yMax]` in font units. */
  readonly bbox: readonly [number, number, number, number];
  readonly path: string;
  readonly sha256: string;
}

export interface DisplayGlyphManifestMeta {
  readonly manifestVersion: string;
  readonly assetFormatVersion: string;
  readonly role: string;
  readonly regionPolicy: string;
  readonly glyphCount: number;
  readonly emBox: readonly [number, number, number, number];
  readonly viewBox: readonly [number, number, number, number];
  readonly paddingUnits: number;
  readonly unitsPerEm: number;
  readonly inkPass: {
    readonly kind: string;
    readonly strokeUnits: number;
    readonly linejoin: string;
    readonly linecap: string;
    readonly paintOrder: string;
    readonly note: string;
  };
  readonly source: {
    readonly family: string;
    readonly postscriptName: string;
    readonly weight: number;
    readonly faceIndex: number;
    readonly version: string;
    readonly file: string;
    readonly fileSha256: string;
    readonly licence: string;
    readonly licenceFile: string;
    readonly upstream: string;
  };
  readonly visualTarget: {
    readonly donor: string;
    readonly status: string;
    readonly reason: string;
  };
  readonly manifestSha256: string;
}

// --- wordmark -----------------------------------------------------------------

export interface WordmarkContract {
  readonly asset: string;
  readonly text: string;
  readonly trackingEm: number;
  readonly pointDiameterCapRatio: number;
  readonly pointColour: string;
  readonly viewBox: readonly [number, number, number, number];
  readonly unitsPerEm: number;
  readonly capHeight: number;
  readonly source: Readonly<Record<string, string>>;
  readonly contract: {
    readonly static: boolean;
    readonly chartIndependent: boolean;
    readonly customerGlyphForbidden: boolean;
  };
  readonly sha256: string;
  readonly component: VisualComponentContract;
}

// --- pagination ---------------------------------------------------------------

export interface PaginationRules {
  readonly orphanMinLines: number;
  readonly widowMinLines: number;
  readonly keepWithNextLines: number;
  readonly atomic: readonly string[];
  readonly shrinkToFit: false;
  readonly clipping: false;
  readonly semanticShortening: false;
  readonly hyphenation: boolean;
  readonly justification: boolean;
  readonly minBandLines: number;
  readonly shortFinalPageRule: string;
}

export interface LongFormFixtureResult {
  readonly fixtureId: string;
  readonly surface: 'customer' | 'developer';
  readonly wordCount: number;
  readonly pages: number;
  readonly lines: number;
  readonly findings: readonly string[];
  readonly structuralSha256: string;
  readonly pageLineCounts: readonly number[];
  readonly pageTemplates: readonly string[];
}

// --- page family --------------------------------------------------------------

export interface SlotBinding {
  readonly slotId: string;
  /** The fact kinds this slot PLACES. An empty list means the slot carries no chart fact at all. */
  readonly consumedFactKinds: readonly string[];
  readonly fixture?: string;
  readonly derivedNothing?: boolean;
  /** `null` = no transform registered for this slot; a string names the registered one. */
  readonly presentationTransform?: string | null;
  /** Quantities this slot derives. Present only where it is the empty list - the point being that it is empty. */
  readonly derives?: readonly string[];
  /** The slot takes approved content-layer text rather than a chart fact. */
  readonly contentLayer?: boolean;
  readonly maxChars?: number;
  readonly personalised?: boolean;
  readonly relationEdges?: string;
  readonly cjkRole?: string;
  readonly visualType?: string;
  readonly contentClass?: string;
}

export interface PageContract {
  readonly page: number;
  readonly id: string;
  readonly family: string;
  readonly donors: {
    readonly primary: string;
    readonly secondary?: readonly string[];
  };
  readonly bindings: readonly SlotBinding[];
  readonly structuralSha256: string;
}

/** Component records are free-form documentation carried verbatim from the design system. */
export type VisualComponentContract = Readonly<Record<string, unknown>>;

export interface ConvergenceShares {
  readonly V1: number;
  readonly V2: number;
  readonly V3: number;
  readonly V4: number;
  readonly V5: number;
  readonly V6: number;
}

// --- runtime-consumable inputs ------------------------------------------------

/**
 * The scopes a phase colour may classify. Confluence 66650114 v2 section 7:
 * the Stem region carries the Stem phase, the Branch region the Branch phase,
 * each Hidden Stem its own. A pillar, a column or a page is NOT a scope - that
 * is the "whole-column phase tint" the hard exclusions forbid.
 */
export type PhaseRegionScope = 'stem' | 'branch' | 'hiddenStem';

export interface PhasePaint {
  readonly scope: PhaseRegionScope;
  readonly phase: Phase;
  readonly field: CanonicalColorTokenName;
  readonly mark: CanonicalColorTokenName;
}

/** The neutral treatment of the selected (Day) pillar. Selection is not a sixth phase. */
export interface PillarSelectionPaint {
  readonly container: 'paper-200';
  readonly edge: 'gold-500';
  readonly edgeWidthMm: number;
  readonly isPhase: false;
}

/** A supplied Wu Xing distribution. Counts arrive from the fact layer; nothing here derives them. */
export type WuXingVector = Readonly<Record<Phase, number>>;

export interface WuXingPresentation {
  readonly transformId: 'pt.linear-max-v1';
  readonly vector: WuXingVector;
  readonly max: number;
  /** Ratio per phase in `[0, 1]`, monotonic in the supplied count. Presentation only. */
  readonly ratio: Readonly<Record<Phase, number>>;
  /** Exactly the phases whose supplied count is zero, rendered as "0.0 in this distribution". */
  readonly zeroPhases: readonly Phase[];
}

/** A laid-out chapter handed back for validation. The renderer produces it; this layer judges it. */
export interface LongFormPlacement {
  readonly fixtureId: string;
  readonly wordCount: number;
  readonly pages: readonly {
    readonly pageNumber: number;
    readonly template: string;
    readonly lines: readonly string[];
  }[];
  readonly shrinkToFitApplied?: boolean;
  readonly clippedRegions?: readonly string[];
  readonly overlappingRegions?: readonly string[];
  readonly droppedWords?: readonly string[];
}
