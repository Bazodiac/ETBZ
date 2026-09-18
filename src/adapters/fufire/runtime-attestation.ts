/**
 * ETBZ-34 AC 5–7 — the read-only probe behind the runtime attestation.
 *
 * Two GET requests, nothing else: no calculation, no mutation, no credential
 * echoed. The SHA-256 is taken over EXACTLY the bytes the runtime returned for
 * the OpenAPI document — never over a re-serialised object, which would hash
 * ETBZ's formatting instead of FuFirE's contract.
 *
 * Source identity is read from an EXISTING FuFirE surface: `GET /v1/build`
 * (`routers/info.py`). ETBZ invents no endpoint. Two fields are read, in order:
 *
 *   `source_revision`     the provider-neutral identity FuFirE reports for the
 *                         build that is answering, taken from the variable the
 *                         DEPLOYMENT PLATFORM injects (`NF_DEPLOYMENT_SHA` on
 *                         Northflank, `RAILWAY_GIT_COMMIT_SHA` on Railway);
 *   `railway_commit_sha`  the older Railway-only field, kept so a Railway
 *                         deployment that has not been rebuilt still attests.
 *
 * Provider-neutral first: whichever platform runs FuFirE, ETBZ reads one field
 * and never has to be told which cloud it is talking to. The companion fields
 * `source_revision_provider` / `_kind` / `_status` are FuFirE's own account of
 * where the value came from; ETBZ does not trust them as identity and never
 * reads them — only the revision itself is compared, against an expectation
 * ETBZ holds separately. FuFirE's `version` field is a mutable version string
 * and is never offered as identity. If a deployment exposes its commit under
 * yet another field, that stays a configuration change (`identityFields`), not
 * a code change.
 */
import { createHash } from 'node:crypto';
import type {
  AttestationObservation,
  OpenapiObservation,
  SourceIdentityObservation,
} from '../../application/attestation/runtime-attestation.js';

export const DEFAULT_OPENAPI_PATH = '/openapi.json';
export const DEFAULT_BUILD_PATH = '/v1/build';
export const DEFAULT_IDENTITY_FIELDS: readonly string[] = ['source_revision', 'railway_commit_sha'];
/** Fields that are version strings by contract; refused even if configured. */
export const MUTABLE_IDENTITY_FIELDS: readonly string[] = ['version', 'engine_version', 'build_version'];

export interface AttestationTransport {
  fetch(url: string, init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal }): Promise<Response>;
}

export interface ObserveRuntimeOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly apiKey?: string | undefined;
  readonly openapiPath?: string | undefined;
  readonly buildPath?: string | undefined;
  readonly identityFields?: readonly string[] | undefined;
  readonly transport?: AttestationTransport | undefined;
}

async function get(
  options: ObserveRuntimeOptions,
  path: string,
): Promise<Readonly<{ ok: true; response: Response }> | Readonly<{ ok: false; reason: string }>> {
  const transport: AttestationTransport = options.transport ?? { fetch: (url, init) => fetch(url, init) };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.apiKey !== undefined && options.apiKey.length > 0) {
      headers['X-API-Key'] = options.apiKey;
    }
    const response = await transport.fetch(`${options.baseUrl}${path}`, { method: 'GET', headers, signal: controller.signal });
    return { ok: true, response };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return { ok: false, reason: aborted ? `timed out after ${String(options.timeoutMs)}ms` : 'network failure' };
  } finally {
    clearTimeout(timer);
  }
}

async function observeOpenapi(options: ObserveRuntimeOptions): Promise<OpenapiObservation> {
  const path = options.openapiPath ?? DEFAULT_OPENAPI_PATH;
  const result = await get(options, path);
  if (!result.ok) {
    return { status: 'NOT_OBSERVED', httpStatus: null, reason: `GET ${path}: ${result.reason}` };
  }
  if (result.response.status !== 200) {
    // Observation only. A 404 may mean a wrong path, a gateway rule or a disabled
    // docs route; the probe does not guess which.
    return { status: 'NOT_OBSERVED', httpStatus: result.response.status, reason: `GET ${path} did not return 200` };
  }
  const bytes = new Uint8Array(await result.response.arrayBuffer());
  if (bytes.byteLength === 0) {
    return { status: 'NOT_OBSERVED', httpStatus: 200, reason: `GET ${path} returned an empty body` };
  }
  return {
    status: 'OBSERVED',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.byteLength,
    httpStatus: 200,
  };
}

async function observeSourceIdentity(options: ObserveRuntimeOptions): Promise<SourceIdentityObservation> {
  const path = options.buildPath ?? DEFAULT_BUILD_PATH;
  const fields = (options.identityFields ?? DEFAULT_IDENTITY_FIELDS).filter(
    (field) => !MUTABLE_IDENTITY_FIELDS.includes(field),
  );
  if (fields.length === 0) {
    return { status: 'NOT_OBSERVED', httpStatus: null, reason: 'no immutable identity field is configured; version fields are refused' };
  }
  const result = await get(options, path);
  if (!result.ok) {
    return { status: 'NOT_OBSERVED', httpStatus: null, reason: `GET ${path}: ${result.reason}` };
  }
  if (result.response.status !== 200) {
    return { status: 'NOT_OBSERVED', httpStatus: result.response.status, reason: `GET ${path} did not return 200` };
  }
  let body: unknown;
  try {
    body = await result.response.json();
  } catch {
    return { status: 'NOT_OBSERVED', httpStatus: 200, reason: `GET ${path} returned a body that is not JSON` };
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { status: 'NOT_OBSERVED', httpStatus: 200, reason: `GET ${path} returned no JSON object` };
  }
  for (const field of fields) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return { status: 'OBSERVED', field, value: value.trim(), httpStatus: 200 };
    }
  }
  return {
    status: 'NOT_OBSERVED',
    httpStatus: 200,
    reason: `GET ${path} carries none of [${fields.join(', ')}] with a value; the runtime does not expose its source revision`,
  };
}

export async function observeFufireRuntime(options: ObserveRuntimeOptions): Promise<AttestationObservation> {
  const openapi = await observeOpenapi(options);
  const sourceIdentity = await observeSourceIdentity(options);
  return { openapi, sourceIdentity };
}
