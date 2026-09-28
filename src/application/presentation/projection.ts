// =============================================================================
// ETBZ-55 - the PresentationProjection.
//
// `buildPresentationProjection({ model, content })` turns the validated chart
// (the `HoroscopeModel`, FuFirE-owned symbolic truth) and a presentation-ready
// text payload into the complete, paginated page model of the one template.
// Every value a page shows is taken from the chart, from the released Lexicon,
// from the glyph contract, from the payload or from the template's declared
// labels. Each page carries exactly the strings it prints (`strings`) - the
// renderer must print that set, no more and no less - and `customerStrings` is
// their union. The renderer places and draws; it decides nothing.
//
// Fail-closed at every binding:
//  - an unknown or provisional birth time is refused (the template defines no
//    unknown-time rendering, so nothing is guessed);
//  - a glyph outside the 27 is refused by the visual contract;
//  - a chart value that two sources state differently is refused
//    (`PRESENTATION_FACT_MISMATCH`) - the chart against the glyph contract, the
//    BaZi answer against the natal answer, the Sizhu table against the glyph
//    contract;
//  - a Ten-God relation without exactly one Lexicon entry is refused;
//  - a long-form chapter outside its word or page budget, or losing a word, is
//    refused by the visual contract;
//  - customer text carrying a control or format character, evidence chrome,
//    prohibited wording or a deferred method is refused.
//
// The fixture-first payload is text only (title, chapters, reflection
// questions, method note). Mapping an accepted Skill reading - its claims,
// motifs and visualization specs - onto this projection is ETBZ-56.
// =============================================================================

import { z } from 'zod';
import {
  DISPLAY_GLYPH_SET,
  GEOMETRY_CENTIPOINTS,
  PAGE_FAMILY,
  PHASES,
  assertCustomerSurfaceClean,
  assertEveryWordPlaced,
  countWords,
  presentWuXing,
  resolveDisplayGlyph,
  resolvePillarPaint,
  resolveSlot,
  validateLongFormPlacement,
} from '../visual/index.js';
import type { DisplayGlyph, Phase, PillarPaint } from '../visual/index.js';
import {
  CHART_TERMINOLOGY,
  RELEASED_CONTRACT_SOURCES,
  TEN_GOD_RELATION_WORDING,
  contractBindingRef,
  findProhibitedWording,
  findUnsupportedMethodTerm,
} from '../skill/index.js';
import type { HoroscopeModel, PillarName } from '../horoscope-model.js';
import type { FufireTenGodFact } from '../ports/fufire-gateway.js';
import { elementDeByEn, stemFactByName } from '../../domain/sizhu.js';
import { structuralHash, structuralHashOfCanonicalText } from '../../domain/structural-hash.js';
import { PresentationError } from './errors.js';
import { CONTENT_W, blockWords, headerHeight, layoutHeader, paginateLongForm } from './long-form.js';
import type { HeaderLine, LayoutFragment, LongFormBlock, LongFormHeaderBlock } from './long-form.js';
import { TEMPLATE_LABELS, assertReleasedTemplate, label, templateBinding } from './template.js';
import type { TemplateBinding, TemplateLabelId } from './template.js';
import { BASELINE_CP, TEXT_STYLES, ascentOf, ceilToBaseline, firstBaseline, isCjkIdeograph, textWidth } from './text-measure.js';
import type { TextStyle, TextStyleId } from './text-measure.js';

export const PRESENTATION_PROJECTION_VERSION = 'bazodiac-presentation-projection.v1' as const;

// ---------------------------------------------------------------------------
// the content payload
// ---------------------------------------------------------------------------

/**
 * A character that is invisible, unassigned or not text: a control or format
 * character, a lone surrogate, a private-use or unassigned code point, any
 * default-ignorable code point (a variation selector, a Hangul filler, a
 * combining grapheme joiner), or any whitespace other than the plain space.
 */
export const FORBIDDEN_CHARACTER = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Default_Ignorable_Code_Point}]|[^\S ]/u;

/**
 * A customer text as the layout will set it: words separated by single plain
 * spaces, nothing invisible. A forbidden character (a zero width space, a soft
 * hyphen, a bidi override, a lone surrogate, a private-use character), any
 * other whitespace, a double space or padding would be a decision the payload
 * did not make visibly, so it is refused rather than normalised. The display
 * name, the one string from the end user, is held to the same rule.
 */
const customerText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((text) => !FORBIDDEN_CHARACTER.test(text) && !/ {2}/u.test(text) && text.trim() === text, {
      message: 'customer text is single-spaced plain text, without padding, control or format characters',
    });

const contentSchema = z.strictObject({
  title: customerText(200),
  chapters: z
    .array(z.strictObject({ title: customerText(200), paragraphs: z.array(customerText(6000)).min(1).max(40) }))
    .min(1)
    .max(12),
  reflectionQuestions: z.array(customerText(1000)).min(1).max(12),
  methodNote: customerText(6000),
});

export type PresentationContent = z.infer<typeof contentSchema>;

export interface PresentationInput {
  readonly model: HoroscopeModel;
  /** The presentation-ready text payload; validated here. */
  readonly content: unknown;
}

// ---------------------------------------------------------------------------
// the projection model - page views carry exactly what their page prints
// ---------------------------------------------------------------------------

/** A display glyph and its phase field - no text. */
export interface GlyphRef {
  readonly character: string;
  readonly phase: Phase;
}

/** A display glyph with its pinyin printed beside it. */
export interface GlyphText extends GlyphRef {
  readonly pinyin: string;
}

export interface StemValue extends GlyphText {
  /** The chart's German element label for this character's phase. */
  readonly phaseLabel: string;
  readonly polarity: 'yang' | 'yin';
  readonly polarityLabel: string;
}

export interface BranchValue extends GlyphText {
  readonly phaseLabel: string;
  readonly animalLabel: string;
}

/** A Ten-God relation by its Lexicon name. `code` is FuFirE's identity and is never printed. */
export interface TenGodName {
  readonly code: string;
  readonly hanzi: string;
  readonly pinyin: string;
}

/** A Ten-God relation with the Lexicon's German customer wording, verbatim. */
export interface TenGodEntry extends TenGodName {
  readonly customerLabel: string;
  readonly familyId: string;
}

export interface HiddenStemValue extends GlyphText {
  readonly phaseLabel: string;
  readonly qiRole: 'principal' | 'central' | 'residual';
  readonly qiLabel: string;
  readonly tenGod: TenGodName;
}

