/**
 * ETBZ-54 — the operator command that computes the near neighbour N of GOLDEN-KT-01 live (`npm run etbz54:variant`,
 * under `vite-node`; D-53-6). Not a test file: no test reaches FuFirE.
 *
 * N is the frozen input with the birth time moved to the neighbouring two-hour block (`nearBirthInput`) and the display
 * name marking the synthetic variant. The ETBZ-58 live stage runs it unchanged (attestation first; no calculation to
 * an unattested or unready runtime; the call without credentials must be refused). The readback and the three
 * response bodies go into the private archive (`<ETBZ54_ARCHIVE>/etbz54/variants/near/`, 700/600); then N is replayed
 * offline and its named difference to S must be the hour pillar.
 *
 * Environment (read here and nowhere else):
 *   ETBZ54_INPUT, ETBZ54_ARCHIVE           the frozen case (input file, archive)
 *   ETBZ_FUFIRE_BASE_URL                   runtime origin
 *   ETBZ_FUFIRE_API_KEY                    sent as X-API-Key by the client; never printed or written
 *   ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256    the OpenAPI digest the attestation must observe
 *   ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION   the immutable source revision the attestation must observe
 *   ETBZ54_EXECUTED_AT                     YYYY-MM-DD of the run
 *   ETBZ54_REPOSITORY_HEAD                 the 40-hex ETBZ commit the run executes
 *
 * Prints statuses and keyed digests only; never a value of the case, its variant or the shift direction.
 */
import { existsSync } from 'node:fs';
import { keyed, loadOrCreateKey } from './etbz53GoldenFreeze.js';
import { EXCHANGE_LABELS, renderJson, runLiveStage } from './etbz58Rehearsal.js';
import { namedDifference } from './etbz59Individuality.js';
import { assertHourDifference, assertTreePrivate, goldenChart, nearBirthInput, nearChart, nearReadbackFile, nearResponseFile, readInput, workPath, writePrivateFile } from './etbz54Golden.js';
import type { GoldenConfig } from './etbz54Golden.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') throw new Error(`${name} is required`);
  return value.trim();
};

async function main(): Promise<void> {
  const config: GoldenConfig = { inputPath: required('ETBZ54_INPUT'), archiveDir: required('ETBZ54_ARCHIVE') };
  const executedAt = required('ETBZ54_EXECUTED_AT');
  const repositoryHead = required('ETBZ54_REPOSITORY_HEAD');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(executedAt) || !/^[0-9a-f]{40}$/u.test(repositoryHead)) throw new Error('ETBZ54_EXECUTED_AT or ETBZ54_REPOSITORY_HEAD is malformed');
  if (existsSync(nearReadbackFile(config))) throw new Error('the near variant is recorded already; it is computed once');
  const key = loadOrCreateKey(config.archiveDir, false);
  const raw = readInput(config);
  const { birthInput } = nearBirthInput(raw);
  const { readback, responses } = await runLiveStage({
    baseUrl: required('ETBZ_FUFIRE_BASE_URL'),
    apiKey: required('ETBZ_FUFIRE_API_KEY'),
    expectedOpenapiSha256: required('ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256'),
    expectedSourceRevision: required('ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION'),
    executedAt,
    repositoryHead,
    case: { birthInput, ref: 'GOLDEN-KT-01 near neighbour N (synthetic; tests/support/etbz54Golden.ts#nearBirthInput, D-53-6)' },
  });
  for (const exchange of EXCHANGE_LABELS) writePrivateFile(nearResponseFile(config, exchange), responses[exchange]);
  writePrivateFile(nearReadbackFile(config), renderJson(readback));
  const near = await nearChart(config, raw);
  const source = await goldenChart(config, raw);
  assertHourDifference(namedDifference(source.model, near.model));
  assertTreePrivate(workPath(config));
  process.stdout.write([
    `near: attestation ${readback.attestation.status} · health ${String(readback.probes.health.status)} · ready ${String(readback.probes.ready.status)} · without credentials ${String(readback.probes.unauthorised.status)}`,
    ...readback.exchanges.map((exchange) => `  ${exchange.label} HTTP ${String(exchange.status)} ${keyed(key, responses[exchange.label])}`),
    `  input ${keyed(key, near.input.structuralHash)} eligible ${String(near.input.productionEligibility.eligible)} · named difference is the hour pillar: true`,
    '',
  ].join('\n'));
}

// Name and code only: a lower layer's message may quote a value of the case.
main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'Error';
  const code = (error as { code?: unknown }).code;
  process.stderr.write(`FAILED: ${name}${typeof code === 'string' ? ` ${code}` : ''} (message withheld)\n`);
  process.exitCode = 1;
});
