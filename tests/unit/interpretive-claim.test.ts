import { describe, expect, it } from 'vitest';
import {
  CLAIM_RELATION_TYPES,
  INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES,
  MOTIF_LIFECYCLE_STATES,
  NARRATIVE_OPERATORS,
  claimRelationTypeSchema,
  interpretiveClaimEpistemicClassSchema,
  motifLifecycleStateSchema,
  narrativeOperatorSchema,
} from '../../src/application/interpretation/interpretive-claim.js';
import type {
  ClaimRelationType,
  InterpretiveClaimEpistemicClass,
  MotifLifecycleState,
  NarrativeOperator,
} from '../../src/application/interpretation/interpretive-claim.js';
import { interpretiveClaimSynthesisOutputSchema } from '../../src/application/ports/interpretive-claim-provider.js';
import type { InterpretiveClaimSynthesisOutput } from '../../src/application/ports/interpretive-claim-provider.js';

/**
 * ETBZ-30 C1 — the contracts, measured rather than instantiated.
 *
 * C1 adds one boundary and four vocabularies, and both kinds of artefact fail
 * in a way that a test which merely builds a valid object cannot see. A closed
 * vocabulary that silently accepts an eighth member is indistinguishable from
 * an open one; a strict schema that has never refused anything is
 * indistinguishable from a permissive one. So every claim this commit makes is
 * asserted from the outside, with a counterexample beside it:
 *
 *   1. THE VOCABULARIES ARE CLOSED, AND CLOSED AT BOTH LEVELS. The runtime
 *      array, the TypeScript union and the zod schema are three views of one
 *      list. The union is derived from the array, so a union member the array
 *      lacks cannot be written; what a test still has to prove is the other
 *      direction - that no view has quietly gained a member the others do not
 *      have. The exhaustive `Record<Union, true>` maps below are compile-time
 *      assertions (a missing key fails `tsc`) whose KEYS are then compared to
 *      the array at runtime, and each schema's own options are compared to the
 *      same array. Drift needs all three to move together.
 *
 *   2. TWO NAMES ARE ABSENT ON PURPOSE, SO THEIR ABSENCE IS ASSERTED. `FACT`
 *      and `REFLECTION` are not epistemic classes of an interpretive claim.
 *      An absence nobody measures is indistinguishable from an oversight, and
 *      these two are the exact names a future contributor would reach for - one
 *      would turn this boundary into a second chart-fact source, the other
 *      would let a draft claim an output role it cannot occupy.
 *
 *   3. THE SCHEMA IS STRICT IN BOTH DIRECTIONS. A missing or renamed field is
 *      an incomplete answer; an EXTRA key is a provider inventing a channel.
 *      The extra-key cases are not generic: they use the field names the
 *      contract specifically refuses - a certainty, a salience, an evidence
 *      weight, a narrative priority on a relation, and a `claimId` on a claim -
 *      because those are the ones somebody would add believing they help.
 *
 * Every negative case starts from the same verified baseline and changes
 * exactly one thing, so a red assertion names one cause. Each block also
 * carries a positive control: a schema that refuses everything would satisfy
 * every refusal below while proving nothing.
 */

// ---------------------------------------------------------------------------
// Baselines. Plain JSON, so a negative case can hold a value the TYPE forbids.
// ---------------------------------------------------------------------------

function validFactRefJson(): Record<string, unknown> {
  return { factId: 'chart.dayMaster.stem', value: 'Xin' };
}

function validClaimJson(): Record<string, unknown> {
  return {
    draftRef: 'claim-day-master',
    statement: 'Der Tagesmeister traegt die Rolle, aus der die uebrigen Saeulen gelesen werden.',
    factRefs: [validFactRefJson()],
    themeRefs: ['self_role'],
    epistemicClass: 'SUPPORTED_INTERPRETATION',
  };
}

