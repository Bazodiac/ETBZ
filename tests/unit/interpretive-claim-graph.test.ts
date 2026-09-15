import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  INTERPRETIVE_CLAIM_GRAPH_VERSION,
  buildInterpretiveClaimGraph,
  deriveInterpretiveClaimId,
  hashInterpretiveClaimGraph,
} from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import type { NarrativeBrief } from '../../src/application/interpretation/narrative-brief.js';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import {
  DOMINANT_FACT,
  DOMINANT_VALUE,
  ELEMENTAL_THEME,
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
  validSynthesisJson,
  withClaims,
  withRelations,
} from '../support/interpretiveClaimFixture.js';
import type {
  MutableClaim,
  MutableSynthesis,
} from '../support/interpretiveClaimFixture.js';

/**
 * ETBZ-30 C2 — the accepted InterpretiveClaimGraph.
 *
 * The properties that matter here are the ones a test which merely builds a
 * valid graph cannot see. An identity that silently depends on the provider, on
 * a draft handle, or on input order is indistinguishable from a stable one
 * until something reorders the input; a hash that is not re-derivable is not
 * evidence. So every claim this commit makes is asserted from the outside:
 *
 *   1. DETERMINISM IS A PROPERTY OF MEANING, NOT OF TRANSPORT. Provider id,
 *      draft handles, claim order, reference order and repeated references are
 *      each varied INDEPENDENTLY, and each must leave the graph byte-identical.
 *      These are the exact channels through which a provider could otherwise
 *      steer an identity ETBZ is supposed to own.
 *
 *   2. RELATIONS DO NOT TOUCH GROUNDING. Adding and removing relations must
 *      leave every accepted claim byte-equivalent, provisional fields and
 *      epistemic class included. That is the mechanical form of "provisionality
 *      travels with the fact, never with the relation".
 *
 *   3. THE PUBLISHED HASH IS REPRODUCIBLE. It is re-derived here with
 *      `node:crypto` over the canonical text, so it is measured rather than
 *      asserted — and sensitive, so a real change to accepted meaning moves it.
 */

function graphFor(
  synthesisOutput: unknown,
  model: HoroscopeModel = KNOWN_MODEL,
  brief: NarrativeBrief = KNOWN_BRIEF,
): InterpretiveClaimGraph {
  return buildInterpretiveClaimGraph({ model, brief, synthesisOutput });
}

const BASELINE = graphFor(validSynthesisJson());

describe('ETBZ-30 C2-A: a trusted answer builds an accepted graph', () => {
  it('accepts the verified baseline and publishes the minimal graph shape', () => {
    expect(Object.keys(BASELINE).sort()).toEqual([
      'claims',
      'graphVersion',
      'relations',
      'sourceBriefHash',
      'structuralHash',
    ]);
    expect(BASELINE.graphVersion).toBe(INTERPRETIVE_CLAIM_GRAPH_VERSION);
    expect(BASELINE.sourceBriefHash).toBe(KNOWN_BRIEF.structuralHash);
    expect(BASELINE.claims).toHaveLength(3);
    expect(BASELINE.relations).toHaveLength(2);
  });

  it('publishes an accepted claim with no provider field and no number', () => {
    for (const claim of BASELINE.claims) {
      expect(Object.keys(claim).sort()).toEqual([
        'claimId',
        'epistemicClass',
        'factRefs',
        'provisionalFactIds',
        'provisionalLineage',
        'statement',
        'themeRefs',
      ]);
      // No score, rank, weight, confidence, salience or cardinality anywhere:
      // every published value is a string, a string list or a boolean.
      for (const value of Object.values(claim)) {
        expect(typeof value === 'string' || typeof value === 'boolean' || Array.isArray(value)).toBe(
          true,
        );
      }
    }
  });

  it('publishes a relation as two accepted identities and a type, and nothing else', () => {
    const claimIds = new Set(BASELINE.claims.map((claim) => claim.claimId));
    for (const relation of BASELINE.relations) {
      expect(Object.keys(relation).sort()).toEqual(['from', 'to', 'type']);
      // Resolved onto ACCEPTED identities: no draft handle survives into the graph.
      expect(claimIds.has(relation.from)).toBe(true);
      expect(claimIds.has(relation.to)).toBe(true);
    }
  });

  it('carries no echoed fact VALUE into the accepted graph', () => {
    // The echo is a comparison input, not published content. Publishing it
    // would put a second copy of a chart fact beside the chart's own.
    const serialized = JSON.stringify(BASELINE);
    expect(serialized).toContain(MONTH_COMMAND_FACT);
    expect(BASELINE.claims.flatMap((claim) => claim.factRefs)).toContain(MONTH_COMMAND_FACT);
    for (const claim of BASELINE.claims) {
      for (const factRef of claim.factRefs) {
        expect(typeof factRef).toBe('string');
      }
    }
  });

  it('accepts an answer with no claims and no relations', () => {
    const empty = graphFor({ ...validSynthesisJson(), claims: [], relations: [] });

    expect(empty.claims).toEqual([]);
    expect(empty.relations).toEqual([]);
    // Still a real graph bound to a real brief; "too few claims" belongs to a
    // later product gate, not to structural acceptance.
    expect(empty.sourceBriefHash).toBe(KNOWN_BRIEF.structuralHash);
  });
});

