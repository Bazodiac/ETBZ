import { describe, expect, it } from 'vitest';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import {
  CANDIDATE_THEME,
  ELEMENTAL_THEME,
  HOUR_TIER_FACT,
  HOUR_TIER_VALUE,
  KNOWN_BRIEF,
  KNOWN_MODEL,
  MONTH_COMMAND_FACT,
  MONTH_COMMAND_VALUE,
  SEASONAL_THEME,
  SELF_ROLE_THEME,
  STATEMENT_OPEN,
  STATEMENT_SEASONAL,
  STATEMENT_SELF_ROLE,
  UNKNOWN_BRIEF,
  UNKNOWN_MODEL,
  expectClaimRefusal,
  singleClaimJson,
  validSynthesisJson,
  withClaims,
  withRelations,
} from '../support/interpretiveClaimFixture.js';

/**
 * ETBZ-30 C2 — what a synthesis answer may NOT do.
 *
 * Every case starts from the SAME verified baseline and changes exactly one
 * thing, so each assertion isolates a single guard. Each group carries a
 * positive control — the unmutated answer, or the legal neighbour of the
 * mutation — because a validator that refused everything would satisfy every
 * refusal below while proving nothing.
 *
 * Nothing here needs a model, a credential or a network: the "provider" is a
 * plain object literal, which is the point. The validation does not care where
 * the answer came from, and no provider implementation exists in this commit.
 */

describe('ETBZ-30 N0: the unmutated answer really does produce a graph', () => {
  it('accepts the baseline (the guards below are not simply always red)', () => {
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: validSynthesisJson(),
    });

    expect(graph.claims).toHaveLength(3);
    expect(graph.relations).toHaveLength(2);
  });
});

describe('ETBZ-30 N1: the answer must belong to this chart and this brief', () => {
  it('2: refuses a brief that is not the one this HoroscopeModel produces', () => {
    // The brief of a DIFFERENT chart, with an answer that matches that brief.
    expectClaimRefusal(
      'CLAIM_BRIEF_NOT_DERIVED_FROM_MODEL',
      KNOWN_MODEL,
      UNKNOWN_BRIEF,
      validSynthesisJson(UNKNOWN_BRIEF),
    );
  });

  it('3: refuses an answer that names a different brief', () => {
    const output = validSynthesisJson();
    output.briefStructuralHash =
      'sha256:0000000000000000000000000000000000000000000000000000000000000000';

    expectClaimRefusal('CLAIM_BRIEF_HASH_MISMATCH', KNOWN_MODEL, KNOWN_BRIEF, output);
  });
});

describe('ETBZ-30 N2: a structurally malformed answer is refused', () => {
  it.each([
    ['not an object', 'a synthesis'],
    ['null', null],
    ['missing providerId', { briefStructuralHash: 'x', claims: [], relations: [] }],
    [
      'claims of the wrong type',
      { providerId: 'p', briefStructuralHash: 'x', claims: 'nope', relations: [] },
    ],
    [
      'an unknown top-level key',
      { providerId: 'p', briefStructuralHash: 'x', claims: [], relations: [], planVersion: 'v1' },
    ],
    [
      'a provider-assigned claimId',
      {
        providerId: 'p',
        briefStructuralHash: 'x',
        claims: [{ ...singleClaimJson(), claimId: 'claim-0001' }],
        relations: [],
      },
    ],
    [
      'a relation type nobody approved',
      {
        providerId: 'p',
        briefStructuralHash: 'x',
        claims: [],
        relations: [{ from: 'a', type: 'CAUSES', to: 'b' }],
      },
    ],
  ])('1: refuses synthesis output that is %s', (_label, synthesisOutput) => {
    expectClaimRefusal(
      'CLAIM_SYNTHESIS_SCHEMA_INVALID',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      synthesisOutput,
    );
  });

  it('reports the schema failure without echoing the received value', () => {
    // The offending value is a harmless marker on purpose: this repository's
    // secret gate scans tests too, and a refusal that echoes untrusted bulk is
    // how raw provider output reaches a log.
    const marker = 'MARKER-VALUE-THAT-MUST-NOT-BE-ECHOED';
    try {
      buildInterpretiveClaimGraph({
        model: KNOWN_MODEL,
        brief: KNOWN_BRIEF,
        synthesisOutput: { ...validSynthesisJson(), unexpectedKey: marker },
      });
      expect.unreachable('an invented key must be refused');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(marker);
      expect((error as Error).message).toContain('unrecognized_keys');
    }
  });
});