export interface PillarValue {
  readonly position: PillarName;
  readonly positionLabel: string;
  readonly stem: StemValue;
  readonly branch: BranchValue;
  readonly hidden: readonly GlyphText[];
  /** Null for the day pillar only: the day stem IS the Day Master. */
  readonly tenGod: TenGodName | null;
  readonly isDayMaster: boolean;
  readonly paint: PillarPaint;
}

export interface WuXingPhaseValue {
  readonly phase: Phase;
  readonly character: string;
  readonly pinyin: string;
  readonly label: string;
  readonly value: number;
  /** The supplied value, printed as supplied. */
  readonly valueText: string;
  /** `pt.linear-max-v1`: value / largest value. A presentation ratio, never printed. */
  readonly ratio: number;
}

export interface WuXingValue {
  readonly transformId: string;
  readonly phases: readonly WuXingPhaseValue[];
  readonly zeroPhases: readonly Phase[];
}

export interface WuXingTallyEntry {
  readonly phase: Phase;
  readonly character: string;
  readonly label: string;
  readonly valueText: string;
}

export interface TermValue {
  readonly label: string;
  readonly hanzi: string;
}

export interface FactRow {
  readonly label: string;
  readonly value: string;
  /** Informational CJK text set beside the value, when the row has one. */
  readonly cjk?: string;
}

export interface ChapterReference {
  readonly label: string;
  readonly dayMaster: StemValue;
  readonly dayMasterLabel: string;
  readonly termsLabel: string;
  readonly terms: readonly TermValue[];
}

export type PresenceMark = 'stem' | 'hidden' | 'both' | null;

export type PageContent =
  | Readonly<{ kind: 'cover'; dayMaster: StemValue; dayMasterLabel: string; brand: string; title: string; product: string; preparedFor: string; displayName: string; footerTerm: TermValue }>
  | Readonly<{ kind: 'identity'; kicker: string; title: string; rows: readonly FactRow[]; legend: readonly Readonly<{ tag: string; tagKind: 'chart' | 'general' | 'reading'; text: string }>[] }>
  | Readonly<{ kind: 'contents'; kicker: string; title: string; sections: readonly Readonly<{ title: string; entries: readonly Readonly<{ pageLabel: string; title: string }>[] }>[] }>
  | Readonly<{ kind: 'glance'; kicker: string; title: string; dayMaster: StemValue; dayMasterLabel: string; pillarsLabel: TermValue; pillars: readonly Readonly<{ positionLabel: string; stem: GlyphText; branch: GlyphText }>[]; wuXingLabel: TermValue; tally: readonly WuXingTallyEntry[]; rows: readonly FactRow[] }>
  | Readonly<{ kind: 'fourPillars'; kicker: string; title: string; rowLabels: readonly TermValue[]; dayMasterLabel: string; pillars: readonly PillarValue[]; legend: readonly Readonly<{ phase: Phase; label: string; character: string }>[] }>
  | Readonly<{ kind: 'foundation'; kicker: string; title: string; characters: readonly Readonly<{ positionLabel: string; roleLabel: string; glyph: GlyphText & Readonly<{ phaseLabel: string }>; detail: string }>[] }>
  | Readonly<{ kind: 'dayMaster'; kicker: string; title: string; dayMaster: StemValue; dayMasterLabel: string; rows: readonly FactRow[]; dayPillar: Readonly<{ positionLabel: string; stem: GlyphText; branch: GlyphText; hidden: readonly Readonly<GlyphText & { phaseLabel: string; qiLabel: string }>[] }>; hiddenStemsLabel: string }>
  | Readonly<{ kind: 'wuXing'; kicker: string; title: string; wuXing: WuXingValue; medallion: TermValue; captions: readonly string[] }>
  | Readonly<{ kind: 'fivePhases'; kicker: string; title: string; stemsLabel: string; branchesLabel: string; phases: readonly Readonly<{ phase: Phase; character: string; pinyin: string; label: string; stems: readonly GlyphRef[]; branches: readonly GlyphRef[] }>[] }>
  | Readonly<{ kind: 'tenGods'; kicker: string; title: string; relationHeader: string; columns: readonly string[]; rows: readonly Readonly<{ tenGod: TenGodEntry; marks: readonly PresenceMark[] }>[]; legend: readonly Readonly<{ mark: PresenceMark; label: string }>[] }>
  | Readonly<{ kind: 'hiddenStems'; kicker: string; title: string; branchLabel: string; rows: readonly Readonly<{ positionLabel: string; branch: BranchValue; hidden: readonly HiddenStemValue[] }>[] }>
  | Readonly<{ kind: 'longForm'; chapterNumber: number; chapterPage: number; template: 'opener' | 'continuation'; headerLines: readonly HeaderLine[]; runningKicker: string | null; fragments: readonly LayoutFragment[]; sidebar: (Readonly<{ xCp: number; yCp: number; widthCp: number }> & ChapterReference) | null; referencePanel: (Readonly<{ xCp: number; yCp: number; widthCp: number }> & ChapterReference) | null }>
  | Readonly<{ kind: 'reflection'; kicker: string; title: string; charactersLabel: string; characters: readonly Readonly<{ positionLabel: string; stem: GlyphRef; branch: GlyphRef }>[]; questions: readonly Readonly<{ number: string; text: string }>[] }>
  | Readonly<{ kind: 'summary'; kicker: string; title: string; rows: readonly FactRow[]; wuXingLabel: string; tally: readonly Readonly<{ phase: Phase; label: string; valueText: string }>[]; dayMaster: GlyphText; dayMasterLabel: string }>
  | Readonly<{ kind: 'closing'; kicker: string; title: string; preparedFor: string; displayName: string; product: string; pageNumberLabel: string }>
  | Readonly<{ kind: 'methodNote'; kicker: string; title: string; paragraphs: readonly string[]; dataNote: Readonly<{ label: string; text: string }> | null }>;

/** The running head and foot. The brand is drawn as the wordmark; as text it is the footer's first item. */
export interface PageChrome {
  readonly displayName: string;
  readonly tag: string | null;
  readonly tagKind: 'chart' | 'general' | 'reading' | null;
  readonly footer: readonly string[];
}

export interface PresentationPage {
  readonly pageId: string;
  /** The page of the ETBZ-49 page family this page instantiates. */
  readonly contractPageId: string;
  readonly family: string;
  readonly pageNumber: number;
  readonly pageLabel: string;
  /** Running head and foot; null on cover and closing. */
  readonly chrome: PageChrome | null;
  readonly slots: readonly string[];
  readonly content: PageContent;
  /** Exactly the strings this page prints, sorted and unique. */
  readonly strings: readonly string[];
}

