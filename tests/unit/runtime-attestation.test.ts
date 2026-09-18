/**
 * ETBZ-34 AC 5–8 — runtime attestation. PASS needs the OpenAPI BYTES and an
 * IMMUTABLE source identity, both observed and both equal to an explicit
 * expectation. Everything else is BLOCKED or CAPABILITY_MISSING — never PASS.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { observeFufireRuntime } from '../../src/adapters/fufire/runtime-attestation.js';
import type { AttestationTransport } from '../../src/adapters/fufire/runtime-attestation.js';
import {
  attestationExitCode,
  evaluateRuntimeAttestation,
  isImmutableRevision,
} from '../../src/application/attestation/runtime-attestation.js';
import type {
  AttestationFindingCode,
  AttestationObservation,
} from '../../src/application/attestation/runtime-attestation.js';
import { fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import {
  InterpretationInputError,
  assertProductionEligible,
  buildBazodiacInterpretationInput,
} from '../../src/application/interpretation/interpretation-input.js';
import { runFufireAttestation } from '../../src/attest-fufire.js';
import { RUNTIME, knownTimeChart, unknownTimeChart } from '../support/narrativeFixture.js';

// Deliberately NOT pretty-printed JSON: the hash is over bytes, not over a parse.
const OPENAPI_BYTES = Buffer.from('{"openapi":"3.1.0",  "info":{"title":"FuFirE","version":"1.0.0-rc1"}}\n', 'utf8');
const OPENAPI_SHA = createHash('sha256').update(OPENAPI_BYTES).digest('hex');
const REVISION = 'c914d5671257b3c3ec279da76715a9338313b2e1';
const OTHER_REVISION = 'ecfb18b855df2a2868a51e91923a1dd2c4645ba0';

const OBSERVED: AttestationObservation = {
  openapi: { status: 'OBSERVED', sha256: OPENAPI_SHA, byteLength: OPENAPI_BYTES.byteLength, httpStatus: 200 },
  sourceIdentity: { status: 'OBSERVED', field: 'railway_commit_sha', value: REVISION, httpStatus: 200 },
};
const EXPECTED = { openapiSha256: OPENAPI_SHA, sourceRevision: REVISION };

function codes(verdict: ReturnType<typeof evaluateRuntimeAttestation>): AttestationFindingCode[] {
  return verdict.findings.map((finding) => finding.code);
}

function transportOf(routes: Record<string, () => Response>): AttestationTransport {
  return {
    fetch: (url) => {
      const path = new URL(url).pathname;
      const route = routes[path];
      return Promise.resolve(route === undefined ? new Response('not found', { status: 404 }) : route());
    },
  };
}

const HEALTHY = {
  '/openapi.json': (): Response => new Response(OPENAPI_BYTES, { status: 200 }),
  '/v1/build': (): Response => Response.json({ version: '1.0.0-rc1-20260220', railway_commit_sha: REVISION }),
};
const ENV = {
  ETBZ_FUFIRE_BASE_URL: 'https://fufire.test/',
  ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256: OPENAPI_SHA,
  ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION: REVISION,
};

describe('ETBZ-34 AC 5–7: the verdict', () => {
  it('PASSES only when both observations equal both expectations', () => {
    const verdict = evaluateRuntimeAttestation(EXPECTED, OBSERVED);
    expect(verdict.status).toBe('PASS');
    expect(verdict.findings).toEqual([]);
    expect(attestationExitCode(verdict.status)).toBe(0);
  });

  it.each([
    ['wrong OpenAPI SHA', { ...EXPECTED, openapiSha256: 'a'.repeat(64) }, OBSERVED, 'BLOCKED', 'OPENAPI_SHA256_MISMATCH'],
    ['missing expected OpenAPI SHA', { sourceRevision: REVISION }, OBSERVED, 'BLOCKED', 'EXPECTED_OPENAPI_SHA256_MISSING'],
    ['blank expected OpenAPI SHA', { ...EXPECTED, openapiSha256: '  ' }, OBSERVED, 'BLOCKED', 'EXPECTED_OPENAPI_SHA256_MISSING'],
    ['malformed expected OpenAPI SHA', { ...EXPECTED, openapiSha256: '6c1db672' }, OBSERVED, 'BLOCKED', 'EXPECTED_OPENAPI_SHA256_MALFORMED'],
    ['wrong source revision', { ...EXPECTED, sourceRevision: OTHER_REVISION }, OBSERVED, 'BLOCKED', 'SOURCE_REVISION_MISMATCH'],
    ['missing expected source revision', { openapiSha256: OPENAPI_SHA }, OBSERVED, 'BLOCKED', 'EXPECTED_SOURCE_REVISION_MISSING'],
    ['expected revision is a version string', { ...EXPECTED, sourceRevision: '1.0.0-rc1-20260220' }, OBSERVED, 'BLOCKED', 'EXPECTED_SOURCE_REVISION_NOT_IMMUTABLE'],
    ['expected revision is an abbreviated SHA', { ...EXPECTED, sourceRevision: 'c914d567' }, OBSERVED, 'BLOCKED', 'EXPECTED_SOURCE_REVISION_NOT_IMMUTABLE'],
    ['runtime exposes no source identity', EXPECTED, { ...OBSERVED, sourceIdentity: { status: 'NOT_OBSERVED', httpStatus: 200, reason: 'absent' } }, 'CAPABILITY_MISSING', 'SOURCE_IDENTITY_NOT_OBSERVED'],
    ['runtime identity is a mutable version string', EXPECTED, { ...OBSERVED, sourceIdentity: { status: 'OBSERVED', field: 'source_revision', value: '1.0.0-rc1-20260220', httpStatus: 200 } }, 'BLOCKED', 'SOURCE_IDENTITY_NOT_IMMUTABLE'],
    ['runtime identity is an abbreviated SHA', EXPECTED, { ...OBSERVED, sourceIdentity: { status: 'OBSERVED', field: 'source_revision', value: 'c914d567', httpStatus: 200 } }, 'BLOCKED', 'SOURCE_IDENTITY_NOT_IMMUTABLE'],
    ['runtime identity is a branch name', EXPECTED, { ...OBSERVED, sourceIdentity: { status: 'OBSERVED', field: 'source_revision', value: 'main', httpStatus: 200 } }, 'BLOCKED', 'SOURCE_IDENTITY_NOT_IMMUTABLE'],
    ['runtime identity is FuFirE\'s own provider name', EXPECTED, { ...OBSERVED, sourceIdentity: { status: 'OBSERVED', field: 'source_revision_provider', value: 'northflank', httpStatus: 200 } }, 'BLOCKED', 'SOURCE_IDENTITY_NOT_IMMUTABLE'],
    ['OpenAPI not readable', EXPECTED, { ...OBSERVED, openapi: { status: 'NOT_OBSERVED', httpStatus: 404, reason: 'no 200' } }, 'CAPABILITY_MISSING', 'OPENAPI_NOT_OBSERVED'],
  ] as const)('never passes: %s', (_name, expectation, observation, status, code) => {
    const verdict = evaluateRuntimeAttestation(expectation, observation);
    expect(verdict.status).toBe(status);
    expect(codes(verdict)).toContain(code);
    expect(attestationExitCode(verdict.status)).not.toBe(0);
  });

  it('a version string can never satisfy BOTH sides: equal mutable values still do not pass', () => {
    const version = '1.0.0-rc1-20260220';
    const verdict = evaluateRuntimeAttestation(
      { ...EXPECTED, sourceRevision: version },
      { ...OBSERVED, sourceIdentity: { status: 'OBSERVED', field: 'version', value: version, httpStatus: 200 } },
    );
    expect(verdict.status).toBe('BLOCKED');
  });

  it('BLOCKED outranks CAPABILITY_MISSING, and nothing at all observed is not a pass', () => {
    const nothing: AttestationObservation = {
      openapi: { status: 'NOT_OBSERVED', httpStatus: null, reason: 'network failure' },
      sourceIdentity: { status: 'NOT_OBSERVED', httpStatus: null, reason: 'network failure' },
    };
    expect(evaluateRuntimeAttestation(EXPECTED, nothing).status).toBe('CAPABILITY_MISSING');
    expect(evaluateRuntimeAttestation({}, nothing).status).toBe('BLOCKED');
  });

  it('knows what immutable means', () => {
    for (const ok of [REVISION, 'a'.repeat(64), `sha256:${'b'.repeat(64)}`]) expect(isImmutableRevision(ok), ok).toBe(true);
    for (const bad of ['', 'latest', 'main', 'v1.0.0', '1.0.0-rc1-20260220', 'c914d567', REVISION.toUpperCase(), `${REVISION} `, '2026-09-18']) {
      expect(isImmutableRevision(bad), bad).toBe(false);
    }
  });
});

describe('ETBZ-34 AC 5–6: the read-only probe', () => {
  const base = { baseUrl: 'https://fufire.test', timeoutMs: 1000 };

  it('hashes exactly the bytes the runtime returned, not a re-serialisation', async () => {
    const observation = await observeFufireRuntime({ ...base, transport: transportOf(HEALTHY) });
    expect(observation.openapi).toEqual({ status: 'OBSERVED', sha256: OPENAPI_SHA, byteLength: OPENAPI_BYTES.byteLength, httpStatus: 200 });
    const reserialised = createHash('sha256').update(JSON.stringify(JSON.parse(OPENAPI_BYTES.toString('utf8')))).digest('hex');
    expect(reserialised).not.toBe(OPENAPI_SHA);
  });

  it('reads the identity from the existing /v1/build surface and only with GET', async () => {
    const seen: string[] = [];
    const transport: AttestationTransport = {
      fetch: (url, init) => {
        seen.push(`${init.method} ${new URL(url).pathname}`);
        return transportOf(HEALTHY).fetch(url, init);
      },
    };
    const observation = await observeFufireRuntime({ ...base, transport });
    expect(observation.sourceIdentity).toEqual({ status: 'OBSERVED', field: 'railway_commit_sha', value: REVISION, httpStatus: 200 });
    expect(seen).toEqual(['GET /openapi.json', 'GET /v1/build']);
  });

  it('reports today\'s FuFirE deployment honestly: /v1/build with only a version is NOT an identity', async () => {
    const transport = transportOf({ ...HEALTHY, '/v1/build': () => Response.json({ version: '1.0.0-rc1-20260220' }) });
    const observation = await observeFufireRuntime({ ...base, transport });
    expect(observation.sourceIdentity.status).toBe('NOT_OBSERVED');
    expect(evaluateRuntimeAttestation(EXPECTED, observation).status).toBe('CAPABILITY_MISSING');
  });

  it('refuses a version field even when someone configures it as the identity field', async () => {
    const observation = await observeFufireRuntime({ ...base, identityFields: ['version'], transport: transportOf(HEALTHY) });
    expect(observation.sourceIdentity.status).toBe('NOT_OBSERVED');
  });

  it('takes a differently named immutable field by CONFIGURATION, without a code change', async () => {
    const transport = transportOf({ ...HEALTHY, '/v1/build': () => Response.json({ version: 'x', source_revision: REVISION }) });
    const observation = await observeFufireRuntime({ ...base, identityFields: ['source_revision'], transport });
    expect(evaluateRuntimeAttestation(EXPECTED, observation).status).toBe('PASS');
  });

  it('separates observation from cause on a 404, an empty body, a timeout and a network failure', async () => {
    const notFound = await observeFufireRuntime({ ...base, transport: transportOf({}) });
    expect(notFound.openapi).toEqual({ status: 'NOT_OBSERVED', httpStatus: 404, reason: 'GET /openapi.json did not return 200' });
    const empty = await observeFufireRuntime({ ...base, transport: transportOf({ ...HEALTHY, '/openapi.json': () => new Response('', { status: 200 }) }) });
    expect(empty.openapi.status).toBe('NOT_OBSERVED');
    const failing: AttestationTransport = { fetch: () => Promise.reject(new Error('ECONNREFUSED 10.0.0.1')) };
    const down = await observeFufireRuntime({ ...base, transport: failing });
    expect(down.openapi).toEqual({ status: 'NOT_OBSERVED', httpStatus: null, reason: 'GET /openapi.json: network failure' });
    const hanging: AttestationTransport = {
      fetch: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => { reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
      }),
    };
    const slow = await observeFufireRuntime({ ...base, timeoutMs: 5, transport: hanging });
    expect(slow.openapi.status).toBe('NOT_OBSERVED');
    for (const observation of [notFound, empty, down, slow]) {
      expect(evaluateRuntimeAttestation(EXPECTED, observation).status).not.toBe('PASS');
    }
  });

  it('sends the API key as a header and never reports it', async () => {
    let header: string | undefined;
    const transport: AttestationTransport = {
      fetch: (url, init) => { header = init.headers['X-API-Key']; return transportOf(HEALTHY).fetch(url, init); },
    };
    const result = await runFufireAttestation({ ...ENV, ETBZ_FUFIRE_API_KEY: 'k-secret-value' }, transport);
    expect(header).toBe('k-secret-value');
    expect(JSON.stringify(result)).not.toContain('k-secret-value');
  });
});

describe('ETBZ-34 AC 6: the provider-neutral source identity FuFirE publishes', () => {
  const base = { baseUrl: 'https://fufire.test', timeoutMs: 1000 };

  /** The exact `/v1/build` shape FuFirE serves once it resolves a revision. */
  const build = (fields: Record<string, unknown>): Record<string, unknown> => ({
    version: '1.0.0-rc1-20260220',
    source_revision: null,
    source_revision_provider: null,
    source_revision_kind: null,
    source_revision_status: 'unavailable',
    ...fields,
  });
  const northflank = (revision: string): Record<string, unknown> =>
    build({
      source_revision: revision,
      source_revision_provider: 'northflank',
      source_revision_kind: 'deployment_git_sha',
      source_revision_status: 'available',
    });
  const observe = async (body: Record<string, unknown>): Promise<AttestationObservation> =>
    observeFufireRuntime({ ...base, transport: transportOf({ ...HEALTHY, '/v1/build': () => Response.json(body) }) });

  it('MATCH: a Northflank deployment on the expected revision attests, with no configuration', async () => {
    const observation = await observe(northflank(REVISION));
    expect(observation.sourceIdentity).toEqual({ status: 'OBSERVED', field: 'source_revision', value: REVISION, httpStatus: 200 });
    expect(evaluateRuntimeAttestation(EXPECTED, observation).status).toBe('PASS');
  });

  it('MISMATCH: a Northflank deployment on another revision is BLOCKED', async () => {
    const observation = await observe(northflank(OTHER_REVISION));
    const verdict = evaluateRuntimeAttestation(EXPECTED, observation);
    expect(verdict.status).toBe('BLOCKED');
    expect(codes(verdict)).toContain('SOURCE_REVISION_MISMATCH');
  });

  it('MISSING: FuFirE reporting a null revision is CAPABILITY_MISSING, never a pass', async () => {
    const observation = await observe(build({}));
    expect(observation.sourceIdentity.status).toBe('NOT_OBSERVED');
    const verdict = evaluateRuntimeAttestation(EXPECTED, observation);
    expect(verdict.status).toBe('CAPABILITY_MISSING');
    expect(codes(verdict)).toContain('SOURCE_IDENTITY_NOT_OBSERVED');
  });

  it.each(['main', 'c914d567', `${REVISION}a`, REVISION.slice(0, 39), REVISION.toUpperCase(), '1.0.0-rc1-20260220'])(
    'MALFORMED: a runtime answering %s is BLOCKED, not excused as a missing capability',
    async (malformed) => {
      const observation = await observe(northflank(malformed));
      const verdict = evaluateRuntimeAttestation(EXPECTED, observation);
      expect(verdict.status).toBe('BLOCKED');
      expect(codes(verdict)).toContain('SOURCE_IDENTITY_NOT_IMMUTABLE');
      expect(attestationExitCode(verdict.status)).toBe(2);
    },
  );

  it('VERSION-ONLY: a build document with a version and no revision never passes', async () => {
    for (const body of [{ version: '1.0.0-rc1-20260220' }, build({ source_revision_status: 'unavailable' })]) {
      const observation = await observe(body);
      const verdict = evaluateRuntimeAttestation(EXPECTED, observation);
      expect(verdict.status).not.toBe('PASS');
      // ...and the version string is never smuggled in as the observed revision.
      expect(JSON.stringify(observation.sourceIdentity)).not.toContain('1.0.0-rc1-20260220');
    }
  });

  it('FuFirE\'s own account of the revision is not evidence: provider/kind/status cannot carry it', async () => {
    const lying = build({
      source_revision_provider: REVISION,
      source_revision_kind: REVISION,
      source_revision_status: REVISION,
    });
    const observation = await observe(lying);
    expect(observation.sourceIdentity.status).toBe('NOT_OBSERVED');
    expect(evaluateRuntimeAttestation(EXPECTED, observation).status).toBe('CAPABILITY_MISSING');
  });

  it('CONJUNCTION: the right revision on the wrong OpenAPI document is still BLOCKED', async () => {
    const transport = transportOf({
      '/openapi.json': () => new Response(Buffer.from('{"openapi":"3.1.0"}\n', 'utf8'), { status: 200 }),
      '/v1/build': () => Response.json(northflank(REVISION)),
    });
    const observation = await observeFufireRuntime({ ...base, transport });
    expect(observation.sourceIdentity).toEqual({ status: 'OBSERVED', field: 'source_revision', value: REVISION, httpStatus: 200 });
    const verdict = evaluateRuntimeAttestation(EXPECTED, observation);
    expect(verdict.status).toBe('BLOCKED');
    expect(codes(verdict)).toContain('OPENAPI_SHA256_MISMATCH');
  });

  it('REGRESSION: a Railway deployment that predates source_revision still attests', async () => {
    const observation = await observe({ version: '1.0.0-rc1-20260220', railway_commit_sha: REVISION });
    expect(observation.sourceIdentity).toEqual({ status: 'OBSERVED', field: 'railway_commit_sha', value: REVISION, httpStatus: 200 });
    expect(evaluateRuntimeAttestation(EXPECTED, observation).status).toBe('PASS');
  });

  it('prefers the provider-neutral field when a runtime carries both', async () => {
    const observation = await observe({ ...northflank(REVISION), railway_commit_sha: OTHER_REVISION });
    expect(observation.sourceIdentity).toEqual({ status: 'OBSERVED', field: 'source_revision', value: REVISION, httpStatus: 200 });
  });
});

