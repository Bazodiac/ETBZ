/**
 * ETBZ-59 — the operator command that computes the synthetic variants live (`npm run etbz59:variants`, under
 * `vite-node`). Not a test file: no test reaches FuFirE; the suites replay what this command recorded.
 *
 * Environment (read here and nowhere else):
 *   ETBZ_FUFIRE_BASE_URL                  runtime origin
 *   ETBZ_FUFIRE_API_KEY                   sent as X-API-Key by the client; never printed or written
 *   ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256   the OpenAPI digest the attestation must observe
 *   ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION  the immutable source revision the attestation must observe
 *   ETBZ59_EXECUTED_AT                    YYYY-MM-DD of the run
 *   ETBZ59_REPOSITORY_HEAD                the 40-hex ETBZ commit the run executes
 *
 * For each variant: the ETBZ-58 live stage (attestation first, readiness, the three calls, the call without
 * credentials), then the response bodies and the readback into `docs/evidence/etbz-59/variants/<label>/`, then an
 * offline replay of what was written. Prints digests and the variant's pillars (synthetic charts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { EXCHANGE_LABELS, renderJson, runLiveStage } from './etbz58Rehearsal.js';
import { VARIANT_BIRTH_INPUTS, VARIANT_DEFINITIONS, VARIANT_LABELS, variantChart, variantReadback, variantReadbackFile, variantResponseFile } from './etbz59Variants.js';

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

const executedAt = required('ETBZ59_EXECUTED_AT');
const repositoryHead = required('ETBZ59_REPOSITORY_HEAD');
if (!/^\d{4}-\d{2}-\d{2}$/u.test(executedAt) || !/^[0-9a-f]{40}$/u.test(repositoryHead)) throw new Error('ETBZ59_EXECUTED_AT or ETBZ59_REPOSITORY_HEAD is malformed');

const lines: string[] = [];
for (const label of VARIANT_LABELS) {
  const { readback, responses } = await runLiveStage({
    baseUrl: required('ETBZ_FUFIRE_BASE_URL'),
    apiKey: required('ETBZ_FUFIRE_API_KEY'),
    expectedOpenapiSha256: required('ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256'),
    expectedSourceRevision: required('ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION'),
    executedAt,
    repositoryHead,
    case: { birthInput: VARIANT_BIRTH_INPUTS[label], ref: VARIANT_DEFINITIONS[label].ref },
  });
  for (const exchange of EXCHANGE_LABELS) write(variantResponseFile(label, exchange), responses[exchange]);
  write(variantReadbackFile(label), renderJson(variantReadback(label, readback)));
  const { model, input } = await variantChart(label);
  const pillars = (['year', 'month', 'day', 'hour'] as const).map((name) => `${model.pillars[name].stem}-${model.pillars[name].branch}`).join(' ');
  lines.push(
    `${label}: attestation ${readback.attestation.status} · health ${String(readback.probes.health.status)} · ready ${String(readback.probes.ready.status)} · without credentials ${String(readback.probes.unauthorised.status)}`,
    ...readback.exchanges.map((exchange) => `  ${exchange.label} HTTP ${String(exchange.status)} ${exchange.responseSha256}`),
    `  pillars ${pillars} · day master ${model.dayMaster.stem} · dominant ${model.wuxing.dominant} · input ${input.structuralHash} eligible ${String(input.productionEligibility.eligible)}`,
  );
}
process.stdout.write(`${lines.join('\n')}\n`);
