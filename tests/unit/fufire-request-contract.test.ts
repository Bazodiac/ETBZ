/**
 * ETBZ-34 AC 11 + AC 13 — on EVERY FuFirE calculation request:
 *   - `boundary: "midnight"` is sent explicitly (PD-9), never left to a default;
 *   - an unknown birth time stays date-only: ETBZ substitutes no time of day.
 * Pinned per endpoint, because a guarantee that holds for one of three calls is
 * not a guarantee.
 */
import { describe, expect, it } from 'vitest';
import {
  FUFIRE_BAZI_PATH,
  FUFIRE_DAY_BOUNDARY,
  FUFIRE_NATAL_PATH,
  FUFIRE_WUXING_PATH,
  createFufireClient,
} from '../../src/adapters/fufire/http-client.js';
import { KNOWN_BIRTH, UNKNOWN_BIRTH } from '../support/narrativeFixture.js';

const CONFIG = {
  baseUrl: 'http://127.0.0.1:8110',
  apiKey: 'server-owned-test-key',
  timeoutMs: 1000,
  runtimeImage: 'fufire-lunar@sha256:c9162edd',
  openapiSha256: '6c1db672',
};

async function requestsFor(input: typeof KNOWN_BIRTH): Promise<Map<string, Record<string, unknown>>> {
  const seen = new Map<string, Record<string, unknown>>();
  const client = createFufireClient({
    config: CONFIG,
    transport: {
      fetch: (url, init) => {
        seen.set(new URL(url).pathname, JSON.parse(String(init?.body)) as Record<string, unknown>);
        // The response is irrelevant here; a contract error after the request is fine.
        return Promise.resolve(new Response('{}', { status: 200 }));
      },
    },
  });
  await Promise.allSettled([client.calculateBazi(input), client.calculateBaziWuxing(input), client.calculateNatal(input)]);
  return seen;
}

const ENDPOINTS = [FUFIRE_BAZI_PATH, FUFIRE_WUXING_PATH, FUFIRE_NATAL_PATH];

describe('ETBZ-34 AC 11: boundary=midnight on every request', () => {
  it('pins the value', () => {
    expect(FUFIRE_DAY_BOUNDARY).toBe('midnight');
  });

  it.each(['known', 'unknown'] as const)('sends it to BaZi, BaZi/WuXing and Natal (%s birth time)', async (kind) => {
    const seen = await requestsFor(kind === 'known' ? KNOWN_BIRTH : UNKNOWN_BIRTH);
    expect([...seen.keys()].sort()).toEqual([...ENDPOINTS].sort());
    for (const endpoint of ENDPOINTS) {
      expect(seen.get(endpoint)?.['boundary'], endpoint).toBe('midnight');
    }
  });
});

describe('ETBZ-34 AC 13: an unknown birth time stays date-only on every request', () => {
  it('sends YYYY-MM-DD and birth_time_known=false, and no time of day anywhere in the payload', async () => {
    const seen = await requestsFor(UNKNOWN_BIRTH);
    for (const endpoint of ENDPOINTS) {
      const payload = seen.get(endpoint);
      expect(payload?.['birth_time_known'], endpoint).toBe(false);
      expect(String(payload?.['date']), endpoint).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(JSON.stringify(payload), endpoint).not.toMatch(/\d{2}:\d{2}/u);
    }
  });

  it('sends the real local time when it is known (counterfactual)', async () => {
    const seen = await requestsFor(KNOWN_BIRTH);
    for (const endpoint of ENDPOINTS) {
      expect(seen.get(endpoint)?.['birth_time_known'], endpoint).toBe(true);
      expect(String(seen.get(endpoint)?.['date']), endpoint).toMatch(/T14:30/u);
    }
  });
});
