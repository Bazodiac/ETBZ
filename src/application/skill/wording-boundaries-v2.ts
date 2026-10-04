// =============================================================================
// ETBZ-77 (Canon v2, A1) - the Terminology & Wording Lexicon v2 as values.
//
// `terminology-wording-lexicon@2.0.0` is Confluence 85164034 "ETBZ — Style
// Guide v3 (kanonisch, einzige zulässige Stimme)", page version 1 (Canon v2,
// C5). C1 hands voice and wording to it ("Stimme und Formulierung regelt
// verbindlich: C5"), so the Lexicon v2 is C5 - and C5 declares its text
// "wörtlich verbindlich" and not to be paraphrased. The text is therefore
// carried whole, block by block and line by line, exactly as the page's code
// block holds it; `styleGuideV3Text()` joins it back into those bytes, which is
// what SKILL.md 2.0.0 (ETBZ-91, C-1) must bind byte for byte.
//
// Nothing is spread from the 1.x wording boundaries: C5 replaces the Lexicon
// 1.0/1.1 in content (Canon v2 hub, precedence 1). No sentence here is a phrase
// to reuse except where C5 itself prescribes the form (the Deutungskette); the
// calibration paragraphs are about the synthetic fixture chart 庚午 · 壬午 · 辛亥
// · 乙未 and about no real person. No method reference, no fact, no number.
// =============================================================================

import { deepFreeze } from './deep-freeze.js';
import type { LexiconSection } from './wording-boundaries.js';

const c5 = (section: string): LexiconSection => ({ contract: 'TERMINOLOGY_LEXICON', section });

/**
 * C5's parts in page order. C5 has no headings: `(Kopf)` is the quoted header,
 * `(Codeblock)` the style guide itself, `Bindung` the closing paragraph.
 */
export const C5_SECTIONS = ['(Kopf)', '(Codeblock)', 'Bindung'] as const;

/**
 * The page's header: the authority it claims and the precedence it concedes. Its
 * decision line (Canon v2, PO, 2026-10-04, hub) is `CANON_V2_DECISION` and the
 * source's `releasedOn`; it is not repeated here.
 */
export const STYLE_GUIDE_AUTHORITY = {
  onlyAdmissibleVoice: 'Dies ist die einzige zulässige Art, Interpretationstexte im Chart zu formulieren.',
  verbatim: 'Der folgende Text ist wörtlich verbindlich und darf nicht paraphrasiert werden.',
  redLinesPrevail: 'Rote Linien (Zone A, siehe C1) haben Vorrang.',
  /** The contract that carries those red lines (C1), at the page version this release binds. */
  redLinesBinding: {
    contractRef: 'grounded-reflective-synthesis-lens@2.0.0',
    confluencePageId: '85229569',
    confluencePageVersion: '1',
  },
  source: c5('(Kopf)'),
} as const;

export interface StyleGuideBlock {
  /** The block's first line, as on the page. */
  readonly block: string;
  /** Its following lines, in order. */
  readonly lines: readonly string[];
}

