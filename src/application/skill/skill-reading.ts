// =============================================================================
// ETBZ-52 - the reading a Skill run hands back, and the boundary that accepts it.
//
// A Skill runtime (ChatGPT, Claude) returns a structured reading, never free
// prose: chapters in the plan's order, each paragraph typed FACT / FRAME /
// INTERPRETATION / REFLECTION and bound to the facts and accepted claims it
// renders, a declared semantic delta and declared callbacks per chapter,
// grounded reflection questions, a method note carrying the source warnings
// verbatim, and visualization specs that reference facts and claims only.
//
// `acceptSkillReading` is an acceptance boundary in the sense of ADR 0007/0008:
// untrusted draft in; every obligation of the plan (`constraints`), the
// Long-Form Contract (semantic delta, callback, grounded reflection), the
// Lexicon (prohibited wording), the Method Profile (no deferred-method
// vocabulary) and the ETBZ-25 citation rule (a symbol or number in prose is a
// cited fact) checked; a hash-bound accepted reading out - or a typed refusal.
// It repairs nothing: no trimming, no de-duplication, no downgrade. What it
// cannot judge - whether a sentence is true of the chart, whether prose is
// Barnum residue - stays with the Anti-Boilerplate checks and the human gate.
//
// `projectCustomerReading` is the customer-facing projection: text only, no
// id, hash, code or state; the same content, nothing invented.
// =============================================================================

import { z } from 'zod';
import { structuralHash } from '../../domain/structural-hash.js';
import { findUncitedNumerals, findUncitedSymbols } from '../interpretation/chart-symbol-lexicon.js';
import type { ChartFact } from '../interpretation/feature-set.js';
import type { AcceptedInterpretiveClaim } from '../interpretation/interpretive-claim-graph.js';
import { NARRATIVE_OPERATIONS } from '../interpretation/meta-narrative-plan.js';
import type { NarrativeOperation, PlanChapter, ReleasedContractBinding } from '../interpretation/meta-narrative-plan.js';
import { assertRunEvidenceBound, isCandidateVersion } from './skill-contract-bundle.js';
import type { CandidateEvaluation, SkillContractBundle } from './skill-contract-bundle.js';
import { SKILL_REF_V1_1, skillRefForBundle } from './skill-package.js';
import type { SkillInputPackage } from './skill-package.js';
import { SkillRunError } from './skill-run-errors.js';

export const SKILL_READING_SCHEMA_VERSION = 'bazodiac-skill-reading.v1' as const;

/** What a paragraph is, in the FACT / SYMBOLIC FRAME / INTERPRETATION / REFLECTION separation of the Lexicon (section 3). */
export const PARAGRAPH_KINDS = ['FACT', 'FRAME', 'INTERPRETATION', 'REFLECTION'] as const;
export type ParagraphKind = (typeof PARAGRAPH_KINDS)[number];

/** The certainty a paragraph is written with; fixed by the claims it cites, never chosen. */
export const PARAGRAPH_POSTURES = ['NONE', 'SUPPORTED', 'TENTATIVE'] as const;
export type ParagraphPosture = (typeof PARAGRAPH_POSTURES)[number];

/** The Long-Form Contract's semantic delta vocabulary (section 10). */
export const SEMANTIC_DELTA_KINDS = [
  'NEW_CLAIM', 'NEW_RELATION', 'NEW_QUALIFICATION', 'NEW_CONTRAST', 'NEW_CONTEXT', 'NEW_INTEGRATION',
] as const;
export type SemanticDeltaKind = (typeof SEMANTIC_DELTA_KINDS)[number];

/** The long-form chapter budget of the visual contract (ETBZ-43 v1): words per chapter. */
export const CHAPTER_WORD_BUDGET = { min: 600, max: 900 } as const;

export interface ReadingParagraph {
  readonly kind: ParagraphKind;
  readonly posture: ParagraphPosture;
  readonly text: string;
  readonly factRefs: readonly string[];
  readonly claimRefs: readonly string[];
}

export interface ReadingSemanticDelta {
  readonly kind: SemanticDeltaKind;
  readonly claimRefs: readonly string[];
}

export interface ReadingCallback {
  readonly claimRef: string;
  readonly deltaKind: SemanticDeltaKind;
}

export interface ReadingChapter {
  readonly chapterRef: string;
  readonly narrativeOperation: NarrativeOperation;
  readonly title: string;
  readonly paragraphs: readonly ReadingParagraph[];
  readonly semanticDelta: readonly ReadingSemanticDelta[];
  readonly callbacks: readonly ReadingCallback[];
}

export interface ReadingReflectionQuestion {
  readonly text: string;
  readonly claimRefs: readonly string[];
}

export interface ReadingVisualizationSpec {
  readonly specId: string;
  readonly slotId: string;
  readonly factRefs: readonly string[];
  readonly claimRefs: readonly string[];
}

export interface SkillReadingDraft {
  readonly schemaVersion: typeof SKILL_READING_SCHEMA_VERSION;
  readonly skillRef: string;
  readonly bundleRef: string;
  readonly bundleStructuralHash: string;
  readonly inputPackageStructuralHash: string;
  readonly claimGraphStructuralHash: string;
  readonly planStructuralHash: string;
  readonly contracts: readonly ReleasedContractBinding[];
  readonly title: string;
  readonly chapters: readonly ReadingChapter[];
  readonly reflectionQuestions: readonly ReadingReflectionQuestion[];
  readonly methodNote: Readonly<{ text: string; warningCodes: readonly string[] }>;
  readonly visualizationSpecs: readonly ReadingVisualizationSpec[];
}

export interface AcceptedSkillReading extends SkillReadingDraft {
  readonly structuralHash: string;
}

/** `candidateEvaluation` (ETBZ-57): a reading under a CANDIDATE bundle is accepted for an evaluation run only. */
export interface SkillReadingContext extends CandidateEvaluation {
  readonly bundle: SkillContractBundle;
  readonly inputPackage: SkillInputPackage;
}

/** The customer-facing projection: text only. */
export interface CustomerReading {
  readonly title: string;
  readonly chapters: readonly Readonly<{ title: string; paragraphs: readonly string[] }>[];
  readonly reflectionQuestions: readonly string[];
  readonly methodNote: string;
}

// -----------------------------------------------------------------------------
// Wording gates. Mechanical and conservative: a phrase here is refused wherever
// it appears; what the lists do not catch stays with the human gate. Each list
// names the contract section it carries.
// -----------------------------------------------------------------------------

export interface ProhibitedPhraseClass {
  /** The Lexicon section 12 class, or the Lens section the phrase comes from. */
  readonly classId: string;
  readonly source: string;
  readonly phrases: readonly string[];
}

/**
 * Lexicon section 12 (six classes) and Lens section 9.2 (avoid list), reduced to
 * the phrases that can be matched without judgement. "always" and "never" are
 * deliberately absent: ordinary prose uses them, and the Lexicon blocks them as
 * determinism only in context - a human reads for that.
 */