function secondClaimJson(): Record<string, unknown> {
  return {
    draftRef: 'claim-month-command',
    statement: 'Das Monatskommando setzt den saisonalen Rahmen, in dem diese Rolle gelesen wird.',
    factRefs: [{ factId: 'chart.monthCommand.branch', value: 'You' }],
    themeRefs: ['seasonal_anchor'],
    epistemicClass: 'TENTATIVE_INTERPRETATION',
  };
}

function validRelationJson(): Record<string, unknown> {
  return { from: 'claim-day-master', type: 'QUALIFIES', to: 'claim-month-command' };
}

function validOutputJson(): Record<string, unknown> {
  return {
    providerId: 'etbz-30.unit.provider',
    briefStructuralHash: 'brief-structural-hash-0c1',
    claims: [validClaimJson(), secondClaimJson()],
    relations: [validRelationJson()],
  };
}

/** The baseline with one claim replaced, for per-claim mutations. */
function outputWithClaim(claim: Record<string, unknown>): Record<string, unknown> {
  return { ...validOutputJson(), claims: [claim] };
}

/** The baseline with one relation replaced, for per-relation mutations. */
function outputWithRelation(relation: Record<string, unknown>): Record<string, unknown> {
  return { ...validOutputJson(), relations: [relation] };
}

function withoutKey(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...source };
  delete copy[key];
  return copy;
}

// ---------------------------------------------------------------------------
// Observation helpers
// ---------------------------------------------------------------------------

interface ObservedIssue {
  readonly path: string;
  readonly code: string;
}

function issuesOf(payload: unknown): readonly ObservedIssue[] {
  const parsed = interpretiveClaimSynthesisOutputSchema.safeParse(payload);
  if (parsed.success) {
    return [];
  }
  return parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '<root>',
    code: issue.code,
  }));
}

function accepts(payload: unknown): boolean {
  return interpretiveClaimSynthesisOutputSchema.safeParse(payload).success;
}

/** True when SOME issue matches; the schema may report more than one. */
function reports(payload: unknown, path: string, code: string): boolean {
  return issuesOf(payload).some((issue) => issue.path === path && issue.code === code);
}

// ---------------------------------------------------------------------------
// Compile-time exhaustiveness. A missing key here fails `tsc`, not a test.
// ---------------------------------------------------------------------------

const EVERY_CLAIM_RELATION_TYPE: Record<ClaimRelationType, true> = {
  SUPPORTS: true,
  QUALIFIES: true,
  CONTRASTS_WITH: true,
  CONTEXTUALIZES: true,
  DEVELOPS: true,
  INTEGRATES: true,
  ALTERNATIVE_READING: true,
};

const EVERY_EPISTEMIC_CLASS: Record<InterpretiveClaimEpistemicClass, true> = {
  SUPPORTED_INTERPRETATION: true,
  TENTATIVE_INTERPRETATION: true,
};

const EVERY_MOTIF_LIFECYCLE_STATE: Record<MotifLifecycleState, true> = {
  UNSEEN: true,
  SEEDED: true,
  DEVELOPED: true,
  COMPLICATED: true,
  INTEGRATED: true,
  CLOSED: true,
};

const EVERY_NARRATIVE_OPERATOR: Record<NarrativeOperator, true> = {
  ESTABLISH: true,
  REINFORCE: true,
  QUALIFY: true,
  CONTRAST: true,
  CONTEXTUALIZE: true,
  INTEGRATE: true,
};

