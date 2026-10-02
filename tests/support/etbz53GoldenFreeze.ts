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
import { createHmac, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { validateBirthInput } from '../../src/domain/birth-input.js';
import { EXCHANGE_LABELS, renderJson, replayInterpretationInput, runLiveStage } from './etbz58Rehearsal.js';
import type { ExchangeLabel, LiveStageConfig, RuntimeReadback } from './etbz58Rehearsal.js';

export const GOLDEN_CASE_REF = 'GOLDEN-KT-01';
export const ETBZ53_RECORD = 'docs/evidence/etbz-53/freeze-record.json';
/** The fields a BirthInput may carry; anything else would be a hint the generator must not receive (AC 5). */
export const BIRTH_INPUT_FIELDS = ['birthDate', 'birthTime', 'birthTimeKnown', 'displayName', 'location', 'timezone'] as const;

export type FreezeErrorCode =
  | 'FREEZE_INPUT_INVALID'
  | 'FREEZE_INPUT_NOT_KNOWN_TIME'
  | 'FREEZE_INPUT_EXTRA_FIELDS'
  | 'FREEZE_UNREADABLE'
  | 'FREEZE_NOT_PRIVATE'
  | 'FREEZE_KEY_MISSING'
  | 'FREEZE_GATES_NOT_PASSED'
  | 'FREEZE_ARCHIVE_DRIFT'
  | 'FREEZE_ORACLE_MISMATCH'
  | 'FREEZE_RECORD_LEAKS_CASE_DATA';

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
  /** The oracle process's exit status (0 = every compared fact equal). */
  readonly exitStatus: number | null;
  readonly compared: number;
  /** Facts the oracle derives but ETBZ did not hand it. */
  readonly absent: number;
  readonly equal: number;
  readonly byCategory: Readonly<Record<string, Readonly<{ compared: number; equal: number }>>>;
  /** Fact ids only, never values. */
  readonly differing: readonly string[];
}

/** Refuses an input that is not a valid known-time BirthInput or carries fields beyond the six (codes only). */
export function assertGoldenInput(raw: unknown): void {
  const keys = raw !== null && typeof raw === 'object' ? Object.keys(raw).sort() : [];
  const extra = keys.filter((key) => !(BIRTH_INPUT_FIELDS as readonly string[]).includes(key));
  if (extra.length > 0) throw new FreezeError('FREEZE_INPUT_EXTRA_FIELDS', `${String(extra.length)} field(s) beyond the BirthInput (names not shown)`);
  const result = validateBirthInput(raw);
  if (!result.ok) {
    throw new FreezeError('FREEZE_INPUT_INVALID', `issues: ${JSON.stringify(result.issues.map((issue) => (issue as { code?: unknown }).code))}`);
  }
  if (!result.value.birthTimeKnown) throw new FreezeError('FREEZE_INPUT_NOT_KNOWN_TIME', 'ETBZ-53 freezes a known-time case');
}

/**
 * Every scalar of the input file, as text, that is long enough to identify, with the field it comes from. A value
 * contained in the case reference (`GOLDEN-KT-01`) is the public pseudonym, not case data: the Product Owner may use
 * it as the display name, and the record carries the reference by design.
 */
export function caseValues(raw: unknown): { field: string; value: string }[] {
  const out: { field: string; value: string }[] = [];
  const walk = (value: unknown, field: string): void => {
    if (typeof value === 'string' && value.length >= 3) out.push({ field, value });
    else if (typeof value === 'number') out.push({ field, value: String(value) });
    else if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, field === '' ? key : `${field}.${key}`);
  };
  walk(raw, '');
  const date = (raw as { birthDate?: unknown }).birthDate;
  if (typeof date === 'string') out.push({ field: 'birthDate (compact)', value: date.replaceAll('-', '') }, { field: 'birthDate (year+month)', value: date.slice(0, 4) + date.slice(5, 7) });
  return out.filter(({ value }) => !GOLDEN_CASE_REF.includes(value));
}

