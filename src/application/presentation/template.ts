// =============================================================================
// ETBZ-55 - the one template: `bazodiac-final-template@1.0.0`.
//
// The template is the ETBZ-49 Bazodiac Visual System v1 (Confluence 66650114
// v2, ETBZ-43) instantiated in German: its page family, geometry, tokens,
// display glyphs, wordmark and pagination rules, plus the declared set of
// interface labels below. There is exactly one template and no variant per
// customer; its identity is a structural hash over everything it consumes and
// is frozen in `RELEASED_TEMPLATE_HASHES` like the method registry and the
// skill contract bundle.
//
// The labels are the ONLY customer text the template itself contributes. Every
// label is one of three kinds:
//  - `lexicon`: a verbatim part of a released Lexicon term's German customer
//    wording (`lexiconTerm` names the term; a test proves the containment);
//  - `terminology`: the German name of one FuFirE enum value the chart carries
//    (`fufireValue` names it) for which Lexicon v1 has no wording - today only
//    the three Qi roles of a hidden stem (ADR 0012 limitation 5);
//  - `template`: a plain interface label that names a page, a column or a
//    presentation convention.
// Labels address the customer informally (du), in the register of the Lens
// reflection patterns and of the reading itself. None explains the classical
// system, none interprets a chart - the harness pages' English education copy
// is deliberately not carried over.
//
// The long-form typography (text styles, line tolerance, continuation column,
// CJK advance, the Inter advance tables) decides every line break, so it is
// part of the template identity too.
// =============================================================================

import {
  CANONICAL_DECISION_SOURCE,
  DESIGN_SYSTEM_VERSION,
  DISPLAY_GLYPH_MANIFEST,
  GEOMETRY_CENTIPOINTS,
  HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED,
  PAGE_FAMILY,
  PAGINATION_RULES,
  VISUAL_SYSTEM_NAME,
  VISUAL_SYSTEM_TOKEN_VERSION,
  WORDMARK,
} from '../visual/index.js';
import { structuralHash } from '../../domain/structural-hash.js';
import { PresentationError } from './errors.js';
import { FONT_METRICS } from './font-metrics.js';
import { CONTINUATION_COLUMN_CP, RUNNING_HEAD_CP } from './long-form.js';
import { CJK_IDEOGRAPH_ADVANCE_EM, LINE_TOLERANCE_CP, TEXT_STYLES } from './text-measure.js';
import type { TextStyle, TextStyleId } from './text-measure.js';

export const TEMPLATE_ID = 'bazodiac-final-template' as const;
export const TEMPLATE_VERSION = '1.0.0' as const;
export const TEMPLATE_REF = `${TEMPLATE_ID}@${TEMPLATE_VERSION}` as const;
export const TEMPLATE_LANGUAGE = 'de' as const;

export interface TemplateLabel {
  readonly text: string;
  /** `lexicon` - a verbatim part of `lexiconTerm`'s customerDe wording; `terminology` - the German name of `fufireValue`; `template` - an interface label. */
  readonly source: 'lexicon' | 'terminology' | 'template';
  readonly lexiconTerm?: string;
  readonly fufireValue?: string;
}

const lex = (text: string, lexiconTerm: string): TemplateLabel => ({ text, source: 'lexicon', lexiconTerm });
const term = (text: string, fufireValue: string): TemplateLabel => ({ text, source: 'terminology', fufireValue });
const ui = (text: string): TemplateLabel => ({ text, source: 'template' });

/**
 * The declared label set. Keys are stable ids; the renderer never prints a
 * label that is not in the projection, and the projection takes every label
 * from here.
 */
