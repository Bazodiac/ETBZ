/**
 * ETBZ-34 — BazodiacInterpretationInput v1: validated hand-off, fail-closed,
 * and honest about what is not yet production-supported.
 */
import { describe, expect, it } from 'vitest';
import {
  InterpretationInputError,
  assertProductionEligible,
  buildBazodiacInterpretationInput,
} from '../../src/application/interpretation/interpretation-input.js';
import type { InterpretationInputErrorCode } from '../../src/application/interpretation/interpretation-input.js';
import { FUFIRE_DAY_BOUNDARY } from '../../src/adapters/fufire/http-client.js';
import { knownTimeModel, unknownTimeModel } from '../support/narrativeFixture.js';

function expectRefusal(code: InterpretationInputErrorCode, run: () => unknown): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(InterpretationInputError);
    expect((error as InterpretationInputError).code).toBe(code);
    return;
  }
  expect.unreachable(`expected refusal with ${code}`);
}

describe('ETBZ-34 N1: the hand-off package', () => {
  const input = buildBazodiacInterpretationInput(knownTimeModel());

  it('is versioned and bound to the method profile that authorises it', () => {
    expect(input.schemaVersion).toBe('bazodiac-interpretation-input.v1');
    expect(input.methodProfile.ref).toBe('bazi-method-profile@1.0.0');
    expect(input.methodProfile.registryStructuralHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(input.methodProfile.enablement.filter((entry) => entry.enabled).length).toBe(14);
  });

  it('is deterministic: same model, byte-identical package and hash', () => {
    expect(buildBazodiacInterpretationInput(knownTimeModel())).toEqual(input);
  });

  it('does not let a volatile producer timestamp change the hash', () => {
    const later = buildBazodiacInterpretationInput(
      knownTimeModel({ natal: { provenance: { computedAt: '2030-01-01T00:00:00Z' } } }),
    );
    expect(later.structuralHash).toBe(input.structuralHash);
  });

  it('changes its hash when a chart fact changes (counterfactual canary)', () => {
    const other = buildBazodiacInterpretationInput(
      knownTimeModel({ wuxing: { vector: { Holz: 1.8, Feuer: 2.6, Erde: 2, Metall: 2, Wasser: 2 } } }),
    );
    expect(other.structuralHash).not.toBe(input.structuralHash);
  });

  it('minimises PII: no display name, no coordinates, no place label', () => {
    const text = JSON.stringify(input);
    expect(text).not.toContain('Musterkundin');
    expect(text).not.toContain('"label"');
    expect(text).not.toContain('"displayName"');
    expect(text).not.toContain('52.52');
    expect(Object.keys(input.input).sort()).toEqual(['birthDate', 'birthTime', 'birthTimeKnown', 'timezone']);
  });

  it('records the canonical day boundary — the same value the adapter sends (PD-9)', () => {
    expect(input.precision.dayBoundary).toBe('midnight');
    expect(input.precision.dayBoundary).toBe(FUFIRE_DAY_BOUNDARY);
  });

  it('preserves source warnings verbatim', () => {
    expect(input.warnings).toEqual(knownTimeModel().sourceWarnings);
  });

  it('exposes every new addressable fact, and no raw path', () => {
    for (const id of [
      'chart.natal.pillar.year.stemPolarity',
      'chart.natal.pillar.month.tenGod.elementRelation',
      'chart.natal.pillar.day.hiddenStem.0.qi',
      'chart.natal.pillar.day.hiddenStem.0.tenGod.elementRelation',
      'chart.natal.monthCommand.element',
    ]) {
      expect(input.validatedChart.factIds, id).toContain(id);
    }
    expect(input.validatedChart.factIds.every((id) => id.startsWith('chart.'))).toBe(true);
  });
});

describe('ETBZ-34 N2: fail-closed validation', () => {
  it('refuses a Wu-Xing vector that is not the BaZi four-pillars basis', () => {
    expectRefusal('INTERPRETATION_INPUT_BASIS_INVALID', () =>
      buildBazodiacInterpretationInput(knownTimeModel({ wuxing: { basis: 'western_planets' } })));
  });

  it('refuses a dominant element that is not a maximum of the vector', () => {
    expectRefusal('INTERPRETATION_INPUT_DOMINANT_INCONSISTENT', () =>
      buildBazodiacInterpretationInput(knownTimeModel({ wuxing: { dominant: 'Holz' } })));
  });

  it('accepts ANY maximum on a tie and invents no tie-break', () => {
    const tied = { vector: { Holz: 2, Feuer: 2.5, Erde: 2.5, Metall: 2, Wasser: 2 } };
    expect(() => buildBazodiacInterpretationInput(knownTimeModel({ wuxing: { ...tied, dominant: 'Feuer' } }))).not.toThrow();
    expect(() => buildBazodiacInterpretationInput(knownTimeModel({ wuxing: { ...tied, dominant: 'Erde' } }))).not.toThrow();
  });
});

describe('ETBZ-34 N3: unknown birth time', () => {
  const input = buildBazodiacInterpretationInput(unknownTimeModel());

  it('keeps the domain semantics: birth_time_known=false and NO birth time of any kind', () => {
    expect(input.input.birthTimeKnown).toBe(false);
    expect('birthTime' in input.input).toBe(false);
    expect(input.precision.unknownTimeContract.consumerSubstitutedTime).toBe(false);
  });

  it('never hands the assumed calculation instant downstream as a birth datetime', () => {
    expect(input.fufire.bazi.dates.birthLocal).toBeNull();
    expect(input.fufire.bazi.dates.birthUtc).toBeNull();
    expect(buildBazodiacInterpretationInput(knownTimeModel()).fufire.bazi.dates.birthLocal).not.toBeNull();
  });

  it('excludes every hour-pillar fact from interpretation and keeps it as evidence (PD-10)', () => {
    const hourFacts = input.validatedChart.facts.filter((fact) => fact.pillar === 'hour');
    expect(hourFacts.length).toBeGreaterThan(0);
    expect(hourFacts.every((fact) => !fact.interpretable && fact.exclusionReason === 'ASSUMED_TIME_DERIVED' && fact.provisional)).toBe(true);
    expect([...input.provisionality.excludedFactIds].sort()).toEqual(hourFacts.map((fact) => fact.id).sort());
    expect(input.provisionality.exclusionReason).toBe('ASSUMED_TIME_DERIVED');
  });

  it('excludes nothing when the birth time is known (counterfactual)', () => {
    const known = buildBazodiacInterpretationInput(knownTimeModel());
    expect(known.provisionality.excludedFactIds).toEqual([]);
    expect(known.provisionality.provisionalFactIds).toEqual([]);
    expect(known.validatedChart.facts.every((fact) => fact.interpretable)).toBe(true);
  });

  it('marks every Wu-Xing fact provisional, and leaves year / month / day certain (F-1, UT-7)', () => {
    const facts = input.validatedChart.facts;
    expect(facts.filter((fact) => fact.id.startsWith('chart.wuxing.')).every((fact) => fact.provisional)).toBe(true);
    expect(facts.filter((fact) => fact.pillar !== null && fact.pillar !== 'hour').some((fact) => fact.provisional)).toBe(false);
    expect(facts.find((fact) => fact.id === 'chart.dayMaster.stem')?.provisional).toBe(false);
  });

  it('states that the producer assumption metadata is NOT delivered — it invents none', () => {
    expect(input.precision.unknownTimeContract.producerAssumptionMetadata).toBe('NOT_DELIVERED_BY_PINNED_CONTRACT');
    expect(input.precision.unknownTimeContract.upstream).toEqual(['FUF-163', 'FUF-164', 'FUF-165']);
    // No time of day is stated anywhere as the birth: not noon, not midnight.
    expect(JSON.stringify(input)).not.toMatch(/T(12|00):00:00/u);
    expect(JSON.stringify(input.input)).not.toMatch(/\d{2}:\d{2}/u);
  });
});

describe('ETBZ-34 N4: no false production claim', () => {
  it('is not production-eligible for unknown time: the producer contract is not delivered', () => {
    const input = buildBazodiacInterpretationInput(unknownTimeModel());
    expect(input.productionEligibility.eligible).toBe(false);
    expect(input.productionEligibility.blockers).toContain('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED');
    expectRefusal('INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE', () => assertProductionEligible(input));
  });

  it('is not production-eligible for known time either, until the ETBZ-34 source-pillar guard exists', () => {
    const input = buildBazodiacInterpretationInput(knownTimeModel());
    expect(input.validation.sameChartWuxing).toBe('NOT_VERIFIED');
    expect(input.productionEligibility.blockers).toEqual(['WUXING_SOURCE_PILLARS_NOT_VERIFIED']);
    expectRefusal('INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE', () => assertProductionEligible(input));
  });
});
