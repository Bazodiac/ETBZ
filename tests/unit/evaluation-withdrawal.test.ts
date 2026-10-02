/**
 * ETBZ-59 (PO decision D-59-1, Jira ETBZ-59 comment 17034) — the evaluation withdrawal: the removal case of the
 * Anti-Boilerplate contract (77266967 v3, section 6.4) withdraws named facts from a known-time chart through the
 * normal validation path. A withdrawn fact stays in the chart as evidence but is excluded from interpretation, the
 * withdrawal is part of the model's canonical text, and an input built from such a model is never
 * production-eligible. A model without a withdrawal is byte-identical to before.
 */
import { describe, expect, it } from 'vitest';
import { fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import { InterpretationError } from '../../src/application/interpretation/errors.js';
import type { InterpretationErrorCode } from '../../src/application/interpretation/errors.js';
import { deriveInterpretationFeatureSet, withdrawFactsForEvaluation } from '../../src/application/interpretation/feature-set.js';
import { assertProductionEligible, buildBazodiacInterpretationInput, InterpretationInputError } from '../../src/application/interpretation/interpretation-input.js';
import { ClaimError } from '../../src/application/interpretation/interpretive-claim.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { contextFor, draftOf, recurrenceClaim } from '../support/claimGraphFixture.js';
import { knownTimeChart, unknownTimeChart } from '../support/narrativeFixture.js';

const REFERENCE = 'Jira ETBZ-59 comment 17034, D-59-1';
const HOUR_TEN_GOD = 'chart.natal.pillar.hour.tenGod';
const DAY_MASTER = 'chart.dayMaster.stem';
const MONTH_COMMAND = 'chart.natal.monthCommand.branch';
const MONTH_TEN_GOD = 'chart.natal.pillar.month.tenGod';

function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof InterpretationError) return error.code;
    return `THREW:${error instanceof Error ? error.name : typeof error}`;
  }
  return 'NO_REFUSAL';
}

