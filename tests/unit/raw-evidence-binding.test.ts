/**
 * ETBZ-34 — the raw-evidence invariant behind `rawEvidenceSameChart: true`:
 *
 *   RAW PRODUCER PAYLOAD -> producer mapper/validator -> snapshot
 *                        == the snapshot the HoroscopeModel was built from.
 *
 * Each test below keeps the ACCEPTED snapshot fixed and tampers only with the
 * attached raw body — the exact case a snapshot-only binding cannot see.
 */
import { describe, expect, it } from 'vitest';
import { fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import {
  InterpretationInputError,
  buildBazodiacInterpretationInput,
} from '../../src/application/interpretation/interpretation-input.js';
import type { ProducerSnapshots } from '../../src/application/interpretation/interpretation-input.js';
import { knownTimeChart } from '../support/narrativeFixture.js';

const MAPPER = { mapper: fufireResponseMapper };
type Endpoint = 'bazi' | 'wuxing' | 'natal';

/** Same snapshots, one raw body edited in place. */
function tamper(endpoint: Endpoint, edit: (payload: Record<string, never>) => void): ProducerSnapshots {
  const source = structuredClone(knownTimeChart().source) as ProducerSnapshots;
  const raw = source[endpoint].raw;
  if (raw === undefined) throw new Error('fixture: raw missing');
  edit(raw.payload as Record<string, never>);
  return source;
}

function expectMismatch(source: ProducerSnapshots): void {
  const chart = knownTimeChart();
  try {
    buildBazodiacInterpretationInput(chart.model, source, MAPPER);
  } catch (error) {
    expect(error).toBeInstanceOf(InterpretationInputError);
    expect((error as InterpretationInputError).code, (error as InterpretationInputError).message).toBe('INTERPRETATION_INPUT_RAW_EVIDENCE_MISMATCH');
    return;
  }
  expect.unreachable('tampered raw evidence must not be accepted as this chart\'s evidence');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('ETBZ-34 raw evidence must map to the accepted snapshot', () => {
  it('positive control: untouched evidence is accepted and the invariant is reported true', () => {
    const chart = knownTimeChart();
    const input = buildBazodiacInterpretationInput(chart.model, chart.source, MAPPER);
    expect(input.validation.rawEvidenceSameChart).toBe(true);
    expect(input.validation.sameChartWuxing).toBe(true);
  });

  it('A — blocks a raw BaZi day pillar / Day Master that differs from the accepted one', () => {
    expectMismatch(tamper('bazi', (payload: any) => { payload.pillars.day.stamm = 'Ren'; payload.pillars.day.element = 'Wasser'; payload.chinese.day_master = 'Ren'; }));
    expectMismatch(tamper('bazi', (payload: any) => { payload.chinese.day_master = 'Ren'; }));
  });

  it('B — blocks a raw Wu-Xing vector that differs', () => {
    expectMismatch(tamper('wuxing', (payload: any) => { payload.wu_xing_vector.Feuer = 2.6; }));
  });

  it('C — blocks a raw Wu-Xing dominant that differs (even when it is also a maximum)', () => {
    expectMismatch(tamper('wuxing', (payload: any) => { payload.wu_xing_vector.Erde = 2.5; payload.dominant_element = 'Erde'; }));
    // …and one that is not a maximum fails the producer contract itself.
    expectMismatch(tamper('wuxing', (payload: any) => { payload.dominant_element = 'Holz'; }));
  });

  it('D — blocks a raw Wu-Xing source pillar that differs', () => {
    expectMismatch(tamper('wuxing', (payload: any) => { payload.pillars.month.branch = 'Zi'; }));
  });

  it('E — blocks a raw Natal month command / Ten-God tuple that differs', () => {
    expectMismatch(tamper('natal', (payload: any) => { payload.month_command.principal_qi_stem = 'Ji'; }));
    expectMismatch(tamper('natal', (payload: any) => {
      payload.pillars.year.ten_god = { name: 'Friend', pinyin: 'Bi Jian', element_relation: 'same_element', label_de: 'Gefährte' };
    }));
    expectMismatch(tamper('natal', (payload: any) => { payload.warnings = [...payload.warnings, 'INJECTED_WARNING']; }));
  });

  it('F — an additive field the pinned contract PERMITS changes the evidence hash and nothing else', () => {
    const chart = knownTimeChart();
    const reference = buildBazodiacInterpretationInput(chart.model, chart.source, MAPPER);
    const source = tamper('bazi', (payload: any) => { payload.quality_flags = { ephemeris_mode: 'moshier' }; });
    const input = buildBazodiacInterpretationInput(chart.model, source, MAPPER);
    expect(input.fufire.baziRaw.originalPayloadSha256).not.toBe(reference.fufire.baziRaw.originalPayloadSha256);
    expect(input.validatedChart.facts).toEqual(reference.validatedChart.facts);
    expect(input.validatedChart.featureSetStructuralHash).toBe(reference.validatedChart.featureSetStructuralHash);
    expect(input.structuralHash).toBe(reference.structuralHash);
  });

  it('F — an additive field the pinned contract FORBIDS blocks (Natal is additionalProperties:false)', () => {
    expectMismatch(tamper('natal', (payload: any) => { payload.month_command.seasonal_state = 'Wang'; }));
    expectMismatch(tamper('natal', (payload: any) => { payload.day_master_strength = 'strong'; }));
  });

  it('blocks a raw body that is not the endpoint\'s contract at all', () => {
    const chart = knownTimeChart();
    const swapped = structuredClone(chart.source) as ProducerSnapshots;
    (swapped.wuxing as { raw: unknown }).raw = { endpoint: '/v1/calculate/wuxing', payload: { ...(chart.source.wuxing.raw?.payload as object), basis: 'western_planetary' } };
    expectMismatch(swapped);
  });
});

describe('ETBZ-34 raw-evidence redaction (PO decision, MVP v1)', () => {
  const chart = knownTimeChart();
  const input = buildBazodiacInterpretationInput(chart.model, chart.source, MAPPER);

  it('keeps BOTH hashes and an explicit manifest for the redacted body', () => {
    const evidence = input.fufire.wuxingRaw;
    expect(evidence.redactions).toEqual(['input.lat', 'input.lon']);
    expect(evidence.originalPayloadSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(evidence.storedPayloadSha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(evidence.storedPayloadSha256).not.toBe(evidence.originalPayloadSha256);
    expect(evidence.claimBearing).toBe(false);
  });

  it('reports identical hashes and an empty manifest where nothing was redacted', () => {
    expect(input.fufire.baziRaw.redactions).toEqual(['input.lat', 'input.lon']);
    for (const evidence of [input.fufire.natalRaw]) {
      expect(evidence.redactions).toEqual([]);
      expect(evidence.storedPayloadSha256).toBe(evidence.originalPayloadSha256);
    }
  });

  it('redacts coordinates only: every symbolic response fact of the Wu-Xing body survives', () => {
    const stored = input.fufire.wuxingRaw.payload as Record<string, unknown>;
    const original = chart.source.wuxing.raw?.payload as Record<string, unknown>;
    for (const key of ['wu_xing_vector', 'dominant_element', 'basis', 'pillars', 'precision', 'contribution_ledger']) {
      expect(stored[key], key).toEqual(original[key]);
    }
    // The stored body still maps to the same snapshot: redaction touched no fact.
    const { raw: _raw, ...accepted } = chart.source.wuxing;
    void _raw;
    expect(fufireResponseMapper.mapWuxing(stored)).toEqual(accepted);
  });

  it('redacts an echoed coordinate wherever it is nested, and never a symbolic value that merely equals it', () => {
    const source = structuredClone(chart.source) as ProducerSnapshots;
    const body = source.bazi.raw?.payload as Record<string, unknown>;
    body['derivation_trace'] = { longitude_deg: 13.405, solar_longitude_deg: 13.405, steps: [{ lat: 52.52, weight: 52.52 }] };
    const stored = buildBazodiacInterpretationInput(chart.model, source, MAPPER).fufire.baziRaw;
    expect(stored.redactions).toEqual(['derivation_trace.longitude_deg', 'derivation_trace.steps[0].lat', 'input.lat', 'input.lon']);
    const trace = (stored.payload as Record<string, unknown>)['derivation_trace'] as Record<string, unknown>;
    expect(trace['solar_longitude_deg']).toBe(13.405);
    expect((trace['steps'] as Record<string, unknown>[])[0]?.['weight']).toBe(52.52);
    expect(JSON.stringify(stored.payload)).not.toMatch(/"(?:lat|lon|longitude_deg)":\s*\d/u);
  });

  it('does not redact a coordinate-named key that carries another value', () => {
    const source = structuredClone(chart.source) as ProducerSnapshots;
    (source.bazi.raw?.payload as Record<string, unknown>)['reference'] = { lon: 116.4 };
    const stored = buildBazodiacInterpretationInput(chart.model, source, MAPPER).fufire.baziRaw;
    expect(stored.redactions).toEqual(['input.lat', 'input.lon']);
    expect(((stored.payload as Record<string, unknown>)['reference'] as Record<string, unknown>)['lon']).toBe(116.4);
  });
});