describe('ETBZ-30 C1-1: the four vocabularies are closed and cannot silently drift', () => {
  const VOCABULARIES = [
    {
      label: 'claim relation types',
      values: CLAIM_RELATION_TYPES,
      options: claimRelationTypeSchema.options,
      exhaustive: EVERY_CLAIM_RELATION_TYPE,
      contract: [
        'SUPPORTS',
        'QUALIFIES',
        'CONTRASTS_WITH',
        'CONTEXTUALIZES',
        'DEVELOPS',
        'INTEGRATES',
        'ALTERNATIVE_READING',
      ],
    },
    {
      label: 'epistemic classes',
      values: INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES,
      options: interpretiveClaimEpistemicClassSchema.options,
      exhaustive: EVERY_EPISTEMIC_CLASS,
      contract: ['SUPPORTED_INTERPRETATION', 'TENTATIVE_INTERPRETATION'],
    },
    {
      label: 'motif lifecycle states',
      values: MOTIF_LIFECYCLE_STATES,
      options: motifLifecycleStateSchema.options,
      exhaustive: EVERY_MOTIF_LIFECYCLE_STATE,
      contract: ['UNSEEN', 'SEEDED', 'DEVELOPED', 'COMPLICATED', 'INTEGRATED', 'CLOSED'],
    },
    {
      label: 'narrative operators',
      values: NARRATIVE_OPERATORS,
      options: narrativeOperatorSchema.options,
      exhaustive: EVERY_NARRATIVE_OPERATOR,
      contract: ['ESTABLISH', 'REINFORCE', 'QUALIFY', 'CONTRAST', 'CONTEXTUALIZE', 'INTEGRATE'],
    },
  ] as const;

  it.each(VOCABULARIES)('$label match the canonical contract exactly, in order', (vocabulary) => {
    // The contract's own list, transcribed here a second time on purpose: this
    // is the one assertion that must NOT read from the module under test, or a
    // wrong edit would simply move both sides together.
    expect([...vocabulary.values]).toEqual(vocabulary.contract);
  });

  it.each(VOCABULARIES)('$label carry no duplicate member', (vocabulary) => {
    expect(new Set(vocabulary.values).size).toBe(vocabulary.values.length);
  });

  it.each(VOCABULARIES)('$label agree between the runtime array and the TypeScript union', (
    vocabulary,
  ) => {
    // The union side is the `Record<Union, true>` above: `tsc` refuses it if a
    // union member is missing, and this compares the other direction.
    expect(Object.keys(vocabulary.exhaustive).sort()).toEqual([...vocabulary.values].sort());
  });

  it.each(VOCABULARIES)('$label agree between the runtime array and the zod schema', (
    vocabulary,
  ) => {
    expect([...vocabulary.options]).toEqual([...vocabulary.values]);
  });
});

describe('ETBZ-30 C1-2: every approved vocabulary member is accepted', () => {
  it.each(CLAIM_RELATION_TYPES)('accepts the approved relation type %s', (relationType) => {
    expect(claimRelationTypeSchema.safeParse(relationType).success).toBe(true);
    // ...and through the full synthesis output, not only in isolation.
    expect(accepts(outputWithRelation({ ...validRelationJson(), type: relationType }))).toBe(true);
  });

  it.each(INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES)(
    'accepts the approved epistemic class %s',
    (epistemicClass) => {
      expect(interpretiveClaimEpistemicClassSchema.safeParse(epistemicClass).success).toBe(true);
      expect(accepts(outputWithClaim({ ...validClaimJson(), epistemicClass }))).toBe(true);
    },
  );

  it.each(MOTIF_LIFECYCLE_STATES)('accepts the approved motif lifecycle state %s', (state) => {
    expect(motifLifecycleStateSchema.safeParse(state).success).toBe(true);
  });

  it.each(NARRATIVE_OPERATORS)('accepts the approved narrative operator %s', (operator) => {
    expect(narrativeOperatorSchema.safeParse(operator).success).toBe(true);
  });
});

