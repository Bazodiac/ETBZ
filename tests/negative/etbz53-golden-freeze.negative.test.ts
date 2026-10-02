/**
 * ETBZ-53 — the Golden freeze refuses fail-closed and never carries case data into the repository record.
 *
 * The Golden case itself is never in CI: these tests run the freeze on the synthetic rehearsal case against a fake
 * runtime built from the committed ETBZ-58 responses, with a stub in place of the oracle (CI has neither uv nor
 * lunar-python; the real oracle's positive and negative controls are recorded in docs/evidence/etbz-53/README.md).
 */
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import { loadRecordedRun, sha256Of } from '../support/etbz58Rehearsal.js';
import {
  GOLDEN_CASE_REF,
  assertGoldenInput,
  assertRecordCarriesNoCaseValue,
  buildFreezeRecord,
  freezeGoldenCase,
  loadArchivedRun,
  loadOrCreateKey,
} from '../support/etbz53GoldenFreeze.js';
import type { OracleSummary } from '../support/etbz53GoldenFreeze.js';

vi.setConfig({ testTimeout: 60_000 });

const REVISION = '8ad7dce62db5393654d27f2f2060a0ca644aa2b6';
const FAKE_OPENAPI = new TextEncoder().encode('{"openapi":"3.1.0"}');
// The rehearsal case, written as a raw candidate (the shape the Product Owner's file has).
const CASE = { displayName: 'Musterkundin A', birthDate: '1990-06-15', birthTime: '14:30', birthTimeKnown: true, timezone: 'Europe/Berlin', location: { lat: 52.52, lon: 13.405, label: 'Berlin' } };

