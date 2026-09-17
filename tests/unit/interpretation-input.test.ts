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
import { knownTimeChart, knownTimeModel, unknownTimeChart } from '../support/narrativeFixture.js';
import type { ChartWithEvidence } from '../support/narrativeFixture.js';

type Overrides = Parameters<typeof knownTimeChart>[0];
const build = (chart: ChartWithEvidence): ReturnType<typeof buildBazodiacInterpretationInput> =>
  buildBazodiacInterpretationInput(chart.model, chart.source);
const known = (overrides: Overrides = {}): ReturnType<typeof build> => build(knownTimeChart(overrides));
const unknown = (overrides: Overrides = {}): ReturnType<typeof build> => build(unknownTimeChart(overrides));

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
  const input = known();

  it('is versioned and bound to the method profile that authorises it', () => {
    expect(input.schemaVersion).toBe('bazodiac-interpretation-input.v1');
    expect(input.methodProfile.ref).toBe('bazi-method-profile@1.0.0');
    expect(input.methodProfile.registryStructuralHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(input.methodProfile.enablement.filter((entry) => entry.enabled).length).toBe(14);
  });

  it('is deterministic: same model, byte-identical package and hash', () => {
    expect(known()).toEqual(input);
  });

  it('does not let a volatile producer timestamp change the hash', () => {
    const later = known({ natal: { provenance: { computedAt: '2030-01-01T00:00:00Z' } } });
    expect(later.structuralHash).toBe(input.structuralHash);
  });

  it('changes its hash when a chart fact changes (counterfactual canary)', () => {
    const other = known({ wuxing: { vector: { Holz: 1.8, Feuer: 2.6, Erde: 2, Metall: 2, Wasser: 2 } } });
    expect(other.structuralHash).not.toBe(input.structuralHash);
  });

  it('minimises PII: no display name, no coordinates, no place label', () => {
    const text = JSON.stringify(input);
    expect(text).not.toContain('Musterkundin');
    expect(text).not.toContain('"label"');
    expect(text).not.toContain('"displayName"');
    expect(text).not.toContain('52.52');
    expect(text).not.toContain('13.405');
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
      known({ wuxing: { basis: 'western_planets' } }));
  });

  it('refuses a dominant element that is not a maximum of the vector', () => {
    expectRefusal('INTERPRETATION_INPUT_DOMINANT_INCONSISTENT', () =>
      known({ wuxing: { dominant: 'Holz' } }));
  });

  it('accepts ANY maximum on a tie and invents no tie-break', () => {
    const tied = { vector: { Holz: 2, Feuer: 2.5, Erde: 2.5, Metall: 2, Wasser: 2 } };
    expect(() => known({ wuxing: { ...tied, dominant: 'Feuer' } })).not.toThrow();
    expect(() => known({ wuxing: { ...tied, dominant: 'Erde' } })).not.toThrow();
  });
});

describe('ETBZ-34 N3: unknown birth time', () => {
  const input = unknown();

  it('keeps the domain semantics: birth_time_known=false and NO birth time of any kind', () => {
    expect(input.input.birthTimeKnown).toBe(false);
    expect('birthTime' in input.input).toBe(false);
    expect(input.precision.unknownTimeContract.consumerSubstitutedTime).toBe(false);
  });

  it('never hands the assumed calculation instant downstream as a birth datetime', () => {
    expect(input.validatedSnapshots.bazi.dates.birthLocal).toBeNull();
    expect(input.validatedSnapshots.bazi.dates.birthUtc).toBeNull();
    expect(known().validatedSnapshots.bazi.dates.birthLocal).not.toBeNull();
  });

  it('excludes every hour-pillar fact from interpretation and keeps it as evidence (PD-10)', () => {
    const hourFacts = input.validatedChart.facts.filter((fact) => fact.pillar === 'hour');
    expect(hourFacts.length).toBeGreaterThan(0);
    expect(hourFacts.every((fact) => !fact.interpretable && fact.exclusionReason === 'ASSUMED_TIME_DERIVED' && fact.provisional)).toBe(true);
    expect([...input.provisionality.excludedFactIds].sort()).toEqual(hourFacts.map((fact) => fact.id).sort());
    expect(input.provisionality.exclusionReason).toBe('ASSUMED_TIME_DERIVED');
  });

  it('excludes nothing when the birth time is known (counterfactual)', () => {
    const certain = known();
    expect(certain.provisionality.excludedFactIds).toEqual([]);
    expect(certain.provisionality.provisionalFactIds).toEqual([]);
    expect(certain.validatedChart.facts.every((fact) => fact.interpretable)).toBe(true);
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
    // The raw evidence block is the one place a producer instant may appear; it
    // is flagged as containing an ASSUMED time and is never a claim source.
    const { fufire, ...withoutRawEvidence } = input;
    expect(fufire.containsAssumedTime).toBe(true);
    expect(JSON.stringify(withoutRawEvidence)).not.toMatch(/T(12|00):00:00/u);
    expect(JSON.stringify(input.input)).not.toMatch(/\d{2}:\d{2}/u);
  });
});