describe('ETBZ-30 C1-3: an unapproved vocabulary member is refused', () => {
  it('refuses a relation type nobody approved', () => {
    // Positive control first: refusal is not this schema's only outcome.
    expect(claimRelationTypeSchema.safeParse('SUPPORTS').success).toBe(true);

    for (const invalid of ['CAUSES', 'IMPLIES', 'REFUTES', 'supports', 'Supports', '']) {
      expect(claimRelationTypeSchema.safeParse(invalid).success, invalid).toBe(false);
      expect(reports(outputWithRelation({ ...validRelationJson(), type: invalid }), 'relations.0.type', 'invalid_value'), invalid).toBe(true);
    }
  });

  it('refuses an epistemic class nobody approved', () => {
    expect(interpretiveClaimEpistemicClassSchema.safeParse('SUPPORTED_INTERPRETATION').success).toBe(
      true,
    );

    for (const invalid of ['CERTAIN', 'SPECULATIVE', 'supported_interpretation', '']) {
      expect(interpretiveClaimEpistemicClassSchema.safeParse(invalid).success, invalid).toBe(false);
      expect(reports(outputWithClaim({ ...validClaimJson(), epistemicClass: invalid }), 'claims.0.epistemicClass', 'invalid_value'), invalid).toBe(true);
    }
  });

  it('refuses FACT as an epistemicClass: chart truth is not an interpretive claim', () => {
    // Admitting FACT here would make an UNTRUSTED synthesis boundary a second
    // source of chart facts - the one thing this whole layer exists to prevent.
    expect(INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES).not.toContain('FACT');
    expect(interpretiveClaimEpistemicClassSchema.safeParse('FACT').success).toBe(false);
    expect(
      reports(outputWithClaim({ ...validClaimJson(), epistemicClass: 'FACT' }), 'claims.0.epistemicClass', 'invalid_value'),
    ).toBe(true);
  });

  it('refuses REFLECTION as an epistemicClass: a reflection is downstream of accepted claims', () => {
    expect(INTERPRETIVE_CLAIM_EPISTEMIC_CLASSES).not.toContain('REFLECTION');
    expect(interpretiveClaimEpistemicClassSchema.safeParse('REFLECTION').success).toBe(false);
    expect(
      reports(outputWithClaim({ ...validClaimJson(), epistemicClass: 'REFLECTION' }), 'claims.0.epistemicClass', 'invalid_value'),
    ).toBe(true);
  });

  it('refuses an unapproved motif lifecycle state and narrative operator', () => {
    expect(motifLifecycleStateSchema.safeParse('SEEDED').success).toBe(true);
    expect(narrativeOperatorSchema.safeParse('ESTABLISH').success).toBe(true);

    for (const invalid of ['ABANDONED', 'REOPENED', 'seeded']) {
      expect(motifLifecycleStateSchema.safeParse(invalid).success, invalid).toBe(false);
    }
    for (const invalid of ['SUMMARIZE', 'REPEAT', 'establish']) {
      expect(narrativeOperatorSchema.safeParse(invalid).success, invalid).toBe(false);
    }
  });
});

describe('ETBZ-30 C1-4: a valid synthesis output parses', () => {
  it('accepts the verified baseline and changes nothing about it', () => {
    const parsed = interpretiveClaimSynthesisOutputSchema.safeParse(validOutputJson());

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    // Deep equality: the schema decides whether a shape is acceptable and
    // rewrites no content on its way through.
    expect(parsed.data).toEqual(validOutputJson());
    expect(Object.keys(parsed.data)).toEqual([
      'providerId',
      'briefStructuralHash',
      'claims',
      'relations',
    ]);
  });

  it('accepts an answer with no claims and no relations: emptiness is a later gate', () => {
    // Division of labour, stated so it cannot drift. "Too few claims" and
    // "a relation whose endpoints do not exist" are SEMANTIC questions about a
    // specific brief; asserting them here would duplicate a guard that has an
    // owner in a later commit, and duplicate guards are the ones that rot.
    expect(accepts({ ...validOutputJson(), claims: [], relations: [] })).toBe(true);
  });

  it('accepts a claim grounded by themeRefs alone and one grounded by factRefs alone', () => {
    // Which grounding is SUFFICIENT is a semantic decision made against the
    // brief. Structurally both arrays are present and may be empty.
    expect(accepts(outputWithClaim({ ...validClaimJson(), factRefs: [] }))).toBe(true);
    expect(accepts(outputWithClaim({ ...validClaimJson(), themeRefs: [] }))).toBe(true);
  });

  it('satisfies the port TypeScript contract it is declared against', () => {
    const parsed = interpretiveClaimSynthesisOutputSchema.safeParse(validOutputJson());
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    // The assignment IS the assertion: if the schema and the declared interface
    // ever disagree about a field name, type or vocabulary, `tsc` fails here.
    // The two are written separately in the port, so nothing but this check
    // holds them together.
    const typed: InterpretiveClaimSynthesisOutput = parsed.data;

    expect(typed.claims.map((claim) => claim.draftRef)).toEqual([
      'claim-day-master',
      'claim-month-command',
    ]);
    expect(typed.relations.map((relation) => relation.type)).toEqual(['QUALIFIES']);
  });
});

