/**
 * ETBZ-24 — the BaZi Wu-Xing boundary must refuse a non-BaZi Wu-Xing payload.
 *
 * WHY THIS FILE EXISTS. FuFirE serves two Wu-Xing operations:
 *
 *   POST /v1/calculate/bazi/wuxing  — the Four Pillars distribution
 *                                     (`routers/bazi.py`, built by
 *                                     `calculate_wuxing_from_bazi_with_ledger`
 *                                     from the pillars and nothing else).
 *   POST /v1/calculate/wuxing       — a vector derived from WESTERN PLANETARY
 *                                     positions (`routers/fusion.py`), whose
 *                                     only purpose is to be the western half of
 *                                     `POST /calculate/fusion`.
 *
 * Both answer HTTP 200 with `wu_xing_vector` under the same five German element
 * keys and a `dominant_element`. The BODIES BELOW ARE NOT INVENTED: they were
 * captured from a live engine run (`DYAI2025/FUFIRE_API_lunar@26dc8fd`, engine
 * 1.0.0-rc1-20260220, synthetic input 1990-06-15T14:30 Europe/Berlin, 52.52 /
 * 13.405) on 2026-09-16. Copying the real defect shape matters: a lookalike
 * body proves nothing about what the real wrong endpoint would do.
 *
 * The risk this guards is concrete and was reachable. A prior probe found the
 * BaZi route answering 404 against a stale local runtime, and the obvious
 * "quick fix" is to repoint `FUFIRE_WUXING_PATH` at the route that does answer.
 * Against the current upstream revision that swap SUCCEEDS structurally — the
 * western body satisfies every shape rule — and a western/fusion vector silently
 * becomes the customer's BaZi element reading. `basis` is the only field that
 * separates them, so `basis` is what the adapter pins.
 */

import { describe, expect, it } from 'vitest';
import { createFufireClient } from '../../src/adapters/fufire/http-client.js';
import type { FufireClientConfig } from '../../src/adapters/fufire/http-client.js';
import { WUXING_BASIS_BAZI_FOUR_PILLARS } from '../../src/application/ports/fufire-gateway.js';
import { validateBirthInput } from '../../src/domain/birth-input.js';

const CONFIG: FufireClientConfig = {
  baseUrl: 'http://127.0.0.1:8110',
  apiKey: 'server-owned-test-key',
  timeoutMs: 1500,
  runtimeImage: 'fufire-lunar@sha256:c9162edd',
  openapiSha256: '6c1db672',
};

const INPUT = validateBirthInput({
  displayName: 'Musterkundin A',
  birthDate: '1990-06-15',
  birthTime: '14:30',
  birthTimeKnown: true,
  timezone: 'Europe/Berlin',
  location: { lat: 52.52, lon: 13.405, label: 'Berlin' },
});
if (!INPUT.ok) throw new Error('fixture input must validate');

/**
 * The REAL body of `POST /v1/calculate/bazi/wuxing`, verbatim from the live run
 * described in the file header (extra keys trimmed, no value altered).
 */
function realBaziWuxingBody(): Record<string, unknown> {
  return {
    wu_xing_vector: { Holz: 1.8, Feuer: 2.5, Erde: 2.0, Metall: 2.0, Wasser: 2.0 },
    dominant_element: 'Feuer',
    basis: 'bazi_four_pillars',
    pillars: {
      year: { stem: 'Geng', branch: 'Wu' },
      month: { stem: 'Ren', branch: 'Wu' },
      day: { stem: 'Xin', branch: 'Hai' },
      hour: { stem: 'Yi', branch: 'Wei' },
    },
    contribution_ledger: {
      bazi: [
        { pillar: 'year', source: 'stem', stem_name: 'Geng', element: 'Metall', weight: 1.0, category: 'traditional' },
      ],
    },
  };
}

/**
 * The REAL body of `POST /v1/calculate/wuxing` — the WESTERN PLANETARY vector,
 * verbatim from the same live run. Note `contribution_ledger.western`, the
 * `equation_of_time` / `true_solar_time` pair, and an L2-normalized vector whose
 * components sum to ~2.06 rather than the BaZi Qi-weight total of 10.3.
 */
