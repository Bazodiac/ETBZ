// =============================================================================
// ETBZ-57 - the Terminology & Wording Lexicon customer-voice revision as values.
//
// `ETBZ — Terminology & Wording Lexicon v1.1` (`terminology-wording-lexicon@1.1.0`,
// Confluence 77529091) changes uncertainty language, where method and source
// notes live, and examples - never an allowed semantic domain or a "Never
// imply" / prohibited column (Rebaseline 62128133 section 17). Every block the
// revision leaves alone is taken from the 1.0.0 wording boundaries unchanged;
// the blocks below replace exactly what the revised page changes. Nothing here
// is a sentence to reuse: the preferred wordings illustrate a stance (section 7).
// =============================================================================

import {
  CHART_TERMINOLOGY,
  PROHIBITED_WORDING_CLASSES,
  REFLECTION_BOUNDARY,
  SOURCE_WARNING_WORDING,
  WORDING_BOUNDARIES,
} from './wording-boundaries.js';
import type { ChartTerm, ProhibitedWordingClass, UncertaintyLanguage } from './wording-boundaries.js';

/** Section 3: rules 3, 4 and 10 revised; rules 11-13 added. */
export const GLOBAL_LANGUAGE_RULES_V1_1 = [
  ...WORDING_BOUNDARIES.globalLanguageRules.map((rule) => {
    switch (rule.ruleId) {
      case 'L3.3':
        return { ruleId: rule.ruleId, text: 'FACT, SYMBOLIC FRAME, INTERPRETATION and REFLECTION remain distinct in substance: the reading\'s structure carries the distinction (paragraph kind and posture); prose does not announce it.' };
      case 'L3.4':
        return { ruleId: rule.ruleId, text: 'Interpretive language never states an identity verdict. SUPPORTED interpretations are stated directly; bounded formulations such as "can be read as", "one possible expression", "may show up as" are reserved for TENTATIVE claims and graph-carried alternative readings.' };
      case 'L3.10':
        return { ruleId: rule.ruleId, text: 'Customer wording may be elegant, BaZi-authentic and legible in everyday language, but never diagnostic, therapeutic, prescriptive or deterministic; it does not replace BaZi terms with pseudo-psychological or coaching vocabulary.' };
      default:
        return { ruleId: rule.ruleId, text: rule.text };
    }
  }),
  { ruleId: 'L3.11', text: 'Customer prose may not sound less certain than a SUPPORTED claim warrants, nor more certain than a TENTATIVE claim, a provisional fact or an unknown birth time allows.' },
  { ruleId: 'L3.12', text: 'The narrative never talks about the source, the validation, the calculation, the pipeline, the plan, its chapters or the reading itself; necessary method and data notes live in the method note only.' },
  { ruleId: 'L3.13', text: 'Concrete, experience-near examples are allowed inside a claim\'s semantic domain; they never present a biography, a person, a place or a life domain as fact. The interpretation is stated directly about the chart; an example is framed as a situation in which the pattern can be recognised ("erkennbar etwa in Momenten, in denen …"), never as the reader\'s behaviour, feeling, ability, habit or frequency ("du … oft"), and never as how other people see the reader.' },
] as const;

const REVISED_TERMS: Readonly<Record<string, Partial<ChartTerm>>> = {
  'BaZi / 八字': { boundary: 'Explain once as a traditional symbolic framework based on the Four Pillars - in the method note or at the first framing, never repeated per claim' },
  'Day Master / 日主': { boundary: '"the reference point of the chart: every other relation is read from it"; never a complete personality type' },
  'Wu Xing / 五行': { boundary: '"Five Elements" may appear as a familiar alias, but customer explanation should prefer phases/relationships rather than substances. Phase names: EN Wood, Fire, Earth, Metal, Water; DE Holz, Feuer, Erde, Metall, Wasser - named as the chart gives them (a phase named in prose is a cited fact); a phase is a symbolic quality, never a substance, temperament or health correspondence' },
  'grounded tension': { customerDe: 'Spannung / zwei Richtungen, die gleichzeitig ziehen', boundary: 'Used only when both poles are independently grounded (CONTRASTS_WITH); then stated plainly, never softened into "the chart cannot say"; never manufacture "both X and not-X" for drama' },
  'alternative reading': { sourceTreatment: 'accepted evidence path required: an ALTERNATIVE_READING relation in the claim graph, or a TENTATIVE claim', boundary: 'Clarifies bounded ambiguity; written only where the graph carries it; may not become an unfalsifiable rainbow statement or a default closing line' },
};

/** Section 4: five cells revised; every other row unchanged. */
export const CHART_TERMINOLOGY_V1_1: readonly ChartTerm[] = CHART_TERMINOLOGY.map((term) => ({ ...term, ...(REVISED_TERMS[term.term] ?? {}) }));

/** Section 6: customer wording is an anchor, not a phrase. */
export const CUSTOMER_WORDING_IS_AN_ANCHOR =
  'the customer-wording columns of sections 5 and 6 name the semantic anchor of a family or relation, not a fixed phrase; a concrete paraphrase inside the allowed semantic domain is permitted as long as it adds no meaning outside the domain and presents no biography, person, place or life domain as fact; a customer word that is also a producer label of a relation (e.g. "Verantwortung") names that relation and appears only where the relation is cited';