export interface PresentationProjection {
  readonly projectionVersion: typeof PRESENTATION_PROJECTION_VERSION;
  readonly template: TemplateBinding;
  readonly sources: Readonly<{
    chartModelStructuralHash: string;
    contentStructuralHash: string;
    lexicon: Readonly<{ contractRef: string; confluencePageId: string; confluencePageVersion: string }>;
  }>;
  readonly language: 'de';
  /** The long-form text styles with their ascent - the renderer positions every line box from these. */
  readonly longFormStyles: Readonly<Record<TextStyleId, TextStyle & Readonly<{ ascentCp: number; firstBaselineCp: number }>>>;
  readonly pageCount: number;
  readonly pages: readonly PresentationPage[];
  /** Content slots of the template this projection leaves empty, and why. Never filled with stock copy. */
  readonly emptyContentSlots: readonly Readonly<{ slotId: string; reason: 'NO_APPROVED_CONTENT' }>[];
  /** The union of the pages' `strings`, sorted and unique. */
  readonly customerStrings: readonly string[];
  /** Every character drawn from the 27-glyph display set, sorted and unique. */
  readonly displayGlyphs: readonly string[];
  /** Every CJK character set in the informational text face, sorted and unique. */
  readonly cjkText: readonly string[];
  readonly structuralHash: string;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const POSITIONS: readonly PillarName[] = ['year', 'month', 'day', 'hour'];
type TagLabelId = 'tagChart' | 'tagGeneral' | 'tagReading';
const TAG_KIND: Readonly<Record<TagLabelId, 'chart' | 'general' | 'reading'>> = {
  tagChart: 'chart',
  tagGeneral: 'general',
  tagReading: 'reading',
};
const POSITION_LABEL: Readonly<Record<PillarName, TemplateLabelId>> = { year: 'year', month: 'month', day: 'day', hour: 'hour' };
const QI_LABEL: Readonly<Record<'principal' | 'central' | 'residual', TemplateLabelId>> = {
  principal: 'qiPrincipal',
  central: 'qiCentral',
  residual: 'qiResidual',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function mismatch(message: string, detail: Readonly<Record<string, unknown>>): never {
  throw new PresentationError('PRESENTATION_FACT_MISMATCH', message, detail);
}

function missing(message: string, detail: Readonly<Record<string, unknown>>): never {
  throw new PresentationError('PRESENTATION_FACT_MISSING', message, detail);
}

/** The phase of a German element label, through the released element vocabulary. */
function phaseOfGerman(labelDe: string, where: string): Phase {
  for (const phase of PHASES) {
    if (elementDeByEn(phase) === labelDe) return phase;
  }
  return missing(`${where}: "${labelDe}" is not a released German element label`, { where, value: labelDe });
}

function asPhase(value: string, where: string): Phase {
  if ((PHASES as readonly string[]).includes(value)) return value as Phase;
  return missing(`${where}: "${value}" is not one of the five phases`, { where, value });
}

function glyphOf(character: string, role: DisplayGlyph['role'], where: string): DisplayGlyph {
  const glyph = resolveDisplayGlyph(character);
  if (glyph.role !== role) mismatch(`${where}: ${character} is a ${glyph.role} glyph, the chart places it as ${role}`, { where, character, role });
  return glyph;
}

/** A Lexicon Hanzi field "繁 / 简" - the region policy CN_SIMPLIFIED sets the simplified form. */
function simplified(hanzi: string): string {
  const forms = hanzi.split(' / ');
  return forms[forms.length - 1] ?? hanzi;
}

function withoutTones(pinyin: string): string {
  return pinyin
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

function termValue(term: string, labelId: TemplateLabelId): TermValue {
  const entry = CHART_TERMINOLOGY.find((candidate) => candidate.term === term);
  if (entry === undefined) return missing(`the Lexicon carries no term "${term}"`, { term });
  const hanzi = entry.term.split(' / ')[1];
  if (hanzi === undefined) return missing(`the Lexicon term "${term}" carries no Hanzi`, { term });
  return { label: label(labelId), hanzi };
}

type LexiconRelation = (typeof TEN_GOD_RELATION_WORDING)[number];

function tenGodEntry(entry: LexiconRelation, code: string): TenGodEntry {
  return { code, hanzi: simplified(entry.hanzi), pinyin: entry.pinyin, customerLabel: entry.customerDe, familyId: entry.familyId };
}

function bindTenGod(fact: FufireTenGodFact, where: string): TenGodName {
  const key = withoutTones(fact.pinyin);
  const matches = TEN_GOD_RELATION_WORDING.filter((entry) => withoutTones(entry.pinyin) === key);
  if (matches.length !== 1) {
    throw new PresentationError('PRESENTATION_TEN_GOD_UNBOUND', `${where}: relation ${fact.name} (${fact.pinyin}) binds ${String(matches.length)} Lexicon entries`, {
      where,
      relation: fact.name,
      matches: matches.length,
    });
  }
  const entry = matches[0] as LexiconRelation;
  return { code: fact.name, hanzi: simplified(entry.hanzi), pinyin: entry.pinyin };
}

const glyphText = (value: GlyphText): GlyphText => ({ character: value.character, pinyin: value.pinyin, phase: value.phase });
const glyphRef = (value: GlyphRef): GlyphRef => ({ character: value.character, phase: value.phase });

// ---------------------------------------------------------------------------
// the chart values
// ---------------------------------------------------------------------------

interface ChartPillar extends Omit<PillarValue, 'hidden'> {
  readonly hidden: readonly HiddenStemValue[];
}

interface ChartValues {
  readonly pillars: readonly ChartPillar[];
  readonly dayMaster: StemValue;
  readonly wuXing: WuXingValue;
}

function stemValue(character: string, pinyin: string, phase: Phase, polarity: 'yang' | 'yin', where: string): StemValue {
  const glyph = glyphOf(character, 'heavenly_stem', where);
  if (glyph.phase !== phase) mismatch(`${where}: the chart places ${character} in ${phase}, the glyph contract in ${glyph.phase}`, { where, character, chart: phase, glyph: glyph.phase });
  if (glyph.polarity !== polarity) mismatch(`${where}: the chart gives ${character} polarity ${polarity}, the glyph contract ${String(glyph.polarity)}`, { where, character });
  if (glyph.pinyin !== pinyin) mismatch(`${where}: the chart spells ${character} "${pinyin}", the glyph contract "${glyph.pinyin}"`, { where, character });
  return { character, pinyin, phase, phaseLabel: elementDeByEn(phase), polarity, polarityLabel: label(polarity) };
}

function chartValues(model: HoroscopeModel): ChartValues {
  const pillars: ChartPillar[] = POSITIONS.map((position) => {
    const where = `pillars.${position}`;
    const pillar = model.pillars[position];
    const natal = model.natal.pillars[position];
    if (pillar.stemHanzi !== natal.stemCn) mismatch(`${where}: the BaZi and natal answers name different stems`, { where });
    if (pillar.branchHanzi !== natal.branchCn) mismatch(`${where}: the BaZi and natal answers name different branches`, { where });
    const stemPhase = phaseOfGerman(pillar.stemElementDe, `${where}.stemElementDe`);
    if (natal.stemElement !== stemPhase) mismatch(`${where}: the stem element differs between the BaZi and natal answers`, { where });
    const stem = stemValue(pillar.stemHanzi, pillar.stemPinyin, stemPhase, natal.polarity, `${where}.stem`);

    const branchGlyph = glyphOf(pillar.branchHanzi, 'earthly_branch', `${where}.branch`);
    const branchPhase = asPhase(natal.branchElement, `${where}.branchElement`);
    if (branchGlyph.phase !== branchPhase) {
      mismatch(`${where}: the chart places branch ${pillar.branchHanzi} in ${branchPhase}, the glyph contract in ${branchGlyph.phase}`, { where });
    }
    if (branchGlyph.pinyin !== pillar.branchPinyin) mismatch(`${where}: the branch pinyin differs from the glyph contract`, { where });
    if (pillar.tierDe.trim() === '') missing(`${where}: no animal label`, { where });
    const branch: BranchValue = {
      character: pillar.branchHanzi,
      pinyin: pillar.branchPinyin,
      phase: branchPhase,
      phaseLabel: elementDeByEn(branchPhase),
      animalLabel: pillar.tierDe,
    };

    if (natal.hiddenStems.length < 1) missing(`${where}: no hidden stems`, { where });
    if (natal.hiddenStems.length > 3) missing(`${where}: ${String(natal.hiddenStems.length)} hidden stems, at most three exist`, { where });
    const hidden: HiddenStemValue[] = natal.hiddenStems.map((entry, index) => {
      const at = `${where}.hiddenStems[${String(index)}]`;
      const glyph = glyphOf(entry.stemCn, 'heavenly_stem', at);
      const phase = asPhase(entry.element, `${at}.element`);
      if (glyph.phase !== phase) mismatch(`${at}: the chart places ${entry.stemCn} in ${phase}, the glyph contract in ${glyph.phase}`, { where: at });
      if (stemFactByName(entry.stem).pinyin !== glyph.pinyin) mismatch(`${at}: the Sizhu table and the glyph contract spell ${entry.stemCn} differently`, { where: at });
      return {
        character: entry.stemCn,
        pinyin: glyph.pinyin,
        phase,
        phaseLabel: elementDeByEn(phase),
        qiRole: entry.qi,
        qiLabel: label(QI_LABEL[entry.qi]),
        tenGod: bindTenGod(entry.tenGod, `${at}.tenGod`),
      };
    });

    const isDayMaster = position === 'day';
    let tenGod: TenGodName | null = null;
    if (isDayMaster) {
      if (natal.tenGod !== null) mismatch(`${where}: the day pillar carries a relation to itself`, { where });
    } else {
      if (natal.tenGod === null) missing(`${where}: no Ten-God relation`, { where });
      tenGod = bindTenGod(natal.tenGod, `${where}.tenGod`);
    }

    return {
      position,
      positionLabel: label(POSITION_LABEL[position]),
      stem,
      branch,
      hidden,
      tenGod,
      isDayMaster,
      paint: resolvePillarPaint({ position, stemPhase, branchPhase, hiddenStemPhases: hidden.map((entry) => entry.phase), isDayMaster }),
    };
  });

  // The Day Master against its two statements. The natal answer's Day Master is
  // the independent one; the BaZi answer's fields are copies of the day pillar
  // for any model `buildHoroscopeModel` builds and are compared only so that a
  // hand-built model cannot carry a Day Master the pages would contradict.
  const day = pillars[2] as ChartPillar;
  const bazi = model.dayMaster;
  if (bazi.stemHanzi !== day.stem.character || bazi.stemPinyin !== day.stem.pinyin || bazi.elementDe !== day.stem.phaseLabel) {
    mismatch('dayMaster: the BaZi Day Master is not the stem of the day pillar', { dayMaster: bazi.stemHanzi, dayStem: day.stem.character });
  }
  const natalDm = model.natal.dayMaster;
  if (natalDm.stemCn !== day.stem.character) mismatch('dayMaster: the natal Day Master is not the stem of the day pillar', { natal: natalDm.stemCn, dayStem: day.stem.character });
  if (asPhase(natalDm.element, 'natal.dayMaster.element') !== day.stem.phase) mismatch('dayMaster: the natal Day Master element differs from the day stem', { natal: natalDm.element });
  if (natalDm.polarity !== day.stem.polarity) mismatch('dayMaster: the natal Day Master polarity differs from the day stem', { natal: natalDm.polarity });

  const vector: Partial<Record<Phase, number>> = {};
  const suppliedKeys = Object.keys(model.wuxing.vector);
  if (suppliedKeys.length !== PHASES.length) missing(`wuxing: ${String(suppliedKeys.length)} phases supplied, five expected`, { keys: suppliedKeys });
  for (const key of suppliedKeys) {
    const value = model.wuxing.vector[key];
    if (typeof value !== 'number') return missing(`wuxing.${key}: no value`, { key });
    vector[phaseOfGerman(key, `wuxing.${key}`)] = value;
  }
  const presentation = presentWuXing(vector);
  const wuXing: WuXingValue = {
    transformId: presentation.transformId,
    phases: PHASES.map((phase) => {
      const glyph = DISPLAY_GLYPH_SET.find((entry) => entry.role === 'wu_xing' && entry.phase === phase);
      if (glyph === undefined) return missing(`the glyph contract carries no Wu Xing glyph for ${phase}`, { phase });
      return {
        phase,
        character: glyph.character,
        pinyin: glyph.pinyin,
        label: elementDeByEn(phase),
        value: presentation.vector[phase],
        valueText: String(presentation.vector[phase]),
        ratio: presentation.ratio[phase],
      };
    }),
    zeroPhases: presentation.zeroPhases,
  };

  return { pillars, dayMaster: day.stem, wuXing };
}

// ---------------------------------------------------------------------------
// pages
// ---------------------------------------------------------------------------

function contractPage(id: string): (typeof PAGE_FAMILY)[number] {
  const page = PAGE_FAMILY.find((candidate) => candidate.id === id);
  if (page === undefined) return missing(`the page family has no page "${id}"`, { id });
  return page;
}

function slotsOf(id: string, realized?: readonly string[]): readonly string[] {
  const slots = contractPage(id).bindings.map((binding) => binding.slotId);
  for (const slot of slots) resolveSlot(slot);
  return realized === undefined ? slots : slots.filter((slot) => realized.includes(slot));
}

interface PageDraft {
  readonly pageId: string;
  readonly contractPageId: string;
  readonly tag: TagLabelId | null;
  readonly chrome: boolean;
  readonly slots: readonly string[];
  readonly content: PageContent;
  readonly contentsTitle: string | null;
  readonly section: 'front' | 'chart' | 'reading' | 'closing';
}

function chapterReference(dayMaster: StemValue): ChapterReference {
  return {
    label: label('chapterReference'),
    dayMaster,
    dayMasterLabel: label('dayMaster'),
    termsLabel: label('terms'),
    terms: [
      termValue('Heavenly Stems / 天干', 'heavenlyStems'),
      termValue('Earthly Branches / 地支', 'earthlyBranches'),
      termValue('Hidden Stems / 藏干', 'hiddenStems'),
      termValue('Day Master / 日主', 'dayMaster'),
      termValue('Wu Xing / 五行', 'fivePhases'),
    ],
  };
}

function longFormPages(content: PresentationContent, dayMaster: StemValue): PageDraft[] {
  const drafts: PageDraft[] = [];
  const reference = chapterReference(dayMaster);
  content.chapters.forEach((chapter, chapterIndex) => {
    const chapterNumber = chapterIndex + 1;
    const header: LongFormHeaderBlock[] = [
      { id: 'kicker', kind: 'kicker', text: `${label('chapter').toUpperCase()} ${pad2(chapterNumber)}` },
      { id: 'title', kind: 'sectionTitle', text: chapter.title },
    ];
    const blocks: LongFormBlock[] = chapter.paragraphs.map((text, index) => ({ id: `p${String(index + 1)}`, kind: 'paragraph', text }));
    const layout = paginateLongForm(blocks, headerHeight(header));
    const source = blocks.map(blockWords).join(' ');
    const placement = {
      fixtureId: `chapter-${pad2(chapterNumber)}`,
      wordCount: countWords(source),
      pages: layout.pages.map((page) => ({
        pageNumber: page.pageNumber,
        template: page.template,
        lines: page.fragments.flatMap((fragment) => fragment.lines.map((line) => line.text)),
      })),
    };
    validateLongFormPlacement(placement);
    assertEveryWordPlaced(source, placement);

    const lastPage = layout.pages.length;
    const contentY = GEOMETRY_CENTIPOINTS.marginTop;
    layout.pages.forEach((page) => {
      const fill = (page.usedBottomCp - contentY) / GEOMETRY_CENTIPOINTS.contentH;
      const shortFinal = page.pageNumber === lastPage && fill < 0.6;
      const contractId = PAGE_FAMILY.filter((candidate) => candidate.family === 'long-form')[Math.min(page.pageNumber, 3) - 1]?.id;
      if (contractId === undefined) missing('the page family has no long-form page for this position', { chapterNumber, page: page.pageNumber });
      drafts.push({
        pageId: `chapter-${pad2(chapterNumber)}-p${String(page.pageNumber)}`,
        contractPageId: contractId,
        tag: 'tagReading',
        chrome: true,
        slots: slotsOf(contractId),
        section: 'reading',
        contentsTitle: page.pageNumber === 1 ? chapter.title : null,
        content: {
          kind: 'longForm',
          chapterNumber,
          chapterPage: page.pageNumber,
          template: page.template,
          headerLines: page.template === 'opener' ? layoutHeader(header) : [],
          runningKicker: page.template === 'continuation' ? `${label('chapter').toUpperCase()} ${pad2(chapterNumber)} · ${label('continued').toUpperCase()}` : null,
          fragments: page.fragments,
          sidebar: page.sidebar !== null && !shortFinal ? { ...page.sidebar, ...reference } : null,
          referencePanel: shortFinal
            ? { xCp: GEOMETRY_CENTIPOINTS.marginSide, yCp: ceilToBaseline(page.usedBottomCp - contentY) + contentY + 2 * BASELINE_CP, widthCp: CONTENT_W, ...reference }
            : null,
        },
      });
    });
  });
  return drafts;
}

function presence(pillar: ChartPillar, entry: LexiconRelation): PresenceMark {
  const visible = pillar.tenGod !== null && pillar.tenGod.pinyin === entry.pinyin;
  const hidden = pillar.hidden.some((hiddenStem) => hiddenStem.tenGod.pinyin === entry.pinyin);
  if (visible && hidden) return 'both';
  if (visible) return 'stem';
  if (hidden) return 'hidden';
  return null;
}

function buildDrafts(model: HoroscopeModel, content: PresentationContent, chart: ChartValues): PageDraft[] {
  const { pillars, dayMaster, wuXing } = chart;
  const day = pillars[2] as ChartPillar;
  const fourPillarsTerm = termValue('Four Pillars / 四柱', 'fourPillars');
  const wuXingTerm = termValue('Wu Xing / 五行', 'fivePhases');
  const hasWarnings = model.sourceWarnings.length > 0;

  const front: PageDraft[] = [
    {
      pageId: 'cover',
      contractPageId: 'cover',
      tag: null,
      chrome: false,
      slots: slotsOf('cover'),
      section: 'front',
      contentsTitle: label('cover'),
      content: {
        kind: 'cover',
        dayMaster,
        dayMasterLabel: label('dayMaster'),
        brand: label('brand'),
        title: content.title,
        product: label('product'),
        preparedFor: label('preparedFor'),
        displayName: model.displayName,
        footerTerm: fourPillarsTerm,
      },
    },
    {
      pageId: 'identity',
      contractPageId: 'identity',
      tag: null,
      chrome: true,
      slots: slotsOf('identity'),
      section: 'front',
      contentsTitle: label('documentTitle'),
      content: {
        kind: 'identity',
        kicker: label('documentKicker'),
        title: label('documentTitle'),
        rows: [
          { label: label('preparedFor'), value: model.displayName },
          { label: label('basis'), value: fourPillarsTerm.label, cjk: fourPillarsTerm.hanzi },
          { label: label('hourPillar'), value: label('hourPillarKnown') },
          { label: label('script'), value: label('scriptSimplified') },
          { label: label('chartValues'), value: label('chartValuesSource') },
        ],
        legend: [
          { tag: label('tagChart'), tagKind: 'chart', text: label('legendChart') },
          { tag: label('tagGeneral'), tagKind: 'general', text: label('legendGeneral') },
          { tag: label('tagReading'), tagKind: 'reading', text: label('legendReading') },
        ],
      },
    },
    {
      pageId: 'contents',
      contractPageId: 'contents',
      tag: null,
      chrome: true,
      slots: slotsOf('contents'),
      section: 'front',
      contentsTitle: label('contents'),
      content: { kind: 'contents', kicker: label('contentsKicker'), title: label('contents'), sections: [] },
    },
  ];

  const chartPages: PageDraft[] = [
    {
      pageId: 'glance',
      contractPageId: 'glance',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('glance'),
      section: 'chart',
      contentsTitle: label('glanceTitle'),
      content: {
        kind: 'glance',
        kicker: label('tagChart'),
        title: label('glanceTitle'),
        dayMaster,
        dayMasterLabel: label('dayMaster'),
        pillarsLabel: fourPillarsTerm,
        pillars: pillars.map((pillar) => ({ positionLabel: pillar.positionLabel, stem: glyphText(pillar.stem), branch: glyphText(pillar.branch) })),
        wuXingLabel: wuXingTerm,
        tally: wuXing.phases.map((entry) => ({ phase: entry.phase, character: entry.character, label: entry.label, valueText: entry.valueText })),
        rows: [
          { label: label('hourPillar'), value: label('hourPillarKnown') },
          { label: label('script'), value: label('scriptSimplified') },
          { label: label('chartValues'), value: label('chartValuesSource') },
        ],
      },
    },
    {
      pageId: 'four-pillars',
      contractPageId: 'four-pillars',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('four-pillars'),
      section: 'chart',
      contentsTitle: label('fourPillars'),
      content: {
        kind: 'fourPillars',
        kicker: label('tagChart'),
        title: label('fourPillars'),
        rowLabels: [
          termValue('Heavenly Stems / 天干', 'heavenlyStems'),
          termValue('Earthly Branches / 地支', 'earthlyBranches'),
          termValue('Hidden Stems / 藏干', 'hiddenStems'),
          { label: label('relation'), hanzi: '' },
        ],
        dayMasterLabel: label('dayMaster'),
        pillars: pillars.map((pillar) => ({ ...pillar, hidden: pillar.hidden.map(glyphText) })),
        legend: wuXing.phases.map((entry) => ({ phase: entry.phase, label: entry.label, character: entry.character })),
      },
    },
    {
      pageId: 'foundation',
      contractPageId: 'foundation',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('foundation'),
      section: 'chart',
      contentsTitle: label('foundationTitle'),
      content: {
        kind: 'foundation',
        kicker: label('fourPillars'),
        title: label('foundationTitle'),
        characters: pillars.flatMap((pillar) => [
          { positionLabel: pillar.positionLabel, roleLabel: label('stem'), glyph: { ...glyphText(pillar.stem), phaseLabel: pillar.stem.phaseLabel }, detail: pillar.stem.polarityLabel },
          { positionLabel: pillar.positionLabel, roleLabel: label('branch'), glyph: { ...glyphText(pillar.branch), phaseLabel: pillar.branch.phaseLabel }, detail: pillar.branch.animalLabel },
        ]),
      },
    },
    {
      pageId: 'day-master',
      contractPageId: 'day-master',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('day-master', ['dayMaster.hero']),
      section: 'chart',
      contentsTitle: label('dayMaster'),
      content: {
        kind: 'dayMaster',
        kicker: label('tagChart'),
        title: label('dayMaster'),
        dayMaster,
        dayMasterLabel: label('dayMaster'),
        rows: [
          { label: label('stem'), value: dayMaster.pinyin, cjk: dayMaster.character },
          { label: label('phase'), value: dayMaster.phaseLabel },
          { label: label('polarity'), value: dayMaster.polarityLabel },
          { label: label('dayPillar'), value: `${day.stem.pinyin} ${day.branch.pinyin}`, cjk: `${day.stem.character}${day.branch.character}` },
        ],
        dayPillar: {
          positionLabel: day.positionLabel,
          stem: glyphText(day.stem),
          branch: glyphText(day.branch),
          hidden: day.hidden.map((entry) => ({ ...glyphText(entry), phaseLabel: entry.phaseLabel, qiLabel: entry.qiLabel })),
        },
        hiddenStemsLabel: label('hiddenStems'),
      },
    },
    {
      pageId: 'wu-xing-distribution',
      contractPageId: 'wu-xing-distribution',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('wu-xing-distribution'),
      section: 'chart',
      contentsTitle: label('wuXingDistribution'),
      content: {
        kind: 'wuXing',
        kicker: label('wuXing'),
        title: label('wuXingDistribution'),
        wuXing,
        medallion: wuXingTerm,
        captions: [label('wuXingValuesAsSupplied'), ...(wuXing.zeroPhases.length > 0 ? [label('wuXingZeroIsZero')] : [])],
      },
    },
    {
      pageId: 'five-phases',
      contractPageId: 'five-phases',
      tag: 'tagGeneral',
      chrome: true,
      slots: slotsOf('five-phases'),
      section: 'chart',
      contentsTitle: label('fivePhases'),
      content: {
        kind: 'fivePhases',
        kicker: label('wuXing'),
        title: label('fivePhases'),
        stemsLabel: label('stems'),
        branchesLabel: label('branches'),
        phases: wuXing.phases.map((entry) => ({
          phase: entry.phase,
          character: entry.character,
          pinyin: entry.pinyin,
          label: entry.label,
          stems: DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'heavenly_stem' && glyph.phase === entry.phase).map(glyphRef),
          branches: DISPLAY_GLYPH_SET.filter((glyph) => glyph.role === 'earthly_branch' && glyph.phase === entry.phase).map(glyphRef),
        })),
      },
    },
    {
      pageId: 'ten-gods',
      contractPageId: 'ten-gods',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('ten-gods'),
      section: 'chart',
      contentsTitle: label('tenGodsTitle'),
      content: {
        kind: 'tenGods',
        kicker: label('tagChart'),
        title: label('tenGodsTitle'),
        relationHeader: label('relation'),
        columns: pillars.map((pillar) => pillar.positionLabel),
        rows: TEN_GOD_RELATION_WORDING.map((entry) => ({ tenGod: tenGodEntry(entry, ''), marks: pillars.map((pillar) => presence(pillar, entry)) })),
        legend: [
          { mark: 'stem', label: label('visibleStem') },
          { mark: 'hidden', label: label('hiddenStem') },
          { mark: 'both', label: label('visibleAndHiddenStem') },
          { mark: null, label: label('notPresent') },
        ],
      },
    },
    {
      pageId: 'hidden-stems',
      contractPageId: 'hidden-stems',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('hidden-stems'),
      section: 'chart',
      contentsTitle: label('hiddenStems'),
      content: {
        kind: 'hiddenStems',
        kicker: label('tagChart'),
        title: label('hiddenStems'),
        branchLabel: label('branch'),
        rows: pillars.map((pillar) => ({ positionLabel: pillar.positionLabel, branch: pillar.branch, hidden: pillar.hidden })),
      },
    },
  ];

  const closingPages: PageDraft[] = [
    {
      pageId: 'reflection',
      contractPageId: 'reflection',
      tag: 'tagReading',
      chrome: true,
      slots: slotsOf('reflection'),
      section: 'closing',
      contentsTitle: label('reflectionTitle'),
      content: {
        kind: 'reflection',
        kicker: label('tagReading'),
        title: label('reflectionTitle'),
        charactersLabel: label('reflectionCharacters'),
        characters: pillars.map((pillar) => ({ positionLabel: pillar.positionLabel, stem: glyphRef(pillar.stem), branch: glyphRef(pillar.branch) })),
        questions: content.reflectionQuestions.map((text, index) => ({ number: pad2(index + 1), text })),
      },
    },
    {
      pageId: 'summary',
      contractPageId: 'summary',
      tag: 'tagChart',
      chrome: true,
      slots: slotsOf('summary'),
      section: 'closing',
      contentsTitle: label('summaryTitle'),
      content: {
        kind: 'summary',
        kicker: label('tagChart'),
        title: label('summaryTitle'),
        rows: [
          { label: label('dayMaster'), value: `${dayMaster.pinyin} · ${dayMaster.polarityLabel} · ${dayMaster.phaseLabel}`, cjk: dayMaster.character },
          ...pillars.map((pillar) => ({
            label: pillar.positionLabel,
            value: `${pillar.stem.pinyin} ${pillar.branch.pinyin}`,
            cjk: `${pillar.stem.character}${pillar.branch.character}`,
          })),
        ],
        wuXingLabel: label('wuXing'),
        tally: wuXing.phases.map((entry) => ({ phase: entry.phase, label: entry.label, valueText: entry.valueText })),
        dayMaster: glyphText(dayMaster),
        dayMasterLabel: label('dayMaster'),
      },
    },
    {
      pageId: 'closing',
      contractPageId: 'closing',
      tag: null,
      chrome: false,
      slots: slotsOf('closing'),
      section: 'closing',
      contentsTitle: label('closingKicker'),
      content: {
        kind: 'closing',
        kicker: label('closingKicker'),
        title: content.title,
        preparedFor: label('preparedFor'),
        displayName: model.displayName,
        product: label('product'),
        pageNumberLabel: '',
      },
    },
    {
      pageId: 'method-note',
      contractPageId: 'method-note',
      tag: null,
      chrome: true,
      slots: slotsOf('method-note'),
      section: 'closing',
      contentsTitle: label('methodNoteTitle'),
      content: {
        kind: 'methodNote',
        kicker: label('methodNoteTitle'),
        title: label('methodNoteTitle'),
        paragraphs: [content.methodNote],
        dataNote: hasWarnings ? { label: label('dataNote'), text: label('dataNoteText') } : null,
      },
    },
  ];

  return [...front, ...chartPages, ...longFormPages(content, dayMaster), ...closingPages];
}

// ---------------------------------------------------------------------------
// the strings a page prints
// ---------------------------------------------------------------------------

/** Fields that identify, classify, position or colour - never printed. */
const NON_PRINTED_KEYS = new Set([
  'kind',
  'phase',
  'polarity',
  'position',
  'code',
  'familyId',
  'qiRole',
  'template',
  'mark',
  'marks',
  'transformId',
  'zeroPhases',
  'paint',
  'blockId',
  'styleId',
  'meta',
  'boxCp',
  'character',
  'tagKind',
]);

function collectStrings(value: unknown, key: string | null, out: Set<string>): void {
  if (key !== null && NON_PRINTED_KEYS.has(key)) return;
  if (typeof value === 'string') {
    if (value !== '') out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, key, out);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [childKey, child] of Object.entries(value)) collectStrings(child, childKey, out);
  }
}

