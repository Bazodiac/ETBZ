/**
 * ETBZ-58 — the rehearsal orchestrator refuses fail-closed (AC 6, the paths this slice adds). The live stage
 * runs here against a fake runtime built from the committed evidence: no test reaches FuFirE. The negative paths
 * the product chain already proves at the same boundary are mapped in docs/evidence/etbz-58/README.md.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  ETBZ58_SKILL_INPUT,
  assembleRehearsal,
  deriveRehearsalInput,
  loadRecordedRun,
  runLiveStage,
  sha256Of,
} from '../support/etbz58Rehearsal.js';
import type { ExchangeLabel, RuntimeReadback } from '../support/etbz58Rehearsal.js';

vi.setConfig({ testTimeout: 60_000 });

const REVISION = '8ad7dce62db5393654d27f2f2060a0ca644aa2b6';
const FAKE_OPENAPI = new TextEncoder().encode('{"openapi":"3.1.0"}');

const codeOf = async (action: () => Promise<unknown>): Promise<string> => {
  try {
    await action();
    return 'ACCEPTED';
  } catch (error) {
    // Every refusal of the chain carries a code (RehearsalError, InterpretationInputError, SkillRunError, ClaimError ...).
    const code = (error as { code?: unknown }).code;
    if (error instanceof Error && typeof code === 'string') return code;
    throw error;
  }
};

/** The recorded run with one response body replaced and the readback re-sealed to it: a different live answer. */
function withNatalAnswer(transform: (text: string) => string): { readback: RuntimeReadback; responses: Record<ExchangeLabel, Uint8Array> } {
  const { readback, responses } = loadRecordedRun();
  const text = new TextDecoder().decode(responses.natal);
  const next = transform(text);
  expect(next).not.toBe(text);
  const bytes = new TextEncoder().encode(next);
  return {
    readback: { ...readback, exchanges: readback.exchanges.map((exchange) => (exchange.label === 'natal' ? { ...exchange, responseSha256: sha256Of(bytes), byteLength: bytes.byteLength } : exchange)) },
    responses: { ...responses, natal: bytes },
  };
}

interface FakeRuntimeOptions {
  readonly revision?: string;
  readonly readyStatus?: number;
  readonly withoutCredential?: number;
}

/** A runtime answering like the live one did: the recorded bodies for the calculations, credentials required. */
function fakeRuntime(options: FakeRuntimeOptions = {}): { fetch: (url: string, init: RequestInit) => Promise<Response>; calculations: () => number } {
  const { readback, responses } = loadRecordedRun();
  let calculations = 0;
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return {
    calculations: () => calculations,
    fetch: (url, init) => {
      const path = new URL(url).pathname;
      if (path === '/openapi.json') return Promise.resolve(new Response(FAKE_OPENAPI, { status: 200 }));
      if (path === '/v1/build') return Promise.resolve(json({ source_revision: options.revision ?? REVISION }));
      if (path === '/v1/health') return Promise.resolve(json({ status: 'healthy' }));
      if (path === '/v1/ready') return Promise.resolve(json({ status: 'healthy' }, options.readyStatus ?? 200));
      const exchange = readback.exchanges.find((candidate) => candidate.path === path);
      if (exchange === undefined) return Promise.resolve(json({ detail: 'not found' }, 404));
      const headers = new Headers(init.headers);
      if (headers.get('X-API-Key') === null) return Promise.resolve(json({ detail: 'missing key' }, options.withoutCredential ?? 401));
      calculations += 1;
      return Promise.resolve(new Response(responses[exchange.label], { status: 200, headers: { 'Content-Type': 'application/json' } }));
    },
  };
}

const liveConfig = { baseUrl: 'https://fufire.fake', apiKey: 'test-key', expectedOpenapiSha256: sha256Of(FAKE_OPENAPI).slice(7), expectedSourceRevision: REVISION, executedAt: '2026-10-01', repositoryHead: REVISION };

describe('ETBZ-58: the live stage fails closed before it calculates', () => {
  it('records, against a runtime that answers like the live one, the same bytes the committed run recorded', async () => {
    const runtime = fakeRuntime();
    const { readback, responses } = await runLiveStage(liveConfig, runtime.fetch);
    const recorded = loadRecordedRun().readback;
    expect(readback.exchanges.map((exchange) => [exchange.label, exchange.requestSha256, exchange.responseSha256, exchange.byteLength])).toEqual(
      recorded.exchanges.map((exchange) => [exchange.label, exchange.requestSha256, exchange.responseSha256, exchange.byteLength]),
    );
    expect(readback.probes.unauthorised).toMatchObject({ status: 401, refused: true });
    expect(runtime.calculations()).toBe(3);
    expect(Object.keys(responses).sort()).toEqual(['bazi', 'natal', 'wuxing']);
  });

  it('sends no calculation to a runtime whose source revision is not the expected one', async () => {
    const runtime = fakeRuntime({ revision: 'c914d5671257b3c3ec279da76715a9338313b2e1' });
    expect(await codeOf(() => runLiveStage(liveConfig, runtime.fetch))).toBe('REHEARSAL_RUNTIME_NOT_ATTESTED');
    expect(runtime.calculations()).toBe(0);
  });

  it('sends no calculation to a runtime that is not ready', async () => {
    const runtime = fakeRuntime({ readyStatus: 503 });
    expect(await codeOf(() => runLiveStage(liveConfig, runtime.fetch))).toBe('REHEARSAL_RUNTIME_NOT_READY');
    expect(runtime.calculations()).toBe(0);
  });

  it('refuses a runtime that answers a call without credentials', async () => {
    const runtime = fakeRuntime({ withoutCredential: 200 });
    expect(await codeOf(() => runLiveStage(liveConfig, runtime.fetch))).toBe('REHEARSAL_RUNTIME_AUTH_NOT_ENFORCED');
  });
});

