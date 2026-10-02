/**
 * ETBZ-53 — freeze the Golden case GOLDEN-KT-01 at the FuFirE / InterpretationInput boundary (Rebaseline 62128133
 * section 19; Product Owner decisions D-53-1..3, Jira ETBZ-53 comments 17026 and 17029).
 *
 * Everything that carries the case's personal data stays in the local archive outside every repository
 * (`/Users/Shared/ETBZ-golden/GOLDEN-KT-01/`, files mode 600): the three response bodies, the runtime readback, the
 * InterpretationInput and the facts the oracle compared. The input file itself is the Product Owner's and is only
 * read. The repository receives `docs/evidence/etbz-53/freeze-record.json` and nothing else: identities, digests
 * that cannot be brute-forced (each covers runtime timestamps), and the validation and oracle outcomes as counts.
 * No birth data, no chart value, no digest of the input or of the facts - those spaces are small enough to search.
 *
 * Stages: the input is validated locally first (invalid -> no FuFirE call); the live stage of ETBZ-58 runs with this
 * case (attestation first; no calculation to an unattested or unready runtime; credentials enforced); the recorded
 * bytes are replayed into a production-eligible InterpretationInput; the independent oracle (lunar-python, pinned,
 * outside the product's dependencies) must agree with every fact; the record is checked for every value of the
 * input file before it is written.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { validateBirthInput } from '../../src/domain/birth-input.js';
import { EXCHANGE_LABELS, renderJson, replayInterpretationInput, runLiveStage, sha256Of } from './etbz58Rehearsal.js';
import type { ExchangeLabel, LiveStageConfig, RuntimeReadback } from './etbz58Rehearsal.js';

export const GOLDEN_CASE_REF = 'GOLDEN-KT-01';
export const ETBZ53_RECORD = 'docs/evidence/etbz-53/freeze-record.json';
/** The fields a BirthInput may carry; anything else would be a hint the generator must not receive (AC 5). */
export const BIRTH_INPUT_FIELDS = ['birthDate', 'birthTime', 'birthTimeKnown', 'displayName', 'location', 'timezone'] as const;

export type FreezeErrorCode = 'FREEZE_INPUT_INVALID' | 'FREEZE_INPUT_NOT_KNOWN_TIME' | 'FREEZE_INPUT_EXTRA_FIELDS' | 'FREEZE_ORACLE_MISMATCH' | 'FREEZE_RECORD_LEAKS_CASE_DATA';

export class FreezeError extends Error {
  readonly code: FreezeErrorCode;
  constructor(code: FreezeErrorCode, message: string) {
    super(message);
    this.name = 'FreezeError';
    this.code = code;
  }
}

export interface OracleSummary {
  readonly tool: string;
  readonly compared: number;
  readonly equal: number;
  readonly byCategory: Readonly<Record<string, Readonly<{ compared: number; equal: number }>>>;
  /** Fact ids only, never values. */
  readonly differing: readonly string[];
}

/** Refuses an input that is not a valid known-time BirthInput or carries fields beyond the six (codes only). */
export function assertGoldenInput(raw: unknown): void {
  const keys = raw !== null && typeof raw === 'object' ? Object.keys(raw).sort() : [];
  const extra = keys.filter((key) => !(BIRTH_INPUT_FIELDS as readonly string[]).includes(key));
  if (extra.length > 0) throw new FreezeError('FREEZE_INPUT_EXTRA_FIELDS', `fields beyond the BirthInput: ${extra.join(', ')}`);
  const result = validateBirthInput(raw);
  if (!result.ok) {
    throw new FreezeError('FREEZE_INPUT_INVALID', `issues: ${JSON.stringify(result.issues.map((issue) => (issue as { code?: unknown }).code))}`);
  }
  if (!result.value.birthTimeKnown) throw new FreezeError('FREEZE_INPUT_NOT_KNOWN_TIME', 'ETBZ-53 freezes a known-time case');
}

/** Every scalar of the input file, as text, that is long enough to identify (the strings and the numbers). */
export function caseValues(raw: unknown): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string' && value.length >= 3) out.push(value);
    else if (typeof value === 'number') out.push(String(value));
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(raw);
  const date = (raw as { birthDate?: unknown }).birthDate;
  if (typeof date === 'string') out.push(date.replaceAll('-', ''), date.slice(0, 4) + date.slice(5, 7));
  return [...new Set(out)];
}

/** Refuses a record text that contains any value of the input file. */
export function assertRecordCarriesNoCaseValue(recordText: string, raw: unknown): void {
  const leaked = caseValues(raw).filter((value) => recordText.includes(value));
  if (leaked.length > 0) throw new FreezeError('FREEZE_RECORD_LEAKS_CASE_DATA', `the record would carry ${String(leaked.length)} value(s) of the case input`);
}

export function runOracle(oracleDir: string, inputPath: string, factsPath: string): OracleSummary {
  const run = spawnSync('uv', ['run', '-q', 'python', 'oracle_compare.py', inputPath, factsPath], { cwd: oracleDir, encoding: 'utf8' });
  const report = JSON.parse(run.stdout) as {
    oracle: string;
    'local-civil-time': { compared: number; equal: number; byCategory: Record<string, { compared: number; equal: number; differs: string[]; absent: string[] }> };
  };
  const primary = report['local-civil-time'];
  return {
    tool: report.oracle,
    compared: primary.compared,
    equal: primary.equal,
    byCategory: Object.fromEntries(Object.entries(primary.byCategory).map(([key, value]) => [key, { compared: value.compared, equal: value.equal }])),
    differing: Object.values(primary.byCategory).flatMap((value) => [...value.differs, ...value.absent]),
  };
}

