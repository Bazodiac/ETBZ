/**
 * ETBZ-34 AC 5–7 — `npm run attest:fufire` (after `npm run build`).
 *
 * Read-only acceptance probe of a FuFirE runtime. Exit code 0 ONLY for PASS;
 * 2 = BLOCKED, 3 = CAPABILITY_MISSING, 64 = unusable configuration.
 *
 * Environment:
 *   ETBZ_FUFIRE_BASE_URL                 runtime origin, e.g. https://fufire.example (required)
 *   ETBZ_FUFIRE_API_KEY                  sent as X-API-Key when set; never printed
 *   ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256  accepted SHA-256 of the /openapi.json bytes
 *   ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION accepted immutable source revision
 *   ETBZ_FUFIRE_ATTEST_OPENAPI_PATH      default /openapi.json
 *   ETBZ_FUFIRE_ATTEST_BUILD_PATH        default /v1/build
 *   ETBZ_FUFIRE_ATTEST_IDENTITY_FIELDS   comma list, default railway_commit_sha
 *   ETBZ_FUFIRE_ATTEST_TIMEOUT_MS        default 10000
 *
 * A missing expectation is BLOCKED, not "skipped": the verdict is printed and
 * the process exits non-zero.
 */
import { observeFufireRuntime } from './adapters/fufire/runtime-attestation.js';
import {
  attestationExitCode,
  evaluateRuntimeAttestation,
} from './application/attestation/runtime-attestation.js';
import type { AttestationVerdict } from './application/attestation/runtime-attestation.js';

export type AttestEnvironment = Readonly<Record<string, string | undefined>>;

export async function runFufireAttestation(
  environment: AttestEnvironment,
  transport?: Parameters<typeof observeFufireRuntime>[0]['transport'],
): Promise<Readonly<{ exitCode: number; verdict: AttestationVerdict | null; error: string | null }>> {
  const baseUrl = (environment['ETBZ_FUFIRE_BASE_URL'] ?? '').trim().replace(/\/+$/u, '');
  if (!/^https?:\/\/[^\s/]+/u.test(baseUrl)) {
    return { exitCode: 64, verdict: null, error: 'ETBZ_FUFIRE_BASE_URL is missing or not an http(s) origin' };
  }
  const timeoutRaw = environment['ETBZ_FUFIRE_ATTEST_TIMEOUT_MS'];
  const timeoutMs = timeoutRaw === undefined ? 10_000 : Number(timeoutRaw);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    return { exitCode: 64, verdict: null, error: 'ETBZ_FUFIRE_ATTEST_TIMEOUT_MS is not a positive integer' };
  }
  const identityFields = environment['ETBZ_FUFIRE_ATTEST_IDENTITY_FIELDS']
    ?.split(',')
    .map((field) => field.trim())
    .filter((field) => field.length > 0);

  const observation = await observeFufireRuntime({
    baseUrl,
    timeoutMs,
    apiKey: environment['ETBZ_FUFIRE_API_KEY'],
    openapiPath: environment['ETBZ_FUFIRE_ATTEST_OPENAPI_PATH'],
    buildPath: environment['ETBZ_FUFIRE_ATTEST_BUILD_PATH'],
    identityFields,
    transport,
  });
  const verdict = evaluateRuntimeAttestation(
    {
      openapiSha256: environment['ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256'],
      sourceRevision: environment['ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION'],
    },
    observation,
  );
  return { exitCode: attestationExitCode(verdict.status), verdict, error: null };
}

const invokedDirectly = process.argv[1] !== undefined && /attest-fufire\.js$/u.test(process.argv[1]);
if (invokedDirectly) {
  runFufireAttestation(process.env).then(
    (result) => {
      process.stdout.write(`${JSON.stringify(result.verdict ?? { status: 'CONFIGURATION_ERROR', error: result.error }, null, 2)}\n`);
      process.exitCode = result.exitCode;
    },
    () => {
      process.stdout.write(`${JSON.stringify({ status: 'CAPABILITY_MISSING', error: 'attestation probe failed unexpectedly' })}\n`);
      process.exitCode = 3;
    },
  );
}