export const PROHIBITED_PHRASES: readonly ProhibitedPhraseClass[] = [
  { classId: 'DETERMINISM_CAUSALITY', source: 'terminology-wording-lexicon@1.0.0 §12', phrases: [
    'proves', 'prove that', 'causes', 'therefore you are', 'destined', 'guaranteed', 'this explains why you',
    'beweist', 'beweisen, dass', 'verursacht', 'deshalb bist du', 'vorherbestimmt', 'garantiert', 'das erklärt, warum du',
  ] },
  { classId: 'UNSUPPORTED_BALANCE_STRENGTH', source: 'terminology-wording-lexicon@1.0.0 §12', phrases: [
    'deficient element', 'missing element', 'too much', 'too little', 'strong day master', 'weak day master', 'day master strength',
    'rooted', 'unrooted', 'favourable element', 'unfavourable element', 'favorable element', 'unfavorable element', 'useful god', 'yong shen',
    'fehlendes element', 'zu viel', 'zu wenig', 'starker tagesmeister', 'schwacher tagesmeister', 'stärke des tagesmeisters',
    'verwurzelt', 'günstiges element', 'ungünstiges element', 'nützlicher gott',
  ] },
  { classId: 'CLINICAL_THERAPEUTIC', source: 'terminology-wording-lexicon@1.0.0 §12', phrases: [
    'trauma', 'attachment style', 'narcissis*', 'dissociation', 'depression', 'anxiety', 'healing', 'cure', 'treatment', 'subconscious', 'unconscious', 'repress*',
    'bindungsstil', 'narzis*', 'dissoziation', 'angststörung', 'heilung', 'therapie', 'unterbewusst*', 'unbewusst*', 'verdräng*',
  ] },
  { classId: 'GENDER_IDENTITY', source: 'terminology-wording-lexicon@1.0.0 §12', phrases: ['masculine', 'feminine', 'männlich*', 'weiblich*'] },
  { classId: 'MYSTIFICATION_PSEUDO_SCIENCE', source: 'terminology-wording-lexicon@1.0.0 §12', phrases: [
    'quantum', 'frequency', 'frequencies', 'cosmic', 'vibration', 'scientific proof', 'scientifically',
    'quanten', 'frequenz', 'kosmisch', 'schwingung', 'wissenschaftlich bewiesen', 'wissenschaftlich belegt',
  ] },
  { classId: 'ADVICE_PREDICTION', source: 'terminology-wording-lexicon@1.0.0 §12', phrases: [
    'you should', 'you must', 'you need to', 'you have to', 'will happen', 'is going to happen',
    'du solltest', 'du musst', 'du brauchst', 'wird passieren', 'wird geschehen', 'wird eintreten',
  ] },
  { classId: 'IDENTITY_VERDICT', source: 'grounded-reflective-synthesis-lens@1.0.0 §9.2', phrases: [
    'deep down', 'the chart proves', 'your true personality', 'your true self', 'the real you',
    'tief in dir', 'tief im inneren', 'dein wahres ich', 'deine wahre persönlichkeit', 'wer du wirklich bist',
  ] },
];

/**
 * Vocabulary of the methods the released profile defers or forbids (Method
 * Profile section 6.3), in English and German, pinyin spaced and concatenated:
 * naming one in customer prose is using it. Everyday words that also name a
 * method ("root", "strong") are kept out so the gate refuses methods, not
 * language; a human reads for the rest. The German noun "Ehe" (marriage) is
 * matched, which also refuses the conjunction "ehe" - write "bevor".
 */
export const UNSUPPORTED_METHOD_TERMS: readonly string[] = [
  'day master strength', 'strong day master', 'weak day master', 'rooting', 'rooted', 'unrooted', 'tong gen', 'tonggen',
  'ge ju', 'geju', 'structure classification', 'useful god', 'yong shen', 'yongshen', 'xi shen', 'xishen', 'ji shen', 'jishen',
  'tiao hou', 'tiaohou', 'climatic adjustment',
  'stem combination', 'stem combinations', 'branch combination', 'branch combinations', 'stem clash', 'stem clashes',
  'branch clash', 'branch clashes', 'branch harm', 'branch harms', 'branch punishment', 'branch punishments',
  'branch destruction', 'branch destructions', 'he hua', 'hehua', 'shen sha', 'shensha', 'symbolic star', 'symbolic stars', 'twelve life stages',
  'life stage', 'life stages', 'na yin', 'nayin', 'kong wang', 'kongwang', 'luck pillar', 'luck pillars', 'da yun', 'dayun', 'liu nian', 'liunian', 'annual pillar',
  'transit', 'transits', 'season', 'seasons', 'seasonal', 'summer', 'winter', 'spring', 'autumn',
  'remedy', 'remedies', 'organ', 'organs', 'health', 'illness', 'compatibility', 'synastry', 'spouse', 'marriage',
  'career rank', 'wealth prediction',
  'stärke des tagesmeisters', 'starker tagesmeister', 'schwacher tagesmeister', 'verwurzelung', 'verwurzelt',
  'nützlicher gott', 'nutzgott', 'stammkombination', 'zweigkombination', 'zusammenstoß', 'zusammenstöße',
  'jahreszeit', 'jahreszeiten', 'sommer', 'winter', 'frühling', 'herbst', 'glückssäule', 'glückssäulen',
  'heilmittel', 'organe', 'gesundheit', 'krankheit', 'partnerhoroskop', 'ehepartner', 'ehe', 'karrierestufe',
];

/** Hashes, ids, states and fixture labels never reach a customer surface. */
const EVIDENCE_CHROME_PATTERNS: readonly Readonly<{ label: string; pattern: RegExp }>[] = [
  { label: 'hash', pattern: /\bsha256[:=]|\b[0-9a-f]{40,}\b/iu },
  { label: 'artefact id', pattern: /\b(?:claim|chapter|motif|thread|spec)\.[0-9a-f]{8,}\b/iu },
  { label: 'fact id', pattern: /\bchart\.(?:pillar|dayMaster|wuxing|natal)\./u },
  { label: 'state or code', pattern: /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/u },
  { label: 'fixture', pattern: /\bfixture\b/iu },
];