describe('ETBZ-34 AC 7: the command exits 0 only for PASS', () => {
  it('exits 0 for a fully attested runtime', async () => {
    const result = await runFufireAttestation(ENV, transportOf(HEALTHY));
    expect(result.exitCode).toBe(0);
    expect(result.verdict?.status).toBe('PASS');
  });

  it.each([
    ['no expected OpenAPI SHA', { ...ENV, ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256: undefined }, HEALTHY, 2],
    ['no expected source revision', { ...ENV, ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION: undefined }, HEALTHY, 2],
    ['wrong expected OpenAPI SHA', { ...ENV, ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256: 'f'.repeat(64) }, HEALTHY, 2],
    ['wrong expected source revision', { ...ENV, ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION: OTHER_REVISION }, HEALTHY, 2],
    ['runtime without immutable identity', ENV, { ...HEALTHY, '/v1/build': () => Response.json({ version: '1.0.0' }) }, 3],
    ['runtime answers with a malformed source revision', ENV, { ...HEALTHY, '/v1/build': () => Response.json({ version: '1.0.0', source_revision: 'main' }) }, 2],
    ['runtime unreachable', ENV, {}, 3],
    ['no base URL', { ...ENV, ETBZ_FUFIRE_BASE_URL: undefined }, HEALTHY, 64],
    ['base URL is not an origin', { ...ENV, ETBZ_FUFIRE_BASE_URL: 'fufire' }, HEALTHY, 64],
  ] as const)('exits non-zero: %s', async (_name, environment, routes, exitCode) => {
    const result = await runFufireAttestation(environment, transportOf(routes));
    expect(result.exitCode).toBe(exitCode);
    expect(result.verdict?.status).not.toBe('PASS');
  });
});