/** The page's code block, block by block. Blocks are separated by one empty line on the page. */
export const STYLE_GUIDE_V3_BLOCKS: readonly StyleGuideBlock[] = [
  {
    block: 'ZIELSTIMME',
    lines: [
      'Ein kluger, trockener Freund, der BaZi kennt und keine Esoterik braucht. Direkt, pointiert, alltagsnah, auf Augenhöhe. Trockener Humor erlaubt; Ironie trifft Situationen, nie die Person. BaZi-authentisch statt pseudo-psychologisch: keine Therapie-, Coaching- oder Diagnosesprache.',
      'HUMOR_LEVEL: 0 | 1 (Default: eine Pointe pro Kapitel) | 2.',
    ],
  },
  {
    block: 'GRUNDSATZ',
    lines: [
      'Die Berechnung ist der Beweis, die Sprache die Übersetzung. Jeder Satz über die Person gibt einen akzeptierten Claim wieder und nennt nur Fakten, die dieser Claim zitiert.',
    ],
  },
  {
    block: 'DEUTUNGSKETTE (pro Interpretationsabsatz)',
    lines: [
      '1. ANKER: „Dein Chart zeigt …" – Position(en) beim Namen, Symbol nur als zitierter Fakt. Produzenten-Label einmal als Anker, danach deutscher Rollenname.',
      '2. BEDEUTUNG: direkt, 2. Person, mit Kontrast: „Für dich heißt das: Du … eher … als …"',
      '3. SZENE (1–2 Sätze): wiedererkennbare Lage aus einem Erlebensfeld, mit Gegenstand und Handlung, gern wörtliche Rede; archetypische Rollen statt realer Personen. Formen: „Du merkst das, wenn …" oder „Andere sagen: »…« – du hörst: »…«". Einleitung variieren; dieselbe Formel max. 2× pro Reading.',
      '4. PREIS: „Der Nutzen: … Der Preis: …" – beides aus demselben Muster.',
      '5. KERNSATZ am Kapitelende: ≤ 14 Wörter, zitierfähig.',
    ],
  },
  {
    block: 'ROLLENNAMEN (Rollenname zuerst, Hanzi in Klammern)',
    lines: [
      'Weggefährte (比肩), Rivale (劫财), Macher (食神), Rebell (伤官), Verwalter (正财), Gelegenheitsjäger (偏财), Schiedsrichter (正官), Herausforderer (七杀), Mentor (正印), Querdenker (偏印).',
    ],
  },
  {
    block: 'REFLEXIONSFRAGE',
    lines: [
      'Direkt, mit Ja / Nein / Teilweise beantwortbar, auf eine erinnerbare Lage der letzten Wochen bezogen, ohne BaZi-Wissen beantwortbar. Keine zwei Fragen mit gleichem Satzanfang, keine semantischen Dubletten.',
    ],
  },
  {
    block: 'WORTREGELN',
    lines: [
      '- Herkunftsmarker „Überlieferung / Tradition" max. 1× pro Motiv.',
      '- Max. 1 Tendenzwort („oft", „eher", „meist") pro Absatz außerhalb der Kontrastformel; verboten: „könnte hindeuten", „möglicherweise" (außer bei vorläufigen Daten), „in gewisser Weise", „Erkennbar etwa in Momenten".',
      '- Das Wort „Stimme" ist verboten. Max. 2 Hanzi pro Absatz.',
      '- Zahlen nur als gerundeter zitierter Wert; Zählwörter nur, wenn aus Zitaten nachprüfbar.',
      '- Rote Linien gemäß Zone A.',
    ],
  },
  {
    block: 'SPEZIFITÄTSTEST',
    lines: [
      'Gilt der Absatz genauso für ein Chart mit anderem Tagesmeister UND anderer Position desselben Motivs? Dann umschreiben oder streichen.',
    ],
  },
  {
    block: 'KALIBRIERUNG (synthetisches Fixture-Chart 庚午 · 壬午 · 辛亥 · 乙未, Tagesmeister 辛)',
    lines: [
      'Gut:',
      '„Dein Chart zeigt im Wirkungsfeld oben den Rebellen (伤官) und direkt darunter, im Pferd, den Herausforderer (七杀). Für dich heißt das: Du widersprichst eher, als dass du dich fügst – und genau dort, wo du widersprichst, wartet harter Druck. Du merkst das, wenn du in der Besprechung »So machen wir das nicht« schon gesagt hast, bevor klar ist, wer hier entscheidet. Der Nutzen: Du siehst Schwächen früher als andere. Der Preis: Du ziehst Gegenwind an, den du dir hättest sparen können."',
      'Gut (Bild + Überlieferung, einmal markiert):',
      '„Dein Tagesmeister 辛 ist das Juwel. Die Überlieferung sagt, ein Juwel will vom großen Fluss gewaschen werden – und unter dir, im Schwein, fließt genau dieser Fluss als Rebell. Für dich heißt das: Du glänzt eher im Widerspruch als im Applaus."',
      'Schlecht (alte Formel, keine Bedeutung):',
      '„Erkennbar etwa in Momenten, in denen eine Anforderung keinen Aufschub zulässt."',
      'Schlecht (Positionsbeschreibung):',
      '„Vom Tagesmeister aus trägt er in der Jahressäule wie in der Stundensäule dieselbe Stimme."',
      'Schlecht (Absicherung über Quelle):',
      '„Nach der Überlieferung gilt dies als Lehrmeinung und könnte auf eine gewisse Eigenständigkeit hindeuten."',
    ],
  },
  {
    block: 'ZIEL',
    lines: [
      '„Ja, genau so" oder „Nein, das bin ich nicht". Beides ist Erfolg. Lauwarm ist Misserfolg.',
    ],
  },
];

/** The block names in page order - what the 2.0 context checks the blocks against. */
export const STYLE_GUIDE_V3_BLOCK_NAMES = [
  'ZIELSTIMME',
  'GRUNDSATZ',
  'DEUTUNGSKETTE (pro Interpretationsabsatz)',
  'ROLLENNAMEN (Rollenname zuerst, Hanzi in Klammern)',
  'REFLEXIONSFRAGE',
  'WORTREGELN',
  'SPEZIFITÄTSTEST',
  'KALIBRIERUNG (synthetisches Fixture-Chart 庚午 · 壬午 · 辛亥 · 乙未, Tagesmeister 辛)',
  'ZIEL',
] as const;

/**
 * The style guide as the page's code block holds it: each block its name line
 * and its lines joined by a line feed, blocks separated by one empty line, and
 * the closing line feed the code block ends with.
 */
export function styleGuideV3Text(blocks: readonly StyleGuideBlock[] = STYLE_GUIDE_V3_BLOCKS): string {
  return `${blocks.map((entry) => [entry.block, ...entry.lines].join('\n')).join('\n\n')}\n`;
}

/** The page's closing paragraph: who binds the text, and how. */
export const STYLE_GUIDE_BINDING = {
  text: 'Bindung: SKILL.md 2.0.0 (Ticket C-1) bindet diesen Text vollständig. Ein Contract-Test prüft die Bindung byte-genau. Ein Mutant, der einen Schritt der Deutungskette entfernt, muss rot werden.',
  source: c5('Bindung'),
} as const;

/** Everything the Lexicon v2 assembles - the content its release hash freezes. */
export const WORDING_BOUNDARIES_V2 = {
  authority: STYLE_GUIDE_AUTHORITY,
  styleGuide: {
    blocks: STYLE_GUIDE_V3_BLOCKS,
    source: c5('(Codeblock)'),
  },
  binding: STYLE_GUIDE_BINDING,
} as const;
export type WordingBoundariesV2 = typeof WORDING_BOUNDARIES_V2;

// Handed out by reference: frozen where defined (see deep-freeze.ts).
deepFreeze(WORDING_BOUNDARIES_V2);
deepFreeze(STYLE_GUIDE_V3_BLOCK_NAMES);
deepFreeze(C5_SECTIONS);