const work = mkdtempSync(join(tmpdir(), 'etbz53-freeze-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const codeOf = async (action: () => unknown): Promise<string> => {
  try {
    await action();
    return 'ACCEPTED';
  } catch (error) {
    // A refusal carries a code; any other error is reported by its name, so a crash fails the assertion too.
    const code = (error as { code?: unknown }).code;
    if (error instanceof Error && typeof code === 'string') return code;
    if (error instanceof Error) return `THREW:${error.name}`;
    throw error;
  }
};

function fakeRuntime(): { fetch: (url: string, init: RequestInit) => Promise<Response>; calls: () => number } {
  const { readback, responses } = loadRecordedRun();
  let calls = 0;
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return {
    calls: () => calls,
    fetch: (url, init) => {
      calls += 1;
      const path = new URL(url).pathname;
      if (path === '/openapi.json') return Promise.resolve(new Response(FAKE_OPENAPI, { status: 200 }));
      if (path === '/v1/build') return Promise.resolve(json({ source_revision: REVISION }));
      if (path === '/v1/health' || path === '/v1/ready') return Promise.resolve(json({ status: 'healthy' }));
      const exchange = readback.exchanges.find((candidate) => candidate.path === path);
      if (exchange === undefined) return Promise.resolve(json({ detail: 'not found' }, 404));
      if (new Headers(init.headers).get('X-API-Key') === null) return Promise.resolve(json({ detail: 'missing key' }, 401));
      return Promise.resolve(new Response(responses[exchange.label], { status: 200, headers: { 'Content-Type': 'application/json' } }));
    },
  };
}

/** A stub oracle over the facts it is handed: `adjust` changes what it reports. */
const oracle = (adjust: (n: number) => Partial<OracleSummary> = () => ({})) => (_dir: string, _input: string, factsPath: string): OracleSummary => {
  const n = (JSON.parse(readFileSync(factsPath, 'utf8')) as unknown[]).length;
  return { tool: 'stub', exitStatus: 0, compared: n, equal: n, absent: 0, byCategory: { pillar: { compared: n, equal: n } }, differing: [], ...adjust(n) };
};
const allEqual = oracle();

function config(name: string, input: unknown) {
  const inputPath = join(work, `${name}.input.json`);
  writeFileSync(inputPath, JSON.stringify(input));
  chmodSync(inputPath, 0o600);
  return {
    inputPath,
    archiveDir: join(work, name),
    oracleDir: work,
    baseUrl: 'https://fufire.fake',
    apiKey: 'test-key',
    expectedOpenapiSha256: sha256Of(FAKE_OPENAPI).slice(7),
    expectedSourceRevision: REVISION,
    executedAt: '2026-10-02',
    repositoryHead: REVISION,
  };
}

describe('ETBZ-53: the input is checked before any call', () => {
  it.each([
    ['an invalid BirthInput', { ...CASE, birthDate: '1990-13-45' }, 'FREEZE_INPUT_INVALID'],
    ['an unknown-time BirthInput', { ...CASE, birthTime: undefined, birthTimeKnown: false }, 'FREEZE_INPUT_NOT_KNOWN_TIME'],
    ['a field beyond the BirthInput (a biographical hint)', { ...CASE, biography: 'not for the generator' }, 'FREEZE_INPUT_EXTRA_FIELDS'],
  ])('refuses %s and sends nothing', async (_label, input, code) => {
    const runtime = fakeRuntime();
    expect(await codeOf(() => freezeGoldenCase(config(`refused-${code}`, input), runtime.fetch, allEqual))).toBe(code);
    expect(runtime.calls()).toBe(0);
    expect(await codeOf(() => assertGoldenInput(input))).toBe(code);
  });
});

describe('ETBZ-53: the freeze archives privately and records no case data', () => {
  it('freezes a known-time case: archive files mode 600, an eligible InterpretationInput, a record without its values', async () => {
    const runtime = fakeRuntime();
    const settings = config('freeze', CASE);
    // An assertion, not a throw: a refusal of the freeze must fail this test, not error it.
    const outcome = await freezeGoldenCase(settings, runtime.fetch, allEqual).catch((error: unknown) => error);
    expect(outcome, (outcome as { code?: string }).code).not.toBeInstanceOf(Error);
    const { record } = outcome as Awaited<ReturnType<typeof freezeGoldenCase>>;
    for (const name of ['bazi.response.json', 'wuxing.response.json', 'natal.response.json', 'runtime-readback.json', 'interpretation-input.json', 'oracle-facts.json']) {
      expect(statSync(join(settings.archiveDir, name)).mode & 0o777, name).toBe(0o600);
    }
    const r = record as { caseRef: string; interpretationInput: { productionEligible: boolean }; oracle: { allFactsEqual: boolean; categories: string[] }; digests: { files: Record<string, string> } };
    expect(r.caseRef).toBe(GOLDEN_CASE_REF);
    expect(r.interpretationInput.productionEligible).toBe(true);
    expect(r.oracle.allFactsEqual).toBe(true);
    expect(Object.keys(r.digests.files).sort()).toEqual(['bazi.response.json', 'interpretation-input.json', 'interpretationInput.structuralHash', 'natal.response.json', 'runtime-readback.json', 'wuxing.response.json']);
    const text = canonicalJson(record);
    for (const value of ['1990-06-15', '19900615', '14:30', 'Europe/Berlin', '52.52', '13.405', 'Berlin', 'Musterkundin']) expect(text, value).not.toContain(value);
    expect(text).not.toContain(sha256Of(canonicalJson(CASE)));
    // No plain digest of anything the live stage produced: every committed digest is keyed.
    const { responses } = loadArchivedRun(settings.archiveDir);
    for (const body of Object.values(responses)) expect(text).not.toContain(sha256Of(body).slice(7));
    expect(text).not.toMatch(/(?<!hmac-)sha256:[0-9a-f]{64}/u);
    const digests = (record as { digests: { files: Record<string, string> } }).digests.files;
    for (const digest of Object.values(digests)) expect(digest).toMatch(/^hmac-sha256:[0-9a-f]{64}$/u);
    expect(text).not.toContain('byteLength');
    expect(readFileSync(join(settings.archiveDir, 'runtime-readback.json'), 'utf8')).toContain(GOLDEN_CASE_REF);
  });

  it('refuses to produce a record that would carry a value of the case', async () => {
    // The location label "wuxing" is a legal BirthInput value that the record carries anyway (an exchange label).
    const runtime = fakeRuntime();
    const colliding = { ...CASE, location: { ...CASE.location, label: 'wuxing' } };
    expect(await codeOf(() => freezeGoldenCase(config('collision', colliding), runtime.fetch, allEqual))).toBe('FREEZE_RECORD_LEAKS_CASE_DATA');
  });

  it.each([
    // Exit 0 on purpose: each case trips exactly one clause of the coverage check.
    ['disagrees on a fact', oracle((n) => ({ equal: n - 1, differing: ['chart.pillar.hour.branch'] }))],
    ['compares fewer facts than it was given', oracle((n) => ({ compared: n - 1, equal: n - 1 }))],
    ['derives a fact ETBZ did not hand it', oracle(() => ({ absent: 1 }))],
    ['exits non-zero', oracle(() => ({ exitStatus: 2 }))],
  ])('refuses, before any record exists, when the oracle %s', async (_label, stub) => {
    const runtime = fakeRuntime();
    expect(await codeOf(() => freezeGoldenCase(config(`oracle-${String(Math.random()).slice(2, 8)}`, CASE), runtime.fetch, stub))).toBe('FREEZE_ORACLE_MISMATCH');
  });

  it('refuses an input file that group or other may read', async () => {
    const runtime = fakeRuntime();
    const settings = config('loose', CASE);
    chmodSync(settings.inputPath, 0o644);
    expect(await codeOf(() => freezeGoldenCase(settings, runtime.fetch, allEqual))).toBe('FREEZE_NOT_PRIVATE');
    expect(runtime.calls()).toBe(0);
  });

  it('refuses an archive directory that group or other may read, before any call and before any key exists', async () => {
    const runtime = fakeRuntime();
    const settings = config('loose-archive', CASE);
    mkdirSync(settings.archiveDir, { mode: 0o755 });
    chmodSync(settings.archiveDir, 0o755);
    expect(await codeOf(() => freezeGoldenCase(settings, runtime.fetch, allEqual))).toBe('FREEZE_NOT_PRIVATE');
    expect(runtime.calls()).toBe(0);
    expect(await codeOf(() => loadOrCreateKey(settings.archiveDir, true))).toBe('FREEZE_NOT_PRIVATE');
    expect(readdirSync(settings.archiveDir)).toEqual([]);
  });

  it('re-derives the record offline only from an archive whose gates passed, whose input did not drift, with its key', async () => {
    const runtime = fakeRuntime();
    const settings = config('archive', CASE);
    const { record } = await freezeGoldenCase(settings, runtime.fetch, allEqual);
    const { readback, responses } = loadArchivedRun(settings.archiveDir);
    const key = loadOrCreateKey(settings.archiveDir, false);
    const archiveBytes = (): Record<string, string> => Object.fromEntries(readdirSync(settings.archiveDir).sort().map((name) => [name, sha256Of(readFileSync(join(settings.archiveDir, name)))]));
    const before = archiveBytes();
    expect(await buildFreezeRecord(settings, CASE, readback, responses, key, 'check', allEqual)).toEqual(record);
    // verify writes nothing into the archive and leaves no copy beside it.
    expect(archiveBytes()).toEqual(before);
    expect(readdirSync(work).filter((name) => name.startsWith('.verify-'))).toEqual([]);
    expect(canonicalJson(record)).not.toContain(key.toString('hex'));
    // Keyed: another key gives other digests for every file (a constant or absent key would not).
    const rekeyed = (await buildFreezeRecord(settings, CASE, readback, responses, Buffer.alloc(32, 7), 'check', allEqual)) as { digests: { files: Record<string, string> } };
    for (const [name, digest] of Object.entries((record as { digests: { files: Record<string, string> } }).digests.files)) expect(rekeyed.digests.files[name], name).not.toBe(digest);
    const fingerprint = (r: unknown): string => (r as { digests: { keyFingerprint: string } }).digests.keyFingerprint;
    expect(fingerprint(rekeyed)).not.toBe(fingerprint(record));
    const unready = { ...readback, probes: { ...readback.probes, ready: { ...readback.probes.ready, status: 503 } } };
    expect(await codeOf(() => buildFreezeRecord(settings, CASE, unready, responses, key, 'check', allEqual))).toBe('FREEZE_GATES_NOT_PASSED');
    const facts = join(settings.archiveDir, 'oracle-facts.json');
    const factsBytes = readFileSync(facts);
    writeFileSync(facts, '[]');
    expect(await codeOf(() => buildFreezeRecord(settings, CASE, readback, responses, key, 'check', allEqual))).toBe('FREEZE_ARCHIVE_DRIFT');
    writeFileSync(facts, factsBytes);
    writeFileSync(join(settings.archiveDir, 'interpretation-input.json'), '{}\n');
    expect(await codeOf(() => buildFreezeRecord(settings, CASE, readback, responses, key, 'check', allEqual))).toBe('FREEZE_ARCHIVE_DRIFT');
    rmSync(join(settings.archiveDir, 'record.hmac.key'));
    expect(await codeOf(() => loadOrCreateKey(settings.archiveDir, false))).toBe('FREEZE_KEY_MISSING');
  });

  it('refuses a record that carries a value of the case, naming the field and the path, not the value', async () => {
    let message = '';
    try {
      assertRecordCarriesNoCaseValue({ runtime: { note: 'born 1990-06-15' } }, CASE);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('birthDate in runtime.note');
    expect(message).not.toContain('1990-06-15');
    expect(await codeOf(() => assertRecordCarriesNoCaseValue({ caseRef: GOLDEN_CASE_REF }, { ...CASE, displayName: GOLDEN_CASE_REF }))).toBe('ACCEPTED');
  });
});