describe('ETBZ-58: the replay accepts only the recorded run', () => {
  it('re-derives the committed Skill input package from the committed run, byte for byte', async () => {
    const { readback, responses } = loadRecordedRun();
    const { inputPackage } = await deriveRehearsalInput(readback, responses);
    expect(`${canonicalJson(inputPackage)}\n`).toBe(readFileSync(resolve(process.cwd(), ETBZ58_SKILL_INPUT), 'utf8'));
  });

  it('refuses response bytes that are not the recorded ones', async () => {
    const { readback, responses } = loadRecordedRun();
    const tampered = new Uint8Array(responses.wuxing);
    tampered[tampered.length - 2] = 0x20;
    expect(await codeOf(() => deriveRehearsalInput(readback, { ...responses, wuxing: tampered }))).toBe('REHEARSAL_EVIDENCE_TAMPERED');
  });

  it('refuses a request body other than the recorded one', async () => {
    const { readback, responses } = loadRecordedRun();
    const other = { ...readback, exchanges: readback.exchanges.map((exchange) => (exchange.label === 'bazi' ? { ...exchange, requestSha256: sha256Of('{}') } : exchange)) };
    expect(await codeOf(() => deriveRehearsalInput(other, responses))).toBe('REHEARSAL_REPLAY_REQUEST_MISMATCH');
  });

  it('refuses a readback whose recorded calls are not each answered exactly once', async () => {
    const { readback, responses } = loadRecordedRun();
    const doubled = { ...readback, exchanges: [...readback.exchanges, ...readback.exchanges.filter((exchange) => exchange.label === 'natal')] };
    expect(await codeOf(() => deriveRehearsalInput(doubled, responses))).toBe('REHEARSAL_REPLAY_CALL_COUNT');
  });

  it('refuses a call the run did not record', async () => {
    const { readback, responses } = loadRecordedRun();
    const partial = { ...readback, exchanges: readback.exchanges.filter((exchange) => exchange.label !== 'natal') };
    expect(await codeOf(() => deriveRehearsalInput(partial, responses))).toBe('REHEARSAL_REPLAY_UNKNOWN_CALL');
  });
});

describe('ETBZ-58: the hand-off needs the attested runtime and the reviewed facts', () => {
  it('does not hand off a chart whose runtime attestation did not pass', async () => {
    const { readback, responses } = loadRecordedRun();
    const blocked = { ...readback, attestation: { ...readback.attestation, status: 'BLOCKED' as const, findings: [{ code: 'SOURCE_REVISION_MISMATCH', severity: 'BLOCKED', detail: 'synthetic' }] } } as RuntimeReadback;
    expect(await codeOf(() => deriveRehearsalInput(blocked, responses))).toBe('REHEARSAL_NOT_PRODUCTION_ELIGIBLE');
  });

  it('refuses a typed PASS whose own expectation and observation do not evaluate to PASS', async () => {
    const { readback, responses } = loadRecordedRun();
    const typed = { ...readback, attestation: { ...readback.attestation, expectation: { ...readback.attestation.expectation, sourceRevision: 'c914d5671257b3c3ec279da76715a9338313b2e1' } } };
    expect(await codeOf(() => deriveRehearsalInput(typed, responses))).toBe('INTERPRETATION_INPUT_ATTESTATION_FOREIGN');
  });

  it('refuses a live chart on which a fact the reviewed drafts cite has another value', async () => {
    // A consistent, different Ten-God tuple on the month stem (cited by the drafts): what a changed runtime could answer.
    const drifted = withNatalAnswer((text) =>
      text.replace(
        /("month":\{.*?"ten_god":\{)"name":"HurtingOfficer","pinyin":"Shang Guan"(,"element_relation":"produced_by_day_master","label_de":)"Disruptive Ausgabe"/u,
        '$1"name":"EatingGod","pinyin":"Shi Shen"$2"Schöpferische Ausgabe"',
      ),
    );
    expect(await codeOf(() => deriveRehearsalInput(drifted.readback, drifted.responses))).toBe('REHEARSAL_DRAFT_FACTS_DRIFTED');
  });

  it('accepts a live chart that differs only in facts the drafts do not cite (the hour branch, as measured)', async () => {
    const { readback, responses } = loadRecordedRun();
    const { inputPackage } = await deriveRehearsalInput(readback, responses);
    const hour = inputPackage.facts.filter((fact) => fact.id.startsWith('chart.natal.pillar.hour.hiddenStem.1.')).map((fact) => [fact.id, fact.value]);
    expect(hour).toContainEqual(['chart.natal.pillar.hour.hiddenStem.1.stem', 'Ding']);
  });
});

describe('ETBZ-58: an existing reading is not this run', () => {
  it('refuses the ETBZ-57 reading of the fixture package against the live package', async () => {
    const { readback, responses } = loadRecordedRun();
    const rehearsal = await deriveRehearsalInput(readback, responses);
    const earlier = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/evidence/etbz-57/fixture/semantic-reading.json'), 'utf8')) as unknown;
    expect(await codeOf(() => Promise.resolve().then(() => assembleRehearsal(rehearsal, earlier, earlier)))).toBe('READING_PACKAGE_MISMATCH');
  });
});