describe('ETBZ-30 C1-5: an extra key is refused at every level', () => {
  it('accepts the unmutated baseline, so each mutation below is the only difference', () => {
    expect(accepts(validOutputJson())).toBe(true);
  });

  it('refuses an invented key at the root', () => {
    expect(reports({ ...validOutputJson(), planVersion: 'v1' }, '<root>', 'unrecognized_keys')).toBe(
      true,
    );
  });

  it('refuses a claim that assigns itself an identity ETBZ has not derived', () => {
    // `claimId` is the application's bookkeeping and is derived in a later
    // commit. A provider-supplied one would be an identity nobody assigned.
    expect(
      reports(outputWithClaim({ ...validClaimJson(), claimId: 'claim-0001' }), 'claims.0', 'unrecognized_keys'),
    ).toBe(true);
  });

  it('refuses a claim that attaches a score the contract does not permit', () => {
    // Anti-drift law 7: narrative importance is not an invented number.
    for (const key of ['confidence', 'salience', 'weight', 'priority']) {
      expect(
        reports(outputWithClaim({ ...validClaimJson(), [key]: 0.9 }), 'claims.0', 'unrecognized_keys'),
        key,
      ).toBe(true);
    }
  });

  it('refuses a relation that carries anything beyond from/type/to', () => {
    // The contract's explicit list of what a relation must NOT carry: no
    // certainty, no provisionality, no salience, no evidence weight and no
    // narrative priority. Each one is refused by name.
    for (const key of ['certainty', 'provisionality', 'salience', 'evidenceWeight', 'narrativePriority']) {
      expect(
        reports(outputWithRelation({ ...validRelationJson(), [key]: 1 }), 'relations.0', 'unrecognized_keys'),
        key,
      ).toBe(true);
    }
  });

  it('refuses an invented key on a fact reference', () => {
    expect(
      reports(
        outputWithClaim({ ...validClaimJson(), factRefs: [{ ...validFactRefJson(), basis: 'memory' }] }),
        'claims.0.factRefs.0',
        'unrecognized_keys',
      ),
    ).toBe(true);
  });

  it('refuses a misspelled field rather than silently ignoring it', () => {
    // A rename reads as BOTH an unknown key and a missing one; either refusal
    // is correct, and what matters is that the answer does not pass.
    expect(accepts({ ...withoutKey(validOutputJson(), 'claims'), Claims: [] })).toBe(false);
    expect(accepts(outputWithClaim({ ...withoutKey(validClaimJson(), 'draftRef'), draftRefs: 'x' }))).toBe(
      false,
    );
  });
});