describe('ETBZ-30 N3: a claim must carry meaning and rest on something', () => {
  it('4: refuses a whitespace-only statement', () => {
    // The schema's `min(1)` floor accepts this; it still says nothing.
    expectClaimRefusal(
      'CLAIM_UNGROUNDED_INTERPRETATION',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([singleClaimJson({ statement: '   \n\t  ' })]),
    );
  });

  it('5: refuses a claim with neither factRefs nor themeRefs', () => {
    expectClaimRefusal(
      'CLAIM_UNGROUNDED_INTERPRETATION',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([singleClaimJson({ factRefs: [], themeRefs: [] })]),
    );
  });

  it('control: the same claim with a single valid fact is accepted', () => {
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([singleClaimJson()]),
    });

    expect(graph.claims).toHaveLength(1);
  });
});

describe('ETBZ-30 N4: a referenced fact must be a fact of this chart', () => {
  it('6: refuses a fact id the chart does not carry', () => {
    expectClaimRefusal(
      'CLAIM_UNKNOWN_FACT',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({ factRefs: [{ factId: 'chart.invented.fact', value: 'Wu' }] }),
      ]),
    );
  });

  it('refuses a mutated echo of a real fact', () => {
    expectClaimRefusal(
      'CLAIM_FACT_MUTATED',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({ factRefs: [{ factId: MONTH_COMMAND_FACT, value: 'Zi' }] }),
      ]),
    );
  });

  it('7: refuses a correct echo PLUS a duplicate mutated echo of the same fact', () => {
    // The case that makes "validate every occurrence before de-duplication"
    // load-bearing. De-duplicating first would keep whichever came first and
    // silently accept the mutation written beside it.
    expectClaimRefusal(
      'CLAIM_FACT_MUTATED',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({
          factRefs: [
            { factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE },
            { factId: MONTH_COMMAND_FACT, value: 'Zi' },
          ],
        }),
      ]),
    );
  });

  it('control: the same pair of echoes, both correct, is accepted as one reference', () => {
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([
        singleClaimJson({
          factRefs: [
            { factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE },
            { factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE },
          ],
        }),
      ]),
    });

    expect(graph.claims[0]?.factRefs).toEqual([MONTH_COMMAND_FACT]);
  });
});

describe('ETBZ-30 N5: only an approved theme authorizes a claim', () => {
  it('8: refuses a CANDIDATE theme with its own distinguishable code', () => {
    // The candidate theme really is in the brief and really is readable. It is
    // simply not semantic authorization, and the refusal says so rather than
    // reporting it as unknown.
    expect(KNOWN_BRIEF.constraints.candidateThemeIds).toContain(CANDIDATE_THEME);

    expectClaimRefusal(
      'CLAIM_CANDIDATE_THEME_NOT_APPROVED',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([singleClaimJson({ themeRefs: [CANDIDATE_THEME] })]),
    );
  });

  it('9: refuses a theme that is neither approved nor a candidate', () => {
    expectClaimRefusal(
      'CLAIM_UNKNOWN_THEME',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([singleClaimJson({ themeRefs: ['primary.invented_family'] })]),
    );
  });

  it('control: every narratable theme of this brief is accepted', () => {
    for (const themeId of KNOWN_BRIEF.constraints.narratableThemeIds) {
      const graph = buildInterpretiveClaimGraph({
        model: KNOWN_MODEL,
        brief: KNOWN_BRIEF,
        synthesisOutput: withClaims([
          singleClaimJson({ statement: STATEMENT_OPEN, factRefs: [], themeRefs: [themeId] }),
        ]),
      });

      expect(graph.claims[0]?.themeRefs, themeId).toEqual([themeId]);
    }
  });
});

describe('ETBZ-30 N6: a statement may not outrun its grounding', () => {
  it('10: refuses a statement naming a chart symbol the grounding does not cover', () => {
    // "Geng" is a real stem of this chart and is NOT covered by the month
    // command fact the claim rests on.
    expectClaimRefusal(
      'CLAIM_UNCITED_SYMBOL',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({
          statement: `${STATEMENT_SEASONAL} Auch Geng zeigt sich darin.`,
        }),
      ]),
    );
  });

  it('10: refuses an uncited Han character (the CJK half of the guard)', () => {
    expectClaimRefusal(
      'CLAIM_UNCITED_SYMBOL',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({ statement: `${STATEMENT_SEASONAL} Das Zeichen 庚 steht dafuer.` }),
      ]),
    );
  });

  it('11: refuses a statement stating a number the grounding does not cover', () => {
    expectClaimRefusal(
      'CLAIM_UNCITED_NUMBER',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({ statement: `${STATEMENT_SEASONAL} Es sind 7 Bezuege.` }),
      ]),
    );
  });

  it('control: a symbol the grounding DOES cover is accepted', () => {
    // The same shape as the refusal above, with the symbol actually grounded:
    // the guard distinguishes covered from uncovered rather than refusing every
    // sentence that contains a chart word.
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([
        singleClaimJson({ statement: `${STATEMENT_SEASONAL} Der Zweig ${MONTH_COMMAND_VALUE} traegt das.` }),
      ]),
    });

    expect(graph.claims).toHaveLength(1);
  });

  it('12: refuses a statement invoking a method this slice does not evaluate', () => {
    for (const sentence of [
      'Das Yong Shen dieser Karte ist eindeutig.',
      'Die Wang Shuai Bewertung faellt klar aus.',
      'Die naechste Da Yun Periode bringt eine Wende.',
    ]) {
      expectClaimRefusal(
        'CLAIM_OUT_OF_METHOD_SCOPE',
        KNOWN_MODEL,
        KNOWN_BRIEF,
        withClaims([singleClaimJson({ statement: `${STATEMENT_SEASONAL} ${sentence}` })]),
      );
    }
  });

  it('12: refuses an out-of-scope term split by a non-breaking space', () => {
    // Wrapped prose really produces this shape; the shared matcher collapses
    // whitespace, which is exactly why it is shared rather than re-implemented.
    expectClaimRefusal(
      'CLAIM_OUT_OF_METHOD_SCOPE',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({ statement: `${STATEMENT_SEASONAL} Das Yong\u00A0Shen ist eindeutig.` }),
      ]),
    );
  });
});