function normalise(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

function escapeForRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(haystack: string, term: string): boolean {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeForRegExp(term)}(?![\\p{L}\\p{N}])`, 'u');
  return pattern.test(haystack);
}

/**
 * A phrase ending in `*` matches as a stem (left boundary only), so that
 * inflected forms - "männliche", "narzisstisch", "verdrängte" - are caught;
 * every other phrase matches as whole words.
 */
function containsPhrase(haystack: string, phrase: string): boolean {
  if (phrase.endsWith('*')) {
    const stem = phrase.slice(0, -1);
    return new RegExp(`(?<![\\p{L}\\p{N}])${escapeForRegExp(stem)}`, 'u').test(haystack);
  }
  return containsTerm(haystack, phrase);
}

/** The prohibited class and phrase a text carries, or null. */
export function findProhibitedWording(text: string): Readonly<{ classId: string; phrase: string }> | null {
  const haystack = normalise(text);
  for (const entry of PROHIBITED_PHRASES) {
    for (const phrase of entry.phrases) {
      if (containsPhrase(haystack, phrase)) {
        return { classId: entry.classId, phrase };
      }
    }
  }
  return null;
}

/** The deferred/forbidden method term a text carries, or null. */
export function findUnsupportedMethodTerm(text: string): string | null {
  const haystack = normalise(text);
  for (const term of UNSUPPORTED_METHOD_TERMS) {
    if (containsTerm(haystack, term)) return term;
  }
  return null;
}

/** The chrome label a text carries, or null. */
export function findEvidenceChrome(text: string): string | null {
  for (const { label, pattern } of EVIDENCE_CHROME_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

// -----------------------------------------------------------------------------
// ETBZ-57 - customer-voice gates. They hold only a reading of the voice
// revision (bazodiac-interpretation-skill@1.1.0); a 1.0.0 reading is accepted
// under exactly the gates it was accepted under. Like the lists above they are
// mechanical and conservative, and each names the section it carries; what
// they cannot match stays with the Human Editorial Gate.
// -----------------------------------------------------------------------------

/** Readings of these Skills are held to the customer-voice gates. */
const VOICE_GATED_SKILLS: ReadonlySet<string> = new Set([SKILL_REF_V1_1]);

export interface VoicePhraseList {
  readonly source: string;
  readonly phrases: readonly string[];
}

/** Lexicon 1.1 rule L3.12, Lens 1.1 sections 9.2 and 21 step 11: the narrative never talks about the source, the validation, the calculation, the pipeline, its chapters or the reading itself. */
export const META_NARRATION_PHRASES: VoicePhraseList = {
  source: 'terminology-wording-lexicon@1.1.0 §3 L3.12; grounded-reflective-synthesis-lens@1.1.0 §9.2',
  phrases: [
    'quelle', 'quellen', 'datenquelle', 'validiert*', 'validierung*', 'berechnung*', 'berechnet*', 'nachrechn*', 'nachgerechnet',
    'rechnet nach', 'rechnet nichts nach', 'kapitel*', 'dieses reading', 'das reading', 'diesem reading', 'dieses readings', 'im reading',
    'dein reading', 'deinem reading', 'deines readings',
    'diese deutung', 'dieser deutung', 'die deutung', 'lesart*', 'diese signale', 'datensatz', 'datenhinweis', 'pipeline', 'evidenz', 'claim*',
    'the source', 'source data', 'validated', 'validation', 'calculation', 'calculated', 'recalculat*', 'this reading', 'the reading',
    'chapter', 'chapters', 'evidence', 'dataset', 'these signals', 'data note',
  ],
};

/** Lexicon 1.1 section 7 and rule L3.4: a SUPPORTED claim is stated directly, never under a retired template hedge. */
export const TEMPLATE_HEDGE_PHRASES: VoicePhraseList = {
  source: 'terminology-wording-lexicon@1.1.0 §7; grounded-reflective-synthesis-lens@1.1.0 §9.2',
  phrases: [
    'innerhalb dieses bazi-rahmens', 'innerhalb des bazi-rahmens', 'im rahmen dieses bazi', 'gelesen werden', 'lesen lässt', 'lesart*',
    'mögliche ausdrucksform', 'mögliche ausdrucksformen', 'lässt sich als', 'within this bazi framework', 'can be read as', 'one possible reading', 'possible expression',
  ],
};

/** Lens 1.1 E1: the framework is named once, never as a per-sentence template - not even over a graph-carried alternative. */
export const FRAMEWORK_TEMPLATE_PHRASES: VoicePhraseList = {
  source: 'grounded-reflective-synthesis-lens@1.1.0 §2 E1; terminology-wording-lexicon@1.1.0 §7',
  phrases: ['innerhalb dieses bazi-rahmens', 'innerhalb des bazi-rahmens', 'im rahmen dieses bazi', 'within this bazi framework'],
};

/** Lexicon 1.1 section 7 and rule L3.11, Lens 1.1 section 18 AC 15: a TENTATIVE paragraph carries a visible tentative marker. */
export const TENTATIVE_MARKERS: VoicePhraseList = {
  source: 'terminology-wording-lexicon@1.1.0 §7 L3.11; grounded-reflective-synthesis-lens@1.1.0 §18',
  phrases: [
    'vielleicht', 'möglicherweise', 'eventuell', 'womöglich', 'vorsichtig gelesen', 'vorsichtig formuliert', 'vorläufig*', 'könnte', 'könnten',
    'kann sein', 'mag sein', 'unter vorbehalt', 'ist nicht sicher', 'bleibt offen', 'perhaps', 'maybe', 'possibly', 'might', 'may', 'could', 'tentative*', 'provisional*',
  ],
};

/** Lens 1.1 section 7.2 and AC 17, Lexicon 1.1 section 4: tension language only over claims the graph links by CONTRASTS_WITH. */
export const TENSION_WORDS: VoicePhraseList = {
  source: 'grounded-reflective-synthesis-lens@1.1.0 §7.2, §18; terminology-wording-lexicon@1.1.0 §4',
  phrases: [
    'spannung*', 'widerspruch*', 'widersprüch*', 'widerstreit*', 'gegensatz*', 'gegensätz*', 'konflikt*', 'zerrissen*', 'hin- und hergerissen',
    'tension*', 'conflict*', 'contradict*', 'torn between',
  ],
};

/**
 * SKILL.md 1.1 law 13: a count is derived, never a chart fact. A count word
 * ("zweimal", "an zwei Stellen") states one anyway; the positions are named instead.
 */
export const COUNT_WORDS: VoicePhraseList = {
  source: 'bazodiac-interpretation-skill@1.1.0 SKILL.md law 13; terminology-wording-lexicon@1.1.0 §3 L3.13',
  phrases: [
    'zweimal', 'dreimal', 'viermal', 'fünfmal', 'doppelt*', 'zweifach*', 'dreifach*', 'an zwei stellen', 'an drei stellen', 'an vier stellen',
    'in zwei zweigen', 'in drei zweigen', 'in zwei säulen', 'in drei säulen', 'twice', 'thrice', 'two places', 'three places',
  ],
};

/**
 * Lens 1.1 sections 1.1 and 9, Lexicon 1.1 rule L3.13: no biography, person or
 * life domain presented as fact. Kinship is matched as a phrase ("deine
 * Familie"), because "Familie" alone is the Lexicon's own term for a Ten-God
 * family.
 */
export const LIFE_DOMAIN_WORDS: VoicePhraseList = {
  source: 'grounded-reflective-synthesis-lens@1.1.0 §1.1 CONCRETENESS_INVARIANT, §9; terminology-wording-lexicon@1.1.0 §3 L3.13',
  phrases: [
    'mutter', 'vater', 'vaters', 'eltern*', 'geschwister*', 'bruder', 'brüder', 'schwester*', 'kind', 'kinder', 'kindern', 'kindheit', 'kindes',
    'sohn', 'söhne', 'tochter', 'töchter', 'partner*', 'ehemann', 'ehefrau', 'freund', 'freunde', 'freunden', 'freundin*', 'freundschaft*', 'deine familie', 'deiner familie', 'familienleben', 'familiär*', 'chef',
    'chefin', 'vorgesetzte*', 'arbeitgeber*', 'kolleg*', 'beruf*', 'karriere*', 'job', 'jobs', 'arbeitsplatz', 'büro', 'firma',
    'schule', 'schulzeit', 'studium', 'jugend', 'gehalt', 'einkommen', 'geld', 'schulden', 'vermögen', 'liebesbeziehung*', 'verliebt*',
    'mother', 'father', 'parent', 'parents', 'sibling*', 'brother*', 'sister*', 'child', 'children', 'childhood', 'son', 'daughter*',
    'husband*', 'wife', 'wives', 'boyfriend*', 'girlfriend*', 'friend', 'friends', 'friendship*', 'your family', 'family life', 'boss*',
    'manager*', 'employer*', 'colleague*', 'career*', 'workplace', 'office', 'school*', 'salary', 'income', 'money', 'debt*',
    'romance', 'romantic',
  ],
};

/** Lexicon 1.1 section 12 (determinism class) and Lens section 9.2 avoid list: phrases the 1.1 profile adds to the prohibited classes. */
export const VOICE_PROHIBITED_PHRASES: readonly ProhibitedPhraseClass[] = [
  { classId: 'DETERMINISM_CAUSALITY', source: 'terminology-wording-lexicon@1.1.0 §12', phrases: [
    'schicksal*', 'fate', 'destiny', 'so bist du eben', 'so bist du nun mal', 'so bist du nun einmal', 'that is simply who you are', 'that is just who you are',
  ] },
  { classId: 'IDENTITY_VERDICT', source: 'grounded-reflective-synthesis-lens@1.1.0 §9.2', phrases: [
    'du bist jemand', 'du bist ein mensch', 'du bist eine person', 'you are someone', 'you are the kind of person', 'you are a person',
  ] },
];

function firstPhrase(text: string, list: VoicePhraseList): string | null {
  const haystack = normalise(text);
  for (const phrase of list.phrases) {
    if (containsPhrase(haystack, phrase)) return phrase;
  }
  return null;
}

/** Every phrase of `list` a text carries, in list order: what an audit counts, never a gate. */
export function findAllPhrases(text: string, list: VoicePhraseList): readonly string[] {
  const haystack = normalise(text);
  return list.phrases.filter((phrase) => containsPhrase(haystack, phrase));
}

/** The meta-narration phrase a text carries, or null. */
export function findMetaNarration(text: string): string | null {
  return firstPhrase(text, META_NARRATION_PHRASES);
}

/** The retired template hedge a text carries, or null. */
export function findTemplateHedge(text: string): string | null {
  return firstPhrase(text, TEMPLATE_HEDGE_PHRASES);
}

export function hasTentativeMarker(text: string): boolean {
  return findTentativeMarker(text) !== null;
}

/** The per-sentence framework template a text carries, or null. */
export function findFrameworkTemplate(text: string): string | null {
  return firstPhrase(text, FRAMEWORK_TEMPLATE_PHRASES);
}

/** The tentative marker a text carries, or null. */
export function findTentativeMarker(text: string): string | null {
  return firstPhrase(text, TENTATIVE_MARKERS);
}

/** The count word a text carries, or null. */
export function findCountWord(text: string): string | null {
  return firstPhrase(text, COUNT_WORDS);
}

/** The tension word a text carries, or null. */
export function findTensionWord(text: string): string | null {
  return firstPhrase(text, TENSION_WORDS);
}

/** The life-domain word a text carries, or null. */
export function findLifeDomainWord(text: string): string | null {
  return firstPhrase(text, LIFE_DOMAIN_WORDS);
}

/** The voice-profile prohibited class and phrase a text carries, or null. */
export function findVoiceProhibitedWording(text: string): Readonly<{ classId: string; phrase: string }> | null {
  const haystack = normalise(text);
  for (const entry of VOICE_PROHIBITED_PHRASES) {
    for (const phrase of entry.phrases) {
      if (containsPhrase(haystack, phrase)) return { classId: entry.classId, phrase };
    }
  }
  return null;
}

export function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => token.length > 0).length;
}

// -----------------------------------------------------------------------------
// Schema - shape only; every semantic obligation is checked afterwards.
// -----------------------------------------------------------------------------

const ref = z.string().min(1).max(256);
const paragraphSchema = z.strictObject({
  kind: z.enum(PARAGRAPH_KINDS),
  posture: z.enum(PARAGRAPH_POSTURES),
  text: z.string().min(1).max(6000),
  factRefs: z.array(ref).max(64),
  claimRefs: z.array(ref).max(32),
});
const chapterSchema = z.strictObject({
  chapterRef: ref,
  narrativeOperation: z.enum(NARRATIVE_OPERATIONS),
  title: z.string().min(1).max(200),
  paragraphs: z.array(paragraphSchema).min(1).max(40),
  semanticDelta: z.array(z.strictObject({ kind: z.enum(SEMANTIC_DELTA_KINDS), claimRefs: z.array(ref).min(1).max(16) })).max(16),
  callbacks: z.array(z.strictObject({ claimRef: ref, deltaKind: z.enum(SEMANTIC_DELTA_KINDS) })).max(32),
});
const bindingSchema = z.strictObject({
  contractRef: ref,
  confluencePageId: z.string().min(1).max(64),
  confluencePageVersion: z.string().min(1).max(64),
});
const readingDraftSchema = z.strictObject({
  schemaVersion: z.literal(SKILL_READING_SCHEMA_VERSION),
  skillRef: ref,
  bundleRef: ref,
  bundleStructuralHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  inputPackageStructuralHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  claimGraphStructuralHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  planStructuralHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
  contracts: z.array(bindingSchema).max(16),
  title: z.string().min(1).max(200),
  chapters: z.array(chapterSchema).min(1).max(40),
  reflectionQuestions: z.array(z.strictObject({ text: z.string().min(1).max(1000), claimRefs: z.array(ref).min(1).max(16) })).min(1).max(20),
  methodNote: z.strictObject({ text: z.string().min(1).max(6000), warningCodes: z.array(z.string().min(1).max(128)).max(64) }),
  visualizationSpecs: z.array(z.strictObject({ specId: ref, slotId: ref, factRefs: z.array(ref).max(64), claimRefs: z.array(ref).max(32) })).max(64),
});

/** The reading draft as JSON Schema - what a Skill package ships beside its instructions. */
export function skillReadingJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(readingDraftSchema);
}

// -----------------------------------------------------------------------------
// Acceptance
// -----------------------------------------------------------------------------

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function coveredValuesOf(facts: readonly ChartFact[]): Set<string> {
  const covered = new Set<string>();
  for (const fact of facts) {
    covered.add(fact.value);
    if (fact.sourceLabel !== null) covered.add(fact.sourceLabel);
  }
  return covered;
}

/** A symbol or a number on a customer surface is the value or source label of a cited fact. */
function checkSymbols(text: string, where: string, covered: Set<string>): void {
  const uncitedSymbols = findUncitedSymbols(text, covered);
  if (uncitedSymbols.length > 0) {
    throw new SkillRunError('READING_UNCITED_SYMBOL', `${where} names a chart symbol no cited fact carries`, { where, symbols: uncitedSymbols });
  }
  const uncitedNumerals = findUncitedNumerals(text, covered);
  if (uncitedNumerals.length > 0) {
    throw new SkillRunError('READING_UNCITED_NUMERAL', `${where} states a number no cited fact carries`, { where, numerals: uncitedNumerals });
  }
}

function checkSurface(text: string, where: string): void {
  const chrome = findEvidenceChrome(text);
  if (chrome !== null) {
    throw new SkillRunError('READING_EVIDENCE_CHROME', `${where} carries ${chrome} on the customer surface`, { where, label: chrome });
  }
  const prohibited = findProhibitedWording(text);
  if (prohibited !== null) {
    throw new SkillRunError('READING_PROHIBITED_WORDING', `${where} uses wording the Lexicon prohibits (${prohibited.classId})`, { where, ...prohibited });
  }
  const method = findUnsupportedMethodTerm(text);
  if (method !== null) {
    throw new SkillRunError('READING_UNSUPPORTED_METHOD_LANGUAGE', `${where} names a method the released profile does not enable`, { where, term: method });
  }
}

/**
 * The customer-voice surface of a narrative text (title, chapter title,
 * paragraph, reflection question): no meta-narration (a cited producer label
 * is terminology, not talk about the source), no life domain, no count word,
 * no voice-profile prohibited phrase, and tension language only where the text
 * cites both poles of one CONTRASTS_WITH relation. The method note is not
 * narrative: it carries the necessary method and data notes and is held to the
 * prohibited phrases, the life-domain words and the count words only.
 */
function checkVoiceSurface(text: string, where: string, claims: readonly AcceptedInterpretiveClaim[], contrastPairs: ReadonlySet<string>, citedLabels: readonly string[] = []): void {
  const voiceProhibited = findVoiceProhibitedWording(text);
  if (voiceProhibited !== null) {
    throw new SkillRunError('READING_PROHIBITED_WORDING', `${where} uses wording the Lexicon prohibits (${voiceProhibited.classId})`, { where, ...voiceProhibited });
  }
  const meta = findMetaNarration(withoutLabels(text, citedLabels));
  if (meta !== null) {
    throw new SkillRunError('READING_META_NARRATION', `${where} talks about the reading's sources or mechanics ("${meta}"); that belongs in the method note, if anywhere`, { where, phrase: meta });
  }
  const domain = findLifeDomainWord(text);
  if (domain !== null) {
    throw new SkillRunError('READING_LIFE_DOMAIN_INVENTED', `${where} names a life domain or a person ("${domain}") no claim carries`, { where, phrase: domain });
  }
  const tension = findTensionWord(text);
  if (tension !== null && !citesContrastPair(claims, contrastPairs)) {
    throw new SkillRunError('READING_TENSION_UNGROUNDED', `${where} writes a tension ("${tension}") but cites no two claims the graph links by CONTRASTS_WITH`, { where, phrase: tension });
  }
  const count = findCountWord(text);
  if (count !== null) {
    throw new SkillRunError('READING_UNCITED_NUMERAL', `${where} states a count ("${count}"); a count is derived, never a chart fact - name the positions instead`, { where, phrase: count });
  }
}

