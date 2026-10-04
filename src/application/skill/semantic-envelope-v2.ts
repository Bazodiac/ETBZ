// =============================================================================
// ETBZ-77 (Canon v2, A1) - the Interpretation Lens v2 as values.
//
// `grounded-reflective-synthesis-lens@2.0.0` is Confluence 85229569 "ETBZ — C1
// Interpretationsregeln v2", page version 1 (Canon v2, Product Owner decision
// of 2026-10-04). It replaces the Lens 1.0/1.1 in content: it is NOT the 1.1
// envelope with blocks swapped. Nothing here is spread from the 1.x modules,
// and no 1.x block (the Ten-God envelopes, the depth operators, the metaphor
// rule, ...) is part of 2.0.0. Canon v2 puts meaning in the Bedeutungslexikon
// (C3, ETBZ-94) and methods in Method Profile v2 (C2, ETBZ-78); ADR 0019 lists
// every 1.x block with the C1/C5 section that addresses its topic.
//
// Every rule text is C1's text as the page renders it: German, characters
// unchanged (C1 closes its „…" quotations with a straight quote, and that is
// kept), markdown emphasis and code marks removed. Every block names its
// section by C1's own heading. `(Kopf)` is the header above the first heading:
// its rules and its status are carried here; its decision line (Canon v2, PO,
// 2026-10-04) is `CANON_V2_DECISION` and the source's `releasedOn`, and its
// "Ersetzt …" paragraph is the supersession record (`contract-sources-v2.ts`).
// `(Schluss)` is the closing paragraph below the last list. Identifiers -
// `lineId`, `partId`, `ownedBy`, the binding and the section labels - are this
// module's labels, not page text.
//
// It carries no method reference, no fact and no number: the counts C1 states
// ("1–2", "8–12", "≤ 15 %") are text here, and enforcing them is the work of
// the gates (Epic B) and of the contracts that own them (A3, A4).
// =============================================================================

import type { ContractKey } from './contract-sources.js';
import type { LensSection } from './semantic-envelope.js';

const c1 = (section: string): LensSection => ({ contract: 'INTERPRETATION_LENS', section });

/** C1's sections in page order: the coverage list every block's `source` is checked against. */
export const C1_SECTIONS = [
  '(Kopf)',
  'Grundsatz',
  'Zone A – Rote Linien (hart, maschinell geprüft)',
  'Zone B – Herkunftsmarker statt Absicherung',
  'Zone C – Freiraum',
  'Vorstoß-Kontrakt (Herzstück)',
  'Licht/Schatten-Kontrakt',
  'Tierüberlieferung (branch_animal_lore)',
  'Spannung',
  'Zählwörter und Zahlen',
  'Kapitellänge und Füllquote',
  'Ausdrücklich abgeschafft (altes Modell)',
  '(Schluss)',
] as const;

/** The page's own rules about itself and its status, from the header above the first heading. */
export const PAGE_RULES_V2 = {
  status: 'Normative Zielarchitektur.',
  redLinesPrevail: 'Rote Linien (Zone A) haben immer Vorrang.',
  releaseRule: 'Die Umsetzung gilt erst als released, wenn die zugehörigen Jira-Tickets über scripts/ci-verify.sh grün sind.',
  source: c1('(Kopf)'),
} as const;

export const PRINCIPLE_V2 = {
  text: 'Ehrlichkeit entsteht durch die Kennzeichnung der Quelle, nicht durch das Abschwächen der Aussage. Sicherheit liegt an den roten Linien, nicht in jedem einzelnen Satz.',
  source: c1('Grundsatz'),
} as const;

/** Zone A: the red lines, hard and machine-checked. Numbered as on the page. */
export const RED_LINES = {
  lines: [
    { lineId: 'RL-1', text: 'Keine Vorhersage von Ereignissen oder Zukunft. Keine Gesundheit, keine Organe, keine Diagnosen. Keine Ergebnisse zu Geld, Karriere oder dem Ausgang einer Beziehung.' },
    { lineId: 'RL-2', text: 'Keine Behauptung über reale Personen oder Biografie („deine Mutter …", „in deiner Kindheit …"). Archetypische Rollen in Szenen sind erlaubt („jemand, der dir eine Deadline setzt").' },
    { lineId: 'RL-3', text: 'Keine Pathologie- oder Abwertungslabels (narzisstisch, toxisch, gestört, Syndrom, Trauma) und keine Schuldzuweisung.' },
    { lineId: 'RL-4', text: 'Kein Fatalismus („so bist du eben", Schicksal).' },
    { lineId: 'RL-5', text: 'Keine erfundenen Chartfakten. Symbole und Zahlen müssen zitiert sein.' },
    { lineId: 'RL-6', text: 'Keine Stereotype zu Geschlecht oder Herkunft und keine geschlechtsabhängigen Partnerschaftsregeln.' },
    { lineId: 'RL-7', text: 'Methodentreue: nur Methoden, die in Method Profile v2 (C2) freigegeben sind.' },
    { lineId: 'RL-8', text: 'Schattensätze greifen nie den Wert der Person an.' },
  ],
  source: c1('Zone A – Rote Linien (hart, maschinell geprüft)'),
} as const;