/** Section 7: uncertainty language by epistemic class. */
export const UNCERTAINTY_LANGUAGE_V1_1: readonly UncertaintyLanguage[] = [
  { state: 'validated fact', preferredEn: 'Your chart shows …', preferredDe: 'Dein Chart zeigt …', forbidden: 'adding interpretation to the factual sentence; narrating the source or the calculation ("the source lists …")' },
  { state: 'supported interpretation', preferredEn: 'stated directly: "Your chart … - that points to …" / "This shows up as …"', preferredDe: 'direkt: „Dein Chart … – das weist auf … hin.“ / „Das zeigt sich als …“', forbidden: '"This proves …"; "This means you are …"; a template hedge over a SUPPORTED claim ("Within this BaZi framework, this can be read as …")' },
  { state: 'composite hypothesis', preferredEn: '"Taken together, …" - hedged only where a TENTATIVE claim is part of it', preferredDe: '„Zusammengenommen …“ – vorsichtig nur, wo ein TENTATIVE-Claim Teil davon ist', forbidden: 'causal certainty; talking about "these signals" instead of what they say' },
  { state: 'tentative interpretation', preferredEn: 'a visible, varied marker: "One tentative reading is …", "perhaps …", "it may be that …"', preferredDe: 'ein sichtbares, wechselndes Signal: „Vorsichtig gelesen …“, „vielleicht …“, „möglicherweise …“', forbidden: 'laundering tentative input into definitive prose; dropping the marker' },
  { state: 'alternative manifestation', preferredEn: '"Another possible expression is …" - only where the graph carries ALTERNATIVE_READING', preferredDe: '„Eine andere mögliche Ausdrucksform ist …“ – nur wo der Claim-Graph ALTERNATIVE_READING trägt', forbidden: 'opposite-for-everyone rainbow statements' },
  { state: 'reflection', preferredEn: 'a direct question: "Which of the two do you know better?" / "When did you last notice …?"', preferredDe: 'eine direkte Frage: „Welche der beiden Seiten kennst du besser?“ / „Wann hast du zuletzt bemerkt, dass …?“', forbidden: '"You should …"; action plan or prescription; a question that needs BaZi knowledge to answer' },
];
export const UNCERTAINTY_CARRIED_NOT_ADDED_WORDING =
  'customer prose may never sound more certain than its supporting facts/claims - and never less certain than a SUPPORTED claim warrants: uncertainty is carried, not added; the distinction between the states lives in the reading\'s structure (paragraph posture)';

/** Section 8: where the unknown-time statement lives. */
export const UNKNOWN_TIME_PLACEMENT =
  'the unknown-time statement belongs in the method note; the narrative does not repeat it, and hour-dependent material stays omitted or visibly provisional';

/** Section 9: the data note lives in the method note. */
export const SOURCE_WARNING_WORDING_V1_1 = {
  preferred: ['a short data note in the method note: what is provisional, unavailable or source-qualified, in plain words', '"Data note" / „Datenhinweis“ as its label'],
  forbidden: [
    ...SOURCE_WARNING_WORDING.forbidden,
    'assigning a warning an effect on the chart, in either direction',
    'carrying the data note into the narrative chapters',
  ],
  methodRefs: SOURCE_WARNING_WORDING.methodRefs,
} as const;

/** Section 11: one allowed item revised, one added. */
export const REFLECTION_BOUNDARY_V1_1 = {
  allowed: ['reflective hypotheses', 'grounded tensions', 'alternative manifestations', 'questions that invite recognition', 'everyday language about modes, pressures, expression, support and resource handling', 'direct statements of SUPPORTED interpretations'],
  forbidden: REFLECTION_BOUNDARY.forbidden,
} as const;

/** Section 12: the determinism class qualifies "always"/"never" and gains two entries; the other five classes are unchanged. */
export const PROHIBITED_WORDING_CLASSES_V1_1: readonly ProhibitedWordingClass[] = PROHIBITED_WORDING_CLASSES.map((entry) =>
  entry.classId === 'DETERMINISM_CAUSALITY'
    ? {
      classId: entry.classId,
      items: ['proves', 'causes', 'therefore you are', '"always" / "never" as a statement about the person ("you always …")', 'destined', 'guaranteed', '"this explains why you …" as causal certainty', '"fate" / „Schicksal“ as an explanation of the person', '"that is simply who you are" / „so bist du eben“'],
    }
    : entry);

/** The 1.1.0 wording boundaries: the 1.0.0 boundaries with the revised blocks replaced and the new blocks added. */
export const WORDING_BOUNDARIES_V1_1 = {
  ...WORDING_BOUNDARIES,
  globalLanguageRules: GLOBAL_LANGUAGE_RULES_V1_1,
  chartTerminology: CHART_TERMINOLOGY_V1_1,
  customerWordingIsAnAnchor: CUSTOMER_WORDING_IS_AN_ANCHOR,
  uncertaintyLanguage: UNCERTAINTY_LANGUAGE_V1_1,
  uncertaintyCarriedNotAdded: UNCERTAINTY_CARRIED_NOT_ADDED_WORDING,
  unknownTimePlacement: UNKNOWN_TIME_PLACEMENT,
  sourceWarningWording: SOURCE_WARNING_WORDING_V1_1,
  reflectionBoundary: REFLECTION_BOUNDARY_V1_1,
  prohibitedWordingClasses: PROHIBITED_WORDING_CLASSES_V1_1,
} as const;
export type WordingBoundariesV1_1 = typeof WORDING_BOUNDARIES_V1_1;