describe('ETBZ-59 D-59-1: withdrawing facts for evaluation', () => {
  const { model, source } = knownTimeChart();
  const base = deriveInterpretationFeatureSet(model);

  it('excludes exactly the named facts, as provisional, with the withdrawal as the reason', () => {
    const withdrawn = withdrawFactsForEvaluation(model, [HOUR_TEN_GOD], REFERENCE);
    const facts = deriveInterpretationFeatureSet(withdrawn).facts;
    const hour = facts.find((fact) => fact.id === HOUR_TEN_GOD);
    expect(hour).toMatchObject({ interpretable: false, provisional: true, exclusionReason: 'WITHDRAWN_FOR_EVALUATION' });
    const others = facts.filter((fact) => fact.id !== HOUR_TEN_GOD);
    expect(others).toEqual(base.facts.filter((fact) => fact.id !== HOUR_TEN_GOD));
    expect(deriveInterpretationFeatureSet(withdrawn).excludedFactIds).toEqual([HOUR_TEN_GOD]);
  });

  it('records the withdrawal in the model and its canonical text, so the variant is a different chart identity', () => {
    const withdrawn = withdrawFactsForEvaluation(model, [HOUR_TEN_GOD, MONTH_TEN_GOD], REFERENCE);
    expect(withdrawn.evaluationWithdrawal).toEqual({ factIds: [HOUR_TEN_GOD, MONTH_TEN_GOD], reference: REFERENCE });
    expect(withdrawn.canonicalJson).not.toBe(model.canonicalJson);
    expect(withdrawn.canonicalJson).toContain('"evaluationWithdrawal"');
    expect(deriveInterpretationFeatureSet(withdrawn).structuralHash).not.toBe(base.structuralHash);
  });

  it('leaves the source model untouched and a model without a withdrawal byte-identical', () => {
    const before = model.canonicalJson;
    withdrawFactsForEvaluation(model, [HOUR_TEN_GOD], REFERENCE);
    expect(model.canonicalJson).toBe(before);
    expect(model.evaluationWithdrawal).toBeUndefined();
    expect(model.canonicalJson).not.toContain('evaluationWithdrawal');
    expect(deriveInterpretationFeatureSet(model).structuralHash).toBe(base.structuralHash);
  });

  it.each<[string, () => unknown, InterpretationErrorCode]>([
    ['an empty list', () => withdrawFactsForEvaluation(model, [], REFERENCE), 'WITHDRAWAL_EMPTY'],
    ['an id the chart does not carry', () => withdrawFactsForEvaluation(model, ['chart.natal.pillar.hour.nothing'], REFERENCE), 'WITHDRAWAL_UNKNOWN_FACT'],
    ['the same id twice', () => withdrawFactsForEvaluation(model, [HOUR_TEN_GOD, HOUR_TEN_GOD], REFERENCE), 'WITHDRAWAL_DUPLICATE_FACT'],
    ['no reference to the decision', () => withdrawFactsForEvaluation(model, [HOUR_TEN_GOD], '  '), 'WITHDRAWAL_REFERENCE_MISSING'],
    ['an unknown-time chart', () => withdrawFactsForEvaluation(unknownTimeChart().model, [MONTH_TEN_GOD], REFERENCE), 'WITHDRAWAL_UNKNOWN_TIME'],
    [
      'a second withdrawal on a withdrawn chart',
      () => withdrawFactsForEvaluation(withdrawFactsForEvaluation(model, [HOUR_TEN_GOD], REFERENCE), [MONTH_TEN_GOD], REFERENCE),
      'WITHDRAWAL_ALREADY_APPLIED',
    ],
    ['the day master, a theme anchor', () => withdrawFactsForEvaluation(model, [DAY_MASTER], REFERENCE), 'WITHDRAWAL_STRUCTURAL_ANCHOR'],
    ['the month command, a theme anchor', () => withdrawFactsForEvaluation(model, [HOUR_TEN_GOD, MONTH_COMMAND], REFERENCE), 'WITHDRAWAL_STRUCTURAL_ANCHOR'],
  ])('refuses %s', (_name, run, code) => {
    expect(codeOf(run)).toBe(code);
  });

  it.each<[string, readonly string[], InterpretationErrorCode]>([
    ['names a fact the chart does not carry', ['chart.natal.pillar.hour.nothing'], 'WITHDRAWAL_UNKNOWN_FACT'],
    ['names a theme anchor', [MONTH_COMMAND], 'WITHDRAWAL_STRUCTURAL_ANCHOR'],
  ])('refuses a hand-built model whose recorded withdrawal %s', (_name, factIds, code) => {
    const forged = { ...model, evaluationWithdrawal: { factIds, reference: REFERENCE } };
    expect(codeOf(() => deriveInterpretationFeatureSet(forged))).toBe(code);
  });

  it('refuses a hand-built withdrawal on an unknown-time chart', () => {
    const chart = unknownTimeChart();
    const forged = { ...chart.model, evaluationWithdrawal: { factIds: [MONTH_TEN_GOD], reference: REFERENCE } };
    expect(codeOf(() => deriveInterpretationFeatureSet(forged))).toBe('WITHDRAWAL_UNKNOWN_TIME');
  });

  it('builds an input that names the withdrawal and is never production-eligible', () => {
    const withdrawn = withdrawFactsForEvaluation(model, [HOUR_TEN_GOD], REFERENCE);
    const input = buildBazodiacInterpretationInput(withdrawn, source, { mapper: fufireResponseMapper });
    expect(input.productionEligibility.eligible).toBe(false);
    expect(input.productionEligibility.blockers).toContain('EVALUATION_WITHDRAWAL_PRESENT');
    expect(input.provisionality.excludedFactIds).toEqual([HOUR_TEN_GOD]);
    expect(input.provisionality.exclusionReason).toBe('WITHDRAWN_FOR_EVALUATION');
    expect(() => assertProductionEligible(input)).toThrow(InterpretationInputError);
  });

  it('keeps the unknown-time exclusion reason for an unknown-time chart', () => {
    const chart = unknownTimeChart();
    const input = buildBazodiacInterpretationInput(chart.model, chart.source, { mapper: fufireResponseMapper });
    expect(input.provisionality.exclusionReason).toBe('ASSUMED_TIME_DERIVED');
    expect(input.productionEligibility.blockers).not.toContain('EVALUATION_WITHDRAWAL_PRESENT');
  });

  it('refuses a claim that cites a withdrawn fact, naming the withdrawal and not an assumed time', () => {
    const withdrawn = withdrawFactsForEvaluation(model, [MONTH_TEN_GOD], REFERENCE);
    const context = contextFor(withdrawn);
    const draft = draftOf([recurrenceClaim()], context);
    let caught: unknown;
    try {
      buildInterpretiveClaimGraph(draft, context);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ClaimError);
    expect((caught as ClaimError).code).toBe('CLAIM_EXCLUDED_FACT_CITED');
    expect((caught as ClaimError).message).toContain('withdrawn for evaluation');
    expect((caught as ClaimError).message).not.toContain('assumed time');
  });

  it('accepts the same claim on the source chart (positive control)', () => {
    const context = contextFor(model);
    expect(buildInterpretiveClaimGraph(draftOf([recurrenceClaim()], context), context).claims).toHaveLength(1);
  });
});
