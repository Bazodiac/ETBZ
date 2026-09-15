/**
 * ETBZ-24 — the REAL FuFirE boundary, end to end, over the real network.
 *
 * WHAT THIS PROVES THAT NOTHING ELSE IN THE REPOSITORY DOES. Every other test
 * of this boundary answers from a mocked `Transport`: the paths, the payloads
 * and the `basis` string are all hand-written next to the assertions that read
 * them. That suite stayed green for the entire period in which the pinned
 * Wu-Xing operation returned 404 against the runtime a product probe actually
 * ran — a contract with no live counterpart cannot be falsified by a fixture
 * that restates it. This file is the counterpart: real client, real global
 * `fetch`, real engine, real HoroscopeModel.
 *
 * IT IS DELIBERATELY OUTSIDE THE CI GATE. `vitest.config.ts` enumerates the
 * five suite directories that constitute the verification contract and
 * `tests/live` is not among them, so a commit is never judged by a third
 * party's availability. It runs under `vitest.live.config.ts` via
 * `npm run test:live:fufire`. It is still typechecked and linted with
 * everything else, so it cannot rot quietly.
 *
 * IT FAILS, IT NEVER SKIPS. A missing base URL, a missing credential, an
 * unreachable engine or a runtime whose surface lacks the pinned operation are
 * all REPORTED AS FAILURES with a message naming the cause. A live contract
 * that silently passes when nothing was contacted is worse than no live
 * contract at all — that is the exact failure mode this slice exists to close.
 *
 * CONFIGURATION (both required, no defaults, values never logged):
 *   ETBZ_FUFIRE_BASE_URL   e.g. http://127.0.0.1:8111   (no trailing slash)
 *   ETBZ_FUFIRE_API_KEY    the engine's X-API-Key
 * Optional:
 *   ETBZ_FUFIRE_TIMEOUT_MS  default 20000
 *   ETBZ_FUFIRE_RUNTIME_IMAGE / ETBZ_FUFIRE_OPENAPI_SHA256 — recorded into the
 *   model's provenance. They describe WHICH runtime answered and are evidence
 *   labels only; when unset they are stamped as explicitly unverified rather
 *   than being filled with a plausible-looking value.
 *
 * NO CUSTOMER DATA. The birth input below is the repository's synthetic
 * fixture identity (`Musterkundin A`), identical to the one the offline suites
 * use. Nothing here is a real person.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FUFIRE_BAZI_PATH,
  FUFIRE_NATAL_PATH,
  FUFIRE_WUXING_PATH,
  createFufireClient,
} from '../../src/adapters/fufire/http-client.js';
import type { FufireClientConfig } from '../../src/adapters/fufire/http-client.js';
import {
  WUXING_BASIS_BAZI_FOUR_PILLARS,
  WUXING_ELEMENTS,
} from '../../src/application/ports/fufire-gateway.js';
import { createCalculateHoroscopeUseCase } from '../../src/application/horoscope-use-case.js';
import type { HoroscopeUseCaseResult } from '../../src/application/horoscope-use-case.js';
import { validateBirthInput } from '../../src/domain/birth-input.js';

/** The synthetic identity used by every offline suite. Not a real person. */
const SYNTHETIC_BIRTH_INPUT = Object.freeze({
  displayName: 'Musterkundin A',
  birthDate: '1990-06-15',
  birthTime: '14:30',
  birthTimeKnown: true,
  timezone: 'Europe/Berlin',
  location: { lat: 52.52, lon: 13.405, label: 'Berlin' },
});

function requiredVariable(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `${name} is not set. This is the LIVE FuFirE contract test: it needs a real ` +
        `engine and a real credential. Start the pinned engine and run ` +
        `\`ETBZ_FUFIRE_BASE_URL=... ETBZ_FUFIRE_API_KEY=... npm run test:live:fufire\`. ` +
        `It fails rather than skips on purpose — an absent runtime must never be ` +
        `reportable as a passing live contract.`,
    );
  }
  return value.trim();
}

const BASE_URL = (): string => requiredVariable('ETBZ_FUFIRE_BASE_URL').replace(/\/+$/, '');

/**
 * Observation, not mocking: the ORIGINAL global fetch is captured and every
 * request is delegated to it untouched. The recorder exists so the assertions
 * can prove WHAT crossed the network, which is the only way to show that no
 * fixture stood in for the engine.
 */
interface ObservedCall {
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
}

const observed: ObservedCall[] = [];
const realFetch = globalThis.fetch.bind(globalThis);

/** The URL a fetch argument addresses, for string, URL and Request forms alike. */
function requestedUrl(target: Parameters<typeof globalThis.fetch>[0]): string {
  if (typeof target === 'string') return target;
  if (typeof target === 'object' && target !== null && 'url' in target) {
    const { url } = target as { url: unknown };
    if (typeof url === 'string') return url;
  }
  return String(target);
}

