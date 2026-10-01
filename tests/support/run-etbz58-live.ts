/**
 * ETBZ-58 — the operator command of the live stage (`npm run etbz58:live`, under `vite-node`). Not a test file:
 * no test reaches FuFirE; the suites replay what this command recorded.
 *
 * Environment (read here and nowhere else):
 *   ETBZ_FUFIRE_BASE_URL                  runtime origin
 *   ETBZ_FUFIRE_API_KEY                   sent as X-API-Key by the client; never printed or written
 *   ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256   the OpenAPI digest the attestation must observe
 *   ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION  the immutable source revision the attestation must observe
 *   ETBZ58_EXECUTED_AT                    YYYY-MM-DD of the run
 *   ETBZ58_REPOSITORY_HEAD                the 40-hex ETBZ commit the run executes
 *
 * Writes the three response bodies byte for byte, the runtime readback and the Skill input package derived from
 * the recorded bytes, and prints only digests.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EXCHANGE_LABELS, ETBZ58_READBACK, ETBZ58_SKILL_INPUT, deriveRehearsalInput, renderJson, responseFileOf, runLiveStage } from './etbz58Rehearsal.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') throw new Error(`${name} is required`);
  return value.trim();
};
const write = (path: string, data: string | Uint8Array): void => {
  const out = resolve(process.cwd(), path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
};

const executedAt = required('ETBZ58_EXECUTED_AT');
const repositoryHead = required('ETBZ58_REPOSITORY_HEAD');
if (!/^\d{4}-\d{2}-\d{2}$/u.test(executedAt) || !/^[0-9a-f]{40}$/u.test(repositoryHead)) throw new Error('ETBZ58_EXECUTED_AT or ETBZ58_REPOSITORY_HEAD is malformed');

const { readback, responses } = await runLiveStage({
  baseUrl: required('ETBZ_FUFIRE_BASE_URL'),
  apiKey: required('ETBZ_FUFIRE_API_KEY'),
  expectedOpenapiSha256: required('ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256'),
  expectedSourceRevision: required('ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION'),
  executedAt,
  repositoryHead,
});
for (const label of EXCHANGE_LABELS) write(responseFileOf(label), responses[label]);
write(ETBZ58_READBACK, renderJson(readback));
const rehearsal = await deriveRehearsalInput(readback, responses);
write(ETBZ58_SKILL_INPUT, renderJson(rehearsal.inputPackage));

process.stdout.write(
  [
    `attestation ${readback.attestation.status} · openapi ${readback.runtime.openapiSha256} · runtime ${readback.runtime.runtimeImage}`,
    `health ${String(readback.probes.health.status)} · ready ${String(readback.probes.ready.status)} · without credentials ${String(readback.probes.unauthorised.status)}`,
    ...readback.exchanges.map((exchange) => `${exchange.label} HTTP ${String(exchange.status)} ${String(exchange.byteLength)} B ${exchange.responseSha256}`),
    `interpretation input ${rehearsal.input.structuralHash} · eligible ${String(rehearsal.input.productionEligibility.eligible)}`,
    `claim graph ${rehearsal.graph.structuralHash} · plan ${rehearsal.plan.structuralHash}`,
    `skill input package ${rehearsal.inputPackage.structuralHash} · bundle ${rehearsal.bundle.bundleRef} ${rehearsal.bundle.structuralHash}`,
    '',
  ].join('\n'),
);