/** Zone B: origin markers instead of hedging - the form each statement type takes. */
export const ORIGIN_MARKERS = {
  statementTypes: [
    { statementType: 'Chartbefund', form: '„Dein Chart zeigt …"' },
    { statementType: 'Tradition', form: '„Dem Affen sagt man nach …", „klassisch steht die Stundensäule für …". Höchstens einmal pro Motiv im Text; im Layout zusätzlich das grafische Etikett „Überlieferung".' },
    { statementType: 'Deutung', form: 'direkt, 2. Person, mit Kontrast („Du gehst eher von X aus als von Y")' },
    { statementType: 'Vorstoß', form: 'pointiert, widerlegbar, mit Prüffrage' },
    { statementType: 'Vorläufig', form: 'nur bei echter Datenunsicherheit (unbekannte Geburtszeit, vorläufiges Feld), dann sichtbar vorsichtig' },
  ],
  source: c1('Zone B – Herkunftsmarker statt Absicherung'),
} as const;

/** Zone C: the free zone, its closed list of experience fields and the pillars as classical rooms. */
export const FREE_ZONE = {
  text: 'Stil, Humor, Bilder, Jahreszeiten als Bild, Tiere und Alltagsszenen aus den Erlebensfeldern.',
  experienceFields: {
    rule: 'Erlebensfelder (geschlossene Liste; erlaubt als Szene, nie als Ergebnis oder Biografie):',
    fields: [
      'Arbeit und Projekte',
      'Team und Kolleg:innen als Rollen',
      'Entscheiden',
      'Lernen',
      'Umgang mit Dingen, Zeit und Geld (der Umgang, nie Betrag oder Ausgang)',
      'Nähe, Beziehung, Freundschaft (als Muster, nie als Prognose)',
    ],
  },
  pillarRooms: {
    rule: 'Säulen als klassische Räume (als Rahmen gekennzeichnet, nie wörtliche Biografie):',
    rooms: [
      { pillar: 'Jahr', room: 'Herkunft und erster Eindruck' },
      { pillar: 'Monat', room: 'Wirkungsfeld und Grundton' },
      { pillar: 'Tagesstamm', room: 'du selbst' },
      { pillar: 'Tageszweig', room: 'Nähe' },
      { pillar: 'Stunde', room: 'Werk und was bleibt' },
    ],
  },
  source: c1('Zone C – Freiraum'),
} as const;

/** The Vorstoß contract ("Herzstück"): five parts, and how often. */
export const VORSTOSS_CONTRACT = {
  rule: 'Jeder Vorstoß hat fünf Teile:',
  parts: [
    { partId: 'ANKER', text: 'einen Anker in mindestens einem zitierten Chartbefund;' },
    { partId: 'THESE', text: 'eine These in der 2. Person mit Kontrast;' },
    { partId: 'SZENE', text: 'eine Alltagsszene mit Gegenstand und Handlung;' },
    { partId: 'LICHT_UND_SCHATTEN', text: 'Licht UND Schatten aus demselben Muster;' },
    { partId: 'PRUEFFRAGE', text: 'eine Prüffrage, beantwortbar mit Ja / Nein / Teilweise.' },
  ],
  frequency: 'Pro Kapitel 1–2 Vorstöße, pro Reading 8–12. Ein Kapitel ohne Vorstoß gilt als „lauwarm" und wird abgelehnt. Der Plan markiert Vorstöße als peakClaims (eine Markierung, keine Zahl).',
  source: c1('Vorstoß-Kontrakt (Herzstück)'),
} as const;

export const LIGHT_SHADOW_CONTRACT = {
  rule: 'Jedes Hauptmotiv bekommt seine Schattenseite.',
  shadowDefinition: 'Schatten heißt: die Kosten, die Übertreibung oder der blinde Fleck einer benannten Stärke.',
  dignityTest: 'Würde-Test: Laut vorgelesen ist der Satz wiedererkennbar, ohne die Person bloßzustellen.',
  source: c1('Licht/Schatten-Kontrakt'),
} as const;

/** Animal lore. The method itself is Method Profile v2's (ETBZ-78); the curated entries are ETBZ-95's. */
export const ANIMAL_LORE_CONTRACT = {
  rules: [
    'Eigenschaften kommen nur aus einem kuratierten Lexikon mit Quellenangabe. Bis ein Eintrag belegt ist, hat er den Status SOURCE_NEEDED und autorisiert keine Kundendeutung.',
    'Bindungspflicht: Eine Überlieferung steht nie allein. Im selben Absatz bricht oder schärft sie mindestens ein chart-spezifischer Befund.',
    'Das Jahrestier ist klassische Volksüberlieferung. Tag- oder Stundentier als „inneres/geheimes Tier" ist eine moderne populäre Lesart und wird so gekennzeichnet.',
  ],
  /** The status an entry without a source carries; it authorises no customer interpretation. */
  unsourcedStatus: 'SOURCE_NEEDED',
  source: c1('Tierüberlieferung (branch_animal_lore)'),
} as const;

