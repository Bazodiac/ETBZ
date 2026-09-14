/**
 * ETBZ-30 C3 test support — the shared baseline for the MetaNarrativePlan.
 *
 * Both the unit suite and the negative suite start from the SAME accepted claim
 * graph and the SAME verified plan, and change exactly one thing, which is what
 * lets a red assertion name one cause. Keeping that baseline here rather than in
 * each file is what makes "the only difference is the mutation" true across both
 * suites instead of true twice by coincidence.
 *
 * THE STATEMENTS ARE NOT DECORATIVE. Every statement below was measured against
 * `findUncitedSymbols`, `findUncitedNumerals` and `findOutOfScopeMethod` with an
 * EMPTY covered set, so each is legal under ANY grounding. That matters more
 * here than in C2: the lexicon reserves ordinary German words (`Erde`, `Feuer`,
 * `Rivale`, `Verantwortung`) and bare pinyin (`wu`, `wei`, `yin`), so a baseline
 * whose prose happened to be legal only because of the claims it cites would
 * turn every unrelated mutation into a symbol refusal.
 *
 * THE BASELINE GRAPH CARRIES FOUR CLAIMS, not C2's three. Three claims can
 * anchor three motifs, but they cannot also supply two disjoint tension pairs —
 * and a baseline that could not express a `CONTRASTS_WITH` alongside a
 * `QUALIFIES` would leave the tension-coverage rules testable only through
 * their own failures.
 *
 * The chart is the synthetic ETBZ-24/25 fixture chart; no real person's birth
 * data exists in this repository.
 */
import { expect } from 'vitest';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import { MetaNarrativePlanError } from '../../src/application/interpretation/errors.js';
import type { MetaNarrativePlanErrorCode } from '../../src/application/interpretation/errors.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { buildMetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { NarrativeBrief } from '../../src/application/interpretation/narrative-brief.js';
import {
  DOMINANT_FACT,
  DOMINANT_VALUE,
  ELEMENTAL_THEME,
  KNOWN_BRIEF,
  KNOWN_MODEL,
  MONTH_COMMAND_FACT,
  MONTH_COMMAND_VALUE,
  SELF_ROLE_THEME,
  STATEMENT_ELEMENTAL,
  STATEMENT_SEASONAL,
  STATEMENT_SELF_ROLE,
  withClaims,
} from './interpretiveClaimFixture.js';
import type { MutableSynthesis } from './interpretiveClaimFixture.js';

export { KNOWN_BRIEF, KNOWN_MODEL } from './interpretiveClaimFixture.js';

/** The fourth narratable primary theme of this chart. */
export const POSITIONAL_THEME = 'primary.positional_context';

// --- measured statements ---------------------------------------------------

/** The fourth claim's own interpretation. */
export const STATEMENT_POSITIONAL =
  'Die Anordnung der Positionen zeigt, woher die Spannung dieser Lesung kommt.';

export const PLAN_THESIS =
  'Diese Lesung verbindet die tragende Rolle der Karte mit dem saisonalen Rahmen und der ungleichen Verteilung der Aufmerksamkeit zu einem durchgehenden Bogen.';

export const PLAN_THESIS_ALT =
  'Diese Lesung liest die tragende Rolle der Karte durch den saisonalen Rahmen hindurch und haelt die offene Frage der Gewichtung sichtbar.';

export const MOTIF_STATEMENT_ROLE =
  'Die tragende Rolle kehrt als Bezugspunkt jeder weiteren Beobachtung wieder.';
export const MOTIF_STATEMENT_SEASON =
  'Der saisonale Rahmen begrenzt, wie weit diese Rolle ausgreift.';
export const MOTIF_STATEMENT_SPREAD =
  'Die Verteilung der Aufmerksamkeit bleibt ungleich und zieht die Lesung in eine Richtung.';
export const MOTIF_STATEMENT_MEASURE =
  'Die Frage nach dem Mass bleibt in dieser Lesung durchgehend gegenwaertig.';
export const MOTIF_STATEMENT_SPARE =
  'Ein weiterer Faden bleibt vorerst ohne eigenen Abschluss.';

// --- the accepted claim graph ----------------------------------------------

/** The synthesis the baseline graph is built from. Four claims, four relations. */
export function baselineSynthesisJson(): MutableSynthesis {
  return withClaims(
    [
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
      {
        draftRef: 'claim-positional',
        statement: STATEMENT_POSITIONAL,
        factRefs: [],
        themeRefs: [POSITIONAL_THEME],
        epistemicClass: 'SUPPORTED_INTERPRETATION',
      },
    ],
    [
      // Two tensions the plan must face, of two different kinds...
      { from: 'claim-seasonal', type: 'QUALIFIES', to: 'claim-self-role' },
      { from: 'claim-elemental', type: 'CONTRASTS_WITH', to: 'claim-positional' },
      // ...and two relations that are NOT tensions, so the derivation is proven
      // to select rather than to sweep everything in.
      { from: 'claim-elemental', type: 'CONTEXTUALIZES', to: 'claim-self-role' },
      { from: 'claim-positional', type: 'SUPPORTS', to: 'claim-self-role' },
    ],
  );
}