/**
 * Refuses a record that contains any value of the input file. The refusal names the input field and the record path
 * where it occurs - never the value - so a coincidence (digits inside a hex digest) can be told from a leak.
 */
export function assertRecordCarriesNoCaseValue(record: unknown, raw: unknown): void {
  const hits: string[] = [];
  const scan = (value: unknown, path: string): void => {
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value);
      for (const { field, value: needle } of caseValues(raw)) if (text.includes(needle)) hits.push(`${field} in ${path}`);
    } else if (value !== null && typeof value === 'object') for (const [key, child] of Object.entries(value)) scan(child, path === '' ? key : `${path}.${key}`);
  };
  scan(record, '');
  if (hits.length > 0) throw new FreezeError('FREEZE_RECORD_LEAKS_CASE_DATA', `the record would carry case input: ${hits.join('; ')}`);
}

/** Parses JSON without letting a parser message echo the source text (Node quotes it on a syntax error). */
export function parseQuietly(text: string, what: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FreezeError('FREEZE_UNREADABLE', `${what} is not valid JSON (content not shown)`);
  }
}

export function runOracle(oracleDir: string, inputPath: string, factsPath: string): OracleSummary {
  const run = spawnSync('uv', ['run', '-q', 'python', 'oracle_compare.py', inputPath, factsPath], { cwd: oracleDir, encoding: 'utf8' });
  const report = parseQuietly(run.stdout, 'the oracle report') as {
    oracle: string;
    'local-civil-time': { compared: number; equal: number; byCategory: Record<string, { compared: number; equal: number; differs: string[]; absent: string[] }> };
  };
  const primary = report['local-civil-time'];
  return {
    tool: report.oracle,
    exitStatus: run.status,
    compared: primary.compared,
    equal: primary.equal,
    absent: Object.values(primary.byCategory).reduce((sum, value) => sum + value.absent.length, 0),
    byCategory: Object.fromEntries(Object.entries(primary.byCategory).map(([key, value]) => [key, { compared: value.compared, equal: value.equal }])),
    differing: Object.values(primary.byCategory).flatMap((value) => [...value.differs, ...value.absent]),
  };
}

const writePrivate = (path: string, data: string | Uint8Array): void => {
  writeFileSync(path, data);
  chmodSync(path, 0o600);
};

/** The archive and the input file must be private to their owner (directory 700, files 600). */
export function assertPrivate(archiveDir: string, inputPath: string): void {
  const loose = [
    [archiveDir, statSync(archiveDir).mode & 0o077],
    [inputPath, statSync(inputPath).mode & 0o077],
  ].filter(([, bits]) => bits !== 0);
  if (loose.length > 0) throw new FreezeError('FREEZE_NOT_PRIVATE', `group or other may access: ${loose.map(([path]) => String(path)).join(', ')}`);
}

/**
 * The record's digests are keyed (HMAC-SHA256) with a key that exists only in the local archive: a plain digest of a
 * body whose content is determined by the chart and a coarse timestamp could be searched back to the birth data
 * (privacy review of 4836ba4). The record names the key only by a keyed fingerprint.
 */
export const HMAC_KEY_FILE = 'record.hmac.key';

export function loadOrCreateKey(archiveDir: string, create: boolean): Buffer {
  if ((statSync(archiveDir).mode & 0o077) !== 0) throw new FreezeError('FREEZE_NOT_PRIVATE', 'group or other may access the archive directory');
  const path = join(archiveDir, HMAC_KEY_FILE);
  if (!existsSync(path)) {
    if (!create) throw new FreezeError('FREEZE_KEY_MISSING', `no ${HMAC_KEY_FILE} in the archive`);
    writePrivate(path, randomBytes(32));
  }
  if ((statSync(path).mode & 0o077) !== 0) throw new FreezeError('FREEZE_NOT_PRIVATE', `group or other may read ${HMAC_KEY_FILE}`);
  const key = readFileSync(path);
  if (key.length !== 32) throw new FreezeError('FREEZE_KEY_MISSING', `${HMAC_KEY_FILE} is not a 32-byte key`);
  return key;
}