beforeAll(async () => {
  // Configuration first: a clear failure here beats an obscure one later.
  const baseUrl = BASE_URL();
  const apiKey = requiredVariable('ETBZ_FUFIRE_API_KEY');

  // The runtime must actually SERVE the pinned operation. A stale revision that
  // answers 404 here is the root cause this slice was opened for, so it is
  // named explicitly instead of surfacing as a generic contract error.
  let probe: Response;
  try {
    probe = await realFetch(`${baseUrl}${FUFIRE_WUXING_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        date: `${SYNTHETIC_BIRTH_INPUT.birthDate}T${SYNTHETIC_BIRTH_INPUT.birthTime}`,
        tz: SYNTHETIC_BIRTH_INPUT.timezone,
        lat: SYNTHETIC_BIRTH_INPUT.location.lat,
        lon: SYNTHETIC_BIRTH_INPUT.location.lon,
        standard: 'CIVIL',
        birth_time_known: true,
      }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown transport failure';
    throw new Error(
      `the FuFirE engine at ${baseUrl} is unreachable (${reason}). The live contract ` +
        `cannot be evaluated; it is reported as FAILED, never as passed.`,
      { cause: error },
    );
  }
  if (probe.status === 404) {
    throw new Error(
      `the runtime at ${baseUrl} does not serve ${FUFIRE_WUXING_PATH} (HTTP 404). ` +
        `ETBZ's pinned path is correct against DYAI2025/FUFIRE_API_lunar, where ` +
        `routers/bazi.py declares this operation — so a 404 means the runtime is an ` +
        `OLDER revision than the source of truth, not that the path is wrong. Note ` +
        `that the engine's self-reported version string does NOT distinguish the two ` +
        `revisions: both announce 1.0.0-rc1-20260220. Deploy the current revision ` +
        `instead of repointing ETBZ at ${'/v1/calculate/wuxing'}, which is the ` +
        `WESTERN PLANETARY vector and carries a different basis.`,
    );
  }
  expect(probe.status, `preflight POST ${FUFIRE_WUXING_PATH} must answer 200`).toBe(200);

  globalThis.fetch = async (...args: Parameters<typeof globalThis.fetch>): Promise<Response> => {
    const response = await realFetch(...args);
    const clone = response.clone();
    let body: unknown;
    try {
      body = await clone.json();
    } catch {
      body = undefined;
    }
    observed.push({ url: requestedUrl(args[0]), status: response.status, body });
    return response;
  };
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

function liveConfig(): FufireClientConfig {
  return {
    baseUrl: BASE_URL(),
    apiKey: requiredVariable('ETBZ_FUFIRE_API_KEY'),
    timeoutMs: Number(process.env['ETBZ_FUFIRE_TIMEOUT_MS'] ?? 20_000),
    // Provenance labels. Unset means unverified — never a plausible placeholder.
    runtimeImage: process.env['ETBZ_FUFIRE_RUNTIME_IMAGE'] ?? 'UNVERIFIED_LOCAL_RUNTIME',
    openapiSha256: process.env['ETBZ_FUFIRE_OPENAPI_SHA256'] ?? 'UNVERIFIED_LOCAL_RUNTIME',
  };
}

/** The REAL client: no `transport` override, so it uses the global `fetch`. */
function liveClient(): ReturnType<typeof createFufireClient> {
  return createFufireClient({ config: liveConfig() });
}

describe('ETBZ-24 live boundary: BirthInput -> FuFirE (3 operations) -> HoroscopeModel', () => {
  it('(1) the synthetic BirthInput validates before any network call', () => {
    const validation = validateBirthInput(SYNTHETIC_BIRTH_INPUT);
    expect(validation.ok).toBe(true);
  });

  it('(2) calculateBazi succeeds against the real engine and passes adapter validation', async () => {
    const validation = validateBirthInput(SYNTHETIC_BIRTH_INPUT);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    const snapshot = await liveClient().calculateBazi(validation.value);
    expect(snapshot.dayMaster).toBe(snapshot.pillars.day.stem);
    expect(snapshot.provenance.engineVersion.length).toBeGreaterThan(0);
    expect(snapshot.precision.birthTimeKnown).toBe(true);
  });

  it('(3) calculateBaziWuxing succeeds against the real engine and passes adapter validation', async () => {
    const validation = validateBirthInput(SYNTHETIC_BIRTH_INPUT);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    const snapshot = await liveClient().calculateBaziWuxing(validation.value);
    // (10) the basis is explicitly the approved BaZi four-pillars basis.
    expect(snapshot.basis).toBe(WUXING_BASIS_BAZI_FOUR_PILLARS);
    // (7) exactly the five approved elements, no more and no fewer.
    expect(Object.keys(snapshot.vector).sort()).toEqual([...WUXING_ELEMENTS].sort());
    // (8) every value finite and non-negative.
    for (const element of WUXING_ELEMENTS) {
      expect(Number.isFinite(snapshot.vector[element])).toBe(true);
      expect(snapshot.vector[element]).toBeGreaterThanOrEqual(0);
    }
    // (9) dominant is one of the five.
    expect(WUXING_ELEMENTS).toContain(snapshot.dominant);
  });

  it('(4) calculateNatal succeeds against the real engine and passes adapter validation', async () => {
    const validation = validateBirthInput(SYNTHETIC_BIRTH_INPUT);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    const snapshot = await liveClient().calculateNatal(validation.value);
    expect(snapshot.dayMaster.stem).toBe(snapshot.pillars.day.stem);
    expect(snapshot.monthCommand.branch).toBe(snapshot.pillars.month.branch);
  });

  it('(5,6,11,12) the full chain returns a HoroscopeModel built from the live wire values', async () => {
    const useCase = createCalculateHoroscopeUseCase({
      gateway: liveClient(),
      runtime: {
        runtimeImage: liveConfig().runtimeImage,
        openapiSha256: liveConfig().openapiSha256,
      },
    });
    const before = observed.length;
    const result: HoroscopeUseCaseResult = await useCase.execute(SYNTHETIC_BIRTH_INPUT);

    // (5) + (6): every response passed the unmodified adapter validation, and a
    // model actually exists. A failure is printed with its code so the reason is
    // in the record rather than hidden behind a boolean.
    if (!result.ok) {
      throw new Error(
        `the live chain produced no HoroscopeModel: ${result.error.code} — ` +
          `${'message' in result.error ? result.error.message : JSON.stringify(result.error.issues)}`,
      );
    }
    const model = result.model;
    expect(model.displayName).toBe('Musterkundin A');

    // (12) NO fixture participated: exactly three real HTTP round-trips were
    // observed, to the three pinned absolute URLs, each answering 200.
    const calls = observed.slice(before);
    const base = BASE_URL();
    expect(calls.map((call) => call.url)).toEqual([
      `${base}${FUFIRE_BAZI_PATH}`,
      `${base}${FUFIRE_WUXING_PATH}`,
      `${base}${FUFIRE_NATAL_PATH}`,
    ]);
    expect(calls.map((call) => call.status)).toEqual([200, 200, 200]);

    // (11) the model carries the wire vector UNCHANGED — compared against the
    // bytes that actually crossed the network, not against a restated literal.
    const wireWuxing = calls[1]?.body as { wu_xing_vector?: unknown; dominant_element?: unknown; basis?: unknown };
    expect(model.wuxing.vector).toEqual(wireWuxing.wu_xing_vector);
    expect(model.wuxing.dominant).toBe(wireWuxing.dominant_element);
    expect(model.wuxing.basis).toBe(wireWuxing.basis);
    expect(model.wuxing.basis).toBe(WUXING_BASIS_BAZI_FOUR_PILLARS);

    // (12, continued) the provenance timestamp is FRESH. A checked-in fixture
    // cannot produce a timestamp from the current run, so this separates a real
    // engine answer from a recorded one.
    const computedAt = Date.parse(model.provenance.computationTimestamp);
    expect(Number.isNaN(computedAt)).toBe(false);
    expect(Math.abs(Date.now() - computedAt)).toBeLessThan(10 * 60 * 1000);
  });

  it('(negative) the WESTERN Wu-Xing operation of the SAME engine cannot satisfy the BaZi contract', async () => {
    // The wrong-endpoint canary against the live engine: /v1/calculate/wuxing
    // answers 200 with the same five German element keys, so only `basis`
    // separates it. Proven here on the real runtime, not on a fixture.
    const base = BASE_URL();
    const response = await realFetch(`${base}/v1/calculate/wuxing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': requiredVariable('ETBZ_FUFIRE_API_KEY') },
      body: JSON.stringify({
        date: `${SYNTHETIC_BIRTH_INPUT.birthDate}T${SYNTHETIC_BIRTH_INPUT.birthTime}`,
        tz: SYNTHETIC_BIRTH_INPUT.timezone,
        lat: SYNTHETIC_BIRTH_INPUT.location.lat,
        lon: SYNTHETIC_BIRTH_INPUT.location.lon,
        standard: 'CIVIL',
        birth_time_known: true,
      }),
    });
    expect(response.status).toBe(200);
    const western = (await response.json()) as Record<string, unknown>;

    // Structurally indistinguishable...
    const vector = western['wu_xing_vector'] as Record<string, number>;
    for (const element of WUXING_ELEMENTS) {
      expect(Number.isFinite(vector[element])).toBe(true);
    }
    expect(WUXING_ELEMENTS).toContain(western['dominant_element']);

    // ...and yet refused, because its basis is not the BaZi one.
    expect(western['basis']).not.toBe(WUXING_BASIS_BAZI_FOUR_PILLARS);
    const client = createFufireClient({
      config: liveConfig(),
      transport: {
        // Real bytes from the real wrong endpoint, replayed into the real
        // mapping. Nothing about the payload is authored here.
        fetch: async () =>
          new Response(JSON.stringify(western), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      },
    });
    const validation = validateBirthInput(SYNTHETIC_BIRTH_INPUT);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    await expect(client.calculateBaziWuxing(validation.value)).rejects.toMatchObject({
      code: 'FUFIRE_CONTRACT_ERROR',
    });
  });
});