/** One key per unordered claim pair. */
function pairKey(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

/** True when two of the cited claims are the two poles of one CONTRASTS_WITH relation. */
function citesContrastPair(claims: readonly AcceptedInterpretiveClaim[], contrastPairs: ReadonlySet<string>): boolean {
  return claims.some((left, index) => claims.slice(index + 1).some((right) => contrastPairs.has(pairKey(left.claimId, right.claimId))));
}

/** A cited producer label (e.g. "Indirekte Quelle") is terminology, not talk about the source - as a whole term only. */
function withoutLabels(text: string, labels: readonly string[]): string {
  let rest = normalise(text);
  for (const label of labels) {
    if (label.trim() === '') continue;
    const escaped = normalise(label).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    rest = rest.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu'), ' ');
  }
  return rest;
}

/** The producer labels of the facts a surface cites directly or through its claims. */
function labelsOf(facts: readonly (ChartFact | undefined)[]): readonly string[] {
  return facts.flatMap((fact) => (fact?.sourceLabel === undefined || fact.sourceLabel === null ? [] : [fact.sourceLabel]));
}

/**
 * Accepts a reading draft against the package it was produced from. Throws on
 * the FIRST violation: a reading that is wrong in one place is not trusted in
 * any other.
 */
export function acceptSkillReading(draft: unknown, context: SkillReadingContext): AcceptedSkillReading {
  const { bundle, inputPackage } = context;
  const parsed = readingDraftSchema.safeParse(draft);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined || issue.path.length === 0 ? '<root>' : issue.path.map(String).join('.');
    throw new SkillRunError('READING_SCHEMA_INVALID', `${path}: ${issue?.code ?? 'invalid'}`, { path });
  }
  const reading: SkillReadingDraft = parsed.data;

  // 1. Bindings: this Skill, this bundle, this package, this graph, this plan, this contract set.
  const runtimeSkillRef = skillRefForBundle(bundle.bundleVersion);
  if (reading.skillRef !== runtimeSkillRef || reading.skillRef !== inputPackage.skillRef) {
    throw new SkillRunError('READING_SKILL_MISMATCH', `the reading names "${reading.skillRef}", this runtime is ${runtimeSkillRef}`);
  }
  const voice = VOICE_GATED_SKILLS.has(reading.skillRef);
  if (isCandidateVersion(bundle.bundleVersion) && context.candidateEvaluation !== true) {
    throw new SkillRunError('READING_BUNDLE_MISMATCH', `bundle ${bundle.bundleVersion} is a candidate: a reading under it is accepted for an evaluation run only ({ candidateEvaluation: true })`);
  }
  if (reading.bundleRef !== bundle.bundleRef || reading.bundleStructuralHash !== bundle.structuralHash || inputPackage.bundleRef !== bundle.bundleRef || inputPackage.bundleStructuralHash !== bundle.structuralHash) {
    throw new SkillRunError('READING_BUNDLE_MISMATCH', 'the reading or the package names another bundle than the one this run binds');
  }
  if (
    reading.inputPackageStructuralHash !== inputPackage.structuralHash ||
    reading.claimGraphStructuralHash !== inputPackage.claimGraph.structuralHash ||
    reading.planStructuralHash !== inputPackage.plan.structuralHash
  ) {
    throw new SkillRunError('READING_PACKAGE_MISMATCH', 'the reading names another input package, claim graph or plan than it was produced from');
  }
  assertRunEvidenceBound(bundle, { bundleRef: reading.bundleRef, contracts: reading.contracts });

  // 2. The chart and the accepted artefacts the reading may lean on.
  const factById = new Map<string, ChartFact>(inputPackage.facts.map((fact) => [fact.id, fact]));
  const excluded = new Set(inputPackage.excludedFactIds);
  const claimById = new Map<string, AcceptedInterpretiveClaim>(inputPackage.claimGraph.claims.map((claim) => [claim.claimId, claim]));
  const planned = new Set(inputPackage.plan.constraints.allowedClaimRefs);
  const contrastPairs = new Set<string>();
  const inAlternative = new Set<string>();
  for (const claim of inputPackage.claimGraph.claims) {
    for (const relation of claim.relations) {
      if (relation.type === 'CONTRASTS_WITH') contrastPairs.add(pairKey(claim.claimId, relation.targetClaimId));
      if (relation.type === 'ALTERNATIVE_READING') {
        inAlternative.add(claim.claimId);
        inAlternative.add(relation.targetClaimId);
      }
    }
  }
  const groundingOf = (claims: readonly AcceptedInterpretiveClaim[]): (ChartFact | undefined)[] => claims.flatMap((claim) => claim.factRefs.map((id) => factById.get(id)));
  const resolveFact = (id: string, where: string): ChartFact => {
    if (excluded.has(id)) {
      throw new SkillRunError('READING_FACT_EXCLUDED', `${where} cites fact ${id}, which the input excludes from interpretation`, { where, factRef: id });
    }
    const fact = factById.get(id);
    if (fact === undefined) {
      throw new SkillRunError('READING_FACT_UNKNOWN', `${where} cites fact ${id}, which the validated chart does not carry`, { where, factRef: id });
    }
    return fact;
  };
  const resolveClaim = (id: string, where: string): AcceptedInterpretiveClaim => {
    const claim = claimById.get(id);
    if (claim === undefined) {
      throw new SkillRunError('READING_CLAIM_UNKNOWN', `${where} cites claim ${id}, which the accepted graph does not carry`, { where, claimRef: id });
    }
    return claim;
  };

  // 3. Chapters are the plan's chapter sequence, and nothing else.
  const planChapters: readonly PlanChapter[] = inputPackage.plan.chapterPlan;
  if (reading.chapters.length !== planChapters.length) {
    throw new SkillRunError('READING_CHAPTER_PLAN_MISMATCH', `the reading has ${String(reading.chapters.length)} chapters, the plan ${String(planChapters.length)}`);
  }
  const chartCovered = coveredValuesOf(inputPackage.facts);
  checkSurface(reading.title, 'title');
  if (voice) checkVoiceSurface(reading.title, 'title', [], contrastPairs);
  checkSymbols(reading.title, 'title', chartCovered);
  const renderedBefore = new Set<string>();
  const renderedAnywhere = new Set<string>();
  reading.chapters.forEach((chapter, index) => {
    const where = `chapters[${String(index)}]`;
    const planned_ = planChapters[index];
    if (planned_ === undefined || chapter.chapterRef !== planned_.chapterId || chapter.narrativeOperation !== planned_.narrativeOperation) {
      throw new SkillRunError('READING_CHAPTER_PLAN_MISMATCH', `${where} is not the plan's chapter at that position (id or operation differs)`, { where });
    }
    checkSurface(chapter.title, `${where}.title`);
    if (voice) {
      const titleClaims = planned_.claimRefs.map((id) => resolveClaim(id, `${where}.title`));
      checkVoiceSurface(chapter.title, `${where}.title`, titleClaims, contrastPairs, labelsOf(groundingOf(titleClaims)));
    }
    const chapterClaims = new Set(planned_.claimRefs);
    const renderedHere = new Set<string>();
    const chapterFacts: ChartFact[] = [];
    let words = 0;

    chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
      const at = `${where}.paragraphs[${String(paragraphIndex)}]`;
      words += countWords(paragraph.text);
      checkSurface(paragraph.text, at);

      // Kind and grounding.
      const interpretive = paragraph.kind === 'INTERPRETATION' || paragraph.kind === 'REFLECTION';
      if (interpretive && paragraph.claimRefs.length === 0) {
        throw new SkillRunError('READING_PARAGRAPH_UNGROUNDED', `${at} is ${paragraph.kind} but cites no accepted claim`, { where: at });
      }
      if (paragraph.kind === 'FACT' && paragraph.factRefs.length === 0) {
        throw new SkillRunError('READING_PARAGRAPH_UNGROUNDED', `${at} is FACT but cites no fact`, { where: at });
      }
      if (paragraph.kind === 'FACT' && paragraph.claimRefs.length > 0) {
        throw new SkillRunError('READING_POSTURE_INVALID', `${at} is FACT but cites a claim; a fact paragraph interprets nothing`, { where: at });
      }
      if (paragraph.kind === 'FRAME' && paragraph.factRefs.length === 0 && paragraph.claimRefs.length === 0) {
        throw new SkillRunError('READING_PARAGRAPH_UNGROUNDED', `${at} is FRAME but cites neither a fact nor a claim`, { where: at });
      }

      // Claims: accepted, planned for this chapter; only an INTERPRETATION paragraph renders one.
      const claims = paragraph.claimRefs.map((id) => resolveClaim(id, at));
      for (const claim of claims) {
        if (!chapterClaims.has(claim.claimId)) {
          throw new SkillRunError('READING_CLAIM_NOT_PLANNED_HERE', `${at} renders claim ${claim.claimId}, which the plan does not place in this chapter`, { where: at, claimRef: claim.claimId });
        }
        if (paragraph.kind === 'INTERPRETATION') renderedHere.add(claim.claimId);
      }

      // Facts: known, interpretable, and - for an interpretive paragraph - grounding one of its claims.
      const facts = paragraph.factRefs.map((id) => resolveFact(id, at));
      if (interpretive) {
        const grounding = new Set(claims.flatMap((claim) => claim.factRefs));
        for (const fact of facts) {
          if (!grounding.has(fact.id)) {
            throw new SkillRunError('READING_FACT_NOT_GROUNDED', `${at} cites fact ${fact.id}, which none of its claims is grounded in`, { where: at, factRef: fact.id });
          }
        }
      }

      // Posture fits the kind: an interpretive paragraph is SUPPORTED or TENTATIVE; a FACT or FRAME
      // paragraph is NONE, or TENTATIVE exactly when it rests on a provisional fact or a tentative claim.
      const tentative = claims.some((claim) => claim.epistemicClass === 'TENTATIVE_INTERPRETATION') || facts.some((fact) => fact.provisional);
      if (interpretive ? paragraph.posture === 'NONE' : paragraph.posture === 'SUPPORTED' || (paragraph.posture === 'TENTATIVE' && !tentative)) {
        throw new SkillRunError('READING_POSTURE_INVALID', `${at} has posture ${paragraph.posture}, which does not fit a ${paragraph.kind} paragraph`, { where: at });
      }

      // Provisionality never disappears.
      if (tentative && paragraph.posture !== 'TENTATIVE') {
        throw new SkillRunError('READING_PROVISIONALITY_LAUNDERED', `${at} cites a tentative claim or a provisional fact but is not written as tentative`, { where: at });
      }

      // Customer voice (1.1.0): uncertainty is carried, not added; tentativeness is visible; SUPPORTED is not hedged by template.
      if (voice) {
        checkVoiceSurface(paragraph.text, at, claims, contrastPairs, labelsOf([...facts, ...groundingOf(claims)]));
        if (interpretive && !tentative && paragraph.posture === 'TENTATIVE') {
          throw new SkillRunError('READING_SUPPORTED_UNDERSTATED', `${at} renders SUPPORTED claims only but is written as TENTATIVE; uncertainty is carried, not added`, { where: at });
        }
        if (paragraph.posture === 'TENTATIVE' && !hasTentativeMarker(paragraph.text)) {
          throw new SkillRunError('READING_TENTATIVE_NOT_VISIBLE', `${at} is TENTATIVE but carries no visible tentative marker`, { where: at });
        }
        // Over SUPPORTED claims only - INTERPRETATION, REFLECTION or FRAME alike - the text says it with no added doubt.
        // Where the graph carries an ALTERNATIVE_READING for EVERY cited claim, Lexicon 1.1 L3.4 keeps the bounded
        // formulations; the per-sentence framework template stays retired either way (Lens 1.1 E1).
        const certain = claims.length > 0 && !tentative;
        const plain = certain && !claims.every((claim) => inAlternative.has(claim.claimId));
        const marker = plain ? findTentativeMarker(paragraph.text) : null;
        if (marker !== null) {
          throw new SkillRunError('READING_SUPPORTED_UNDERSTATED', `${at} cites SUPPORTED claims only but writes "${marker}"; uncertainty is carried, not added`, { where: at, phrase: marker });
        }
        const hedge = plain ? findTemplateHedge(paragraph.text) : certain ? findFrameworkTemplate(paragraph.text) : null;
        if (hedge !== null) {
          throw new SkillRunError('READING_SUPPORTED_TEMPLATE_HEDGE', `${at} hedges a SUPPORTED claim with a template ("${hedge}")`, { where: at, phrase: hedge });
        }
      }

      // A symbol or a number in prose is a cited fact.
      const coveredFacts = [...facts, ...claims.flatMap((claim) => claim.factRefs.map((id) => factById.get(id)).filter((fact): fact is ChartFact => fact !== undefined))];
      chapterFacts.push(...coveredFacts);
      checkSymbols(paragraph.text, at, coveredValuesOf(coveredFacts));
    });

    // The chapter title names only what the chapter's paragraphs cite.
    checkSymbols(chapter.title, `${where}.title`, coveredValuesOf(chapterFacts));
    for (const claimId of planned_.claimRefs) {
      if (!renderedHere.has(claimId)) {
        throw new SkillRunError('READING_CHAPTER_CLAIM_UNRENDERED', `${where} does not render claim ${claimId}, which the plan places here`, { where, claimRef: claimId });
      }
    }
    if (words < CHAPTER_WORD_BUDGET.min || words > CHAPTER_WORD_BUDGET.max) {
      throw new SkillRunError('READING_CHAPTER_LENGTH_OUT_OF_CONTRACT', `${where} has ${String(words)} words; the long-form budget is ${String(CHAPTER_WORD_BUDGET.min)}-${String(CHAPTER_WORD_BUDGET.max)}`, { where, words });
    }

    // Semantic delta: at least one, over claims this chapter renders.
    if (chapter.semanticDelta.length === 0) {
      throw new SkillRunError('READING_NO_SEMANTIC_DELTA', `${where} declares no semantic delta; a chapter that only restates is repetition`, { where });
    }
    for (const delta of chapter.semanticDelta) {
      for (const claimId of delta.claimRefs) {
        resolveClaim(claimId, `${where}.semanticDelta`);
        if (!renderedHere.has(claimId)) {
          throw new SkillRunError('READING_DELTA_CLAIM_NOT_RENDERED', `${where} declares ${delta.kind} over claim ${claimId}, which it does not render`, { where, claimRef: claimId });
        }
        if (delta.kind === 'NEW_CLAIM' && renderedBefore.has(claimId)) {
          throw new SkillRunError('READING_NEW_CLAIM_ALREADY_RENDERED', `${where} declares NEW_CLAIM for ${claimId}, which an earlier chapter already rendered`, { where, claimRef: claimId });
        }
      }
    }
    // A first rendering is declared as such: introduced claims are part of the chapter's delta.
    const declaredNew = new Set(chapter.semanticDelta.filter((delta) => delta.kind === 'NEW_CLAIM').flatMap((delta) => delta.claimRefs));
    for (const claimId of renderedHere) {
      if (!renderedBefore.has(claimId) && !declaredNew.has(claimId)) {
        throw new SkillRunError('READING_NEW_CLAIM_UNDECLARED', `${where} renders ${claimId} for the first time without declaring it as NEW_CLAIM`, { where, claimRef: claimId });
      }
    }

    // Callbacks: every claim rendered again carries a declared delta; no callback without a prior rendering.
    const callbackClaims = new Set<string>();
    for (const callback of chapter.callbacks) {
      resolveClaim(callback.claimRef, `${where}.callbacks`);
      if (!renderedBefore.has(callback.claimRef) || !renderedHere.has(callback.claimRef)) {
        throw new SkillRunError('READING_CALLBACK_NOT_PRIOR', `${where} declares a callback of ${callback.claimRef}, which no earlier chapter rendered or this chapter does not render`, { where, claimRef: callback.claimRef });
      }
      if (callback.deltaKind === 'NEW_CLAIM') {
        throw new SkillRunError('READING_NEW_CLAIM_ALREADY_RENDERED', `${where} declares a callback of ${callback.claimRef} as NEW_CLAIM`, { where, claimRef: callback.claimRef });
      }
      callbackClaims.add(callback.claimRef);
    }
    for (const claimId of renderedHere) {
      if (renderedBefore.has(claimId) && !callbackClaims.has(claimId)) {
        throw new SkillRunError('READING_CALLBACK_WITHOUT_DELTA', `${where} renders ${claimId} again without declaring the delta the callback adds`, { where, claimRef: claimId });
      }
    }

    for (const claimId of renderedHere) {
      renderedBefore.add(claimId);
      renderedAnywhere.add(claimId);
    }
  });

  // 4. The thesis is written; reflection is grounded; the method note carries the warnings verbatim.
  for (const claimId of inputPackage.plan.reportThesis.claimRefs) {
    if (!renderedAnywhere.has(claimId)) {
      throw new SkillRunError('READING_THESIS_UNRENDERED', `thesis claim ${claimId} is rendered by no chapter`, { claimRef: claimId });
    }
  }
  reading.reflectionQuestions.forEach((question, index) => {
    const at = `reflectionQuestions[${String(index)}]`;
    checkSurface(question.text, at);
    const claims = question.claimRefs.map((id) => resolveClaim(id, at));
    if (voice) checkVoiceSurface(question.text, at, claims, contrastPairs, labelsOf(groundingOf(claims)));
    for (const claim of claims) {
      if (!planned.has(claim.claimId)) {
        throw new SkillRunError('READING_CLAIM_NOT_PLANNED_HERE', `${at} rests on claim ${claim.claimId}, which the plan does not use`, { where: at, claimRef: claim.claimId });
      }
    }
    const questionFacts = claims.flatMap((claim) => claim.factRefs.map((id) => factById.get(id)).filter((fact): fact is ChartFact => fact !== undefined));
    checkSymbols(question.text, at, coveredValuesOf(questionFacts));
  });
  checkSurface(reading.methodNote.text, 'methodNote');
  const methodNoteProhibited = voice ? findVoiceProhibitedWording(reading.methodNote.text) : null;
  if (methodNoteProhibited !== null) {
    throw new SkillRunError('READING_PROHIBITED_WORDING', `methodNote uses wording the Lexicon prohibits (${methodNoteProhibited.classId})`, { where: 'methodNote', ...methodNoteProhibited });
  }
  const methodNoteDomain = voice ? findLifeDomainWord(reading.methodNote.text) : null;
  if (methodNoteDomain !== null) {
    throw new SkillRunError('READING_LIFE_DOMAIN_INVENTED', `methodNote names a life domain or a person ("${methodNoteDomain}")`, { where: 'methodNote', phrase: methodNoteDomain });
  }
  const methodNoteCount = voice ? findCountWord(reading.methodNote.text) : null;
  if (methodNoteCount !== null) {
    throw new SkillRunError('READING_UNCITED_NUMERAL', `methodNote states a count ("${methodNoteCount}"); a count is derived, never a chart fact`, { where: 'methodNote', phrase: methodNoteCount });
  }
  checkSymbols(reading.methodNote.text, 'methodNote', chartCovered);
  if (!sameList(reading.methodNote.warningCodes, inputPackage.warnings)) {
    throw new SkillRunError('READING_WARNINGS_NOT_VERBATIM', 'the method note does not carry the source warnings verbatim, in source order');
  }

  // 5. Visualization specs reference facts and planned claims only, on declared slots.
  const slots = new Set(inputPackage.allowedSlotIds);
  const specIds = new Set<string>();
  reading.visualizationSpecs.forEach((spec, index) => {
    const at = `visualizationSpecs[${String(index)}]`;
    if (specIds.has(spec.specId)) {
      throw new SkillRunError('READING_VISUAL_SPEC_DUPLICATE', `${at} repeats spec id ${spec.specId}`, { where: at, specId: spec.specId });
    }
    specIds.add(spec.specId);
    if (!slots.has(spec.slotId)) {
      throw new SkillRunError('READING_VISUAL_SLOT_UNKNOWN', `${at} binds slot ${spec.slotId}, which the presentation contract does not declare`, { where: at, slotId: spec.slotId });
    }
    for (const id of spec.factRefs) {
      if (excluded.has(id) || !factById.has(id)) {
        throw new SkillRunError('READING_VISUAL_REF_INVALID', `${at} binds fact ${id}, which is unknown or excluded`, { where: at, factRef: id });
      }
    }
    for (const id of spec.claimRefs) {
      if (!claimById.has(id) || !planned.has(id)) {
        throw new SkillRunError('READING_VISUAL_REF_INVALID', `${at} binds claim ${id}, which is unknown or unplanned`, { where: at, claimRef: id });
      }
    }
  });

  return { ...reading, structuralHash: structuralHash(reading) };
}