export const keyed = (key: Buffer, data: string | Uint8Array): string => `hmac-sha256:${createHmac('sha256', key).update(data).digest('hex')}`;

export interface FreezeConfig extends Omit<LiveStageConfig, 'case'> {
  readonly inputPath: string;
  readonly archiveDir: string;
  readonly oracleDir: string;
}

export interface FreezeResult {
  readonly record: Record<string, unknown>;
  readonly readback: RuntimeReadback;
}

export type OracleRunner = (oracleDir: string, inputPath: string, factsPath: string) => OracleSummary;

/** The freeze: the live stage, archived, then the record. Throws before the record is written if any stage refuses. */
export async function freezeGoldenCase(
  config: FreezeConfig,
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>,
  oracleRunner: OracleRunner = runOracle,
): Promise<FreezeResult> {
  const raw = parseQuietly(readFileSync(config.inputPath, 'utf8'), 'the input file');
  assertGoldenInput(raw);
  if (!existsSync(config.archiveDir)) mkdirSync(config.archiveDir, { recursive: true, mode: 0o700 });
  assertPrivate(config.archiveDir, config.inputPath);
  const { readback, responses } = await runLiveStage({ ...config, case: { birthInput: raw, ref: GOLDEN_CASE_REF } }, fetchImpl);
  for (const label of EXCHANGE_LABELS) writePrivate(join(config.archiveDir, `${label}.response.json`), responses[label]);
  writePrivate(join(config.archiveDir, 'runtime-readback.json'), renderJson(readback));
  const key = loadOrCreateKey(config.archiveDir, true);
  return { record: await buildFreezeRecord(config, raw, readback, responses, key, 'write', oracleRunner), readback };
}

/** Offline: the archived live stage. */
export function loadArchivedRun(archiveDir: string): { readback: RuntimeReadback; responses: Record<ExchangeLabel, Uint8Array> } {
  const readback = parseQuietly(readFileSync(join(archiveDir, 'runtime-readback.json'), 'utf8'), 'the archived readback') as RuntimeReadback;
  const responses = Object.fromEntries(EXCHANGE_LABELS.map((label) => [label, new Uint8Array(readFileSync(join(archiveDir, `${label}.response.json`)))])) as Record<ExchangeLabel, Uint8Array>;
  return { readback, responses };
}

/**
 * The record from a live stage (fresh or archived). `write` stores the InterpretationInput and the oracle facts in
 * the archive; `check` (verify) writes nothing there - it requires the archived InterpretationInput to be the one
 * re-derived and runs the oracle on facts in a temporary directory.
 */