function collectGlyphs(value: unknown, key: string | null, out: Set<string>): void {
  if (key === 'paint') return;
  if (Array.isArray(value)) {
    for (const entry of value) collectGlyphs(entry, key, out);
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [childKey, child] of Object.entries(value)) {
      if (childKey === 'character' && typeof child === 'string') out.add(child);
      else collectGlyphs(child, childKey, out);
    }
  }
}

function assertCustomerText(text: string): void {
  assertCustomerSurfaceClean(text);
  const prohibited = findProhibitedWording(text);
  if (prohibited !== null) {
    throw new PresentationError('PRESENTATION_CUSTOMER_TEXT_REFUSED', `a customer string uses wording the Lexicon prohibits (${prohibited.classId})`, {
      ...prohibited,
    });
  }
  const method = findUnsupportedMethodTerm(text);
  if (method !== null) {
    throw new PresentationError('PRESENTATION_CUSTOMER_TEXT_REFUSED', 'a customer string names a method the released profile does not enable', { term: method });
  }
}

/**
 * The texts the long form does not measure (title, reflection questions, method note, display name) are held to
 * the coverage the paragraphs already meet: every character is in the pinned Inter tables or is a CJK ideograph.
 * A blank that is not a space (a Braille blank), a decomposed umlaut or an emoji is refused, not printed.
 */