export const TEMPLATE_LABELS = {
  brand: ui('Bazodiac'),
  product: lex('BaZi-Reading', 'BaZi / 八字'),
  preparedFor: ui('Erstellt für'),
  tagChart: ui('Dein Chart'),
  tagGeneral: ui('Allgemein'),
  tagReading: ui('Dein Reading'),
  legendChart: ui('Werte deines Charts, so wie sie geliefert wurden.'),
  legendGeneral: ui('Für jede Ausgabe gleich und nicht auf dein Chart bezogen.'),
  legendReading: ui('Die Texte deines Readings.'),

  fourPillars: lex('Vier Säulen', 'Four Pillars / 四柱'),
  heavenlyStems: lex('Himmelsstämme', 'Heavenly Stems / 天干'),
  earthlyBranches: lex('Erdzweige', 'Earthly Branches / 地支'),
  hiddenStems: lex('Verborgene Stämme', 'Hidden Stems / 藏干'),
  dayMaster: lex('Tagesmeister', 'Day Master / 日主'),
  wuXing: lex('Wu Xing', 'Wu Xing / 五行'),
  fivePhases: lex('Fünf Wandlungsphasen', 'Wu Xing / 五行'),
  wuXingDistribution: lex('Verteilung der fünf Wandlungsphasen', 'Wu Xing distribution'),
  yang: lex('Yang', 'Yin / Yang polarity'),
  yin: lex('Yin', 'Yin / Yang polarity'),

  year: ui('Jahr'),
  month: ui('Monat'),
  day: ui('Tag'),
  hour: ui('Stunde'),
  stem: ui('Stamm'),
  branch: ui('Zweig'),
  phase: ui('Phase'),
  polarity: ui('Polarität'),
  dayPillar: ui('Tagessäule'),
  relation: ui('Beziehung zum Tagesmeister'),
  qiPrincipal: term('Haupt-Qi', 'natal.pillars[].hiddenStems[].qi = principal'),
  qiCentral: term('Mittleres Qi', 'natal.pillars[].hiddenStems[].qi = central'),
  qiResidual: term('Rest-Qi', 'natal.pillars[].hiddenStems[].qi = residual'),
  stems: ui('Stämme'),
  branches: ui('Zweige'),
  visibleStem: ui('Sichtbarer Stamm'),
  hiddenStem: ui('Verborgener Stamm'),
  visibleAndHiddenStem: ui('Sichtbar und verborgen'),
  notPresent: ui('Nicht vorhanden'),

  documentKicker: ui('Dieses Dokument'),
  documentTitle: ui('Über dieses Dokument'),
  basis: ui('Grundlage'),
  hourPillar: ui('Stundensäule'),
  hourPillarKnown: ui('bekannt'),
  script: ui('Schrift'),
  scriptSimplified: ui('Vereinfachtes Chinesisch'),
  chartValues: ui('Chart-Werte'),
  chartValuesSource: ui('Validierte Chart-Berechnung'),
  dataNote: ui('Datenhinweis'),
  dataNoteSeeMethod: ui('Siehe Methodenhinweis, Seite'),
  dataNoteText: ui('Zu diesem Chart liegt ein Datenhinweis der Chart-Berechnung vor.'),

  contents: ui('Inhalt'),
  contentsKicker: ui('Das Reading'),
  sectionFront: ui('Vorspann'),
  sectionChart: ui('Chart-Grundlage'),
  sectionReading: ui('Reading'),
  sectionClosing: ui('Reflexion und Abschluss'),
  cover: ui('Titel'),

  glanceTitle: ui('Dein Chart auf einen Blick'),
  foundationTitle: ui('Die acht Zeichen'),
  tenGodsTitle: ui('Beziehungen zum Tagesmeister'),
  reflectionTitle: ui('Fragen zur Reflexion'),
  reflectionCharacters: ui('Deine acht Zeichen'),
  summaryTitle: ui('Dein Chart in Kürze'),
  closingKicker: ui('Abschluss'),
  methodNoteTitle: ui('Methodenhinweis'),

  chapter: ui('Kapitel'),
  continued: ui('Fortsetzung'),
  chapterReference: ui('Bezug'),
  terms: ui('Begriffe'),

  wuXingValuesAsSupplied: ui('Werte wie geliefert. Kreisgröße und Balkenlänge zeigen jeden Wert im Verhältnis zum größten Wert.'),
  wuXingZeroIsZero: ui('Eine 0 bedeutet 0 in dieser Verteilung.'),
} as const satisfies Readonly<Record<string, TemplateLabel>>;