export const TENSION_RULE_V2 = {
  text: 'Spannung ist erlaubt zwischen zwei zitierten Polen: Fakt/Fakt, Claim/Claim oder Überlieferung/Chart. Sie wird klar ausgesprochen und nicht in Harmonie aufgelöst.',
  poles: ['Fakt/Fakt', 'Claim/Claim', 'Überlieferung/Chart'],
  source: c1('Spannung'),
} as const;

export const COUNT_WORDS_AND_NUMBERS = {
  countWords: 'Zählwörter sind erlaubt, wenn sich die Zählung aus den zitierten Fakten nachprüfen lässt.',
  numbers: 'Zahlen erscheinen als gerundeter Anzeigewert des zitierten Fakts: eine Nachkommastelle, deutsches Komma.',
  source: c1('Zählwörter und Zahlen'),
} as const;

/**
 * Quoted so the Lens is a complete record of C1, decided by neither: chapter
 * length is the Long-Form contract's domain (v2: ETBZ-80), the filler ratio
 * the Anti-Boilerplate contract's (v2: ETBZ-79).
 */
export const CHAPTER_LENGTH_AND_FILLER = {
  rules: [
    { text: 'Kapitel: 300–600 Wörter.', ownedBy: 'LONG_FORM' satisfies ContractKey },
    { text: 'Füllquote ≤ 15 %. Füllsätze sind Sätze ohne Anker, Bedeutung oder Szene.', ownedBy: 'ANTI_BOILERPLATE' satisfies ContractKey },
  ],
  source: c1('Kapitellänge und Füllquote'),
} as const;

/** What C1 abolishes from the 1.x model, quoted. Every item stays in the 1.x contracts for the runs bound to them. */
export const SUPERSEDED_MODEL = {
  items: [
    'Rahmungspflicht „erkennbar etwa in Momenten, in denen …" (L3.13, SKILL Law 10) und jede Variante davon.',
    'Verbot von Tendenzaussagen in der 2. Person.',
    'Pauschales Verbot von Lebensbereichen (LIFE_DOMAIN_WORDS in der 1.x-Form).',
    'Verbot zu beschreiben, wie andere die Person erleben.',
    'Verbot von Jahreszeiten als Bild.',
    'Verbot typischer Eigenschaften der Tierzeichen.',
    'Pauschales Verbot von Zählwörtern.',
    'Absicherungsformeln aller Art: „kann gelesen werden", „mögliche Lesart", „Innerhalb dieses BaZi-Rahmens", „nach der Überlieferung" / „gilt als" / „Lehrmeinung" in jedem Satz.',
    'Das Wort „Stimme" als Ersatz für Rollen.',
    'Kapitellänge 600–900 Wörter.',
  ],
  source: c1('Ausdrücklich abgeschafft (altes Modell)'),
} as const;

/**
 * C1 hands voice and wording to C5. The binding names the contract that
 * carries C5 (the Lexicon v2) at the page version it binds; the 2.0 context
 * refuses a Lens whose binding disagrees with the Lexicon it is released with.
 */
export const VOICE_AUTHORITY = {
  text: 'Stimme und Formulierung regelt verbindlich: C5 Style Guide v3.',
  binding: {
    contractRef: 'terminology-wording-lexicon@2.0.0',
    confluencePageId: '85164034',
    confluencePageVersion: '1',
  },
  source: c1('(Schluss)'),
} as const;

/** Everything the Lens v2 assembles - the content its release hash freezes. */
export const SEMANTIC_ENVELOPE_V2 = {
  pageRules: PAGE_RULES_V2,
  principle: PRINCIPLE_V2,
  redLines: RED_LINES,
  originMarkers: ORIGIN_MARKERS,
  freeZone: FREE_ZONE,
  vorstossContract: VORSTOSS_CONTRACT,
  lightShadowContract: LIGHT_SHADOW_CONTRACT,
  animalLoreContract: ANIMAL_LORE_CONTRACT,
  tensionRule: TENSION_RULE_V2,
  countWordsAndNumbers: COUNT_WORDS_AND_NUMBERS,
  chapterLengthAndFiller: CHAPTER_LENGTH_AND_FILLER,
  supersededModel: SUPERSEDED_MODEL,
  voiceAuthority: VOICE_AUTHORITY,
} as const;
export type SemanticEnvelopeV2 = typeof SEMANTIC_ENVELOPE_V2;