describe('ETBZ-30 N7: provisional grounding may not be laundered', () => {
  it('13: refuses a provisional claim that declares itself SUPPORTED', () => {
    // Grounded in the hour pillar of the unknown-time chart, which FuFirE
    // itself marks provisional.
    expect(UNKNOWN_BRIEF.uncertainty.provisionalFactIds).toContain(HOUR_TIER_FACT);

    expectClaimRefusal(
      'CLAIM_PROVISIONAL_LINEAGE_LAUNDERED',
      UNKNOWN_MODEL,
      UNKNOWN_BRIEF,
      withClaims(
        [
          singleClaimJson({
            statement: STATEMENT_OPEN,
            factRefs: [{ factId: HOUR_TIER_FACT, value: HOUR_TIER_VALUE }],
            themeRefs: [],
            epistemicClass: 'SUPPORTED_INTERPRETATION',
          }),
        ],
        [],
        UNKNOWN_BRIEF,
      ),
    );
  });

  it('13: refuses it when the provisionality arrives through an approved THEME', () => {
    expectClaimRefusal(
      'CLAIM_PROVISIONAL_LINEAGE_LAUNDERED',
      UNKNOWN_MODEL,
      UNKNOWN_BRIEF,
      withClaims(
        [
          singleClaimJson({
            statement: STATEMENT_SELF_ROLE,
            factRefs: [],
            themeRefs: [SELF_ROLE_THEME],
            epistemicClass: 'SUPPORTED_INTERPRETATION',
          }),
        ],
        [],
        UNKNOWN_BRIEF,
      ),
    );
  });

  it('control: the same provisional grounding as TENTATIVE is accepted', () => {
    const graph = buildInterpretiveClaimGraph({
      model: UNKNOWN_MODEL,
      brief: UNKNOWN_BRIEF,
      synthesisOutput: withClaims(
        [
          singleClaimJson({
            statement: STATEMENT_OPEN,
            factRefs: [{ factId: HOUR_TIER_FACT, value: HOUR_TIER_VALUE }],
            themeRefs: [],
            epistemicClass: 'TENTATIVE_INTERPRETATION',
          }),
        ],
        [],
        UNKNOWN_BRIEF,
      ),
    });

    expect(graph.claims[0]?.provisionalLineage).toBe(true);
    expect(graph.claims[0]?.provisionalFactIds).toContain(HOUR_TIER_FACT);
  });

  it('control: the SAME claim on the known-time chart is accepted as SUPPORTED', () => {
    // Proves the refusal tracks the source's provisionality rather than the
    // fact id: the hour tier is certain when the birth time is known.
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([
        singleClaimJson({
          statement: STATEMENT_OPEN,
          factRefs: [{ factId: HOUR_TIER_FACT, value: HOUR_TIER_VALUE }],
          themeRefs: [],
          epistemicClass: 'SUPPORTED_INTERPRETATION',
        }),
      ]),
    });

    expect(graph.claims[0]?.provisionalLineage).toBe(false);
  });
});