const writePrivate = (path: string, data: string | Uint8Array): void => {
  writeFileSync(path, data);
  chmodSync(path, 0o600);
};

export interface FreezeConfig extends Omit<LiveStageConfig, 'case'> {
  readonly inputPath: string;
  readonly archiveDir: string;
  readonly oracleDir: string;
}

export interface FreezeResult {
  readonly record: Record<string, unknown>;
  readonly readback: RuntimeReadback;
}

/** The freeze: the live stage, archived, then the record. Throws before the record is written if any stage refuses. */
export type OracleRunner = (oracleDir: string, inputPath: string, factsPath: string) => OracleSummary;

export async function freezeGoldenCase(
  config: FreezeConfig,
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>,
  oracleRunner: OracleRunner = runOracle,
): Promise<FreezeResult> {
  const raw = JSON.parse(readFileSync(config.inputPath, 'utf8')) as unknown;
  assertGoldenInput(raw);
  const { readback, responses } = await runLiveStage({ ...config, case: { birthInput: raw, ref: GOLDEN_CASE_REF } }, fetchImpl);
  if (!existsSync(config.archiveDir)) mkdirSync(config.archiveDir, { recursive: true, mode: 0o700 });
  for (const label of EXCHANGE_LABELS) writePrivate(join(config.archiveDir, `${label}.response.json`), responses[label]);
  writePrivate(join(config.archiveDir, 'runtime-readback.json'), renderJson(readback));
  return { record: await buildFreezeRecord(config, raw, readback, responses, oracleRunner), readback };
}

/** Offline: the archived live stage, replayed, into the record. Used by the freeze and by `verify`. */
export function loadArchivedRun(archiveDir: string): { readback: RuntimeReadback; responses: Record<ExchangeLabel, Uint8Array> } {
  const readback = JSON.parse(readFileSync(join(archiveDir, 'runtime-readback.json'), 'utf8')) as RuntimeReadback;
  const responses = Object.fromEntries(EXCHANGE_LABELS.map((label) => [label, new Uint8Array(readFileSync(join(archiveDir, `${label}.response.json`)))])) as Record<ExchangeLabel, Uint8Array>;
  return { readback, responses };
}

export async function buildFreezeRecord(
  config: Pick<FreezeConfig, 'archiveDir' | 'inputPath' | 'oracleDir'>,
  raw: unknown,
  readback: RuntimeReadback,
  responses: Readonly<Record<ExchangeLabel, Uint8Array>>,
  oracleRunner: OracleRunner = runOracle,
): Promise<Record<string, unknown>> {
  assertGoldenInput(raw);
  const archived: Record<string, string> = {};
  for (const label of EXCHANGE_LABELS) archived[`${label}.response.json`] = sha256Of(responses[label]);
  archived['runtime-readback.json'] = sha256Of(renderJson(readback));

  const { model, input } = await replayInterpretationInput(readback, responses, raw);
  const inputText = renderJson(input);
  writePrivate(join(config.archiveDir, 'interpretation-input.json'), inputText);
  archived['interpretation-input.json'] = sha256Of(inputText);

  const factsPath = join(config.archiveDir, 'oracle-facts.json');
  writePrivate(factsPath, JSON.stringify(deriveInterpretationFeatureSet(model).facts.map((fact) => ({ id: fact.id, value: fact.value }))));
  const oracle = oracleRunner(config.oracleDir, config.inputPath, factsPath);
  if (oracle.equal !== oracle.compared || oracle.compared === 0) {
    throw new FreezeError('FREEZE_ORACLE_MISMATCH', `the oracle disagrees on ${String(oracle.compared - oracle.equal)} fact(s): ${oracle.differing.join(', ')}`);
  }

  const record = {
    recordVersion: 'etbz53-golden-freeze-record.v1',
    caseRef: GOLDEN_CASE_REF,
    decisions: 'Rebaseline 62128133 section 19; Jira ETBZ-53 comments 17026 (D-53-1..3) and 17029 (location)',
    frozenAt: readback.executedAt,
    repositoryHead: readback.repositoryHead,
    birthInput: { ref: GOLDEN_CASE_REF, validated: true, birthTimeKnown: true, fields: [...BIRTH_INPUT_FIELDS] },
    runtime: {
      runtimeImage: readback.runtime.runtimeImage,
      baseUrlHost: readback.runtime.baseUrlHost,
      attestation: {
        status: readback.attestation.status,
        sourceRevisionExpected: readback.attestation.expectation.sourceRevision,
        documentSha256Expected: readback.attestation.expectation.openapiSha256,
      },
      probes: { health: readback.probes.health.status, ready: readback.probes.ready.status, withoutCredentials: readback.probes.unauthorised.status },
      exchanges: readback.exchanges.map(({ label, status, responseSha256, byteLength }) => ({ label, status, responseSha256, byteLength })),
    },
    interpretationInput: {
      structuralHash: input.structuralHash,
      productionEligible: input.productionEligibility.eligible,
      blockers: input.productionEligibility.blockers,
    },
    oracle: { tool: oracle.tool, compared: oracle.compared, equal: oracle.equal, byCategory: oracle.byCategory },
    archive: {
      location: config.archiveDir,
      note: 'outside every git repository, files mode 600; the input file and the oracle facts are not digested here (their value space is searchable)',
      files: archived,
    },
  };
  assertRecordCarriesNoCaseValue(renderJson(record), raw);
  return record;
}