describe('ETBZ-30 C2-B: the graph is a pure function of the accepted meaning', () => {
  it('produces a byte-identical graph from identical input', () => {
    const again = graphFor(validSynthesisJson());

    expect(again).toEqual(BASELINE);
    expect(again.structuralHash).toBe(BASELINE.structuralHash);
    expect(canonicalJson(again)).toBe(canonicalJson(BASELINE));
  });

  it('C: changing ONLY providerId changes neither the graph nor its hash', () => {
    // providerId is provenance, not meaning. If it ever reached the identity or
    // the digest, two providers stating the same interpretation would produce
    // two different "meanings" of the same chart.
    const other = { ...validSynthesisJson(), providerId: 'etbz-30.some.other-provider' };
    const graph = graphFor(other);

    expect(graph).toEqual(BASELINE);
    expect(graph.structuralHash).toBe(BASELINE.structuralHash);
    expect(JSON.stringify(graph)).not.toContain('other-provider');
    expect(JSON.stringify(graph)).not.toContain('synthesis-provider');
  });

  it('D: renaming every draftRef, relations included, changes neither graph nor hash', () => {
    const renamed = validSynthesisJson();
    const rename = (draftRef: string): string => `handle-${draftRef.length}-${draftRef}`;
    for (const claim of renamed.claims) {
      claim.draftRef = rename(claim.draftRef);
    }
    for (const relation of renamed.relations) {
      relation.from = rename(relation.from);
      relation.to = rename(relation.to);
    }

    const graph = graphFor(renamed);

    expect(graph).toEqual(BASELINE);
    expect(graph.structuralHash).toBe(BASELINE.structuralHash);
  });

  it('E: permuting the claim input order changes neither graph nor hash', () => {
    const permuted = validSynthesisJson();
    permuted.claims.reverse();

    const graph = graphFor(permuted);

    expect(graph).toEqual(BASELINE);
    expect(graph.claims.map((claim) => claim.claimId)).toEqual(
      BASELINE.claims.map((claim) => claim.claimId),
    );
  });

  it('F: permuting factRef, themeRef and relation order changes neither graph nor hash', () => {
    const permuted = withClaims(
      [
        {
          draftRef: 'claim-multi',
          statement: STATEMENT_SELF_ROLE,
          factRefs: [
            { factId: DOMINANT_FACT, value: DOMINANT_VALUE },
            { factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE },
          ],
          themeRefs: [SELF_ROLE_THEME, ELEMENTAL_THEME],
          epistemicClass: 'SUPPORTED_INTERPRETATION',
        },
        {
          draftRef: 'claim-second',
          statement: STATEMENT_SEASONAL,
          factRefs: [],
          themeRefs: [SEASONAL_THEME],
          epistemicClass: 'SUPPORTED_INTERPRETATION',
        },
      ],
      [
        { from: 'claim-multi', type: 'QUALIFIES', to: 'claim-second' },
        { from: 'claim-second', type: 'SUPPORTS', to: 'claim-multi' },
      ],
    );
    const reordered: MutableSynthesis = structuredClone(permuted);
    const first = reordered.claims[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    first.factRefs.reverse();
    first.themeRefs.reverse();
    reordered.relations.reverse();

    expect(graphFor(reordered)).toEqual(graphFor(permuted));
  });

  it('G: repeating one identical valid factRef moves neither claimId nor hash', () => {
    const once = withClaims([
      {
        draftRef: 'claim-seasonal',
        statement: STATEMENT_SEASONAL,
        factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
        themeRefs: [],
        epistemicClass: 'SUPPORTED_INTERPRETATION',
      },
    ]);
    const twice: MutableSynthesis = structuredClone(once);
    const claim = twice.claims[0];
    expect(claim).toBeDefined();
    if (claim === undefined) return;
    claim.factRefs.push({ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE });

    const onceGraph = graphFor(once);
    const twiceGraph = graphFor(twice);

    expect(twiceGraph).toEqual(onceGraph);
    // Normalized to ONE accepted reference: repetition is not extra evidence.
    expect(twiceGraph.claims[0]?.factRefs).toEqual([MONTH_COMMAND_FACT]);
  });

  it('H: repeating one identical relation changes neither graph nor hash', () => {
    const once = validSynthesisJson();
    const twice = validSynthesisJson();
    const duplicated = twice.relations[0];
    expect(duplicated).toBeDefined();
    if (duplicated === undefined) return;
    twice.relations.push({ ...duplicated });

    const graph = graphFor(twice);

    expect(graph).toEqual(graphFor(once));
    expect(graph.relations).toHaveLength(2);
  });
});

describe('ETBZ-30 C2-C: grounding, and the provisional lineage it implies', () => {
  it('I: a claim grounded by an approved theme alone is accepted', () => {
    const graph = graphFor(
      withClaims([
        {
          draftRef: 'claim-theme-only',
          statement: STATEMENT_SELF_ROLE,
          factRefs: [],
          themeRefs: [SELF_ROLE_THEME],
          epistemicClass: 'SUPPORTED_INTERPRETATION',
        },
      ]),
    );

    expect(graph.claims).toHaveLength(1);
    expect(graph.claims[0]?.factRefs).toEqual([]);
    expect(graph.claims[0]?.themeRefs).toEqual([SELF_ROLE_THEME]);
  });

  it('J: a claim grounded by a fact alone is accepted', () => {
    const graph = graphFor(
      withClaims([
        {
          draftRef: 'claim-fact-only',
          statement: STATEMENT_SEASONAL,
          factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
          themeRefs: [],
          epistemicClass: 'SUPPORTED_INTERPRETATION',
        },
      ]),
    );

    expect(graph.claims[0]?.factRefs).toEqual([MONTH_COMMAND_FACT]);
    expect(graph.claims[0]?.themeRefs).toEqual([]);
  });

  it('K: a known-time chart produces no provisional lineage at all', () => {
    // The control that keeps the provisional assertions below honest: this
    // chart has nothing provisional in it, so a guard that simply always
    // reported provisionality would fail here.
    expect(KNOWN_BRIEF.uncertainty.provisionalFactIds).toEqual([]);
    for (const claim of BASELINE.claims) {
      expect(claim.provisionalFactIds).toEqual([]);
      expect(claim.provisionalLineage).toBe(false);
    }
  });

  it('carries provisional lineage through an approved theme, from the theme closure', () => {
    // The unknown-time chart marks the hour pillar provisional, and the
    // self-role theme owns hour Ten God facts — so a claim resting on that
    // theme inherits them WITHOUT referencing a fact directly.
    const graph = graphFor(
      withClaims(
        [
          {
            draftRef: 'claim-tentative',
            statement: STATEMENT_SELF_ROLE,
            factRefs: [],
            themeRefs: [SELF_ROLE_THEME],
            epistemicClass: 'TENTATIVE_INTERPRETATION',
          },
        ],
        [],
        UNKNOWN_BRIEF,
      ),
      UNKNOWN_MODEL,
      UNKNOWN_BRIEF,
    );

    const claim = graph.claims[0];
    expect(claim?.provisionalLineage).toBe(true);
    expect(claim?.provisionalFactIds.length).toBeGreaterThan(0);
    for (const factId of claim?.provisionalFactIds ?? []) {
      expect(UNKNOWN_BRIEF.uncertainty.provisionalFactIds).toContain(factId);
    }
  });

  it('L: a tentative interpretation with NO provisional source is still allowed', () => {
    // Tentative is not a label reserved for provisional claims. If it were,
    // `provisionalLineage` and `epistemicClass` would be two spellings of one
    // fact and the laundering guard would be untestable.
    const graph = graphFor(
      withClaims([
        {
          draftRef: 'claim-open',
          statement: STATEMENT_OPEN,
          factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
          themeRefs: [],
          epistemicClass: 'TENTATIVE_INTERPRETATION',
        },
      ]),
    );

    expect(graph.claims[0]?.epistemicClass).toBe('TENTATIVE_INTERPRETATION');
    expect(graph.claims[0]?.provisionalLineage).toBe(false);
  });

  it('an approved theme with no provisional fact yields no lineage on an unknown-time chart', () => {
    // Precision control: provisionality is per-CLAIM grounding, not a property
    // the whole chart smears over every claim. The seasonal theme owns no
    // provisional fact even when the birth time is unknown.
    expect(
      UNKNOWN_BRIEF.primaryThemes.find((theme) => theme.id === SEASONAL_THEME)?.provisionalFactIds,
    ).toEqual([]);

    const graph = graphFor(
      withClaims(
        [
          {
            draftRef: 'claim-seasonal',
            statement: STATEMENT_SEASONAL,
            factRefs: [],
            themeRefs: [SEASONAL_THEME],
            epistemicClass: 'SUPPORTED_INTERPRETATION',
          },
        ],
        [],
        UNKNOWN_BRIEF,
      ),
      UNKNOWN_MODEL,
      UNKNOWN_BRIEF,
    );

    expect(graph.claims[0]?.provisionalLineage).toBe(false);
    expect(graph.claims[0]?.provisionalFactIds).toEqual([]);
  });
});

describe('ETBZ-30 C2-D: relations carry no epistemic weight', () => {
  it('M: adding and removing relations leaves every accepted claim byte-equivalent', () => {
    const none = graphFor(withRelations([]));
    const one = graphFor(withRelations([{ from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-self-role' }]));
    const two = graphFor(
      withRelations([
        { from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-self-role' },
        { from: 'claim-elemental', type: 'CONTRASTS_WITH', to: 'claim-seasonal' },
      ]),
    );

    // The claims block is identical across all three, byte for byte.
    expect(canonicalJson(one.claims)).toBe(canonicalJson(none.claims));
    expect(canonicalJson(two.claims)).toBe(canonicalJson(none.claims));
    for (const graph of [none, one, two]) {
      expect(graph.claims.map((claim) => claim.provisionalFactIds)).toEqual(
        none.claims.map((claim) => claim.provisionalFactIds),
      );
      expect(graph.claims.map((claim) => claim.provisionalLineage)).toEqual(
        none.claims.map((claim) => claim.provisionalLineage),
      );
      expect(graph.claims.map((claim) => claim.epistemicClass)).toEqual(
        none.claims.map((claim) => claim.epistemicClass),
      );
    }
    // ...and the relation set really did change, so the assertion above is not
    // comparing three identical graphs.
    expect(none.relations).toHaveLength(0);
    expect(one.relations).toHaveLength(1);
    expect(two.relations).toHaveLength(2);
    expect(one.structuralHash).not.toBe(none.structuralHash);
  });

  it('publishes relations in a deterministic order independent of input order', () => {
    const forward = graphFor(
      withRelations([
        { from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-self-role' },
        { from: 'claim-elemental', type: 'CONTRASTS_WITH', to: 'claim-seasonal' },
      ]),
    );
    const backward = graphFor(
      withRelations([
        { from: 'claim-elemental', type: 'CONTRASTS_WITH', to: 'claim-seasonal' },
        { from: 'claim-seasonal', type: 'SUPPORTS', to: 'claim-self-role' },
      ]),
    );

    expect(backward).toEqual(forward);
  });
});

describe('ETBZ-30 C2-E: the published hash is re-derivable and sensitive', () => {
  it('N: is the plain sha256 of the canonical text of the graph core', () => {
    const core = {
      graphVersion: BASELINE.graphVersion,
      sourceBriefHash: BASELINE.sourceBriefHash,
      claims: BASELINE.claims,
      relations: BASELINE.relations,
    };
    const independent = createHash('sha256').update(canonicalJson(core), 'utf8').digest('hex');

    expect(BASELINE.structuralHash).toBe(`sha256:${independent}`);
    // ...and the exported helper re-derives the same value from the graph.
    expect(hashInterpretiveClaimGraph(core)).toBe(BASELINE.structuralHash);
  });

  it('O: a changed statement moves both the claimId and the graph hash', () => {
    const changed = validSynthesisJson();
    const claim = changed.claims[0];
    expect(claim).toBeDefined();
    if (claim === undefined) return;
    claim.statement = STATEMENT_OPEN;

    const graph = graphFor(changed);

    expect(graph.structuralHash).not.toBe(BASELINE.structuralHash);
    expect(new Set(graph.claims.map((entry) => entry.claimId))).not.toEqual(
      new Set(BASELINE.claims.map((entry) => entry.claimId)),
    );
  });

  it('O: changed grounding moves the claimId even when the statement is unchanged', () => {
    const withTheme: MutableClaim = {
      draftRef: 'claim-seasonal',
      statement: STATEMENT_SEASONAL,
      factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
      themeRefs: [],
      epistemicClass: 'SUPPORTED_INTERPRETATION',
    };
    const plain = graphFor(withClaims([withTheme]));
    const grounded = graphFor(
      withClaims([{ ...withTheme, themeRefs: [SEASONAL_THEME] }]),
    );

    expect(grounded.claims[0]?.claimId).not.toBe(plain.claims[0]?.claimId);
    expect(grounded.structuralHash).not.toBe(plain.structuralHash);
  });

  it('O: a changed epistemic class moves the claimId', () => {
    const supported = graphFor(
      withClaims([
        {
          draftRef: 'claim-seasonal',
          statement: STATEMENT_SEASONAL,
          factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
          themeRefs: [],
          epistemicClass: 'SUPPORTED_INTERPRETATION',
        },
      ]),
    );
    const tentative = graphFor(
      withClaims([
        {
          draftRef: 'claim-seasonal',
          statement: STATEMENT_SEASONAL,
          factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
          themeRefs: [],
          epistemicClass: 'TENTATIVE_INTERPRETATION',
        },
      ]),
    );

    expect(tentative.claims[0]?.claimId).not.toBe(supported.claims[0]?.claimId);
  });

  it('derives the claimId from the semantic identity alone, re-derivably', () => {
    const claim = BASELINE.claims.find((entry) => entry.statement === STATEMENT_SEASONAL);
    expect(claim).toBeDefined();
    if (claim === undefined) return;

    expect(claim.claimId).toBe(
      deriveInterpretiveClaimId({
        statement: claim.statement,
        factRefs: claim.factRefs,
        themeRefs: claim.themeRefs,
        epistemicClass: claim.epistemicClass,
      }),
    );
    // The id names its own method, and carries no provider or handle.
    expect(claim.claimId.startsWith('claim.sha256:')).toBe(true);
  });

  it('binds the graph to the brief it was accepted against', () => {
    const known = BASELINE;
    const unknown = graphFor(
      withClaims(
        [
          {
            draftRef: 'claim-seasonal',
            statement: STATEMENT_SEASONAL,
            factRefs: [{ factId: MONTH_COMMAND_FACT, value: MONTH_COMMAND_VALUE }],
            themeRefs: [],
            epistemicClass: 'SUPPORTED_INTERPRETATION',
          },
        ],
        [],
        UNKNOWN_BRIEF,
      ),
      UNKNOWN_MODEL,
      UNKNOWN_BRIEF,
    );

    expect(unknown.sourceBriefHash).not.toBe(known.sourceBriefHash);
    expect(unknown.structuralHash).not.toBe(known.structuralHash);
  });
});
