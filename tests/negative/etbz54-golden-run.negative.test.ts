/**
 * ETBZ-54 — the Golden run's tooling refuses fail-closed and keeps the case private (PO authorization D-54-1, Jira
 * ETBZ-54 comment 17073).
 *
 * The Golden case is never in CI. These tests run the tooling on the synthetic rehearsal case: the drafts-as-data
 * path is proven equal to the ETBZ-59/60 drafts-as-code path on the same charts, and the archive functions run on a
 * synthetic archive frozen from the committed ETBZ-58 responses through a fake runtime (as the ETBZ-53 suite does).
 */
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { RELEASED_BUNDLE_HASHES } from '../../src/application/skill/index.js';
import type { InterpretiveClaim } from '../../src/application/interpretation/interpretive-claim.js';
import { PLAN_CONTRACT_BINDINGS_V1_1 } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlanDraft } from '../../src/application/interpretation/meta-narrative-plan.js';
import { buildInterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { contextFor, draftOf } from '../support/claimGraphFixture.js';
import { freezeGoldenCase } from '../support/etbz53GoldenFreeze.js';
import type { OracleSummary } from '../support/etbz53GoldenFreeze.js';
import { EXCHANGE_LABELS, loadRecordedRun, runLiveStage, sha256Of } from '../support/etbz58Rehearsal.js';
import { REMOVED_FACT_IDS, caseChart, caseClaims, casePlanDraft, deriveCase } from '../support/etbz59Cases.js';
import { claimSheet } from '../support/etbz59Judges.js';
import { variantReadbackFile, variantResponseFile } from '../support/etbz59Variants.js';
import { deriveRound2Case, round2Claims, round2PlanDraft } from '../support/etbz60Cases.js';
import { planContextFor } from '../support/metaNarrativePlanFixture.js';
import { KNOWN_BIRTH } from '../support/narrativeFixture.js';
import {
  GOLDEN_BUNDLE_REF,
  NEAR_DISPLAY_NAME,
  assertHourDifference,
  assertPinsHold,
  assertTreePrivate,
  bindPlanDraft,
  citedValues,
  deriveGoldenCase,
  goldenBundle,
  goldenChart,
  nearBirthInput,
  nearBirthTime,
  nearChart,
  nearReadbackFile,
  nearResponseFile,
  parseGoldenDrafts,
  safeMessage,
  writePrivateFile,
} from '../support/etbz54Golden.js';
import type { CaseDraft, GoldenCharts, GoldenConfig, GoldenDrafts } from '../support/etbz54Golden.js';
import { namedDifference } from '../support/etbz59Individuality.js';
import { removalClaimSheet, scrubGolden } from '../support/etbz54Run.js';

vi.setConfig({ testTimeout: 60_000 });

const work = mkdtempSync(join(tmpdir(), 'etbz54-golden-'));
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
const messageOf = async (action: () => unknown): Promise<string> => {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
};

// ---------------------------------------------------------------------------------------------------------------
// The drafts as data, against the ETBZ-59/60 drafts as code on the same charts
// ---------------------------------------------------------------------------------------------------------------

/** A code-built draft as the drafts file states it: claims with handles, the plan with handles, the pins. */
function asCaseDraft(claims: readonly InterpretiveClaim[], plan: MetaNarrativePlanDraft, model: GoldenCharts['source']['model']): CaseDraft {
  const graph = buildInterpretiveClaimGraph(draftOf(claims, contextFor(model)), contextFor(model));
  const handleOf = (id: string): string => {
    const statement = graph.claims.find((claim) => claim.claimId === id)?.statement;
    const draft = claims.find((claim) => claim.statement === statement);
    if (draft === undefined) throw new Error(`test: no draft for ${id}`);
    return draft.claimId;
  };
  const bind = (refs: readonly string[]): string[] => refs.map(handleOf);
  return {
    claims: JSON.parse(JSON.stringify(claims)) as CaseDraft['claims'],
    plan: {
      reportThesis: { claimRefs: bind(plan.reportThesis.claimRefs) },
      primaryMotifs: plan.primaryMotifs.map((motif) => ({ motifId: motif.motifId, coreClaimRefs: bind(motif.coreClaimRefs) })),
      tensions: plan.tensions.map((tension) => ({ claimRefs: bind(tension.claimRefs) })),
      openThreads: plan.openThreads.map((thread) => ({ threadId: thread.threadId, claimRefs: bind(thread.claimRefs), resolution: thread.resolution })),
      chapterPlan: plan.chapterPlan.map((chapter) => ({ ...chapter, claimRefs: bind(chapter.claimRefs), motifTransitions: chapter.motifTransitions.map((t) => ({ ...t })), opensThreadRefs: [...chapter.opensThreadRefs], closesThreadRefs: [...chapter.closesThreadRefs] })),
    },
    pins: Object.fromEntries(citedValues(model, claims)),
  };
}

async function fixtureDrafts(): Promise<{ charts: GoldenCharts; drafts: GoldenDrafts }> {
  const charts: GoldenCharts = { source: await caseChart('source'), near: await caseChart('near'), removal: await caseChart('removal') };
  const draft = (label: 'source' | 'near'): CaseDraft => {
    const model = charts[label].model;
    const claims = round2Claims(label, model);
    const context = contextFor(model);
    const graph = buildInterpretiveClaimGraph(draftOf(claims, context), context);
    return asCaseDraft(claims, round2PlanDraft(label, { ...context, graph, contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 }), model);
  };
  const removalModel = charts.removal.model;
  const removalClaims = caseClaims('removal', removalModel);
  const removalContext = contextFor(removalModel);
  const removalGraph = buildInterpretiveClaimGraph(draftOf(removalClaims, removalContext), removalContext);
  const removal = asCaseDraft(removalClaims, casePlanDraft('removal', { ...planContextFor(removalContext, removalGraph), contractBindings: PLAN_CONTRACT_BINDINGS_V1_1 }), removalModel);
  const drafts = parseGoldenDrafts({
    draftVersion: 'etbz54-golden-drafts.v1',
    cases: { source: draft('source'), near: draft('near'), removal },
    removal: { factIds: [...REMOVED_FACT_IDS] },
    rescueTerms: { subjectTerms: ['SevenKilling'], positionTerms: ['Stunde'], why: 'fixture' },
  });
  return { charts, drafts };
}

describe('ETBZ-54: the drafts as data build what the drafts as code build', () => {
  it('derives the ETBZ-60 round-2 packages of S and N and the ETBZ-59 package of S⁻, byte for byte by hash', async () => {
    const { charts, drafts } = await fixtureDrafts();
    for (const label of ['source', 'near'] as const) {
      const golden = deriveGoldenCase(label, charts, drafts);
      const code = await deriveRound2Case(label);
      expect(golden.graph.structuralHash, label).toBe(code.graph.structuralHash);
      expect(golden.plan.structuralHash, label).toBe(code.plan.structuralHash);
      expect(golden.inputPackage.structuralHash, label).toBe(code.inputPackage.structuralHash);
    }
    expect(deriveGoldenCase('removal', charts, drafts).inputPackage.structuralHash).toBe((await deriveCase('removal')).inputPackage.structuralHash);
  });

  it('binds the released 1.1.0 bundle explicitly, never the 1.0.0 default', async () => {
    const { charts, drafts } = await fixtureDrafts();
    const run = deriveGoldenCase('source', charts, drafts);
    expect(run.bundle.bundleRef).toBe(GOLDEN_BUNDLE_REF);
    expect(run.bundle.structuralHash).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
    expect(run.inputPackage.bundleStructuralHash).toBe(RELEASED_BUNDLE_HASHES['1.1.0']);
    expect(run.inputPackage.skillRef).toBe('bazodiac-interpretation-skill@1.1.0');
    expect(goldenBundle().structuralHash).not.toBe(RELEASED_BUNDLE_HASHES['1.0.0']);
  });

  it('refuses a chart on which a cited fact differs from its pin, naming ids and never values', async () => {
    const { charts, drafts } = await fixtureDrafts();
    const pins = { ...drafts.cases.source.pins, 'chart.dayMaster.stem': '"Geng"' };
    const drifted = { ...drafts, cases: { ...drafts.cases, source: { ...drafts.cases.source, pins } } };
    expect(await codeOf(() => deriveGoldenCase('source', charts, drifted))).toBe('GOLDEN_DRAFT_FACTS_DRIFTED');
    const message = await messageOf(() => { assertPinsHold('source', charts.source.model, drifted.cases.source); });
    expect(message).toContain('chart.dayMaster.stem');
    expect(message).not.toContain('Geng');
    expect(message).not.toContain('Xin');
  });

  it('refuses a pin that no claim cites', async () => {
    const { charts, drafts } = await fixtureDrafts();
    const pins = { ...drafts.cases.source.pins, 'chart.pillar.year.branch': '"Wu"' };
    expect(await codeOf(() => { assertPinsHold('source', charts.source.model, { ...drafts.cases.source, pins }); })).toBe('GOLDEN_DRAFT_FACTS_DRIFTED');
  });

  it('refuses a plan that names a handle no draft claim carries', async () => {
    const { charts, drafts } = await fixtureDrafts();
    const plan = { ...drafts.cases.source.plan, reportThesis: { claimRefs: ['draft.nowhere'] } };
    expect(await codeOf(() => deriveGoldenCase('source', charts, { ...drafts, cases: { ...drafts.cases, source: { ...drafts.cases.source, plan } } }))).toBe('GOLDEN_DRAFT_HANDLE_UNKNOWN');
    const context = contextFor(charts.source.model);
    const claims = drafts.cases.source.claims as readonly InterpretiveClaim[];
    const graph = buildInterpretiveClaimGraph(draftOf(claims, context), context);
    expect(await codeOf(() => bindPlanDraft(plan, claims, { ...context, graph }))).toBe('GOLDEN_DRAFT_HANDLE_UNKNOWN');
  });

  it('refuses a drafts file that is not of its schema, by path and code only', async () => {
    const { drafts } = await fixtureDrafts();
    expect(await codeOf(() => parseGoldenDrafts({ ...drafts, draftVersion: 'v0' }))).toBe('GOLDEN_DRAFTS_INVALID');
    expect(await codeOf(() => parseGoldenDrafts({ ...drafts, extra: true }))).toBe('GOLDEN_DRAFTS_INVALID');
    const [first, ...rest] = drafts.cases.source.claims;
    const secret = 'A statement that must not be echoed';
    const bad = { ...drafts, cases: { ...drafts.cases, source: { ...drafts.cases.source, claims: [{ ...first, statement: secret, relations: [{ type: 'LOVES', targetClaimId: 'x' }] }, ...rest] } } };
    expect(await codeOf(() => parseGoldenDrafts(bad))).toBe('GOLDEN_DRAFTS_INVALID');
    expect(await messageOf(() => parseGoldenDrafts(bad))).not.toContain(secret);
    expect(await codeOf(() => parseGoldenDrafts({ ...drafts, removal: { factIds: [] } }))).toBe('GOLDEN_DRAFTS_INVALID');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The near neighbour N (D-53-6)
// ---------------------------------------------------------------------------------------------------------------

describe('ETBZ-54: N is the frozen input in the neighbouring two-hour block', () => {
  it('moves the time two hours later, or else earlier, staying on the date and out of 23:00-23:59', () => {
    expect(nearBirthTime('14:30')).toEqual({ birthTime: '16:30', direction: 'LATER' });
    expect(nearBirthTime('00:05')).toEqual({ birthTime: '02:05', direction: 'LATER' });
    expect(nearBirthTime('20:59')).toEqual({ birthTime: '22:59', direction: 'LATER' });
    expect(nearBirthTime('21:00')).toEqual({ birthTime: '19:00', direction: 'EARLIER' });
    expect(nearBirthTime('22:59')).toEqual({ birthTime: '20:59', direction: 'EARLIER' });
    expect(nearBirthTime('23:30')).toEqual({ birthTime: '21:30', direction: 'EARLIER' });
    expect(nearBirthTime('14:30:15')).toEqual({ birthTime: '16:30:15', direction: 'LATER' });
  });

  it('refuses a time that is not HH:MM or HH:MM:SS', async () => {
    for (const time of ['9:30', '14:30:0', '14:30:00:00', '', 'noon']) expect(await codeOf(() => nearBirthTime(time)), time).toBe('GOLDEN_NEAR_SHIFT_UNAVAILABLE');
  });

  it('changes exactly the birth time and the display name, which marks the synthetic variant', () => {
    const raw = JSON.parse(JSON.stringify(KNOWN_BIRTH)) as Record<string, unknown>;
    const { birthInput } = nearBirthInput(raw);
    expect(Object.keys(birthInput).sort()).toEqual(Object.keys(raw).sort());
    const changed = Object.keys(raw).filter((key) => JSON.stringify(birthInput[key]) !== JSON.stringify(raw[key])).sort();
    expect(changed).toEqual(['birthTime', 'displayName']);
    expect(birthInput['displayName']).toBe(NEAR_DISPLAY_NAME);
  });

  it('refuses an input that is not a valid known-time BirthInput, before any shift', async () => {
    const raw = JSON.parse(JSON.stringify(KNOWN_BIRTH)) as Record<string, unknown>;
    expect(await codeOf(() => nearBirthInput({ ...raw, birthTimeKnown: false }))).toMatch(/^FREEZE_INPUT_/u);
    expect(await codeOf(() => nearBirthInput({ ...raw, hint: 'x' }))).toBe('FREEZE_INPUT_EXTRA_FIELDS');
  });

  it('accepts a named difference in the hour pillar and the tally it feeds, and nothing else', async () => {
    expect(await codeOf(() => { assertHourDifference(['chart.pillar.hour.stem', 'chart.natal.pillar.hour.tenGod', 'chart.wuxing.weight.Erde']); })).toBe('ACCEPTED');
    expect(await codeOf(() => { assertHourDifference([]); })).toBe('GOLDEN_NEAR_DIFFERENCE_NOT_HOUR');
    expect(await codeOf(() => { assertHourDifference(['chart.wuxing.weight.Erde']); })).toBe('GOLDEN_NEAR_DIFFERENCE_NOT_HOUR');
    for (const foreign of ['chart.pillar.day.stem', 'chart.natal.pillar.month.hiddenStem.0.tenGod', 'chart.dayMaster.stem', 'chart.natal.monthCommand.branch']) {
      expect(await codeOf(() => { assertHourDifference(['chart.pillar.hour.stem', foreign]); }), foreign).toBe('GOLDEN_NEAR_DIFFERENCE_NOT_HOUR');
    }
  });

  it('measures the ETBZ-59 near variant of the fixture as an hour-pillar difference', async () => {
    assertHourDifference(namedDifference((await caseChart('source')).model, (await caseChart('near')).model));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The archive: private, re-derived, never drifting
// ---------------------------------------------------------------------------------------------------------------

const REVISION = '8ad7dce62db5393654d27f2f2060a0ca644aa2b6';
const FAKE_OPENAPI = new TextEncoder().encode('{"openapi":"3.1.0"}');

function fakeRuntime(): (url: string, init: RequestInit) => Promise<Response> {
  const { readback, responses } = loadRecordedRun();
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return (url, init) => {
    const path = new URL(url).pathname;
    if (path === '/openapi.json') return Promise.resolve(new Response(FAKE_OPENAPI, { status: 200 }));
    if (path === '/v1/build') return Promise.resolve(json({ source_revision: REVISION }));
    if (path === '/v1/health' || path === '/v1/ready') return Promise.resolve(json({ status: 'healthy' }));
    const exchange = readback.exchanges.find((candidate) => candidate.path === path);
    if (exchange === undefined) return Promise.resolve(json({ detail: 'not found' }, 404));
    if (new Headers(init.headers).get('X-API-Key') === null) return Promise.resolve(json({ detail: 'missing key' }, 401));
    return Promise.resolve(new Response(responses[exchange.label], { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
}
const stubOracle = (_dir: string, _input: string, factsPath: string): OracleSummary => {
  const n = (JSON.parse(readFileSync(factsPath, 'utf8')) as unknown[]).length;
  return { tool: 'stub', exitStatus: 0, compared: n, equal: n, absent: 0, byCategory: { pillar: { compared: n, equal: n } }, differing: [] };
};
const live = { baseUrl: 'https://fufire.fake', apiKey: 'test-key', expectedOpenapiSha256: sha256Of(FAKE_OPENAPI).slice(7), expectedSourceRevision: REVISION, executedAt: '2026-10-02', repositoryHead: REVISION };

/** A synthetic archive: the fixture case frozen through the fake runtime, exactly as ETBZ-53 freezes. */
async function syntheticArchive(name: string): Promise<GoldenConfig> {
  const inputPath = join(work, `${name}.input.json`);
  writeFileSync(inputPath, JSON.stringify(KNOWN_BIRTH));
  chmodSync(inputPath, 0o600);
  const archiveDir = join(work, name);
  await freezeGoldenCase({ inputPath, archiveDir, oracleDir: work, ...live }, fakeRuntime(), stubOracle);
  return { inputPath, archiveDir };
}

describe('ETBZ-54: the archive', () => {
  it('replays S from the archive and refuses an archived InterpretationInput that drifted', async () => {
    const config = await syntheticArchive('drift');
    const chart = await goldenChart(config);
    expect(chart.input.productionEligibility.eligible).toBe(true);
    const path = join(config.archiveDir, 'interpretation-input.json');
    writeFileSync(path, readFileSync(path, 'utf8').replace('"schemaVersion"', ' "schemaVersion"'));
    expect(await codeOf(() => goldenChart(config))).toBe('GOLDEN_ARCHIVE_DRIFT');
  });

  it('replays N from its archived live record (the ETBZ-59 near variant of the same input)', async () => {
    const config = await syntheticArchive('near');
    mkdirSync(join(config.archiveDir, 'etbz54', 'variants', 'near'), { recursive: true, mode: 0o700 });
    cpSync(variantReadbackFile('near'), nearReadbackFile(config));
    for (const exchange of EXCHANGE_LABELS) cpSync(variantResponseFile('near', exchange), nearResponseFile(config, exchange));
    const near = await nearChart(config);
    expect(near.model.displayName).toBe(NEAR_DISPLAY_NAME);
    assertHourDifference(namedDifference((await goldenChart(config)).model, near.model));
  });

  it('refuses a near record whose chart does not differ in the hour pillar (a runtime that ignored the time)', async () => {
    const config = await syntheticArchive('flat');
    const raw = JSON.parse(readFileSync(config.inputPath, 'utf8')) as unknown;
    const { readback, responses } = await runLiveStage({ ...live, case: { birthInput: nearBirthInput(raw).birthInput, ref: 'test' } }, fakeRuntime());
    for (const exchange of EXCHANGE_LABELS) writePrivateFile(nearResponseFile(config, exchange), responses[exchange]);
    writePrivateFile(nearReadbackFile(config), JSON.stringify(readback));
    const delta = namedDifference((await goldenChart(config)).model, (await nearChart(config)).model);
    expect(await codeOf(() => { assertHourDifference(delta); })).toBe('GOLDEN_NEAR_DIFFERENCE_NOT_HOUR');
  });

  it('writes private files (600) in private folders (700) and refuses a tree that group or other may read', async () => {
    const dir = join(work, 'tree');
    writePrivateFile(join(dir, 'a', 'b', 'file.json'), '{}');
    expect(statSync(join(dir, 'a', 'b', 'file.json')).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'a', 'b')).mode & 0o777).toBe(0o700);
    chmodSync(dir, 0o700);
    expect(await codeOf(() => { assertTreePrivate(dir); })).toBe('ACCEPTED');
    chmodSync(join(dir, 'a', 'b', 'file.json'), 0o644);
    expect(await codeOf(() => { assertTreePrivate(dir); })).toBe('GOLDEN_NOT_PRIVATE');
    chmodSync(join(dir, 'a', 'b', 'file.json'), 0o600);
    chmodSync(join(dir, 'a'), 0o755);
    expect(await codeOf(() => { assertTreePrivate(dir); })).toBe('GOLDEN_NOT_PRIVATE');
  });

  it('withholds a message that quotes a value of the input file', () => {
    expect(safeMessage(`bad date ${String(KNOWN_BIRTH.birthDate)}`, KNOWN_BIRTH)).toBe('(message withheld: it quotes the case input)');
    expect(safeMessage('READING_FACT_UNKNOWN at chapters[1]', KNOWN_BIRTH)).toBe('READING_FACT_UNKNOWN at chapters[1]');
  });
});

describe('ETBZ-54: the judge packets', () => {
  it('names the withdrawn facts of this run on S⁻\'s claim sheet, not the fixture\'s', async () => {
    const run = await deriveCase('removal');
    const removed = ['chart.natal.pillar.day.hiddenStem.0.tenGod'];
    const sheet = removalClaimSheet(run, removed);
    expect(sheet.endsWith(`withdrawn facts: ${removed.join(', ')}\n`)).toBe(true);
    expect(sheet.slice(0, -1).split('\n').slice(0, -1).join('\n')).toBe(claimSheet('removal', run).slice(0, -1).split('\n').slice(0, -1).join('\n'));
  });

  it('replaces the case reference in a blind packet', () => {
    expect(scrubGolden('Erstellt für GOLDEN-KT-01, für GOLDEN-KT-01.')).toBe('Erstellt für [Name], für [Name].');
  });
});