function realWesternWuxingBody(): Record<string, unknown> {
  return {
    wu_xing_vector: {
      Holz: 0.6101955043925309,
      Feuer: 0.43774894880333737,
      Erde: 0.30509775219626545,
      Metall: 0.13265119660707195,
      Wasser: 0.5704001454104093,
    },
    dominant_element: 'Holz',
    basis: 'western_planetary',
    equation_of_time: -0.027,
    true_solar_time: 14.4995,
    contribution_ledger: {
      western: [
        { planet: 'Sun', element: 'Feuer', weight: 1.0, is_retrograde: false, rationale: 'Classical rulership', category: 'traditional' },
        { planet: 'Moon', element: 'Wasser', weight: 1.0, is_retrograde: false, rationale: 'Classical rulership', category: 'traditional' },
      ],
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function clientAnswering(body: unknown) {
  return createFufireClient({
    config: CONFIG,
    transport: { fetch: async () => jsonResponse(200, body) },
  });
}

describe('ETBZ-24 wrong-endpoint canary: the western Wu-Xing payload cannot pass as BaZi', () => {
  it('is structurally indistinguishable — the western body satisfies every SHAPE rule the BaZi mapping applies', () => {
    // This is the premise of the whole guard, asserted rather than assumed: if
    // shape alone could separate them, pinning `basis` would be unnecessary.
    const western = realWesternWuxingBody();
    const vector = western['wu_xing_vector'] as Record<string, number>;
    for (const element of ['Holz', 'Feuer', 'Erde', 'Metall', 'Wasser']) {
      expect(typeof vector[element]).toBe('number');
      expect(Number.isFinite(vector[element])).toBe(true);
      expect(vector[element]).toBeGreaterThanOrEqual(0);
    }
    expect(typeof western['dominant_element']).toBe('string');
    expect(Object.keys(vector)).toContain(western['dominant_element']);
    expect(typeof western['basis']).toBe('string');
    expect((western['basis'] as string).length).toBeGreaterThan(0);
  });

  it('rejects the real western/fusion body with FUFIRE_CONTRACT_ERROR', async () => {
    const client = clientAnswering(realWesternWuxingBody());
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });

  it('names the offending basis in the failure, so a path swap is diagnosable', async () => {
    const client = clientAnswering(realWesternWuxingBody());
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toThrow(/western_planetary/);
  });

  it('still accepts the real BaZi body unchanged — the guard is not merely refusing everything', async () => {
    const client = clientAnswering(realBaziWuxingBody());
    const snapshot = await client.calculateBaziWuxing(INPUT.value);
    expect(snapshot.basis).toBe(WUXING_BASIS_BAZI_FOUR_PILLARS);
    expect(snapshot.dominant).toBe('Feuer');
    expect(snapshot.vector).toEqual({ Holz: 1.8, Feuer: 2.5, Erde: 2.0, Metall: 2.0, Wasser: 2.0 });
  });
});

describe('ETBZ-24 basis fail-closed: no basis is ever defaulted', () => {
  it('rejects a payload with NO basis key (no default is manufactured)', async () => {
    const body = realBaziWuxingBody();
    delete body['basis'];
    const client = clientAnswering(body);
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });

  it('rejects an empty-string basis', async () => {
    const client = clientAnswering({ ...realBaziWuxingBody(), basis: '' });
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });

  it('rejects a non-string basis', async () => {
    const client = clientAnswering({ ...realBaziWuxingBody(), basis: 42 });
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });

  it.each([
    'western_planetary',
    'fusion',
    'bazi_four_pillars ',
    'BAZI_FOUR_PILLARS',
    'bazi',
  ])('rejects the near-miss basis %j', async (basis) => {
    const client = clientAnswering({ ...realBaziWuxingBody(), basis });
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });
});

describe('ETBZ-24 dominant element: membership, not prototype reachability', () => {
  it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'rejects the Object.prototype key %j as a dominant element',
    async (dominant) => {
      // The previous check was `dominant in vector`, and `in` walks the
      // prototype chain of the `{}`-literal vector — every name here passed it
      // and was carried through as the customer's dominant element.
      const client = clientAnswering({ ...realBaziWuxingBody(), dominant_element: dominant });
      await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
        code: 'FUFIRE_CONTRACT_ERROR',
      });
    },
  );

  it('rejects a drifted element vocabulary (English labels)', async () => {
    const client = clientAnswering({ ...realBaziWuxingBody(), dominant_element: 'fire' });
    await expect(client.calculateBaziWuxing(INPUT.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });
});