// -----------------------------------------------------------------------------
// ETBZ-57 - the editorial pass: semantic realisation -> customer editorial
// realisation -> validation again. An editorial revision may change customer
// text and nothing else.
// -----------------------------------------------------------------------------

/**
 * Everything of a reading but its customer text, field by field so nothing
 * else can ride along: what an editorial revision may not change.
 */
function structureOf(reading: SkillReadingDraft): unknown {
  return {
    schemaVersion: reading.schemaVersion,
    skillRef: reading.skillRef,
    bundleRef: reading.bundleRef,
    bundleStructuralHash: reading.bundleStructuralHash,
    inputPackageStructuralHash: reading.inputPackageStructuralHash,
    claimGraphStructuralHash: reading.claimGraphStructuralHash,
    planStructuralHash: reading.planStructuralHash,
    contracts: reading.contracts,
    chapters: reading.chapters.map((chapter) => ({
      chapterRef: chapter.chapterRef,
      narrativeOperation: chapter.narrativeOperation,
      paragraphs: chapter.paragraphs.map((paragraph) => ({
        kind: paragraph.kind,
        posture: paragraph.posture,
        factRefs: paragraph.factRefs,
        claimRefs: paragraph.claimRefs,
      })),
      semanticDelta: chapter.semanticDelta,
      callbacks: chapter.callbacks,
    })),
    reflectionQuestions: reading.reflectionQuestions.map((question) => ({ claimRefs: question.claimRefs })),
    methodNote: { text: reading.methodNote.text, warningCodes: reading.methodNote.warningCodes },
    visualizationSpecs: reading.visualizationSpecs,
  };
}