export async function buildFreezeRecord(
  config: Pick<FreezeConfig, 'archiveDir' | 'inputPath' | 'oracleDir'>,
  raw: unknown,
  readback: RuntimeReadback,
  responses: Readonly<Record<ExchangeLabel, Uint8Array>>,
  key: Buffer,
  archiveMode: 'write' | 'check',
  oracleRunner: OracleRunner = runOracle,
): Promise<Record<string, unknown>> {
  assertGoldenInput(raw);
  assertPrivate(config.archiveDir, config.inputPath);
  // The readback must show the gates the live stage enforced (a `record` or `verify` run re-reads them).
  const { probes, attestation } = readback;
  if (attestation.status !== 'PASS' || probes.health.status !== 200 || probes.ready.status !== 200 || !probes.unauthorised.refused) {
    throw new FreezeError('FREEZE_GATES_NOT_PASSED', 'the archived readback does not show attestation PASS, health and readiness 200 and a refused call without credentials');
  }

  const { model, input } = await replayInterpretationInput(readback, responses, raw);
  const inputText = renderJson(input);
  const inputPath = join(config.archiveDir, 'interpretation-input.json');
  if (archiveMode === 'write') writePrivate(inputPath, inputText);
  else if (readFileSync(inputPath, 'utf8') !== inputText) throw new FreezeError('FREEZE_ARCHIVE_DRIFT', 'the archived InterpretationInput is not the one the archived responses re-derive');

  const facts = deriveInterpretationFeatureSet(model).facts.map((fact) => ({ id: fact.id, value: fact.value }));
  const factsText = JSON.stringify(facts);
  if (archiveMode === 'check' && readFileSync(join(config.archiveDir, 'oracle-facts.json'), 'utf8') !== factsText) {
    throw new FreezeError('FREEZE_ARCHIVE_DRIFT', 'the archived oracle facts are not the ones the archived responses re-derive');
  }
  // `check` writes nothing into the archive; its copy of the facts goes into a private sibling directory of the
  // archive (inside the same private folder, never the system temp directory) and is removed afterwards.
  const factsDir = archiveMode === 'write' ? config.archiveDir : mkdtempSync(join(dirname(config.archiveDir), '.verify-'));
  const factsPath = join(factsDir, 'oracle-facts.json');
  writePrivate(factsPath, factsText);
  let oracle: OracleSummary;
  try {
    oracle = oracleRunner(config.oracleDir, config.inputPath, factsPath);
  } finally {
    if (archiveMode === 'check') rmSync(factsDir, { recursive: true, force: true });
  }
  // Coverage is bound: the oracle ran clean, compared exactly the facts it was given, and every one is equal.
  if (oracle.exitStatus !== 0 || oracle.absent !== 0 || oracle.compared !== facts.length || oracle.equal !== oracle.compared) {
    // No counts in the message: how many facts a chart holds depends on the chart.
    throw new FreezeError('FREEZE_ORACLE_MISMATCH', `the oracle did not agree on every fact handed over (exit ${String(oracle.exitStatus)})`);
  }

  const digests: Record<string, string> = {};
  for (const label of EXCHANGE_LABELS) digests[`${label}.response.json`] = keyed(key, responses[label]);
  digests['runtime-readback.json'] = keyed(key, renderJson(readback));
  digests['interpretation-input.json'] = keyed(key, inputText);
  digests['interpretationInput.structuralHash'] = keyed(key, input.structuralHash);

  const record = {
    recordVersion: 'etbz53-golden-freeze-record.v2',
    caseRef: GOLDEN_CASE_REF,
    decisions: 'Rebaseline 62128133 section 19; Jira ETBZ-53 comments 17026 (D-53-1..3) and 17029 (location)',
    frozenAt: readback.executedAt,
    liveStageRepositoryHead: readback.repositoryHead,
    birthInput: { ref: GOLDEN_CASE_REF, validated: true, birthTimeKnown: true, fields: [...BIRTH_INPUT_FIELDS] },
    runtime: {
      runtimeImage: readback.runtime.runtimeImage,
      baseUrlHost: readback.runtime.baseUrlHost,
      attestation: {
        status: attestation.status,
        sourceRevisionExpected: attestation.expectation.sourceRevision,
        documentSha256Expected: attestation.expectation.openapiSha256,
      },
      probes: { health: probes.health.status, ready: probes.ready.status, withoutCredentials: probes.unauthorised.status },
      exchanges: readback.exchanges.map(({ label, status }) => ({ label, status })),
    },
    interpretationInput: { productionEligible: input.productionEligibility.eligible, blockers: input.productionEligibility.blockers },
    // Counts are withheld: how many facts a category holds depends on the chart (e.g. the number of hidden stems).
    oracle: {
      tool: oracle.tool,
      categories: Object.keys(oracle.byCategory).sort(),
      allFactsEqual: true,
      coverage: 'every fact ETBZ derived was compared; none absent; the oracle exited 0',
    },
    digests: {
      algorithm: 'HMAC-SHA256, keyed with a 32-byte key held only in the local archive (record.hmac.key)',
      keyFingerprint: keyed(key, 'etbz53-golden-freeze-key-fingerprint'),
      files: digests,
    },
    archive: { location: config.archiveDir, note: 'outside every git repository; directory 700, files 600' },
  };
  assertRecordCarriesNoCaseValue(record, raw);
  return record;
}