describe('ETBZ-30 C1-6: emptiness and omission are refused where they carry no meaning', () => {
  it('accepts the unmutated baseline, so each mutation below is the only difference', () => {
    expect(accepts(validOutputJson())).toBe(true);
  });

  it('refuses an empty draftRef: a claim nothing can point at', () => {
    expect(
      reports(outputWithClaim({ ...validClaimJson(), draftRef: '' }), 'claims.0.draftRef', 'too_small'),
    ).toBe(true);
  });

  it('refuses an empty statement: a claim with nothing to say is not a claim', () => {
    expect(
      reports(outputWithClaim({ ...validClaimJson(), statement: '' }), 'claims.0.statement', 'too_small'),
    ).toBe(true);
  });

  it('refuses an empty reference of any kind', () => {
    expect(
      reports(outputWithClaim({ ...validClaimJson(), themeRefs: [''] }), 'claims.0.themeRefs.0', 'too_small'),
    ).toBe(true);
    expect(
      reports(
        outputWithClaim({ ...validClaimJson(), factRefs: [{ factId: '', value: 'Xin' }] }),
        'claims.0.factRefs.0.factId',
        'too_small',
      ),
    ).toBe(true);
    expect(
      reports(outputWithRelation({ ...validRelationJson(), from: '' }), 'relations.0.from', 'too_small'),
    ).toBe(true);
    expect(
      reports(outputWithRelation({ ...validRelationJson(), to: '' }), 'relations.0.to', 'too_small'),
    ).toBe(true);
  });

  it('accepts an empty echoed fact VALUE, which is a comparison and not a length', () => {
    // Precision control for the floors above: the echo is checked against the
    // brief in a later commit, so refusing it here on length would be a guard
    // about the wrong property.
    expect(accepts(outputWithClaim({ ...validClaimJson(), factRefs: [{ factId: 'chart.x', value: '' }] }))).toBe(
      true,
    );
  });

  it.each(['providerId', 'briefStructuralHash', 'claims', 'relations'])(
    'refuses an answer missing the required top-level field %s',
    (field) => {
      expect(reports(withoutKey(validOutputJson(), field), field, 'invalid_type')).toBe(true);
    },
  );

  /**
   * MEASURED, not assumed: the code an omission produces depends on the KIND of
   * field, and that is a property of the validator rather than of this
   * contract. A missing string or array is reported as `invalid_type`; a
   * missing member of a closed vocabulary is reported as `invalid_value`,
   * because the enum check runs against the allowed values and `undefined` is
   * not one of them. Pinning a single code for both kinds asserted a zod
   * implementation detail that happens to be false, and the two enum fields
   * below are exactly where it failed.
   *
   * The contract statement is the first two assertions - the omission is
   * REFUSED and the refusal NAMES the field - and those hold whatever the code
   * is. The code is pinned afterwards so a silent change in how a refusal is
   * reported is still visible here rather than only in a later commit.
   */
  it.each([
    { field: 'draftRef', code: 'invalid_type' },
    { field: 'statement', code: 'invalid_type' },
    { field: 'factRefs', code: 'invalid_type' },
    { field: 'themeRefs', code: 'invalid_type' },
    { field: 'epistemicClass', code: 'invalid_value' },
  ])('refuses a claim missing the required field $field', ({ field, code }) => {
    const payload = outputWithClaim(withoutKey(validClaimJson(), field));

    expect(accepts(payload)).toBe(false);
    expect(issuesOf(payload).map((issue) => issue.path)).toContain(`claims.0.${field}`);
    expect(reports(payload, `claims.0.${field}`, code)).toBe(true);
  });

  it.each([
    { field: 'from', code: 'invalid_type' },
    { field: 'type', code: 'invalid_value' },
    { field: 'to', code: 'invalid_type' },
  ])('refuses a relation missing the required field $field', ({ field, code }) => {
    const payload = outputWithRelation(withoutKey(validRelationJson(), field));

    expect(accepts(payload)).toBe(false);
    expect(issuesOf(payload).map((issue) => issue.path)).toContain(`relations.0.${field}`);
    expect(reports(payload, `relations.0.${field}`, code)).toBe(true);
  });

  it('refuses a field of the wrong type and names the path that failed', () => {
    expect(reports({ ...validOutputJson(), claims: { first: validClaimJson() } }, 'claims', 'invalid_type')).toBe(
      true,
    );
    expect(reports(outputWithClaim({ ...validClaimJson(), statement: 42 }), 'claims.0.statement', 'invalid_type')).toBe(
      true,
    );
    expect(
      reports(outputWithClaim({ ...validClaimJson(), themeRefs: 'self_role' }), 'claims.0.themeRefs', 'invalid_type'),
    ).toBe(true);
  });

  it('refuses valid JSON that is not an object at all', () => {
    for (const payload of [[], 'claims', 42, null, true]) {
      expect(reports(payload, '<root>', 'invalid_type'), JSON.stringify(payload)).toBe(true);
    }
  });
});