function assertMeasurable(text: string, where: string): void {
  try {
    textWidth(text, 'body');
  } catch (error) {
    if (error instanceof PresentationError) throw new PresentationError(error.code, `${where}: ${error.message}`, { ...error.detail, where });
    throw error;
  }
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

export function buildPresentationProjection(input: PresentationInput): PresentationProjection {
  const parsed = contentSchema.safeParse(input.content);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined || issue.path.length === 0 ? '<root>' : issue.path.map(String).join('.');
    throw new PresentationError('PRESENTATION_INPUT_INVALID', `content ${path}: ${issue?.code ?? 'invalid'}`, { path });
  }
  const content = parsed.data;
  const model = input.model;

  const precisions = [model.precision, model.natal.precision, model.wuxing.precision];
  if (!model.birth.birthTimeKnown || precisions.some((precision) => !precision.birthTimeKnown || precision.provisionalFields.length > 0)) {
    throw new PresentationError('PRESENTATION_UNKNOWN_TIME_UNSUPPORTED', 'the birth time is unknown or provisional; the template defines no unknown-time rendering', {
      provisionalFields: sortedUnique(precisions.flatMap((precision) => precision.provisionalFields)),
    });
  }
  if (model.displayName === '' || model.displayName.trim() !== model.displayName || FORBIDDEN_CHARACTER.test(model.displayName) || / {2}/u.test(model.displayName)) {
    throw new PresentationError('PRESENTATION_INPUT_INVALID', 'the display name is empty, padded, double-spaced or carries a forbidden character', {});
  }
  assertMeasurable(content.title, 'title');
  content.reflectionQuestions.forEach((question, index) => assertMeasurable(question, `reflectionQuestions.${String(index)}`));
  assertMeasurable(content.methodNote, 'methodNote');
  assertMeasurable(model.displayName, 'displayName');

  const chart = chartValues(model);
  const drafts = buildDrafts(model, content, chart);

  // Data note: FuFirE's warnings stay visible, as a pointer to the method note - never as a code.
  const methodPageNumber = drafts.findIndex((draft) => draft.content.kind === 'methodNote') + 1;
  const identityIndex = drafts.findIndex((draft) => draft.content.kind === 'identity');
  const identity = drafts[identityIndex];
  if (model.sourceWarnings.length > 0 && identity !== undefined && identity.content.kind === 'identity') {
    drafts[identityIndex] = {
      ...identity,
      content: {
        ...identity.content,
        rows: [...identity.content.rows, { label: label('dataNote'), value: `${label('dataNoteSeeMethod')} ${pad2(methodPageNumber)}` }],
      },
    };
  }

  // Contents: derived from the drafts themselves - page numbers are the projection's own.
  const sectionTitles: Readonly<Record<PageDraft['section'], TemplateLabelId>> = {
    front: 'sectionFront',
    chart: 'sectionChart',
    reading: 'sectionReading',
    closing: 'sectionClosing',
  };
  const sections = (['front', 'chart', 'reading', 'closing'] as const).map((section) => ({
    title: label(sectionTitles[section]),
    entries: drafts
      .map((draft, index) => ({ draft, pageNumber: index + 1 }))
      .filter(({ draft }) => draft.section === section && draft.contentsTitle !== null)
      .map(({ draft, pageNumber }) => ({ pageLabel: pad2(pageNumber), title: draft.contentsTitle as string })),
  }));
  const contentsIndex = drafts.findIndex((draft) => draft.content.kind === 'contents');
  const contents = drafts[contentsIndex];
  if (contents !== undefined && contents.content.kind === 'contents') {
    drafts[contentsIndex] = { ...contents, content: { ...contents.content, sections } };
  }

  const template = templateBinding();
  assertReleasedTemplate(template);
  const pages: PresentationPage[] = drafts.map((draft, index) => {
    const pageNumber = index + 1;
    const pageLabel = pad2(pageNumber);
    const contract = contractPage(draft.contractPageId);
    const pageContent: PageContent = draft.content.kind === 'closing' ? { ...draft.content, pageNumberLabel: pageLabel } : draft.content;
    const chrome: PageChrome | null = draft.chrome
      ? {
          displayName: model.displayName,
          tag: draft.tag === null ? null : label(draft.tag),
          tagKind: draft.tag === null ? null : TAG_KIND[draft.tag],
          footer: [label('brand'), label('product'), model.displayName],
        }
      : null;
    const printed = new Set<string>();
    collectStrings(pageContent, null, printed);
    collectStrings(chrome, null, printed);
    if (chrome !== null) printed.add(pageLabel);
    return {
      pageId: draft.pageId,
      contractPageId: draft.contractPageId,
      family: contract.family,
      pageNumber,
      pageLabel,
      chrome,
      slots: draft.slots,
      content: pageContent,
      strings: sortedUnique(printed),
    };
  });

  const strings = new Set(pages.flatMap((page) => page.strings));
  for (const text of strings) assertCustomerText(text);
  const glyphs = new Set<string>();
  collectGlyphs(pages.map((page) => page.content), null, glyphs);
  const cjk = new Set<string>();
  for (const text of strings) {
    for (const character of text) {
      if (isCjkIdeograph(character.codePointAt(0) ?? 0)) cjk.add(character);
    }
  }

  const lexiconSource = RELEASED_CONTRACT_SOURCES.find((source) => source.key === 'TERMINOLOGY_LEXICON');
  if (lexiconSource === undefined) return missing('the released contract set carries no Lexicon', {});

  const core = {
    projectionVersion: PRESENTATION_PROJECTION_VERSION,
    template,
    sources: {
      chartModelStructuralHash: structuralHashOfCanonicalText(model.canonicalJson),
      contentStructuralHash: structuralHash(content),
      lexicon: {
        contractRef: contractBindingRef(lexiconSource),
        confluencePageId: lexiconSource.confluencePageId,
        confluencePageVersion: lexiconSource.confluencePageVersion,
      },
    },
    language: 'de' as const,
    longFormStyles: Object.fromEntries(
      (Object.keys(TEXT_STYLES) as TextStyleId[]).map((styleId) => [
        styleId,
        { ...TEXT_STYLES[styleId], ascentCp: ascentOf(styleId), firstBaselineCp: firstBaseline(styleId) },
      ]),
    ) as PresentationProjection['longFormStyles'],
    pageCount: pages.length,
    pages,
    emptyContentSlots: [
      { slotId: 'dayMaster.reading', reason: 'NO_APPROVED_CONTENT' as const },
      { slotId: 'dayMaster.pillarReading', reason: 'NO_APPROVED_CONTENT' as const },
    ],
    customerStrings: sortedUnique(strings),
    displayGlyphs: sortedUnique(glyphs),
    cjkText: sortedUnique(cjk),
  };
  return { ...core, structuralHash: structuralHash(core) };
}

/** The labels a template instance may print - exported so a test can prove none is left unused or unchecked. */
export const TEMPLATE_LABEL_IDS = Object.keys(TEMPLATE_LABELS) as readonly TemplateLabelId[];