export function graphFrom(
  synthesisOutput: unknown,
  model: HoroscopeModel = KNOWN_MODEL,
  brief: NarrativeBrief = KNOWN_BRIEF,
): InterpretiveClaimGraph {
  return buildInterpretiveClaimGraph({ model, brief, synthesisOutput });
}

export const BASELINE_GRAPH: InterpretiveClaimGraph = graphFrom(baselineSynthesisJson());

/**
 * The accepted claim ids, resolved BY STATEMENT rather than written down.
 *
 * A claim id is a digest of the accepted meaning, so hard-coding one would pin
 * a value that legitimately moves whenever the fixture chart or the identity
 * derivation changes — and would pin it in a place no reader could verify.
 */
function claimIdOf(statement: string): string {
  const claim = BASELINE_GRAPH.claims.find((entry) => entry.statement === statement);
  if (claim === undefined) {
    throw new Error(`fixture defect: the baseline graph carries no claim "${statement}"`);
  }
  return claim.claimId;
}

export const CLAIM_SELF_ROLE = claimIdOf(STATEMENT_SELF_ROLE);
export const CLAIM_SEASONAL = claimIdOf(STATEMENT_SEASONAL);
export const CLAIM_ELEMENTAL = claimIdOf(STATEMENT_ELEMENTAL);
export const CLAIM_POSITIONAL = claimIdOf(STATEMENT_POSITIONAL);

// --- mutable draft shapes --------------------------------------------------

/**
 * Plain JSON, so a negative case can hold a value the TypeScript type forbids.
 * The same shape the C1 and C2 fixtures use, for the same reason.
 */
export interface MutableThesis {
  statement: string;
  claimRefs: string[];
}
export interface MutableMotif {
  motifRef: string;
  statement: string;
  anchorClaimRef: string;
  claimRefs: string[];
}
export interface MutableTransition {
  motifRef: string;
  targetState: string;
}
export interface MutableResolution {
  mode: string;
  chapterRef?: string;
}
export interface MutableThread {
  threadRef: string;
  narrativeRole: string;
  claimRefs: string[];
  motifRefs: string[];
  resolution: MutableResolution;
}
export interface MutableChapter {
  chapterRef: string;
  narrativeRole: string;
  claimRefs: string[];
  motifRefs: string[];
  motifTransitions: MutableTransition[];
  openThreadRefs: string[];
  closeThreadRefs: string[];
}
export interface MutablePlan {
  sourceBriefHash: string;
  sourceClaimGraphHash: string;
  reportThesis: MutableThesis;
  primaryMotifs: MutableMotif[];
  openThreads: MutableThread[];
  chapterPlan: MutableChapter[];
}

export const MOTIF_ROLE = 'motif-role';
export const MOTIF_SEASON = 'motif-season';
export const MOTIF_SPREAD = 'motif-spread';
export const MOTIF_MEASURE = 'motif-measure';

export const THREAD_CLOSING = 'thread-closing';
export const THREAD_OPEN = 'thread-open';

export const CHAPTER_ESTABLISH = 'chapter-establish';
export const CHAPTER_QUALIFY = 'chapter-qualify';
export const CHAPTER_CONTRAST = 'chapter-contrast';
export const CHAPTER_INTEGRATE = 'chapter-integrate';

/**
 * The verified baseline plan.
 *
 * It satisfies every structural obligation at once, which is the only way the
 * negative suite can isolate one of them:
 *
 *   thesis      two distinct accepted claims, grounded prose;
 *   motifs      four, each anchored in a DIFFERENT accepted claim;
 *   coverage    all four graph claims appear in the chapter plan;
 *   integration one real INTEGRATE chapter: four claims, four motifs;
 *   tensions    the QUALIFIES pair is faced by a QUALIFY chapter and the
 *               CONTRASTS_WITH pair by a CONTRAST chapter;
 *   lifecycle   every motif advances forward and ends INTEGRATED or CLOSED,
 *               one of them by skipping a state, which is allowed;
 *   threads     one closes in a LATER chapter that really closes it, one is
 *               explicitly left open and is closed by nobody.
 */
