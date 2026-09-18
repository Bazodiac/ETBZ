/**
 * ETBZ-34 AC 5–7 — acceptance-grade attestation of the FuFirE runtime.
 *
 * Pure decision logic: an EXPECTATION (what the Product Owner accepted), an
 * OBSERVATION (what a read-only probe actually saw) and a verdict. No I/O here;
 * the probe lives in `src/adapters/fufire/runtime-attestation.ts`.
 *
 * Three verdicts, and the asymmetry between them is the point:
 *
 *   PASS                only when BOTH the OpenAPI bytes and an immutable source
 *                       identity were observed AND both equal an explicit
 *                       expectation;
 *   BLOCKED             an expectation is missing or malformed, or an observed
 *                       value contradicts it;
 *   CAPABILITY_MISSING  the runtime did not let us observe what acceptance needs.
 *
 * There is no path from "could not look" to PASS, and a mutable version string
 * is never an identity: `1.0.0-rc1` names many builds.
 */

export type AttestationStatus = 'PASS' | 'BLOCKED' | 'CAPABILITY_MISSING';

export type AttestationFindingCode =
  | 'EXPECTED_OPENAPI_SHA256_MISSING'
  | 'EXPECTED_OPENAPI_SHA256_MALFORMED'
  | 'OPENAPI_NOT_OBSERVED'
  | 'OPENAPI_SHA256_MISMATCH'
  | 'EXPECTED_SOURCE_REVISION_MISSING'
  | 'EXPECTED_SOURCE_REVISION_NOT_IMMUTABLE'
  | 'SOURCE_IDENTITY_NOT_OBSERVED'
  | 'SOURCE_IDENTITY_NOT_IMMUTABLE'
  | 'SOURCE_REVISION_MISMATCH';

export interface AttestationFinding {
  readonly code: AttestationFindingCode;
  readonly severity: 'BLOCKED' | 'CAPABILITY_MISSING';
  readonly detail: string;
}

export interface AttestationExpectation {
  /** Lower-case hex SHA-256 of the accepted `/openapi.json` BYTES. */
  readonly openapiSha256?: string | undefined;
  /** The accepted immutable source/build revision (git SHA or image digest). */
  readonly sourceRevision?: string | undefined;
}

export type OpenapiObservation =
  | Readonly<{ status: 'OBSERVED'; sha256: string; byteLength: number; httpStatus: number }>
  | Readonly<{ status: 'NOT_OBSERVED'; httpStatus: number | null; reason: string }>;

export type SourceIdentityObservation =
  | Readonly<{ status: 'OBSERVED'; field: string; value: string; httpStatus: number }>
  | Readonly<{ status: 'NOT_OBSERVED'; httpStatus: number | null; reason: string }>;

export interface AttestationObservation {
  readonly openapi: OpenapiObservation;
  readonly sourceIdentity: SourceIdentityObservation;
}

export interface AttestationVerdict {
  readonly status: AttestationStatus;
  readonly findings: readonly AttestationFinding[];
  readonly expectation: Readonly<{ openapiSha256: string | null; sourceRevision: string | null }>;
  readonly observation: AttestationObservation;
}

const SHA256_HEX = /^[0-9a-f]{64}$/u;

/**
 * What counts as IMMUTABLE: a full git object id (SHA-1 or SHA-256) or an OCI
 * image digest. Abbreviated SHAs, tags, semantic versions, dates and "latest"
 * are all reassignable and therefore refused.
 */
export function isImmutableRevision(value: string): boolean {
  return /^[0-9a-f]{40}$/u.test(value) || SHA256_HEX.test(value) || /^sha256:[0-9a-f]{64}$/u.test(value);
}

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function evaluateRuntimeAttestation(
  expectation: AttestationExpectation,
  observation: AttestationObservation,
): AttestationVerdict {
  const findings: AttestationFinding[] = [];
  const blocked = (code: AttestationFindingCode, detail: string): void => {
    findings.push({ code, severity: 'BLOCKED', detail });
  };
  const missing = (code: AttestationFindingCode, detail: string): void => {
    findings.push({ code, severity: 'CAPABILITY_MISSING', detail });
  };

  // --- AC 5: OpenAPI bytes -----------------------------------------------------
  const expectedSha = present(expectation.openapiSha256) ? expectation.openapiSha256.trim() : null;
  if (expectedSha === null) {
    blocked('EXPECTED_OPENAPI_SHA256_MISSING', 'no expected OpenAPI SHA-256 was supplied; without an expectation there is nothing to attest against');
  } else if (!SHA256_HEX.test(expectedSha)) {
    blocked('EXPECTED_OPENAPI_SHA256_MALFORMED', 'the expected OpenAPI SHA-256 is not 64 lower-case hex characters');
  }
  if (observation.openapi.status !== 'OBSERVED') {
    missing('OPENAPI_NOT_OBSERVED', `the OpenAPI document was not read (HTTP ${String(observation.openapi.httpStatus)}): ${observation.openapi.reason}`);
  } else if (expectedSha !== null && SHA256_HEX.test(expectedSha) && observation.openapi.sha256 !== expectedSha) {
    blocked('OPENAPI_SHA256_MISMATCH', `observed ${observation.openapi.sha256} over ${String(observation.openapi.byteLength)} bytes, expected ${expectedSha}`);
  }

  // --- AC 6: immutable source identity ------------------------------------------
  const expectedRevision = present(expectation.sourceRevision) ? expectation.sourceRevision.trim() : null;
  if (expectedRevision === null) {
    blocked('EXPECTED_SOURCE_REVISION_MISSING', 'no expected immutable source revision was supplied');
  } else if (!isImmutableRevision(expectedRevision)) {
    blocked('EXPECTED_SOURCE_REVISION_NOT_IMMUTABLE', 'the expected source revision is not a full git object id or image digest; a version string or tag is reassignable');
  }
  if (observation.sourceIdentity.status !== 'OBSERVED') {
    missing('SOURCE_IDENTITY_NOT_OBSERVED', `the runtime exposed no source identity (HTTP ${String(observation.sourceIdentity.httpStatus)}): ${observation.sourceIdentity.reason}`);
  } else if (!isImmutableRevision(observation.sourceIdentity.value)) {
    missing('SOURCE_IDENTITY_NOT_IMMUTABLE', `runtime field "${observation.sourceIdentity.field}" is not an immutable revision; a mutable version string is not accepted as identity`);
  } else if (
    expectedRevision !== null &&
    isImmutableRevision(expectedRevision) &&
    observation.sourceIdentity.value !== expectedRevision
  ) {
    blocked('SOURCE_REVISION_MISMATCH', `runtime reports ${observation.sourceIdentity.value}, expected ${expectedRevision}`);
  }

  // --- AC 7: no false PASS --------------------------------------------------------
  const status: AttestationStatus = findings.some((finding) => finding.severity === 'BLOCKED')
    ? 'BLOCKED'
    : findings.length > 0
      ? 'CAPABILITY_MISSING'
      : 'PASS';

  return {
    status,
    findings,
    expectation: { openapiSha256: expectedSha, sourceRevision: expectedRevision },
    observation,
  };
}

/** Process exit code for a verdict. Only PASS is zero. */
export function attestationExitCode(status: AttestationStatus): 0 | 2 | 3 {
  return status === 'PASS' ? 0 : status === 'BLOCKED' ? 2 : 3;
}
