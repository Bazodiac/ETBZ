/**
 * ETBZ-34 — the whole deterministic foundation in one run, through the REAL
 * adapter, mapper, use case and builder (only the HTTP transport is a fake):
 *
 *   wire bodies -> FuFirE client (maps + keeps raw) -> use case -> HoroscopeModel
 *               -> BazodiacInterpretationInput v1 (raw evidence proven, facts addressable)
 *
 * No hand-built snapshot appears here: what passes is what the production path
 * produces for these wire bodies.
 */
import { describe, expect, it } from 'vitest';
import {
  FUFIRE_BAZI_PATH,
  FUFIRE_NATAL_PATH,
  FUFIRE_WUXING_PATH,
  createFufireClient,
  fufireResponseMapper,
} from '../../src/adapters/fufire/http-client.js';
import { createCalculateHoroscopeUseCase } from '../../src/application/horoscope-use-case.js';
import {
  assertProductionEligible,
  buildBazodiacInterpretationInput,
} from '../../src/application/interpretation/interpretation-input.js';
import { knownTimeChart } from '../support/narrativeFixture.js';
import { natalWireBody } from '../support/natalFixture.js';
import { wuxingWireBody } from '../support/wuxingFixture.js';

const CONFIG = {
  baseUrl: 'http://127.0.0.1:8110',
  apiKey: 'server-owned-test-key',
  timeoutMs: 1000,
  runtimeImage: 'fufire-lunar@sha256:c9162edd',
  openapiSha256: '6c1db672',
};
const RAW_INPUT = {
  displayName: 'Musterkundin A',
  birthDate: '1990-06-15',
  birthTime: '14:30',
  birthTimeKnown: true,
  timezone: 'Europe/Berlin',
  location: { lat: 52.52, lon: 13.405, label: 'Berlin' },
};

function useCaseWith(bodies: Record<string, unknown>): ReturnType<typeof createCalculateHoroscopeUseCase> {
  const client = createFufireClient({
    config: CONFIG,
    transport: {
      fetch: (url) => Promise.resolve(Response.json(bodies[new URL(url).pathname] ?? {}, { status: 200 })),
    },
  });
  return createCalculateHoroscopeUseCase({ gateway: client, runtime: CONFIG });
}

const BAZI_WIRE = knownTimeChart().source.bazi.raw?.payload;
const BODIES = { [FUFIRE_BAZI_PATH]: BAZI_WIRE, [FUFIRE_WUXING_PATH]: wuxingWireBody(), [FUFIRE_NATAL_PATH]: natalWireBody() };

describe('ETBZ-34: wire -> model -> interpretation input, through the production path', () => {
  it('builds a hand-off whose raw evidence is proven and whose facts are the only claim source', async () => {
    const outcome = await useCaseWith(BODIES).execute(RAW_INPUT);
    if (!outcome.ok) throw new Error(`expected success, got ${JSON.stringify(outcome.error)}`);
    const input = buildBazodiacInterpretationInput(outcome.model, outcome.source, { mapper: fufireResponseMapper });

    expect(input.validation).toEqual({
      sameChartBaziNatal: true,
      sameChartWuxing: true,
      basis: 'bazi_four_pillars',
      wuxingKeysetValid: true,
      dominantConsistent: true,
      rawEvidenceSameChart: true,
    });
    expect(input.fufire.baziRaw.redactions).toEqual(['input.lat', 'input.lon']);
    expect(input.fufire.wuxingRaw.redactions).toEqual(['input.lat', 'input.lon']);
    expect(JSON.stringify(input)).not.toContain('52.52');
    expect(JSON.stringify(input)).not.toContain('Musterkundin');
    expect(input.validatedChart.factIds.every((id) => id.startsWith('chart.'))).toBe(true);
    // Honest about what is still external.
    expect(input.productionEligibility).toEqual({ eligible: false, blockers: ['RUNTIME_ATTESTATION_NOT_PASSED'] });
    expect(() => { assertProductionEligible(input); }).toThrow();
  });

  it.each([
    ['a Wu-Xing answer for another chart', { pillars: { year: { stem: 'Geng', branch: 'Wu' }, month: { stem: 'Ren', branch: 'Wu' }, day: { stem: 'Jia', branch: 'Hai' }, hour: { stem: 'Yi', branch: 'Wei' } } }, 'HOROSCOPE_ERROR', 'HOROSCOPE_WUXING_SOURCE_PILLAR_CONTRADICTION'],
    ['a non-maximum dominant', { dominant_element: 'Holz' }, 'FUFIRE_ERROR', 'FUFIRE_CONTRACT_ERROR'],
    ['a sixth vector key', { wu_xing_vector: { Holz: 1.8, Feuer: 2.5, Erde: 2, Metall: 2, Wasser: 2, Aether: 0.1 } }, 'FUFIRE_ERROR', 'FUFIRE_CONTRACT_ERROR'],
    ['a missing vector key', { wu_xing_vector: { Holz: 1.8, Feuer: 2.5, Erde: 2, Metall: 2 } }, 'FUFIRE_ERROR', 'FUFIRE_CONTRACT_ERROR'],
    ['a planetary basis', { basis: 'western_planetary' }, 'FUFIRE_ERROR', 'FUFIRE_CONTRACT_ERROR'],
  ] as const)('yields NO model for %s', async (_name, override, code, errorCode) => {
    const outcome = await useCaseWith({ ...BODIES, [FUFIRE_WUXING_PATH]: { ...wuxingWireBody(), ...override } }).execute(RAW_INPUT);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe(code);
    expect((outcome.error as { errorCode: string }).errorCode).toBe(errorCode);
  });
});