describe('ETBZ-30 N8: identity belongs to the application, not to the provider', () => {
  it('14: refuses two claims sharing one draftRef', () => {
    expectClaimRefusal(
      'CLAIM_DUPLICATE_DRAFT_REF',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({ draftRef: 'claim-a', statement: STATEMENT_SEASONAL }),
        singleClaimJson({ draftRef: 'claim-a', statement: STATEMENT_OPEN }),
      ]),
    );
  });

  it('15: refuses two DIFFERENT draftRefs carrying the same accepted meaning', () => {
    // The duplicate is not identical as input: the references are written in a
    // different order and one is repeated. It is identical as MEANING, which is
    // what the identity is derived from, so it must not become two claims.
    expectClaimRefusal(
      'CLAIM_DUPLICATE_CLAIM_CONTENT',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({
          draftRef: 'claim-first',
          factRefs: [
            { factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE },
            { factId: HOUR_TIER_FACT, value: HOUR_TIER_VALUE },
          ],
        }),
        singleClaimJson({
          draftRef: 'claim-second',
          factRefs: [
            { factId: HOUR_TIER_FACT, value: HOUR_TIER_VALUE },
            { factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE },
            { factId: HOUR_TIER_FACT, value: HOUR_TIER_VALUE },
          ],
        }),
      ]),
    );
  });

  it('control: two claims that genuinely differ are both accepted', () => {
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([
        singleClaimJson({ draftRef: 'claim-first', statement: STATEMENT_SEASONAL }),
        singleClaimJson({ draftRef: 'claim-second', statement: STATEMENT_OPEN }),
      ]),
    });

    expect(graph.claims).toHaveLength(2);
    expect(graph.claims[0]?.claimId).not.toBe(graph.claims[1]?.claimId);
  });
});

describe('ETBZ-30 N9: a relation must connect two accepted claims', () => {
  it('16: refuses a relation naming a draftRef this answer does not contain', () => {
    expectClaimRefusal(
      'CLAIM_RELATION_UNKNOWN_ENDPOINT',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withRelations([{ from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-nowhere' }]),
    );
  });

  it('16: refuses it on the FROM side too', () => {
    expectClaimRefusal(
      'CLAIM_RELATION_UNKNOWN_ENDPOINT',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withRelations([{ from: 'claim-nowhere', type: 'SUPPORTS', to: 'claim-seasonal' }]),
    );
  });

  it('17: refuses a relation pointing a claim at itself', () => {
    expectClaimRefusal(
      'CLAIM_RELATION_SELF_REFERENCE',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withRelations([{ from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-seasonal' }]),
    );
  });

  it('control: every approved relation type connects two real claims', () => {
    for (const type of [
      'SUPPORTS',
      'QUALIFIES',
      'CONTRASTS_WITH',
      'CONTEXTUALIZES',
      'DEVELOPS',
      'INTEGRATES',
      'ALTERNATIVE_READING',
    ]) {
      const graph = buildInterpretiveClaimGraph({
        model: KNOWN_MODEL,
        brief: KNOWN_BRIEF,
        synthesisOutput: withRelations([
          { from: 'claim-seasonal', type, to: 'claim-self-role' },
        ]),
      });

      expect(graph.relations, type).toHaveLength(1);
      expect(graph.relations[0]?.type).toBe(type);
    }
  });

  it('does NOT refuse a cycle: the canonical contract states no acyclicity rule', () => {
    // Asserted as an ACCEPTANCE on purpose. An acyclicity rule nobody approved
    // would refuse legitimate mutual readings, and an absence that nobody
    // measures is indistinguishable from an oversight.
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withRelations([
        { from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-self-role' },
        { from: 'claim-self-role', type: 'QUALIFIES', to: 'claim-elemental' },
        { from: 'claim-elemental', type: 'CONTEXTUALIZES', to: 'claim-seasonal' },
      ]),
    });

    expect(graph.relations).toHaveLength(3);
  });
});

describe('ETBZ-30 N10: the elemental theme control', () => {
  it('accepts a claim grounded in the elemental theme, whose facts carry numerals', () => {
    // The Wu Xing weights are numeric fact values, so this claim's grounding
    // COVERS numerals. It is the control proving the numeral guard reads the
    // grounding rather than refusing every digit outright.
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([
        singleClaimJson({
          statement: `${STATEMENT_OPEN} Der Anteil betraegt 2.5.`,
          factRefs: [],
          themeRefs: [ELEMENTAL_THEME],
        }),
      ]),
    });

    expect(graph.claims).toHaveLength(1);
  });

  it('still refuses a numeral the elemental grounding does not carry', () => {
    expectClaimRefusal(
      'CLAIM_UNCITED_NUMBER',
      KNOWN_MODEL,
      KNOWN_BRIEF,
      withClaims([
        singleClaimJson({
          statement: `${STATEMENT_OPEN} Der Anteil betraegt 9.9.`,
          factRefs: [],
          themeRefs: [ELEMENTAL_THEME],
        }),
      ]),
    );
  });

  it('accepts the seasonal theme as grounding for its own statement', () => {
    const graph = buildInterpretiveClaimGraph({
      model: KNOWN_MODEL,
      brief: KNOWN_BRIEF,
      synthesisOutput: withClaims([
        singleClaimJson({ statement: STATEMENT_SEASONAL, factRefs: [], themeRefs: [SEASONAL_THEME] }),
      ]),
    });

    expect(graph.claims[0]?.themeRefs).toEqual([SEASONAL_THEME]);
  });
});