export function validPlanDraft(graph: InterpretiveClaimGraph = BASELINE_GRAPH): MutablePlan {
  return {
    sourceBriefHash: KNOWN_BRIEF.structuralHash,
    sourceClaimGraphHash: graph.structuralHash,
    reportThesis: {
      statement: PLAN_THESIS,
      claimRefs: [CLAIM_SELF_ROLE, CLAIM_SEASONAL],
    },
    primaryMotifs: [
      {
        motifRef: MOTIF_ROLE,
        statement: MOTIF_STATEMENT_ROLE,
        anchorClaimRef: CLAIM_SELF_ROLE,
        claimRefs: [CLAIM_SELF_ROLE],
      },
      {
        motifRef: MOTIF_SEASON,
        statement: MOTIF_STATEMENT_SEASON,
        anchorClaimRef: CLAIM_SEASONAL,
        claimRefs: [CLAIM_SEASONAL],
      },
      {
        motifRef: MOTIF_SPREAD,
        statement: MOTIF_STATEMENT_SPREAD,
        anchorClaimRef: CLAIM_ELEMENTAL,
        claimRefs: [CLAIM_ELEMENTAL],
      },
      {
        motifRef: MOTIF_MEASURE,
        statement: MOTIF_STATEMENT_MEASURE,
        anchorClaimRef: CLAIM_POSITIONAL,
        claimRefs: [CLAIM_POSITIONAL],
      },
    ],
    openThreads: [
      {
        threadRef: THREAD_CLOSING,
        narrativeRole: 'QUALIFY',
        claimRefs: [CLAIM_SELF_ROLE],
        motifRefs: [MOTIF_ROLE],
        resolution: { mode: 'CLOSE_IN_CHAPTER', chapterRef: CHAPTER_INTEGRATE },
      },
      {
        threadRef: THREAD_OPEN,
        narrativeRole: 'CONTEXTUALIZE',
        claimRefs: [CLAIM_POSITIONAL],
        motifRefs: [MOTIF_MEASURE],
        resolution: { mode: 'EXPLICITLY_LEFT_OPEN' },
      },
    ],
    chapterPlan: [
      {
        chapterRef: CHAPTER_ESTABLISH,
        narrativeRole: 'ESTABLISH',
        claimRefs: [CLAIM_SELF_ROLE],
        motifRefs: [MOTIF_ROLE],
        motifTransitions: [{ motifRef: MOTIF_ROLE, targetState: 'SEEDED' }],
        openThreadRefs: [THREAD_CLOSING],
        closeThreadRefs: [],
      },
      {
        chapterRef: CHAPTER_QUALIFY,
        narrativeRole: 'QUALIFY',
        claimRefs: [CLAIM_SEASONAL, CLAIM_SELF_ROLE],
        motifRefs: [MOTIF_SEASON, MOTIF_ROLE],
        motifTransitions: [
          { motifRef: MOTIF_SEASON, targetState: 'SEEDED' },
          { motifRef: MOTIF_ROLE, targetState: 'DEVELOPED' },
        ],
        openThreadRefs: [THREAD_OPEN],
        closeThreadRefs: [],
      },
      {
        chapterRef: CHAPTER_CONTRAST,
        narrativeRole: 'CONTRAST',
        claimRefs: [CLAIM_ELEMENTAL, CLAIM_POSITIONAL],
        motifRefs: [MOTIF_SPREAD, MOTIF_MEASURE],
        motifTransitions: [
          { motifRef: MOTIF_SPREAD, targetState: 'SEEDED' },
          { motifRef: MOTIF_MEASURE, targetState: 'COMPLICATED' },
        ],
        openThreadRefs: [],
        closeThreadRefs: [],
      },
      {
        chapterRef: CHAPTER_INTEGRATE,
        narrativeRole: 'INTEGRATE',
        claimRefs: [CLAIM_SELF_ROLE, CLAIM_SEASONAL, CLAIM_ELEMENTAL, CLAIM_POSITIONAL],
        motifRefs: [MOTIF_ROLE, MOTIF_SEASON, MOTIF_SPREAD, MOTIF_MEASURE],
        motifTransitions: [
          // MOTIF_SEASON skips DEVELOPED and COMPLICATED entirely: forward
          // skipping is allowed, and the baseline exercises it rather than
          // leaving that rule proven only by its refusal.
          { motifRef: MOTIF_ROLE, targetState: 'INTEGRATED' },
          { motifRef: MOTIF_SEASON, targetState: 'INTEGRATED' },
          { motifRef: MOTIF_SPREAD, targetState: 'INTEGRATED' },
          { motifRef: MOTIF_MEASURE, targetState: 'CLOSED' },
        ],
        openThreadRefs: [],
        closeThreadRefs: [THREAD_CLOSING],
      },
    ],
  };
}

/** The baseline with one or more top-level sections replaced. */
export function planWith(
  overrides: Partial<MutablePlan>,
  graph: InterpretiveClaimGraph = BASELINE_GRAPH,
): MutablePlan {
  return { ...validPlanDraft(graph), ...overrides };
}

export function buildPlan(
  planDraft: unknown,
  graph: InterpretiveClaimGraph = BASELINE_GRAPH,
  model: HoroscopeModel = KNOWN_MODEL,
  brief: NarrativeBrief = KNOWN_BRIEF,
): MetaNarrativePlan {
  return buildMetaNarrativePlan({ model, brief, claimGraph: graph, planDraft });
}

export function expectPlanRefusal(
  code: MetaNarrativePlanErrorCode,
  planDraft: unknown,
  graph: InterpretiveClaimGraph = BASELINE_GRAPH,
  model: HoroscopeModel = KNOWN_MODEL,
  brief: NarrativeBrief = KNOWN_BRIEF,
): void {
  try {
    buildMetaNarrativePlan({ model, brief, claimGraph: graph, planDraft });
  } catch (error) {
    if (error instanceof MetaNarrativePlanError) {
      expect(error.code).toBe(code);
      return;
    }
    throw error;
  }
  expect.unreachable(`expected the meta narrative plan to be refused with ${code}`);
}
