// =============================================================================
// ETBZ-56 - the Earthly-Branch animal labels, by output language.
//
// Every page that shows an Earthly Branch shows its animal beside it, as an
// orientation label: `午 · wǔ · Pferd`. The label belongs to the branch, never
// to a Heavenly Stem, and it is a word, not an interpretation - no page reads
// a trait into it and no new method enters with it.
//
// The labels are a released, versioned table, never generated: German is the
// one output language of the template, and its twelve labels are the `tierDe`
// column of the Sizhu table (`src/domain/sizhu.ts`, ETBZ-24, ADR 0003) - the
// vocabulary the HoroscopeModel build already holds every FuFirE `tier` value
// to. The table is frozen by content hash like the registry and the bundle: a
// changed label is a new version, not an edit. A branch without a label, or an
// output language without a table, is refused - nothing falls back to another
// language, a romanisation or a guess.
//
// Does NOT: translate, choose a language from the reader, read the glyph
// contract's English labels (the ETBZ-49 manifest carries them for design
// review only), or know anything about a chart.
// =============================================================================

import { TWELVE_BRANCHES } from '../../domain/sizhu.js';
import { structuralHash } from '../../domain/structural-hash.js';
import { PresentationError } from './errors.js';

export const BRANCH_ANIMAL_LABELS_REF = 'bazodiac-branch-animal-labels@1.0.0' as const;

export const BRANCH_ANIMAL_LOCALES = ['de'] as const;
export type BranchAnimalLocale = (typeof BRANCH_ANIMAL_LOCALES)[number];

export interface BranchAnimalLabels {
  readonly ref: typeof BRANCH_ANIMAL_LABELS_REF;
  /** Per output language, the twelve branches in Zi-to-Hai order: the Hanzi and its animal label. */
  readonly locales: Readonly<Record<BranchAnimalLocale, readonly Readonly<{ branch: string; label: string }>[]>>;
}

/** The released table. Its `de` column is the Sizhu table's `tierDe`, branch for branch. */
export const BRANCH_ANIMAL_LABELS: BranchAnimalLabels = {
  ref: BRANCH_ANIMAL_LABELS_REF,
  locales: {
    de: [
      { branch: '子', label: 'Ratte' },
      { branch: '丑', label: 'Büffel' },
      { branch: '寅', label: 'Tiger' },
      { branch: '卯', label: 'Hase' },
      { branch: '辰', label: 'Drache' },
      { branch: '巳', label: 'Schlange' },
      { branch: '午', label: 'Pferd' },
      { branch: '未', label: 'Ziege' },
      { branch: '申', label: 'Affe' },
      { branch: '酉', label: 'Hahn' },
      { branch: '戌', label: 'Hund' },
      { branch: '亥', label: 'Schwein' },
    ],
  },
};

/** The content hash of every released version of the table. */
export const RELEASED_BRANCH_ANIMAL_LABELS_HASHES: Readonly<Record<string, string>> = {
  [BRANCH_ANIMAL_LABELS_REF]: 'sha256:b885bae1cce42bf219c4baa6a71c4750e177c162629704a26075c327e5a95cb3',
};

function refuse(message: string, detail: Readonly<Record<string, unknown>>): never {
  throw new PresentationError('PRESENTATION_BRANCH_ANIMAL_UNMAPPED', message, detail);
}

/**
 * The table, proven: it hashes to its released identity, carries each of the
 * twelve branches exactly once per language, and its German column equals the
 * Sizhu table branch for branch.
 */
export function assertReleasedBranchAnimalLabels(table: BranchAnimalLabels = BRANCH_ANIMAL_LABELS): void {
  const released = RELEASED_BRANCH_ANIMAL_LABELS_HASHES[table.ref];
  const actual = structuralHash(table);
  if (released === undefined || released !== actual) {
    refuse(`the branch animal table ${table.ref} hashes to ${actual}, not to its released identity`, { ref: table.ref, actual });
  }
  for (const locale of BRANCH_ANIMAL_LOCALES) {
    const entries = table.locales[locale];
    const branches = entries.map((entry) => entry.branch);
    const expected = TWELVE_BRANCHES.map((entry) => entry.hanzi);
    if (branches.length !== expected.length || branches.some((branch, index) => branch !== expected[index])) {
      refuse(`the ${locale} branch animal table does not list the twelve branches in order`, { locale });
    }
    if (entries.some((entry) => entry.label.trim() === '' || entry.label.trim() !== entry.label)) {
      refuse(`the ${locale} branch animal table carries an empty or padded label`, { locale });
    }
  }
  const sizhu = TWELVE_BRANCHES.map((entry) => entry.tierDe);
  if (table.locales.de.some((entry, index) => entry.label !== sizhu[index])) {
    refuse('the German branch animal labels differ from the Sizhu table', { locale: 'de' });
  }
}

/**
 * The animal label of one Earthly Branch in one output language. A character
 * that is not one of the twelve branches, or a language without a released
 * table, is refused - never answered with a fallback.
 */
export function branchAnimalLabel(branch: string, locale: string): string {
  if (!(BRANCH_ANIMAL_LOCALES as readonly string[]).includes(locale)) {
    return refuse(`no released branch animal table for the output language "${locale}"`, { locale });
  }
  const entry = BRANCH_ANIMAL_LABELS.locales[locale as BranchAnimalLocale].find((candidate) => candidate.branch === branch);
  if (entry === undefined) return refuse(`${branch} is not an Earthly Branch of the released table`, { locale, character: branch });
  return entry.label;
}