describe('ETBZ-34 AC 14: only an attestation PASS for THIS runtime lifts the production blocker', () => {
  const MAPPER = { mapper: fufireResponseMapper };
  const pass = (sha: string): ReturnType<typeof evaluateRuntimeAttestation> =>
    evaluateRuntimeAttestation(
      { openapiSha256: sha, sourceRevision: REVISION },
      { ...OBSERVED, openapi: { status: 'OBSERVED', sha256: sha, byteLength: 10, httpStatus: 200 } },
    );

  // The fixture runtime pins an abbreviated hash; an attested chart pins the full one.
  const FULL_SHA = OPENAPI_SHA;
  const chart = knownTimeChart();
  const attestedModel = { ...chart.model, provenance: { ...chart.model.provenance, openapiSha256: FULL_SHA } };

  it('is eligible for a known-time chart with a PASS for its own OpenAPI document', () => {
    const input = buildBazodiacInterpretationInput(attestedModel, chart.source, { ...MAPPER, attestation: pass(FULL_SHA) });
    expect(input.runtimeAttestation.status).toBe('PASS');
    expect(input.productionEligibility).toEqual({ eligible: true, blockers: [] });
    expect(() => { assertProductionEligible(input); }).not.toThrow();
  });

  it('refuses a PASS that was observed for another OpenAPI document', () => {
    expect(RUNTIME.openapiSha256).not.toBe(FULL_SHA);
    expect(() => buildBazodiacInterpretationInput(chart.model, chart.source, { ...MAPPER, attestation: pass(FULL_SHA) }))
      .toThrow(expect.objectContaining({ code: 'INTERPRETATION_INPUT_ATTESTATION_FOREIGN' }) as InterpretationInputError);
  });

  it.each(['BLOCKED', 'CAPABILITY_MISSING'] as const)('stays blocked for a %s verdict', (status) => {
    const verdict = status === 'BLOCKED'
      ? evaluateRuntimeAttestation({ ...EXPECTED, sourceRevision: OTHER_REVISION }, OBSERVED)
      : evaluateRuntimeAttestation(EXPECTED, { ...OBSERVED, sourceIdentity: { status: 'NOT_OBSERVED', httpStatus: 200, reason: 'absent' } });
    expect(verdict.status).toBe(status);
    const input = buildBazodiacInterpretationInput(attestedModel, chart.source, { ...MAPPER, attestation: verdict });
    expect(input.runtimeAttestation).toEqual({ status: 'NOT_PASSED', observedStatus: status });
    expect(input.productionEligibility.blockers).toEqual(['RUNTIME_ATTESTATION_NOT_PASSED']);
    expect(() => { assertProductionEligible(input); }).toThrow(InterpretationInputError);
  });

  it('a forged verdict object with status PASS but no observation is refused', () => {
    const forged = { ...pass(FULL_SHA), observation: { ...OBSERVED, openapi: { status: 'NOT_OBSERVED' as const, httpStatus: null, reason: 'x' } } };
    expect(() => buildBazodiacInterpretationInput(attestedModel, chart.source, { ...MAPPER, attestation: forged }))
      .toThrow(expect.objectContaining({ code: 'INTERPRETATION_INPUT_ATTESTATION_FOREIGN' }) as InterpretationInputError);
  });

  it('a typed-in PASS whose own observation lacks the immutable identity is refused', () => {
    // OpenAPI matches this chart — only the source identity is missing. `status`
    // says PASS; the evidence inside the same object does not.
    const forged = { ...pass(FULL_SHA), observation: { ...pass(FULL_SHA).observation, sourceIdentity: { status: 'NOT_OBSERVED' as const, httpStatus: 200, reason: 'absent' } } };
    expect(forged.status).toBe('PASS');
    expect(() => buildBazodiacInterpretationInput(attestedModel, chart.source, { ...MAPPER, attestation: forged }))
      .toThrow(expect.objectContaining({ code: 'INTERPRETATION_INPUT_ATTESTATION_FOREIGN' }) as InterpretationInputError);
    const wrongRevision = { ...pass(FULL_SHA), expectation: { openapiSha256: FULL_SHA, sourceRevision: OTHER_REVISION } };
    expect(() => buildBazodiacInterpretationInput(attestedModel, chart.source, { ...MAPPER, attestation: wrongRevision }))
      .toThrow(expect.objectContaining({ code: 'INTERPRETATION_INPUT_ATTESTATION_FOREIGN' }) as InterpretationInputError);
  });

  it('never makes an unknown-time input eligible, PASS or not (FUF-163/164/165 not delivered)', () => {
    const unknown = unknownTimeChart();
    const model = { ...unknown.model, provenance: { ...unknown.model.provenance, openapiSha256: FULL_SHA } };
    const input = buildBazodiacInterpretationInput(model, unknown.source, { ...MAPPER, attestation: pass(FULL_SHA) });
    expect(input.productionEligibility).toEqual({ eligible: false, blockers: ['UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED'] });
  });
});