export type TemplateLabelId = keyof typeof TEMPLATE_LABELS;

export function label(id: TemplateLabelId): string {
  return TEMPLATE_LABELS[id].text;
}

export interface TemplateBinding {
  readonly ref: typeof TEMPLATE_REF;
  readonly language: typeof TEMPLATE_LANGUAGE;
  readonly designSystem: Readonly<{ name: string; version: string; tokenVersion: number }>;
  readonly decisionSource: Readonly<{ system: string; pageId: string; version: string }>;
  readonly pageFamily: readonly Readonly<{ page: number; id: string; structuralSha256: string }>[];
  readonly glyphManifestSha256: string;
  readonly wordmarkSha256: string;
  readonly geometry: typeof GEOMETRY_CENTIPOINTS;
  readonly paginationRules: typeof PAGINATION_RULES;
  readonly labels: typeof TEMPLATE_LABELS;
  readonly typography: Readonly<{
    textStyles: Readonly<Record<TextStyleId, TextStyle>>;
    lineToleranceCp: number;
    runningHeadCp: number;
    continuationColumnCp: number;
    cjkIdeographAdvanceEm: number;
    fontMetricsStructuralHash: string;
  }>;
  /** The build-time record of the glyph-style decision (ETBZ-49 ADR 0009 limitation 3), carried as-is. */
  readonly glyphStyleApprovalRecord: typeof HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED;
  readonly structuralHash: string;
}

/** The template binding, assembled from the visual contract. Pure; the same on every call. */
export function templateBinding(): TemplateBinding {
  const core = {
    ref: TEMPLATE_REF,
    language: TEMPLATE_LANGUAGE,
    designSystem: { name: VISUAL_SYSTEM_NAME, version: DESIGN_SYSTEM_VERSION, tokenVersion: VISUAL_SYSTEM_TOKEN_VERSION },
    decisionSource: {
      system: CANONICAL_DECISION_SOURCE.system,
      pageId: CANONICAL_DECISION_SOURCE.pageId,
      version: CANONICAL_DECISION_SOURCE.version,
    },
    pageFamily: PAGE_FAMILY.map((page) => ({ page: page.page, id: page.id, structuralSha256: page.structuralSha256 })),
    glyphManifestSha256: DISPLAY_GLYPH_MANIFEST.manifestSha256,
    wordmarkSha256: WORDMARK.sha256,
    geometry: GEOMETRY_CENTIPOINTS,
    paginationRules: PAGINATION_RULES,
    labels: TEMPLATE_LABELS,
    typography: {
      textStyles: TEXT_STYLES,
      lineToleranceCp: LINE_TOLERANCE_CP,
      runningHeadCp: RUNNING_HEAD_CP,
      continuationColumnCp: CONTINUATION_COLUMN_CP,
      cjkIdeographAdvanceEm: CJK_IDEOGRAPH_ADVANCE_EM,
      fontMetricsStructuralHash: structuralHash(FONT_METRICS),
    },
    glyphStyleApprovalRecord: HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED,
  };
  return { ...core, structuralHash: structuralHash(core) };
}

/**
 * The released template identities. A change to any consumed contract value or
 * to a label is a new template version, never an edit of this one.
 */
export const RELEASED_TEMPLATE_HASHES: Readonly<Record<string, string>> = {
  '1.0.0': 'sha256:d595ab7cccdf9f99fe23d03fa7789366a2d3951f130aa6eabee626489c2562d6',
};

export function assertReleasedTemplate(binding: TemplateBinding): void {
  const released = RELEASED_TEMPLATE_HASHES[TEMPLATE_VERSION];
  if (released !== binding.structuralHash) {
    throw new PresentationError('PRESENTATION_INPUT_INVALID', `template ${TEMPLATE_REF} does not hash to its released identity`, {
      expected: released ?? null,
      actual: binding.structuralHash,
    });
  }
}