describe('ETBZ-34 N4: no false production claim', () => {
  it('is not production-eligible for unknown time: the producer contract is not delivered', () => {
    const input = unknown();
    expect(input.productionEligibility.eligible).toBe(false);
    expect(input.productionEligibility.blockers).toContain('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED');
    expectRefusal('INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE', () => assertProductionEligible(input));
  });

  it('is not production-eligible for known time either, until the ETBZ-34 source-pillar guard exists', () => {
    const input = known();
    expect(input.validation.sameChartWuxing).toBe('NOT_VERIFIED');
    expect(input.productionEligibility.blockers).toEqual(['WUXING_SOURCE_PILLARS_NOT_VERIFIED']);
    expectRefusal('INTERPRETATION_INPUT_NOT_PRODUCTION_ELIGIBLE', () => assertProductionEligible(input));
  });
});

describe('ETBZ-34 N5: raw producer evidence (finding A)', () => {
  const chart = knownTimeChart();
  const input = build(chart);

  it('preserves the complete BaZi, BaZi/WuXing and Natal responses verbatim', () => {
    expect(input.fufire.baziRaw.endpoint).toBe('/v1/calculate/bazi');
    expect(input.fufire.wuxingRaw.endpoint).toBe('/v1/calculate/bazi/wuxing');
    expect(input.fufire.natalRaw.endpoint).toBe('/v1/calculate/bazi/natal');
    expect(input.fufire.baziRaw.payload).toEqual(chart.source.bazi.raw?.payload);
    expect(input.fufire.natalRaw.payload).toEqual(chart.source.natal.raw?.payload);
    expect(input.fufire.baziRaw.redactions).toEqual([]);
    expect(input.fufire.baziRaw.payloadStructuralHash).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it('redacts ONLY the echoed request coordinates and says so; every producer value survives', () => {
    const payload = input.fufire.wuxingRaw.payload as Record<string, unknown>;
    const original = chart.source.wuxing.raw?.payload as Record<string, unknown>;
    expect(input.fufire.wuxingRaw.redactions).toEqual(['input.lat', 'input.lon']);
    expect(payload['input']).toEqual({ ...(original['input'] as object), lat: 'REDACTED_PII', lon: 'REDACTED_PII' });
    const withoutEcho = (body: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'input'));
    expect(withoutEcho(payload)).toEqual(withoutEcho(original));
  });

  it('is marked non-claim-bearing at every level', () => {
    expect(input.fufire.claimBearing).toBe(false);
    for (const evidence of [input.fufire.baziRaw, input.fufire.wuxingRaw, input.fufire.natalRaw]) {
      expect(evidence.claimBearing).toBe(false);
    }
  });

  it('refuses to build without the raw response of any one endpoint', () => {
    for (const endpoint of ['bazi', 'wuxing', 'natal'] as const) {
      const bare = Object.fromEntries(Object.entries(chart.source[endpoint]).filter(([key]) => key !== 'raw'));
      const source = { ...chart.source, [endpoint]: bare } as unknown as typeof chart.source;
      expectRefusal('INTERPRETATION_INPUT_RAW_EVIDENCE_MISSING', () =>
        buildBazodiacInterpretationInput(chart.model, source));
    }
  });

  it('refuses evidence that belongs to another chart', () => {
    const other = knownTimeChart({ wuxing: { vector: { Holz: 1.8, Feuer: 2.6, Erde: 2, Metall: 2, Wasser: 2 } } });
    expectRefusal('INTERPRETATION_INPUT_EVIDENCE_NOT_SAME_CHART', () =>
      buildBazodiacInterpretationInput(chart.model, other.source));
    expectRefusal('INTERPRETATION_INPUT_EVIDENCE_NOT_SAME_CHART', () =>
      buildBazodiacInterpretationInput(knownTimeModel(), unknownTimeChart().source));
  });

  it('a change in the raw bytes changes that body\'s hash, never the fact boundary', () => {
    const tampered = structuredClone(chart.source) as { wuxing: { raw: { payload: Record<string, unknown> } } } & typeof chart.source;
    tampered.wuxing.raw.payload['contribution_ledger'] = { injected: 'Day Master is strong' };
    const other = buildBazodiacInterpretationInput(chart.model, tampered);
    expect(other.fufire.wuxingRaw.payloadStructuralHash).not.toBe(input.fufire.wuxingRaw.payloadStructuralHash);
    expect(other.validatedChart.facts).toEqual(input.validatedChart.facts);
    expect(other.validatedChart.featureSetStructuralHash).toBe(input.validatedChart.featureSetStructuralHash);
  });

  it('no addressable fact points into the raw evidence', () => {
    for (const fact of input.validatedChart.facts) {
      expect(fact.id.startsWith('chart.')).toBe(true);
      expect(fact.path).not.toMatch(/raw|payload|fufire\./iu);
    }
  });
});
