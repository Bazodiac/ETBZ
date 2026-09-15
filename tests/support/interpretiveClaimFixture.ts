/**
 * ETBZ-30 C2 test support — the shared baseline for the interpretive claim
 * graph.
 *
 * Both the unit suite and the negative suite start from the SAME verified
 * answer and change exactly one thing, which is what lets a red assertion name
 * one cause. Keeping that baseline here rather than in each file is what makes
 * "the only difference is the mutation" true across both suites instead of
 * true twice by coincidence.
 *
 * THE STATEMENTS ARE NOT DECORATIVE. Each one was measured against
 * `findUncitedSymbols` and `findUncitedNumerals` with an EMPTY covered set, so
 * it names no chart symbol and states no number under ANY grounding. A baseline
 * whose statements happened to be legal only because of the facts they cite
 * would turn every unrelated mutation into a symbol refusal.
 *
 * The chart is the synthetic ETBZ-24/25 fixture chart; no real person's birth
 * data exists in this repository.
 */
import { expect } from 'vitest';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { InterpretiveClaimError } from '../../src/application/interpretation/errors.js';
import type { InterpretiveClaimErrorCode } from '../../src/application/interpretation/errors.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { buildNarrativeChain } from '../../src/application/interpretation/narrative-brief.js';
import type { NarrativeBrief } from '../../src/application/interpretation/narrative-brief.js';
import { knownTimeModel, unknownTimeModel } from './narrativeFixture.js';

export const KNOWN_MODEL: HoroscopeModel = knownTimeModel();
export const KNOWN_CHAIN = buildNarrativeChain(KNOWN_MODEL);
export const KNOWN_BRIEF: NarrativeBrief = KNOWN_CHAIN.brief;

export const UNKNOWN_MODEL: HoroscopeModel = unknownTimeModel();
export const UNKNOWN_CHAIN = buildNarrativeChain(UNKNOWN_MODEL);
export const UNKNOWN_BRIEF: NarrativeBrief = UNKNOWN_CHAIN.brief;

/** Approved, narratable primary themes. */
export const SELF_ROLE_THEME = 'primary.self_role';
export const SEASONAL_THEME = 'primary.seasonal_anchor';
export const ELEMENTAL_THEME = 'primary.elemental_profile';
/** A CANDIDATE ThemeGraph id: readable nuance, never authorization. */
export const CANDIDATE_THEME = 'theme.dayMaster';

/** Facts of the fixture chart, with the values the chart really carries. */
export const MONTH_COMMAND_FACT = 'chart.natal.monthCommand.branch';
export const MONTH_COMMAND_VALUE = 'Wu';
export const DOMINANT_FACT = 'chart.wuxing.dominant';
export const DOMINANT_VALUE = 'Feuer';
/** Provisional ONLY in the unknown-time chart; certain in the known-time one. */
export const HOUR_TIER_FACT = 'chart.pillar.hour.tier';
export const HOUR_TIER_VALUE = 'Ziege';

export const STATEMENT_SELF_ROLE =
  'Der Tagesmeister traegt die Rolle, aus der die uebrigen Positionen gelesen werden.';
export const STATEMENT_SEASONAL =
  'Das Monatskommando setzt den saisonalen Rahmen, in dem diese Rolle gelesen wird.';
export const STATEMENT_ELEMENTAL =
  'Die elementare Verteilung zeigt, worauf sich die Aufmerksamkeit dieser Karte verteilt.';
export const STATEMENT_OPEN =
  'Diese Lesart bleibt offen und wird nicht als gesichert behauptet.';

/**
 * Plain JSON, so a negative case can hold a value the TypeScript type forbids.
 * The same shape the C1 contract test uses, for the same reason.
 */
export interface MutableFactRef {
  factId: string;
  value: string;
}
export interface MutableClaim {
  draftRef: string;
  statement: string;
  factRefs: MutableFactRef[];
  themeRefs: string[];
  epistemicClass: string;
}
export interface MutableRelation {
  from: string;
  type: string;
  to: string;
}
export interface MutableSynthesis {
  providerId: string;
  briefStructuralHash: string;
  claims: MutableClaim[];
  relations: MutableRelation[];
}

export const BASELINE_PROVIDER_ID = 'etbz-30.test.synthesis-provider';

/**
 * The verified baseline: three claims covering all three grounding shapes, and
 * two relations between them.
 *
 *  - self role     theme-only grounding, supported;
 *  - seasonal      fact-only grounding, supported;
 *  - elemental     both, and TENTATIVE with no provisional fact in sight, which
 *                  is the control proving tentative is not merely what
 *                  provisional claims are forced into.
 */
export function validSynthesisJson(brief: NarrativeBrief = KNOWN_BRIEF): MutableSynthesis {
  return {
    providerId: BASELINE_PROVIDER_ID,
    briefStructuralHash: brief.structuralHash,
    claims: [
      {
        draftRef: 'claim-self-role',
        statement: STATEMENT_SELF_ROLE,
        factRefs: [],
        themeRefs: [SELF_ROLE_THEME],
        epistemicClass: 'SUPPORTED_INTERPRETATION',
      },
      {
        draftRef: 'claim-seasonal',
        statement: STATEMENT_SEASONAL,
        factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
        themeRefs: [],
        epistemicClass: 'SUPPORTED_INTERPRETATION',
      },
      {
        draftRef: 'claim-elemental',
        statement: STATEMENT_ELEMENTAL,
        factRefs: [{ factId: DOMINANT_FACT, value: DOMINANT_VALUE }],
        themeRefs: [ELEMENTAL_THEME],
        epistemicClass: 'TENTATIVE_INTERPRETATION',
      },
    ],
    relations: [
      { from: 'claim-seasonal', type: 'QUALIFIES', to: 'claim-self-role' },
      { from: 'claim-elemental', type: 'CONTEXTUALIZES', to: 'claim-self-role' },
    ],
  };
}

/** The baseline with its claims replaced; relations are dropped with them. */
export function withClaims(
  claims: MutableClaim[],
  relations: MutableRelation[] = [],
  brief: NarrativeBrief = KNOWN_BRIEF,
): MutableSynthesis {
  return { ...validSynthesisJson(brief), claims, relations };
}

/** The baseline with one relation list replaced. */
export function withRelations(
  relations: MutableRelation[],
  brief: NarrativeBrief = KNOWN_BRIEF,
): MutableSynthesis {
  return { ...validSynthesisJson(brief), relations };
}

/** A single well-formed claim, for cases that mutate exactly one field. */
export function singleClaimJson(overrides: Partial<MutableClaim> = {}): MutableClaim {
  return {
    draftRef: 'claim-seasonal',
    statement: STATEMENT_SEASONAL,
    factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
    themeRefs: [],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
    ...overrides,
  };
}

export function expectClaimRefusal(
  code: InterpretiveClaimErrorCode,
  model: HoroscopeModel,
  brief: NarrativeBrief,
  synthesisOutput: unknown,
): void {
  try {
    buildInterpretiveClaimGraph({ model, brief, synthesisOutput });
  } catch (error) {
    if (error instanceof InterpretiveClaimError) {
      expect(error.code).toBe(code);
      return;
    }
    throw error;
  }
  expect.unreachable(`expected the claim graph to be refused with ${code}`);
}
