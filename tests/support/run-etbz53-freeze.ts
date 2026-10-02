/**
 * ETBZ-53 — the operator command of the Golden freeze (`npm run etbz53:freeze -- freeze|verify`, under `vite-node`).
 * Not a test file. Prints identities, digests and counts only - never a value of the case.
 *
 *   freeze   the live stage against FuFirE, archived, then the record (needs the ETBZ-58 live environment:
 *            ETBZ_FUFIRE_BASE_URL, ETBZ_FUFIRE_API_KEY, ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256,
 *            ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION, ETBZ53_EXECUTED_AT, ETBZ53_REPOSITORY_HEAD)
 *   verify   offline: re-derives the record from the archive and requires the committed record byte for byte
 *
 * Both read ETBZ53_INPUT (the Product Owner's input file), ETBZ53_ARCHIVE (the local archive directory) and
 * ETBZ53_ORACLE_DIR (the oracle's uv project).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderJson } from './etbz58Rehearsal.js';
import { ETBZ53_RECORD, buildFreezeRecord, freezeGoldenCase, loadArchivedRun } from './etbz53GoldenFreeze.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') throw new Error(`${name} is required`);
  return value.trim();
};
const paths = { inputPath: required('ETBZ53_INPUT'), archiveDir: required('ETBZ53_ARCHIVE'), oracleDir: required('ETBZ53_ORACLE_DIR') };
const mode = process.argv[2];
const summary = (record: Record<string, unknown>): string => {
  const r = record as { interpretationInput: { structuralHash: string; productionEligible: boolean }; oracle: { compared: number; equal: number }; runtime: { attestation: { status: string }; probes: Record<string, number>; exchanges: { label: string; status: number; responseSha256: string }[] } };
  return [
    `attestation ${r.runtime.attestation.status} · probes ${JSON.stringify(r.runtime.probes)}`,
    ...r.runtime.exchanges.map((exchange) => `${exchange.label} HTTP ${String(exchange.status)} ${exchange.responseSha256}`),
    `interpretation input ${r.interpretationInput.structuralHash} · eligible ${String(r.interpretationInput.productionEligible)}`,
    `oracle ${String(r.oracle.equal)}/${String(r.oracle.compared)} facts equal`,
    '',
  ].join('\n');
};

if (mode === 'freeze') {
  const executedAt = required('ETBZ53_EXECUTED_AT');
  const repositoryHead = required('ETBZ53_REPOSITORY_HEAD');
  const { record } = await freezeGoldenCase({
    ...paths,
    baseUrl: required('ETBZ_FUFIRE_BASE_URL'),
    apiKey: required('ETBZ_FUFIRE_API_KEY'),
    expectedOpenapiSha256: required('ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256'),
    expectedSourceRevision: required('ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION'),
    executedAt,
    repositoryHead,
  });
  writeFileSync(resolve(process.cwd(), ETBZ53_RECORD), renderJson(record));
  process.stdout.write(summary(record));
} else if (mode === 'verify') {
  const raw = JSON.parse(readFileSync(paths.inputPath, 'utf8')) as unknown;
  const { readback, responses } = loadArchivedRun(paths.archiveDir);
  const record = await buildFreezeRecord(paths, raw, readback, responses);
  const committed = readFileSync(resolve(process.cwd(), ETBZ53_RECORD), 'utf8');
  const equal = committed === renderJson(record);
  process.stdout.write(`${summary(record)}committed record re-derived byte for byte: ${String(equal)}\n`);
  if (!equal) process.exitCode = 1;
} else {
  throw new Error('usage: freeze | verify');
}