function firstStructuralDifference(expected: unknown, actual: unknown, path: string): string | null {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return path;
    if (expected.length !== actual.length) return `${path}.length`;
    for (let index = 0; index < expected.length; index += 1) {
      const inner = firstStructuralDifference(expected[index], actual[index], `${path}[${String(index)}]`);
      if (inner !== null) return inner;
    }
    return null;
  }
  if (expected !== null && typeof expected === 'object' && actual !== null && typeof actual === 'object') {
    const left = expected as Record<string, unknown>;
    const right = actual as Record<string, unknown>;
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      const inner = firstStructuralDifference(left[key], right[key], `${path}.${key}`);
      if (inner !== null) return inner;
    }
    return null;
  }
  return expected === actual ? null : path;
}

/**
 * Accepts an editorial revision of an accepted reading. The revision passes
 * the whole acceptance boundary again, and everything but customer text -
 * bindings, chapters, paragraph kinds and postures, fact and claim references,
 * semantic deltas, callbacks, reflection bindings, warnings, visual specs -
 * must equal the reading it revises. The semantic reading is re-accepted
 * first, so a forged "accepted" reading is refused rather than trusted.
 */
export function acceptEditorialRevision(semantic: AcceptedSkillReading, revision: unknown, context: SkillReadingContext): AcceptedSkillReading {
  const { structuralHash: semanticHash, ...semanticDraft } = semantic;
  if (acceptSkillReading(semanticDraft, context).structuralHash !== semanticHash) {
    throw new SkillRunError('READING_EDITORIAL_EXPANSION', 'the reading under revision is not the accepted reading it claims to be');
  }
  const accepted = acceptSkillReading(revision, context);
  const differing = firstStructuralDifference(structureOf(semanticDraft), structureOf(accepted), 'reading');
  if (differing !== null) {
    throw new SkillRunError('READING_EDITORIAL_EXPANSION', `the editorial revision changes ${differing}; an editorial pass changes customer text only`, { path: differing });
  }
  return accepted;
}

/** Text only; no id, hash, code or state. Nothing is invented and nothing is repaired. */
export function projectCustomerReading(reading: AcceptedSkillReading): CustomerReading {
  const projection: CustomerReading = {
    title: reading.title,
    chapters: reading.chapters.map((chapter) => ({
      title: chapter.title,
      paragraphs: chapter.paragraphs.map((paragraph) => paragraph.text),
    })),
    reflectionQuestions: reading.reflectionQuestions.map((question) => question.text),
    methodNote: reading.methodNote.text,
  };
  const surfaces = [projection.title, projection.methodNote, ...projection.reflectionQuestions, ...projection.chapters.flatMap((chapter) => [chapter.title, ...chapter.paragraphs])];
  for (const text of surfaces) {
    const chrome = findEvidenceChrome(text);
    if (chrome !== null) {
      throw new SkillRunError('READING_EVIDENCE_CHROME', `the customer projection carries ${chrome}`, { label: chrome });
    }
  }
  return projection;
}
